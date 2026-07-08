import { useListCampaigns, useDeleteCampaign, useStartCampaign, usePauseCampaign } from "@workspace/api-client-react";
import { Link } from "wouter";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import { Play, Pause, Trash2, Plus, Users, Send } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { formatDistanceToNow } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";

export default function Campaigns() {
  const { data: campaigns, isLoading } = useListCampaigns();
  const deleteCampaign = useDeleteCampaign();
  const startCampaign = useStartCampaign();
  const pauseCampaign = usePauseCampaign();
  const queryClient = useQueryClient();

  if (isLoading) return <div className="p-8 animate-pulse h-32 bg-muted/20 rounded"></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-mono font-bold tracking-tight">CAMPAIGN <span className="text-primary">CONTROL</span></h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">Manage bulk SMS distribution</p>
        </div>
        <Button asChild className="font-mono text-xs bg-primary text-primary-foreground hover:bg-primary/90 glow-primary">
          <Link href="/campaigns/new">
            <Plus className="w-4 h-4 mr-2" />
            New Campaign
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {campaigns?.map((campaign) => {
          const progress = campaign.totalContacts > 0 
            ? ((campaign.sentCount + campaign.failedCount) / campaign.totalContacts) * 100 
            : 0;

          return (
            <div key={campaign.id} className="border border-border bg-card rounded-lg overflow-hidden flex flex-col hover:border-primary/50 transition-colors group">
              <div className="p-5 border-b border-border/50">
                <div className="flex justify-between items-start mb-4">
                  <Link href={`/campaigns/${campaign.id}`} className="font-mono font-bold text-lg hover:text-primary transition-colors truncate pr-2">
                    {campaign.name}
                  </Link>
                  <StatusBadge status={campaign.status} />
                </div>
                
                <div className="text-sm font-mono text-muted-foreground line-clamp-2 mb-4 h-10 border-l-2 border-primary/30 pl-3">
                  {campaign.message}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono mb-4 bg-muted/30 rounded p-2">
                  <div>
                    <div className="text-muted-foreground uppercase text-[10px]">Total</div>
                    <div className="font-bold text-foreground">{campaign.totalContacts}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground uppercase text-[10px]">Sent</div>
                    <div className="font-bold text-green-500">{campaign.sentCount}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground uppercase text-[10px]">Failed</div>
                    <div className="font-bold text-red-500">{campaign.failedCount}</div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="text-primary">{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-1.5 bg-muted" />
                </div>
              </div>

              <div className="bg-muted/10 p-3 flex justify-between items-center mt-auto">
                <div className="text-xs font-mono text-muted-foreground">
                  {campaign.createdAt ? formatDistanceToNow(new Date(campaign.createdAt), { addSuffix: true }) : ''}
                </div>
                <div className="flex gap-2">
                  {campaign.status === 'draft' || campaign.status === 'paused' ? (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-8 border-primary/30 text-primary hover:bg-primary/10"
                      onClick={() => startCampaign.mutate({ id: campaign.id }, {
                        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] })
                      })}
                    >
                      <Play className="w-3 h-3 mr-1.5" /> Start
                    </Button>
                  ) : campaign.status === 'running' ? (
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-8 border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10"
                      onClick={() => pauseCampaign.mutate({ id: campaign.id }, {
                        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] })
                      })}
                    >
                      <Pause className="w-3 h-3 mr-1.5" /> Pause
                    </Button>
                  ) : null}
                  
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                    onClick={() => {
                      if(confirm('Delete campaign?')) {
                        deleteCampaign.mutate({ id: campaign.id }, {
                          onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] })
                        });
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}

        {!campaigns?.length && (
          <div className="col-span-full py-16 text-center border border-dashed border-border rounded-lg bg-card/50">
            <Send className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="font-mono text-lg mb-2">No Campaigns Active</h3>
            <p className="text-muted-foreground font-mono text-sm mb-4">Create your first SMS distribution campaign.</p>
            <Button asChild variant="outline" className="font-mono text-primary border-primary/30 hover:bg-primary/10">
              <Link href="/campaigns/new">Initialize Campaign</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
