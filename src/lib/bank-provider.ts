import type { StoredBankAccount, StoredBankTransaction } from "@/lib/bank-storage";

export type BankProviderConnection = {
  id: string;
  redirectUrl: string;
};

export type BankProviderSyncResult = {
  accounts: StoredBankAccount[];
  transactions: StoredBankTransaction[];
};

export type BankProvider = {
  id: string;
  isActive: boolean;
  connect(input: {
    redirectUrl: string;
    reference: string;
  }): Promise<BankProviderConnection>;
  sync(connectionId: string): Promise<BankProviderSyncResult>;
};
