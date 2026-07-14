import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import { Textarea } from "../ui/textarea";
import type { AnyFieldApi } from "@tanstack/react-form";
import type { IDeck, ISlide, ITokens } from "@/lib/slides";
import type { IGroundingReport } from "@/lib/ai/generate-schema";
import { DESIGN_TOKENS } from "@/lib/slides";
import { generateDeck } from "@/lib/ai/generate-deck";
import {
  contentDocsQueryOptions,
  designDocsQueryOptions,
} from "@/lib/documents/queries";
import { DeckView } from "@/components/slides/deck-view";
import { SlidePreview } from "@/components/slides/slide-preview";
import { DocumentPicker } from "@/components/documents/document-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

/** Per-slide UI state as events stream in: a placeholder, a finished slide, or a failure. */
type TSlotState =
  | { status: "pending"; title: string }
  | { status: "ready"; slide: ISlide; grounding: IGroundingReport }
  | { status: "error"; message: string };

type TStatus = "idle" | "generating" | "done" | "error";

/** The generate form's fields, validated on change. `designDocId` is optional (default tokens). */
const GenerateFormSchema = z.object({
  contentDocId: z.string().min(1, "Pick a content document"),
  prompt: z.string().trim().min(1, "Describe the deck"),
  // Always a string — "" means "no design doc → default tokens" (see the picker's `noneLabel`).
  designDocId: z.string(),
});

/** The first validation error for a touched field, rendered as a small destructive line. */
function FieldError({ field }: { field: AnyFieldApi }) {
  if (!field.state.meta.isTouched) return null;
  const first = field.state.meta.errors[0];
  if (!first) return null;
  const message = typeof first === "string" ? first : first.message;
  return <p className="text-destructive text-xs">{message}</p>;
}

/** The extracted design system (palette swatches + fonts + feel note) for a design document. */
function DesignSystemView({
  sourceName,
  id,
  tokens,
  feel,
}: {
  sourceName: string;
  id: string;
  tokens: ITokens;
  feel?: string | null;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border p-4">
      <h3 className="text-sm font-semibold">
        Design system{" "}
        <span className="text-muted-foreground font-normal">
          ({sourceName} · id {id.slice(0, 8)})
        </span>
      </h3>
      <div className="flex flex-wrap gap-3">
        {Object.entries(tokens.colors).map(([colorRole, hex]) => (
          <div key={colorRole} className="flex items-center gap-2">
            <span
              className="h-8 w-8 rounded border"
              style={{ background: hex }}
            />
            <span className="text-xs">
              <span className="font-medium">{colorRole}</span>
              <br />
              <code className="text-muted-foreground">{hex}</code>
            </span>
          </div>
        ))}
      </div>
      <div className="text-muted-foreground text-xs">
        <p>
          <span className="font-medium">display:</span> {tokens.fonts.display}
        </p>
        <p>
          <span className="font-medium">body:</span> {tokens.fonts.body}
        </p>
        {feel && <p className="mt-1 italic">“{feel}”</p>}
      </div>
    </div>
  );
}

/** One card in the progressive grid: a 16:9 preview/skeleton with an index + grounding badge. */
function SlotCard({
  index,
  state,
  tokens,
}: {
  index: number;
  state: TSlotState;
  tokens: ITokens;
}) {
  return (
    <div className="relative flex flex-col gap-1.5">
      <div className="bg-card relative aspect-video w-full overflow-hidden rounded-md border">
        {state.status === "ready" ? (
          <SlidePreview slide={state.slide} tokens={tokens} />
        ) : state.status === "error" ? (
          <div className="text-destructive flex h-full items-center justify-center p-3 text-center text-xs">
            {state.message}
          </div>
        ) : (
          <Skeleton className="h-full w-full" />
        )}
        <span className="absolute left-1.5 top-1.5 rounded bg-black/55 px-1.5 py-0.5 text-xs font-medium text-white">
          {index + 1}
        </span>
        {state.status === "ready" && !state.grounding.ok && (
          <Badge
            variant="destructive"
            className="absolute right-1.5 top-1.5 text-[10px]"
          >
            {state.grounding.issues.length} ungrounded
          </Badge>
        )}
      </div>
      <p className="text-muted-foreground truncate text-xs">
        {state.status === "pending"
          ? state.title || "Generating…"
          : state.status === "error"
            ? "Failed"
            : " "}
      </p>
    </div>
  );
}

