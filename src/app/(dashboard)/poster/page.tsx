import { Column, Grid } from "@carbon/react";
import { PosterTable } from "@/components/poster-table";
import { readImportAccounts } from "@/lib/import-accounts";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type PosterPageSearchParams = {
  accountId?: string;
  period?: string;
  month?: string;
  year?: string;
  q?: string;
};

export default async function PosterPage({
  searchParams,
}: {
  searchParams?: Promise<PosterPageSearchParams>;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const accounts = supabase && user ? await readImportAccounts(supabase, user.id) : [];
  const params = (await searchParams) ?? {};

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

      <PosterTable
        accounts={accounts}
        initialFilters={{
          accountId: params.accountId,
          month: params.month,
          period: params.period,
          query: params.q,
          year: params.year,
        }}
      />
    </>
  );
}
