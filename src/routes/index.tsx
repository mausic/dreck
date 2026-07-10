import { createFileRoute } from "@tanstack/react-router";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { GeneratePanel } from "@/components/slides/generate-panel";
import { ExtractPanel } from "@/components/extract/extract-panel";

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
          <ExtractPanel />
          <GeneratePanel />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
