import { Shell } from "@/components/layout/Shell";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import NotFound from '@/pages/not-found';
import Dashboard from "@/pages/Dashboard";
import Devices from "@/pages/Devices";
import DeviceDetail from "@/pages/DeviceDetail";
import Campaigns from "@/pages/Campaigns";
import NewCampaign from "@/pages/NewCampaign";
import CampaignDetail from "@/pages/CampaignDetail";
import SmsQueue from "@/pages/SmsQueue";
import ApkManager from "@/pages/ApkManager";
import ActivityFeed from "@/pages/ActivityFeed";
import Logs from "@/pages/Logs";
import SystemHealth from "@/pages/SystemHealth";
import { setAuthTokenGetter } from '@workspace/api-client-react';
import { useEffect, useState } from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Shell>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/devices" component={Devices} />
        <Route path="/devices/:id" component={DeviceDetail} />
        <Route path="/campaigns" component={Campaigns} />
        <Route path="/campaigns/new" component={NewCampaign} />
        <Route path="/campaigns/:id" component={CampaignDetail} />
        <Route path="/sms" component={SmsQueue} />
        <Route path="/apk" component={ApkManager} />
        <Route path="/activity" component={ActivityFeed} />
        <Route path="/logs" component={Logs} />
        <Route path="/system" component={SystemHealth} />
        <Route component={NotFound} />
      </Switch>
    </Shell>
  );
}

function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Fetch the API key from the public /api/config endpoint and register it
    // so all generated API hooks include `Authorization: Bearer <key>`.
    fetch('/api/config')
      .then(r => r.json())
      .then((data: { apiKey: string }) => {
        if (data.apiKey) {
          setAuthTokenGetter(() => data.apiKey);
        }
      })
      .catch(err => {
        console.warn('Could not fetch API config:', err);
      })
      .finally(() => {
        setReady(true);
      });
  }, []);

  if (!ready) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#0a0e1a', color: '#00e5ff',
        fontFamily: 'monospace', fontSize: '14px', letterSpacing: '0.1em'
      }}>
        HYDROPY — INITIALISING...
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
