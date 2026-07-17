import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { GeneratePanel } from "@/components/slides/generate-panel";
import {
  contentDocsQueryOptions,
  designDocsQueryOptions,
} from "@/lib/documents/queries";

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    await Promise.allSettled([
      context.queryClient.ensureQueryData(contentDocsQueryOptions()),
      context.queryClient.ensureQueryData(designDocsQueryOptions()),
    ]);
  },
  component: Home,
});

function Home() {
  return (
    <AppShell title="Slide generator">
      <GeneratePanel />
    </AppShell>
  );
}
