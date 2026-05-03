import type { SupabaseClient } from "@supabase/supabase-js";

export type StoredBankAccount = {
  id: string;
  name: string;
  balance: string;
  note: string;
  balanceMinor?: number;
  currency?: string;
};

export type StoredBankTransaction = {
  accountId: string;
  transactionId?: string;
  bookingDate?: string;
  valueDate?: string;
  remittanceInformation?: string;
  creditorName?: string;
  debtorName?: string;
  amount: string;
  currency: string;
  raw?: Record<string, unknown>;
};

export type BankConnectionState = {
  provider: "gocardless";
  status: "not_connected" | "consent_pending" | "connected" | "syncing" | "error";
  reference?: string;
  requisitionId?: string;
  connectedAt?: string;
  syncedAt?: string;
  accounts?: StoredBankAccount[];
  transactions?: StoredBankTransaction[];
  error?: string;
};

type BankConnectionRow = {
  id: string;
  provider: "gocardless";
  status: BankConnectionState["status"];
  external_connection_id: string | null;
  connected_at: string | null;
  synced_at: string | null;
  error: string | null;
};

type BankAccountRow = {
  id: string;
  provider_account_id: string;
  name: string;
  currency: string;
  balance_minor: number;
  updated_at: string | null;
};

function formatMinorAmount(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function parseAmountMinor(amount: string) {
  return Math.round(Number(amount) * 100);
}

export async function readBankConnectionState(
  supabase: SupabaseClient,
  userId: string,
): Promise<BankConnectionState | null> {
  const { data: connection } = await supabase
    .from("bank_connections")
    .select(
      "id, provider, status, external_connection_id, connected_at, synced_at, error",
    )
    .eq("user_id", userId)
    .order("connected_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle<BankConnectionRow>();

  if (!connection) {
    return null;
  }

  const { data: accounts } = await supabase
    .from("bank_accounts")
    .select("id, provider_account_id, name, currency, balance_minor, updated_at")
    .eq("user_id", userId)
    .eq("connection_id", connection.id)
    .order("name")
    .returns<BankAccountRow[]>();

  return {
    provider: connection.provider,
    status: connection.status,
    requisitionId: connection.external_connection_id ?? undefined,
    connectedAt: connection.connected_at ?? undefined,
    syncedAt: connection.synced_at ?? undefined,
    error: connection.error ?? undefined,
    accounts: (accounts ?? []).map((account) => ({
      id: account.provider_account_id,
      name: account.name,
      balance: formatMinorAmount(account.balance_minor, account.currency),
      balanceMinor: account.balance_minor,
      currency: account.currency,
      note: account.updated_at
        ? `Opdateret ${new Intl.DateTimeFormat("da-DK", {
            dateStyle: "short",
            timeStyle: "short",
          }).format(new Date(account.updated_at))}`
        : "Konto fra bankforbindelse",
    })),
  };
}

export async function writeBankConnectionState(
  supabase: SupabaseClient,
  userId: string,
  state: BankConnectionState,
) {
  const externalConnectionId = state.requisitionId ?? null;
  const { data: existingConnection } = externalConnectionId
    ? await supabase
        .from("bank_connections")
        .select("id")
        .eq("user_id", userId)
        .eq("external_connection_id", externalConnectionId)
        .maybeSingle<{ id: string }>()
    : { data: null };

  const connectionPayload = {
    user_id: userId,
    provider: state.provider,
    status: state.status,
    external_connection_id: externalConnectionId,
    connected_at: state.connectedAt ?? new Date().toISOString(),
    synced_at: state.syncedAt ?? null,
    error: state.error ?? null,
  };

  const { data: connection, error } = existingConnection
    ? await supabase
        .from("bank_connections")
        .update(connectionPayload)
        .eq("id", existingConnection.id)
        .select("id")
        .single<{ id: string }>()
    : await supabase
        .from("bank_connections")
        .insert(connectionPayload)
        .select("id")
        .single<{ id: string }>();

  if (error) {
    throw error;
  }

  if (!state.accounts?.length || !connection) {
    return;
  }

  await supabase
    .from("bank_accounts")
    .delete()
    .eq("user_id", userId)
    .eq("connection_id", connection.id);

  const { data: insertedAccounts } = await supabase
    .from("bank_accounts")
    .insert(
      state.accounts.map((account) => ({
        user_id: userId,
        connection_id: connection.id,
        provider_account_id: account.id,
        name: account.name,
        currency: account.currency ?? "DKK",
        balance_minor: account.balanceMinor ?? 0,
        updated_at: state.syncedAt ?? new Date().toISOString(),
      })),
    )
    .select("id, provider_account_id")
    .returns<Array<{ id: string; provider_account_id: string }>>();

  if (!state.transactions?.length || !insertedAccounts?.length) {
    return;
  }

  const accountIds = new Map(
    insertedAccounts.map((account) => [account.provider_account_id, account.id]),
  );

  await supabase.from("bank_transactions").insert(
    state.transactions
      .map((transaction) => {
        const accountId = accountIds.get(transaction.accountId);

        if (!accountId) {
          return null;
        }

        return {
          user_id: userId,
          account_id: accountId,
          provider_transaction_id: transaction.transactionId ?? null,
          booking_date: transaction.bookingDate ?? transaction.valueDate ?? null,
          description: transaction.remittanceInformation ?? "Bankpostering",
          category: null,
          amount_minor: parseAmountMinor(transaction.amount),
          currency: transaction.currency,
          raw: transaction.raw ?? transaction,
        };
      })
      .filter((transaction) => transaction !== null),
  );
}
