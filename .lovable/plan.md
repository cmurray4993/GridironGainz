## Goal
Generate 8 cinematic character portraits — one recurring "base athlete" per position — and use them as the default card art for Bronze and Silver cards. Gold and Elite cards will render without art (empty portrait slot) until unique custom players are added later.

## Character brief (per position)
Each character has a unique face, hairstyle, skin tone, and personality, with a consistent jersey design across the roster (dark navy + gold accents to match the Fourth & Fortune palette). Stylized cartoon-illustration style like the reference upload, but framed cinematically over a moody stadium-lit background.

- **QB** — athletic build, confident, throwing glove, short hair, team jersey
- **RB** — compact muscular build, aggressive, powerful legs, arm sleeve
- **WR** — lean athletic build, fast stance, confident smile, gloves
- **OL** — very large muscular build, broad shoulders, serious, thick neck
- **DL** *(user to fill in later — default: massive frame, snarling intensity, eye black, torn sleeves)*
- **LB** — powerful athletic build, intense, defensive stance
- **DB** — lean explosive build, alert, speed-focused physique
- **K** *(user to fill in later — default: lean, focused, calm expression, kicking cleat forward)*

Each image saved to `src/assets/art/{pos}.jpg` (overwriting existing position art) at 1024x1024, standard quality.

## Card art wiring
In `src/components/PlayerCard.tsx`:
- Bronze and Silver cards → render the position character from `POSITION_ART` (current behavior, new images).
- Gold and Elite cards → **do not render the position image**. Instead show a subtle placeholder (dark gradient panel with the position glyph and a small "Custom art coming soon" caption) so those slots feel intentionally reserved for unique athletes later.
- Keep the gold-shimmer overlay on Gold/Elite so they still feel premium.
- No changes to stats, back-of-card, flip behavior, or rarity logic.

## Out of scope
- No new positions (TE not added).
- No changes to player generation, rarity thresholds, or sim.
- Gold/Elite custom character art will be generated later per player.

## Technical notes
- Use `imagegen--generate_image` with `model: "standard"` for each of the 8 positions, `transparent_background: false`, JPG output.
- Prompts will share a style suffix: "stylized cartoon illustration, thick clean outlines, cinematic stadium lighting, dark navy and gold team jersey, moody rim light, dramatic low-angle framing, painterly shading, high detail, portrait framing centered on character."
- After images regenerate, edit `PlayerCard.tsx` front face so `player.rarity === "gold" || "elite"` skips the `<img>` and renders the reserved-slot panel instead.
