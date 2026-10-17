import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { updateUploadSettings } from "@/fetchers/admin/update-upload-settings";
import type { GetConfigResponse } from "@/fetchers/config/get-config";
import { toast } from "@/lib/toast";

export function useUpdateUploadSettings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateUploadSettings,
    onSuccess: async ({ maxUploadBytes }) => {
      queryClient.setQueryData<GetConfigResponse>(["config"], (current) =>
        current ? { ...current, maxUploadBytes } : current,
      );
      await queryClient.invalidateQueries({ queryKey: ["config"] });
      toast.success(t("settings:adminUploads.saved"));
    },
    onError: (error) => {
      toast.error(error.message || t("settings:adminUploads.saveError"));
    },
  });
}
