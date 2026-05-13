import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

let socketInstance = null;

export function useSocket(onQueueStatusChanged, onNewTicket) {
  const callbackRef = useRef({ onQueueStatusChanged, onNewTicket });

  useEffect(() => {
    callbackRef.current = { onQueueStatusChanged, onNewTicket };
  });

  useEffect(() => {
    const serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';
    if (!socketInstance) {
      socketInstance = io(serverUrl, { transports: ['websocket', 'polling'] });
    }

    const socket = socketInstance;

    const handleStatusChange = (data) => callbackRef.current.onQueueStatusChanged?.(data);
    const handleNewTicket = (data) => callbackRef.current.onNewTicket?.(data);

    socket.on('queue:status_changed', handleStatusChange);
    socket.on('queue:new_ticket', handleNewTicket);

    return () => {
      socket.off('queue:status_changed', handleStatusChange);
      socket.off('queue:new_ticket', handleNewTicket);
    };
  }, []);
}
