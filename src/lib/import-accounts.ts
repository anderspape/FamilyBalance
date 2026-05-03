import type { SupabaseClient } from "@supabase/supabase-js";

export type ImportAccount = {
  id: string;
  name: string;
  accountNumber: string | null;
  description: string | null;
  createdAt: string;
};

type ImportAccountRow = {
  id: string;
  name: string;
  account_number: string | null;
  description: string | null;
  created_at: string;
};

function mapImportAccount(row: ImportAccountRow): ImportAccount {
  return {
    id: row.id,
    name: row.name,
    accountNumber: row.account_number,
    description: row.description,
    createdAt: row.created_at,
  };
}

export async function readImportAccounts(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("import_accounts")
    .select("id, name, account_number, description, created_at")
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
    .select("id, name, account_number, description, created_at")
    .single<ImportAccountRow>();

  if (error) {
    throw error;
  }

  return mapImportAccount(data);
}
