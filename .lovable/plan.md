Update the `PlayerCard` component so the front face no longer displays the small deterministic placeholder team logo in the bottom-right corner of the portrait. Keep the portrait circle and all other front/back content unchanged.

**Technical detail:**
- In `src/components/PlayerCard.tsx`, remove the `<div>` with absolute positioning that renders the `{logo}` emoji inside the front face. Remove the related `LOGOS` array and `logo` variable if they are no longer used elsewhere.