import { z } from "zod";
import { jsonError } from "@/lib/api";
import { workshopRpc } from "@/server/workshop";

const schema = z.object({
  jobId: z.uuid(),
  status: z.enum(["IN_PROGRESS", "READY", "COMPLETED"]),
});

export async function PATCH(request: Request) {
  try {
    const input = schema.parse(await request.json());
    await workshopRpc("transition_repair_job", {
      p_job_id: input.jobId,
      p_status: input.status,
    });
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
