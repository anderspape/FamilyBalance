import type { SupabaseClient } from "@supabase/supabase-js";

export type ImportAccount = {
  id: string;
  name: string;
  accountNumber: string | null;
  description: string | null;
  balanceMinor: number | null;
  balanceCurrency: "DKK";
  balanceUpdatedAt: string | null;
  lastImportedAt: string | null;
  lastPostingDate: string | null;
  createdAt: string;
};

type ImportAccountRow = {
  id: string;
  name: string;
  account_number: string | null;
  description: string | null;
  balance_minor: number | null;
  balance_currency: "DKK" | null;
  balance_updated_at: string | null;
  last_imported_at: string | null;
  last_posting_date: string | null;
  created_at: string;
};

function mapImportAccount(row: ImportAccountRow): ImportAccount {
  return {
    id: row.id,
    name: row.name,
    accountNumber: row.account_number,
    description: row.description,
    balanceMinor: row.balance_minor,
    balanceCurrency: row.balance_currency ?? "DKK",
    balanceUpdatedAt: row.balance_updated_at,
    lastImportedAt: row.last_imported_at,
    lastPostingDate: row.last_posting_date,
    createdAt: row.created_at,
  };
}

export async function readImportAccounts(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("import_accounts")
    .select(
      "id, name, account_number, description, balance_minor, balance_currency, balance_updated_at, last_imported_at, last_posting_date, created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .returns<ImportAccountRow[]>();

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapImportAccount);
}

export async function createImportAccount(
  supabase: SupabaseClient,
  userId: string,
  input: {
    name: string;
    accountNumber?: string;
    description?: string;
  },
) {
  const { data, error } = await supabase
    .from("import_accounts")
    .insert({
      user_id: userId,
      name: input.name.trim(),
      account_number: input.accountNumber?.trim() || null,
      description: input.description?.trim() || null,
    })
    .select(
      "id, name, account_number, description, balance_minor, balance_currency, balance_updated_at, last_imported_at, last_posting_date, created_at",
    )
    .single<ImportAccountRow>();

  if (error) {
    throw error;
  }

  return mapImportAccount(data);
}

export async function updateImportAccountAfterImport(
  supabase: SupabaseClient,
  userId: string,
  input: {
    id: string;
    balanceMinor?: number;
    lastPostingDate?: string | null;
  },
) {
  const update: Record<string, string | number | null> = {
    last_imported_at: new Date().toISOString(),
  };

  if (typeof input.balanceMinor === "number" && Number.isFinite(input.balanceMinor)) {
    update.balance_minor = input.balanceMinor;
    update.balance_currency = "DKK";
    update.balance_updated_at = new Date().toISOString();
  }

  if (input.lastPostingDate) {
    update.last_posting_date = input.lastPostingDate;
  }

  const { error } = await supabase
    .from("import_accounts")
    .update(update)
    .eq("id", input.id)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}
