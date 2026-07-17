import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useGame } from "@/lib/game/store";
import { cn } from "@/lib/utils";

export function TopBar() {
  const state = useGame();
  const [, force] = useState(0);

  // Re-render every second so pending-claim UI stays fresh.
  useEffect(() => {
    const i = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(i);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-[image:var(--gradient-gold)] font-display text-primary-foreground text-sm shadow-[var(--shadow-glow)]">
            4F
          </div>
          <div className="hidden sm:block">
            <div className="font-display text-lg leading-none">Fourth &amp; Fortune</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Season 1</div>
          </div>
        </Link>
        <div className="flex items-center gap-2 text-sm">
          <Stat icon="🪙" value={fmt(state.coins)} tone="gold" />
          <Stat icon="🎟️" value={fmt(state.fans)} tone="fan" />
        </div>
      </div>
    </header>
  );
}

function Stat({ icon, value, tone }: { icon: string; value: string; tone: "gold" | "fan" }) {
  return (
    <div className={cn(
      "flex items-center gap-1.5 rounded-full border border-border/70 bg-card/70 px-3 py-1.5",
      tone === "gold" && "text-[oklch(0.85_0.17_88)]",
      tone === "fan" && "text-[oklch(0.7_0.18_25)]",
    )}>
      <span>{icon}</span>
      <span className="font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = [
    { to: "/", label: "Home", icon: "🏠" },
    { to: "/pack", label: "Pack", icon: "🎴" },
    { to: "/roster", label: "Roster", icon: "👥" },
    { to: "/lineup", label: "Lineup", icon: "📋" },
    { to: "/market", label: "Market", icon: "💰" },
    { to: "/game", label: "Game", icon: "🏈" },
    { to: "/standings", label: "League", icon: "🏆" },
  ] as const;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl">
        {items.map((it) => {
          const active = pathname === it.to;
          return (
            <Link
              key={it.to}
              to={it.to}
              className={cn(
                "flex-1 py-2.5 text-center text-[11px] uppercase tracking-widest transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <div className="text-lg leading-none">{it.icon}</div>
              <div className="mt-0.5">{it.label}</div>
              {active && <div className="mx-auto mt-1 h-0.5 w-8 rounded-full bg-primary shadow-[0_0_10px_var(--gold)]" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function fmt(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k";
  return n.toFixed(n < 10 ? 2 : 0);
}
