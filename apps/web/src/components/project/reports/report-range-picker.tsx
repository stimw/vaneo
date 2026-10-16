import {
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";
import { CalendarDays, ChevronDown } from "lucide-react";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverPopup, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/cn";

export function ReportRangePicker({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>();
  const today = new Date();
  const previousMonth = subMonths(today, 1);
  const presets = [
    {
      label: t("tasks:reports.thisMonth"),
      start: startOfMonth(today),
      end: today,
    },
    {
      label: t("tasks:reports.last7Days"),
      start: subDays(today, 6),
      end: today,
    },
    {
      label: t("tasks:reports.last30Days"),
      start: subDays(today, 29),
      end: today,
    },
    {
      label: t("tasks:reports.lastMonth"),
      start: startOfMonth(previousMonth),
      end: endOfMonth(previousMonth),
    },
  ];
  const selected = draft ?? { from: parseISO(from), to: parseISO(to) };
  const preset = presets.find(
    (p) =>
      format(p.start, "yyyy-MM-dd") === from &&
      format(p.end, "yyyy-MM-dd") === to,
  );
  return (
    <Popover
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (value) setDraft(undefined);
      }}
    >
      <PopoverTrigger
        render={<Button variant="outline" size="sm" />}
        aria-label={t("tasks:reports.changePeriod")}
      >
        <CalendarDays aria-hidden="true" />
        <span className="hidden sm:inline">
          {preset?.label ?? t("tasks:reports.customRange")}
        </span>
        <span className="hidden text-muted-foreground sm:inline">·</span>
        {format(parseISO(from), "MMM d")} –{" "}
        {format(parseISO(to), "MMM d, yyyy")}
        <ChevronDown aria-hidden="true" />
      </PopoverTrigger>
      <PopoverPopup
        align="end"
        className="w-auto"
        aria-label={t("tasks:reports.changePeriod")}
      >
        <div className="flex max-sm:flex-col">
          <div className="flex min-w-36 flex-col gap-0.5 border-r p-2 max-sm:flex-row max-sm:flex-wrap max-sm:border-r-0 max-sm:border-b">
            {presets.map((p) => (
              <Button
                key={p.label}
                variant="ghost"
                size="sm"
                className={cn(
                  "justify-start",
                  preset?.label === p.label && !draft && "bg-accent",
                )}
                onClick={() => {
                  onChange(
                    format(p.start, "yyyy-MM-dd"),
                    format(p.end, "yyyy-MM-dd"),
                  );
                  setOpen(false);
                }}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <div>
            <Calendar
              mode="range"
              selected={selected}
              onSelect={(range, day) => {
                setDraft(
                  !draft || draft.to ? { from: day, to: undefined } : range,
                );
              }}
              defaultMonth={parseISO(from)}
              numberOfMonths={1}
              disabled={{ after: today }}
              autoFocus
            />
            <div className="flex items-center justify-between gap-4 border-t p-2">
              <span className="text-xs text-muted-foreground">
                {t("tasks:reports.bothDatesIncluded")}
              </span>
              <Button
                size="sm"
                disabled={!selected.from || !selected.to}
                onClick={() => {
                  if (!selected.from || !selected.to) return;
                  onChange(
                    format(selected.from, "yyyy-MM-dd"),
                    format(selected.to, "yyyy-MM-dd"),
                  );
                  setOpen(false);
                }}
              >
                {t("tasks:reports.apply")}
              </Button>
            </div>
          </div>
        </div>
      </PopoverPopup>
    </Popover>
  );
}
