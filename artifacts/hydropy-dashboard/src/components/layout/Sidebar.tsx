import { Link, useLocation } from "wouter";
import { 
  Activity, 
  Cpu, 
  LayoutDashboard, 
  MessageSquare, 
  Send, 
  Settings, 
  Smartphone, 
  TerminalSquare 
} from "lucide-react";
import { useWebSocket } from "../../hooks/useWebSocket";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/devices", label: "Devices", icon: Smartphone },
  { href: "/campaigns", label: "Campaigns", icon: Send },
  { href: "/sms", label: "SMS Queue", icon: MessageSquare },
  { href: "/activity", label: "Live Activity", icon: Activity },
  { href: "/apk", label: "APK Manager", icon: Cpu },
  { href: "/logs", label: "Logs", icon: TerminalSquare },
  { href: "/system", label: "System Health", icon: Settings },
];

export function Sidebar() {
  const [location] = useLocation();
  const { isConnected } = useWebSocket();

  return (
    <aside className="w-64 bg-sidebar border-r border-sidebar-border h-screen flex flex-col hidden md:flex sticky top-0">
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded bg-primary/20 flex items-center justify-center border border-primary/30 glow-primary">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <span className="font-mono font-bold text-xl tracking-wider text-foreground">HYDROPY</span>
        </div>
      </div>
      
      <div className="px-6 py-4 flex items-center gap-3 border-b border-sidebar-border/50">
        <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500 glow-success' : 'bg-red-500 glow-danger'}`} />
        <span className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
          {isConnected ? 'System Online' : 'Connecting...'}
        </span>
      </div>

      <nav className="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} className={`flex items-center gap-3 px-3 py-2 rounded-md font-mono text-sm transition-all duration-200 ${isActive ? 'bg-primary/10 text-primary border border-primary/20 glow-primary' : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground'}`}>
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-sidebar-border text-xs text-muted-foreground font-mono text-center">
        V 0.1.0-ALPHA
      </div>
    </aside>
  );
}
