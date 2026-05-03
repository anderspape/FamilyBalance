import { NextResponse } from "next/server";
import { insertImportedTransactions } from "@/lib/imported-transactions";
import { updateImportAccountAfterImport } from "@/lib/import-accounts";
import { parseDanishAmountToMinor } from "@/lib/money";
import { parsePostingsCsv } from "@/lib/postings";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;

    if (typeof message === "string") {
      return message;
    }
  }

  return "CSV-importen fejlede. Tjek filen og prøv igen.";
}

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
    const balance = formData.get("balance") ?? formData.get("balance_minor");

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
    const balanceText = typeof balance === "string" ? balance.trim() : "";
    const balanceMinor = balanceText ? parseDanishAmountToMinor(balanceText) : null;

    if (balanceText && balanceMinor === null) {
      return NextResponse.json(
        { error: "Saldo skal være et tal, fx 64.844,61." },
        { status: 400 },
      );
    }

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

    let warning: string | undefined;

    if (selectedAccountId) {
      try {
        await updateImportAccountAfterImport(supabase, user.id, {
          id: selectedAccountId,
          balanceMinor: balanceMinor ?? undefined,
          lastPostingDate,
        });
      } catch (error) {
        warning =
          "Posteringerne er importeret, men kontoens saldo/metadata kunne ikke opdateres. Kør den seneste Supabase-migration.";
        console.error("Import account metadata update failed", error);
      }
    }

    return NextResponse.json({ ...result, warning });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
  }
}
