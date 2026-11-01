import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

export function useBoardSocket({
  currentUser,
  activeTenant,
  activeBoard,
  onTaskCreated,
  onTaskUpdated,
  onTaskMoved,
  onTaskDeleted,
  onColumnCreated,
  onActivityLogged,
  onBoardSync,
}) {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeUsers, setActiveUsers] = useState([]);

  const activeTenantRef = useRef(activeTenant);
  const activeBoardRef = useRef(activeBoard);

  activeTenantRef.current = activeTenant;
  activeBoardRef.current = activeBoard;

  // Initialize Socket connection
  useEffect(() => {
    if (!currentUser) return;

    const token = localStorage.getItem('nexus_token');
    const newSocket = io('http://localhost:4000', {
      auth: {
        token,
        userId: currentUser.id,
      },
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('⚡ WebSocket connected to server');
      setIsConnected(true);

      // Re-join active room on reconnect
      if (activeTenantRef.current && activeBoardRef.current) {
        newSocket.emit('board:join', {
          tenantId: activeTenantRef.current.id,
          boardId: activeBoardRef.current.id,
        });
        if (onBoardSync) {
          onBoardSync(activeBoardRef.current.id);
        }
      }
    });

    newSocket.on('disconnect', (reason) => {
      console.log('🔌 WebSocket disconnected:', reason);
      setIsConnected(false);
    });

    newSocket.on('presence:update', ({ users }) => {
      setActiveUsers(users || []);
    });

    // Real-time Kanban board updates
    newSocket.on('task:created', (data) => onTaskCreated && onTaskCreated(data));
    newSocket.on('task:updated', (data) => onTaskUpdated && onTaskUpdated(data));
    newSocket.on('task:moved', (data) => onTaskMoved && onTaskMoved(data));
    newSocket.on('task:deleted', (data) => onTaskDeleted && onTaskDeleted(data));
    newSocket.on('column:created', (data) => onColumnCreated && onColumnCreated(data));
    newSocket.on('activity:logged', (data) => onActivityLogged && onActivityLogged(data));

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [currentUser?.id]);

  // Join/leave board room when tenant or board changes
  useEffect(() => {
    if (!socket || !isConnected) return;

    if (activeTenant?.id && activeBoard?.id) {
      socket.emit('board:join', {
        tenantId: activeTenant.id,
        boardId: activeBoard.id,
      });
    }

    return () => {
      if (socket) {
        socket.emit('board:leave');
      }
    };
  }, [socket, isConnected, activeTenant?.id, activeBoard?.id]);

  const focusCard = useCallback(
    (cardId) => {
      if (socket && isConnected) {
        socket.emit('presence:focus-card', { cardId });
      }
    },
    [socket, isConnected]
  );

  return {
    socket,
    isConnected,
    activeUsers,
    focusCard,
  };
}
