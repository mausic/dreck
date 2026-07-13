import { describe, expect, it } from "vitest";
import { runWithConcurrency } from "@/lib/ai/concurrency";

interface ITrack {
  inFlight: number;
  peak: number;
}

/** A thunk that is "running" for `ms`, tracking peak simultaneous in-flight count. */
function delayed<T>(ms: number, value: T, track: ITrack): () => Promise<T> {
  return () =>
    new Promise((resolve) => {
      track.inFlight += 1;
      track.peak = Math.max(track.peak, track.inFlight);
      setTimeout(() => {
        track.inFlight -= 1;
        resolve(value);
      }, ms);
    });
}

async function collect<T>(gen: AsyncGenerator<T>): Promise<Array<T>> {
  const out: Array<T> = [];
  for await (const v of gen) out.push(v);
  return out;
}

describe("runWithConcurrency", () => {
  it("never runs more than `limit` thunks at once, and emits every result", async () => {
    const track: ITrack = { inFlight: 0, peak: 0 };
    const thunks = Array.from({ length: 12 }, (_, i) => delayed(10, i, track));

    const out = await collect(runWithConcurrency(thunks, 5));

    expect(track.peak).toBeLessThanOrEqual(5);
    expect(out.slice().sort((a, b) => a - b)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]);
  });

  it("yields in completion order, not submission order", async () => {
    const track: ITrack = { inFlight: 0, peak: 0 };
    const thunks = [
      delayed(40, "a", track),
      delayed(10, "b", track),
      delayed(25, "c", track),
    ];

    expect(await collect(runWithConcurrency(thunks, 5))).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("handles fewer thunks than the limit and an empty list", async () => {
    const track: ITrack = { inFlight: 0, peak: 0 };
    expect(
      await collect(runWithConcurrency([delayed(5, "only", track)], 5)),
    ).toEqual(["only"]);
    expect(await collect(runWithConcurrency([], 5))).toEqual([]);
  });
});
