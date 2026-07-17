
## Add Solana wallet connect + fund deposits

Wire Phantom and Solflare into Fourth & Fortune so GMs can connect a wallet, see their SOL balance, and deposit SOL (with a USD-equivalent readout) into the game's treasury wallet. Deposits credit an in-game SOL balance used alongside coins for future SOL-priced features (season prizes, promo packs, etc).

### 1. Dependencies
- Add `@solana/web3.js`, `@solana/wallet-adapter-react`, `@solana/wallet-adapter-react-ui`, `@solana/wallet-adapter-wallets`, `@solana/wallet-adapter-base`.

### 2. Provider wiring
- New `src/lib/solana/WalletProvider.tsx` wrapping `ConnectionProvider` + `WalletProvider` + `WalletModalProvider`. Configured with **Phantom** and **Solflare** adapters on **mainnet-beta** by default (env-overridable), autoConnect on.
- Wrap children inside `src/routes/__root.tsx` so the whole app can call wallet hooks. Import wallet-adapter UI CSS in `src/styles.css` (kept at top, before `@theme`).

### 3. State: SOL balance in game store
- Extend `GameState` in `src/lib/game/types.ts` with `sol: number` (in-game deposited SOL, default 0) and `walletAddress?: string` (last connected pubkey, for display only — actual auth stays with Supabase).
- Add `addSol(amount)` and `setWalletAddress(addr)` actions in `src/lib/game/store.ts` with persistence.

### 4. Wallet route: `/wallet`
New `src/routes/wallet.tsx` (linked from TopBar with a small wallet chip and from Home). Shows:
- **Connect button** (uses `WalletMultiButton` styled to match the gold theme) — opens the adapter modal listing Phantom + Solflare, plus a "not installed" fallback with install links.
- **Connected panel**: truncated pubkey, on-chain SOL balance (via `connection.getBalance`), live USD estimate (fetched from CoinGecko simple price endpoint, cached 60s), disconnect button.
- **Deposit card**:
  - Input in SOL with a USD-equivalent preview and quick chips (0.05 / 0.1 / 0.5 / 1 SOL).
  - "Deposit" builds a `SystemProgram.transfer` from the connected wallet to a treasury pubkey (env `VITE_TREASURY_WALLET`), signs via the adapter, sends through the configured RPC, awaits confirmation, then calls `addSol(amount)` and toasts the signature (with a Solscan link).
  - If `VITE_TREASURY_WALLET` is unset, show an inline "Treasury not configured yet — ask the app owner to set the treasury address" state instead of a broken button.
- **In-game balance strip**: shows current `state.sol` (◎) and coins so it's clear deposits credited.

USD-only deposits (card/ACH) are out of scope for this pass — on-chain rails only. The USD numbers shown are conversion estimates from the SOL price feed. We can layer a fiat on-ramp (MoonPay/Coinbase Onramp/Stripe crypto) in a follow-up.

### 5. Home + TopBar integration
- `src/components/Layout.tsx` TopBar: small wallet pill — "Connect wallet" when disconnected, `◎ {sol}` + truncated address when connected, links to `/wallet`.
- `src/routes/index.tsx`: add a compact "Wallet" tile next to the claim tile showing in-game SOL and a Connect/Deposit CTA.

### 6. Config
- Add `VITE_SOLANA_NETWORK` (default `mainnet-beta`), `VITE_SOLANA_RPC` (optional custom RPC, falls back to `clusterApiUrl`), and `VITE_TREASURY_WALLET` to `.env`. Treasury address left blank for the user to fill in — the UI degrades gracefully until it's set.

### Notes
- All wallet auth stays client-side; no private keys ever touch the server. Supabase auth is unchanged.
- Balances (in-game SOL) live in the same per-user localStorage save as coins for now, matching how coins work today. A future migration to Lovable Cloud would move both together.
- No changes to pack pricing, standings, or sim logic in this pass — just adds the wallet + deposit surface.
