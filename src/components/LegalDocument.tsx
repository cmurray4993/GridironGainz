import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function LegalDocument({
  title,
  effective,
  children,
}: {
  title: string;
  effective: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <main className="mx-auto max-w-3xl">
        <Link to="/auth" className="text-sm text-primary">
          ← Back
        </Link>
        <div className="mt-5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
          <strong>Closed-beta draft — professional review required.</strong> This document is a
          product safety control, not a substitute for advice from a qualified attorney.
        </div>
        <h1 className="mt-7 font-display text-4xl text-gradient-gold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Effective {effective} · Version beta-2026-07-19
        </p>
        <div className="mt-8 space-y-7 text-sm leading-6 text-muted-foreground">{children}</div>
        <nav className="mt-10 flex flex-wrap gap-4 border-t border-border/70 pt-5 text-xs">
          <Link to="/terms" className="text-primary underline">
            Terms
          </Link>
          <Link to="/privacy" className="text-primary underline">
            Privacy
          </Link>
          <Link to="/rules" className="text-primary underline">
            Contest Rules
          </Link>
          <Link to="/purchase-policy" className="text-primary underline">
            Purchase Policy
          </Link>
        </nav>
      </main>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-2xl text-foreground">{title}</h2>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}
