import { NextResponse } from "next/server";
import { insertImportedTransactions } from "@/lib/imported-transactions";
import { updateImportAccountAfterImport } from "@/lib/import-accounts";
import { parseDanishAmountToMinor } from "@/lib/money";
import { parsePostingsCsv } from "@/lib/postings";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  if (!supabase || !user) {
    return NextResponse.json({ error: "Ikke logget ind." }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const accountId = formData.get("account_id");
    const accountName = formData.get("account_name");
    const accountNumber = formData.get("account_number");
    const balance = formData.get("balance_minor");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "CSV-fil mangler." }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      return NextResponse.json(
        { error: "Upload en CSV-fil i posteringsformatet." },
        { status: 400 },
      );
    }

    const selectedAccountName =
      typeof accountName === "string" ? accountName.trim() : "";
    const selectedAccountNumber =
      typeof accountNumber === "string" ? accountNumber.trim() : "";
    const selectedAccountId =
      typeof accountId === "string" ? accountId.trim() : "";
    const balanceMinor =
      typeof balance === "string" && balance.trim()
        ? parseDanishAmountToMinor(balance)
        : null;

    const text = await file.text();
    const postings = parsePostingsCsv(text, {
      accountName: selectedAccountName || undefined,
      accountNumber: selectedAccountNumber || undefined,
    });
    const result = await insertImportedTransactions(
      supabase,
      user.id,
      postings,
      selectedAccountId || undefined,
    );
    const lastPostingDate =
      postings
        .map((posting) => posting.bookingDate)
        .sort()
        .at(-1) ?? null;

    if (selectedAccountId) {
      await updateImportAccountAfterImport(supabase, user.id, {
        id: selectedAccountId,
        balanceMinor: balanceMinor ?? undefined,
        lastPostingDate,
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "CSV-importen fejlede. Tjek filen og prøv igen.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
