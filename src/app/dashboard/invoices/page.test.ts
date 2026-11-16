import { createElement, type EffectCallback } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  effects: [] as EffectCallback[],
  state: vi.fn(),
  request: vi.fn(),
}));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useEffect: (effect: EffectCallback) => fixture.effects.push(effect),
  useState: (initial: unknown) => [initial, fixture.state],
}));
vi.mock("@/lib/client-cache", () => ({ request: fixture.request }));
vi.mock("@/components/approved-invoices", () => ({
  ApprovedInvoices: () => null,
}));

import InvoicesPage from "./page";
import { WorkspaceContext } from "@/components/workspace-context";

beforeEach(() => {
  vi.clearAllMocks();
  fixture.effects = [];
  vi.stubGlobal("window", {
    location: { search: `?paystack_reference=PAY-${"a".repeat(32)}` },
  });
});
afterEach(() => vi.unstubAllGlobals());

it.each([
  {
    http: 200,
    data: { paid: false, status: "FAILED" },
    message: "Payment failed.",
  },
  {
    http: 200,
    data: { paid: true, status: "SUCCEEDED" },
    message: "Payment confirmed.",
  },
  {
    http: 202,
    data: { paid: false, status: "PROCESSING" },
    message: "Payment is still processing.",
  },
  {
    http: 500,
    data: { error: { message: "Unavailable" } },
    message: "Payment could not be confirmed yet.",
  },
  { http: 200, data: null, message: "Payment could not be confirmed yet." },
])(
  "shows the payment outcome after Paystack returns $http/$data.status",
  async ({ http, data, message }) => {
    fixture.request.mockImplementation(async (url: string) =>
      url.startsWith("/api/payments/")
        ? Response.json(data, { status: http })
        : Response.json({ invoices: [] }),
    );
    renderToStaticMarkup(
      createElement(
        WorkspaceContext.Provider,
        {
          value: {
            userId: "customer",
            garage: false,
            role: null,
            franchiseId: null,
          },
        },
        createElement(InvoicesPage),
      ),
    );
    for (const effect of fixture.effects) effect();
    await vi.waitFor(() => expect(fixture.state).toHaveBeenCalledWith(message));
    if (!data || !("paid" in data && data.paid)) {
      expect(fixture.state).not.toHaveBeenCalledWith("Payment confirmed.");
    }
  },
);
