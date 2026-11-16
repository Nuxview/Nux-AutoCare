import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  payment: null as Record<string, unknown> | null,
  subscription: null as Record<string, unknown> | null,
  transaction: {} as Record<string, unknown>,
  userId: "customer",
  beforeUpdate: null as (() => void) | null,
  updateError: null as { message: string } | null,
  fetch: vi.fn(),
  update: vi.fn(),
  filters: vi.fn(),
  rpc: vi.fn(),
  tenant: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/server/auth/context", () => ({
  requireAuthenticatedUser: async () => ({ id: fixture.userId }),
  requireTenantMembership: fixture.tenant,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: fixture.rpc,
    from: (table: string) => {
      let patch: Record<string, unknown> | null = null;
      const filters: Array<[string, unknown[]]> = [];
      const result = () => {
        const row: Record<string, unknown> | null =
          table === "payments"
            ? fixture.payment
            : table === "subscriptions"
              ? fixture.subscription
              : { id: "garage", paystack_subaccount_code: "ACCT-garage" };
        if (patch) fixture.beforeUpdate?.();
        const matches =
          row &&
          filters.every(([column, values]) => values.includes(row[column]));
        if (patch && fixture.updateError)
          return { data: null, error: fixture.updateError };
        if (matches && patch) Object.assign(row, patch);
        return { data: matches ? { ...row } : null, error: null };
      };
      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => {
          filters.push([column, [value]]);
          return query;
        },
        in: (column: string, values: unknown[]) => {
          fixture.filters(column, values);
          filters.push([column, values]);
          return query;
        },
        update: (value: Record<string, unknown>) => {
          fixture.update(value);
          patch = value;
          return query;
        },
        maybeSingle: async () => result(),
        single: async () => result(),
        then: (resolve: (value: unknown) => void) => resolve(result()),
      };
      return query;
    },
  }),
}));

import { reconcilePaystackTransaction } from "./paystack-reconcile";
import { GET } from "@/app/api/payments/paystack/verify/route";

const reference = `PAY-${"a".repeat(32)}`;
const request = () =>
  new Request(
    `http://localhost/api/payments/paystack/verify?reference=${reference}`,
  );

