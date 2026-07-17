Update the `PlayerCard` component so the front face only shows the Fan Value indicator (❤️ {player.fanValue}) and no longer shows the popularity badge (⭐ Pop {player.popularity}). Keep the Popularity stat bar on the back of the card unchanged.

**Technical detail:**
- In `src/components/PlayerCard.tsx`, remove the `<span>` containing `⭐ Pop {player.popularity}` inside the front-face bottom row. Restructure the remaining row so the Fan Value indicator stays centered or right-aligned as appropriate, and remove any layout classes that were only needed for the two-element split.