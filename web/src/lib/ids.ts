export function generateBusinessId(family: string): string {
  const suffix = crypto.randomUUID?.() ?? String(Date.now());
  return `${family}-${suffix.slice(0, 8)}`;
}
