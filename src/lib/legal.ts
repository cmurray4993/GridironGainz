import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ReleaseEligibility {
  accepted: boolean;
  accepted_at?: string | null;
  country_code?: string | null;
  current_versions: Record<string, string>;
  release: {
    release_mode: "beta_devnet" | "testnet" | "mainnet";
    real_money_enabled: boolean;
    purchase_funded_prizes: boolean;
    minimum_age: number;
    sponsor_prize_pool_lamports: number;
    legal_review_complete: boolean;
    tax_review_complete: boolean;
    security_review_complete: boolean;
  };
}

async function rpc<T>(name: string, params: Record<string, unknown> = {}) {
  const { data, error } = await (
    supabase.rpc as unknown as (
      fn: string,
      args?: Record<string, unknown>,
    ) => Promise<{ data: T | null; error: { message: string } | null }>
  )(name, params);
  if (error) throw new Error(error.message);
  if (data == null) throw new Error(`${name} returned no data`);
  return data;
}

export function getReleaseEligibility() {
  return rpc<ReleaseEligibility>("get_release_eligibility");
}

export function acceptCurrentLegalDocuments(countryCode: string) {
  return rpc<{ accepted: boolean }>("accept_current_legal_documents", {
    p_age_of_majority_attested: true,
    p_country_code: countryCode,
  });
}

export function useReleaseEligibility(userId?: string | null) {
  const [data, setData] = useState<ReleaseEligibility | null>(null);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(await getReleaseEligibility());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to verify beta eligibility");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
