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

  const callbacksRef = useRef({
    onTaskCreated,
    onTaskUpdated,
    onTaskMoved,
    onTaskDeleted,
    onColumnCreated,
    onActivityLogged,
    onBoardSync,
  });

  callbacksRef.current = {
    onTaskCreated,
    onTaskUpdated,
    onTaskMoved,
    onTaskDeleted,
    onColumnCreated,
    onActivityLogged,
    onBoardSync,
  };

  // Initialize Socket connection
  useEffect(() => {
    if (!currentUser) return;

    const token = localStorage.getItem('nexus_token');
    const socketUrl =
      import.meta.env.VITE_BACKEND_URL ||
      (window.location.port === '5173' || window.location.port === '5174'
        ? 'http://localhost:4000'
        : '/');

    const newSocket = io(socketUrl, {
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
        callbacksRef.current.onBoardSync?.(activeBoardRef.current.id);
      }
    });

    newSocket.on('disconnect', (reason) => {
      console.log('🔌 WebSocket disconnected:', reason);
      setIsConnected(false);
    });

    newSocket.on('presence:update', ({ users }) => {
      setActiveUsers(users || []);
    });

    // Real-time Kanban board updates with latest callback refs
    newSocket.on('task:created', (data) => callbacksRef.current.onTaskCreated?.(data));
    newSocket.on('task:updated', (data) => callbacksRef.current.onTaskUpdated?.(data));
    newSocket.on('task:moved', (data) => callbacksRef.current.onTaskMoved?.(data));
    newSocket.on('task:deleted', (data) => callbacksRef.current.onTaskDeleted?.(data));
    newSocket.on('column:created', (data) => callbacksRef.current.onColumnCreated?.(data));
    newSocket.on('activity:logged', (data) => callbacksRef.current.onActivityLogged?.(data));

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
