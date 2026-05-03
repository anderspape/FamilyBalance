import { NextResponse } from "next/server";
import {
  readPosterTransactions,
  updateImportedTransactionCategory,
} from "@/lib/imported-transactions";
import { formatMinorKr } from "@/lib/money";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

async function getUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  return { supabase, user };
}

function monthKey(value: string) {
  return value.slice(0, 7);
}

function matchesPeriod(
  bookingDate: string,
  period: string,
  month: string | null,
  year: string | null,
) {
  if (period === "all") return true;

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0",
  )}`;

  if (period === "current-month") {
    return monthKey(bookingDate) === currentMonth;
  }

  if (period === "month" && month) {
    return monthKey(bookingDate) === month;
  }

  if (period === "year" && year) {
    return bookingDate.startsWith(`${year}-`);
  }

  return true;
}

function searchText(posting: Awaited<ReturnType<typeof readPosterTransactions>>[number]) {
  return [
    posting.description,
    posting.category,
    posting.accountName,
    posting.accountNumber,
    formatMinorKr(posting.amountMinor),
  ]
    .join(" ")
    .toLowerCase();
}

export async function GET(request: Request) {
  const { supabase, user } = await getUser();

  if (!supabase || !user) {
    return NextResponse.json({ error: "Ikke logget ind." }, { status: 401 });
  }

  const url = new URL(request.url);
  const accountId = url.searchParams.get("accountId");
  const period = url.searchParams.get("period") ?? "all";
  const month = url.searchParams.get("month");
  const year = url.searchParams.get("year");
  const query = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const allPostings = await readPosterTransactions(supabase, user.id);
  const filteredPostings = allPostings.filter((posting) => {
    const accountMatches =
      !accountId ||
      accountId === "all" ||
      posting.importAccountId === accountId ||
      posting.accountNumber === accountId;
    const periodMatches = matchesPeriod(posting.bookingDate, period, month, year);
    const queryMatches = !query || searchText(posting).includes(query);

    return accountMatches && periodMatches && queryMatches;
  });
  const totalMinor = filteredPostings.reduce(
    (total, posting) => total + posting.amountMinor,
    0,
  );

  return NextResponse.json({
    transactions: filteredPostings.map((posting) => ({
      id: posting.id,
      importAccountId: posting.importAccountId ?? null,
      accountName: posting.accountName,
      accountNumber: posting.accountNumber,
      bookingDate: posting.bookingDate,
      description: posting.description,
      amountMinor: posting.amountMinor,
      currency: posting.currency,
      category: posting.category,
      kind: posting.kind,
    })),
    summary: {
      count: filteredPostings.length,
      totalMinor,
      averageMinor: filteredPostings.length
        ? Math.round(totalMinor / filteredPostings.length)
        : 0,
      uncategorizedCount: filteredPostings.filter(
        (posting) => !posting.category || posting.category === "Andet",
      ).length,
    },
    options: {
      months: [...new Set(allPostings.map((posting) => monthKey(posting.bookingDate)))]
        .sort()
        .reverse(),
      years: [
        ...new Set(allPostings.map((posting) => posting.bookingDate.slice(0, 4))),
      ]
        .sort()
        .reverse(),
    },
  });
}

export async function PATCH(request: Request) {
  const { supabase, user } = await getUser();

  if (!supabase || !user) {
    return NextResponse.json({ error: "Ikke logget ind." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const category = typeof body.category === "string" ? body.category.trim() : "";

    if (!id || !category) {
      return NextResponse.json(
        { error: "Postering og kategori mangler." },
        { status: 400 },
      );
    }

    await updateImportedTransactionCategory(supabase, user.id, { id, category });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Kategorien kunne ikke gemmes.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
