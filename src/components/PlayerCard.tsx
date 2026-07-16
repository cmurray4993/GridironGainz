import type { Player } from "@/lib/game/types";
import { cn } from "@/lib/utils";

const rarityBg: Record<Player["rarity"], string> = {
  common: "rarity-common",
  uncommon: "rarity-uncommon",
  rare: "rarity-rare",
  epic: "rarity-epic",
  legendary: "rarity-legendary",
};

const rarityLabel: Record<Player["rarity"], string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
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
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative w-full text-left overflow-hidden rounded-xl transition-transform",
        "border border-white/10 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.7)]",
        rarityBg[player.rarity],
        onClick && "hover:-translate-y-1 hover:shadow-[0_18px_40px_-12px_rgba(0,0,0,0.8)] cursor-pointer",
        selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        className,
      )}
    >
      {/* dark inner */}
      <div className="m-[2px] rounded-[calc(var(--radius)-2px)] bg-background/70 backdrop-blur-sm p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {rarityLabel[player.rarity]}
            </div>
            <div className="font-display text-lg leading-tight truncate">{player.name}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-display text-3xl text-gradient-gold leading-none">{player.overall}</div>
            <div className="text-[10px] uppercase text-muted-foreground mt-0.5">{player.position}</div>
          </div>
        </div>

        {!compact && (
          <>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <Stat label="STR" value={player.strength} />
              <Stat label="SPD" value={player.speed} />
              <Stat label="IQ"  value={player.iq} />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Fan value</span>
              <span className="font-semibold text-[oklch(0.7_0.18_25)]">+{player.fanValue}</span>
            </div>
          </>
        )}
      </div>
      <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity shimmer-overlay" />
    </button>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-white/5 py-1.5">
      <div className="text-[10px] tracking-widest text-muted-foreground">{label}</div>
      <div className="font-semibold text-sm">{value}</div>
    </div>
  );
}
