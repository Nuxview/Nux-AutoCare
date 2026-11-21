import { ApiError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuthenticatedUser } from "@/server/auth/context";

export type WorkshopDbClient = ReturnType<typeof createAdminClient>;

/**
 * Executes a workshop RPC with the authenticated user as actor.
 *
 * @param name - Postgres RPC function name.
 * @param args - RPC argument map.
 * @param admin - Optional Supabase admin client override for dependency injection.
 * @returns RPC response payload.
 */
export async function workshopRpc(
  name: string,
  args: Record<string, unknown>,
  admin: WorkshopDbClient = createAdminClient(),
) {
  const user = await requireAuthenticatedUser();
  const { data, error } = await admin.rpc(name, {
    ...args,
    p_actor_id: user.id,
  });
  if (error) {
    const messages: Record<string, string> = {
      FORBIDDEN: "You do not have permission for this action.",
      NOT_FOUND: "Repair job not found",
      INVALID_STAGE_TRANSITION: "This repair cannot move to the requested stage.",
      TASKS_INCOMPLETE: "Complete every repair step first",
      APPROVAL_REQUIRED:
        "The customer must approve the latest quote before work continues.",
      QUOTE_CHANGED:
        "This quote has changed. Refresh and review the latest version.",
      JOB_CLOSED: "This job is closed or already invoiced.",
      INVALID_LINES: "Check the quote lines and stock items.",
      INSUFFICIENT_STOCK: "There is not enough stock for this repair.",
      EXCEEDS_APPROVED:
        "The parts exceed the approved quote. Request a revised approval first.",
      INVALID_RETURN: "You cannot return more parts than this job used.",
      SLOT_CONFLICT: "The mechanic or bay is already booked during that time.",
      INVALID_SCHEDULE:
        "Choose a valid slot within opening hours and an available mechanic and bay.",
      INVITATION_INVALID:
        "This invitation is expired, revoked, or belongs to a different email address.",
      MEMBERSHIP_EXISTS: "This account already belongs to a garage.",
      PARTS_MISMATCH:
        "Record the approved stock parts used before issuing the invoice.",
    };
    const code = Object.keys(messages).find((key) =>
      error.message.includes(key),
    );
    if (code)
      throw new ApiError(
        code === "NOT_FOUND" ? 404 : code === "FORBIDDEN" ? 403 : 409,
        messages[code],
        code,
      );
    throw error;
  }
  return data;
}
