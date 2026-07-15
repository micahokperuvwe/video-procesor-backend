import crypto from 'crypto';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
const PAYSTACK_WEBHOOK_SECRET = process.env.PAYSTACK_WEBHOOK_SECRET || '';

// Check if Paystack is configured
const isConfigured = PAYSTACK_SECRET_KEY && !PAYSTACK_SECRET_KEY.includes('your_');

interface InitializeTransactionData {
  email: string;
  amount: number; // In kobo (cents)
  reference: string;
  callback_url: string;
  metadata?: any;
}

interface VerifyTransactionResponse {
  status: boolean;
  message: string;
  data: {
    status: string;
    reference: string;
    amount: number;
    customer: {
      email: string;
    };
    metadata?: any;
  };
}

class PaystackService {
  private apiUrl = 'https://api.paystack.co';

  /**
   * Initialize a payment transaction
   */
  async initializeTransaction(data: InitializeTransactionData): Promise<any> {
    if (!isConfigured) {
      throw new Error('Paystack is not configured. Please set PAYSTACK_SECRET_KEY in .env');
    }

    try {
      const response = await fetch(`${this.apiUrl}/transaction/initialize`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      const result = (await response.json()) as any;

      if (!result.status) {
        throw new Error(result.message || 'Failed to initialize transaction');
      }

      return result.data;
    } catch (error: any) {
      console.error('[PAYSTACK] Initialize transaction error:', error);
      throw error;
    }
  }

  /**
   * Verify a payment transaction
   */
  async verifyTransaction(reference: string): Promise<VerifyTransactionResponse> {
    if (!isConfigured) {
      throw new Error('Paystack is not configured');
    }

    try {
      const response = await fetch(`${this.apiUrl}/transaction/verify/${reference}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      const result = (await response.json()) as any;

      if (!result.status) {
        throw new Error(result.message || 'Failed to verify transaction');
      }

      return result as VerifyTransactionResponse;
    } catch (error: any) {
      console.error('[PAYSTACK] Verify transaction error:', error);
      throw error;
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!PAYSTACK_WEBHOOK_SECRET) {
      console.warn('[PAYSTACK] Webhook secret not configured');
      return false;
    }

    const hash = crypto
      .createHmac('sha512', PAYSTACK_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');

    return hash === signature;
  }

  /**
   * Generate unique reference
   */
  generateReference(): string {
    return `VELO_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Convert dollars to kobo (Paystack uses smallest currency unit)
   */
  dollarsToKobo(dollars: number): number {
    return Math.round(dollars * 100);
  }

  /**
   * Convert kobo to dollars
   */
  koboToDollars(kobo: number): number {
    return kobo / 100;
  }
}

export const paystackService = new PaystackService();
