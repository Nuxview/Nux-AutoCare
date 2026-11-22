import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Variables referenced in hoisted vi.mock factories must be declared with vi.hoisted()
const { mockJobAccess, mockRpc, mockAdminFrom } = vi.hoisted(() => ({
  mockJobAccess: vi.fn(),
  mockRpc: vi.fn(),
  mockAdminFrom: vi.fn(),
}));

vi.mock("@/server/auth/context", () => ({
  requireAuthenticatedUser: vi.fn(async () => ({
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    email: "advisor@garage.com",
    firstName: "Juma",
    lastName: "Ochieng",
    globalRole: "CUSTOMER",
  })),
  requireTenantMembership: vi.fn(async () => ({
    user: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
    membership: { franchise_id: "11111111-1111-4111-8111-111111111111", role: "SERVICE_ADVISOR" },
  })),
}));

vi.mock("@/server/garage/scope", () => ({
  jobAccess: mockJobAccess,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    rpc: mockRpc,
    from: mockAdminFrom,
  })),
}));

import { createJobFromBooking } from "./service";
import { PATCH as updateJobStatusRoute } from "@/app/api/jobs/status/route";
import { PATCH as updateTaskRoute } from "@/app/api/jobs/tasks/route";

const VALID_BOOKING_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const VALID_JOB_ID = "77777777-7777-4777-8777-777777777777";

