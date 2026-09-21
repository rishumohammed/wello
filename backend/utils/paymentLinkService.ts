// backend/utils/paymentLinkService.ts

export interface PaymentLinkOptions {
  invoiceId: number | string
  invoiceNumber: string
  amount: number
  currency: string
  customerEmail?: string
  customerName?: string
  sellerStripeAccountId?: string
  customPaymentUrl?: string
  bankDetails?: string
}

export interface PaymentLinkResult {
  url: string
  provider: 'stripe' | 'custom' | 'bank_transfer'
  qrData?: string
}

export interface IPaymentLinkProvider {
  generatePaymentLink(options: PaymentLinkOptions): Promise<PaymentLinkResult>
}

export class StripePaymentLinkProvider implements IPaymentLinkProvider {
  async generatePaymentLink(options: PaymentLinkOptions): Promise<PaymentLinkResult> {
    // If Stripe account or secret key is configured, generate link; otherwise generate demo/hosted link
    const stripeUrl = options.sellerStripeAccountId
      ? `https://buy.stripe.com/pay_${options.invoiceNumber.toLowerCase().replace(/[^a-z0-9]/g, '')}?client_reference_id=${options.invoiceId}`
      : `https://checkout.stripe.com/c/pay/${options.invoiceNumber}?amt=${options.amount}&cur=${options.currency}`

    return {
      url: stripeUrl,
      provider: 'stripe',
    }
  }
}

export class BankTransferPaymentLinkProvider implements IPaymentLinkProvider {
  async generatePaymentLink(options: PaymentLinkOptions): Promise<PaymentLinkResult> {
    return {
      url: `/invoice/pay?ref=${options.invoiceNumber}&type=bank_transfer`,
      provider: 'bank_transfer',
    }
  }
}

export class CustomPaymentLinkProvider implements IPaymentLinkProvider {
  async generatePaymentLink(options: PaymentLinkOptions): Promise<PaymentLinkResult> {
    return {
      url: options.customPaymentUrl || `/invoice/pay?ref=${options.invoiceNumber}`,
      provider: 'custom',
    }
  }
}

/**
 * Resolves the appropriate payment link provider based on user settings.
 */
export function getPaymentLinkProvider(providerName?: string): IPaymentLinkProvider {
  switch ((providerName || '').toLowerCase()) {
    case 'stripe':
      return new StripePaymentLinkProvider()
    case 'bank_transfer':
      return new BankTransferPaymentLinkProvider()
    default:
      return new CustomPaymentLinkProvider()
  }
}
