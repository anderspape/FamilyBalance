"use client";

import { Column, Grid, Tag, Tile } from "@carbon/react";
import { CategoryBars } from "@/components/category-bars";
import { TransactionsTable } from "@/components/transactions-table";
import { incomeSources, sectionSummaries } from "@/lib/mock-data";

export default function IncomePage() {
  const income = sectionSummaries.find((summary) => summary.id === "income")!;

  return (
    <>
      <Grid className="page-heading" narrow>
        <Column lg={12} md={8} sm={4}>
          <p className="budget-kicker">Indkomst</p>
          <h1>Alt der kommer ind i husstanden.</h1>
          <p>
            Saml løn, refusioner, renter og andre indtægter, så det er tydeligt
            hvad månedens råderum bygger på.
          </p>
        </Column>
      </Grid>

      <Grid narrow className="budget-grid">
        <Column lg={5} md={4} sm={4}>
          <Tile className="section-summary">
            <div>
              <p className="budget-kicker">{income.label}</p>
              <h2>Indkomst i alt</h2>
            </div>
            <strong>{income.value}</strong>
            <p className="summary-pill">{income.detail}</p>
            <Tag type={income.type}>{income.tag}</Tag>
          </Tile>
        </Column>
        <Column lg={11} md={8} sm={4}>
          <Tile className="panel panel--flush">
            <div className="panel__header">
              <div>
                <p className="budget-kicker">Fordeling</p>
                <h2>Hvor pengene kommer fra</h2>
              </div>
              <Tag type={income.type}>{income.value}</Tag>
            </div>
            <CategoryBars items={incomeSources} tone="income" />
          </Tile>
        </Column>
      </Grid>

      <Grid narrow className="budget-grid">
        <Column lg={16} md={8} sm={4}>
          <TransactionsTable title="Indkomstposter" kicker="Indkomst" />
        </Column>
      </Grid>
    </>
  );
}
