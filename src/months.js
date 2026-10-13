// Months are stored as the first day of the month (YYYY-MM-01).

export function currentMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function monthsAgo(n, from = currentMonth()) {
  return new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - n, 1));
}

/** 'YYYY-MM-01' for SQL DATE columns. */
export function toSqlMonth(d) {
  return d.toISOString().slice(0, 10);
}

/** Whole months between two month dates (b - a). */
export function monthsBetween(a, b) {
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
}
