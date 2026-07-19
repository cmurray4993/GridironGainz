import { createFileRoute } from "@tanstack/react-router";
import { LegalDocument, LegalSection } from "@/components/LegalDocument";

export const Route = createFileRoute("/purchase-policy")({
  component: PurchasePolicy,
  head: () => ({ meta: [{ title: "Purchase Policy — Gridiron Gainz" }] }),
});

function PurchasePolicy() {
  return (
    <LegalDocument title="Gridiron Gainz Beta Purchase Policy" effective="July 19, 2026">
      <LegalSection title="1. Beta transactions">
        <p>
          Only devnet testing is enabled. Devnet SOL and test Gridiron Cash have no real-world
          monetary value. Do not send real mainnet SOL to a displayed test address. Mainnet purchase
          code is disabled by independent client and server launch gates.
        </p>
      </LegalSection>
      <LegalSection title="2. Randomized packs">
        <p>
          Before opening a pack, the store shows the currency cost, number of cards, slot
          guarantees, rarity probabilities, and odds version. Each completed opening permanently
          records the odds version used. A pack does not guarantee competitive success, resale
          value, or a particular card unless expressly stated.
        </p>
      </LegalSection>
      <LegalSection title="3. Confirmation and duplicate protection">
        <p>
          The server verifies affordability, deducts currency, creates cards, and records results as
          one controlled operation. A unique request identifier prevents retrying the same request
          from charging or granting twice.
        </p>
      </LegalSection>
      <LegalSection title="4. Refunds and technical errors">
        <p>
          Test currency has no redemption or refund value. Failed test transactions do not grant GC.
          For any future paid launch, the operator must publish the legal entity, contact details,
          refund process, regional cancellation rights, blockchain-fee treatment, and support
          response procedure before accepting value.
        </p>
      </LegalSection>
      <LegalSection title="5. No purchase-funded prizes">
        <p>
          Purchases are accounted for separately from contests. Neither the amount nor frequency of
          a purchase changes a season prize pool. The former 60/20/20 automatic purchase allocation
          is disabled.
        </p>
      </LegalSection>
      <LegalSection title="6. Marketplace">
        <p>
          Coin and SOL marketplace features remain test-only. Before real-value trading, identity,
          sanctions, location, custody, money-transmission, tax reporting, marketplace fee, dispute,
          and consumer-protection requirements must be reviewed and implemented.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
