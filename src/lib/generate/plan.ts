import { generateObject } from "ai";
import type { ISection } from "@/lib/extract/section";
import type { IArchetypeDescriptor } from "@/lib/slides/types";
import type { TSlidePlan } from "@/lib/generate/schema";
import type { TDocOverview } from "@/lib/generate/sections";
import { MAX_SLIDES, SlidePlanSchema } from "@/lib/generate/schema";
import { PLAN_SYSTEM_PROMPT, buildPlanPrompt } from "@/lib/generate/prompt";
import { flattenSections } from "@/lib/generate/sections";
import { getGenerateModel } from "@/lib/ai/model";
import { withModelRetry } from "@/lib/ai/retry";

export async function planDeck(
  brief: string,
  overview: TDocOverview,
  archetypes: Array<IArchetypeDescriptor>,
): Promise<TSlidePlan> {
  const result = await withModelRetry(() =>
    generateObject({
      model: getGenerateModel(),
      schema: SlidePlanSchema,
      system: PLAN_SYSTEM_PROMPT,
      prompt: buildPlanPrompt(brief, overview, archetypes),
      maxRetries: 0,
    }),
  );
  return result.object;
}

export function fallbackPlan(sections: Array<ISection>): TSlidePlan {
  const substantive = flattenSections(sections).filter(
    (section) =>
      section.kind !== "preamble" && section.content.trim().length > 0,
  );
  const chosen = (substantive.length > 0 ? substantive : sections).slice(
    0,
    Math.min(3, MAX_SLIDES),
  );

  if (chosen.length === 0) {
    return {
      slides: [{ intent: "Overview", title: "Overview", sectionIds: [] }],
    };
  }

  return {
    slides: chosen.map((s, i) => ({
      intent: s.title || `Section ${i + 1}`,
      title: s.title || `Slide ${i + 1}`,
      sectionIds: [s.id],
    })),
  };
}
