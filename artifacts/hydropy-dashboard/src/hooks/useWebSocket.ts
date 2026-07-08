import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetActivityQueryKey, getListDevicesQueryKey, getGetDashboardStatsQueryKey } from '@workspace/api-client-react';

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    let ws: WebSocket;
    let reconnectTimer: number;

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setIsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type) {
              queryClient.invalidateQueries({ queryKey: getGetActivityQueryKey() });
              queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
              
              if (data.type.startsWith('device_')) {
                queryClient.invalidateQueries({ queryKey: getListDevicesQueryKey() });
              }
            }
          } catch (e) {
            console.error("Failed to parse WS message", e);
          }
        };

        ws.onclose = () => {
          setIsConnected(false);
          reconnectTimer = window.setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch (err) {
        console.error("WS connection error:", err);
      }
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (ws) {
        ws.close();
      }
    };
  }, [queryClient]);

  return { isConnected };
}
