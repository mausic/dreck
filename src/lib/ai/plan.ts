/**
 * The planner: one model call that turns the user's brief + a compact document overview into
 * a {@link TSlidePlan}. The prompt drives the slide count (a 3-topic brief → ~3 slides); the
 * model selects which sections feed each slide. This is the ONLY planning call — the code
 * loop in `generate-deck.ts` owns everything after it (pick archetype → fill → verify).
 *
 * {@link fallbackPlan} is the deterministic safety net: if planning throws or returns nothing
 * usable, a sensible plan is derived from the top-level sections so a planner hiccup can never
 * break generation.
 */
import { generateObject } from "ai";
import type { ISection } from "@/lib/extract/section";
import type { TSlidePlan } from "@/lib/ai/generate-schema";
import type { TDocOverview } from "@/lib/ai/sections";
import { MAX_SLIDES, SlidePlanSchema } from "@/lib/ai/generate-schema";
import { PLAN_SYSTEM_PROMPT, buildPlanPrompt } from "@/lib/ai/generate-prompt";
import { getGenerateModel } from "@/lib/ai/model";
import { withModelRetry } from "@/lib/ai/retry";

/** Run the planner. Throws on a missing key / model / parse failure — the caller falls back. */
export async function planDeck(
  brief: string,
  overview: TDocOverview,
  archetypeIds: Array<string>,
): Promise<TSlidePlan> {
  // Class-aware retry (see retry.ts): quick backoff for a transient overload, none for a
  // rate-limit wall. SDK-level retry is off so it never does the provider's long 429 wait.
  const result = await withModelRetry(() =>
    generateObject({
      model: getGenerateModel(),
      schema: SlidePlanSchema,
      system: PLAN_SYSTEM_PROMPT,
      prompt: buildPlanPrompt(brief, overview, archetypeIds),
      maxRetries: 0,
    }),
  );
  return result.object;
}

/**
 * Deterministic fallback plan: one slide per top-level section (skipping a leading preamble),
 * capped at 3, so a broken planner still yields a demoable 2–3 slide deck. If the document has
 * no sections at all, returns a single cover slide with no sections.
 */
export function fallbackPlan(sections: Array<ISection>): TSlidePlan {
  const roots = sections.filter((s) => s.kind !== "preamble");
  const chosen = (roots.length > 0 ? roots : sections).slice(
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
