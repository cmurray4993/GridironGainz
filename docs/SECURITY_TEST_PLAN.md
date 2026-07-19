# Authoritative-game security test plan

Run these tests against a separate Supabase test project after all migrations and functions are deployed. Use at least two normal user accounts plus a service-only test operator. Preserve the test output with the deployed commit.

## Required launch result

Every test below must pass. A browser error message alone is not proof: verify the database balance, owner, result, and ledger rows did not change.

## Account and authorization

- An unauthenticated request cannot bootstrap an account, read private state, open a pack, edit a lineup, list a card, bid, buy, quick-sell, or claim Coins.
- A user who has not accepted every current legal-document version cannot use protected game mutations.
- A user cannot read another user's private roster, lineup, pack opening, reward, wallet receipt, or ledger through direct table/API calls.
- A normal user token cannot execute internal randomness, game simulation, playoff creation, settlement finalization, or season-processing helpers.
- A browser bundle contains no service-role key, processor secret, seed phrase, or private key.

## Currency and packs

- Editing local storage, React state, request payloads, or browser JavaScript cannot increase Coins or GC.
- Negative, zero, fractional, excessive, unknown-pack, unknown-currency, and invalid-position pack requests fail without changing balances.
- Reusing one pack request ID returns the original opening and charges exactly once.
- Two simultaneous requests with the same ID create one opening and one set of unique cards.
- Pack results, odds version, cost, payment currency, and card IDs are stored before the response is returned.
- Updating or deleting an opening, opening-card row, or financial ledger row is rejected.
- Published odds displayed in the UI match the version recorded on the opening.

## Lineups, fans, seasons, and rewards

- A user cannot place an unowned, listed, quick-sold, wrong-position, or duplicate card into a lineup.
- A lineup edit at or after lock cannot alter the saved result; due games are processed first.
- Only active starters contribute to fans and repeated fan-claim request IDs cannot pay twice.
- A browser cannot choose an opponent, score, winner, standings change, seed, playoff matchup, or reward.
- Running the season processor twice does not duplicate a game, reward, or ledger entry.
- Late enrollment follows the published policy and cannot enter a closed prize season.
- All twelve teams receive the intended seven regular-season games and at most one game per day.
- Wildcard, semifinal, and championship rounds advance only eligible winners and use the saved tiebreak rules.

## Auction House

- Listing payloads that alter a card's name, rarity, overall, attributes, program, owner, or art are ignored; the listing uses the authoritative card row.
- A user cannot list or quick-sell an unowned, unavailable, or starting-lineup card.
- Minimum bid and Buy Now prices are server-enforced, and Coin Buy Now must exceed the starting bid.
- A seller cannot bid on or buy their own listing.
- Two simultaneous buyers produce one winner and one ownership transfer.
- When Coin or SOL Buy Now closes an auction, every held losing bid is refunded once.
- Reusing a SOL signature for any other GC or marketplace purchase is rejected.
- Cancelling a listing with an active bid is rejected.

## Solana settlement

- The server rejects a transaction from the wrong network, sender, treasury, amount, memo, purchase, or time window.
- A payment intent freezes its treasury address; rotating the configured treasury does not redirect that pending intent.
- The treasury cannot purchase GC from itself.
- A valid devnet transaction credits exactly once even when verification is retried or invoked concurrently.
- Final ownership/currency changes and the immutable Solana receipt commit atomically.
- Mainnet requests fail while any client, Edge Function, or database release gate is false.

## Operations and recovery

- A database backup restores successfully into a separate project.
- The reconciliation export ties every test signature to one business purpose and one latest reconciliation status.
- Secrets can be rotated without rebuilding the browser bundle.
- The incident owner can disable affected server functions and preserve evidence without deleting ledger history.
- Legal source changes fail the build until a new version/hash is deliberately published.

## External review

Before any valuable mainnet activity, an independent reviewer should repeat the authorization, concurrency, randomness, settlement, and data-exposure tests. Legal and tax reviewers must separately approve the product design and operating procedures; a passing technical test does not replace those reviews.
