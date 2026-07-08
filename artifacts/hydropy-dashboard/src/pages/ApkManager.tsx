import { useListApkVersions, useGetLatestApk } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Cpu, Package, Upload, HardDrive, CheckCircle } from "lucide-react";
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
          <p className="text-muted-foreground font-mono text-sm mt-1">Manage Android worker nodes software versions</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1 md:col-span-2 bg-gradient-to-br from-card to-card/50 border-primary/30 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Cpu className="w-48 h-48 text-primary" />
          </div>
          <CardHeader>
            <CardTitle className="font-mono text-primary flex items-center gap-2">
              <Package className="w-5 h-5" /> Active Client Version
            </CardTitle>
            <CardDescription className="font-mono">Current stable release for new nodes.</CardDescription>
          </CardHeader>
          <CardContent className="relative z-10">
            {latest ? (
              <div className="space-y-6">
                <div>
                  <div className="text-5xl font-mono font-bold text-foreground">v{latest.version}</div>
                  <div className="flex items-center gap-4 mt-2 text-sm font-mono text-muted-foreground">
                    <span className="flex items-center gap-1"><HardDrive className="w-4 h-4" /> {latest.size ? formatBytes(latest.size) : 'Unknown size'}</span>
                    <span className="flex items-center gap-1"><CheckCircle className="w-4 h-4 text-green-500" /> Stable</span>
                  </div>
                </div>
                
                <div className="p-4 bg-black/50 border border-border rounded font-mono text-sm text-muted-foreground">
                  <strong className="text-foreground block mb-2">Changelog:</strong>
                  {latest.changelog || "No release notes provided."}
                </div>

                <div className="flex gap-4">
                  <Button asChild size="lg" className="font-mono bg-primary text-primary-foreground hover:bg-primary/90 glow-primary">
                    <a href="/api/apk/latest/download" download>
                      <Download className="w-5 h-5 mr-2" />
                      Download APK
                    </a>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="py-8 text-muted-foreground font-mono">No active versions deployed.</div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-1 bg-card border-card-border flex flex-col">
          <CardHeader>
            <CardTitle className="font-mono text-sm uppercase tracking-widest text-muted-foreground">Upload Build</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-border/50 mx-6 mb-6 rounded-lg bg-black/20 hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-not-allowed group">
            <Upload className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors mb-4" />
            <p className="font-mono text-sm text-center text-muted-foreground group-hover:text-foreground">
              Drop signed APK here<br />
              <span className="text-xs opacity-50 mt-1 block">(CLI upload required in v0.1)</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-card-border">
        <CardHeader>
          <CardTitle className="font-mono text-sm">Version History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="border-b border-border bg-muted/20 text-muted-foreground uppercase text-xs tracking-wider">
                <th className="px-6 py-3 text-left font-medium">Version</th>
                <th className="px-6 py-3 text-left font-medium">Size</th>
                <th className="px-6 py-3 text-left font-medium">Uploaded</th>
                <th className="px-6 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {apks?.map((apk) => (
                <tr key={apk.id} className="hover:bg-muted/10">
                  <td className="px-6 py-4 font-bold text-foreground">v{apk.version}</td>
                  <td className="px-6 py-4 text-muted-foreground">{apk.size ? formatBytes(apk.size) : '-'}</td>
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
                </tr>
              ))}
              {!isLoading && !apks?.length && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground italic">No historical builds found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
