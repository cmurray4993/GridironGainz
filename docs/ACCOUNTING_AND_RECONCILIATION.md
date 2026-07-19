# Accounting and transaction reconciliation

This is an operational control outline for a CPA/bookkeeper to review. It is not tax advice.

## Current beta

All wallet features are devnet-only. Devnet SOL, Coins, GC, cards, sales, and rewards have no cash value. Beta records are tagged `not_applicable_testnet`; they are retained to test the audit process but must not be mixed into real books.

## Permanent records

Every confirmed Solana transaction stores:

- signature and network;
- buyer/user identifier;
- sender and destination public wallets;
- exact lamports transferred and network fee;
- slot and block time;
- business purpose and related GC or marketplace purchase;
- reconciliation status;
- USD fair-market value and price source when mainnet is ever approved.

Every Coins or GC balance change also creates an append-only ledger entry with a reason, reference type, reference ID, amount before/after, and timestamp. Corrections use a new reversing entry rather than modifying history.

## Reconciliation procedure

1. Export `financial_event_export` using a service-only administrative job.
2. Independently query Solana for every signature and verify network, sender, destination, amount, fee, slot, and finality.
3. Reconcile confirmed receipts to the dedicated treasury wallet and marketplace settlements to listing records.
4. Attach a reputable SOL/USD price and timestamp methodology approved by the CPA for each mainnet event.
5. Investigate missing, duplicate, failed, reversed, stale, or mismatched entries.
6. Record corrections as append-only journal entries with reviewer and supporting evidence.
7. Have a second person approve the reconciliation and archive the export and evidence.

Daily reconciliation is appropriate while transaction volume is low. At minimum it must occur before any payout, financial close, tax report, treasury movement, or public prize announcement.

## Records still needed before mainnet

- legal entity and tax IDs;
- chart of accounts and accounting method;
- treasury ownership and signer records;
- state/country and identity data counsel says may lawfully be collected;
- prize winner verification, tax forms, withholding, and payout evidence;
- refunds, disputes, chargebacks, promotions, fees, contractor payments, and owner withdrawals;
- retention periods and access logs;
- marketplace seller proceeds and any required information reporting.

The operator should not describe the system as “fully IRS compliant” until a CPA has approved the workflow and tested an export against actual books.
