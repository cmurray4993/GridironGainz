import { createFileRoute } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { Component, lazy, Suspense, type ReactNode } from "react";

export const Route = createFileRoute("/wallet")({
  component: WalletPage,
  head: () => ({
    meta: [
      { title: "Wallet — Fourth & Fortune" },
      { name: "description", content: "Connect Phantom or Solflare and fund your Fourth & Fortune franchise with SOL." },
    ],
  }),
});

const WalletRuntime = lazy(async () => {
  const { Buffer } = await import("buffer");
  if (typeof globalThis !== "undefined") {
    (globalThis as typeof globalThis & { Buffer?: typeof Buffer }).Buffer ??= Buffer;
  }
  return import("@/components/WalletRuntime");
});

class WalletErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error(error);
  }

  render() {
    if (this.state.failed) return <WalletFallback failed />;
    return this.props.children;
  }
}

function WalletPage() {
  return (
    <ClientOnly fallback={<WalletFallback />}>
      <WalletErrorBoundary>
        <Suspense fallback={<WalletFallback />}>
          <WalletRuntime />
        </Suspense>
      </WalletErrorBoundary>
    </ClientOnly>
  );
}

function WalletFallback({ failed = false }: { failed?: boolean }) {
  return (
    <div className="animate-float-up space-y-6">
      <section className="rounded-2xl border border-border/70 bg-card/80 p-6 shadow-[var(--shadow-card)]">
        <div className="text-[11px] uppercase tracking-[0.3em] text-primary/80">Franchise Wallet</div>
        <h1 className="mt-1 font-display text-3xl">Fund your dynasty</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {failed ? "Wallet connection is unavailable in this browser session." : "Preparing Phantom and Solflare connection…"}
        </p>
      </section>
    </div>
  );
}
