import { ApiError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { camelize } from "@/lib/supabase/format";
import type { z } from "zod";
import type { bookingSchema } from "@/lib/validation";

function reference(prefix: string) {
  return `${prefix}-${new Date().toISOString().slice(2, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}

export type AdminDbClient = ReturnType<typeof createAdminClient>;

/**
 * Creates a capacity-checked customer booking via RPC.
 *
 * @param customerId - Authenticated customer identifier.
 * @param input - Validated booking payload.
 * @param admin - Optional Supabase admin client override for dependency injection.
 * @returns Newly created booking record.
 */
export async function createBooking(
  customerId: string,
  input: z.infer<typeof bookingSchema>,
  admin: AdminDbClient = createAdminClient(),
) {
  const scheduledAt = new Date(input.scheduledAt);
  if (scheduledAt.getTime() < Date.now() + 60 * 60 * 1000)
    throw new ApiError(
      400,
      "Bookings must be at least one hour in the future",
      "INVALID_SCHEDULE",
    );
  const { data: id, error } = await admin.rpc("create_booking", {
    p_customer_id: customerId,
    p_shop_id: input.shopId,
    p_vehicle_id: input.vehicleId,
    p_service_id: input.serviceId ?? null,
    p_scheduled_at: input.scheduledAt,
    p_customer_notes: input.customerNotes ?? null,
    p_reference: reference("BK"),
  });
  if (error) {
    if (error.message.includes("SHOP_NOT_FOUND"))
      throw new ApiError(404, "Garage not found", "SHOP_NOT_FOUND");
    if (error.message.includes("VEHICLE_NOT_FOUND"))
      throw new ApiError(404, "Vehicle not found", "VEHICLE_NOT_FOUND");
    if (error.message.includes("INVALID_SERVICE"))
      throw new ApiError(
        400,
        "That service is not offered by this garage",
        "INVALID_SERVICE",
      );
    if (error.message.includes("CAPACITY_REACHED"))
      throw new ApiError(
        409,
        "This garage is fully booked for that day",
        "CAPACITY_REACHED",
      );
    if (error.message.includes("OUTSIDE_OPENING_HOURS"))
      throw new ApiError(
        400,
        "Choose a time within this garage’s opening hours",
        "OUTSIDE_OPENING_HOURS",
      );
    throw error;
  }
  const result = await admin
    .from("bookings")
    .select(
      "id,reference,franchise_id,shop_id,customer_id,vehicle_id,service_id,status,scheduled_at,customer_notes,decision_note,created_at,updated_at,shop:shops(name),vehicle:vehicles(registration,make,model),service:service_catalog(name,base_price)",
    )
    .eq("id", id)
    .single();
  if (result.error) throw result.error;
  return camelize(result.data);
}
