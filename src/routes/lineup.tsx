import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/lineup")({
  beforeLoad: () => {
    throw redirect({ to: "/roster" });
  },
  component: () => null,
});
