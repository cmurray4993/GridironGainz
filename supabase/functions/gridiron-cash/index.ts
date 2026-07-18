import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LAMPORTS_PER_SOL = 1_000_000_000;
const GC_PER_SOL = 10_000;
const MIN_SOL = 0.01;
const MAX_SOL = 10;
const DEFAULT_TREASURY_WALLET = "8CfcSMpWF7qAm1acso4HjVSeZbFWtTRpj8aGvJ1YvZMu";

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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const treasuryWallet = Deno.env.get("TREASURY_WALLET") || DEFAULT_TREASURY_WALLET;
    const rpcUrl = Deno.env.get("SOLANA_RPC_URL") || "https://api.devnet.solana.com";
    const authorization = request.headers.get("Authorization") ?? "";
    const token = authorization.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Sign in required" }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Invalid session" }, 401);

    const body = await request.json();
    const action = body?.action;

    if (action === "create") {
      const amountSol = Number(body.amountSol);
      const walletAddress = body.walletAddress;
      if (!Number.isFinite(amountSol) || amountSol < MIN_SOL || amountSol > MAX_SOL) {
        return json({ error: `Amount must be between ${MIN_SOL} and ${MAX_SOL} SOL` }, 400);
      }
      if (!looksLikeSolanaAddress(walletAddress)) {
        return json({ error: "Invalid connected wallet address" }, 400);
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

      if (purchase.status === "confirmed") {
        if (purchase.signature !== signature)
          return json({ error: "Purchase already finalized" }, 409);
        const { data: account } = await admin
          .from("gridiron_cash_accounts")
          .select("balance")
          .eq("user_id", authData.user.id)
          .single();
        return json({ status: "confirmed", purchase, balance: account?.balance ?? 0 });
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
          info?.destination === treasuryWallet &&
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
