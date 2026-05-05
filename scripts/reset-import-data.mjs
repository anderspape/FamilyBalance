import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(path) {
  try {
    const text = readFileSync(path, "utf8");

    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const separator = trimmed.indexOf("=");
      if (separator === -1) continue;

      const key = trimmed.slice(0, separator).trim();
      const rawValue = trimmed.slice(separator + 1).trim();
      const value = rawValue.replace(/^["']|["']$/g, "");

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // The script can still run when env vars are provided directly.
  }
}

function getEmail() {
  const emailArg = process.argv.find((arg) => arg.startsWith("--email="));
  return emailArg?.slice("--email=".length) || process.env.RESET_IMPORT_EMAIL;
}

async function findUserByEmail(supabase, email) {
  let page = 1;

  while (page < 100) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 100,
    });

    if (error) {
      throw error;
    }

    const user = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === email.toLowerCase(),
    );

    if (user) {
      return user;
    }

    if (data.users.length < 100) {
      break;
    }

    page += 1;
  }

  return null;
}

loadEnvFile(resolve(process.cwd(), ".env.local"));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = getEmail();

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Mangler NEXT_PUBLIC_SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY.",
  );
  process.exit(1);
}

if (!email) {
  console.error(
    "Angiv bruger med --email=din@email.dk eller RESET_IMPORT_EMAIL.",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const user = await findUserByEmail(supabase, email);

if (!user) {
  console.error(`Fandt ingen Supabase-bruger med email ${email}.`);
  process.exit(1);
}

const { count: transactionCount, error: countError } = await supabase
  .from("imported_transactions")
  .select("id", { count: "exact", head: true })
  .eq("user_id", user.id);

if (countError) {
  throw countError;
}

const { error: deleteError } = await supabase
  .from("imported_transactions")
  .delete()
  .eq("user_id", user.id);

if (deleteError) {
  throw deleteError;
}

const { error: accountError } = await supabase
  .from("import_accounts")
  .update({
    balance_minor: null,
    balance_updated_at: null,
    last_imported_at: null,
    last_posting_date: null,
  })
  .eq("user_id", user.id);

if (accountError) {
  throw accountError;
}

console.log(
  `Ryddede ${transactionCount ?? 0} importerede posteringer for ${email}. Konti er bevaret.`,
);
