import { useListSmsMessages } from "@workspace/api-client-react";
import { SmsStatusBadge } from "@/components/ui/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { Link } from "wouter";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

export default function SmsQueue() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { data: smsData, isLoading } = useListSmsMessages({ 
    status: statusFilter === "all" ? undefined : statusFilter,
    limit: 100
  }, { query: { refetchInterval: 5000 } });
  
  const queryClient = useQueryClient();

  const statuses = ["ALL", "CREATED", "QUEUED", "ASSIGNED", "SENT_TO_DEVICE", "SENDING", "SUCCESS", "FAILED"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-mono font-bold tracking-tight">GLOBAL <span className="text-primary">QUEUE</span></h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">Raw SMS dispatch stream</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] font-mono text-xs bg-card border-border">
              <SelectValue placeholder="Filter by Status" />
            </SelectTrigger>
            <SelectContent className="font-mono text-xs">
              {statuses.map(s => (
                <SelectItem key={s} value={s.toLowerCase()}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            size="icon" 
            className="border-primary/30 text-primary hover:bg-primary/10"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/sms"] })}
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Card className="bg-card border-card-border overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 flex justify-center">
              <RefreshCw className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-border bg-black/40 text-muted-foreground uppercase tracking-wider">
                    <th className="px-4 py-3 text-left font-medium w-16">ID</th>
                    <th className="px-4 py-3 text-left font-medium">Target</th>
                    <th className="px-4 py-3 text-left font-medium max-w-xs">Payload Snippet</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Routing</th>
                    <th className="px-4 py-3 text-right font-medium">Dispatched</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {smsData?.messages.map((sms) => (
                    <tr key={sms.id} className="hover:bg-muted/10 group">
                      <td className="px-4 py-3 text-muted-foreground/50">#{sms.id}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{sms.phoneNumber}</td>
                      <td className="px-4 py-3 max-w-xs">
                        <div className="truncate text-muted-foreground flex items-center gap-2">
                          <MessageSquare className="w-3 h-3 flex-shrink-0" />
                          {sms.message}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <SmsStatusBadge status={sms.status} />
                        {sms.errorMessage && (
                          <div className="text-[10px] text-red-500 mt-1 truncate max-w-[150px]" title={sms.errorMessage}>
                            ERR: {sms.errorMessage}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <div className="flex flex-col gap-1">
                          {sms.deviceId ? (
                            <Link href={`/devices/${sms.deviceId}`} className="hover:text-primary transition-colors inline-flex items-center gap-1">
                              N-{sms.deviceId}
                            </Link>
                          ) : <span className="text-muted-foreground/30">Unassigned</span>}
                          
                          {sms.campaignId && (
                            <Link href={`/campaigns/${sms.campaignId}`} className="text-[10px] text-cyan-500 hover:underline">
                              C-{sms.campaignId}
                            </Link>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {format(new Date(sms.createdAt), 'MMM d, HH:mm:ss')}
                      </td>
                    </tr>
                  ))}
                  {!smsData?.messages.length && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground border-dashed">
                        No transmissions found in current view.
                      </td>
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
