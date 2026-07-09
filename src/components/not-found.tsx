import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

export function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="max-w-md text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or may have been
        moved.
      </p>
      <Button render={<Link to="/" />} className="mt-2">
        Back to dashboard
      </Button>
    </div>
  );
}
