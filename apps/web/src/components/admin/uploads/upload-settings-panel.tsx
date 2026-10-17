import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsPage } from "@/components/settings/settings-page";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { useUpdateUploadSettings } from "@/hooks/mutations/admin/use-update-upload-settings";
import useGetConfig from "@/hooks/queries/config/use-get-config";

const MIB = 1024 * 1024;

export function UploadSettingsPanel() {
  const { t } = useTranslation();
  const { data, isPending, isError, refetch } = useGetConfig();
  const update = useUpdateUploadSettings();
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? (data ? String(data.maxUploadBytes / MIB) : "");
  const size = Number(value);
  const valid =
    value !== "" && Number.isInteger(size) && size >= 1 && size <= 1024;
  const dirty = draft !== null && size * MIB !== data?.maxUploadBytes;
  const invalid = draft !== null && !valid;

  return (
    <SettingsPage
      title={t("settings:adminUploads.title")}
      description={t("settings:adminUploads.subtitle")}
    >
      <SettingsCard>
        {isPending ? (
          <div
            role="status"
            className="flex items-center gap-2 p-4 text-sm text-muted-foreground"
          >
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            {t("settings:adminUploads.loading")}
          </div>
        ) : isError ? (
          <div className="flex items-center justify-between gap-4 p-4">
            <p role="alert" className="text-sm text-destructive">
              {t("settings:adminUploads.loadError")}
            </p>
            <Button type="button" variant="outline" onClick={() => refetch()}>
              {t("settings:adminUploads.retry")}
            </Button>
          </div>
        ) : (
          <form
            className="p-4"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!valid || !dirty || update.isPending) return;
              try {
                await update.mutateAsync(size * MIB);
                setDraft(null);
              } catch {
                // Keep the unsaved value available for another attempt.
              }
            }}
          >
            <Field name="maxUploadMiB" invalid={invalid} className="gap-3">
              <FieldLabel>{t("settings:adminUploads.maxFileSize")}</FieldLabel>
              <div className="flex w-full items-center gap-3">
                <InputGroup className="max-w-40">
                  <InputGroupInput
                    type="number"
                    min={1}
                    max={1024}
                    step={1}
                    required
                    value={value}
                    onChange={(event) => setDraft(event.target.value)}
                    disabled={update.isPending}
                    aria-invalid={invalid}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>MiB</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
                <Button
                  type="submit"
                  disabled={!valid || !dirty || update.isPending}
                >
                  {update.isPending ? (
                    <Loader2
                      aria-hidden="true"
                      className="size-4 animate-spin"
                    />
                  ) : null}
                  {t("settings:adminUploads.save")}
                </Button>
              </div>
              <FieldDescription>
                {t("settings:adminUploads.limitHint")}
              </FieldDescription>
              {invalid ? (
                <FieldError match>
                  {t("settings:adminUploads.invalidLimit")}
                </FieldError>
              ) : null}
            </Field>
          </form>
        )}
      </SettingsCard>
      <p className="text-xs text-muted-foreground">
        {t("settings:adminUploads.proxyHint")}
      </p>
    </SettingsPage>
  );
}
