export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

export function readValue(source: Record<string, unknown>, camelName: string) {
  return source[camelName] ?? source[toSnakeCase(camelName)];
}

export function readString(source: unknown, camelName: string) {
  const value = readValue(asRecord(source), camelName);
  return typeof value === "string" ? value : "";
}

export function readNumber(source: unknown, camelName: string) {
  const value = readValue(asRecord(source), camelName);
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function readArray<T>(source: unknown, camelName: string): T[] {
  const value = readValue(asRecord(source), camelName);
  return Array.isArray(value) ? (value as T[]) : [];
}

export function toSnakeCase(value: string) {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}
