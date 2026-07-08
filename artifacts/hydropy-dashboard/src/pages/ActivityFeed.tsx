import { useGetActivity } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, Zap, CheckCircle, AlertTriangle, Smartphone, Pause, Play, Send } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";

export default function ActivityFeed() {
  const { data: activities, isLoading } = useGetActivity({ limit: 100 }, { query: { refetchInterval: 3000 } });

  const getIcon = (type: string) => {
    if (type.includes('connected')) return <Zap className="w-5 h-5 text-cyan-500" />;
    if (type.includes('disconnected') || type.includes('error') || type.includes('failed')) return <AlertTriangle className="w-5 h-5 text-red-500" />;
    if (type.includes('completed') || type.includes('success')) return <CheckCircle className="w-5 h-5 text-green-500" />;
    if (type.includes('paused')) return <Pause className="w-5 h-5 text-yellow-500" />;
    if (type.includes('started') || type.includes('resumed')) return <Play className="w-5 h-5 text-primary" />;
    if (type.includes('sms')) return <Send className="w-5 h-5 text-primary" />;
    return <Activity className="w-5 h-5 text-muted-foreground" />;
  };

  const getBorderColor = (type: string) => {
    if (type.includes('connected')) return 'border-l-cyan-500';
    if (type.includes('error') || type.includes('failed') || type.includes('disconnected')) return 'border-l-red-500';
    if (type.includes('success') || type.includes('completed')) return 'border-l-green-500';
    if (type.includes('paused')) return 'border-l-yellow-500';
    return 'border-l-primary';
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <Activity className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-mono font-bold tracking-tight">EVENT <span className="text-primary">STREAM</span></h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">Live operational telemetry</p>
        </div>
      </div>

      <Card className="bg-card border-card-border">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center animate-pulse text-primary font-mono">Initializing stream...</div>
          ) : (
            <div className="divide-y divide-border/30">
              {activities?.map((event) => (
                <div key={event.id} className={`p-4 hover:bg-muted/10 transition-colors flex gap-4 border-l-2 ${getBorderColor(event.type)}`}>
                  <div className="mt-1 bg-black p-2 rounded-full border border-border shrink-0">
                    {getIcon(event.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-sm font-mono text-foreground font-medium">{event.message}</p>
                      <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap ml-4">
                        {format(new Date(event.createdAt), 'HH:mm:ss.SSS')}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap gap-3 mt-2 text-xs font-mono">
                      <span className="uppercase text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                        {event.type.replace(/_/g, ' ')}
                      </span>
                      
                      {event.deviceName && (
                        <Link href={`/devices/${event.deviceId}`} className="flex items-center gap-1 text-cyan-500 hover:underline bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                          <Smartphone className="w-3 h-3" />
                          {event.deviceName}
                        </Link>
                      )}
                      
                      {event.campaignName && (
                        <Link href={`/campaigns/${event.campaignId}`} className="flex items-center gap-1 text-primary hover:underline bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                          <Activity className="w-3 h-3" />
                          {event.campaignName}
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {!activities?.length && (
                <div className="p-12 text-center text-muted-foreground font-mono text-sm">
                  System quiet. No events recorded.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
