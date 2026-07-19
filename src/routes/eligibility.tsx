import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { acceptCurrentLegalDocuments, useReleaseEligibility } from "@/lib/legal";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/eligibility")({
  component: Eligibility,
  head: () => ({ meta: [{ title: "Beta Eligibility — Gridiron Gainz" }] }),
});

function Eligibility() {
  const { user } = useAuth();
  const eligibility = useReleaseEligibility(user?.id);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [documentsConfirmed, setDocumentsConfirmed] = useState(false);
  const [country, setCountry] = useState("US");
  const [busy, setBusy] = useState(false);

  async function accept() {
    if (!ageConfirmed || !documentsConfirmed) {
      toast.error("Both confirmations are required");
      return;
    }
    setBusy(true);
    try {
      await acceptCurrentLegalDocuments(country);
      toast.success("Beta eligibility recorded");
      window.location.assign("/welcome");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save acceptance");
      setBusy(false);
    }
  }

  if (eligibility.loading) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Checking beta eligibility…
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-10">
      <div className="rounded-2xl border border-border/70 bg-card/90 p-6 shadow-[var(--shadow-card)]">
        <div className="text-[11px] uppercase tracking-[0.3em] text-primary">Safety check</div>
        <h1 className="mt-2 font-display text-4xl">Closed beta eligibility</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          This is an adults-only, U.S.-limited devnet test. Test assets and rewards have no cash
          value. Completing this form does not make real-money features available.
        </p>

        {eligibility.error && (
          <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-200">
            Safety verification is unavailable, so access is paused. {eligibility.error}
          </div>
        )}

        <label className="mt-5 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Country
          <select
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm normal-case tracking-normal text-foreground"
          >
            <option value="US">United States</option>
          </select>
        </label>

        <label className="mt-5 flex items-start gap-3 rounded-lg border border-border/70 bg-background/50 p-3 text-sm">
          <input
            type="checkbox"
            checked={ageConfirmed}
            onChange={(event) => setAgeConfirmed(event.target.checked)}
            className="mt-1"
          />
          <span>
            I confirm that I am at least 18 and have reached the age of majority where I live.
          </span>
        </label>

        <label className="mt-3 flex items-start gap-3 rounded-lg border border-border/70 bg-background/50 p-3 text-sm">
          <input
            type="checkbox"
            checked={documentsConfirmed}
            onChange={(event) => setDocumentsConfirmed(event.target.checked)}
            className="mt-1"
          />
          <span>
            I have read and agree to the{" "}
            <Link to="/terms" className="text-primary underline">
              Terms
            </Link>
            ,{" "}
            <Link to="/privacy" className="text-primary underline">
              Privacy Notice
            </Link>
            ,{" "}
            <Link to="/rules" className="text-primary underline">
              Contest Rules
            </Link>
            , and{" "}
            <Link to="/purchase-policy" className="text-primary underline">
              Purchase Policy
            </Link>
            .
          </span>
        </label>

        <button
          type="button"
          onClick={accept}
          disabled={busy || Boolean(eligibility.error) || !ageConfirmed || !documentsConfirmed}
          className="mt-5 w-full rounded-lg bg-[image:var(--gradient-gold)] px-4 py-3 font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Saving…" : "Enter devnet beta"}
        </button>
      </div>
    </div>
  );
}
