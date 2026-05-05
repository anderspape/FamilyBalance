import { NextResponse } from "next/server";
import {
  createImportAccount,
  readImportAccounts,
  setImportAccountClosed,
} from "@/lib/import-accounts";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

async function getUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await getUser();

  if (!supabase || !user) {
    return NextResponse.json({ error: "Ikke logget ind." }, { status: 401 });
  }

  const accounts = await readImportAccounts(supabase, user.id);

  return NextResponse.json({ accounts });
}

export async function POST(request: Request) {
  const { supabase, user } = await getUser();

  if (!supabase || !user) {
    return NextResponse.json({ error: "Ikke logget ind." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!name) {
      return NextResponse.json({ error: "Kontonavn mangler." }, { status: 400 });
    }

    const account = await createImportAccount(supabase, user.id, {
      name,
      accountNumber:
        typeof body.accountNumber === "string" ? body.accountNumber : undefined,
      description:
        typeof body.description === "string" ? body.description : undefined,
    });

    return NextResponse.json({ account }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Kontoen kunne ikke oprettes.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const { supabase, user } = await getUser();

  if (!supabase || !user) {
    return NextResponse.json({ error: "Ikke logget ind." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const closed = typeof body.closed === "boolean" ? body.closed : null;

    if (!id || closed === null) {
      return NextResponse.json(
        { error: "Konto og lukket-status mangler." },
        { status: 400 },
      );
    }

    await setImportAccountClosed(supabase, user.id, { id, closed });
    const accounts = await readImportAccounts(supabase, user.id);

    return NextResponse.json({ accounts });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Kontoen kunne ikke opdateres.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
