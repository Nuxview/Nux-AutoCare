import { Children, isValidElement, useState, type ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useState: vi.fn(),
}));
vi.mock("@/lib/client-cache", () => ({ request: vi.fn() }));

import { request } from "@/lib/client-cache";
import { InvoicePayment } from "./invoice-payment";

const available = {
  test: false,
  stripe: false,
  mpesa: false,
  paystack: true,
  pending: null,
};
const openPayment = {
  ...available,
  pending: { reference: "PAY-pending", provider: "PAYSTACK" },
};
const optionsUrl = "/api/payments/options?invoiceId=invoice";

function findButton(node: ReactNode, label: string): (() => void) | undefined {
  if (!isValidElement<{ children?: ReactNode; onClick?: () => void }>(node))
    return;
  if (node.type === "button" && node.props.children === label)
    return node.props.onClick;
  for (const child of Children.toArray(node.props.children)) {
    const handler = findButton(child, label);
    if (handler) return handler;
  }
}

function render(
  options: typeof available | typeof openPayment | null,
  message = "",
) {
  const setOptions = vi.fn();
  const setMessage = vi.fn();
  vi.mocked(useState)
    .mockReturnValueOnce([options, setOptions])
    .mockReturnValueOnce(["", vi.fn()])
    .mockReturnValueOnce([false, vi.fn()])
    .mockReturnValueOnce([message, setMessage]);
  const panel = InvoicePayment({ invoiceId: "invoice", onPaid: vi.fn() });
  return { panel, setOptions, setMessage };
}

const checkoutConflict = () =>
  Response.json({ error: { code: "CHECKOUT_OPEN" } }, { status: 409 });

afterEach(() => vi.resetAllMocks());

it("refreshes a checkout conflict and offers the existing payment status", async () => {
  vi.mocked(request)
    .mockResolvedValueOnce(checkoutConflict())
    .mockResolvedValueOnce(Response.json(openPayment));
  const { panel, setOptions } = render(available);
  const pay = findButton(panel, "Pay with Paystack");
  expect(pay).toBeDefined();
  pay?.();
  await vi.waitFor(() =>
    expect(setOptions).toHaveBeenLastCalledWith(openPayment),
  );
  expect(request).toHaveBeenNthCalledWith(2, optionsUrl);
  expect(request).toHaveBeenCalledTimes(2);
  const refreshed = render(openPayment).panel;
  expect(findButton(refreshed, "Check payment status")).toBeDefined();
  expect(findButton(refreshed, "Pay with Paystack")).toBeUndefined();
});

it("lets the customer retry loading options if conflict recovery fails", async () => {
  vi.mocked(request)
    .mockResolvedValueOnce(checkoutConflict())
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(Response.json(openPayment));
  const { panel, setOptions, setMessage } = render(available);
  findButton(panel, "Pay with Paystack")?.();
  const message =
    "An existing payment was found, but payment options could not be refreshed.";
  await vi.waitFor(() => expect(setMessage).toHaveBeenLastCalledWith(message));
  expect(setOptions.mock.calls).toEqual([[null]]);
  const retry = render(null, message);
  const reload = findButton(retry.panel, "Retry loading payment options");
  expect(reload).toBeDefined();
  reload?.();
  await vi.waitFor(() =>
    expect(retry.setOptions).toHaveBeenLastCalledWith(openPayment),
  );
  expect(request).toHaveBeenNthCalledWith(3, optionsUrl);
});
