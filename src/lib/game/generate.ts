import type { Position } from "./types";

// Display identities for the reusable Base Program artwork. Card creation,
// ratings, rarity rolls, and pack results are generated only by Supabase.
export const BASE_PROSPECT_NAMES: Record<Position, string> = {
  QB: 'Jace "Field General" Mercer',
  RB: 'Malik "Northbound" Knox',
  WR: 'Devon "Afterburner" Price',
  TE: 'Cole "Red Zone" Barrett',
  OL: 'Andre "Iron Gate" Bishop',
  DL: 'Marcus "Groundquake" Voss',
  LB: 'Darius "Heat Check" Cole',
  DB: 'Zion "No Fly" Brooks',
  K: 'Eli "Golden Leg" Ward',
  P: 'Nolan "Hangtime" Hale',
};
