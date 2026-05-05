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
  closedAt: string | null;
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
  closed_at: string | null;
  created_at: string;
};

type ImportAccountBaseRow = Pick<
  ImportAccountRow,
  "id" | "name" | "account_number" | "description" | "created_at"
>;

function isMissingColumnError(error: unknown, columnName: string) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const message =
    "message" in error && typeof error.message === "string"
      ? error.message
      : "";
  const details =
    "details" in error && typeof error.details === "string"
      ? error.details
      : "";

  return `${message} ${details}`
    .toLowerCase()
    .includes(columnName.toLowerCase());
}

function mapBaseImportAccount(row: ImportAccountBaseRow): ImportAccount {
  return {
    id: row.id,
    name: row.name,
    accountNumber: row.account_number,
    description: row.description,
    balanceMinor: null,
    balanceCurrency: "DKK",
    balanceUpdatedAt: null,
    lastImportedAt: null,
    lastPostingDate: null,
    closedAt: null,
    createdAt: row.created_at,
  };
}

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
    closedAt: row.closed_at,
    createdAt: row.created_at,
  };
}

export async function readImportAccounts(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("import_accounts")
    .select(
      "id, name, account_number, description, balance_minor, balance_currency, balance_updated_at, last_imported_at, last_posting_date, closed_at, created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .returns<ImportAccountRow[]>();

  if (
    error &&
    (isMissingColumnError(error, "balance_minor") ||
      isMissingColumnError(error, "closed_at"))
  ) {
    const { data: fallbackData, error: fallbackError } = await supabase
      .from("import_accounts")
      .select("id, name, account_number, description, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .returns<ImportAccountBaseRow[]>();

    if (fallbackError) {
      throw fallbackError;
    }

    return (fallbackData ?? []).map(mapBaseImportAccount);
  }

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
      "id, name, account_number, description, balance_minor, balance_currency, balance_updated_at, last_imported_at, last_posting_date, closed_at, created_at",
    )
    .single<ImportAccountRow>();

  if (
    error &&
    (isMissingColumnError(error, "balance_minor") ||
      isMissingColumnError(error, "closed_at"))
  ) {
    const { data: fallbackData, error: fallbackError } = await supabase
      .from("import_accounts")
      .select("id, name, account_number, description, created_at")
      .eq("user_id", userId)
      .eq("name", input.name.trim())
      .order("created_at", { ascending: false })
      .limit(1)
      .single<ImportAccountBaseRow>();

    if (fallbackError) {
      throw fallbackError;
    }

    if (!fallbackData) {
      throw error;
    }

    return mapBaseImportAccount(fallbackData);
  }

  if (error) {
    throw error;
  }

  return mapImportAccount(data);
}

export async function setImportAccountClosed(
  supabase: SupabaseClient,
  userId: string,
  input: {
    id: string;
    closed: boolean;
  },
) {
  const { error } = await supabase
    .from("import_accounts")
    .update({ closed_at: input.closed ? new Date().toISOString() : null })
    .eq("id", input.id)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
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
