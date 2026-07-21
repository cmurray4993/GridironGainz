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
import { Toaster } from "@/components/ui/sonner";
import { useReleaseEligibility } from "@/lib/legal";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-8xl text-gradient-gold">404</h1>
        <h2 className="mt-4 font-display text-2xl">Off the field</h2>
        <p className="mt-2 text-sm text-muted-foreground">This page isn't in the playbook.</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Back to HQ
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-2xl">Fumble</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went sideways. Reset the play.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Try again
          </button>
          <a href="/" className="rounded-md border border-input px-4 py-2 text-sm">
            Go home
          </a>
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
      { title: "Gridiron Gainz — Build your dynasty" },
      {
        name: "description",
        content:
          "Open packs, build a roster, and simulate matchdays in Gridiron Gainz, a dark-themed football card game.",
      },
      { name: "author", content: "Gridiron Gainz" },
      { property: "og:title", content: "Gridiron Gainz — Build your dynasty" },
      {
        property: "og:description",
        content:
          "Open packs, build a roster, and simulate matchdays in Gridiron Gainz, a dark-themed football card game.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Gridiron Gainz — Build your dynasty" },
      {
        name: "twitter:description",
        content:
          "Open packs, build a roster, and simulate matchdays in Gridiron Gainz, a dark-themed football card game.",
      },
      { property: "og:image", content: "/gridiron-gainz-logo.png" },
      { name: "twitter:image", content: "/gridiron-gainz-logo.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600;700&display=swap",
      },
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
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate />
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}

function AuthGate() {
  const { user, loading } = useAuth();
  const eligibility = useReleaseEligibility(user?.id);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const router = useRouter();
  const legalRoutes = ["/terms", "/privacy", "/rules", "/purchase-policy"];
  const isPublicRoute = pathname === "/auth" || legalRoutes.includes(pathname);
  const isEligibilityRoute = pathname === "/eligibility";
  const isChrome =
    pathname !== "/auth" &&
    pathname !== "/welcome" &&
    !isEligibilityRoute &&
    !legalRoutes.includes(pathname);

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublicRoute) {
      router.navigate({ to: "/auth" });
    } else if (user && pathname === "/auth") {
      router.navigate({ to: eligibility.data?.accepted ? "/" : "/eligibility" });
    } else if (
      user &&
      !eligibility.loading &&
      !eligibility.data?.accepted &&
      !isPublicRoute &&
      !isEligibilityRoute
    ) {
      router.navigate({ to: "/eligibility" });
    } else if (user && eligibility.data?.accepted && isEligibilityRoute) {
      router.navigate({ to: "/" });
    }
  }, [
    loading,
    user,
    isPublicRoute,
    isEligibilityRoute,
    pathname,
    router,
    eligibility.loading,
    eligibility.data?.accepted,
  ]);

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

  if (user && eligibility.loading && !isPublicRoute) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Checking eligibility…
      </div>
    );
  }

  if (user && !eligibility.data?.accepted && !isPublicRoute && !isEligibilityRoute) {
    return null;
  }

  if (!isChrome) {
    return <Outlet />;
  }

  return (
    <div className="min-h-dvh pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      <TopBar />
      <main className="mx-auto min-w-0 max-w-5xl px-2.5 py-3 min-[380px]:px-3 sm:px-4 sm:py-6">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
