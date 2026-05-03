export type BankConnectionStatus =
  | "not_connected"
  | "consent_pending"
  | "connected"
  | "syncing"
  | "error";

export type BankSyncRun = {
  id: string;
  startedAt: string;
  finishedAt?: string;
  status: "running" | "completed" | "failed";
  importedTransactions: number;
};

export type BankAccount = {
  id: string;
  providerAccountId: string;
  name: string;
  iban?: string;
  currency: "DKK" | "EUR" | "USD";
  balanceMinor: number;
};
