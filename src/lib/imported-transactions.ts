import type { SupabaseClient } from "@supabase/supabase-js";
import {
  inferPostingKind,
  type ImportedPosting,
  type StoredImportedPosting,
} from "@/lib/postings";

type ImportedTransactionRow = {
  id: string;
  source_hash: string;
  import_account_id: string | null;
  account_name: string;
  account_number: string;
  booking_date: string;
  description: string;
  amount_minor: number;
  currency: "DKK";
  category: string | null;
  raw: Record<string, string>;
  created_at: string;
};

export async function readImportedTransactions(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from("imported_transactions")
    .select(
      "id, source_hash, import_account_id, account_name, account_number, booking_date, description, amount_minor, currency, category, raw, created_at",
    )
    .eq("user_id", userId)
    .order("booking_date", { ascending: false })
    .returns<ImportedTransactionRow[]>();

  if (error) {
    throw error;
  }

  return (data ?? []).map<StoredImportedPosting>((row) => ({
    id: row.id,
    sourceHash: row.source_hash,
    importAccountId: row.import_account_id,
    accountName: row.account_name,
    accountNumber: row.account_number,
    bookingDate: row.booking_date,
    description: row.description,
    amountMinor: row.amount_minor,
    currency: row.currency,
    category: row.category ?? "Andet",
    kind: inferPostingKind(row.category ?? "Andet", row.amount_minor),
    raw: row.raw,
    createdAt: row.created_at,
  }));
}

export async function insertImportedTransactions(
  supabase: SupabaseClient,
  userId: string,
  postings: ImportedPosting[],
  importAccountId?: string,
) {
  const hashes = postings.map((posting) => posting.sourceHash);
  const { data: existingRows, error: existingError } = await supabase
    .from("imported_transactions")
    .select("source_hash")
    .eq("user_id", userId)
    .in("source_hash", hashes)
    .returns<Array<{ source_hash: string }>>();

  if (existingError) {
    throw existingError;
  }

  const existingHashes = new Set(
    (existingRows ?? []).map((row) => row.source_hash),
  );
  const newPostings = postings.filter(
    (posting) => !existingHashes.has(posting.sourceHash),
  );

  if (newPostings.length > 0) {
    const { error } = await supabase.from("imported_transactions").insert(
      newPostings.map((posting) => ({
        user_id: userId,
        source: "csv",
        source_hash: posting.sourceHash,
        import_account_id: importAccountId ?? posting.importAccountId ?? null,
        account_name: posting.accountName,
        account_number: posting.accountNumber,
        booking_date: posting.bookingDate,
        description: posting.description,
        amount_minor: posting.amountMinor,
        currency: posting.currency,
        category: posting.category,
        raw: posting.raw,
      })),
    );

    if (error) {
      throw error;
    }
  }

  return {
    inserted: newPostings.length,
    duplicates: postings.length - newPostings.length,
    total: postings.length,
  };
}

export type PosterTransaction = StoredImportedPosting & {
  id: string;
  createdAt: string;
};

export async function readPosterTransactions(
  supabase: SupabaseClient,
  userId: string,
) {
  const postings = await readImportedTransactions(supabase, userId);

  return postings
    .filter((posting): posting is PosterTransaction =>
      Boolean(posting.id && posting.createdAt),
    )
    .map((posting) => ({
      ...posting,
      id: posting.id!,
      createdAt: posting.createdAt!,
    }));
}

export async function updateImportedTransactionCategory(
  supabase: SupabaseClient,
  userId: string,
  input: {
    id: string;
    category: string;
  },
) {
  const { error } = await supabase
    .from("imported_transactions")
    .update({ category: input.category.trim() })
    .eq("id", input.id)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}
