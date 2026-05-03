"use client";

import { Column, Grid, Select, SelectItem, Tag, Tile } from "@carbon/react";
import { CategoryBars } from "@/components/category-bars";
import { TransactionsTable } from "@/components/transactions-table";
import { categorySpend, sectionSummaries } from "@/lib/mock-data";

export default function ExpensesPage() {
  const expenses = sectionSummaries.find((summary) => summary.id === "expenses")!;

  return (
    <>
      <Grid className="page-heading" narrow>
        <Column lg={12} md={8} sm={4}>
          <p className="budget-kicker">Udgifter</p>
          <h1>Hvad pengene bliver brugt på.</h1>
          <p>
            Udgiftssiden er stedet for kategorier, budgetpres og de poster, der
            kræver en bedre regel.
          </p>
        </Column>
      </Grid>

      <Grid narrow className="budget-grid">
        <Column lg={5} md={4} sm={4}>
          <Tile className="section-summary">
            <div>
              <p className="budget-kicker">{expenses.label}</p>
              <h2>Udgifter i alt</h2>
            </div>
            <strong>{expenses.value}</strong>
            <p className="summary-pill">{expenses.detail}</p>
            <Tag type={expenses.type}>{expenses.tag}</Tag>
          </Tile>
        </Column>
        <Column lg={11} md={8} sm={4}>
          <Tile className="panel panel--flush">
            <div className="panel__header">
              <div>
                <p className="budget-kicker">Maj 2026</p>
                <h2>Forbrug pr. kategori</h2>
              </div>
              <Select id="expenses-period" labelText="Periode" size="sm" defaultValue="month">
                <SelectItem value="month" text="Denne måned" />
                <SelectItem value="quarter" text="Dette kvartal" />
                <SelectItem value="year" text="Dette år" />
              </Select>
            </div>
            <CategoryBars items={categorySpend} />
          </Tile>
        </Column>
      </Grid>

      <Grid narrow className="budget-grid">
        <Column lg={16} md={8} sm={4}>
          <TransactionsTable title="Udgiftsposter" kicker="Udgifter" />
        </Column>
      </Grid>
    </>
  );
}
