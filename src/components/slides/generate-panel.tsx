import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "@tanstack/react-form";
import { z } from "zod";
import type { AnyFieldApi } from "@tanstack/react-form";
import type {
  IExtractedArchetype,
  ISlide,
  ITokens,
  TSlotContent,
  TSlotRole,
} from "@/lib/slides";
import type { TGenerationSlot } from "@/hooks/use-deck-generation";
import { useDeckGeneration } from "@/hooks/use-deck-generation";
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
import { Textarea } from "@/components/ui/textarea";

const GenerateFormSchema = z.object({
  contentDocId: z.string().min(1, "Pick a content document"),
  prompt: z.string().trim().min(1, "Describe the deck"),
  // Always a string — "" means "no design doc → default tokens" (see the picker's `noneLabel`).
  designDocId: z.string(),
});

function FieldError({ field }: { field: AnyFieldApi }) {
  if (!field.state.meta.isTouched) return null;
  const first = field.state.meta.errors[0];
  if (!first) return null;
  const message = typeof first === "string" ? first : first.message;
  return <p className="text-destructive text-xs">{message}</p>;
}

function DesignSystemView({
  sourceName,
  id,
  tokens,
  feel,
  archetypes,
}: {
  sourceName: string;
  id: string;
  tokens: ITokens;
  feel?: string | null;
  archetypes?: Array<IExtractedArchetype> | null;
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
      {archetypes && archetypes.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium">
            {archetypes.length} extracted layouts
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {archetypes.map((archetype) => (
              <ArchetypePreview
                key={archetype.id}
                archetype={archetype}
                tokens={tokens}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function previewContent(role: TSlotRole): TSlotContent {
  switch (role) {
    case "block":
      return "";
    case "tableRow":
      return { label: "Label", value: "Value" };
    case "panel":
      return { heading: "Key message", body: "Supporting detail" };
    case "body":
      return ["Key point", "Supporting point"];
    case "title":
      return "Presentation title";
    case "heading":
      return "Slide heading";
    case "eyebrow":
      return "Section label";
    case "footer":
      return "Footer";
    case "logo":
      return "Brand";
    default:
      return "Content";
  }
}

function ArchetypePreview({
  archetype,
  tokens,
}: {
  archetype: IExtractedArchetype;
  tokens: ITokens;
}) {
  const slide: ISlide = {
    id: `preview-${archetype.id}`,
    archetypeId: archetype.id,
    elements: archetype.slots.map((slot) => ({
      id: `preview-${archetype.id}--${slot.id}`,
      slotId: slot.id,
      role: slot.role,
      x: slot.x,
      y: slot.y,
      w: slot.w,
      h: slot.h,
      content: previewContent(slot.role),
      styleRef: slot.styleRef,
    })),
  };

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="bg-card aspect-video overflow-hidden rounded border">
        <SlidePreview slide={slide} tokens={tokens} />
      </div>
      <p className="text-muted-foreground truncate text-[11px]">
        {archetype.name}
      </p>
    </div>
  );
}

function SlotCard({
  index,
  state,
  tokens,
}: {
  index: number;
  state: TGenerationSlot;
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
  const contentDocs = useQuery(contentDocsQueryOptions());
  const designDocs = useQuery(designDocsQueryOptions());

  const generation = useDeckGeneration();

  const form = useForm({
    defaultValues: { contentDocId: "", designDocId: "", prompt: "" },
    validators: { onChange: GenerateFormSchema },
    onSubmit: async ({ value }) => {
      await generation.generate(value);
    },
  });

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

  const isGenerating = generation.phase === "generating";
  const editorDeck = generation.deck;
  const flagged = generation.items.flatMap((it, i) =>
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
            fonts, palette, and layouts style the deck), describe the deck, and
            slides stream in as they’re generated.
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
              <Label htmlFor="content-doc">📜 Content document</Label>
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
              <Label htmlFor="design-doc">🎨 Design</Label>
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
                    hint="The styled deck whose fonts, palette, and layouts define the look."
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
                  archetypes={doc.designArchetypes}
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

        {generation.error && (
          <p className="border-destructive/50 text-destructive rounded-md border p-3 text-sm">
            {generation.error}
          </p>
        )}

        {generation.warning && (
          <p className="border-border text-muted-foreground rounded-md border p-3 text-sm">
            {generation.warning}
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

        {generation.items.length > 0 && generation.phase !== "complete" && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {generation.items.map((state, i) => (
              <SlotCard
                key={i}
                index={i}
                state={state}
                tokens={generation.tokens}
              />
            ))}
          </div>
        )}
      </section>

      {!isGenerating && editorDeck && (
        <DeckView
          deck={editorDeck}
          tokens={generation.tokens}
          slideNumbers={generation.slideNumbers}
          onSlideChange={generation.updateSlide}
        />
      )}
    </div>
  );
}
