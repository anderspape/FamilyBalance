import { NextRequest, NextResponse } from "next/server";
import { createRequisition, getInstitutionId } from "@/lib/gocardless";
import { writeBankConnectionState } from "@/lib/bank-storage";
import { createServerSupabaseClient } from "@/lib/supabase-server";

function getOrigin(request: NextRequest) {
  return process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  if (!supabase || !user) {
    return NextResponse.redirect(new URL("/login", getOrigin(request)));
  }

  try {
    const reference = crypto.randomUUID();
    const requisition = await createRequisition({
      reference,
      redirect: `${getOrigin(request)}/api/bank/callback`,
    });

    await writeBankConnectionState(supabase, user.id, {
      provider: "gocardless",
      status: "consent_pending",
      reference,
      requisitionId: requisition.id,
      connectedAt: new Date().toISOString(),
    });

    return NextResponse.redirect(requisition.link);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown bank error";

    await writeBankConnectionState(supabase, user.id, {
      provider: "gocardless",
      status: "error",
      error: message,
    });

    const url = new URL("/overblik", getOrigin(request));
    url.searchParams.set("bank", "error");
    url.searchParams.set("message", message);

    return NextResponse.redirect(url);
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}

export async function OPTIONS() {
  return NextResponse.json({
    provider: "gocardless",
    institutionId: getInstitutionId(),
  });
}
