import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { setStoreUser } from "@/lib/game/store";
import { syncGridironCashSnapshot } from "@/lib/game/store";
import { getGridironCashStatus } from "@/lib/solana/gridironCash";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const u = data.session?.user ?? null;
      setUser(u);
      setStoreUser(u?.id ?? null);
      if (u) getGridironCashStatus().then(syncGridironCashSnapshot).catch(() => {});
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      setStoreUser(u?.id ?? null);
      if (u) setTimeout(() => getGridironCashStatus().then(syncGridironCashSnapshot).catch(() => {}), 0);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}
