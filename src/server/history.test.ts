import { beforeEach, describe, expect, it, vi } from "vitest";
const fixtures = vi.hoisted(() => ({
  tables: {} as Record<string, unknown>,
  calls: [] as Array<[string, string, unknown[]]>,
  tenant: vi.fn(),
}));
vi.mock("@/server/auth/context", () => ({
  requireAuthenticatedUser: async () => ({
    id: "viewer",
    email: "viewer@example.com",
  }),
  requireTenantMembership: fixtures.tenant,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      const filters = new Map<string, unknown>();
      for (const method of [
        "select",
        "eq",
        "in",
        "order",
        "maybeSingle",
        "upsert",
        "delete",
      ]) {
        chain[method] = (...args: unknown[]) => {
          fixtures.calls.push([table, method, args]);
          if (method === "eq") filters.set(String(args[0]), args[1]);
          return chain;
        };
      }
      chain.then = (resolve: (value: unknown) => void) => {
        const row = fixtures.tables[table] as
          | Record<string, unknown>
          | undefined;
        const deniedOwner =
          table === "vehicles" &&
          filters.has("owner_id") &&
          row?.owner_id !== filters.get("owner_id");
        return resolve({
          data: deniedOwner ? null : (fixtures.tables[table] ?? []),
          error: null,
        });
      };
      return chain;
    },
  }),
}));
import { vehicleHistory } from "./history";
import {
  GET as historyRoute,
  POST as changeHistory,
} from "@/app/api/history/route";
import { GET as historyReport } from "@/app/api/history/report/route";
const vehicleId = "00000000-0000-4000-8000-000000000030";
const franchiseId = "00000000-0000-4000-8000-000000000010";
function shareRequest(enabled: boolean) {
  return new Request("http://localhost/api/history", {
    method: "POST",
    body: JSON.stringify({
      action: "share",
      vehicleId,
      franchiseId,
      enabled,
      owner_id: "forged-owner",
    }),
  });
}
describe("customer-controlled vehicle history", () => {
  beforeEach(() => {
    fixtures.calls = [];
    fixtures.tenant.mockReset();
    fixtures.tables = {
      vehicles: { id: "vehicle", owner_id: "owner", registration: "KDA 123A" },
      memberships: [{ franchise_id: "garage", role: "MECHANIC" }],
      vehicle_history_shares: [],
      jobs: [],
    };
  });
  it("denies a garage when the owner has not shared the history", async () => {
    await expect(vehicleHistory("vehicle")).rejects.toMatchObject({
      status: 403,
    });
    expect(fixtures.calls.some(([table]) => table === "jobs")).toBe(false);
  });
  it.each([true, false])(
    "rejects non-owner consent changes (enabled=%s)",
    async (enabled) => {
      const response = await changeHistory(shareRequest(enabled));
      expect(response.status).toBe(403);
      expect(fixtures.calls).toContainEqual([
        "vehicles",
        "eq",
        ["owner_id", "viewer"],
      ]);
      expect(
        fixtures.calls.some(([, method]) =>
          ["upsert", "delete"].includes(method),
        ),
      ).toBe(false);
    },
  );
  it("lets the owner grant consent using the server-verified identity", async () => {
    fixtures.tables.vehicles = { id: vehicleId, owner_id: "viewer" };
    expect((await changeHistory(shareRequest(true))).status).toBe(200);
    expect(fixtures.calls).toContainEqual([
      "vehicle_history_shares",
      "upsert",
      [
        {
          vehicle_id: vehicleId,
          owner_id: "viewer",
          franchise_id: franchiseId,
        },
      ],
    ]);
  });
  it("lets the owner revoke only their consent for the selected vehicle and garage", async () => {
    fixtures.tables.vehicles = { id: vehicleId, owner_id: "viewer" };
    expect((await changeHistory(shareRequest(false))).status).toBe(200);
    expect(
      fixtures.calls.filter(([table]) => table === "vehicle_history_shares"),
    ).toEqual([
      ["vehicle_history_shares", "delete", []],
      ["vehicle_history_shares", "eq", ["vehicle_id", vehicleId]],
      ["vehicle_history_shares", "eq", ["owner_id", "viewer"]],
      ["vehicle_history_shares", "eq", ["franchise_id", franchiseId]],
    ]);
  });
  it.each([historyRoute, historyReport])(
    "denies history and report requests without owner consent (%#)",
    async (get) => {
      const response = await get(
        new Request(`http://localhost/api/history?vehicleId=${vehicleId}`),
      );
      expect(response.status).toBe(403);
      expect(fixtures.calls.some(([table]) => table === "jobs")).toBe(false);
    },
  );
  it("checks membership and exposes only customer-facing records after a grant", async () => {
    fixtures.tables.vehicle_history_shares = [{ franchise_id: "garage" }];
    await expect(vehicleHistory("vehicle")).resolves.toMatchObject({
      owner: false,
      jobs: [],
    });
    expect(fixtures.tenant).toHaveBeenCalledWith(
      "garage",
      undefined,
      expect.arrayContaining(["MECHANIC"]),
      false,
      { id: "viewer", email: "viewer@example.com" },
    );
    const selection = fixtures.calls.find(
      ([table, method]) => table === "jobs" && method === "select",
    )?.[2][0];
    expect(selection).not.toContain("internal_notes");
    expect(fixtures.calls).toContainEqual([
      "jobs",
      "eq",
      ["customer_id", "owner"],
    ]);
  });
  it("enforces revocation on the next history request", async () => {
    fixtures.tables.vehicle_history_shares = [{ franchise_id: "garage" }];
    await vehicleHistory("vehicle");
    fixtures.tables.vehicle_history_shares = [];
    await expect(vehicleHistory("vehicle")).rejects.toMatchObject({
      status: 403,
    });
  });
  it("lets owners view their history without a garage grant", async () => {
    fixtures.tables.vehicles = {
      id: "vehicle",
      owner_id: "viewer",
      registration: "KDA 123A",
    };
    await expect(vehicleHistory("vehicle")).resolves.toMatchObject({
      owner: true,
    });
    expect(fixtures.tenant).not.toHaveBeenCalled();
  });
  it("normalizes PostgREST one-to-one invoice embeds for the timeline and report", async () => {
    fixtures.tables.vehicles = { id: "vehicle", owner_id: "viewer" };
    fixtures.tables.jobs = [
      {
        id: "job",
        booking_id: null,
        shop: { name: "Garage" },
        invoices: {
          id: "invoice",
          number: "INV-1",
          total_amount: 3000,
          lines: [],
        },
        parts: [{ quantity: 4, item: { name: "Spark plug" } }],
      },
    ];
    const result = await vehicleHistory("vehicle");
    expect(result.jobs[0].invoices).toEqual([
      expect.objectContaining({ number: "INV-1" }),
    ]);
    expect(result.jobs[0].shop).toEqual({ name: "Garage" });
  });
});
