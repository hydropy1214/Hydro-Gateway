import { useListDevices, useDeleteDevice, useRestartDevice, useDisableDevice, useGeneratePairCode } from "@workspace/api-client-react";
import { Battery, Signal, Smartphone, MoreVertical, Trash2, PowerOff, RefreshCw, Eye, Plus, Terminal } from "lucide-react";
import { Link } from "wouter";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDistanceToNow } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Devices() {
  const { data: devices, isLoading } = useListDevices();
  const deleteDevice = useDeleteDevice();
  const restartDevice = useRestartDevice();
  const disableDevice = useDisableDevice();
  const generatePairCode = useGeneratePairCode();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const [isPairingOpen, setIsPairingOpen] = useState(false);

  const handlePairing = async () => {
    try {
      const code = await generatePairCode.mutateAsync({});
      toast({
        title: "Pairing Code Generated",
        description: `Code: ${code.pairCode} (expires in 10 mins)`,
      });
    } catch (err) {
      toast({
        title: "Failed to generate code",
        variant: "destructive",
      });
    }
  };

  if (isLoading) return <div className="p-8 animate-pulse space-y-4">
    <div className="h-10 w-48 bg-muted rounded"></div>
    <div className="h-[400px] w-full bg-muted rounded"></div>
  </div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-mono font-bold tracking-tight">DEVICE <span className="text-primary">FLEET</span></h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">Manage physical SMS routing nodes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="font-mono text-xs border-primary/30 text-primary hover:bg-primary/10" asChild>
            <a href="/api/apk/latest/download" download>Download APK</a>
          </Button>
          <Dialog open={isPairingOpen} onOpenChange={setIsPairingOpen}>
            <DialogTrigger asChild>
              <Button className="font-mono text-xs bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" />
                Pair New Device
              </Button>
            </DialogTrigger>
            <DialogContent className="border-border bg-card">
              <DialogHeader>
                <DialogTitle className="font-mono text-primary">Pair New Device</DialogTitle>
                <DialogDescription className="font-mono text-muted-foreground">
                  Generate a pairing code to register a new Android device running the HYDROPY client.
                </DialogDescription>
              </DialogHeader>
              <div className="py-6 flex flex-col items-center justify-center space-y-4">
                {generatePairCode.data ? (
                  <div className="text-center space-y-4">
                    <div className="text-5xl font-mono font-bold tracking-[0.5em] text-primary glow-primary py-4 px-8 border border-primary/30 rounded bg-primary/5">
                      {generatePairCode.data.pairCode}
                    </div>
                    <p className="text-sm font-mono text-muted-foreground">
                      Enter this code in the Android app. Expires in 10 minutes.
                    </p>
                  </div>
                ) : (
                  <Button 
                    onClick={handlePairing} 
                    disabled={generatePairCode.isPending}
                    className="font-mono"
                  >
                    Generate Code
                  </Button>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="border border-border rounded-md bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-muted-foreground uppercase tracking-wider text-xs">
                <th className="px-4 py-3 text-left font-medium">Device</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Battery</th>
                <th className="px-4 py-3 text-left font-medium">Signal</th>
                <th className="px-4 py-3 text-left font-medium">Model/OS</th>
                <th className="px-4 py-3 text-left font-medium">Last Heartbeat</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {devices?.map((device) => (
                <tr key={device.id} className="hover:bg-muted/30 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-sidebar rounded border border-border">
                        <Smartphone className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <Link href={`/devices/${device.id}`} className="font-bold hover:text-primary transition-colors">
                          {device.name}
                        </Link>
                        <div className="text-xs text-muted-foreground mt-0.5">{device.deviceId.substring(0, 8)}...</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={device.status} />
                  </td>
                  <td className="px-4 py-3">
                    {device.battery != null ? (
                      <div className="flex items-center gap-2">
                        <Battery className={`w-4 h-4 ${device.battery < 20 ? 'text-red-500' : 'text-green-500'}`} />
                        <span>{device.battery}%</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {device.signalStrength != null ? (
                      <div className="flex items-center gap-2">
                        <Signal className="w-4 h-4 text-primary" />
                        <span>{device.signalStrength} dBm</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs">
                      <div className="text-foreground">{device.phoneModel || 'Unknown'}</div>
                      <div className="text-muted-foreground">Android {device.androidVersion || '?'}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {device.lastHeartbeat ? formatDistanceToNow(new Date(device.lastHeartbeat), { addSuffix: true }) : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="font-mono text-xs">
                        <DropdownMenuLabel>Device Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href={`/devices/${device.id}`} className="cursor-pointer">
                            <Eye className="w-4 h-4 mr-2" /> View Details
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => restartDevice.mutate({ id: device.id })}>
                          <RefreshCw className="w-4 h-4 mr-2" /> Restart App
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => disableDevice.mutate({ id: device.id })}>
                          <PowerOff className="w-4 h-4 mr-2" /> Disable Node
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-red-500 focus:text-red-500"
                          onClick={() => {
                            if (confirm(`Remove device ${device.name}?`)) {
                              deleteDevice.mutate({ id: device.id }, {
                                onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/devices"] })
                              });
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Remove Device
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {!devices?.length && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No devices registered. Generate a pair code to connect your first node.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
