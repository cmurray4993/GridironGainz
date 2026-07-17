Restyle the Offense lineup in `src/routes/roster.tsx` to a Madden-style formation and swap the slot mix. Defense unchanged.

## New offense slots (7 total)

Replace current offense slots with: `QB, RB, FLEX, WR1, WR2, TE, OL`.

- Remove `K` from the offense grid. Kicker stays as its own slot used only by the sim for field goals — surface it on the Defense/Special screen (append `K` to that tab so all 15 slots stay assignable).
- `FLEX` accepts any RB, WR, or TE, giving players room for strategy (extra WR for a spread look, second RB for power, second TE for heavy sets). Add `slotPosition("FLEX")` returning that union and update the picker/auto-fill filter in `roster.tsx` to allow those three positions. Sim reads `player.position` on the FLEX card, so no engine change needed.

## Formation layout (matches reference)

```
Front line:   [WR1]   [TE]   [OL]   [WR2]
Backfield:         [RB]   [QB]   [FLEX]
```

- Front row: 4 cards evenly spaced.
- Backfield: 3 cards centered in shotgun, QB in the middle.
- Compact card size, no stretching; tighten row gaps so it reads as a formation.
- Darken the field background and add a subtle stadium vignette for the moody arena feel from the reference.

## Migration

In `src/lib/game/store.ts` load(): drop any offense `K` assignment (kicker moves to the K slot on defense/special). Map prior `RB1` → `RB` and `RB2` → `FLEX`. Bump the state version so stale layouts don't wedge the new grid.

## Scope

- Files: `src/lib/game/types.ts` (slot list + `slotPosition` FLEX handling), `src/lib/game/store.ts` (migration + version bump), `src/routes/roster.tsx` (formation cells, picker filter, defense tab adds K), `src/routes/game.tsx` (lineup summary labels).
- No changes to card art, pack logic, economy, or scoring math.
