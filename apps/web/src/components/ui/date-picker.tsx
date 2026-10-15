import { format, isValid, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverPopup, PopoverTrigger } from "@/components/ui/popover";

function parsedDate(value?: string) {
  if (!value) return undefined;
  const date = parseISO(value);
  return isValid(date) ? date : undefined;
}

export function DatePicker({
  id,
  labelledBy,
  value,
  onValueChange,
  disabled,
  min,
  max,
}: {
  id: string;
  labelledBy: string;
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  min?: string;
  max?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = parsedDate(value);
  const before = parsedDate(min);
  const after = parsedDate(max);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        id={id}
        disabled={disabled}
        aria-labelledby={labelledBy}
        aria-describedby={`${id}-value`}
        render={
          <Button
            type="button"
            variant="outline"
            className="w-full min-w-0 justify-start font-normal"
          />
        }
      >
        <CalendarIcon aria-hidden="true" />
        <span id={`${id}-value`} className="truncate">
          {selected ? format(selected, "MMM d, yyyy") : "—"}
        </span>
      </PopoverTrigger>
      <PopoverPopup
        align="start"
        className="w-auto"
        aria-labelledby={labelledBy}
      >
        <Calendar
          mode="single"
          required
          autoFocus
          selected={selected}
          defaultMonth={selected}
          disabled={[
            ...(before ? [{ before }] : []),
            ...(after ? [{ after }] : []),
          ]}
          onSelect={(date) => {
            onValueChange(format(date, "yyyy-MM-dd"));
            setOpen(false);
          }}
        />
      </PopoverPopup>
    </Popover>
  );
}
