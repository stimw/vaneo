function localDay(value: string, nextDay = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  )
    return null;
  if (nextDay) date.setDate(date.getDate() + 1);
  return date;
}

export function completedReportPeriod(from: string, to: string) {
  if (from > to) return null;
  const start = localDay(from);
  const end = localDay(to, true);
  if (!start || !end || start >= end) return null;
  return {
    from: start.toISOString(),
    to: end.toISOString(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}
