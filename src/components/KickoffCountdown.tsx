import { useEffect, useState } from "react";
import { formatCountdown, kickoffStatus } from "@/lib/game/kickoff";

export function KickoffCountdown({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState(() => kickoffStatus());
  useEffect(() => {
    const i = setInterval(() => setStatus(kickoffStatus()), 1000);
    return () => clearInterval(i);
  }, []);

  const label = status.isLive ? "Live now — window closes in" : "Next kickoff in";
  const value = status.isLive
    ? formatCountdown(status.msLeftInWindow)
    : formatCountdown(status.msUntil);

  if (compact) {
    return (
      <div className="text-right">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {status.isLive ? "Live" : "Kickoff 7:00 PM CT"}
        </div>
        <div className={`font-display text-lg tabular-nums ${status.isLive ? "text-[oklch(0.72_0.2_28)]" : "text-gradient-gold"}`}>
          {value}
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-4 ${status.isLive ? "border-[oklch(0.72_0.2_28)]/60 bg-[oklch(0.72_0.2_28)]/5" : "border-primary/40 bg-background/60"}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
          <div className={`mt-1 font-display text-3xl tabular-nums ${status.isLive ? "text-[oklch(0.75_0.2_28)]" : "text-gradient-gold"}`}>
            {value}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Daily matchup vs another manager · 7:00 PM Central
          </div>
        </div>
        <div className={`grid h-14 w-14 place-items-center rounded-full border font-display text-xl ${status.isLive ? "border-[oklch(0.72_0.2_28)]/60 animate-pulse" : "border-border/70 bg-background/70"}`}>
          {status.isLive ? "🔴" : "⏱"}
        </div>
      </div>
    </div>
  );
}
