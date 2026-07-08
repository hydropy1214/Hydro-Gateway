export function StatusBadge({ status }: { status: string }) {
  const normStatus = status?.toLowerCase() || 'unknown';
  
  if (normStatus === 'online') {
    return (
      <span className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-mono bg-green-500/10 text-green-500 border border-green-500/20 glow-success">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        ONLINE
      </span>
    );
  }
  if (normStatus === 'offline') {
    return (
      <span className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-mono bg-red-500/10 text-red-500 border border-red-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        OFFLINE
      </span>
    );
  }
  if (normStatus === 'disabled') {
    return (
      <span className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-mono bg-gray-500/10 text-gray-400 border border-gray-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
        DISABLED
      </span>
    );
  }

  // Campaign statuses
  if (normStatus === 'running') {
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-mono bg-primary/20 text-primary border border-primary/30 glow-primary">RUNNING</span>;
  }
  if (normStatus === 'draft') {
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-mono bg-gray-800 text-gray-300 border border-gray-700">DRAFT</span>;
  }
  if (normStatus === 'paused') {
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-mono bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 glow-warning">PAUSED</span>;
  }
  if (normStatus === 'completed') {
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-mono bg-green-500/10 text-green-500 border border-green-500/20 glow-success">COMPLETED</span>;
  }

  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-mono bg-secondary text-secondary-foreground border border-border">
      {status.toUpperCase()}
    </span>
  );
}

export function SmsStatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  const colors: Record<string, string> = {
    CREATED: "bg-gray-500/10 text-gray-400 border-gray-500/20",
    QUEUED: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    ASSIGNED: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    SENT_TO_DEVICE: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20 glow-primary",
    SENDING: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20 glow-warning animate-pulse",
    SUCCESS: "bg-green-500/10 text-green-500 border-green-500/20 glow-success",
    FAILED: "bg-red-500/10 text-red-500 border-red-500/20 glow-danger",
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono border ${colors[s] || colors.CREATED}`}>
      {s}
    </span>
  );
}
