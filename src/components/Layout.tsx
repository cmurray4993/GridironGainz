import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useGame } from "@/lib/game/store";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { IS_TEST_NETWORK, SOLANA_NETWORK } from "@/lib/release";

export function TopBar() {
  const state = useGame();
  const [, force] = useState(0);

  // Re-render every second so pending-claim UI stays fresh.
  useEffect(() => {
    const i = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(i);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="relative mx-auto max-w-5xl px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <img
              src="/gridiron-gainz-logo.png"
              alt="Gridiron Gainz"
              className="h-9 w-9 shrink-0 object-contain drop-shadow-[0_0_8px_rgba(245,183,43,0.35)]"
            />
            <div>
              <div className="font-display text-lg leading-none">Gridiron Gainz</div>
              <div className="hidden text-[10px] uppercase tracking-widest text-muted-foreground min-[360px]:block">
                Season 1
              </div>
            </div>
          </Link>
          <div className="flex shrink-0 items-center gap-1.5">
            {IS_TEST_NETWORK && (
              <span className="hidden rounded-full border border-sky-400/40 bg-sky-400/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-sky-200 sm:inline">
                {SOLANA_NETWORK} · no cash value
              </span>
            )}
            <Link
              to="/wallet"
              title="Wallet"
              aria-label={`Confirmed test receipts: ${(state.sol ?? 0).toFixed(2)} devnet SOL`}
              className="rounded-full border border-border/70 bg-card/70 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              ◎ {(state.sol ?? 0).toFixed(2)}
            </Link>
            <Link
              to="/settings"
              title="Settings"
              aria-label="Settings"
              className="grid h-8 w-8 place-items-center rounded-full border border-border/70 bg-card/70 text-xs text-muted-foreground hover:text-foreground"
            >
              ⚙︎
            </Link>
            <SignOutButton />
          </div>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5 text-sm sm:absolute sm:left-1/2 sm:top-1/2 sm:mt-0 sm:w-auto sm:-translate-x-1/2 sm:-translate-y-1/2 sm:flex sm:gap-2">
          <Stat
            icon={<img src="/gc-icon.png" alt="Gridiron Cash" className="h-5 w-5 object-contain" />}
            value={fmt(state.gridironCash ?? 0)}
            tone="fan"
          />
          <Stat icon="🪙" value={fmt(state.coins)} tone="gold" />
          <Stat icon="🎟️" value={fmt(state.fans)} tone="fan" />
        </div>
      </div>
    </header>
  );
}

function SignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await supabase.auth.signOut();
        router.navigate({ to: "/auth" });
      }}
      title="Sign out"
      aria-label="Sign out"
      className="grid h-8 w-8 place-items-center rounded-full border border-border/70 bg-card/70 text-xs text-muted-foreground hover:text-foreground"
    >
      ⎋
    </button>
  );
}

function Stat({ icon, value, tone }: { icon: ReactNode; value: string; tone: "gold" | "fan" }) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center justify-center gap-1 rounded-lg border border-border/70 bg-card/70 px-1.5 py-1.5 sm:gap-1.5 sm:rounded-full sm:px-3",
        tone === "gold" && "text-[oklch(0.85_0.17_88)]",
        tone === "fan" && "text-[oklch(0.7_0.18_25)]",
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = [
    { to: "/", label: "Home", icon: "🏠" },
    { to: "/pack", label: "Pack", icon: "🎴" },
    { to: "/roster", label: "Team", icon: "👥" },
    { to: "/market", label: "Market", icon: "💰" },
    { to: "/game", label: "Game", icon: "🏈" },
    { to: "/standings", label: "League", icon: "🏆" },
  ] as const;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl">
        {items.map((it) => {
          const active = pathname === it.to;
          return (
            <Link
              key={it.to}
              to={it.to}
              className={cn(
                "min-w-0 flex-1 py-2 text-center text-[9px] uppercase tracking-wide transition-colors sm:py-2.5 sm:text-[11px] sm:tracking-widest",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <div className="text-base leading-none sm:text-lg">{it.icon}</div>
              <div className="mt-0.5">{it.label}</div>
              {active && (
                <div className="mx-auto mt-1 h-0.5 w-8 rounded-full bg-primary shadow-[0_0_10px_var(--gold)]" />
              )}
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
