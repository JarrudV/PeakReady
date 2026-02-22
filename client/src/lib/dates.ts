export function toISODate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function parseISODate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function subWeeks(date: Date, weeks: number) {
  return addDays(date, -7 * weeks);
}

export function nextDow(from: Date, dow: number) {
  const d = new Date(from);
  const diff = (dow - d.getDay() + 7) % 7;
  return addDays(d, diff);
}
