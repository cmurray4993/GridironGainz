// Daily kickoff: 7:00 PM America/Chicago (Central Time, DST-aware).
export const KICKOFF_HOUR_CT = 19; // 7pm
export const KICKOFF_WINDOW_MS = 30 * 60 * 1000; // 30 min play window after kickoff

// Get the current wall-clock parts in America/Chicago for a given instant.
function ctParts(d: Date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  return {
    year: +parts.year, month: +parts.month, day: +parts.day,
    hour: +parts.hour === 24 ? 0 : +parts.hour,
    minute: +parts.minute, second: +parts.second,
  };
}

// Find the UTC instant that corresponds to a given Central-Time wall clock.
// Handles DST by iterative correction (2 passes is enough).
function ctWallToUTC(year: number, month: number, day: number, hour: number) {
  // Start from the naive UTC guess, then correct by the current CT offset.
  let guess = Date.UTC(year, month - 1, day, hour, 0, 0);
  for (let i = 0; i < 2; i++) {
    const p = ctParts(new Date(guess));
    const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const diff = asUTC - guess; // = offset(CT relative to UTC) in ms
    guess = guess - diff + Date.UTC(year, month - 1, day, hour, 0, 0) - Date.UTC(year, month - 1, day, hour, 0, 0);
    guess = Date.UTC(year, month - 1, day, hour, 0, 0) - diff;
  }
  return guess;
}

export function nextKickoff(now: Date = new Date()): Date {
  const p = ctParts(now);
  const todayKick = ctWallToUTC(p.year, p.month, p.day, KICKOFF_HOUR_CT);
  if (now.getTime() < todayKick) return new Date(todayKick);
  // roll to next day in CT
  const tomorrow = new Date(Date.UTC(p.year, p.month - 1, p.day + 1, 12, 0, 0));
  const tp = ctParts(tomorrow);
  return new Date(ctWallToUTC(tp.year, tp.month, tp.day, KICKOFF_HOUR_CT));
}

export interface KickoffStatus {
  kickoffAt: Date;
  msUntil: number;   // ms until next kickoff (0 while live)
  isLive: boolean;   // within KICKOFF_WINDOW_MS after kickoff
  msLeftInWindow: number; // ms left in the live window (0 when not live)
}

export function kickoffStatus(now: Date = new Date()): KickoffStatus {
  const next = nextKickoff(now);
  const p = ctParts(now);
  const todayKick = ctWallToUTC(p.year, p.month, p.day, KICKOFF_HOUR_CT);
  const sinceToday = now.getTime() - todayKick;
  const isLive = sinceToday >= 0 && sinceToday < KICKOFF_WINDOW_MS;
  return {
    kickoffAt: next,
    msUntil: isLive ? 0 : next.getTime() - now.getTime(),
    isLive,
    msLeftInWindow: isLive ? KICKOFF_WINDOW_MS - sinceToday : 0,
  };
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
