import { useMutation } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import CircularProgress from "@/components/ui/circular-progress";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Popover, PopoverPopup, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { updateTaskPlanning } from "@/fetchers/task/update-task-planning";
import { useInvalidateTaskEffort } from "@/hooks/mutations/time-entry/use-invalidate-task-effort";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import type Task from "@/types/task";
import { PropertyValue } from "../properties/property-value";

export function TaskProgressPopover({
  task,
  completed,
  className,
}: {
  task: Pick<Task, "id" | "progress">;
  completed: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const labelId = useId();
  const { canUpdateTimeEntries } = useWorkspacePermission();
  const invalidate = useInvalidateTaskEffort(task.id);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const percentage = completed ? 100 : task.progress;
  const label = t("tasks:planning.progress");
  const save = useMutation({
    mutationFn: (amount: number | null) =>
      updateTaskPlanning(task.id, { progress: amount }),
    onSuccess: invalidate,
  });
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setError("");
        if (next) setValue(task.progress == null ? "" : String(task.progress));
      }}
    >
      <PopoverTrigger
        disabled={!canUpdateTimeEntries() || completed}
        render={<PropertyValue className={className} aria-label={label} />}
      >
        <CircularProgress completed={percentage ?? 0} total={100} size={14} />
        <span className="truncate tabular-nums">
          {percentage == null ? t("tasks:planning.unset") : `${percentage}%`}
        </span>
      </PopoverTrigger>
      <PopoverPopup align="start" className="w-80 p-3" aria-label={label}>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (save.isPending) return;
            const amount = value.trim() ? Number(value) : null;
            if (
              value.trim() &&
              (amount === null ||
                !Number.isInteger(amount) ||
                amount < 0 ||
                amount > 100)
            ) {
              setError(t("tasks:planning.invalid"));
              return;
            }
            try {
              setError("");
              await save.mutateAsync(amount);
              setOpen(false);
            } catch {
              setError(t("tasks:time.saveError"));
            }
          }}
        >
          <label id={labelId} className="sr-only">
            {label}
          </label>
          <div className="grid grid-cols-[minmax(0,1fr)_4rem_auto] items-center gap-2">
            <Slider
              min={0}
              max={100}
              step={1}
              value={[Math.max(0, Math.min(100, Number(value) || 0))]}
              onValueChange={(next) =>
                setValue(String(typeof next === "number" ? next : next[0]))
              }
              aria-labelledby={labelId}
              disabled={save.isPending}
            />
            <InputGroup className="[&_input]:px-2 [&_input]:tabular-nums [&_input]:[appearance:textfield] [&_input::-webkit-inner-spin-button]:appearance-none [&_input::-webkit-outer-spin-button]:appearance-none">
              <InputGroupInput
                type="number"
                min={0}
                max={100}
                step={1}
                autoFocus
                value={value}
                placeholder="0"
                aria-label={label}
                aria-invalid={Boolean(error)}
                disabled={save.isPending}
                onChange={(event) => setValue(event.target.value)}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>%</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            <Button
              type="submit"
              size="icon-sm"
              variant="ghost"
              disabled={save.isPending}
              aria-label={t("tasks:planning.save")}
            >
              <Check />
            </Button>
          </div>
          {error && (
            <p
              role="alert"
              className="mt-2 text-xs text-destructive-foreground"
            >
              {error}
            </p>
          )}
        </form>
      </PopoverPopup>
    </Popover>
  );
}
