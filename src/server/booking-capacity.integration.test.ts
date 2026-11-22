import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseTestConfig } from "@/test/supabase-config";

const hasSupabaseEnv = Boolean(
  process.env.TEST_SUPABASE_URL?.trim() &&
    process.env.TEST_SUPABASE_PUBLISHABLE_KEY?.trim() &&
    process.env.TEST_SUPABASE_SECRET_KEY?.trim(),
);

const ALL_DAY_HOURS = {
  sun: { open: "00:00", close: "23:59" },
  mon: { open: "00:00", close: "23:59" },
  tue: { open: "00:00", close: "23:59" },
  wed: { open: "00:00", close: "23:59" },
  thu: { open: "00:00", close: "23:59" },
  fri: { open: "00:00", close: "23:59" },
  sat: { open: "00:00", close: "23:59" },
};

describe.skipIf(!hasSupabaseEnv)("Booking capacity concurrency (real Postgres)", () => {
  const timestamp = Date.now();
  const testUserEmail = `capacity_${timestamp}@example.com`;
  const testUserPassword = "SecurePassword123!";

  let adminClient: SupabaseClient;
  let testUserId: string;
  let franchiseId: string;
  let planId: string;
  let shopId: string;
  let vehicleId: string;

  /**
   * Seeds user, franchise, active trial subscription, capacity-1 shop, and vehicle.
   *
   * @returns Promise resolving when setup completes.
   */
  beforeAll(async () => {
    const { url, secretKey } = supabaseTestConfig();
    adminClient = createClient(url, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authUser, error: authError } =
      await adminClient.auth.admin.createUser({
        email: testUserEmail,
        password: testUserPassword,
        email_confirm: true,
      });
    expect(authError).toBeNull();
    testUserId = authUser.user!.id;

    const { error: profileError } = await adminClient.from("profiles").insert({
      id: testUserId,
      email: testUserEmail,
      first_name: "Capacity",
      last_name: "Tester",
    });
    expect(profileError).toBeNull();

    const { data: franchise, error: franchiseError } = await adminClient
      .from("franchises")
      .insert({
        name: `Capacity Garage ${timestamp}`,
        slug: `capacity-garage-${timestamp}`,
        email: `capacity_garage_${timestamp}@example.com`,
        owner_id: testUserId,
        status: "TRIAL",
      })
      .select("id")
      .single();
    expect(franchiseError).toBeNull();
    franchiseId = franchise!.id;

    const { data: plan, error: planError } = await adminClient
      .from("plans")
      .insert({
        name: `CapPlan ${timestamp}`,
        code: `CAP_${timestamp}`,
        monthly_price: 3500,
        max_shops: 1,
        max_staff: 8,
      })
      .select("id")
      .single();
    expect(planError).toBeNull();
    planId = plan!.id;

    const now = Date.now();
    const { error: subError } = await adminClient.from("subscriptions").insert({
      franchise_id: franchiseId,
      plan_id: planId,
      trial_ends_at: new Date(now + 14 * 86400000).toISOString(),
      current_period_starts_at: new Date(now).toISOString(),
      current_period_ends_at: new Date(now + 14 * 86400000).toISOString(),
    });
    expect(subError).toBeNull();

    const { data: shop, error: shopError } = await adminClient
      .from("shops")
      .insert({
        franchise_id: franchiseId,
        name: "Capacity Shop",
        slug: `capacity-shop-${timestamp}`,
        email: `capacity_shop_${timestamp}@example.com`,
        address: "100 Lock Road",
        county: "Nairobi",
        timezone: "UTC",
        booking_capacity: 1,
        is_active: true,
        accepts_bookings: true,
        opening_hours: ALL_DAY_HOURS,
      })
      .select("id")
      .single();
    expect(shopError).toBeNull();
    shopId = shop!.id;

    const { data: vehicle, error: vehicleError } = await adminClient
      .from("vehicles")
      .insert({
        owner_id: testUserId,
        registration: `KCA${timestamp.toString().slice(-4)}Z`,
        make: "Toyota",
        model: "Corolla",
        year: 2021,
      })
      .select("id")
      .single();
    expect(vehicleError).toBeNull();
    vehicleId = vehicle!.id;
  }, 30000);

  /**
   * Removes seeded rows and test user after execution.
   *
   * @returns Promise resolving when teardown completes.
   */
  afterAll(async () => {
    if (adminClient && testUserId) {
      await adminClient.from("notifications").delete().eq("user_id", testUserId);
      await adminClient.from("bookings").delete().eq("shop_id", shopId);
      await adminClient.from("vehicles").delete().eq("id", vehicleId);
      await adminClient.from("shops").delete().eq("id", shopId);
      await adminClient.from("subscriptions").delete().eq("franchise_id", franchiseId);
      await adminClient.from("plans").delete().eq("id", planId);
      await adminClient.from("franchises").delete().eq("id", franchiseId);
      await adminClient.from("profiles").delete().eq("id", testUserId);
      await adminClient.auth.admin.deleteUser(testUserId);
    }
  }, 30000);

  it("allows exactly 1 of 5 concurrent create_booking calls when capacity is 1", async () => {
    const scheduledAt = new Date(Date.now() + 2 * 3600000).toISOString();
    const concurrency = 5;

    const results = await Promise.allSettled(
      Array.from({ length: concurrency }, (_, index) =>
        adminClient
          .rpc("create_booking", {
            p_customer_id: testUserId,
            p_shop_id: shopId,
            p_vehicle_id: vehicleId,
            p_service_id: null,
            p_scheduled_at: scheduledAt,
            p_customer_notes: null,
            p_reference: `CONC-${timestamp}-${index}`,
          })
          .throwOnError(),
      ),
    );

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter(
      (r): r is PromiseRejectedResult => r.status === "rejected",
    );

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(concurrency - 1);
    for (const failure of rejected) {
      expect(String((failure.reason as { message?: string })?.message ?? failure.reason)).toContain(
        "CAPACITY_REACHED",
      );
    }
  }, 30000);
});
