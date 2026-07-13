import { createFileRoute } from "@tanstack/react-router";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { GeneratePanel } from "@/components/slides/generate-panel";
import {
  contentDocsQueryOptions,
  designDocsQueryOptions,
} from "@/lib/documents/queries";

export const Route = createFileRoute("/")({
  // Best-effort: warm the shared document caches during SSR so the pickers are populated on first
  // paint. Never fail the route if the DB is unavailable — the panels handle empty/error softly.
  loader: ({ context }) => {
    void context.queryClient
      .ensureQueryData(contentDocsQueryOptions())
      .catch(() => {});
    void context.queryClient
      .ensureQueryData(designDocsQueryOptions())
      .catch(() => {});
  },
  component: Home,
});

function Home() {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
          <GeneratePanel />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
