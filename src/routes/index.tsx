import { createFileRoute } from "@tanstack/react-router";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { DeckView } from "@/components/slides/deck-view";
import { DEMO_DECK, PHARMA_TOKENS } from "@/lib/slides";

export const Route = createFileRoute("/")({ component: Home });

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
          <DeckView deck={DEMO_DECK} tokens={PHARMA_TOKENS} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
