import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export function SocketProvider({ children, currentUser, activeTenant, activeBoard, onBoardSync }) {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [activeUsers, setActiveUsers] = useState([]);
  const activeBoardRef = useRef(activeBoard);
  const activeTenantRef = useRef(activeTenant);

  activeBoardRef.current = activeBoard;
  activeTenantRef.current = activeTenant;

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
      console.log('⚡ Socket connected to server');
      setIsConnected(true);

      // Auto-reconnect / re-join current board room
      if (activeTenantRef.current && activeBoardRef.current) {
        newSocket.emit('board:join', {
          tenantId: activeTenantRef.current.id,
          boardId: activeBoardRef.current.id,
        });
        if (onBoardSync) {
          onBoardSync();
        }
      }
    });

    newSocket.on('disconnect', (reason) => {
      console.log('🔌 Socket disconnected:', reason);
      setIsConnected(false);
    });

    newSocket.on('presence:update', ({ users }) => {
      setActiveUsers(users || []);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [currentUser?.id]);

  // Join/leave board room whenever activeBoard or activeTenant changes
  useEffect(() => {
    if (!socket || !isConnected) return;

    if (activeTenant && activeBoard) {
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

  const focusCard = (cardId) => {
    if (socket && isConnected) {
      socket.emit('presence:focus-card', { cardId });
    }
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        activeUsers,
        focusCard,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
