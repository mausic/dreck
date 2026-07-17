import { describe, expect, it } from "vitest";
import type { ISlide, ISlideElement, TSlotContent } from "@/lib/slides/types";
import { verifySlideGrounding } from "@/lib/ai/grounding";

/** Minimal element carrying only the content the grounding check reads. */
function el(
  id: string,
  content: TSlotContent,
  role: ISlideElement["role"] = "body",
): ISlideElement {
  return {
    id,
    slotId: id,
    role,
    x: 0,
    y: 0,
    w: 100,
    h: 100,
    content,
    styleRef: "",
  };
}

function slide(elements: Array<ISlideElement>): ISlide {
  return { id: "s1", archetypeId: "test", elements };
}

const SOURCE = `# Paracetamol
Regular Strength tablets contain 325 mg.
Dose for children 10 – 15 kg is 120 mg every 4 hours.
Oral suspension is 160 mg / 5 mL. DIN 02383921.`;

describe("verifySlideGrounding", () => {
  it("grounds figures that appear verbatim in the source", () => {
    const report = verifySlideGrounding(
      slide([
        el("a", "Regular Strength 325 mg"),
        el("b", { label: "10 – 15 kg", value: "120 mg" }, "tableRow"),
      ]),
      SOURCE,
    );
    expect(report.ok).toBe(true);
    expect(report.issues).toHaveLength(0);
  });

  it("flags an invented dose while a grounded band on the same row passes", () => {
    // "10 – 15 kg" is in the source; "999 mg" is invented — only the dose should flag.
    const report = verifySlideGrounding(
      slide([el("a", { label: "10 – 15 kg", value: "999 mg" }, "tableRow")]),
      SOURCE,
    );
    expect(report.ok).toBe(false);
    expect(report.issues).toHaveLength(1);
    expect(report.issues[0]).toMatchObject({ elementId: "a", token: "999 mg" });
  });

  it("normalizes dash and spacing differences when matching figures", () => {
    // Source writes "10 – 15 kg" and "160 mg / 5 mL"; slide reformats the spacing/dash.
    const report = verifySlideGrounding(
      slide([el("a", "Children 10-15 kg; suspension 160 mg / 5 mL")]),
      SOURCE,
    );
    expect(report.ok).toBe(true);
  });

  it("ignores structural small integers (not clinical figures)", () => {
    const report = verifySlideGrounding(
      slide([el("a", ["3 key benefits", "2 presentations"])]),
      SOURCE,
    );
    expect(report.ok).toBe(true);
  });

  it("grounds a DIN that appears in the source", () => {
    const report = verifySlideGrounding(
      slide([el("a", "DIN 02383921")]),
      SOURCE,
    );
    expect(report.ok).toBe(true);
  });

  it("does not ground a shorter dose inside a larger source dose", () => {
    const report = verifySlideGrounding(
      slide([el("a", "Unsupported 25 mg dose")]),
      SOURCE,
    );

    expect(report.issues).toEqual([
      expect.objectContaining({ elementId: "a", token: "25 mg" }),
    ]);
  });

  it("requires table figures to appear together in one source row", () => {
    const source = `
| Weight | Dose | Interval |
| --- | --- | --- |
| 10-15 kg | 120 mg | 4 hours |
| 16-20 kg | 160 mg | 6 hours |
`;
    const report = verifySlideGrounding(
      slide([el("a", { label: "10-15 kg", value: "160 mg" }, "tableRow")]),
      source,
    );

    expect(report.ok).toBe(false);
    expect(report.issues).toEqual([
      expect.objectContaining({
        elementId: "a",
        token: "10-15 kg: 160 mg",
      }),
    ]);
  });

  it("normalizes microgram unit spellings", () => {
    const report = verifySlideGrounding(
      slide([el("a", "Dose 50 mcg")]),
      "Dose: 50 µg",
    );

    expect(report.ok).toBe(true);
  });
});
