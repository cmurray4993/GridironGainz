## Rebalance Backyard Heroes — Program I pack

Adjust the promo pack composition in `src/lib/game/generate.ts` so it's less overpowered while still feeling premium.

### New pack contents (5 cards, still 25,000 🪙)
- 1× Bronze or better
- 3× Silver or better
- 1× Gold or better
- Promo signature chance layered on top: each of the 5 slots has a chance to be upgraded to a signature pull, tuned so the average pack yields ~1 signature (roughly 25% per slot). This preserves the "high chance to pull a promo" feel without guaranteeing one.

### Files touched
- `src/lib/game/generate.ts` — rewrite `generateBackyardHeroPack()` to build the fixed rarity floors above, then roll per-slot signature upgrades that respect each slot's minimum rarity (a signature only replaces a slot if the signature's rarity meets that floor).

### Store copy
- `src/routes/pack.tsx` — update the Backyard Heroes `blurb` to: "1 Bronze+, 3 Silver+, 1 Gold+. High chance at a signature promo."

No other screens, costs, or systems change.