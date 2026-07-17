export async function* runWithConcurrency<TValue>(
  thunks: Array<() => Promise<TValue>>,
  limit: number,
  shouldContinue: (value: TValue) => boolean = () => true,
): AsyncGenerator<TValue> {
  const executing = new Map<number, Promise<{ key: number; value: TValue }>>();
  let next = 0;

  const launch = (): void => {
    const key = next++;
    executing.set(key, (async () => ({ key, value: await thunks[key]() }))());
  };

  const cap = Math.max(1, limit);
  let stopped = false;
  while (executing.size < cap && next < thunks.length) launch();
  while (executing.size > 0) {
    const { key, value } = await Promise.race(executing.values());
    executing.delete(key);
    yield value;
    if (!shouldContinue(value)) stopped = true;
    if (!stopped && next < thunks.length) launch();
  }
}
