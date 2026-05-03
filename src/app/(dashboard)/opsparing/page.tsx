"use client";

import { Column, Grid, Tag, Tile } from "@carbon/react";
import { SavingsGoals } from "@/components/savings-goals";
import { TransactionsTable } from "@/components/transactions-table";
import { savingsGoals, sectionSummaries } from "@/lib/mock-data";

export default function SavingsPage() {
  const savings = sectionSummaries.find((summary) => summary.id === "savings")!;

  return (
    <>
      <Grid className="page-heading" narrow>
        <Column lg={12} md={8} sm={4}>
          <p className="budget-kicker">Opsparing</p>
          <h1>Buffer, mål og penge sat til side.</h1>
          <p>
            Opsparing skal vise fremdrift, ikke kun saldo. Her samles mål,
            reserver og senere automatiske forslag.
          </p>
        </Column>
      </Grid>

      <Grid narrow className="budget-grid">
        <Column lg={5} md={4} sm={4}>
          <Tile className="section-summary">
            <div>
              <p className="budget-kicker">{savings.label}</p>
              <h2>Opsparing</h2>
            </div>
            <strong>{savings.value}</strong>
            <p className="summary-pill">{savings.detail}</p>
            <Tag type={savings.type}>{savings.tag}</Tag>
          </Tile>
        </Column>
        <Column lg={11} md={8} sm={4}>
          <Tile className="panel panel--flush">
            <div className="panel__header">
              <div>
                <p className="budget-kicker">Mål</p>
                <h2>Mål og buffer</h2>
              </div>
              <Tag type="purple">{savingsGoals.length} aktive mål</Tag>
            </div>
            <SavingsGoals goals={savingsGoals} />
          </Tile>
        </Column>
      </Grid>

      <Grid narrow className="budget-grid">
        <Column lg={16} md={8} sm={4}>
          <TransactionsTable title="Opsparingsposter" kicker="Opsparing" />
        </Column>
      </Grid>
    </>
  );
}
