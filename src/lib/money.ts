export function formatKr(value: number, digits = 0) {
  return `${new Intl.NumberFormat("da-DK", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)} kr.`;
}

export function formatMinorKr(value: number, digits = 2) {
  return formatKr(value / 100, digits);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("da-DK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

export function parseDanishAmountToMinor(value: string) {
  const normalized = value
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const amount = Number(normalized);

  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
}
