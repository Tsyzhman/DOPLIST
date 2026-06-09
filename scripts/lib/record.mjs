export function readField(source, camelName) {
  if (!source || typeof source !== "object") {
    return "";
  }

  const snakeName = toSnakeCase(camelName);
  return source[camelName] ?? source[snakeName] ?? "";
}

export function readArray(source, camelName) {
  const value = readField(source, camelName);
  return Array.isArray(value) ? value : [];
}

export function readNumberValue(source, camelName) {
  const value = readField(source, camelName);
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function readNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function readBoolean(value, fallback) {
  if (value === undefined || value === "") {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

export function readList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function toSnakeCase(value) {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function sortByOrder(items) {
  return [...items].sort(
    (left, right) =>
      readNumberValue(left, "sortOrder") - readNumberValue(right, "sortOrder"),
  );
}

export function formatMoney(value, currency) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: currency || "RUB",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

export function addDays(date, days) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function addMonthsUtc(date, months) {
  const source = new Date(date);
  const day = source.getUTCDate();
  const target = new Date(
    Date.UTC(
      source.getUTCFullYear(),
      source.getUTCMonth() + months,
      1,
      source.getUTCHours(),
      source.getUTCMinutes(),
      source.getUTCSeconds(),
      source.getUTCMilliseconds(),
    ),
  );
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target;
}
