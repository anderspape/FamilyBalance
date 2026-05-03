import { Column, Grid } from "@carbon/react";
import { PosterTable } from "@/components/poster-table";
import { readImportAccounts } from "@/lib/import-accounts";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export default async function PosterPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const accounts = supabase && user ? await readImportAccounts(supabase, user.id) : [];

  return (
    <>
      <Grid className="page-heading" narrow>
        <Column lg={12} md={8} sm={4}>
          <p className="budget-kicker">Poster</p>
          <h1>Søg, filtrer og ret dine posteringer.</h1>
          <p>
            Alle importerede bankposter samles her, så du kan finde bevægelser,
            afgrænse perioder og rette kategorier direkte.
          </p>
        </Column>
      </Grid>

      <PosterTable accounts={accounts} />
    </>
  );
}