beforeEach(() => {
  vi.clearAllMocks();
  fixture.userId = "customer";
  fixture.beforeUpdate = null;
  fixture.updateError = null;
  fixture.subscription = null;
  fixture.tenant.mockResolvedValue({});
  fixture.payment = {
    id: "payment",
    reference,
    franchise_id: "garage",
    customer_id: "customer",
    provider: "PAYSTACK",
    status: "PROCESSING",
    amount: "1000.00",
    currency: "KES",
  };
  fixture.transaction = {
    reference,
    status: "failed",
    amount: 100000,
    currency: "KES",
    subaccount: { subaccount_code: "ACCT-garage" },
  };
  fixture.fetch
    .mockReset()
    .mockImplementation(async () =>
      Response.json({ status: true, data: fixture.transaction }),
    );
  fixture.rpc.mockImplementation(async () => {
    fixture.payment!.status = "SUCCEEDED";
    return { data: true, error: null };
  });
  vi.stubGlobal("fetch", fixture.fetch);
  vi.stubEnv("PAYSTACK_SECRET_KEY", "sk_test_mocked");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Paystack invoice reconciliation (mocked provider)", () => {
  it.each(["PENDING", "PROCESSING"])(
    "records verified failure from %s and reports HTTP 200 without claiming payment",
    async (status) => {
      fixture.payment!.status = status;
      const response = await GET(request());
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ paid: false, status: "FAILED" });
      expect(fixture.payment!.status).toBe("FAILED");
      expect(fixture.update).toHaveBeenCalledWith({
        status: "FAILED",
        failure_reason: "Paystack reported transaction failure",
      });
      expect(fixture.filters).toHaveBeenCalledWith("status", [
        "PENDING",
        "PROCESSING",
      ]);
      expect(fixture.rpc).not.toHaveBeenCalled();
    },
  );
  it.each([
    "abandoned",
    "pending",
    "ongoing",
    "processing",
    "queued",
    "reversed",
    "unknown",
  ])("keeps %s reserved and reports HTTP 202", async (status) => {
    fixture.transaction.status = status;
    const response = await GET(request());
    expect(response.status).toBe(202);
    expect((await response.json()).paid).toBe(false);
    expect(fixture.payment!.status).toBe("PROCESSING");
    expect(fixture.update).not.toHaveBeenCalled();
    expect(fixture.rpc).not.toHaveBeenCalled();
  });
  it.each([
    { reference: "different-reference" },
    { amount: 1 },
    { amount: 1.5 },
    { currency: "USD" },
    { subaccount: "ACCT-other" },
    { subaccount: null },
  ])(
    "does not release a payment on mismatched provider details %j",
    async (patch) => {
      Object.assign(fixture.transaction, patch);
      await expect(
        reconcilePaystackTransaction(reference),
      ).rejects.toMatchObject({ status: 409 });
      expect(fixture.payment!.status).toBe("PROCESSING");
      expect(fixture.update).not.toHaveBeenCalled();
      expect(fixture.rpc).not.toHaveBeenCalled();
    },
  );
  it("does not infer failure from provider errors", async () => {
    fixture.fetch.mockImplementation(async () =>
      Response.json({ status: false, message: "Unavailable" }, { status: 503 }),
    );
    await expect(reconcilePaystackTransaction(reference)).rejects.toMatchObject(
      { code: "PAYMENT_PROVIDER_ERROR" },
    );
    expect(fixture.update).not.toHaveBeenCalled();
    expect(fixture.rpc).not.toHaveBeenCalled();
  });
  it("settles a pending result that subsequently succeeds, once", async () => {
    fixture.transaction.status = "pending";
    expect((await GET(request())).status).toBe(202);
    fixture.transaction.status = "success";
    const success = await GET(request());
    expect(success.status).toBe(200);
    expect(await success.json()).toEqual({ paid: true, status: "SUCCEEDED" });
    expect(await (await GET(request())).json()).toEqual({
      paid: true,
      status: "SUCCEEDED",
    });
    expect(fixture.rpc).toHaveBeenCalledTimes(1);
    expect(fixture.rpc).toHaveBeenCalledWith(
      "settle_paystack_invoice_payment",
      { p_reference: reference, p_amount_minor: 100000, p_currency: "KES" },
    );
    expect(fixture.update).not.toHaveBeenCalled();
  });
  it("returns a recorded failure on duplicate verification without another provider request", async () => {
    await GET(request());
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ paid: false, status: "FAILED" });
    expect(fixture.fetch).toHaveBeenCalledTimes(1);
    expect(fixture.update).toHaveBeenCalledTimes(1);
  });
  it("does not overwrite a success recorded while provider verification was in flight", async () => {
    fixture.beforeUpdate = () => {
      fixture.payment!.status = "SUCCEEDED";
    };
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ paid: true, status: "SUCCEEDED" });
    expect(fixture.payment!.status).toBe("SUCCEEDED");
  });
  it("surfaces a failed database write without reporting a terminal result", async () => {
    fixture.updateError = { message: "Injected database failure" };
    await expect(reconcilePaystackTransaction(reference)).rejects.toMatchObject(
      fixture.updateError,
    );
    expect(fixture.payment!.status).toBe("PROCESSING");
  });
  it("keeps the customer's ownership check before provider reconciliation", async () => {
    fixture.userId = "other-customer";
    const response = await GET(request());
    expect(response.status).toBe(404);
    expect(fixture.fetch).not.toHaveBeenCalled();
    expect(fixture.update).not.toHaveBeenCalled();
  });
  it.each(["failed", "success"])(
    "preserves subscription verification for %s without an invoice failure write",
    async (status) => {
      const subscriptionReference = `SUB-${"b".repeat(32)}`;
      fixture.payment = null;
      fixture.subscription = {
        id: "subscription",
        franchise_id: "garage",
        paystack_checkout_reference: subscriptionReference,
        current_period_ends_at: "2026-11-20T00:00:00Z",
        paystack_customer_code: null,
        paystack_plan_code: "PLN-starter",
        plan: { monthly_price: "3500.00" },
      };
      fixture.transaction = {
        reference: subscriptionReference,
        status,
        amount: 350000,
        currency: "KES",
        paid_at: "2026-11-16T10:00:00Z",
        customer: { customer_code: "CUS-owner" },
        plan: "PLN-starter",
      };
      const response = await GET(
        new Request(
          `http://localhost/api/payments/paystack/verify?reference=${subscriptionReference}`,
        ),
      );
      expect(response.status).toBe(status === "success" ? 200 : 202);
      expect(await response.json()).toEqual({ paid: status === "success" });
      expect(fixture.tenant).toHaveBeenCalledWith(
        "garage",
        undefined,
        ["FRANCHISE_OWNER"],
        true,
        { id: "customer" },
      );
      if (status === "failed") expect(fixture.update).not.toHaveBeenCalled();
      else expect(fixture.subscription.paystack_status).toBe("active");
      expect(fixture.rpc).not.toHaveBeenCalled();
    },
  );
});
