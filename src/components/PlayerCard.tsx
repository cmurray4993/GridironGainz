import { useState } from "react";
import { COIN_PER_FAN_PER_HOUR, playerArchetype, type Player, type Position } from "@/lib/game/types";
import { cn } from "@/lib/utils";
import qbArt from "@/assets/art/qb.jpg";
import rbArt from "@/assets/art/rb.jpg";
import wrArt from "@/assets/art/wr.jpg";
import olArt from "@/assets/art/ol.jpg";
import dlArt from "@/assets/art/dl.jpg";
import lbArt from "@/assets/art/lb.jpg";
import dbArt from "@/assets/art/db.jpg";
import kArt from "@/assets/art/k.jpg";

const POSITION_ART: Record<Position, string> = {
  QB: qbArt, RB: rbArt, WR: wrArt, OL: olArt,
  DL: dlArt, LB: lbArt, DB: dbArt, K: kArt,
};

const rarityBg: Record<Player["rarity"], string> = {
  bronze: "rarity-bronze",
  silver: "rarity-silver",
  gold: "rarity-gold",
  elite: "rarity-elite",
};

const rarityLabel: Record<Player["rarity"], string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  elite: "Elite",
};


export function PlayerCard({
  player,
  compact = false,
  className,
  onClick,
  selected,
}: {
  player: Player;
  compact?: boolean;
  className?: string;
  onClick?: () => void;
  selected?: boolean;
}) {
  const [flipped, setFlipped] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      onClick();
      return;
    }
    e.stopPropagation();
    setFlipped((f) => !f);
  };

  const art = POSITION_ART[player.position];
  const archetype = playerArchetype(player);
  const fansPerHr = +(player.fanValue * COIN_PER_FAN_PER_HOUR).toFixed(2);

  const minHeight = compact ? 170 : 260;


  return (
    <div
      className={cn("card-flip-scene w-full", className)}
      style={{ minHeight }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick(e as unknown as React.MouseEvent);
          }
        }}
        className={cn(
          "card-flip-inner group cursor-pointer",
          flipped && !onClick && "card-flipped",
          selected && "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-xl",
        )}
        style={{ minHeight }}
      >
        {/* FRONT */}
        <div
          className={cn(
            "card-flip-face overflow-hidden rounded-xl border border-white/10 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.7)] transition-transform",
            rarityBg[player.rarity],
            !onClick && "hover:-translate-y-0.5",
          )}
        >
          <div className="m-[2px] rounded-[calc(var(--radius)-2px)] bg-background/75 backdrop-blur-sm p-3 h-full flex flex-col">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {rarityLabel[player.rarity]}
                </div>
                <div className="mt-0.5 font-display text-lg leading-tight truncate">{player.name}</div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{player.position}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-display text-3xl text-gradient-gold leading-none">{player.overall}</div>
                <div className="text-[9px] uppercase text-muted-foreground mt-0.5">OVR</div>
              </div>
            </div>

            {!compact && (
              <div className="mt-3 flex-1 grid place-items-center">
                <div
                  className={cn(
                    "grid h-20 w-20 place-items-center rounded-full text-4xl border border-white/10",
                    "bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent_60%)]",
                    rarityBg[player.rarity],
                  )}
                >
                  <span>{portrait}</span>
                </div>
              </div>
            )}

            <div className="mt-2 flex items-center justify-end text-[11px]">
              <span className="text-[oklch(0.7_0.18_25)] font-semibold">❤️ {player.fanValue}</span>
            </div>

            {!onClick && (
              <div className="mt-1 text-center text-[9px] uppercase tracking-widest text-muted-foreground opacity-0 group-hover:opacity-70 transition-opacity hidden sm:block">
                Tap to flip
              </div>
            )}
          </div>
          <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity shimmer-overlay" />
        </div>

        {/* BACK */}
        <div
          className={cn(
            "card-flip-face card-flip-back overflow-hidden rounded-xl border border-white/10 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.7)]",
            rarityBg[player.rarity],
          )}
        >
          <div className="m-[2px] h-full rounded-[calc(var(--radius)-2px)] bg-background/85 backdrop-blur-sm p-3 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {rarityLabel[player.rarity]} · {player.position}
                </div>
                <div className="font-display text-base leading-tight truncate">{player.name}</div>
              </div>
              <div className="font-display text-2xl text-gradient-gold leading-none">{player.overall}</div>
            </div>

            <div className="space-y-1.5">
              <StatBar label="Overall" value={player.overall} tone="gold" />
              <StatBar label="Strength" value={player.strength} tone="red" />
              <StatBar label="Speed" value={player.speed} tone="cyan" />
              <StatBar label="IQ" value={player.iq} tone="violet" />
              <StatBar label="Popularity" value={player.popularity} tone="pink" />
            </div>

            <div className="mt-auto grid grid-cols-2 gap-2 pt-1 text-[10px]">
              <div className="rounded-md bg-white/5 px-2 py-1">
                <div className="uppercase tracking-widest text-muted-foreground">Archetype</div>
                <div className="font-semibold">{archetype}</div>
              </div>
              <div className="rounded-md bg-white/5 px-2 py-1 text-right">
                <div className="uppercase tracking-widest text-muted-foreground">Fans / hr</div>
                <div className="font-semibold text-[oklch(0.85_0.17_88)]">🪙 {fansPerHr}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const TONE: Record<string, string> = {
  gold: "bg-[oklch(0.82_0.16_82)]",
  red: "bg-[oklch(0.68_0.2_25)]",
  cyan: "bg-[oklch(0.75_0.15_210)]",
  violet: "bg-[oklch(0.7_0.2_300)]",
  pink: "bg-[oklch(0.75_0.18_355)]",
};

function StatBar({ label, value, tone = "gold" }: { label: string; value: number; tone?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span className="uppercase tracking-widest">{label}</span>
        <span className="font-semibold text-foreground">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className={cn("h-full rounded-full", TONE[tone])} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
