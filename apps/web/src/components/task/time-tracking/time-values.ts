export function formatTrackedTime(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  if (!value) return "0h";
  if (hours) return `${hours}h${minutes ? ` ${minutes}m` : ""}`;
  if (minutes) return `${minutes}m`;
  return `${value}s`;
}

export function hoursToSeconds(hours: string) {
  if (!hours.trim()) return null;
  const value = Number(hours);
  const seconds = Math.round(value * 3600);
  return Number.isFinite(value) &&
    value >= 0 &&
    Number.isSafeInteger(seconds) &&
    seconds <= 2_147_483_647
    ? seconds
    : null;
}
