import { z } from "zod";
import type { IExtractedArchetype } from "@/lib/slides/types";
import { ARCHETYPE_CATEGORIES, CANVAS, SLOT_ROLES } from "@/lib/slides/types";
import { BLOCK_STYLE_REFS, STYLE_REFS } from "@/lib/slides/styles";

const StyleRefSchema = z.enum(STYLE_REFS);

export const ExtractedSlotSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z][a-z0-9-]*$/, "Use a kebab-case slot id"),
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
    w: z.number().int().min(1).max(CANVAS.width),
    h: z.number().int().min(1).max(CANVAS.height),
    styleRef: StyleRefSchema,
  })
  .superRefine((slot, ctx) => {
    const isBlockStyle = BLOCK_STYLE_REFS.has(slot.styleRef);
    if (slot.role === "block" && !isBlockStyle) {
      ctx.addIssue({
        code: "custom",
        path: ["styleRef"],
        message: "Block slots require a visual block style",
      });
    }
    if (slot.role !== "block" && isBlockStyle) {
      ctx.addIssue({
        code: "custom",
        path: ["styleRef"],
        message: "Text slots cannot use a visual block style",
      });
    }
    if (slot.x + slot.w > CANVAS.width) {
      ctx.addIssue({
        code: "custom",
        path: ["w"],
        message: "Slot extends beyond the canvas width",
      });
    }
    if (slot.y + slot.h > CANVAS.height) {
      ctx.addIssue({
        code: "custom",
        path: ["h"],
        message: "Slot extends beyond the canvas height",
      });
    }
  });

export const ExtractedArchetypeSchema: z.ZodType<IExtractedArchetype> = z
  .object({
    id: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z][a-z0-9-]*$/, "Use a kebab-case archetype id"),
    name: z.string().min(1).max(80),
    category: z.enum(ARCHETYPE_CATEGORIES),
    description: z.string().min(1).max(240),
    slots: z.array(ExtractedSlotSchema).min(2).max(24),
  })
  .superRefine((archetype, ctx) => {
    const ids = new Set<string>();
    for (const [index, slot] of archetype.slots.entries()) {
      if (ids.has(slot.id)) {
        ctx.addIssue({
          code: "custom",
          path: ["slots", index, "id"],
          message: `Duplicate slot id: ${slot.id}`,
        });
      }
      ids.add(slot.id);
    }
    if (!archetype.slots.some((slot) => slot.role !== "block")) {
      ctx.addIssue({
        code: "custom",
        path: ["slots"],
        message: "An archetype must contain at least one text slot",
      });
    }
  });

export const ExtractedArchetypesSchema = z
  .array(ExtractedArchetypeSchema)
  .min(2)
  .max(50)
  .superRefine((archetypes, ctx) => {
    const ids = new Set<string>();
    for (const [index, archetype] of archetypes.entries()) {
      if (ids.has(archetype.id)) {
        ctx.addIssue({
          code: "custom",
          path: [index, "id"],
          message: `Duplicate archetype id: ${archetype.id}`,
        });
      }
      ids.add(archetype.id);
    }
    const coverCount = archetypes.filter(
      (archetype) => archetype.category === "cover",
    ).length;
    if (coverCount !== 1) {
      ctx.addIssue({
        code: "custom",
        message: "Exactly one cover archetype is required",
      });
    }
  });
