import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LAMPORTS_PER_SOL = 1_000_000_000;
const GC_PER_SOL = 10_000;
const MIN_SOL = 0.01;
const MAX_SOL = 10;
const ALLOWED_NETWORKS = new Set(["devnet", "testnet", "mainnet-beta"]);

function readReleaseNetwork() {
  const network = Deno.env.get("SOLANA_NETWORK") || "devnet";
  if (!ALLOWED_NETWORKS.has(network)) throw new Error("Invalid Solana network configuration");
  if (network === "mainnet-beta") {
    const mainnetApproved =
      Deno.env.get("ENABLE_MAINNET_COMMERCE") === "true" &&
      Deno.env.get("LEGAL_REVIEW_COMPLETE") === "true" &&
      Deno.env.get("TAX_REVIEW_COMPLETE") === "true" &&
      Deno.env.get("SECURITY_REVIEW_COMPLETE") === "true";
    if (!mainnetApproved) {
      throw new Error("Mainnet commerce is launch-locked pending legal, tax, and security review");
    }
  }
  return network;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}

function looksLikeSolanaAddress(value: unknown): value is string {
  return typeof value === "string" && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

function looksLikeSignature(value: unknown): value is string {
  return typeof value === "string" && /^[1-9A-HJ-NP-Za-km-z]{80,90}$/.test(value);
}

async function readConfirmedTransaction(rpcUrl: string, signature: string) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getTransaction",
      params: [
        signature,
        {
          encoding: "jsonParsed",
          commitment: "confirmed",
          maxSupportedTransactionVersion: 0,
        },
      ],
    }),
  });
  if (!response.ok) throw new Error("Solana RPC request failed");
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error.message ?? "Solana RPC returned an error");
  return payload.result;
}

async function assertRpcNetwork(rpcUrl: string, expectedNetwork: string) {
  const knownGenesisHashes: Record<string, string> = {
    devnet: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
    testnet: "4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY",
    "mainnet-beta": "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2dKz",
  };
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getGenesisHash" }),
  });
  if (!response.ok) throw new Error("Unable to verify the configured Solana network");
  const payload = await response.json();
  if (payload.result !== knownGenesisHashes[expectedNetwork]) {
    throw new Error("Solana RPC does not match the configured release network");
  }
}

