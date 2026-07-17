import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { BottomNav, TopBar } from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import { SolanaWalletProvider } from "@/lib/solana/WalletProvider";


function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-8xl text-gradient-gold">404</h1>
        <h2 className="mt-4 font-display text-2xl">Off the field</h2>
        <p className="mt-2 text-sm text-muted-foreground">This page isn't in the playbook.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
            Back to HQ
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-2xl">Fumble</h1>
        <p className="mt-2 text-sm text-muted-foreground">Something went sideways. Reset the play.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Try again</button>
          <a href="/" className="rounded-md border border-input px-4 py-2 text-sm">Go home</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Fourth & Fortune — Build your dynasty" },
      { name: "description", content: "Open packs, build a roster, and simulate matchdays in Fourth & Fortune, a dark-themed football card game." },
      { name: "author", content: "Fourth & Fortune" },
      { property: "og:title", content: "Fourth & Fortune — Build your dynasty" },
      { property: "og:description", content: "Open packs, build a roster, and simulate matchdays in Fourth & Fortune, a dark-themed football card game." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Fourth & Fortune — Build your dynasty" },
      { name: "twitter:description", content: "Open packs, build a roster, and simulate matchdays in Fourth & Fortune, a dark-themed football card game." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/f746519e-ab2b-4009-9f3a-53b2b9db3cbe/id-preview-fc9df144--80d86f65-d54b-4c30-9357-d20fd55c868f.lovable.app-1784298365714.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/f746519e-ab2b-4009-9f3a-53b2b9db3cbe/id-preview-fc9df144--80d86f65-d54b-4c30-9357-d20fd55c868f.lovable.app-1784298365714.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&display=swap" },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <SolanaWalletProvider>
        <AuthGate />
      </SolanaWalletProvider>
    </QueryClientProvider>
  );
}


function AuthGate() {
  const { user, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const router = useRouter();
  const isPublicRoute = pathname === "/auth";
  const isChrome = pathname !== "/auth" && pathname !== "/welcome";

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublicRoute) {
      router.navigate({ to: "/auth" });
    } else if (user && pathname === "/auth") {
      router.navigate({ to: "/" });
    }
  }, [loading, user, isPublicRoute, pathname, router]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!user && !isPublicRoute) {
    return null;
  }

  if (!isChrome) {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen pb-20">
      <TopBar />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
