import { useState } from "react";
import {
  COIN_PER_FAN_PER_HOUR,
  playerArchetype,
  type Player,
  type Position,
} from "@/lib/game/types";
import { BASE_PROSPECT_NAMES } from "@/lib/game/generate";
import { cn } from "@/lib/utils";
import qbArt from "@/assets/art/clean/qb.png";
import rbArt from "@/assets/art/clean/rb.png";
import wrArt from "@/assets/art/clean/wr.png";
import teArt from "@/assets/art/clean/te.png";
import olArt from "@/assets/art/clean/ol.png";
import dlArt from "@/assets/art/clean/dl.png";
import lbArt from "@/assets/art/clean/lb.png";
import dbArt from "@/assets/art/clean/db.png";
import kArt from "@/assets/art/clean/k.png";
import prospectQbArt from "@/assets/art/prospects/prospect-qb.png";
import prospectRbArt from "@/assets/art/prospects/prospect-rb.png";
import prospectWrArt from "@/assets/art/prospects/prospect-wr.png";
import prospectTeArt from "@/assets/art/prospects/prospect-te.png";
import prospectOlArt from "@/assets/art/prospects/prospect-ol.png";
import prospectDlArt from "@/assets/art/prospects/prospect-dl.png";
import prospectLbArt from "@/assets/art/prospects/prospect-lb.png";
import prospectDbArt from "@/assets/art/prospects/prospect-db.png";
import prospectKArt from "@/assets/art/prospects/prospect-k.png";
import sigCreighton from "@/assets/art/clean/sig-creighton-murray.png";
import sigTalon from "@/assets/art/sig-talon-reynolds-v2.png";
import sigTy from "@/assets/art/clean/sig-ty-smith.png";
import sigGary from "@/assets/art/clean/sig-gary-gainz.png";
import sigBusta from "@/assets/art/clean/sig-busta-jones.png";
import sigGringo from "@/assets/art/clean/sig-gringo-guth.png";
import sigSleepy from "@/assets/art/sig-sleepy-cringle.jpg";
import sigMettling from "@/assets/art/sig-josiah-mettling-v2.png";
import sigBall from "@/assets/art/sig-josiah-ball.jpg";
import sigSammy from "@/assets/art/clean/sig-sammy-wheeler.png";
import sigBreck from "@/assets/art/sig-breck-guthrie.jpg";
import sigCarter from "@/assets/art/clean/sig-carter-carter.png";
import sigMason from "@/assets/art/clean/sig-mason-baker.png";
import baseProgramLogo from "@/assets/brand/gridiron-gainz-logo.png";
import hometownHeroesLogo from "@/assets/promos/hometown-heroes.png";

const POSITION_ART: Record<Position, string> = {
  QB: qbArt,
  RB: rbArt,
  WR: wrArt,
  TE: teArt,
  OL: olArt,
  DL: dlArt,
  LB: lbArt,
  DB: dbArt,
  K: kArt,
  P: kArt,
};

const PROSPECT_ART: Record<Position, string> = {
  QB: prospectQbArt,
  RB: prospectRbArt,
  WR: prospectWrArt,
  TE: prospectTeArt,
  OL: prospectOlArt,
  DL: prospectDlArt,
  LB: prospectLbArt,
  DB: prospectDbArt,
  K: prospectKArt,
  P: prospectKArt,
};

