import { useEffect, useState } from "react";

function formatCountdown(ms: number) {
  if (ms <= 0) return "LOCKED";
  const total = Math.floor(ms / 1_000);
  const hours = Math.floor(total / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const seconds = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function KickoffCountdown({
  lockAt,
  compact = false,
}: {
  lockAt?: string;
  compact?: boolean;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  const target = lockAt ? new Date(lockAt).getTime() : Number.NaN;
  const scheduled = Number.isFinite(target);
  const locked = scheduled && target <= now;
  const value = scheduled ? formatCountdown(target - now) : "TBD";

  if (compact)
    return (
      <div className="text-right">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Server lineup lock
        </div>
        <div className="font-display text-lg tabular-nums text-gradient-gold">{value}</div>
      </div>
    );
  return (
    <div className="rounded-xl border border-primary/40 bg-background/60 p-4">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {locked ? "Official lineup locked" : "Server lineup lock in"}
      </div>
      <div className="mt-1 font-display text-3xl tabular-nums text-gradient-gold">{value}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">
        {scheduled ? new Date(target).toLocaleString() : "Awaiting the official schedule"}
      </div>
    </div>
  );
}
