import { useParams } from "wouter";
import { useGetCampaign, useListSmsMessages, useStartCampaign, usePauseCampaign, useCancelCampaign } from "@workspace/api-client-react";
import { StatusBadge, SmsStatusBadge } from "@/components/ui/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Play, Pause, XOctagon, ChevronLeft, MessageSquare, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";

export default function CampaignDetail() {
  const { id } = useParams();
  const campaignId = parseInt(id || "0", 10);
  const { data: campaign, isLoading } = useGetCampaign(campaignId, { query: { enabled: !!campaignId, refetchInterval: 5000 } });
  const { data: smsData, isLoading: smsLoading } = useListSmsMessages({ campaign_id: campaignId, limit: 50 }, { query: { enabled: !!campaignId, refetchInterval: 5000 } });
  
  const queryClient = useQueryClient();
  const startAction = useStartCampaign();
  const pauseAction = usePauseCampaign();
  const cancelAction = useCancelCampaign();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });

  if (isLoading || !campaign) return <div className="p-8 animate-pulse h-full bg-muted/20"></div>;

  const progress = campaign.totalContacts > 0 ? ((campaign.sentCount + campaign.failedCount) / campaign.totalContacts) * 100 : 0;
  const isActionable = campaign.status === 'draft' || campaign.status === 'paused';
  const isRunning = campaign.status === 'running';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/campaigns" className="p-2 hover:bg-muted rounded text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-mono font-bold tracking-tight uppercase">{campaign.name}</h1>
              <StatusBadge status={campaign.status} />
            </div>
            <p className="text-muted-foreground font-mono text-sm mt-1">ID: #{campaign.id} • Payload Size: {campaign.message.length}b</p>
          </div>
        </div>

        <div className="flex gap-2">
          {isActionable && (
            <Button onClick={() => startAction.mutate({ id: campaignId }, { onSuccess: invalidate })} className="font-mono bg-primary text-black hover:bg-primary/90 glow-primary">
              <Play className="w-4 h-4 mr-2" /> Engage
            </Button>
          )}
          {isRunning && (
            <Button onClick={() => pauseAction.mutate({ id: campaignId }, { onSuccess: invalidate })} variant="outline" className="font-mono border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10">
              <Pause className="w-4 h-4 mr-2" /> Suspend
            </Button>
          )}
          {(isRunning || isActionable) && campaign.status !== 'completed' && (
            <Button onClick={() => { if(confirm('Abort campaign?')) cancelAction.mutate({ id: campaignId }, { onSuccess: invalidate }) }} variant="outline" className="font-mono border-red-500/50 text-red-500 hover:bg-red-500/10">
              <XOctagon className="w-4 h-4 mr-2" /> Abort
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card border-card-border">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-1">Target Matrix</p>
              <div className="text-3xl font-mono font-bold text-foreground">{campaign.totalContacts}</div>
            </div>
            <div className="p-3 bg-primary/10 rounded border border-primary/20">
              <MessageSquare className="w-6 h-6 text-primary" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-card-border">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-1">Delivered</p>
              <div className="text-3xl font-mono font-bold text-green-500 glow-success">{campaign.sentCount}</div>
            </div>
            <div className="p-3 bg-green-500/10 rounded border border-green-500/20">
              <CheckCircle className="w-6 h-6 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-card-border">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-1">Failed</p>
              <div className={`text-3xl font-mono font-bold ${campaign.failedCount > 0 ? 'text-red-500 glow-danger' : 'text-foreground'}`}>{campaign.failedCount}</div>
            </div>
            <div className="p-3 bg-red-500/10 rounded border border-red-500/20">
              <AlertTriangle className={`w-6 h-6 ${campaign.failedCount > 0 ? 'text-red-500' : 'text-muted-foreground'}`} />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-card-border">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-1">Pending</p>
              <div className="text-3xl font-mono font-bold text-yellow-500">{campaign.pendingCount}</div>
            </div>
            <div className="p-3 bg-yellow-500/10 rounded border border-yellow-500/20">
              <Clock className="w-6 h-6 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-card-border">
        <CardContent className="p-6">
          <div className="flex justify-between text-xs font-mono mb-2">
            <span className="text-muted-foreground">Execution Progress</span>
            <span className="text-primary glow-primary font-bold">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2 bg-black border border-border" />
          <div className="mt-4 p-4 bg-black rounded border-l-2 border-primary/50 text-sm font-mono text-muted-foreground">
            "{campaign.message}"
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-card-border">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="text-sm font-mono flex items-center justify-between">
            Transmission Log
            <span className="text-xs text-muted-foreground font-normal">Last 50 messages</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {smsLoading ? (
            <div className="p-8 text-center text-muted-foreground font-mono text-sm">Loading queue...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-border bg-muted/20 text-muted-foreground">
                    <th className="px-4 py-3 text-left font-medium">Target</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Node</th>
                    <th className="px-4 py-3 text-right font-medium">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {smsData?.messages.map((sms) => (
                    <tr key={sms.id} className="hover:bg-muted/10">
                      <td className="px-4 py-3 font-medium">{sms.phoneNumber}</td>
                      <td className="px-4 py-3">
                        <SmsStatusBadge status={sms.status} />
                        {sms.errorMessage && <div className="text-[10px] text-red-500 mt-1 max-w-[200px] truncate" title={sms.errorMessage}>{sms.errorMessage}</div>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {sms.deviceId ? <Link href={`/devices/${sms.deviceId}`} className="hover:text-primary hover:underline">Node {sms.deviceId}</Link> : '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {format(new Date(sms.createdAt), 'MMM d HH:mm:ss')}
                      </td>
                    </tr>
                  ))}
                  {!smsData?.messages.length && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground italic">No messages queued for this campaign.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
