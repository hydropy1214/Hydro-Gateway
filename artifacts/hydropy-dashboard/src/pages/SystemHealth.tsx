import { useGetSystemHealth } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, Server, Globe, Cpu, Activity, Clock } from "lucide-react";

export default function SystemHealth() {
  const { data: health, isLoading } = useGetSystemHealth({ query: { refetchInterval: 10000 } });

  if (isLoading || !health) return <div className="p-8 animate-pulse bg-muted/20 h-64 rounded-lg"></div>;

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600*24));
    const h = Math.floor(seconds % (3600*24) / 3600);
    const m = Math.floor(seconds % 3600 / 60);
    return `${d}d ${h}h ${m}m`;
  };

  const StatusIndicator = ({ status }: { status: string }) => {
    const isHealthy = status === 'healthy';
    return (
      <div className={`flex items-center gap-2 px-3 py-1 rounded text-xs font-mono uppercase font-bold border ${isHealthy ? 'bg-green-500/10 text-green-500 border-green-500/20 glow-success' : 'bg-red-500/10 text-red-500 border-red-500/20 glow-danger'}`}>
        <span className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
        {status}
      </div>
    );
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col items-center text-center py-8">
        <Activity className="w-16 h-16 text-primary glow-primary mb-4" />
        <h1 className="text-4xl font-mono font-bold tracking-widest text-primary">SYSTEM.DIAGNOSTICS</h1>
        <p className="text-muted-foreground font-mono text-sm mt-2">Core infrastructure status</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-card-border overflow-hidden">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full">
            <Database className="w-8 h-8 text-muted-foreground mb-4" />
            <h3 className="font-mono font-bold mb-4">PostgreSQL DB</h3>
            <StatusIndicator status={health.database} />
          </CardContent>
        </Card>

        <Card className="bg-card border-card-border overflow-hidden">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full">
            <Server className="w-8 h-8 text-muted-foreground mb-4" />
            <h3 className="font-mono font-bold mb-4">API Core</h3>
            <StatusIndicator status={health.backend} />
          </CardContent>
        </Card>

        <Card className="bg-card border-card-border overflow-hidden">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full">
            <Globe className="w-8 h-8 text-muted-foreground mb-4" />
            <h3 className="font-mono font-bold mb-4">WS Gateway</h3>
            <StatusIndicator status={health.websocket} />
          </CardContent>
        </Card>

        <Card className="bg-card border-card-border overflow-hidden">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full">
            <Cpu className="w-8 h-8 text-muted-foreground mb-4" />
            <h3 className="font-mono font-bold mb-4">Queue Worker</h3>
            <StatusIndicator status={health.queueWorker} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-black border-border shadow-2xl">
          <CardHeader>
            <CardTitle className="font-mono text-sm flex items-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4" /> Instance Uptime
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-mono font-bold text-primary">{formatUptime(health.uptime)}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-black border-border shadow-2xl">
          <CardHeader>
            <CardTitle className="font-mono text-sm flex items-center gap-2 text-muted-foreground">
              <Globe className="w-4 h-4" /> Live Sockets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-mono font-bold text-cyan-400">{health.connectedDevices}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
