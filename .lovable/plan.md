## Goal
Every card at a given (position, rarity) shares one canonical name in the format `First "Descriptive" Last`. Bronze and Silver get position-themed nicknames; Gold and Elite show `Unsigned Prospect` until custom players are added.

## Name map
Add `CANONICAL_NAMES: Record<Rarity, Record<Position, string>>` in `src/lib/game/generate.ts`. Every player generated (standard pack, pro pack, migration) looks up its name from this table — no more random first/last name rolls.

```
Bronze
  QB  Buck "Strong Arm" McGee
  RB  Tank "Downhill" Briggs
  WR  Deacon "Sure Hands" Reyes
  OL  Big Moe "The Wall" Kowalski
  DL  Rocco "Trench Beast" Malone
  LB  Chip "Middle Man" Doyle
  DB  Ace "Sticky" Fontaine
  K   Boots "Doink" Sanderson

Silver
  QB  Rex "Gunslinger" Callahan
  RB  Duke "Chain Mover" Ramsey
  WR  Flash "Slot Machine" Ortega
  OL  Hoss "Anchor" Van Zandt
  DL  Bull "Sack Man" Okafor
  LB  Ryder "Sideline to Sideline" Kingsley
  DB  Neo "Ball Hawk" Vega
  K   Splits "Ice Water" Barrett

Gold   → Unsigned "Prospect" [POS]
Elite  → Unsigned "Prospect" [POS]
```

Gold/Elite use a shared placeholder like `Unsigned "Prospect" QB` so the card back still identifies the position.

## Code changes
- `src/lib/game/generate.ts`
  - Add `CANONICAL_NAMES` table above.
  - Replace `name: \`${rand(FIRST)} ${rand(LAST)}\`` in `generatePlayer` and `buildPlayerWithRarity` with a lookup: `name: canonicalName(rarity, position)`.
  - Remove the now-unused `FIRST` / `LAST` arrays.
- `src/lib/game/store.ts`
  - In the existing migration block, after normalizing rarity, overwrite `p.name` with `canonicalName(p.rarity, p.position)` so current rosters instantly reflect the new names (no need for the user to re-pull).
- Front of card and lineup slot render `player.name` as-is; the quoted nickname reads naturally.

## Out of scope
- No sim, economy, or rarity-threshold changes.
- Duplicate names are intentional (that's the "recurring character" feel you asked for).
- Gold/Elite names will be replaced when unique custom players are added later.
