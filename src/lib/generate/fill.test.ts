import { describe, expect, it } from "vitest";

import type { IArchetype } from "@/lib/slides/types";
import { validateSlideFill } from "#/lib/generate/fill";

const archetype: IArchetype = {
  id: "test",
  name: "Test",
  slots: [
    {
      id: "background",
      role: "block",
      x: 0,
      y: 0,
      w: 100,
      h: 100,
      styleRef: "background",
    },
    {
      id: "title",
      role: "title",
      x: 10,
      y: 10,
      w: 80,
      h: 20,
      styleRef: "title",
    },
    {
      id: "metric",
      role: "tableRow",
      x: 10,
      y: 40,
      w: 80,
      h: 20,
      styleRef: "metric",
    },
  ],
};

describe("validateSlideFill", () => {
  it("accepts exactly one role-compatible value per fillable slot", () => {
    expect(() =>
      validateSlideFill(archetype, {
        slots: [
          { slotId: "title", content: { kind: "lines", lines: ["Title"] } },
          {
            slotId: "metric",
            content: { kind: "labelValue", label: "Dose", value: "325 mg" },
          },
        ],
      }),
    ).not.toThrow();
  });

  it.each([
    {
      name: "unknown slots",
      slots: [
        { slotId: "unknown", content: { kind: "text" as const, text: "x" } },
      ],
    },
    {
      name: "missing slots",
      slots: [
        { slotId: "title", content: { kind: "lines" as const, lines: ["x"] } },
      ],
    },
    {
      name: "wrong content kinds",
      slots: [
        { slotId: "title", content: { kind: "text" as const, text: "x" } },
        {
          slotId: "metric",
          content: { kind: "labelValue" as const, label: "a", value: "b" },
        },
      ],
    },
  ])("rejects $name", ({ slots }) => {
    expect(() => validateSlideFill(archetype, { slots })).toThrow();
  });
});
