import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function getInvitationRoles(workspaceId: string) {
  const response = await client.workspace[":workspaceId"][
    "invitation-roles"
  ].$get({
    param: { workspaceId },
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
