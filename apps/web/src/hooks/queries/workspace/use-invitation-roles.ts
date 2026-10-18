import { useQuery } from "@tanstack/react-query";
import { getInvitationRoles } from "@/fetchers/workspace/get-invitation-roles";

export function useInvitationRoles(workspaceId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["workspace-invitation-roles", workspaceId],
    queryFn: () => getInvitationRoles(workspaceId),
    enabled: enabled && workspaceId !== "",
  });
}
