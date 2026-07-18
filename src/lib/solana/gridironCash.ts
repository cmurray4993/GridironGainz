import { supabase } from "@/integrations/supabase/client";

export interface PurchaseIntent {
  status: "pending";
  purchaseId: string;
  expectedLamports: number;
  gcAmount: number;
  expiresAt: string;
  treasuryWallet: string;
}

export interface VerifiedPurchase {
  status: "confirmed";
  purchaseId: string;
  signature: string;
  balance: number;
  gc_amount: number;
  expected_lamports: number;
  current_pool_lamports: number;
  next_pool_lamports: number;
  development_lamports: number;
  finalized_at: string;
}

interface ConfirmingPurchase {
  status: "confirming";
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("gridiron-cash", { body });
  if (error) {
    let message = error.message;
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const payload = await context.clone().json();
        if (typeof payload?.error === "string") message = payload.error;
      } catch {
        // Keep the Supabase error when the response has no JSON body.
      }
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

export function createPurchaseIntent(amountSol: number, walletAddress: string) {
  return invoke<PurchaseIntent>({ action: "create", amountSol, walletAddress });
}

export function verifyPurchase(purchaseId: string, signature: string) {
  return invoke<VerifiedPurchase | ConfirmingPurchase>({ action: "verify", purchaseId, signature });
}

export interface GridironCashStatus {
  account: { balance: number; total_purchased: number };
  purchases: Array<{
    id: string;
    signature: string | null;
    expected_lamports: number;
    gc_amount: number;
    current_pool_lamports: number;
    next_pool_lamports: number;
    development_lamports: number;
    created_at: string;
  }>;
  allocation: {
    current_pool_lamports: number;
    next_pool_lamports: number;
    development_lamports: number;
  } | null;
}

export function getGridironCashStatus() {
  return invoke<GridironCashStatus>({ action: "status" });
}

export function spendGridironCashServer(amount: number, reason: string, reference: string) {
  return invoke<{ status: "confirmed"; balance: number }>({
    action: "spend",
    amount,
    reason,
    reference,
  });
}

export async function waitForVerifiedPurchase(purchaseId: string, signature: string) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const result = await verifyPurchase(purchaseId, signature);
    if (result.status === "confirmed") return result;
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
  throw new Error(
    "The payment is confirmed but verification is still processing. Try again shortly.",
  );
}
