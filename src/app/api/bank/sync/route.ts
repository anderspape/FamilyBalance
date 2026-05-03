import { NextResponse } from "next/server";
import {
  readBankConnectionState,
  writeBankConnectionState,
  type StoredBankAccount,
  type StoredBankTransaction,
} from "@/lib/bank-storage";
import {
  balanceMinor,
  createAccessToken,
  formatBalance,
  getAccountBalances,
  getAccountDetails,
  getAccountTransactions,
  getRequisition,
  transactionLabel,
} from "@/lib/gocardless";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  if (!supabase || !user) {
    return NextResponse.json({ error: "Ikke logget ind." }, { status: 401 });
  }

  const state = await readBankConnectionState(supabase, user.id);

  if (!state?.requisitionId) {
    return NextResponse.json(
      { error: "Ingen bankforbindelse fundet endnu." },
      { status: 409 },
    );
  }

  await writeBankConnectionState(supabase, user.id, { ...state, status: "syncing" });

  try {
    const requisition = await getRequisition(state.requisitionId);
    const accountIds = requisition.accounts ?? [];
    const token = await createAccessToken();
    const accounts: StoredBankAccount[] = [];
    const transactions: StoredBankTransaction[] = [];

    for (const accountId of accountIds) {
      const [details, balances, accountTransactions] = await Promise.all([
        getAccountDetails(accountId, token.access),
        getAccountBalances(accountId, token.access),
        getAccountTransactions(accountId, token.access),
      ]);
      const account = details.account;
      const accountName =
        account?.displayName ??
        account?.name ??
        account?.ownerName ??
        account?.iban ??
        accountId;
      const bookedTransactions = accountTransactions.transactions?.booked ?? [];
      const accountBalance = balanceMinor(balances.balances);

      accounts.push({
        id: accountId,
        name: accountName,
        balance: formatBalance(balances.balances),
        balanceMinor: accountBalance.amountMinor,
        currency: accountBalance.currency,
        note: `${bookedTransactions.length} posteringer hentet`,
      });

      transactions.push(
        ...bookedTransactions.map((transaction) => ({
          accountId,
          transactionId: transaction.transactionId,
          bookingDate: transaction.bookingDate,
          valueDate: transaction.valueDate,
          remittanceInformation: transactionLabel(transaction),
          creditorName: transaction.creditorName,
          debtorName: transaction.debtorName,
          amount: transaction.transactionAmount.amount,
          currency: transaction.transactionAmount.currency,
          raw: transaction,
        })),
      );
    }

    const nextState = {
      ...state,
      status: "connected" as const,
      syncedAt: new Date().toISOString(),
      accounts,
      transactions,
      error: undefined,
    };

    await writeBankConnectionState(supabase, user.id, nextState);

    return NextResponse.json({
      accounts: accounts.length,
      transactions: transactions.length,
      syncedAt: nextState.syncedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ukendt sync-fejl";

    await writeBankConnectionState(supabase, user.id, {
      ...state,
      status: "error",
      error: message,
    });

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
