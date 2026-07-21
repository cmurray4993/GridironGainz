import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { refreshAuthoritativeState, setTeamName, useGame } from "@/lib/game/store";
import {
  claimBetaDeveloperAccess,
  fetchBetaDeveloperStatus,
  grantBetaTestCurrency,
} from "@/lib/game/authoritative";
import { IS_TEST_NETWORK } from "@/lib/release";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  head: () => ({ meta: [{ title: "Settings — Gridiron Gainz" }] }),
});

function SettingsPage() {
  const { teamName } = useGame();
  const [name, setName] = useState(teamName ?? "");
  const [developerEnabled, setDeveloperEnabled] = useState(false);
  const [developerCode, setDeveloperCode] = useState("");
  const [developerBusy, setDeveloperBusy] = useState(false);

  useEffect(() => {
    setName(teamName ?? "");
  }, [teamName]);

  useEffect(() => {
    if (!IS_TEST_NETWORK) return;
    void fetchBetaDeveloperStatus()
      .then((status) => setDeveloperEnabled(status.enabled))
      .catch(() => setDeveloperEnabled(false));
  }, []);

  const clean = name.trim();
  const dirty = clean !== (teamName ?? "");
  const valid = clean.length >= 2 && clean.length <= 24;

  const save = async () => {
    if (!valid) return;
    try {
      await setTeamName(clean);
      toast.success("Team name updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Team name could not be updated");
    }
  };

  const unlockDeveloperTools = async () => {
    if (!developerCode.trim()) return;
    setDeveloperBusy(true);
    try {
      await claimBetaDeveloperAccess(developerCode.trim());
      setDeveloperEnabled(true);
      setDeveloperCode("");
      toast.success("Developer tools unlocked for this account");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Developer access could not be unlocked",
      );
    } finally {
      setDeveloperBusy(false);
    }
  };

  const grantCurrency = async (currency: "coins" | "gc", amount: number) => {
    setDeveloperBusy(true);
    try {
      await grantBetaTestCurrency(currency, amount, crypto.randomUUID());
      await refreshAuthoritativeState();
      toast.success(`+${amount.toLocaleString()} ${currency === "gc" ? "GC" : "Coins"} granted`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Test currency could not be granted");
    } finally {
      setDeveloperBusy(false);
    }
  };

  return (
    <div className="animate-float-up space-y-6 max-w-lg">
      <header>
        <div className="text-[11px] uppercase tracking-[0.3em] text-primary/80">Franchise</div>
        <h1 className="mt-1 font-display text-3xl">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Your username and team name are the same — one identity across the league.
        </p>
      </header>

      <section className="rounded-2xl border border-border/70 bg-card/80 p-5 shadow-[var(--shadow-card)] space-y-4">
        <div>
          <label
            htmlFor="team-name"
            className="text-[10px] uppercase tracking-widest text-muted-foreground"
          >
            Username / Team name
          </label>
          <input
            id="team-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            placeholder="e.g. Coach Razor's Renegades"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>2–24 characters</span>
            <span>{clean.length}/24</span>
          </div>
        </div>

        <button
          onClick={() => void save()}
          disabled={!dirty || !valid}
          className="w-full rounded-lg bg-[image:var(--gradient-gold)] px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-glow)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save
        </button>
      </section>

      <p className="text-xs text-muted-foreground">
        Current: <span className="text-foreground font-semibold">{teamName ?? "Your Squad"}</span>
      </p>

      <section className="rounded-2xl border border-border/70 bg-card/80 p-5">
        <div className="text-[10px] uppercase tracking-widest text-primary">
          Safety and policies
        </div>
        <h2 className="mt-1 font-display text-xl">Beta documents</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Review the current documents you accepted. Updated versions require a new acceptance
          before play resumes.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs">
          <Link to="/terms" className="rounded-lg border border-border bg-secondary px-3 py-2">
            Terms
          </Link>
          <Link to="/privacy" className="rounded-lg border border-border bg-secondary px-3 py-2">
            Privacy
          </Link>
          <Link to="/rules" className="rounded-lg border border-border bg-secondary px-3 py-2">
            Beta rules
          </Link>
          <Link
            to="/purchase-policy"
            className="rounded-lg border border-border bg-secondary px-3 py-2"
          >
            Purchase policy
          </Link>
        </div>
      </section>

      {IS_TEST_NETWORK && (
        <section className="space-y-4 rounded-2xl border border-dashed border-primary/50 bg-primary/5 p-5">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-primary">
              Developer tools
            </div>
            <h2 className="mt-1 font-display text-xl">Devnet testing</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Server-authorized test grants are recorded in the permanent currency ledger. They
              cannot run if real-money features are enabled.
            </p>
          </div>

          {developerEnabled ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                  onClick={() => void grantCurrency("coins", 100_000)}
                  disabled={developerBusy}
                  className="rounded-lg border border-primary/60 bg-secondary px-3 py-2.5 text-xs font-semibold disabled:opacity-40"
                >
                  +100K Coins
                </button>
                <button
                  onClick={() => void grantCurrency("coins", 2_000_000)}
                  disabled={developerBusy}
                  className="rounded-lg border border-primary/60 bg-secondary px-3 py-2.5 text-xs font-semibold disabled:opacity-40"
                >
                  +2M Coins
                </button>
                <button
                  onClick={() => void grantCurrency("gc", 10_000)}
                  disabled={developerBusy}
                  className="rounded-lg border border-primary/60 bg-secondary px-3 py-2.5 text-xs font-semibold disabled:opacity-40"
                >
                  +10K GC
                </button>
              </div>
              <Link
                to="/pack"
                className="block w-full rounded-lg bg-[image:var(--gradient-gold)] px-4 py-2.5 text-center text-sm font-semibold text-primary-foreground"
              >
                Open packs
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                type="password"
                value={developerCode}
                onChange={(event) => setDeveloperCode(event.target.value)}
                placeholder="One-time developer access code"
                autoComplete="off"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
              <button
                onClick={() => void unlockDeveloperTools()}
                disabled={developerBusy || !developerCode.trim()}
                className="w-full rounded-lg border border-primary/60 bg-secondary px-4 py-2.5 text-sm font-semibold disabled:opacity-40"
              >
                Unlock developer tools
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
