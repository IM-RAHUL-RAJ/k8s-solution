export type AccountTypeName = 'INDIAN_EQUITY' | 'US_EQUITY' | 'FOREX' | 'CRYPTO';
export type RiskProfileName = 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
export type GenderName = 'MALE' | 'FEMALE' | 'OTHER';

/** One row of the admin's account list: an account joined to its client. */
export interface AdminAccountSummary {
  accountId: number;
  accountRef: string;
  clientRef: string;
  clientName: string;
  email: string;
  phone: string | null;
  accountType: string;
  currency: string;
  cashBalance: number;
  status: string;
  createdAt: string;
}

/** The registration form. The fields mirror the clients and accounts tables. */
export interface RegistrationRequest {
  name: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: GenderName;
  accountType: AccountTypeName;
  currency: string;
  openingBalance?: number;
  riskProfile?: RiskProfileName;
}

/** No password in here, on purpose: it only ever goes to the customer's inbox. */
export interface RegistrationResponse {
  clientId: number;
  clientRef: string;
  accountId: number;
  accountRef: string;
  username: string;
  email: string;
  emailSent: boolean;
}
