# Gridiron Gainz mainnet launch gates

Status: **BLOCKED — devnet beta only**

No one should enable mainnet payments, real-value marketplace settlement, or real-value prizes until every item below is complete and documented. A disclaimer does not satisfy these gates.

## 1. Company and responsibility

- Form the operating entity and obtain its tax identification number.
- Open dedicated company bank, wallet, bookkeeping, and support accounts.
- Name the operator, mailing address, support email, privacy contact, and contest sponsor in every legal document.
- Define who controls treasury keys, emergency pause authority, reconciliation, and refunds.
- Use a multisignature treasury or comparable separation of duties; never use a personal everyday wallet.

## 2. Gaming and promotions counsel

- Obtain a written jurisdiction-by-jurisdiction analysis of the exact loop: randomized packs, paid competitive advantages, skill simulation, auction trading, and SOL prizes.
- Decide whether real-prize competition uses standardized or salary-capped lineups that cannot be improved by purchases.
- Publish final official rules identifying sponsor, eligible locations, exclusions, free entry, dates, lineup lock, simulations, tiebreakers, prize amounts/values, verification, tax treatment, disputes, and winner list.
- Add reliable location controls and exclude every jurisdiction counsel has not approved.
- Confirm whether registrations, bonds, permits, alternative method of entry, or winner affidavits are required.

## 3. Marketplace and financial-regulation counsel

- Determine whether facilitating SOL card sales, custody, fees, bidding, refunds, or settlement creates money-transmission, marketplace, broker, virtual-currency, sanctions, or identity-verification duties.
- Decide whether SOL settlement will launch at all. Coin-only trading is the default safer release.
- If approved, implement sanctions screening, prohibited-location checks, transaction monitoring, seller/buyer records, dispute handling, and legally required reports.
- Never custody player SOL or private keys in the browser or application server.

## 4. Consumer protection and randomized packs

- Show exact price, card count, guarantees, and rarity probabilities before every opening.
- Preserve the odds version and result for every pack.
- Have counsel review pack design and disclosures for every launch jurisdiction.
- Define refund, failed-payment, duplicate-charge, account closure, support, and complaint procedures.
- Remove dark patterns, misleading “investment” language, fake scarcity, and claims about profit or future resale value.

## 5. Privacy and age

- Complete a data inventory, retention schedule, deletion workflow, vendor list, incident-response plan, and access-control review.
- Complete operator/contact details and jurisdiction-specific privacy rights.
- Keep the release adults-only unless counsel approves a child/teen design and the required parental-consent process is implemented.
- Do not collect seed phrases, private keys, unnecessary identity documents, or unnecessary location data.

## 6. Tax and accounting

- Have a CPA design bookkeeping for SOL receipts, marketplace activity, prizes, refunds, network fees, treasury transfers, and fair-market-value conversion at transaction time.
- Reconcile the internal transaction export to on-chain signatures and treasury balances on a fixed schedule.
- Determine information-reporting and withholding duties for winners, buyers, sellers, contractors, and the operator.
- Create append-only correcting entries; do not edit or delete financial history.

## 7. Security and operations

- Complete external review of authorization, row-level security, pack randomness, idempotency, season simulation, auction settlement, bid refunds, wallet-network verification, and admin permissions.
- Test that browser changes and direct API calls cannot mint cards, alter currency, change official results, or claim rewards.
- Establish backups, monitoring, rate limits, abuse controls, vulnerability reporting, incident response, and an emergency mainnet kill switch.
- Run a closed devnet beta and resolve all critical/high findings.

## 8. Required release controls

Mainnet remains off unless all four client flags, all server flags, and the database release record agree. The marketplace has an additional independent approval flag. Production deployment must fail if any value is missing.

- `ENABLE_MAINNET_COMMERCE=true`
- `LEGAL_REVIEW_COMPLETE=true`
- `TAX_REVIEW_COMPLETE=true`
- `SECURITY_REVIEW_COMPLETE=true`
- `MARKETPLACE_SOL_REVIEW_COMPLETE=true` (only if SOL marketplace settlement is approved)
- `app_release_controls.real_money_enabled=true`
- matching review booleans in `app_release_controls`

These flags record an already-completed decision. They are not the review itself.
