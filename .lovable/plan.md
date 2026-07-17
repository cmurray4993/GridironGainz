## Fix: card back text bleeding through the front

**Root cause:** In `src/styles.css`, `card-flip-face` sets `backface-visibility: hidden` but the front face has no explicit `transform`. Combined with child elements that create their own stacking/rendering contexts (the `<img>`, the gradient overlays, the shimmer layers), Chrome and mobile Safari fail to hide the back face — you see the mirrored "BRONZE / EMMITT VAUGHN / 60" from the back leaking through.

**Change (CSS only, in `src/styles.css`):**

1. Give the front face an explicit `transform: rotateY(0deg)` so both faces are 3D-transformed siblings — backface culling only works reliably when both faces have a transform.
2. Add `-webkit-transform: rotateY(...)` variants for iOS Safari.
3. Add `transform-style: preserve-3d` to `card-flip-face` so nested absolutely-positioned children inherit the 3D context instead of flattening.
4. Add `will-change: transform` to `card-flip-inner` to promote it to its own compositor layer (prevents subpixel bleed during the flip).

No component code changes, no behavior changes — just a CSS patch to the four `@utility` blocks at the bottom of `src/styles.css`.

## Out of scope

The nested-`<button>` hydration warning on `/lineup` is a separate issue and is not addressed here.
