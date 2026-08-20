import { BindingObject, ObjectToBind, query, update } from 'mu';

type SelectResult = {
  head: { vars: string[] };
  results: { bindings: BindingObject<ObjectToBind>[] };
};

export async function timedQuery(queryString: string): Promise<SelectResult> {
  if (process.env.LOG_LEVEL != 'debug') {
    return query(queryString) as Promise<SelectResult>;
  }

  const start = performance.now();
  const result = await query(queryString);
  console.log(
    `[query] took ${(performance.now() - start).toFixed(2)}ms to execute`,
  );
  return result;
}

export async function timedUpdateQuery(queryString: string): Promise<void> {
  if (process.env.LOG_LEVEL != 'debug') {
    await update(queryString);
  }

  const start = performance.now();
  await update(queryString);
  console.log(
    `[update-query] took ${(performance.now() - start).toFixed(2)}ms to execute`,
  );
}