describe("AREA 3: Job lifecycle transitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Initial transition from Booking to Job (createJobFromBooking)", () => {
    it("refuses job creation when booking status is not confirmed or checked-in", async () => {
      mockAdminFrom.mockImplementation((table: string) => {
        if (table === "bookings") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: VALID_BOOKING_ID,
                    franchise_id: "11111111-1111-4111-8111-111111111111",
                    shop_id: "22222222-2222-4222-8222-222222222222",
                    status: "REQUESTED",
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      // RPC checks booking status and raises INVALID_BOOKING_STATUS
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: "INVALID_BOOKING_STATUS: Booking must be confirmed" },
      });

      await expect(
        createJobFromBooking(VALID_BOOKING_ID),
      ).rejects.toMatchObject({
        status: 409,
        code: "INVALID_BOOKING_STATUS",
        message: "Confirm or check in the booking before creating a job",
      });
    });

    it("refuses job creation when a job already exists for the booking", async () => {
      mockAdminFrom.mockImplementation((table: string) => {
        if (table === "bookings") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: VALID_BOOKING_ID,
                    franchise_id: "11111111-1111-4111-8111-111111111111",
                    shop_id: "22222222-2222-4222-8222-222222222222",
                    status: "CONFIRMED",
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      mockRpc.mockResolvedValue({
        data: null,
        error: { message: "JOB_EXISTS: A job already exists for this booking" },
      });

      await expect(
        createJobFromBooking(VALID_BOOKING_ID),
      ).rejects.toMatchObject({
        status: 409,
        code: "JOB_EXISTS",
        message: "A job already exists for this booking",
      });
    });

    it("successfully creates an OPEN job from a confirmed booking (happy path)", async () => {
      mockAdminFrom.mockImplementation((table: string) => {
        if (table === "bookings") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: VALID_BOOKING_ID,
                    franchise_id: "11111111-1111-4111-8111-111111111111",
                    shop_id: "22222222-2222-4222-8222-222222222222",
                    status: "CONFIRMED",
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === "jobs") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: VALID_JOB_ID,
                    reference: "JOB-261101-ABC123",
                    status: "OPEN",
                    franchise_id: "11111111-1111-4111-8111-111111111111",
                    shop_id: "22222222-2222-4222-8222-222222222222",
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      mockRpc.mockResolvedValue({
        data: VALID_JOB_ID,
        error: null,
      });

      const job = await createJobFromBooking(VALID_BOOKING_ID);
      expect(job).toMatchObject({
        id: VALID_JOB_ID,
        status: "OPEN",
        reference: "JOB-261101-ABC123",
      });
    });
  });

  describe("Subsequent Job Stage Transitions", () => {
    function callStatusPatch(status: string) {
      return updateJobStatusRoute(new Request("http://localhost:3000/api/jobs/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: VALID_JOB_ID, status, p_actor_id: "untrusted-actor" }),
      }));
    }

    it.each(["IN_PROGRESS", "READY", "COMPLETED"])("uses one atomic RPC for %s with the verified actor", async (status) => {
      mockRpc.mockResolvedValue({ data: null, error: null });
      const response = await callStatusPatch(status);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true });
      expect(mockRpc).toHaveBeenCalledExactlyOnceWith("transition_repair_job", {
        p_actor_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        p_job_id: VALID_JOB_ID,
        p_status: status,
      });
      expect(mockAdminFrom).not.toHaveBeenCalled();
      expect(mockJobAccess).not.toHaveBeenCalled();
    });

    it.each([
      ["JOB_CLOSED", 409], ["INVALID_STAGE_TRANSITION", 409],
      ["TASKS_INCOMPLETE", 409], ["APPROVAL_REQUIRED", 409],
      ["FORBIDDEN", 403], ["NOT_FOUND", 404],
    ])("returns the %s RPC error without any independent writes", async (code, status) => {
      mockRpc.mockResolvedValue({ data: null, error: { message: code } });
      const response = await callStatusPatch("READY");
      expect(response.status).toBe(status);
      expect(await response.json()).toMatchObject({ error: { code } });
      expect(mockAdminFrom).not.toHaveBeenCalled();
    });

    describe("task updates", () => {
      const taskId = "88888888-8888-4888-8888-888888888888";
      const patchTask = () => updateTaskRoute(new Request("http://localhost:3000/api/jobs/tasks", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, status: "IN_PROGRESS" }),
      }));

      beforeEach(() => {
        mockJobAccess.mockResolvedValue({ job: { id: VALID_JOB_ID, status: "APPROVED" } });
        mockAdminFrom.mockReturnValue({
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { job_id: VALID_JOB_ID }, error: null }) }) }),
        });
      });

      it("uses one RPC after validating the job and returns the saved task", async () => {
        mockRpc.mockResolvedValue({ data: { id: taskId, status: "IN_PROGRESS" }, error: null });
        const response = await patchTask();
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ task: { id: taskId, status: "IN_PROGRESS" } });
        expect(mockJobAccess).toHaveBeenCalledWith(VALID_JOB_ID, true);
        expect(mockRpc).toHaveBeenCalledExactlyOnceWith("update_repair_task", {
          p_task_id: taskId, p_job_id: VALID_JOB_ID, p_status: "IN_PROGRESS", p_note: null,
        });
        expect(mockAdminFrom).toHaveBeenCalledExactlyOnceWith("repair_tasks");
      });

      it.each([
        ["JOB_READY", 409, "JOB_READY"],
        ["TENANT_READ_ONLY", 403, "TENANT_READ_ONLY"],
        ["TASK_NOT_FOUND", 404, "NOT_FOUND"],
      ])("maps the %s error from the same transaction", async (error, status, code) => {
        mockRpc.mockResolvedValue({ data: null, error: { message: error } });
        const response = await patchTask();
        expect(response.status).toBe(status);
        expect(await response.json()).toMatchObject({ error: { code } });
        expect(mockAdminFrom).toHaveBeenCalledExactlyOnceWith("repair_tasks");
      });
    });

    it("reports an unclassified database failure as 500", async () => {
      const logged = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        mockRpc.mockResolvedValue({ data: null, error: { message: "Injected database write failure" } });
        const response = await callStatusPatch("READY");
        expect(response.status).toBe(500);
        expect(await response.json()).toMatchObject({ error: { code: "INTERNAL_ERROR" } });
      } finally { logged.mockRestore(); }
    });
  });
});
