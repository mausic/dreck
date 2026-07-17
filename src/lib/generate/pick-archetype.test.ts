import { describe, expect, it } from "vitest";
import type { ISection } from "@/lib/extract/section";
import type { IExtractedArchetype } from "@/lib/slides/types";
import type { IArchetypeInput } from "@/lib/generate/pick-archetype";
import {
  analyzeContentShape,
  pickArchetype,
  planArchetypes,
  planExtractedArchetypes,
} from "@/lib/generate/pick-archetype";

function section(content: string): ISection {
  return { id: "s", title: "", kind: "body", content };
}

function input(
  content: string,
  opts: {
    index?: number;
    intent?: string;
    title?: string;
    archetypeId?: string;
    empty?: boolean;
  } = {},
): IArchetypeInput {
  return {
    index: opts.index ?? 1,
    item: {
      intent: opts.intent ?? "",
      title: opts.title ?? "",
      sectionIds: opts.empty ? [] : ["s"],
      archetypeId: opts.archetypeId,
    },
    sections: opts.empty ? [] : [section(content)],
  };
}

// Homogeneous parallel items (no colons) — the card-grid signal.
const PARALLEL = `- Paracetamol relieves mild to moderate pain
- Ibuprofen reduces inflammation and fever
- Naproxen eases aches and lowers temperature`;

// Many label→value bullets — the table-sidebar signal.
const LABEL_VALUE = `- Weight 4-6 kg: 40 mg
- Weight 7-9 kg: 60 mg
- Weight 10-12 kg: 90 mg
- Weight 13-15 kg: 120 mg
- Weight 16-20 kg: 150 mg`;

describe("analyzeContentShape", () => {
  it("counts parallel items and marks them homogeneous", () => {
    const shape = analyzeContentShape(input(PARALLEL));
    expect(shape.itemCount).toBe(3);
    expect(shape.homogeneous).toBe(true);
    expect(shape.labelValueCount).toBe(0);
  });

  it("counts label→value rows and headline metrics", () => {
    const shape = analyzeContentShape(input(LABEL_VALUE));
    expect(shape.itemCount).toBe(5);
    expect(shape.labelValueCount).toBe(5);
    // Each band carries two metrics (a weight in kg and a dose in mg).
    expect(shape.metricCount).toBeGreaterThanOrEqual(5);
  });
});

describe("pickArchetype — shape → archetype", () => {
  it("opening slide (index 0) → title", () => {
    expect(pickArchetype(input(PARALLEL, { index: 0 }))).toBe("title");
  });

  it("cover with no sections → title", () => {
    expect(pickArchetype(input("", { index: 0, empty: true }))).toBe("title");
  });

  it("3 parallel homogeneous items → card-grid-3", () => {
    expect(pickArchetype(input(PARALLEL))).toBe("card-grid-3");
  });

  it("many label→value pairs → table-sidebar", () => {
    expect(pickArchetype(input(LABEL_VALUE))).toBe("table-sidebar");
  });

  it("content dominated by headline numbers → stat (count by metrics)", () => {
    const content = `Peak plasma concentration reaches 500 mg
Absolute bioavailability of 88%
Onset within 30 minutes`;
    expect(pickArchetype(input(content))).toBe("stat-3");
  });

  it("a pure transition → section-divider", () => {
    const chosen = pickArchetype(
      input("Safety", { index: 3, intent: "Part two", title: "Section 2" }),
    );
    expect(chosen).toBe("section-divider");
  });

  it("a strong single statement / warning → callout", () => {
    const chosen = pickArchetype(
      input("Do not exceed the maximum daily dose.", {
        index: 2,
        intent: "Key safety warning",
        title: "Warning",
      }),
    );
    expect(chosen).toBe("callout");
  });
});

