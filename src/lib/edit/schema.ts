import { z } from "zod";
import type { TWireContent } from "@/lib/ai/content-patch";
import type { IWireSlide } from "@/lib/generate/schema";
import { toSlotContent, zContentPatch } from "@/lib/ai/content-patch";
import { SlotContentSchema } from "@/lib/slides/slide-schema";
import { TokensSchema } from "@/lib/slides/tokens";
import { CANVAS } from "@/lib/slides/types";

export { toSlotContent, zContentPatch };
export type { TContentPatch, TWireContent } from "@/lib/ai/content-patch";

export const zSlotContent = SlotContentSchema;

export const EditRegionInputSchema = z.object({
  deckId: z.uuid(),
  slideId: z.string().min(1),
  expectedRevision: z.number().int().min(0),
  instruction: z.string().min(1).max(2000),
  selection: z
    .object({
      x: z
        .number()
        .int()
        .min(0)
        .max(CANVAS.width - 1),
      y: z
        .number()
        .int()
        .min(0)
        .max(CANVAS.height - 1),
      width: z.number().int().positive().max(CANVAS.width),
      height: z.number().int().positive().max(CANVAS.height),
    })
    .superRefine((rect, context) => {
      if (rect.x + rect.width > CANVAS.width) {
        context.addIssue({
          code: "custom",
          path: ["width"],
          message: "Selection exceeds the canvas",
        });
      }
      if (rect.y + rect.height > CANVAS.height) {
        context.addIssue({
          code: "custom",
          path: ["height"],
          message: "Selection exceeds the canvas",
        });
      }
    }),
});

export const EditModelInputSchema = z.object({
  instruction: z.string().min(1).max(2000),
  targets: z
    .array(
      z.object({
        id: z.string(),
        role: z.string(),
        content: zSlotContent,
      }),
    )
    .min(1),
  context: z.array(z.string()).default([]),
  tokens: TokensSchema.optional(),
});

export type TEditRegionInput = z.input<typeof EditRegionInputSchema>;
export type TEditRegionData = z.output<typeof EditRegionInputSchema>;
export type TEditModelData = z.output<typeof EditModelInputSchema>;

export type TWirePatch = Record<string, { content: TWireContent }>;

export const EditPatchSchema = z.object({
  updates: z.array(
    z.object({
      elementId: z.string(),
      content: zContentPatch,
    }),
  ),
});

export type TEditPatchResult = z.infer<typeof EditPatchSchema>;

export type TEditRegionResult =
  | { ok: true; patch: TWirePatch; revision: number }
  | {
      ok: false;
      error: string;
      conflict?: { slide: IWireSlide; revision: number };
    };