export function GeneratePanel() {
  // Shared, cached source lists — the DocumentPickers below fold fresh uploads into this cache.
  const contentDocs = useQuery(contentDocsQueryOptions());
  const designDocs = useQuery(designDocsQueryOptions());

  const [status, setStatus] = useState<TStatus>("idle");
  const [topError, setTopError] = useState<string | null>(null);
  const [items, setItems] = useState<Array<TSlotState>>([]);
  const [doneDeck, setDoneDeck] = useState<IDeck | null>(null);
  // The design tokens the deck is styled with — set from the plan event (the extracted design
  // system), falling back to the placeholder tokens until then / when no design doc is chosen.
  const [tokens, setTokens] = useState<ITokens>(DESIGN_TOKENS);

  /** Run generation and stream slide/plan/error events into the progressive-grid state. */
  async function runGeneration(value: {
    contentDocId: string;
    designDocId?: string;
    prompt: string;
  }) {
    setStatus("generating");
    setTopError(null);
    setDoneDeck(null);
    setItems([]);
    setTokens(DESIGN_TOKENS);

    const readyByIndex = new Map<number, ISlide>();
    let sawDone = false;

    try {
      const events = await generateDeck({
        data: {
          contentDocId: value.contentDocId,
          prompt: value.prompt.trim(),
          designDocId: value.designDocId || undefined,
        },
      });
      for await (const ev of events) {
        if (ev.type === "plan") {
          setTokens(ev.tokens);
          setItems(
            ev.plan.slides.map((s) => ({ status: "pending", title: s.title })),
          );
        } else if (ev.type === "slide") {
          readyByIndex.set(ev.index, ev.slide);
          setItems((prev) => {
            const next = prev.slice();
            next[ev.index] = {
              status: "ready",
              slide: ev.slide,
              grounding: ev.grounding,
            };
            return next;
          });
        } else if (ev.type === "error") {
          if (typeof ev.index === "number") {
            const at = ev.index;
            setItems((prev) => {
              const next = prev.slice();
              next[at] = { status: "error", message: ev.message };
              return next;
            });
          } else {
            setTopError(ev.message);
          }
        } else {
          // Only the "done" variant remains.
          sawDone = true;
          const ordered = Array.from({ length: ev.slideCount }, (_, i) =>
            readyByIndex.get(i),
          ).filter((s): s is ISlide => s !== undefined);
          setDoneDeck({ id: ev.deckId, slides: ordered });
          setStatus(ordered.length > 0 ? "done" : "error");
        }
      }
      if (!sawDone) setStatus("error");
    } catch (error) {
      setTopError(
        error instanceof Error ? error.message : "Generation failed.",
      );
      setStatus("error");
    }
  }

  const form = useForm({
    defaultValues: { contentDocId: "", designDocId: "", prompt: "" },
    validators: { onChange: GenerateFormSchema },
    onSubmit: async ({ value }) => {
      await runGeneration(value);
    },
  });

  // Seed each picker with the newest doc once its list resolves (mirrors the prior default), but
  // only while the field is still empty, so a user's choice / cleared selection is respected.
  const contentData = contentDocs.data;
  useEffect(() => {
    const first = contentData?.[0]?.id;
    if (first && form.state.values.contentDocId === "") {
      form.setFieldValue("contentDocId", first);
    }
  }, [contentData, form]);

  const designData = designDocs.data;
  useEffect(() => {
    const first = designData?.[0]?.id;
    if (first && form.state.values.designDocId === "") {
      form.setFieldValue("designDocId", first);
    }
  }, [designData, form]);

  const isGenerating = status === "generating";
  const editorDeck = doneDeck;
  const flagged = items.flatMap((it, i) =>
    it.status === "ready" && !it.grounding.ok
      ? [{ index: i, tokens: it.grounding.issues.map((x) => x.token) }]
      : [],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <section className="flex flex-col gap-4 rounded-lg border p-4">
        <div>
          <h2 className="text-sm font-semibold">Generate slides</h2>
          <p className="text-muted-foreground text-sm">
            Pick or upload a content PDF (and, optionally, a design PDF whose
            fonts + palette style the deck), describe the deck, and slides
            stream in as they’re generated.
          </p>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
          className="flex flex-col gap-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="content-doc">Content document</Label>
              <form.Field name="contentDocId">
                {(field) => (
                  <>
                    <DocumentPicker
                      role="content"
                      id="content-doc"
                      ariaLabel="Content document"
                      value={field.state.value}
                      onValueChange={field.handleChange}
                      docs={contentDocs.data ?? []}
                      placeholder="Select a content document…"
                      hint="The reference document your slides draw their content from."
                    />
                    <FieldError field={field} />
                  </>
                )}
              </form.Field>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="design-doc">Design (optional)</Label>
              <form.Field name="designDocId">
                {(field) => (
                  <DocumentPicker
                    role="design"
                    id="design-doc"
                    ariaLabel="Design document"
                    value={field.state.value}
                    onValueChange={field.handleChange}
                    docs={designDocs.data ?? []}
                    noneLabel="Default tokens"
                    hint="The styled deck whose fonts + palette define the look."
                  />
                )}
              </form.Field>
            </div>
          </div>

          {/* Preview the chosen design's system (its tokens ride along in the shared cache). */}
          <form.Subscribe selector={(s) => s.values.designDocId}>
            {(designDocId) => {
              const doc = designDocId
                ? designDocs.data?.find((d) => d.id === designDocId)
                : undefined;
              if (!doc?.designTokens) return null;
              return (
                <DesignSystemView
                  sourceName={doc.sourceName}
                  id={doc.id}
                  tokens={doc.designTokens}
                  feel={doc.designFeel}
                />
              );
            }}
          </form.Subscribe>

          <div className="flex flex-wrap items-end gap-4">
            <div className="flex min-w-72 flex-1 flex-col gap-1.5">
              <Label htmlFor="prompt">Prompt</Label>
              <form.Field name="prompt">
                {(field) => (
                  <>
                    <Textarea
                      id="prompt"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                      placeholder="e.g. a deck on the dosing, presentations and safety of the product"
                    />
                    <FieldError field={field} />
                  </>
                )}
              </form.Field>
            </div>
            <form.Subscribe
              selector={(s) => [s.canSubmit, s.isSubmitting] as const}
            >
              {([canSubmit, isSubmitting]) => (
                <Button type="submit" disabled={!canSubmit || isSubmitting}>
                  {isSubmitting ? "Generating…" : "Generate"}
                </Button>
              )}
            </form.Subscribe>
          </div>
        </form>

        {topError && (
          <p className="border-destructive/50 text-destructive rounded-md border p-3 text-sm">
            {topError}
          </p>
        )}

        {flagged.length > 0 && (
          <p className="border-destructive/40 text-muted-foreground rounded-md border p-3 text-xs">
            Grounding flags (kept, not dropped) —{" "}
            {flagged
              .map((f) => `slide ${f.index + 1}: ${f.tokens.join(", ")}`)
              .join(" · ")}
          </p>
        )}

        {/* The progressive grid is the live view WHILE generating (and stays on error so per-slide
            failures remain visible). Once a deck finishes it collapses — the full editor below is
            the deck's single preview from then on. */}
        {items.length > 0 && status !== "done" && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((state, i) => (
              <SlotCard key={i} index={i} state={state} tokens={tokens} />
            ))}
          </div>
        )}
      </section>

      {/* Once done, the full editor is the deck's only preview. Keyed by deck id so the editor
          mounts fresh when a generated deck replaces the placeholder. */}
      {!isGenerating && editorDeck && (
        <DeckView key={editorDeck.id} deck={editorDeck} tokens={tokens} />
      )}
    </div>
  );
}
