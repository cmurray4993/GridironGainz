import { createFileRoute } from "@tanstack/react-router";
import { LegalDocument, LegalSection } from "@/components/LegalDocument";

export const Route = createFileRoute("/privacy")({
  component: Privacy,
  head: () => ({ meta: [{ title: "Privacy Notice — Gridiron Gainz" }] }),
});

function Privacy() {
  return (
    <LegalDocument title="Gridiron Gainz Beta Privacy Notice" effective="July 19, 2026">
      <LegalSection title="1. Information collected">
        <p>
          We collect account identifiers, email address, game activity, card ownership, lineups,
          economy ledgers, marketplace activity, connected public wallet addresses, verified
          blockchain transaction identifiers, device and security logs, and legal-consent records.
        </p>
        <p>
          We do not need or request wallet seed phrases, private keys, government identification,
          precise location, or payment-card data during this devnet beta.
        </p>
      </LegalSection>
      <LegalSection title="2. Why it is used">
        <p>
          Information is used to operate accounts and seasons, prevent fraud, verify transactions,
          settle auctions, keep permanent accounting records, provide support, enforce rules, and
          comply with legal obligations.
        </p>
      </LegalSection>
      <LegalSection title="3. Service providers and public chains">
        <p>
          Supabase processes account and game data, hosting providers deliver the application, and
          wallet/RPC providers process public blockchain requests. Public wallet addresses and
          transactions are visible on Solana and cannot be made private or erased by the operator.
        </p>
      </LegalSection>
      <LegalSection title="4. Retention and deletion">
        <p>
          Account data is retained while the account is active. Security, transaction, contest, tax,
          and ledger records may be retained longer where reasonably necessary or legally required.
          A deletion request cannot erase public-chain records or records the operator must keep.
        </p>
      </LegalSection>
      <LegalSection title="5. Security and choices">
        <p>
          Access controls, server-side authorization, audit ledgers, and transaction verification
          are used to protect data. No system is perfectly secure. Users may request access,
          correction, or deletion through the operator contact once that address is completed.
        </p>
      </LegalSection>
      <LegalSection title="6. Adults-only beta and contact">
        <p>
          The beta is not directed to children and is limited to adults who have reached the age of
          majority where they live. Operator legal name, privacy email, mailing address, and
          jurisdiction-specific disclosures must be completed before public launch.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