const SIGNATURE_ART: Record<string, string> = {
  "Creighton Murray": sigCreighton,
  'Talon "7 Iron" Reynolds': sigTalon,
  'Ty "Teethman" Smith': sigTy,
  "Gary Gainz": sigGary,
  'Busta "Fly" Jones': sigBusta,
  "Gringo Guth": sigGringo,
  "Sleepy Cringle": sigSleepy,
  'Josiah "8 Man" Mettling': sigMettling,
  'Josiah "The Messiah" Ball': sigBall,
  'Breck "Coach Razor" Guthrie': sigBreck,
  'Carter "Combine" Carter': sigCarter,
  'Mason "Bait Man" Baker': sigMason,
  'Sammy "Wheely" Wheeler': sigSammy,
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

const compactNameplate: Record<Player["rarity"], string> = {
  bronze:
    "border-[oklch(0.58_0.11_55)] bg-[linear-gradient(135deg,oklch(0.38_0.08_48),oklch(0.24_0.045_40))]",
  silver:
    "border-[oklch(0.78_0.025_245)] bg-[linear-gradient(135deg,oklch(0.58_0.03_245),oklch(0.30_0.025_250))]",
  gold: "border-[oklch(0.88_0.17_85)] bg-[linear-gradient(135deg,oklch(0.68_0.17_75),oklch(0.34_0.09_65))]",
  elite:
    "border-[oklch(0.67_0.22_27)] bg-[linear-gradient(135deg,oklch(0.58_0.23_27),oklch(0.28_0.13_25))]",
};

const compactFrame: Record<Player["rarity"], string> = {
  bronze: "border-[oklch(0.48_0.10_55)]",
  silver: "border-[oklch(0.72_0.03_245)]",
  gold: "border-[oklch(0.78_0.16_80)]",
  elite: "border-[oklch(0.60_0.24_27)] shadow-[0_0_14px_oklch(0.50_0.22_27/0.38)]",
};

const BACKYARD_HEROES = new Set([
  'Busta "Fly" Jones',
  'Josiah "The Messiah" Ball',
  "Creighton Murray",
  "Gringo Guth",
  "Sleepy Cringle",
  'Talon "7 Iron" Reynolds',
  'Ty "Teethman" Smith',
  'Josiah "8 Man" Mettling',
  'Breck "Coach Razor" Guthrie',
  "Gary Gainz",
]);

export function PlayerCard({
  player,
  compact = false,
  mobileDense = false,
  className,
  onClick,
  selected,
}: {
  player: Player;
  compact?: boolean;
  mobileDense?: boolean;
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

  const isHometownHero = player.program === "hometown_heroes" || BACKYARD_HEROES.has(player.name);
  const isBaseProspect =
    !isHometownHero &&
    (player.name.startsWith("Unsigned") || player.name === BASE_PROSPECT_NAMES[player.position]);
  const sigArt = SIGNATURE_ART[player.name];
  const art = isBaseProspect
    ? PROSPECT_ART[player.position]
    : (sigArt ?? POSITION_ART[player.position]);
  const hasSignatureArt = Boolean(sigArt);
  const archetype = playerArchetype(player);
  const fansPerHr = +(player.fanValue * COIN_PER_FAN_PER_HOUR).toFixed(2);
  const promo = isBaseProspect
    ? { short: "GG", name: "Base Program", logo: baseProgramLogo }
    : isHometownHero
      ? { short: "HH", name: "Hometown Heroes", logo: hometownHeroesLogo }
      : SIGNATURE_ART[player.name]
        ? { short: "SIG", name: "Signature Series", logo: null }
        : { short: "GG", name: "Base Program", logo: baseProgramLogo };

  if (compact) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && onClick) {
            e.preventDefault();
            onClick();
          }
        }}
        aria-label={`${player.name}, ${player.overall} overall ${player.position}`}
        className={cn(
          "group relative h-[150px] w-full cursor-pointer overflow-hidden rounded-sm border-2 bg-black shadow-[0_8px_18px_rgba(0,0,0,0.55)] transition-transform hover:-translate-y-0.5",
          rarityBg[player.rarity],
          compactFrame[player.rarity],
          selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
          className,
        )}
      >
        {hasSignatureArt ||
        isBaseProspect ||
        (player.rarity !== "gold" && player.rarity !== "elite") ? (
          <img
            src={art}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle,oklch(0.30_0.08_80),oklch(0.10_0.02_260))] font-display text-4xl text-white/60">
            {player.position}
          </div>
        )}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.50),transparent_38%,rgba(0,0,0,0.08)_58%,rgba(0,0,0,0.68)_100%)]" />

        <div
          title={promo.name}
          className="absolute left-1 top-1 grid h-6 w-6 place-items-center p-0.5 font-display text-[6px] tracking-wide text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)]"
        >
          {promo.logo ? (
            <img src={promo.logo} alt="" className="h-full w-full object-contain" />
          ) : (
            promo.short
          )}
        </div>

        <div className="absolute -right-0.5 top-1 flex w-7 flex-col items-center text-center drop-shadow-[0_2px_3px_rgba(0,0,0,0.95)]">
          <div className="font-display text-[15px] leading-[0.85] text-white">{player.overall}</div>
          <div className="mt-0.5 w-full font-display text-[8px] uppercase leading-none tracking-normal text-white/90">
            {player.position}
          </div>
        </div>

        <div
          className={cn(
            "absolute inset-x-0 bottom-0 border-t px-2 py-1.5 text-left shadow-[0_-3px_12px_rgba(0,0,0,0.45)]",
            compactNameplate[player.rarity],
          )}
        >
          <div
            className="text-balance break-words font-display text-[8px] uppercase leading-[0.9] tracking-[0.04em] text-white drop-shadow sm:text-[9px]"
            title={player.name}
          >
            {player.name}
          </div>
          <div className="mt-1 flex items-center justify-between font-display text-[7px] uppercase tracking-[0.12em] text-white/75">
            <span>{rarityLabel[player.rarity]}</span>
            <span>♥ {player.fanValue}</span>
          </div>
        </div>
      </div>
    );
  }

  const minHeight = 260;

  return (
    <div
      className={cn(
        "card-flip-scene w-full",
        mobileDense ? "h-[132px] min-[390px]:h-[148px] sm:h-[260px]" : "h-[260px]",
        className,
      )}
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
        style={{ minHeight: mobileDense ? undefined : minHeight }}
      >
        {/* FRONT */}
        <div
          className={cn(
            "card-flip-face overflow-hidden rounded-xl border border-white/10 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.7)] transition-transform",
            rarityBg[player.rarity],
            !onClick && "hover:-translate-y-0.5",
          )}
        >
          <div className="m-[2px] rounded-[calc(var(--radius)-2px)] h-full flex flex-col overflow-hidden relative">
            <div className="absolute inset-0">
              {hasSignatureArt ||
              isBaseProspect ||
              (player.rarity !== "gold" && player.rarity !== "elite") ? (
                <img
                  src={art}
                  alt={`${player.name} art`}
                  loading="lazy"
                  className="h-full w-full object-cover object-center"
                />
              ) : (
                <div className="h-full w-full bg-[radial-gradient(ellipse_at_center,oklch(0.28_0.06_80)_0%,oklch(0.14_0.02_260)_70%,oklch(0.08_0.01_260)_100%)] flex items-center justify-center">
                  <div className="text-center px-4">
                    <div className="font-display text-5xl text-gradient-gold opacity-90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                      {player.position}
                    </div>
                    <div className="mt-2 text-[9px] uppercase tracking-widest text-white/50">
                      Signature art
                    </div>
                    <div className="text-[9px] uppercase tracking-widest text-white/40">
                      Coming soon
                    </div>
                  </div>
                </div>
              )}
              {player.name === 'Breck "Coach Razor" Guthrie' && (
                <div className="absolute right-1 top-[38%] translate-y-[-50%] rotate-6 rounded-sm border border-[oklch(0.85_0.17_25)]/80 bg-black/60 px-1.5 py-0.5 font-display text-[9px] uppercase tracking-[0.2em] text-[oklch(0.9_0.17_25)] shadow-[0_1px_4px_rgba(0,0,0,0.6)]">
                  Check Razor
                </div>
              )}
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.55)_0%,rgba(0,0,0,0.05)_35%,rgba(0,0,0,0.15)_60%,rgba(0,0,0,0.9)_100%)]" />
            </div>

            <div
              className={cn(
                "relative z-10 flex h-full flex-col",
                mobileDense ? "p-1.5 sm:p-3" : "p-3",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div
                  title={promo.name}
                  className={cn(
                    "grid shrink-0 place-items-center drop-shadow-[0_3px_5px_rgba(0,0,0,0.9)]",
                    mobileDense ? "h-6 w-6 p-0.5 sm:h-10 sm:w-10 sm:p-1" : "h-10 w-10 p-1",
                  )}
                >
                  {promo.logo ? (
                    <img
                      src={promo.logo}
                      alt={`${promo.name} logo`}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <span className="font-display text-[10px] tracking-wide text-white">
                      {promo.short}
                    </span>
                  )}
                </div>
                <div
                  className={cn(
                    "mt-0 flex shrink-0 flex-col items-center text-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]",
                    mobileDense ? "-mr-1 w-7 sm:-mr-3 sm:w-12" : "-mr-3 w-12",
                  )}
                >
                  <div
                    className={cn(
                      "font-display leading-none text-white",
                      mobileDense ? "text-lg sm:text-3xl" : "text-3xl",
                    )}
                  >
                    {player.overall}
                  </div>
                  <div
                    className={cn(
                      "mt-0.5 w-full font-display uppercase leading-none tracking-normal text-white/90",
                      mobileDense ? "text-[7px] sm:text-xs" : "text-xs",
                    )}
                  >
                    {player.position}
                  </div>
                </div>
              </div>

              <div className="flex-1" />

              <div className="mt-2">
                <div
                  className={cn(
                    "break-words font-display leading-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]",
                    mobileDense ? "line-clamp-2 text-[8px] sm:text-lg" : "text-base sm:text-lg",
                  )}
                >
                  {player.name}
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px]">
                  <span className="text-white/60 uppercase tracking-widest text-[9px]">
                    {player.position}
                  </span>
                  <span className="text-[oklch(0.85_0.18_25)] font-semibold drop-shadow">
                    ❤️ {player.fanValue}
                  </span>
                </div>
              </div>

              {!onClick && !compact && (
                <div className="mt-1 text-center text-[9px] uppercase tracking-widest text-white/60 opacity-0 group-hover:opacity-80 transition-opacity hidden sm:block">
                  Tap to flip
                </div>
              )}
            </div>
          </div>
          <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity shimmer-overlay" />
          {(player.rarity === "gold" || player.rarity === "elite") && (
            <div className="pointer-events-none absolute inset-0 gold-shimmer-overlay opacity-40" />
          )}
        </div>

        {/* BACK */}
        <div
          className={cn(
            "card-flip-face card-flip-back overflow-hidden rounded-xl border border-white/10 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.7)]",
            rarityBg[player.rarity],
          )}
        >
          <div
            className={cn(
              "m-[2px] flex h-full flex-col rounded-[calc(var(--radius)-2px)] bg-background/90 backdrop-blur-sm",
              mobileDense ? "gap-1 p-1.5 sm:gap-2 sm:p-3" : "gap-2 p-3",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div
                  className={cn(
                    "uppercase tracking-widest text-muted-foreground",
                    mobileDense ? "text-[6px] sm:text-[10px]" : "text-[10px]",
                  )}
                >
                  {rarityLabel[player.rarity]} · {player.position}
                </div>
                <div
                  className={cn(
                    "break-words font-display leading-tight",
                    mobileDense ? "line-clamp-2 text-[8px] sm:text-base" : "text-sm sm:text-base",
                  )}
                >
                  {player.name}
                </div>
              </div>
              <div
                className={cn(
                  "font-display text-gradient-gold leading-none",
                  mobileDense ? "text-base sm:text-2xl" : "text-2xl",
                )}
              >
                {player.overall}
              </div>
            </div>

            <div className={cn("space-y-1.5", mobileDense && "hidden sm:block")}>
              <StatBar label="Overall" value={player.overall} tone="gold" />
              <StatBar label="Strength" value={player.strength} tone="red" />
              <StatBar label="Speed" value={player.speed} tone="cyan" />
              <StatBar label="IQ" value={player.iq} tone="violet" />
              {player.signature && (
                <StatBar
                  label={player.signature.label}
                  value={player.signature.value}
                  tone="emerald"
                />
              )}
              <StatBar label="Popularity" value={player.popularity} tone="pink" />
            </div>

            {mobileDense && (
              <div className="grid grid-cols-2 gap-0.5 sm:hidden">
                <MiniStat label="STR" value={player.strength} />
                <MiniStat label="SPD" value={player.speed} />
                <MiniStat label="IQ" value={player.iq} />
                <MiniStat label="POP" value={player.popularity} />
                <MiniStat label="FAN" value={player.fanValue} />
                <MiniStat
                  label={player.signature?.label.slice(0, 4).toUpperCase() ?? "SIG"}
                  value={player.signature?.value ?? player.overall}
                />
              </div>
            )}

            <div
              className={cn(
                "mt-auto grid grid-cols-2 gap-2 pt-1",
                mobileDense ? "text-[6px] sm:text-[10px]" : "text-[10px]",
              )}
            >
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

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-sm bg-white/[0.07] px-1 py-0.5 leading-none">
      <span className="truncate text-[5px] tracking-wide text-muted-foreground">{label}</span>
      <span className="font-display text-[8px]">{value}</span>
    </div>
  );
}

const TONE: Record<string, string> = {
  gold: "bg-[oklch(0.82_0.16_82)]",
  red: "bg-[oklch(0.68_0.2_25)]",
  cyan: "bg-[oklch(0.75_0.15_210)]",
  violet: "bg-[oklch(0.7_0.2_300)]",
  pink: "bg-[oklch(0.75_0.18_355)]",
  emerald: "bg-[oklch(0.75_0.17_160)]",
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
