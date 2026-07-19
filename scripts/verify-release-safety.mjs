import { readdir, readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const failures = [];

async function text(path) {
  return readFile(new URL(path, root), "utf8");
}

function requireText(source, expected, label) {
  if (!source.includes(expected)) failures.push(label);
}

async function sourceFiles(path) {
  const entries = await readdir(new URL(path, root), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = `${path}/${entry.name}`;
    if (entry.isDirectory()) files.push(...(await sourceFiles(child)));
    else if (/\.(?:ts|tsx|js|mjs)$/.test(entry.name)) files.push(child);
  }
  return files;
}

for (const path of await sourceFiles("src")) {
  const source = await text(path);
  if (/SUPABASE_SERVICE_ROLE_KEY|SEASON_PROCESSOR_SECRET/.test(source)) {
    failures.push(`${path} exposes a server-only secret name in browser source`);
  }
  if (
    /localStorage|sessionStorage/.test(source) &&
    path !== "src/integrations/supabase/client.ts"
  ) {
    failures.push(`${path} restores browser-authoritative persistent game state`);
  }
  const gameplaySource =
    path.startsWith("src/lib/game/") ||
    ["src/routes/game.tsx", "src/routes/pack.tsx", "src/routes/standings.tsx"].includes(path);
  if (gameplaySource && /Math\.random\s*\(/.test(source)) {
    failures.push(`${path} contains browser-side gameplay randomness`);
  }
}

const release = await text("src/lib/release.ts");
for (const flag of [
  "VITE_ENABLE_MAINNET_COMMERCE",
  "VITE_LEGAL_REVIEW_COMPLETE",
  "VITE_TAX_REVIEW_COMPLETE",
  "VITE_SECURITY_REVIEW_COMPLETE",
]) {
  requireText(release, flag, `Client release gate is missing ${flag}`);
}
requireText(
  release,
  'MAINNET_BLOCKED ? "devnet"',
  "Partial mainnet configuration no longer fails back to devnet",
);

const cashFunction = await text("supabase/functions/gridiron-cash/index.ts");
requireText(
  cashFunction,
  'requiredEnv("TREASURY_WALLET")',
  "GC settlement does not require an explicit treasury secret",
);
requireText(cashFunction, "assertRpcNetwork", "GC settlement no longer verifies the RPC network");
if (cashFunction.includes("DEFAULT_TREASURY_WALLET"))
  failures.push("GC settlement restored a hard-coded treasury fallback");
if (cashFunction.includes('action === "spend"') || cashFunction.includes("spend_gridiron_cash")) {
  failures.push("The unused generic browser-triggered GC spending path was restored");
}

const marketFunction = await text("supabase/functions/marketplace/index.ts");
requireText(
  marketFunction,
  "MARKETPLACE_SOL_REVIEW_COMPLETE",
  "SOL marketplace lost its independent mainnet review gate",
);
requireText(
  marketFunction,
  "assertRpcNetwork",
  "SOL marketplace no longer verifies the RPC network",
);

const hardening = await text("supabase/migrations/20260719060000_public_api_hardening.sql");
requireText(
  hardening,
  "revoke execute on all functions in schema public from public, anon, authenticated",
  "Public function execution is not fail-closed",
);
requireText(
  hardening,
  "alter default privileges in schema public revoke execute on functions",
  "New database functions do not default to private",
);

const tableAccess = await text(
  "supabase/migrations/20260719080000_minimize_client_data_access.sql",
);
requireText(
  tableAccess,
  "public.solana_transaction_records",
  "Browser data-access revocation omits chain receipts",
);
requireText(
  tableAccess,
  "public.player_cards",
  "Browser data-access revocation omits authoritative cards",
);

const settlement = await text(
  "supabase/migrations/20260719090000_atomic_chain_settlement_audit.sql",
);
requireText(
  settlement,
  "Only devnet test purchases are enabled",
  "GC database finalization is no longer devnet-only",
);
requireText(
  settlement,
  "Only devnet marketplace settlement is enabled",
  "Marketplace database finalization is no longer devnet-only",
);
requireText(
  settlement,
  "insert into public.solana_transaction_records",
  "Settlement no longer writes an immutable chain receipt atomically",
);

const migrations = (await readdir(new URL("supabase/migrations/", root)))
  .filter((name) => name.endsWith(".sql"))
  .sort();
for (const required of [
  "20260719060000_public_api_hardening.sql",
  "20260719080000_minimize_client_data_access.sql",
  "20260719090000_atomic_chain_settlement_audit.sql",
  "20260719110000_remove_legacy_gc_spend.sql",
]) {
  if (!migrations.includes(required)) {
    failures.push(`Required hardening migration is missing: ${required}`);
  }
}
for (const migration of migrations) {
  const sql = await text(`supabase/migrations/${migration}`);
  const dollarQuotes = sql.match(/\$\$/g)?.length ?? 0;
  if (dollarQuotes % 2 !== 0) failures.push(`${migration} has unbalanced function dollar quotes`);
  if (
    migration > "20260719080000_minimize_client_data_access.sql" &&
    /grant\s+(?:all|insert|update|delete)\b[\s\S]*?\bto\s+(?:public|anon|authenticated)\b/i.test(
      sql,
    )
  ) {
    failures.push(`${migration} reopens direct browser mutation access after table hardening`);
  }
}

if (failures.length) {
  console.error("Release safety verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Release safety invariants are present.");
