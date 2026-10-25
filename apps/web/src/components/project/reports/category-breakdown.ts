export type CategoryTotal = {
  category: string | null;
  taskCount: number;
  totalSeconds: number;
};

// Colors follow field-option order, so filtering or ranking cannot recolor a category.
const colors = ["#5279d8", "#289e8d", "#9570ce", "#d19b32", "#c66683"];
export function categoryBreakdown(options: string[], totals: CategoryTotal[]) {
  const names = [
    ...new Set([...options, ...totals.map((row) => row.category)]),
  ];
  const totalSeconds = totals.reduce((sum, row) => sum + row.totalSeconds, 0);
  const rows = names.map((category, index) => {
    const row = totals.find((item) => item.category === category);
    const seconds = row?.totalSeconds ?? 0;
    return {
      category,
      taskCount: row?.taskCount ?? 0,
      totalSeconds: seconds,
      percent: totalSeconds > 0 ? (seconds / totalSeconds) * 100 : 0,
      color: category === null ? "#89929f" : colors[index % colors.length],
    };
  });
  rows.sort((a, b) => b.totalSeconds - a.totalSeconds);
  let offset = 0;
  return {
    totalSeconds,
    rows: rows.map((row) => {
      const start = offset;
      offset += row.percent;
      return { ...row, offset: start };
    }),
  };
}

export function categoryPercent(value: number, locale: string) {
  if (value > 0 && value < 0.1) return "<0.1%";
  return new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value / 100);
}
