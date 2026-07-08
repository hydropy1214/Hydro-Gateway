import { useParams } from "wouter";
import { useGetDevice, useGetDeviceLogs, useSendTestSms } from "@workspace/api-client-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Terminal, Smartphone, Activity, Send, History, ChevronLeft } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function DeviceDetail() {
  const { id } = useParams();
  const deviceId = parseInt(id || "0", 10);
  const { data: device, isLoading } = useGetDevice(deviceId, { query: { enabled: !!deviceId } });
  const { data: logs } = useGetDeviceLogs(deviceId, { query: { enabled: !!deviceId } });
  const sendTest = useSendTestSms();
  const { toast } = useToast();

  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("HYDROPY Test Message");

  const handleTestSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone) return;
    try {
      await sendTest.mutateAsync({ 
        id: deviceId, 
        data: { phoneNumber: testPhone, message: testMessage } 
      });
      toast({ title: "Test SMS Queued", description: "Message dispatched to device." });
      setTestPhone("");
    } catch (err) {
      toast({ title: "Failed to send", variant: "destructive" });
    }
  };

  if (isLoading || !device) return <div className="p-8 animate-pulse h-full w-full bg-muted/20 rounded"></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/devices" className="p-2 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-mono font-bold tracking-tight uppercase">{device.name}</h1>
            <StatusBadge status={device.status} />
          </div>
          <p className="text-muted-foreground font-mono text-sm mt-1">ID: {device.deviceId}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6 lg:col-span-1">
          <Card className="bg-card border-card-border">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-mono flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-primary" />
                Hardware Specs
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 font-mono text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Model</span>
                <span className="text-foreground">{device.phoneModel || 'Unknown'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">OS Version</span>
                <span className="text-foreground">Android {device.androidVersion || 'Unknown'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">SIM Info</span>
                <span className="text-foreground">{device.simInfo || 'Unknown carrier'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">IP Address</span>
                <span className="text-foreground">{device.ipAddress || '-'}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-card-border">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-mono flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Telemetry
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 font-mono text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Battery</span>
                <span className={device.battery && device.battery < 20 ? 'text-red-500' : 'text-green-500'}>
                  {device.battery}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Signal</span>
                <span className="text-foreground">{device.signalStrength} dBm</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Sent</span>
                <span className="text-foreground">{device.smsCount?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Registered</span>
                <span className="text-foreground">{format(new Date(device.createdAt), 'MMM d, yyyy')}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-card-border">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-mono flex items-center gap-2">
                <Send className="w-4 h-4 text-primary" />
                Diagnostic Send
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleTestSms} className="space-y-3">
                <Input 
                  placeholder="Target Phone Number" 
                  value={testPhone}
                  onChange={e => setTestPhone(e.target.value)}
                  className="font-mono text-xs bg-muted/50"
                />
                <Input 
                  placeholder="Message content" 
                  value={testMessage}
                  onChange={e => setTestMessage(e.target.value)}
                  className="font-mono text-xs bg-muted/50"
                />
                <Button 
                  type="submit" 
                  className="w-full font-mono text-xs" 
                  disabled={sendTest.isPending || device.status !== 'online'}
                >
                  Dispatch Test SMS
                </Button>
                {device.status !== 'online' && (
                  <p className="text-[10px] text-red-500 font-mono mt-1 text-center">Node offline.</p>
                )}
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="bg-black border-border h-full min-h-[500px] flex flex-col relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <Terminal className="w-32 h-32" />
            </div>
            <CardHeader className="pb-2 border-b border-border/50 bg-card/50">
              <CardTitle className="text-sm font-mono flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-primary" />
                  Terminal Logs
                </div>
                <div className="flex items-center gap-2 text-xs font-normal">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse glow-success"></span>
                  Listening
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-auto bg-[#0a0a0a]">
              <div className="p-4 font-mono text-xs space-y-1">
                {logs?.length === 0 ? (
                  <div className="text-muted-foreground opacity-50 italic">Waiting for log stream...</div>
                ) : (
                  logs?.map((log) => {
                    const levelColors = {
                      info: 'text-cyan-400',
                      warn: 'text-yellow-400',
                      error: 'text-red-400',
                      debug: 'text-gray-500',
                    };
                    return (
                      <div key={log.id} className="hover:bg-white/5 py-0.5 px-2 -mx-2 rounded transition-colors break-all">
                        <span className="text-gray-500 mr-2">{format(new Date(log.createdAt), 'HH:mm:ss.SSS')}</span>
                        <span className={`uppercase font-bold w-12 inline-block ${levelColors[log.level as keyof typeof levelColors] || 'text-white'}`}>
                          [{log.level}]
                        </span>
                        <span className="text-gray-300 ml-2">{log.message}</span>
                        {log.data && (
                          <span className="text-gray-500 ml-2 italic">{log.data}</span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
