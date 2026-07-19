import { createClient } from "npm:@supabase/supabase-js@2";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const suppliedSecret = request.headers.get("x-cron-secret");
  const expectedSecret = Deno.env.get("SEASON_PROCESSOR_SECRET");
  if (!expectedSecret || suppliedSecret !== expectedSecret) {
    return json({ error: "Unauthorized" }, 401);
  }
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) throw new Error("Missing server configuration");
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await admin.rpc("process_all_due_season_games");
    if (error) throw error;
    return json({ ok: true, processed: Number(data ?? 0), ranAt: new Date().toISOString() });
  } catch (error) {
    console.error(error);
    return json(
      { error: error instanceof Error ? error.message : "Season processing failed" },
      500,
    );
  }
});
