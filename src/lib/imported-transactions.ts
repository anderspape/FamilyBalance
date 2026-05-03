import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImportedPosting, StoredImportedPosting } from "@/lib/postings";

type ImportedTransactionRow = {
  id: string;
  source_hash: string;
  account_name: string;
  account_number: string;
  booking_date: string;
  description: string;
  amount_minor: number;
  currency: "DKK";
  category: string | null;
  kind: StoredImportedPosting["kind"];
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
      "id, source_hash, account_name, account_number, booking_date, description, amount_minor, currency, category, kind, raw, created_at",
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
    accountName: row.account_name,
    accountNumber: row.account_number,
    bookingDate: row.booking_date,
    description: row.description,
    amountMinor: row.amount_minor,
    currency: row.currency,
    category: row.category ?? "Andet",
    kind: row.kind,
    raw: row.raw,
    createdAt: row.created_at,
  }));
}

export async function insertImportedTransactions(
  supabase: SupabaseClient,
  userId: string,
  postings: ImportedPosting[],
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
        account_name: posting.accountName,
        account_number: posting.accountNumber,
        booking_date: posting.bookingDate,
        description: posting.description,
        amount_minor: posting.amountMinor,
        currency: posting.currency,
        category: posting.category,
        kind: posting.kind,
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
