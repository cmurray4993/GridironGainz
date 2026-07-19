import { createFileRoute } from "@tanstack/react-router";
import { LegalDocument, LegalSection } from "@/components/LegalDocument";

export const Route = createFileRoute("/rules")({
  component: Rules,
  head: () => ({ meta: [{ title: "Contest Rules — Gridiron Gainz" }] }),
});

function Rules() {
  return (
    <LegalDocument title="Gridiron Gainz Closed-Beta Contest Rules" effective="July 19, 2026">
      <LegalSection title="1. No real-value prizes in beta">
        <p>
          The current beta runs only on Solana devnet. All displayed SOL, Coins, Gridiron Cash,
          cards, marketplace amounts, and rewards are test values with no cash value. No purchase is
          necessary, and test purchases do not fund any prize.
        </p>
      </LegalSection>
      <LegalSection title="2. Eligibility">
        <p>
          Participants must be adults able to form a binding contract and located where
          participation is lawful. Employees, contractors, household members, sanctioned persons,
          and users in excluded jurisdictions may be restricted under final rules.
        </p>
      </LegalSection>
      <LegalSection title="3. Season format">
        <p>
          A season has seven scheduled regular-season games followed by three playoff rounds for
          qualifying teams. Official schedules, lineup locks, simulations, tiebreakers, standings,
          and results are generated and stored by the server.
        </p>
      </LegalSection>
      <LegalSection title="4. Fair play">
        <p>
          One person may not coordinate multiple accounts, automate play, exploit bugs, manipulate
          matchmaking or markets, collude, falsify identity or location, or interfere with another
          user. The operator may investigate, disqualify, reverse test results, and preserve
          evidence.
        </p>
      </LegalSection>
      <LegalSection title="5. Future prize contests">
        <p>
          No real-value contest may be enabled until separate official rules identify the sponsor,
          eligible locations, free entry method, start and end times, lineup rules, prize amounts
          and values, winner-selection method, odds, verification, tax responsibilities, and a
          legally reviewed skill-contest structure.
        </p>
        <p>
          Any future prize pool must be fixed and sponsor-funded. It may not automatically increase
          based on pack or Gridiron Cash purchases.
        </p>
      </LegalSection>
      <LegalSection title="6. Errors and disputes">
        <p>
          Obvious display errors do not create an entitlement. Server records control over browser
          displays. The operator contact, governing law, dispute process, and jurisdiction
          exclusions remain launch blockers requiring qualified counsel.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
