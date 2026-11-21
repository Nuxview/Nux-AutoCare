import "server-only";
import { MpesaPaymentProvider } from "./mpesa";
import { PaystackPaymentProvider } from "./paystack";

export type PaymentProviderName = "PAYSTACK" | "MPESA";

export type InitiatePaymentInput = {
  reference: string;
  amount: number;
  currency: string;
  email?: string;
  phone?: string;
  callbackUrl?: string;
  metadata?: Record<string, unknown>;
};

export type InitiatePaymentResult = {
  provider: PaymentProviderName;
  reference: string;
  authorizationUrl?: string;
  checkoutRequestId?: string;
};

export type VerifyPaymentResult = {
  provider: PaymentProviderName;
  reference: string;
  status: string;
  paid: boolean;
};

/**
 * Common payment provider contract for initiation and verification.
 */
export interface PaymentProvider {
  readonly name: PaymentProviderName;
  initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentResult>;
  verifyPayment(reference: string): Promise<VerifyPaymentResult>;
}

const providers: Record<PaymentProviderName, PaymentProvider> = {
  PAYSTACK: new PaystackPaymentProvider(),
  MPESA: new MpesaPaymentProvider(),
};

/**
 * Resolves a payment provider implementation by provider name.
 *
 * @param name - Provider identifier stored on the payment record.
 * @returns Matching provider instance, or null if unsupported.
 */
export function getPaymentProvider(name: string): PaymentProvider | null {
  return Object.hasOwn(providers, name)
    ? providers[name as PaymentProviderName]
    : null;
}
