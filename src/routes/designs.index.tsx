import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { IconLoader2, IconPalette, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { toast } from "sonner";

import type { TDocOption } from "@/lib/documents/queries";
import { AppShell } from "@/components/app-shell";
import { DesignSystemPreview } from "@/components/documents/design-system-preview";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { deleteDesignDocument } from "@/lib/documents/functions";
import { designDocsQueryOptions, documentsKeys } from "@/lib/documents/queries";

export const Route = createFileRoute("/designs/")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(designDocsQueryOptions()),
  component: ExtractedDesignsPage,
});

function DeleteDesignButton({
  design,
  deleting,
  onDelete,
}: {
  design: TDocOption;
  deleting: boolean;
  onDelete: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  async function handleDelete() {
    try {
      await onDelete();
      setOpen(false);
    } catch {
      // The page mutation owns error feedback; leave the dialog open for retry.
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<Button variant="destructive" size="sm" />}>
        <IconTrash data-icon="inline-start" />
        Delete design
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete extracted design?</AlertDialogTitle>
          <AlertDialogDescription>
            {design.sourceName} will be removed from the design picker. Existing
            decks keep their saved styling and slides.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleting}
            onClick={(event) => {
              event.preventDefault();
              void handleDelete();
            }}
          >
            {deleting && (
              <IconLoader2 data-icon="inline-start" className="animate-spin" />
            )}
            {deleting ? "Deleting" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ExtractedDesignsPage() {
  const queryClient = useQueryClient();
  const designsQuery = useQuery(designDocsQueryOptions());
  const designs = designsQuery.data ?? [];
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteDesignDocument({ data: { id } });
      if (!result.ok) throw new Error(result.error);
      return result.id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData<Array<TDocOption>>(
        documentsKeys.role("design"),
        (current) => current?.filter((design) => design.id !== id) ?? [],
      );
      void queryClient.invalidateQueries({
        queryKey: documentsKeys.role("design"),
      });
      toast.success("Extracted design deleted");
    },
    onError: (error) => {
      toast.error("Design not deleted", { description: error.message });
    },
  });

  return (
    <AppShell title="Extracted designs">
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              Design library
            </h2>
            <p className="text-muted-foreground max-w-2xl text-sm">
              Preview extracted palettes, typography, and reusable layouts.
              Deleting a design removes it from future generation without
              changing existing decks.
            </p>
          </div>
          <Link to="/" className={buttonVariants()}>
            Extract another design
          </Link>
        </div>

        {designs.length === 0 ? (
          <Empty className="min-h-64 border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <IconPalette />
              </EmptyMedia>
              <EmptyTitle>No extracted designs yet</EmptyTitle>
              <EmptyDescription>
                Upload a design PDF while creating a deck to extract its visual
                system and reusable layouts.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Link to="/" className={buttonVariants({ variant: "outline" })}>
                Create a deck
              </Link>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {designs.map((design) => (
              <Card key={design.id} className="min-w-0">
                <CardHeader>
                  <CardTitle className="truncate">
                    {design.sourceName}
                  </CardTitle>
                  <CardDescription>
                    {design.designArchetypes?.length ?? 0} reusable layouts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DesignSystemPreview
                    tokens={design.designTokens}
                    feel={design.designFeel}
                    archetypes={design.designArchetypes}
                  />
                </CardContent>
                <CardFooter className="justify-end">
                  <DeleteDesignButton
                    design={design}
                    deleting={
                      deleteMutation.isPending &&
                      deleteMutation.variables === design.id
                    }
                    onDelete={() =>
                      deleteMutation
                        .mutateAsync(design.id)
                        .then(() => undefined)
                    }
                  />
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
