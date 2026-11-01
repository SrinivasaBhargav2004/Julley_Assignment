const { Server } = require('socket.io');
const prisma = require('../db/prisma');
const { verifyToken } = require('../utils/auth');

/**
 * Socket.IO Multi-Tenant Manager
 * Manages tenant-scoped rooms and active presence
 */
function setupSocketServer(httpServer, clientUrl) {
  const io = new Server(httpServer, {
    cors: {
      origin: clientUrl || '*',
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      credentials: true,
    },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  // Track active presence: boardRoomKey -> Map(socketId -> { user, cardFocusId, joinedAt })
  const presenceMap = new Map();

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      const userId = socket.handshake.auth.userId;

      let user = null;

      if (token) {
        const decoded = verifyToken(token);
        if (decoded && decoded.userId) {
          user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        }
      }

      if (!user && userId) {
        user = await prisma.user.findUnique({ where: { id: userId } });
      }

      if (!user) {
        return next(new Error('Authentication required for WebSocket connection'));
      }

      socket.user = user;
      next();
    } catch (err) {
      console.error('Socket authentication error:', err);
      next(new Error('Socket authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user;
    console.log(`🔌 Socket connected: ${user.name} (${socket.id})`);

    let currentTenantId = null;
    let currentBoardId = null;
    let currentRoomKey = null;

    // Join Board Room with Tenant Scoping
    socket.on('board:join', async ({ tenantId, boardId }) => {
      try {
        if (!tenantId || !boardId) {
          return socket.emit('error', { message: 'tenantId and boardId are required to join room' });
        }

        // 1. Verify tenant access for this user
        const tenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
        });

        if (!tenant) {
          return socket.emit('error', { message: 'Tenant does not exist' });
        }

        // Check user membership in tenant or org admin role
        const membership = await prisma.membership.findFirst({
          where: {
            userId: user.id,
            OR: [
              { organizationId: tenant.organizationId, role: 'ORG_ADMIN' },
              { tenantId: tenant.id },
            ],
          },
        });

        if (!membership) {
          return socket.emit('error', {
            message: `Cross-tenant channel access forbidden. You lack membership in tenant ${tenantId}.`,
          });
        }

        // Leave previous room if any
        if (currentRoomKey) {
          socket.leave(currentRoomKey);
          cleanupPresence(currentRoomKey, socket.id);
          broadcastPresence(currentRoomKey);
        }

        currentTenantId = tenantId;
        currentBoardId = boardId;
        currentRoomKey = `tenant:${tenantId}:board:${boardId}`;

        socket.join(currentRoomKey);
        socket.join(`tenant:${tenantId}`); // Tenant-wide notifications

        // Add to presence map
        if (!presenceMap.has(currentRoomKey)) {
          presenceMap.set(currentRoomKey, new Map());
        }

        presenceMap.get(currentRoomKey).set(socket.id, {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            avatarUrl: user.avatarUrl,
            role: membership.role,
          },
          activeCardId: null,
          joinedAt: new Date(),
        });

        console.log(`👤 User ${user.name} joined board room: ${currentRoomKey}`);

        // Broadcast updated presence list
        broadcastPresence(currentRoomKey);

        socket.emit('board:joined', {
          room: currentRoomKey,
          tenantId,
          boardId,
          activeUsers: getActiveUsers(currentRoomKey),
        });
      } catch (err) {
        console.error('Error joining board room:', err);
        socket.emit('error', { message: 'Failed to join board room' });
      }
    });

    // Leave board room
    socket.on('board:leave', () => {
      if (currentRoomKey) {
        socket.leave(currentRoomKey);
        cleanupPresence(currentRoomKey, socket.id);
        broadcastPresence(currentRoomKey);
        currentRoomKey = null;
        currentBoardId = null;
      }
    });

    // Live card focus / editing indicator
    socket.on('presence:focus-card', ({ cardId }) => {
      if (currentRoomKey && presenceMap.has(currentRoomKey)) {
        const roomUsers = presenceMap.get(currentRoomKey);
        if (roomUsers.has(socket.id)) {
          roomUsers.get(socket.id).activeCardId = cardId || null;
          broadcastPresence(currentRoomKey);
        }
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`❌ Socket disconnected: ${user.name} (${socket.id})`);
      if (currentRoomKey) {
        cleanupPresence(currentRoomKey, socket.id);
        broadcastPresence(currentRoomKey);
      }
    });

    function getActiveUsers(roomKey) {
      if (!presenceMap.has(roomKey)) return [];
      const userMap = presenceMap.get(roomKey);
      const uniqueUsers = new Map();

      userMap.forEach((data) => {
        // Deduplicate multiple tabs by same user
        uniqueUsers.set(data.user.id, {
          ...data.user,
          activeCardId: data.activeCardId,
        });
      });

      return Array.from(uniqueUsers.values());
    }

    function broadcastPresence(roomKey) {
      const activeUsers = getActiveUsers(roomKey);
      io.to(roomKey).emit('presence:update', {
        room: roomKey,
        users: activeUsers,
      });
    }

    function cleanupPresence(roomKey, socketId) {
      if (presenceMap.has(roomKey)) {
        presenceMap.get(roomKey).delete(socketId);
        if (presenceMap.get(roomKey).size === 0) {
          presenceMap.delete(roomKey);
        }
      }
    }
  });

  return io;
}

module.exports = setupSocketServer;
