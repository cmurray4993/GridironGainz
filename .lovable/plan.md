Plan:

1. Stop loading wallet libraries on every page
- Remove the global Solana wallet wrapper from the root app shell.
- This keeps Home/auth from importing the Solana stack during startup, so the app can finish loading normally.

2. Make the wallet page client-only
- Move Phantom/Solflare provider setup and wallet transaction logic behind a hydrated client-only wrapper on `/wallet`.
- Keep the `/wallet` route itself lightweight so the rest of the app does not crash if wallet libraries have a browser/runtime issue.

3. Add the needed browser polyfill locally
- Add a small browser-only `Buffer` setup before the Solana client code runs, because the recent runtime error points to a missing `Buffer.from` path inside the wallet/Solana bundle.
- Do this only for the wallet feature, not globally across the whole app.

4. Add a safe wallet fallback
- If Phantom/Solflare code still fails to initialize, show a clear wallet-unavailable panel on `/wallet` instead of leaving the entire app stuck on “Loading…”.

5. Verify
- Flush the preview and confirm `/` loads past the Loading screen.
- Open `/wallet` and confirm the wallet UI renders or shows the fallback, without breaking Home/auth.