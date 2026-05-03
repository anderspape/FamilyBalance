import { NextRequest, NextResponse } from "next/server";
import {
  readBankConnectionState,
  writeBankConnectionState,
} from "@/lib/bank-storage";
import { createServerSupabaseClient } from "@/lib/supabase-server";

function redirectToOverview(request: NextRequest, params: Record<string, string>) {
  const url = new URL("/overblik", request.nextUrl.origin);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  if (!supabase || !user) {
    return redirectToOverview(request, {
      bank: "error",
      message: "Du skal være logget ind i FamilyBalance først.",
    });
  }

  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    const state = await readBankConnectionState(supabase, user.id);
    await writeBankConnectionState(supabase, user.id, {
      provider: "gocardless",
      status: "error",
      reference: state?.reference,
      requisitionId: state?.requisitionId,
      error,
    });

    return redirectToOverview(request, { bank: "error", message: error });
  }

  const state = await readBankConnectionState(supabase, user.id);

  if (!state?.requisitionId) {
    await writeBankConnectionState(supabase, user.id, {
      provider: "gocardless",
      status: "error",
      error: "Missing requisition after bank callback",
    });

    return redirectToOverview(request, {
      bank: "error",
      message: "Missing requisition after bank callback",
    });
  }

  await writeBankConnectionState(supabase, user.id, {
    ...state,
    status: "connected",
    connectedAt: state.connectedAt ?? new Date().toISOString(),
  });

  return redirectToOverview(request, { bank: "connected" });
}
