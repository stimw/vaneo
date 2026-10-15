import { useMutation, useQueryClient } from "@tanstack/react-query";
import setTaskTime from "@/fetchers/time-entry/set-task-time";
export function useSetTaskTime(taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (totalSeconds: number) => setTaskTime({ taskId, totalSeconds }),
    onSuccess: (data) => {
      queryClient.setQueryData(["time-entries", taskId, "total"], data);
      void queryClient.invalidateQueries({
        queryKey: ["time-entries", taskId],
      });
    },
  });
}
