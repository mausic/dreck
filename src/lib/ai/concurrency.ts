/**
 * A tiny bounded-concurrency pool that yields results as they settle.
 *
 * Pulled out of `generate-deck.ts` so the (subtle) pool logic is pure and unit-testable without
 * dragging in the server function or the DB.
 */

/**
 * Run async thunks with at most `limit` in flight, yielding each result in COMPLETION order (not
 * submission order). Each in-flight promise resolves to `{ key, value }` and stays in the map until
 * its value has been yielded, so a result that settles while the caller is suspended at a `yield`
 * is never dropped. New work is launched only as prior results are consumed, so the number of
 * outstanding thunks never exceeds `limit`.
 *
 * The thunks MUST resolve (not reject) — model tasks here return a discriminated outcome instead of
 * throwing, so the pool never rejects and every thunk's result is surfaced.
 */
export async function* runWithConcurrency<TValue>(
  thunks: Array<() => Promise<TValue>>,
  limit: number,
): AsyncGenerator<TValue> {
  const executing = new Map<number, Promise<{ key: number; value: TValue }>>();
  let next = 0;

  const launch = (): void => {
    const key = next++;
    executing.set(key, (async () => ({ key, value: await thunks[key]() }))());
  };

  const cap = Math.max(1, limit);
  while (executing.size < cap && next < thunks.length) launch();
  while (executing.size > 0) {
    const { key, value } = await Promise.race(executing.values());
    executing.delete(key);
    yield value;
    if (next < thunks.length) launch();
  }
}
