declare module '@cashfreepayments/cashfree-js' {
  interface CashfreeCheckoutOptions {
    paymentSessionId: string
    redirectTarget?: '_self' | '_blank' | '_modal'
  }
  interface CashfreeInstance {
    checkout(options: CashfreeCheckoutOptions): void
  }
  interface LoadOptions {
    mode: 'sandbox' | 'production'
  }
  export function load(options: LoadOptions): Promise<CashfreeInstance>
}
