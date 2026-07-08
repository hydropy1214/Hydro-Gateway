import { useGetDashboardStats, useGetActivity, useListDevices } from "@workspace/api-client-react";
import { Activity, AlertTriangle, CheckCircle, Clock, Smartphone, MessageSquare, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: activity, isLoading: activityLoading } = useGetActivity({ limit: 5 });

  if (statsLoading || activityLoading) {
    return <div className="p-8 space-y-4 animate-pulse">
      <div className="h-8 w-48 bg-muted rounded"></div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-32 bg-muted rounded"></div>)}
      </div>
    </div>;
  }

  if (!stats) return null;

  const successRateData = [
    { name: 'Sent', value: stats.smsSentToday, color: 'hsl(160, 84%, 39%)' },
    { name: 'Failed', value: stats.smsFailed, color: 'hsl(0, 62.8%, 30.6%)' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-mono font-bold tracking-tight">OPERATIONS <span className="text-primary">OVERVIEW</span></h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">Real-time gateway status</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-card-border overflow-hidden relative group hover:border-primary/50 transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Smartphone className="w-12 h-12" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-mono font-medium text-muted-foreground">Active Devices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-mono font-bold text-foreground">{stats.onlineDevices} <span className="text-lg text-muted-foreground">/ {stats.totalDevices}</span></div>
            <div className="mt-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 glow-success animate-pulse"></span>
              <p className="text-xs font-mono text-green-500">Fleet Online</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-card-border overflow-hidden relative group hover:border-primary/50 transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Send className="w-12 h-12" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-mono font-medium text-muted-foreground">SMS Sent Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-mono font-bold text-primary glow-primary inline-block">{stats.smsSentToday.toLocaleString()}</div>
            <p className="text-xs font-mono text-muted-foreground mt-2 flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-primary" /> System Nominal
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-card-border overflow-hidden relative group hover:border-primary/50 transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Clock className="w-12 h-12" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-mono font-medium text-muted-foreground">Queue Backlog</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-mono font-bold">{stats.queuedMessages.toLocaleString()}</div>
            <p className="text-xs font-mono text-yellow-500 mt-2 flex items-center gap-1">
              <Activity className="w-3 h-3" /> Messages Processing
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-card-border overflow-hidden relative group hover:border-primary/50 transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <AlertTriangle className="w-12 h-12" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-mono font-medium text-muted-foreground">Failures Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-4xl font-mono font-bold ${stats.smsFailed > 0 ? 'text-red-500 glow-danger' : 'text-foreground'}`}>{stats.smsFailed.toLocaleString()}</div>
            <p className="text-xs font-mono text-muted-foreground mt-2">
              {(stats.smsFailed / (stats.smsSentToday + stats.smsFailed) * 100 || 0).toFixed(2)}% Failure Rate
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-1 border-card-border bg-card">
          <CardHeader>
            <CardTitle className="text-sm font-mono font-bold uppercase tracking-widest text-muted-foreground">Delivery Success Rate</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center">
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={successRateData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {successRateData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', fontFamily: 'var(--app-font-mono)' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-4 mt-4 w-full justify-center">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#10b981]"></div>
                <span className="text-xs font-mono">Sent ({stats.smsSentToday})</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#ef4444]"></div>
                <span className="text-xs font-mono">Failed ({stats.smsFailed})</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-2 border-card-border bg-card flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/50">
            <CardTitle className="text-sm font-mono font-bold uppercase tracking-widest text-muted-foreground">Live Activity</CardTitle>
            <Link href="/activity" className="text-xs font-mono text-primary hover:underline">View All</Link>
          </CardHeader>
          <CardContent className="flex-1 p-0">
            <div className="divide-y divide-border/50 max-h-[250px] overflow-y-auto">
              {activity?.map(event => (
                <div key={event.id} className="p-4 hover:bg-muted/30 transition-colors flex items-start gap-4">
                  <div className="mt-1">
                    {event.type.includes('error') || event.type.includes('failed') ? (
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                    ) : event.type.includes('completed') || event.type.includes('success') ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <Activity className="w-4 h-4 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono">{event.message}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground font-mono">
                      <span>{formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}</span>
                      {event.deviceName && <span>Device: {event.deviceName}</span>}
                      {event.campaignName && <span>Campaign: {event.campaignName}</span>}
                    </div>
                  </div>
                </div>
              ))}
              {!activity?.length && (
                <div className="p-8 text-center text-muted-foreground font-mono text-sm">
                  No recent activity
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
