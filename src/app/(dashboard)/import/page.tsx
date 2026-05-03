import { MagicWand } from "@carbon/icons-react";
import { Column, Grid } from "@carbon/react";
import { CsvImportWorkspace } from "@/components/csv-import-workspace";

export default function ImportPage() {
  return (
    <>
      <Grid className="budget-hero" narrow>
        <Column lg={12} md={8} sm={4}>
          <h1>Importer konti og posteringer.</h1>
          <p className="ai-summary">
            <MagicWand size={20} />
            <span>
              Opret en konto, vælg hvor CSV’en hører til, og drop filen. Nye
              posteringer bliver gemt sikkert på din bruger og dubletter bliver
              sprunget over.
            </span>
          </p>
        </Column>
      </Grid>
      <CsvImportWorkspace />
    </>
  );
}
