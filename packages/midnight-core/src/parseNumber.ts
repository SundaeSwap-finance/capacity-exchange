/** Parses `raw` as a positive finite number; throws with `name` on failure. */
export function parsePositiveNumber(name: string, raw: string): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number, got: ${raw}`);
  }
  return parsed;
}
