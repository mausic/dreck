import type { IExtractedArchetype, ISlide, ITokens } from "@/lib/slides";
import { SlidePreview } from "@/components/slides/slide-preview";
import { previewContentForRole } from "@/lib/slides/preview-content";

export interface IDesignSystemPreviewProps {
  tokens: ITokens;
  feel?: string | null;
  archetypes?: Array<IExtractedArchetype> | null;
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
      content: previewContentForRole(slot.role),
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

export function DesignSystemPreview({
  tokens,
  feel,
  archetypes,
}: IDesignSystemPreviewProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {Object.entries(tokens.colors).map(([colorRole, hex]) => (
          <div key={colorRole} className="flex items-center gap-2">
            <span
              className="size-8 rounded border"
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
