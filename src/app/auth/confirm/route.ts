import { type EmailOtpType } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

const emailOtpTypes = new Set<EmailOtpType>([
  "email",
  "signup",
  "invite",
  "recovery",
  "email_change",
]);

function getSafeNext(value: string | null) {
  if (value?.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  return "/overblik";
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const next = getSafeNext(requestUrl.searchParams.get("next"));
  const supabase = await createServerSupabaseClient();

  if (!supabase || !tokenHash || !type || !emailOtpTypes.has(type)) {
    const loginUrl = new URL("/login", requestUrl.origin);
    loginUrl.searchParams.set("next", next);
    loginUrl.searchParams.set("auth", "invalid-link");
    return NextResponse.redirect(loginUrl);
  }

  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    const loginUrl = new URL("/login", requestUrl.origin);
    loginUrl.searchParams.set("next", next);
    loginUrl.searchParams.set("auth", "expired-link");
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
