import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useInvalidateTaskEffort } from "./use-invalidate-task-effort";
import setTaskTime from "@/fetchers/time-entry/set-task-time";
export function useSetTaskTime(taskId: string) {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateTaskEffort(taskId);
  return useMutation({
    mutationFn: (totalSeconds: number) => setTaskTime({ taskId, totalSeconds }),
    onSuccess: (data) => {
      queryClient.setQueryData(["time-entries", taskId, "total"], data);
      void invalidate();
    },
  });
}
