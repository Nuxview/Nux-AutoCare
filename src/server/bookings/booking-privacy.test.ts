import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  row: {} as Record<string, unknown>,
  select: vi.fn(),
  eq: vi.fn(),
}));

vi.mock("@/server/auth/context", () => ({
  requireAuthenticatedUser: async () => ({ id: "customer" }),
}));
vi.mock("@/server/garage/scope", () => ({
  garageScope: async () => ({ franchiseId: "garage", shopId: "branch" }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: async () => ({ data: fixture.row.id, error: null }),
    from: () => {
      let fields: string[] = [];
      // Model selected booking columns; an ignored select would mask the leak.
      const selectedRow = () =>
        Object.fromEntries(
          Object.entries(fixture.row).filter(([key]) =>
            fields.some(
              (field) =>
                field === "*" || field === key || field.startsWith(`${key}:`),
            ),
          ),
        );
      const query = {
        select: (selection: string) => {
          fixture.select(selection);
          fields = selection.split(",");
          return query;
        },
        eq: (column: string, value: string) => {
          fixture.eq(column, value);
          return query;
        },
        order: () => query,
        single: async () => ({ data: selectedRow(), error: null }),
        then: (resolve: (value: unknown) => void) =>
          resolve({ data: [selectedRow()], error: null }),
      };
      return query;
    },
  }),
}));

import { GET, POST, PUT } from "@/app/api/bookings/route";

describe("booking response privacy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fixture.row = {
      id: "booking",
      reference: "BK-TEST",
      franchise_id: "garage",
      shop_id: "22222222-2222-4222-8222-222222222222",
      customer_id: "customer",
      vehicle_id: "33333333-3333-4333-8333-333333333333",
      service_id: null,
      status: "REQUESTED",
      scheduled_at: new Date(Date.now() + 86400000).toISOString(),
      customer_notes: "Please check the brakes",
      decision_note: "Please arrive at reception",
      internal_notes: "PRIVATE: suspected insurance fraud",
      created_at: "2026-11-16T06:00:00Z",
      updated_at: "2026-11-16T07:00:00Z",
      shop: { name: "Test Garage" },
      vehicle: { registration: "KDA 123A", make: "Toyota", model: "Vitz" },
      service: null,
      job: { id: "job", reference: "JOB-TEST", status: "OPEN" },
    };
  });

  it.each(["GET", "POST"])(
    "excludes private notes from customer %s responses",
    async (method) => {
      const response =
        method === "GET"
          ? await GET()
          : await POST(
              new Request("http://localhost/api/bookings", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  shopId: fixture.row.shop_id,
                  vehicleId: fixture.row.vehicle_id,
                  scheduledAt: fixture.row.scheduled_at,
                  customerNotes: fixture.row.customer_notes,
                }),
              }),
            );
      expect(response.status).toBe(method === "GET" ? 200 : 201);
      const body = await response.json();
      const booking = method === "GET" ? body.bookings[0] : body.booking;
      expect(booking).not.toHaveProperty("internalNotes");
      expect(JSON.stringify(body)).not.toContain(fixture.row.internal_notes);
      expect(booking).toMatchObject({
        id: "booking",
        reference: "BK-TEST",
        franchiseId: "garage",
        shopId: fixture.row.shop_id,
        customerId: "customer",
        vehicleId: fixture.row.vehicle_id,
        serviceId: null,
        status: "REQUESTED",
        scheduledAt: fixture.row.scheduled_at,
        customerNotes: fixture.row.customer_notes,
        decisionNote: fixture.row.decision_note,
        createdAt: fixture.row.created_at,
        updatedAt: fixture.row.updated_at,
        shop: fixture.row.shop,
        vehicle: fixture.row.vehicle,
        service: null,
      });
      if (method === "GET") {
        expect(booking.job).toEqual(fixture.row.job);
        expect(fixture.eq).toHaveBeenCalledWith("customer_id", "customer");
      } else {
        expect(fixture.eq).toHaveBeenCalledWith("id", "booking");
      }
      expect(fixture.select).toHaveBeenCalledOnce();
      const selection = fixture.select.mock.calls[0][0];
      expect(selection).not.toContain("*");
      expect(selection).not.toContain("internal_notes");
    },
  );

  it("preserves private notes in the authorized garage response", async () => {
    const response = await PUT();
    expect(response.status).toBe(200);
    expect((await response.json()).bookings[0].internalNotes).toBe(
      fixture.row.internal_notes,
    );
    expect(fixture.eq).toHaveBeenCalledWith("franchise_id", "garage");
    expect(fixture.eq).toHaveBeenCalledWith("shop_id", "branch");
  });
});
