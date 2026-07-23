/**
 * Public browser configuration for the independently owned game backend.
 *
 * Supabase publishable keys are intentionally safe to ship to browsers. Data
 * security is enforced by Row Level Security and protected database functions.
 * Keeping this configuration explicit prevents Lovable Cloud's attached
 * backend variables from silently redirecting the game to the wrong project.
 */
export const GRIDIRON_SUPABASE_PROJECT_ID = "wccvfmsfjopkvkijsthh";
export const GRIDIRON_SUPABASE_URL = `https://${GRIDIRON_SUPABASE_PROJECT_ID}.supabase.co`;
export const GRIDIRON_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_C5SRrrJ39ogCg9Gx-Zo4xA_7As1i9Ll";

export function assertOwnedSupabaseProject(url: string): void {
  const hostname = new URL(url).hostname;
  const expected = `${GRIDIRON_SUPABASE_PROJECT_ID}.supabase.co`;
  if (hostname !== expected) {
    throw new Error(`Refusing to connect Gridiron Gainz to unexpected Supabase host: ${hostname}`);
  }
}
