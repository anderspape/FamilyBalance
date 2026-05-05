import { NextResponse } from "next/server";
import {
  accounts,
  dashboardMetrics,
  categorySpend,
  incomeExpenseHistory,
  monthlyOverviews,
  monthlySummary,
  sectionSummaries,
} from "@/lib/mock-data";
import { readBankConnectionState } from "@/lib/bank-storage";
import { readImportAccounts } from "@/lib/import-accounts";
import { readImportedTransactions } from "@/lib/imported-transactions";
import { formatDate, formatMinorKr } from "@/lib/money";
import { buildDashboardDataFromPostings } from "@/lib/postings";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const emptyMonthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Maj",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dec",
];

function buildEmptyDashboardData() {
  const now = new Date();
  const id = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const label = `${emptyMonthNames[now.getMonth()]} ${now.getFullYear()}`;
  const emptyOverview = {
    id,
    label,
    monthlySummary:
      "Importer en CSV for at se en økonomisk opsummering for måneden.",
    dashboardMetrics: [
      {
        label: "Kontosaldo",
        value: "0 kr.",
        change: "Ingen CSV-data endnu",
        type: "blue" as const,
      },
      {
        label: `Forbrug i ${emptyMonthNames[now.getMonth()].toLowerCase()}`,
        value: "0 kr.",
        change: "Importer CSV",
        type: "blue" as const,
      },
    ],
    sectionSummaries: [
      {
        id: "income",
        title: "Indkomst",
        label: "Denne måned",
        value: "0 kr.",
        detail: "Ingen CSV-data endnu",
        tag: "CSV",
        type: "blue" as const,
      },
      {
        id: "expenses",
        title: "Udgifter",
        label: "Denne måned",
        value: "0 kr.",
        detail: "Ingen CSV-data endnu",
        tag: "CSV",
        type: "blue" as const,
      },
      {
        id: "savings",
        title: "Opsparing",
        label: "Denne måned",
        value: "0 kr.",
        detail: "Ingen CSV-data endnu",
        tag: "CSV",
        type: "purple" as const,
      },
    ],
    incomeSources: [],
    categorySpend: [],
    insights: [
      {
        id: `${id}-empty-import`,
        type: "data_quality",
        severity: "neutral",
        title: "Importer første CSV",
        body: "Når der ligger posteringer i FamilyBalance, kan coachen finde afvigelser, faste betalinger og de vigtigste drivere i måneden.",
        metric: "0 poster",
        actionLabel: "Gå til import",
        actionHref: "/import",
      },
    ],
    spendingTotal: "0 kr.",
  };

  return {
    accounts: [],
    dashboardMetrics: emptyOverview.dashboardMetrics,
    incomeExpenseHistory: [],
    incomeSources: [],
    categorySpend: [],
    insights: emptyOverview.insights,
    monthlyOverviews: [emptyOverview],
    monthlySummary: emptyOverview.monthlySummary,
    sectionSummaries: emptyOverview.sectionSummaries,
  };
}

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  if (supabase && !user) {
    return NextResponse.json({ error: "Ikke logget ind." }, { status: 401 });
  }

  const bankConnection =
    supabase && user
      ? await readBankConnectionState(supabase, user.id)
      : null;
  const importAccounts = supabase && user ? await readImportAccounts(supabase, user.id) : [];
  const openImportAccounts = importAccounts.filter((account) => !account.closedAt);
  const importedDashboardData =
    supabase && user
      ? buildDashboardDataFromPostings(
          await readImportedTransactions(supabase, user.id),
          openImportAccounts,
        )
      : null;
  const emptyDashboardData = supabase && user && !importedDashboardData
    ? buildEmptyDashboardData()
    : null;
  const importAccountsWithBalance = openImportAccounts
    .map((account) => ({
      name: account.name,
      balance:
        account.balanceMinor !== null
          ? formatMinorKr(account.balanceMinor)
          : "Saldo ikke angivet",
      note: account.lastImportedAt
        ? `Importeret ${formatDate(account.lastImportedAt.slice(0, 10))}`
        : "Ingen import endnu",
      meta: account.lastPostingDate
        ? `Seneste post ${formatDate(account.lastPostingDate)}`
        : undefined,
    }));
  const connectedAccounts =
    bankConnection?.accounts && bankConnection.accounts.length > 0
      ? bankConnection.accounts
      : importAccountsWithBalance.length > 0
        ? importAccountsWithBalance
        : importedDashboardData?.accounts ?? emptyDashboardData?.accounts ?? accounts;
  const dashboardData = importedDashboardData ?? emptyDashboardData;

  return NextResponse.json({
    accounts: connectedAccounts,
    bankConnection: bankConnection
      ? {
          status: bankConnection.status,
          syncedAt: bankConnection.syncedAt,
          error: bankConnection.error,
        }
      : { status: "not_connected" },
    dataSource: importedDashboardData
      ? "imported"
      : emptyDashboardData
        ? "empty"
        : "fallback",
    dashboardMetrics: dashboardData?.dashboardMetrics ?? dashboardMetrics,
    categorySpend: dashboardData?.categorySpend ?? categorySpend,
    insights: dashboardData?.insights ?? [],
    incomeSources: dashboardData?.incomeSources ?? [],
    incomeExpenseHistory:
      dashboardData?.incomeExpenseHistory ?? incomeExpenseHistory,
    monthlyOverviews: dashboardData?.monthlyOverviews ?? monthlyOverviews,
    monthlySummary: dashboardData?.monthlySummary ?? monthlySummary,
    sectionSummaries: dashboardData?.sectionSummaries ?? sectionSummaries,
    syncedAt: bankConnection?.syncedAt ?? new Date().toISOString(),
  });
}
