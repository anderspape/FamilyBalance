"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Column, Grid, Select, SelectItem, Tag, Tile } from "@carbon/react";
import { CategoryBars } from "@/components/category-bars";
import { TransactionsTable } from "@/components/transactions-table";
import {
  categorySpend as staticCategorySpend,
  incomeSources as staticIncomeSources,
  monthlyOverviews as staticMonthlyOverviews,
} from "@/lib/mock-data";

type SectionId = "income" | "expenses";

type MonthlyOverview = (typeof staticMonthlyOverviews)[number] & {
  incomeSources?: typeof staticIncomeSources;
};

type SectionCopy = {
  pageKicker: string;
  pageTitle: string;
  pageBody: string;
  totalTitle: string;
  chartTitle: string;
  transactionsTitle: string;
  transactionsKicker: string;
};

const sectionCopy: Record<SectionId, SectionCopy> = {
  income: {
    pageKicker: "Indkomst",
    pageTitle: "Alt der kommer ind i husstanden.",
    pageBody:
      "Saml løn, refusioner, renter og andre indtægter, så det er tydeligt hvad månedens råderum bygger på.",
    totalTitle: "Indkomst i alt",
    chartTitle: "Hvor pengene kommer fra",
    transactionsTitle: "Indkomstposter",
    transactionsKicker: "Indkomst",
  },
  expenses: {
    pageKicker: "Udgifter",
    pageTitle: "Hvad pengene bliver brugt på.",
    pageBody:
      "Udgiftssiden er stedet for kategorier, budgetpres og de poster, der kræver en bedre regel.",
    totalTitle: "Udgifter i alt",
    chartTitle: "Forbrug pr. kategori",
    transactionsTitle: "Udgiftsposter",
    transactionsKicker: "Udgifter",
  },
};

function fallbackItems(sectionId: SectionId) {
  return sectionId === "income" ? staticIncomeSources : staticCategorySpend;
}

export function MonthlySectionPage({ sectionId }: { sectionId: SectionId }) {
  const copy = sectionCopy[sectionId];
  const [monthlyOverviews, setMonthlyOverviews] =
    useState<MonthlyOverview[]>(staticMonthlyOverviews);
  const [selectedMonthId, setSelectedMonthId] = useState(
    staticMonthlyOverviews.at(-1)?.id ?? "",
  );
  const [dataSource, setDataSource] = useState<"imported" | "empty" | "fallback">(
    "fallback",
  );

  const fetchBudgetData = useCallback(async () => {
    const response = await fetch("/api/budget-data", { cache: "no-store" });
    if (!response.ok) return;

    const data = await response.json();
    const nextOverviews = data.monthlyOverviews ?? staticMonthlyOverviews;

    setMonthlyOverviews(nextOverviews);
    setDataSource(data.dataSource ?? "fallback");
    setSelectedMonthId((currentId) => {
      const hasCurrentMonth = nextOverviews.some(
        (overview: MonthlyOverview) => overview.id === currentId,
      );

      return hasCurrentMonth ? currentId : nextOverviews.at(-1)?.id ?? currentId;
    });
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(fetchBudgetData, 0);
    window.addEventListener("familybalance:sync", fetchBudgetData);

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("familybalance:sync", fetchBudgetData);
    };
  }, [fetchBudgetData]);

  const selectedOverview = useMemo(
    () =>
      monthlyOverviews.find((overview) => overview.id === selectedMonthId) ??
      monthlyOverviews.at(-1)!,
    [monthlyOverviews, selectedMonthId],
  );
  const summary = selectedOverview.sectionSummaries.find(
    (item) => item.id === sectionId,
  );
  const items =
    sectionId === "income"
      ? selectedOverview.incomeSources ?? fallbackItems(sectionId)
      : selectedOverview.categorySpend ?? fallbackItems(sectionId);
  const isEmpty = dataSource === "empty";

  return (
    <>
      <Grid className="page-heading" narrow>
        <Column lg={12} md={8} sm={4}>
          <p className="budget-kicker">{copy.pageKicker}</p>
          <h1>{copy.pageTitle}</h1>
          <p>{copy.pageBody}</p>
        </Column>
      </Grid>

      <Grid narrow className="budget-grid">
        <Column lg={5} md={4} sm={4}>
          <Tile className="section-summary">
            <div>
              <p className="budget-kicker">{summary?.label ?? "Denne måned"}</p>
              <h2>{copy.totalTitle}</h2>
            </div>
            <strong>{summary?.value ?? "0 kr."}</strong>
            <p className="summary-pill">
              {summary?.detail ?? "Ingen CSV-data endnu"}
            </p>
            {summary ? <Tag type={summary.type}>{summary.tag}</Tag> : null}
          </Tile>
        </Column>
        <Column lg={11} md={8} sm={4}>
          <Tile className="panel panel--flush">
            <div className="panel__header">
              <div>
                <p className="budget-kicker">{selectedOverview.label}</p>
                <h2>{copy.chartTitle}</h2>
              </div>
              <Select
                className="month-select"
                hideLabel
                id={`${sectionId}-month`}
                labelText="Måned"
                onChange={(event) => setSelectedMonthId(event.target.value)}
                size="sm"
                value={selectedOverview.id}
              >
                {monthlyOverviews.map((overview) => (
                  <SelectItem
                    key={overview.id}
                    text={overview.label}
                    value={overview.id}
                  />
                ))}
              </Select>
            </div>
            {isEmpty ? (
              <div className="empty-state">
                Importer en CSV for at se data for denne side.
              </div>
            ) : (
              <CategoryBars
                items={items}
                tone={sectionId === "income" ? "income" : "expense"}
              />
            )}
          </Tile>
        </Column>
      </Grid>

      <Grid narrow className="budget-grid">
        <Column lg={16} md={8} sm={4}>
          <TransactionsTable
            flow={sectionId === "income" ? "income" : "expenses"}
            kicker={copy.transactionsKicker}
            month={selectedOverview.id}
            title={copy.transactionsTitle}
          />
        </Column>
      </Grid>
    </>
  );
}
