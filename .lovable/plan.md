## Goals
1. Only Kickers can kick field goals in game sim.
2. Add a position-unique attribute to every player card (shown on back, factored lightly into sim).

## Changes

### 1. Kicker-only field goals (`src/lib/game/sim.ts`)
- Change `driveResult` scoring so a "fg" outcome only happens if the offense has a K on the roster; that K is credited with the FG (touches/fgs), separate from the drive's offensive skill player.
- If no K is rostered, an FG-range outcome becomes a punt (0 pts) instead.
- TDs still go to QB/RB/WR/TE/OL as today.

### 2. Position-unique attribute

Add a new field `signature: { key: string; label: string; value: number }` on `Player` (computed at generation from overall ± jitter, 40–99). Mapping:

| Pos | Attribute |
|-----|-----------|
| QB  | Accuracy |
| RB  | Vision |
| WR  | Route Running |
| TE  | Blocking |
| OL  | Pass Protection |
| DL  | Pass Rush |
| LB  | Tackling |
| DB  | Coverage |
| K   | Leg Power |

Files:
- `src/lib/game/types.ts` — add `POSITION_SIGNATURE` map + `signature` field on `Player`.
- `src/lib/game/generate.ts` — populate `signature` for random players and for every entry in `SIGNATURES` (signature players get a fixed value so all copies match).
- `src/components/PlayerCard.tsx` — show the attribute on the back of the card next to STR/SPD/IQ.
- `src/lib/game/sim.ts` — small bonus: add `signature.value * 0.15` into `playerRating`, and specifically use K's Leg Power to influence FG success.
- `src/lib/game/store.ts` (if needed) — bump state version so older rosters get the new field backfilled on load (or backfill on read to avoid a reset).

### Notes
- Backfill (not a reset): on load, any roster player missing `signature` gets one derived from their overall + position, so existing test accounts don't lose cards.
- Sim tuning stays subtle — position weights (STR/SPD/IQ) remain the dominant factor; signature attr is a small nudge.
