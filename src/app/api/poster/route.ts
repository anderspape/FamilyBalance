import { NextResponse } from "next/server";
import {
  readPosterTransactions,
  updateImportedTransactionCategory,
} from "@/lib/imported-transactions";
import {
  getPostingTypeLabel,
  isVisibleSpendingType,
  resolveCategory,
} from "@/lib/categories";
import { formatMinorKr } from "@/lib/money";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const privateCacheHeaders = {
  "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
};
const noStoreHeaders = { "Cache-Control": "no-store" };

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

  if (period === "last-3-months" || period === "last-12-months") {
    const monthsBack = period === "last-3-months" ? 2 : 11;
    const start = new Date(Date.UTC(now.getFullYear(), now.getMonth() - monthsBack, 1));
    const booking = new Date(`${bookingDate}T00:00:00.000Z`);

    return booking >= start;
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
  const category = resolveCategory(posting.category);

  return [
    posting.description,
    category.mainCategory,
    category.name,
    getPostingTypeLabel(category.postingType),
    posting.accountName,
    posting.accountNumber,
    formatMinorKr(posting.amountMinor),
  ]
    .join(" ")
    .toLowerCase();
}

function isLikelyInternalTransfer(text: string) {
  const lower = text.toLowerCase();
  const transferText =
    /^overførsel\b/i.test(text.trim()) ||
    /^overfoersel\b/i.test(text.trim()) ||
    [
      "overførsel konto",
      "overfoersel konto",
      "konto 9070",
      "overført til",
      "overfort til",
      "til husholdningskonto",
      "til budgetkonto",
      "til opsparingskonto",
    ].some((word) => lower.includes(word));
  const incomeText = [
    "løn",
    "loen",
    "månedsløn",
    "maanedsloen",
    "lønoverførsel",
    "loenoverfoersel",
    "skat",
    "børne",
    "boerne",
    "ungeydelse",
    "refusion",
    "rente",
    "udbytte",
    "afkast",
    "gave",
  ].some((word) => lower.includes(word));

  return transferText && !incomeText;
}

function normalizedCategory(posting: Awaited<ReturnType<typeof readPosterTransactions>>[number]) {
  const savedCategory = resolveCategory(posting.category);

  if (
    posting.amountMinor > 0 &&
    savedCategory.postingType === "income" &&
    isLikelyInternalTransfer(posting.description)
  ) {
    return resolveCategory("Kontooverførsel", "transfer");
  }

  return savedCategory;
}

export async function GET(request: Request) {
  const { supabase, user } = await getUser();

  if (!supabase || !user) {
    return NextResponse.json(
      { error: "Ikke logget ind." },
      { headers: noStoreHeaders, status: 401 },
    );
  }

  const url = new URL(request.url);
  const accountId = url.searchParams.get("accountId");
  const period = url.searchParams.get("period") ?? "all";
  const month = url.searchParams.get("month");
  const year = url.searchParams.get("year");
  const query = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const flow = url.searchParams.get("flow");
  const mainCategory = url.searchParams.get("mainCategory");
  const categorySlug = url.searchParams.get("category");
  const allPostings = await readPosterTransactions(supabase, user.id);
  const filteredPostings = allPostings.filter((posting) => {
    const category = normalizedCategory(posting);
    const accountMatches =
      !accountId ||
      accountId === "all" ||
      posting.importAccountId === accountId ||
      posting.accountNumber === accountId;
    const periodMatches = matchesPeriod(posting.bookingDate, period, month, year);
    const queryMatches = !query || searchText(posting).includes(query);
    const categoryMatches =
      !categorySlug ||
      categorySlug === "all" ||
      category.slug === categorySlug ||
      category.mainCategory === categorySlug;
    const mainCategoryMatches =
      !mainCategory || mainCategory === "all" || category.mainCategory === mainCategory;
    const flowMatches =
      !flow ||
      flow === "all" ||
      (flow === "income" &&
        posting.amountMinor > 0 &&
        category.postingType === "income") ||
      (flow === "expenses" &&
        posting.amountMinor < 0 &&
        isVisibleSpendingType(category.postingType)) ||
      (flow === "savings" &&
        posting.amountMinor < 0 &&
        category.mainCategory === "Pension & Opsparing");

    return (
      accountMatches &&
      periodMatches &&
      queryMatches &&
      categoryMatches &&
      mainCategoryMatches &&
      flowMatches
    );
  });
  const totalMinor = filteredPostings.reduce(
    (total, posting) => total + posting.amountMinor,
    0,
  );

  return NextResponse.json(
    {
      transactions: filteredPostings.map((posting) => {
        const category = normalizedCategory(posting);

        return {
          id: posting.id,
          importAccountId: posting.importAccountId ?? null,
          accountName: posting.accountName,
          accountNumber: posting.accountNumber,
          bookingDate: posting.bookingDate,
          description: posting.description,
          amountMinor: posting.amountMinor,
          currency: posting.currency,
          category: category.name,
          categorySlug: category.slug,
          mainCategory: category.mainCategory,
          subcategory: category.name,
          kind: category.postingType,
          postingType: category.postingType,
          postingTypeLabel: getPostingTypeLabel(category.postingType),
        };
      }),
      summary: {
        count: filteredPostings.length,
        totalMinor,
        averageMinor: filteredPostings.length
          ? Math.round(totalMinor / filteredPostings.length)
          : 0,
        uncategorizedCount: filteredPostings.filter(
          (posting) =>
            resolveCategory(posting.category).postingType === "uncategorized",
        ).length,
      },
      options: {
        months: [
          ...new Set(allPostings.map((posting) => monthKey(posting.bookingDate))),
        ]
          .sort()
          .reverse(),
        years: [
          ...new Set(allPostings.map((posting) => posting.bookingDate.slice(0, 4))),
        ]
          .sort()
          .reverse(),
      },
    },
    { headers: privateCacheHeaders },
  );
}

export async function PATCH(request: Request) {
  const { supabase, user } = await getUser();

  if (!supabase || !user) {
    return NextResponse.json(
      { error: "Ikke logget ind." },
      { headers: noStoreHeaders, status: 401 },
    );
  }

  try {
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const category = typeof body.category === "string" ? body.category.trim() : "";

    if (!id || !category) {
      return NextResponse.json(
        { error: "Postering og kategori mangler." },
        { headers: noStoreHeaders, status: 400 },
      );
    }

    await updateImportedTransactionCategory(supabase, user.id, { id, category });

    return NextResponse.json({ ok: true }, { headers: noStoreHeaders });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Kategorien kunne ikke gemmes.";

    return NextResponse.json(
      { error: message },
      { headers: noStoreHeaders, status: 400 },
    );
  }
}
