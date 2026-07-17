import { z } from "zod";

import type { ISlide } from "@/lib/slides/types";
import { CANVAS, SLOT_ROLES } from "@/lib/slides/types";

export const SlotContentSchema = z.union([
  z.string(),
  z.array(z.string()),
  z.object({ label: z.string(), value: z.string() }),
  z.object({ heading: z.string(), body: z.string() }),
  z.record(z.string(), z.unknown()),
]);

export const SlideElementSchema = z
  .object({
    id: z.string().min(1),
    slotId: z.string().min(1),
    role: z.enum(SLOT_ROLES),
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
    w: z.number().int().positive().max(CANVAS.width),
    h: z.number().int().positive().max(CANVAS.height),
    content: SlotContentSchema,
    styleRef: z.string().min(1),
  })
  .superRefine((element, context) => {
    if (element.x + element.w > CANVAS.width) {
      context.addIssue({
        code: "custom",
        path: ["w"],
        message: "Element extends beyond the canvas width",
      });
    }
    if (element.y + element.h > CANVAS.height) {
      context.addIssue({
        code: "custom",
        path: ["h"],
        message: "Element extends beyond the canvas height",
      });
    }
  });

export const SlideSchema = z.object({
  id: z.string().min(1),
  archetypeId: z.string().min(1),
  elements: z.array(SlideElementSchema),
}) satisfies z.ZodType<ISlide>;
