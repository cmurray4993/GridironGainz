import { createFileRoute, Link } from "@tanstack/react-router";
export const Route = createFileRoute("/terms")({
  component: Terms,
  head: () => ({ meta: [{ title: "Beta User Agreement — Gridiron Gainz" }] }),
});
const sections = [
  [
    "1. Acceptance and eligibility",
    "By creating an account or using Gridiron Gainz, you agree to this Agreement. This beta is intended only for people who are at least 18 and able to form a binding contract. Do not use the beta where prohibited by law.",
  ],
  [
    "2. Beta and testnet status",
    "Gridiron Gainz is unfinished testing software. Features, balances, cards, seasons, odds, and availability may change or be reset. Any SOL feature is currently devnet-only. Devnet SOL has no real-world monetary value.",
  ],
  [
    "3. Accounts and wallets",
    "You are responsible for accurate account information, password security, wallet security, seed phrases, and activity performed through your account or connected wallet. We will never ask for your seed phrase. Notify the operator promptly of suspected unauthorized access.",
  ],
  [
    "4. Game license and virtual items",
    "The operator grants you a limited, personal, revocable, non-transferable license to use the game. Cards, Coins, Gridiron Cash, fans, and other game items are licensed game features—not ownership interests, securities, deposits, or property rights. Except where a lawful marketplace feature expressly permits it, they have no cash value or redemption right.",
  ],
  [
    "5. Coins, Gridiron Cash, and SOL",
    "Coins and Gridiron Cash are game currencies, not cryptocurrencies or investments. No return, appreciation, liquidity, or profit is promised. Wallet and blockchain activity can involve network failures, irreversible transactions, scams, and software risks. Future mainnet or paid functionality will require updated terms and notices before launch.",
  ],
  [
    "6. Packs and randomized content",
    "Packs contain randomized virtual cards. A purchase guarantees only the contents described for that pack, not a particular player, rarity, competitive result, resale value, or future usefulness. Published odds may be adjusted prospectively for game balance and will be disclosed in the game.",
  ],
  [
    "7. Auction House",
    "Users may list, bid on, and buy eligible cards under the displayed rules. A bid may hold the bidder’s Coins. When outbid, or when another user completes a Coin or SOL Buy Now purchase, the held Coins are returned automatically. Completed sales close every sale option on that listing. Attempts to manipulate prices, wash trade, evade minimums, or exploit settlement are prohibited.",
  ],
  [
    "8. Payments and refunds",
    "All prices and fees must be shown before confirmation. Blockchain network fees may be separate and irreversible. Except where required by law or where the operator confirms a technical billing error, completed purchases are final. Chargebacks or payment disputes may lead to account restrictions while investigated.",
  ],
  [
    "9. Fair play and prohibited conduct",
    "Do not use bots, cheats, exploits, unauthorized automation, deceptive listings, stolen payment methods, multiple accounts to gain an unfair advantage, harassment, market manipulation, reverse engineering, or attacks on the game or other users. Report vulnerabilities rather than exploiting them.",
  ],
  [
    "10. Intellectual property and feedback",
    "Gridiron Gainz software, original art, names, logos, rules presentation, and other content belong to the operator or its licensors. No affiliation with the NFL, EA, Madden, teams, colleges, or real athletes is claimed. Feedback may be used without payment or obligation.",
  ],
  [
    "11. Suspension and termination",
    "The operator may investigate, suspend, reverse improper in-game transactions, remove listings, or terminate accounts for violations, fraud, security threats, legal requirements, or material risk to the game. You may stop using the game at any time.",
  ],
  [
    "12. Availability and changes",
    "The game is provided as available. Maintenance, outages, bugs, data loss, season resets, balance changes, and feature removal may occur. Material changes to this Agreement will be posted with an updated effective date.",
  ],
  [
    "13. Disclaimers and limitation of liability",
    "TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE BETA IS PROVIDED AS IS AND AS AVAILABLE WITHOUT WARRANTIES. THE OPERATOR IS NOT LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, LOST PROFITS, LOST DATA, WALLET LOSS, OR MARKET LOSS. RIGHTS THAT CANNOT LEGALLY BE DISCLAIMED ARE NOT AFFECTED.",
  ],
  [
    "14. Indemnity",
    "To the extent permitted by law, you agree to defend and indemnify the operator from claims arising from your unlawful use, your content or listings, your violation of this Agreement, or infringement of another person’s rights.",
  ],
  [
    "15. Governing law and disputes",
    "Governing law, venue, dispute process, and any arbitration or class-action terms must be completed and reviewed by qualified counsel before paid or mainnet launch.",
  ],
  [
    "16. Operator and contact",
    "Operator legal name: [REQUIRED]. Contact email and mailing address: [REQUIRED]. Governing law and venue: [REQUIRED].",
  ],
] as const;
function Terms() {
  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <main className="mx-auto max-w-3xl">
        <Link to="/auth" className="text-sm text-primary">
          ← Back
        </Link>
        <div className="mt-5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
          <b>Beta legal draft — attorney review required.</b> Complete the operator, contact, and
          governing-law fields before accepting money or enabling mainnet activity.
        </div>
        <h1 className="mt-7 font-display text-4xl text-gradient-gold">
          Gridiron Gainz Beta User Agreement
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Effective July 19, 2026</p>
        <div className="mt-8 space-y-7">
          {sections.map(([title, body]) => (
            <section key={title}>
              <h2 className="font-display text-2xl">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
