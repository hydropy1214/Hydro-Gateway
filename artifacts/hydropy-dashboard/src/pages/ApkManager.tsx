import { useListApkVersions, useGetLatestApk } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Cpu, Package, HardDrive, CheckCircle, Smartphone, Wifi, Shield } from "lucide-react";
import { format } from "date-fns";

export default function ApkManager() {
  const { data: apks, isLoading } = useListApkVersions();
  const { data: latest } = useGetLatestApk();

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-mono font-bold tracking-tight">CLIENT <span className="text-primary">DISTRIBUTION</span></h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">Android gateway app — install on phones to route SMS</p>
        </div>
      </div>

      {/* Main download card */}
      <Card className="bg-gradient-to-br from-card to-card/50 border-primary/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Cpu className="w-48 h-48 text-primary" />
        </div>
        <CardHeader>
          <CardTitle className="font-mono text-primary flex items-center gap-2">
            <Package className="w-5 h-5" /> HYDROPY Gateway APK
          </CardTitle>
          <CardDescription className="font-mono">
            Install this on any Android phone to use it as an SMS gateway node.
          </CardDescription>
        </CardHeader>
        <CardContent className="relative z-10">
          {latest ? (
            <div className="space-y-6">
              <div className="flex items-end gap-6">
                <div>
                  <div className="text-6xl font-mono font-bold text-foreground">v{latest.version}</div>
                  <div className="flex items-center gap-4 mt-2 text-sm font-mono text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <HardDrive className="w-4 h-4" />
                      {latest.size ? formatBytes(latest.size) : 'Ready to download'}
                    </span>
                    <span className="flex items-center gap-1.5 text-green-400">
                      <CheckCircle className="w-4 h-4" />
                      Stable
                    </span>
                  </div>
                </div>
              </div>

              {latest.changelog && (
                <div className="p-4 bg-black/50 border border-border rounded font-mono text-sm text-muted-foreground whitespace-pre-line">
                  <strong className="text-foreground block mb-2">What's included:</strong>
                  {latest.changelog}
                </div>
              )}

              <Button asChild size="lg" className="font-mono bg-primary text-primary-foreground hover:bg-primary/90 glow-primary">
                <a href="/api/apk/latest/download" download="HYDROPY-Gateway.apk">
                  <Download className="w-5 h-5 mr-2" />
                  Download APK
                </a>
              </Button>
            </div>
          ) : (
            <div className="py-8 text-muted-foreground font-mono">
              APK is being built. Check back shortly.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Install steps */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            icon: Download,
            step: "1",
            title: "Download & Install",
            desc: "Download the APK above. On your Android phone, open the file and tap Install. Enable 'Unknown sources' if prompted in Settings."
          },
          {
            icon: Smartphone,
            step: "2",
            title: "Pair the Device",
            desc: "Open the app, enter this server's URL and the pair code from the Devices page. Tap Connect Device and grant permissions."
          },
          {
            icon: Wifi,
            step: "3",
            title: "Go Online",
            desc: "The device appears as Online in your fleet. It will auto-reconnect after restarts and keep the gateway running in the background."
          }
        ].map(({ icon: Icon, step, title, desc }) => (
          <Card key={step} className="bg-card border-border/50">
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center font-mono text-primary font-bold text-sm">
                  {step}
                </div>
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div className="font-mono font-bold text-sm text-foreground">{title}</div>
              <p className="font-mono text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Permissions */}
      <Card className="bg-card border-border/50">
        <CardHeader>
          <CardTitle className="font-mono text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            Permissions Required
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
            {[
              { name: "SEND_SMS", why: "Core function — send text messages via SIM" },
              { name: "READ_PHONE_STATE", why: "Read SIM carrier info for device telemetry" },
              { name: "FOREGROUND_SERVICE", why: "Keep gateway running while app is in background" },
              { name: "RECEIVE_BOOT_COMPLETED", why: "Auto-start after phone reboots" },
              { name: "INTERNET", why: "Connect to your HYDROPY server" },
              { name: "POST_NOTIFICATIONS", why: "Show persistent 'Gateway Running' status (Android 13+)" },
            ].map(({ name, why }) => (
              <div key={name} className="flex gap-3 p-3 bg-black/30 rounded border border-border/30">
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-foreground font-bold">{name}</div>
                  <div className="text-muted-foreground mt-0.5">{why}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Version history */}
      {apks && apks.length > 0 && (
        <Card className="bg-card border-border/50">
          <CardHeader>
            <CardTitle className="font-mono text-sm">Version History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm font-mono">
              <thead>
                <tr className="border-b border-border bg-muted/20 text-muted-foreground uppercase text-xs tracking-wider">
                  <th className="px-6 py-3 text-left font-medium">Version</th>
                  <th className="px-6 py-3 text-left font-medium">Size</th>
                  <th className="px-6 py-3 text-left font-medium">Released</th>
                  <th className="px-6 py-3 text-left font-medium">Status</th>
                  <th className="px-6 py-3 text-left font-medium">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {apks.map((apk) => (
                  <tr key={apk.id} className="hover:bg-muted/10">
                    <td className="px-6 py-4 font-bold text-foreground">v{apk.version}</td>
                    <td className="px-6 py-4 text-muted-foreground">{apk.size ? formatBytes(apk.size) : '—'}</td>
                    <td className="px-6 py-4 text-muted-foreground">{format(new Date(apk.createdAt), 'MMM d, yyyy')}</td>
                    <td className="px-6 py-4">
                      {apk.isLatest ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-primary/20 text-primary border border-primary/30">
                          ACTIVE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-muted text-muted-foreground">
                          ARCHIVED
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <a
                        href={`/api/apk/${apk.id}/download`}
                        download
                        className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
                      >
                        <Download className="w-3 h-3" /> .apk
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
