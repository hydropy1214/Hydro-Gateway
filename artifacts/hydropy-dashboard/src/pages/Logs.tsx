import { useGetApiLogs, useGetWebSocketLogs } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Terminal, Server, Globe } from "lucide-react";
import { format } from "date-fns";

export default function Logs() {
  const { data: apiLogs, isLoading: apiLoading } = useGetApiLogs({ limit: 100 });
  const { data: wsLogs, isLoading: wsLoading } = useGetWebSocketLogs({ limit: 100 });

  const renderLogTable = (logs: any[], isLoading: boolean) => {
    if (isLoading) return <div className="p-12 text-center animate-pulse font-mono text-muted-foreground">Streaming logs...</div>;
    
    return (
      <div className="overflow-x-auto bg-[#0a0a0a]">
        <table className="w-full text-xs font-mono">
          <tbody className="divide-y divide-white/5">
            {logs?.map((log) => {
              const levelColor = 
                log.level === 'error' ? 'text-red-400' : 
                log.level === 'warn' ? 'text-yellow-400' : 
                log.level === 'info' ? 'text-cyan-400' : 'text-gray-500';
              
              return (
                <tr key={log.id} className="hover:bg-white/5">
                  <td className="px-4 py-2 w-[140px] text-gray-500 whitespace-nowrap">
                    {format(new Date(log.createdAt), 'MMM d, HH:mm:ss')}
                  </td>
                  <td className={`px-4 py-2 w-20 font-bold uppercase ${levelColor}`}>
                    {log.level}
                  </td>
                  <td className="px-4 py-2 w-32 text-gray-400">
                    [{log.category}]
                  </td>
                  <td className="px-4 py-2 text-gray-300 break-all">
                    {log.message}
                    {log.data && <span className="ml-2 text-gray-600 italic">{log.data}</span>}
                  </td>
                </tr>
              );
            })}
            {!logs?.length && (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-gray-600 italic">Log buffer empty.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6 h-[calc(100vh-2rem)] flex flex-col">
      <div className="shrink-0 flex items-center gap-3">
        <Terminal className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-mono font-bold tracking-tight">SYSTEM <span className="text-primary">LOGS</span></h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">Raw diagnostics output</p>
        </div>
      </div>

      <Card className="flex-1 bg-black border-border overflow-hidden flex flex-col shadow-2xl">
        <Tabs defaultValue="api" className="w-full h-full flex flex-col">
          <TabsList className="bg-card border-b border-border shrink-0 rounded-none w-full justify-start px-2 py-0 h-12">
            <TabsTrigger value="api" className="font-mono data-[state=active]:bg-black data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              <Server className="w-4 h-4 mr-2" /> REST API Router
            </TabsTrigger>
            <TabsTrigger value="ws" className="font-mono data-[state=active]:bg-black data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">
              <Globe className="w-4 h-4 mr-2" /> WebSocket Gateway
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="api" className="flex-1 overflow-auto mt-0 m-0 border-0">
            {renderLogTable(apiLogs || [], apiLoading)}
          </TabsContent>
          
          <TabsContent value="ws" className="flex-1 overflow-auto mt-0 m-0 border-0">
            {renderLogTable(wsLogs || [], wsLoading)}
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
