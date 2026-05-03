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
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

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
  const connectedAccounts =
    bankConnection?.accounts && bankConnection.accounts.length > 0
      ? bankConnection.accounts
      : accounts;

  return NextResponse.json({
    accounts: connectedAccounts,
    bankConnection: bankConnection
      ? {
          status: bankConnection.status,
          syncedAt: bankConnection.syncedAt,
          error: bankConnection.error,
        }
      : { status: "not_connected" },
    dashboardMetrics,
    categorySpend,
    incomeExpenseHistory,
    monthlyOverviews,
    monthlySummary,
    sectionSummaries,
    syncedAt: bankConnection?.syncedAt ?? new Date().toISOString(),
  });
}
