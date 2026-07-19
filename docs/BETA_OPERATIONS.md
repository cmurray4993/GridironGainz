# Closed beta operations runbook

Status: **devnet testing only**. This runbook does not authorize mainnet, paid contests, or prizes with cash value.

## Release ownership

Before inviting testers, assign named people for deployment, treasury access, support, security incidents, database recovery, and daily reconciliation. Use a dedicated devnet treasury wallet. Do not use a personal everyday wallet, store a seed phrase in Supabase/Lovable/GitHub, or share one login between collaborators.

## Required beta configuration

Browser variables belong in the hosting environment and are listed in `.env.example`. Supabase Edge Function secrets must be set separately:

- `SOLANA_NETWORK=devnet`
- `SOLANA_RPC_URL=https://api.devnet.solana.com` or a trusted devnet RPC
- `TREASURY_WALLET=<dedicated devnet public address>`
- `SEASON_PROCESSOR_SECRET=<long randomly generated secret>`
- `ENABLE_MAINNET_COMMERCE=false`
- `LEGAL_REVIEW_COMPLETE=false`
- `TAX_REVIEW_COMPLETE=false`
- `SECURITY_REVIEW_COMPLETE=false`
- `MARKETPLACE_SOL_REVIEW_COMPLETE=false`

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are supplied only to server functions. The service-role key must never use a `VITE_` prefix and must never appear in browser code.

## Database deployment sequence

1. Export a database backup and record the current migration state.
2. Run `npx supabase db push --dry-run --linked` and review the complete migration plan.
3. Run `npx supabase db lint --linked` and resolve every security or SQL error.
4. Test the migrations in a separate Supabase test project before the shared beta project.
5. Deploy migrations with `npx supabase db push --linked` only after the dry run, lint, and backup succeed.
6. Regenerate Supabase TypeScript types after deployment.
7. Deploy `gridiron-cash`, `marketplace`, and `season-processor` Edge Functions.
8. Configure a server-side scheduler to invoke `season-processor` with `Authorization: Bearer <SEASON_PROCESSOR_SECRET>`. Never put that secret in the browser.
9. Run the security tests in `docs/SECURITY_TEST_PLAN.md` before inviting testers.

The remote dry run and deployment are intentionally manual because they affect shared data. Never use a destructive reset against the linked project.

## Daily checks

- Confirm the app and both wallet functions report devnet.
- Confirm the displayed treasury matches the server-created payment intent.
- Review failed logins, failed pack openings, repeated request IDs, unusual bids, rapid account creation, and repeated settlement attempts.
- Reconcile confirmed test signatures to the devnet treasury and the immutable transaction export.
- Check the season processor ran once and did not duplicate games or rewards.
- Review support reports and record every incident and operator action.

## Incident response

If a payment, ownership, reward, authorization, or data-integrity issue is suspected:

1. Stop new tester invitations and unpublish the affected UI if necessary.
2. Disable the affected Edge Function or revoke its deploy secret.
3. Keep `real_money_enabled=false` and all mainnet environment flags false.
4. Preserve logs, signatures, request IDs, database audit records, timestamps, and the deployed commit.
5. Do not edit or delete ledger history. Record corrections as new reversing entries after review.
6. Identify affected accounts and transactions, communicate plainly, and document the resolution.
7. Restore service only after reproducing the issue and completing regression tests.

## Backup and access controls

- Enable Supabase backups appropriate for the beta and test a restore into a separate project.
- Require individual GitHub/Supabase/Lovable accounts with least-privilege access and multi-factor authentication.
- Limit service-role and Edge Function deployment access to the smallest possible group.
- Rotate exposed secrets immediately and document the time and scope of rotation.
- Keep production/mainnet configuration in a separate environment from devnet.

## Mainnet prohibition

Do not switch the network, enable SOL marketplace settlement, accept valuable payments, or advertise prizes until every item in `docs/MAINNET_LAUNCH_GATES.md` is completed and evidenced. The remaining attorney, CPA, security, operator-identity, jurisdiction, consumer-protection, and financial-compliance gates are deliberate launch blockers.