describe("pickArchetype — planner suggestion validation", () => {
  // 3 non-homogeneous items with one metric: card-grid (0.55) narrowly beats stat (0.5).
  const AMBIGUOUS = `- A short one
- A considerably longer descriptive item with far more text than the others in this list
- 500 mg dose`;

  it("defaults to the shape's best fit with no suggestion", () => {
    expect(pickArchetype(input(AMBIGUOUS))).toBe("card-grid-3");
  });

  it("honors a suggestion that genuinely fits the shape", () => {
    expect(pickArchetype(input(AMBIGUOUS, { archetypeId: "stat" }))).toBe(
      "stat-1",
    );
  });

  it("honors a feasible suggestion even when the shape prefers another archetype", () => {
    // LABEL_VALUE scores highest for table-sidebar, but card-grid is feasible (>=2 items),
    // so the planner's choice is kept — this is what lets the planner drive layout variety.
    expect(
      pickArchetype(input(LABEL_VALUE, { archetypeId: "card-grid" })),
    ).toBe("card-grid-4");
  });

  it("overrides a suggestion that is structurally impossible", () => {
    // PARALLEL has no numbers, so "stat" is infeasible and the shape's card-grid wins.
    expect(pickArchetype(input(PARALLEL, { archetypeId: "stat" }))).toBe(
      "card-grid-3",
    );
  });

  it("overrides a suggestion that does not fit the shape", () => {
    // "title" cannot fit a mid-deck content slide, so the shape wins.
    expect(pickArchetype(input(AMBIGUOUS, { archetypeId: "title" }))).toBe(
      "card-grid-3",
    );
  });
});

describe("planArchetypes — deck-level diversity", () => {
  // Shape where card-grid (0.8) and two-column (0.7) sit close, so the diversity
  // penalty breaks the tie toward the unused layout on repeats.
  const MIXED = `Overview paragraph line one describing the topic here.
Another prose sentence adding context to the same topic.
- First parallel item with a description here
- Second parallel item with a description text
- Third parallel item with a description words`;

  it("varies layouts across near-identical slides instead of repeating one", () => {
    const results = planArchetypes([input(MIXED), input(MIXED), input(MIXED)]);
    expect(new Set(results).size).toBeGreaterThan(1);
  });

  it("a single-slide pick stays the strongest fit (no diversity pressure)", () => {
    expect(pickArchetype(input(MIXED))).toBe("card-grid-3");
  });

  it("diversifies when the planner repeats one archetype past the cap", () => {
    const slides = Array.from({ length: 4 }, () =>
      input(LABEL_VALUE, { archetypeId: "table-sidebar" }),
    );
    const results = planArchetypes(slides);
    expect(new Set(results).size).toBeGreaterThan(1);
  });
});

describe("planExtractedArchetypes", () => {
  const archetypes: Array<IExtractedArchetype> = [
    {
      id: "deck-opening",
      name: "Deck opening",
      category: "cover",
      description: "Cover",
      slots: [],
    },
    {
      id: "deck-split",
      name: "Deck split",
      category: "mixed",
      description: "Split content",
      slots: [],
    },
    {
      id: "deck-emphasis",
      name: "Deck emphasis",
      category: "statement",
      description: "Emphasized statement",
      slots: [],
    },
  ];

  it("forces the extracted cover for the first slide", () => {
    const result = planExtractedArchetypes(
      [input("", { index: 0, archetypeId: "deck-split" })],
      archetypes,
    );
    expect(result[0].id).toBe("deck-opening");
  });

  it("honors an exact non-cover id from the extracted catalog", () => {
    const result = planExtractedArchetypes(
      [input("Content", { archetypeId: "deck-emphasis" })],
      archetypes,
    );
    expect(result[0].id).toBe("deck-emphasis");
  });

  it("uses content shape when a suggested id is absent or incompatible", () => {
    const result = planExtractedArchetypes(
      [
        input(
          `A detailed opening paragraph for the topic.
Supporting context follows on another line.
Further explanation belongs in the main body.
The final line completes the overview.`,
          { archetypeId: "missing" },
        ),
        input("Important warning", {
          archetypeId: "deck-opening",
          intent: "Key warning",
        }),
      ],
      archetypes,
    );
    expect(result.map((archetype) => archetype.id)).toEqual([
      "deck-split",
      "deck-emphasis",
    ]);
  });
});
