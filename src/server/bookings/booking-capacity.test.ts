import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockRpc = vi.fn();
const mockAdminSelect = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    rpc: mockRpc,
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: mockAdminSelect,
        })),
      })),
    })),
  })),
}));

import { createBooking } from "./service";

const VALID_CUSTOMER_ID = "33333333-3333-4333-8333-333333333333";
const VALID_SHOP_ID = "44444444-4444-4444-8444-444444444444";
const VALID_VEHICLE_ID = "55555555-5555-4555-8555-555555555555";

describe("Booking service validation and database responses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses booking when scheduled time is in the past", async () => {
    const pastTime = new Date(Date.now() - 3600000).toISOString();

    await expect(
      createBooking(VALID_CUSTOMER_ID, {
        shopId: VALID_SHOP_ID,
        vehicleId: VALID_VEHICLE_ID,
        scheduledAt: pastTime,
      }),
    ).rejects.toMatchObject({
      status: 400,
      code: "INVALID_SCHEDULE",
      message: "Bookings must be at least one hour in the future",
    });

    // Ensures RPC was never called because validation halted execution early
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("refuses booking when scheduled time is less than one hour in the future", async () => {
    // 30 minutes in the future violates the 1-hour minimum booking lead time
    const tooSoonTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    await expect(
      createBooking(VALID_CUSTOMER_ID, {
        shopId: VALID_SHOP_ID,
        vehicleId: VALID_VEHICLE_ID,
        scheduledAt: tooSoonTime,
      }),
    ).rejects.toMatchObject({
      status: 400,
      code: "INVALID_SCHEDULE",
    });

    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("maps a database capacity rejection to HTTP 409", async () => {
    const validFutureTime = new Date(
      Date.now() + 2 * 24 * 60 * 60 * 1000,
    ).toISOString();

    // Database RPC signals CAPACITY_REACHED when count >= booking_capacity
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "CAPACITY_REACHED: Daily garage capacity reached" },
    });

    await expect(
      createBooking(VALID_CUSTOMER_ID, {
        shopId: VALID_SHOP_ID,
        vehicleId: VALID_VEHICLE_ID,
        scheduledAt: validFutureTime,
      }),
    ).rejects.toMatchObject({
      status: 409,
      code: "CAPACITY_REACHED",
      message: "This garage is fully booked for that day",
    });
  });

  it("loads and returns the booking created by the database", async () => {
    const validFutureTime = new Date(
      Date.now() + 2 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const createdBookingId = "66666666-6666-4666-8666-666666666666";

    mockRpc.mockResolvedValue({
      data: createdBookingId,
      error: null,
    });

    mockAdminSelect.mockResolvedValue({
      data: {
        id: createdBookingId,
        reference: "BK-20261101-ABCD12",
        status: "REQUESTED",
        scheduled_at: validFutureTime,
        shop: { name: "Westlands Auto Center" },
        vehicle: { registration: "KDA 247M", make: "Toyota", model: "Harrier" },
        service: { name: "Full service", base_price: 8500 },
      },
      error: null,
    });

    const booking = await createBooking(VALID_CUSTOMER_ID, {
      shopId: VALID_SHOP_ID,
      vehicleId: VALID_VEHICLE_ID,
      scheduledAt: validFutureTime,
    });

    expect(booking).toMatchObject({
      id: createdBookingId,
      reference: "BK-20261101-ABCD12",
      status: "REQUESTED",
    });
  });
});
