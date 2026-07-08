import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetActivityQueryKey, getListDevicesQueryKey, getGetDashboardStatsQueryKey } from '@workspace/api-client-react';

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws`;

    let ws: WebSocket;
    let reconnectTimer: number;
    let apiKey = '';

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setIsConnected(true);
          // Include the dashboard API key so the server can verify this is a legitimate
          // dashboard session before adding it to the broadcast set.
          ws.send(JSON.stringify({ type: 'SUBSCRIBE', apiKey }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (!data.type) return;

            // Refresh activity feed and stats on any event
            queryClient.invalidateQueries({ queryKey: getGetActivityQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });

            // Refresh device list on device state changes
            if (
              data.type === 'device_connected' ||
              data.type === 'device_disconnected' ||
              data.type === 'device_updated' ||
              data.type === 'device_telemetry' ||
              data.type.startsWith('device_')
            ) {
              queryClient.invalidateQueries({ queryKey: getListDevicesQueryKey() });
            }
          } catch (e) {
            console.error('Failed to parse WS message', e);
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
        console.error('WS connection error:', err);
      }
    };

    // Fetch the API key first, then open the WebSocket.
    // /api/config is a public endpoint that returns the derived key.
    fetch('/api/config')
      .then(r => r.json())
      .then((data: { apiKey?: string }) => {
        apiKey = data.apiKey ?? '';
      })
      .catch(() => { /* proceed without key — server will reject SUBSCRIBE */ })
      .finally(() => { connect(); });

    return () => {
      clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [queryClient]);

  return { isConnected };
}
