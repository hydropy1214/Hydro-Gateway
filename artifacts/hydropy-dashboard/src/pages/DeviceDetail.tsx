import { useParams } from "wouter";
import { useGetDevice, useGetDeviceLogs, useSendTestSms } from "@workspace/api-client-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Terminal, Smartphone, Activity, Send, ChevronLeft, Phone, Signal } from "lucide-react";
import { Link } from "wouter";
import { format, formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

function SignalBars({ dbm }: { dbm?: number | null }) {
  if (!dbm || dbm === -1) return <span className="text-muted-foreground">—</span>;

  // dBm ranges: excellent > -70, good -70..-85, fair -85..-100, poor < -100
  const quality = dbm >= -70 ? "excellent" : dbm >= -85 ? "good" : dbm >= -100 ? "fair" : "poor";
  const bars = quality === "excellent" ? 4 : quality === "good" ? 3 : quality === "fair" ? 2 : 1;
  const color = quality === "excellent" || quality === "good" ? "text-green-500" : quality === "fair" ? "text-yellow-500" : "text-red-500";

  return (
    <span className={`flex items-end gap-0.5 ${color}`} title={`${dbm} dBm (${quality})`}>
      {[1, 2, 3, 4].map(b => (
        <span
          key={b}
          className={`inline-block w-1.5 rounded-sm bg-current ${b <= bars ? 'opacity-100' : 'opacity-20'}`}
          style={{ height: `${b * 4}px` }}
        />
      ))}
      <span className="ml-1.5 font-mono text-xs">{dbm} dBm</span>
    </span>
  );
}

function BatteryIndicator({ pct }: { pct?: number | null }) {
  if (pct == null) return <span className="text-muted-foreground">—</span>;
  const color = pct >= 50 ? "text-green-500" : pct >= 20 ? "text-yellow-500" : "text-red-500";
  return <span className={`font-mono ${color}`}>{pct}%</span>;
}

export default function DeviceDetail() {
  const { id } = useParams();
  const deviceId = parseInt(id || "0", 10);
  const { data: device, isLoading } = useGetDevice(deviceId, { query: { enabled: !!deviceId, refetchInterval: 10000 } });
  const { data: logs } = useGetDeviceLogs(deviceId, { query: { enabled: !!deviceId, refetchInterval: 5000 } });
  const sendTest = useSendTestSms();
  const { toast } = useToast();

  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("HYDROPY Test Message");

  const handleTestSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone) return;
    try {
      await sendTest.mutateAsync({ id: deviceId, data: { phoneNumber: testPhone, message: testMessage } });
      toast({ title: "Test SMS dispatched", description: "Message sent to device WebSocket." });
      setTestPhone("");
    } catch {
      toast({ title: "Dispatch failed", variant: "destructive" });
    }
  };

  if (isLoading || !device) return <div className="p-8 animate-pulse h-full w-full bg-muted/20 rounded"></div>;

  const lastSeen = device.lastHeartbeat
    ? formatDistanceToNow(new Date(device.lastHeartbeat), { addSuffix: true })
    : "never";

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
          <p className="text-muted-foreground font-mono text-sm mt-1">
            Last seen {lastSeen}
            {device.ipAddress && ` · ${device.ipAddress}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="space-y-5 lg:col-span-1">

          {/* Hardware Specs */}
          <Card className="bg-card border-card-border">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-mono flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-primary" /> Hardware Specs
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3 font-mono text-sm">
              <Row label="Model" value={device.phoneModel ?? "Unknown"} />
              <Row label="Android" value={device.androidVersion ? `Android ${device.androidVersion}` : "Unknown"} />
              <Row label="Carrier / SIM" value={device.simInfo ?? "Unknown"} />
              <Row
                label="Phone Number"
                value={
                  (device as any).phoneNumber
                    ? <span className="flex items-center gap-1.5 text-primary"><Phone className="w-3 h-3" />{(device as any).phoneNumber}</span>
                    : <span className="text-muted-foreground/60 italic text-xs">Not available</span>
                }
              />
              <Row label="Device ID" value={<span className="text-xs text-muted-foreground truncate max-w-[140px] inline-block" title={device.deviceId}>{device.deviceId}</span>} />
            </CardContent>
          </Card>

          {/* Telemetry */}
          <Card className="bg-card border-card-border">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-mono flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" /> Live Telemetry
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 font-mono text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Battery</span>
                <BatteryIndicator pct={device.battery} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground flex items-center gap-1.5"><Signal className="w-3 h-3" /> Signal</span>
                <SignalBars dbm={device.signalStrength} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">SMS Sent (total)</span>
                <span className="text-foreground font-bold">{(device.smsCount ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Registered</span>
                <span className="text-foreground">{format(new Date(device.createdAt), "MMM d, yyyy")}</span>
              </div>
            </CardContent>
          </Card>

          {/* Test SMS */}
          <Card className="bg-card border-card-border">
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm font-mono flex items-center gap-2">
                <Send className="w-4 h-4 text-primary" /> Diagnostic Send
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <form onSubmit={handleTestSms} className="space-y-3">
                <Input
                  placeholder="Destination phone number"
                  value={testPhone}
                  onChange={e => setTestPhone(e.target.value)}
                  className="font-mono text-xs bg-muted/50"
                />
                <Input
                  placeholder="Message"
                  value={testMessage}
                  onChange={e => setTestMessage(e.target.value)}
                  className="font-mono text-xs bg-muted/50"
                />
                <Button
                  type="submit"
                  className="w-full font-mono text-xs"
                  disabled={sendTest.isPending || device.status !== "online"}
                >
                  {sendTest.isPending ? "Dispatching…" : "Dispatch Test SMS"}
                </Button>
                {device.status !== "online" && (
                  <p className="text-[10px] text-red-500 font-mono text-center">Device is offline.</p>
                )}
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right column — terminal */}
        <div className="lg:col-span-2">
          <Card className="bg-black border-border h-full min-h-[500px] flex flex-col">
            <CardHeader className="pb-2 border-b border-border/50 bg-card/50">
              <CardTitle className="text-sm font-mono flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-primary" /> Terminal Logs
                </div>
                <div className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
                  <span className={`w-2 h-2 rounded-full ${device.status === "online" ? "bg-green-500 animate-pulse" : "bg-muted-foreground"}`}></span>
                  {device.status === "online" ? "Live" : "Offline"}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-auto bg-[#0a0a0a]">
              <div className="p-4 font-mono text-xs space-y-1">
                {!logs?.length ? (
                  <div className="text-muted-foreground/50 italic">No logs yet…</div>
                ) : (
                  [...(logs ?? [])].reverse().map((log) => {
                    const colors: Record<string, string> = {
                      info: "text-cyan-400", warn: "text-yellow-400",
                      error: "text-red-400", debug: "text-gray-500",
                    };
                    return (
                      <div key={log.id} className="hover:bg-white/5 py-0.5 px-2 -mx-2 rounded break-all">
                        <span className="text-gray-500 mr-2">{format(new Date(log.createdAt), "HH:mm:ss.SSS")}</span>
                        <span className={`uppercase font-bold w-14 inline-block ${colors[log.level] ?? "text-white"}`}>[{log.level}]</span>
                        <span className="text-gray-300 ml-1">{log.message}</span>
                        {log.data && <span className="text-gray-600 ml-2 italic">{log.data}</span>}
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

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center gap-3">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-foreground text-right">{value}</span>
    </div>
  );
}