async function hasCurrentLegalAcceptance(admin: ReturnType<typeof createClient>, userId: string) {
  const { data: documents, error: documentsError } = await admin
    .from("legal_documents")
    .select("code, version")
    .eq("is_current", true);
  if (documentsError) throw documentsError;
  const versions = Object.fromEntries(
    (documents ?? []).map((document) => [document.code, document.version]),
  );
  if (!versions.terms || !versions.privacy || !versions.contest_rules || !versions.purchase_policy)
    return false;
  const { data: acceptance, error } = await admin
    .from("legal_acceptances")
    .select("id")
    .eq("user_id", userId)
    .eq("age_of_majority_attested", true)
    .is("revoked_at", null)
    .eq("terms_version", versions.terms)
    .eq("privacy_version", versions.privacy)
    .eq("contest_rules_version", versions.contest_rules)
    .eq("purchase_policy_version", versions.purchase_policy)
    .maybeSingle();
  if (error) throw error;
  return Boolean(acceptance);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const network = readReleaseNetwork();
    const treasuryWallet = requiredEnv("TREASURY_WALLET");
    if (!looksLikeSolanaAddress(treasuryWallet)) {
      throw new Error("Invalid server configuration: TREASURY_WALLET");
    }
    const rpcUrl =
      Deno.env.get("SOLANA_RPC_URL") ||
      (network === "mainnet-beta"
        ? "https://api.mainnet-beta.solana.com"
        : network === "testnet"
          ? "https://api.testnet.solana.com"
          : "https://api.devnet.solana.com");
    const authorization = request.headers.get("Authorization") ?? "";
    const token = authorization.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Sign in required" }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Invalid session" }, 401);

    const { data: releaseControls, error: releaseError } = await admin
      .from("app_release_controls")
      .select(
        "release_mode, real_money_enabled, purchase_funded_prizes, legal_review_complete, tax_review_complete, security_review_complete, operator_identity_complete, jurisdiction_controls_complete, consumer_protection_review_complete, financial_compliance_review_complete, incident_response_ready, reconciliation_ready",
      )
      .eq("singleton", true)
      .single();
    if (releaseError) throw releaseError;
    if (
      network === "mainnet-beta" &&
      (releaseControls.release_mode !== "mainnet" ||
        !releaseControls.real_money_enabled ||
        releaseControls.purchase_funded_prizes ||
        !releaseControls.legal_review_complete ||
        !releaseControls.tax_review_complete ||
        !releaseControls.security_review_complete ||
        !releaseControls.operator_identity_complete ||
        !releaseControls.jurisdiction_controls_complete ||
        !releaseControls.consumer_protection_review_complete ||
        !releaseControls.financial_compliance_review_complete ||
        !releaseControls.incident_response_ready ||
        !releaseControls.reconciliation_ready)
    ) {
      return json({ error: "Real-money commerce is disabled by the server release gate" }, 503);
    }

    const body = await request.json();
    const action = body?.action;

    if (action === "create" && !(await hasCurrentLegalAcceptance(admin, authData.user.id))) {
      return json({ error: "Current legal documents must be accepted" }, 403);
    }

    if (action === "create" || action === "verify") {
      await assertRpcNetwork(rpcUrl, network);
    }

    if (action === "create") {
      const amountSol = Number(body.amountSol);
      const walletAddress = body.walletAddress;
      if (!Number.isFinite(amountSol) || amountSol < MIN_SOL || amountSol > MAX_SOL) {
        return json({ error: `Amount must be between ${MIN_SOL} and ${MAX_SOL} SOL` }, 400);
      }
      if (!looksLikeSolanaAddress(walletAddress)) {
        return json({ error: "Invalid connected wallet address" }, 400);
      }
      if (walletAddress === treasuryWallet) {
        return json(
          {
            error:
              "The treasury wallet cannot purchase Gridiron Cash. Connect a different player wallet.",
          },
          400,
        );
      }

      const expectedLamports = Math.round(amountSol * LAMPORTS_PER_SOL);
      const gcAmount = Math.round(amountSol * GC_PER_SOL);
      const { data, error } = await admin
        .from("gridiron_cash_purchases")
        .insert({
          user_id: authData.user.id,
          wallet_address: walletAddress,
          expected_lamports: expectedLamports,
          gc_amount: gcAmount,
          network,
          treasury_wallet: treasuryWallet,
        })
        .select("id, expected_lamports, gc_amount, expires_at")
        .single();
      if (error) throw error;

      return json({
        status: "pending",
        purchaseId: data.id,
        expectedLamports: data.expected_lamports,
        gcAmount: data.gc_amount,
        expiresAt: data.expires_at,
        treasuryWallet,
        network,
      });
    }

    if (action === "verify") {
      const purchaseId = body.purchaseId;
      const signature = body.signature;
      if (typeof purchaseId !== "string" || !looksLikeSignature(signature)) {
        return json({ error: "Invalid purchase or transaction signature" }, 400);
      }

      const { data: purchase, error: purchaseError } = await admin
        .from("gridiron_cash_purchases")
        .select("*")
        .eq("id", purchaseId)
        .eq("user_id", authData.user.id)
        .single();
      if (purchaseError || !purchase) return json({ error: "Purchase not found" }, 404);
      if (purchase.network !== network) {
        return json({ error: "Purchase network does not match the active release network" }, 409);
      }
      const purchaseTreasury = purchase.treasury_wallet;
      if (!looksLikeSolanaAddress(purchaseTreasury)) {
        return json({ error: "Purchase treasury is invalid" }, 409);
      }
      if (purchase.wallet_address === purchaseTreasury) {
        return json({ error: "Treasury self-payments cannot be credited" }, 400);
      }

      if (purchase.status === "confirmed") {
        if (purchase.signature !== signature)
          return json({ error: "Purchase already finalized" }, 409);
        const { data: account } = await admin
          .from("gridiron_cash_accounts")
          .select("balance")
          .eq("user_id", authData.user.id)
          .single();
        return json({
          status: "confirmed",
          purchaseId: purchase.id,
          signature: purchase.signature,
          balance: account?.balance ?? 0,
          gc_amount: purchase.gc_amount,
          expected_lamports: purchase.expected_lamports,
          current_pool_lamports: 0,
          next_pool_lamports: 0,
          development_lamports: 0,
          finalized_at: purchase.finalized_at,
        });
      }
      if (purchase.status !== "pending")
        return json({ error: `Purchase is ${purchase.status}` }, 409);
      if (new Date(purchase.expires_at).getTime() < Date.now()) {
        await admin
          .from("gridiron_cash_purchases")
          .update({
            status: "expired",
            failure_reason: "Payment intent expired",
          })
          .eq("id", purchase.id)
          .eq("status", "pending");
        return json({ error: "Purchase expired" }, 410);
      }

      const transaction = await readConfirmedTransaction(rpcUrl, signature);
      if (!transaction) return json({ status: "confirming" });
      if (transaction.meta?.err) return json({ error: "Transaction failed on Solana" }, 400);

      const signatures = transaction.transaction?.signatures ?? [];
      if (!signatures.includes(signature)) return json({ error: "Signature mismatch" }, 400);

      const createdAtSeconds = Math.floor(new Date(purchase.created_at).getTime() / 1000);
      if (
        typeof transaction.blockTime === "number" &&
        transaction.blockTime < createdAtSeconds - 120
      ) {
        return json({ error: "Transaction predates this purchase" }, 400);
      }

      const instructions = transaction.transaction?.message?.instructions ?? [];
      const expectedMemo = `gridiron-gainz:${purchase.id}`;
      const memoMatches = instructions.some(
        (instruction: Record<string, unknown>) =>
          instruction.program === "spl-memo" && instruction.parsed === expectedMemo,
      );
      if (!memoMatches) return json({ error: "Transaction purchase reference is missing" }, 400);

      const transfer = instructions.find((instruction: Record<string, unknown>) => {
        const parsed = instruction.parsed as
          { type?: string; info?: Record<string, unknown> } | undefined;
        const info = parsed?.info;
        return (
          instruction.program === "system" &&
          parsed?.type === "transfer" &&
          info?.source === purchase.wallet_address &&
          info?.destination === purchaseTreasury &&
          Number(info?.lamports) === Number(purchase.expected_lamports)
        );
      });
      if (!transfer) {
        return json(
          { error: "Transaction does not match the expected sender, treasury, and amount" },
          400,
        );
      }

      const { data: finalized, error: finalizeError } = await admin.rpc(
        "finalize_gridiron_cash_purchase",
        { p_purchase_id: purchase.id, p_user_id: authData.user.id, p_signature: signature },
      );
      if (finalizeError) throw finalizeError;
      const result = Array.isArray(finalized) ? finalized[0] : finalized;
      const blockTime =
        typeof transaction.blockTime === "number"
          ? new Date(transaction.blockTime * 1000).toISOString()
          : null;
      const slot = typeof transaction.slot === "number" ? transaction.slot : null;
      const feeLamports = typeof transaction.meta?.fee === "number" ? transaction.meta.fee : null;
      const { error: auditError } = await admin.from("solana_transaction_records").upsert(
        {
          signature,
          purchase_id: purchase.id,
          user_id: authData.user.id,
          network,
          sender_wallet: purchase.wallet_address,
          treasury_wallet: purchaseTreasury,
          amount_lamports: purchase.expected_lamports,
          fee_lamports: feeLamports,
          slot,
          block_time: blockTime,
          reconciliation_status: network === "mainnet-beta" ? "pending" : "not_applicable_testnet",
        },
        { onConflict: "signature", ignoreDuplicates: true },
      );
      if (auditError) throw auditError;
      const { error: purchaseAuditError } = await admin
        .from("gridiron_cash_purchases")
        .update({
          confirmed_slot: slot,
          block_time: blockTime,
          transaction_fee_lamports: feeLamports,
          accounting_status:
            network === "mainnet-beta" ? "pending_valuation" : "not_applicable_testnet",
        })
        .eq("id", purchase.id)
        .eq("user_id", authData.user.id);
      if (purchaseAuditError) throw purchaseAuditError;
      return json({ status: "confirmed", purchaseId: purchase.id, signature, ...result });
    }

    if (action === "status") {
      const [{ data: account }, { data: purchases }, { data: allocation }] = await Promise.all([
        admin
          .from("gridiron_cash_accounts")
          .select("balance, total_purchased")
          .eq("user_id", authData.user.id)
          .maybeSingle(),
        admin
          .from("gridiron_cash_purchases")
          .select("*")
          .eq("user_id", authData.user.id)
          .order("created_at", { ascending: false })
          .limit(20),
        admin.from("treasury_allocation").select("*").eq("singleton", true).single(),
      ]);
      return json({
        account: account ?? { balance: 0, total_purchased: 0 },
        purchases: purchases ?? [],
        allocation,
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Unexpected server error" }, 500);
  }
});
