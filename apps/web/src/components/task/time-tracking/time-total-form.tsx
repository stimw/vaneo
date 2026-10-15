import { Check } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { useSetTaskTime } from "@/hooks/mutations/time-entry/use-set-task-time";
import { hoursToSeconds } from "./time-values";

export function TimeTotalForm({
  taskId,
  totalSeconds,
  onSaved,
}: {
  taskId: string;
  totalSeconds: number;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [hours, setHours] = useState(
    String(Number((totalSeconds / 3600).toFixed(4))),
  );
  const [error, setError] = useState("");
  const save = useSetTaskTime(taskId);
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        if (save.isPending) return;
        const seconds = hoursToSeconds(hours);
        if (seconds === null) {
          setError(t("tasks:time.invalid"));
          return;
        }
        try {
          setError("");
          if (seconds !== totalSeconds) await save.mutateAsync(seconds);
          onSaved();
        } catch (cause) {
          setError(
            cause instanceof Error ? cause.message : t("tasks:time.saveError"),
          );
        }
      }}
    >
      <div className="flex items-center gap-1.5">
        <InputGroup>
          <InputGroupInput
            type="number"
            min="0"
            step="any"
            required
            autoFocus
            aria-label={t("tasks:time.hours")}
            aria-invalid={Boolean(error)}
            value={hours}
            disabled={save.isPending}
            onChange={(event) => setHours(event.target.value)}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupText>h</InputGroupText>
          </InputGroupAddon>
        </InputGroup>
        <Button
          type="submit"
          variant="ghost"
          size="icon-sm"
          disabled={save.isPending}
          aria-label={t("tasks:time.save")}
        >
          <Check />
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-destructive-foreground">
          {error}
        </p>
      )}
    </form>
  );
}
