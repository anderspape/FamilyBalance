"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Column,
  Grid,
  Link,
  Select,
  SelectItem,
  StructuredListBody,
  StructuredListCell,
  StructuredListHead,
  StructuredListRow,
  StructuredListWrapper,
  Tile,
} from "@carbon/react";
import { Account, MagicWand } from "@carbon/icons-react";
import {
  accounts as staticAccounts,
  monthlyOverviews as staticMonthlyOverviews,
} from "@/lib/mock-data";
import { IncomeExpenseChart } from "@/components/income-expense-chart";
import { SpendingVisualization } from "@/components/spending-visualization";

export default function OverviewPage() {
  const [overviewData, setOverviewData] = useState({
    accounts: staticAccounts,
    monthlyOverviews: staticMonthlyOverviews,
  });
  const [selectedMonthId, setSelectedMonthId] = useState(
    staticMonthlyOverviews.at(-1)?.id ?? "",
  );
  const fetchBudgetData = useCallback(async () => {
    const response = await fetch("/api/budget-data", { cache: "no-store" });
    if (!response.ok) return;

    const data = await response.json();
    setOverviewData({
      accounts: data.accounts ?? staticAccounts,
      monthlyOverviews: data.monthlyOverviews ?? staticMonthlyOverviews,
    });
    setSelectedMonthId((currentId) => {
      const hasCurrentMonth = data.monthlyOverviews?.some(
        (overview: (typeof staticMonthlyOverviews)[number]) =>
          overview.id === currentId,
      );

      return hasCurrentMonth
        ? currentId
        : data.monthlyOverviews?.at(-1)?.id ?? currentId;
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
      overviewData.monthlyOverviews.find(
        (overview) => overview.id === selectedMonthId,
      ) ?? overviewData.monthlyOverviews.at(-1)!,
    [overviewData.monthlyOverviews, selectedMonthId],
  );

  return (
    <>
      <Grid className="budget-hero" narrow>
        <Column lg={12} md={8} sm={4}>
          <h1>Overblik over indkomst, udgifter og opsparing.</h1>
          <p className="ai-summary">
            <MagicWand size={20} />
            <span>{selectedOverview.monthlySummary}</span>
          </p>
        </Column>
      </Grid>

      <Grid narrow className="budget-grid overview-layout">
        <Column lg={11} md={8} sm={4}>
          <div className="overview-main">
            <section
              aria-labelledby="overview-section-title"
              className="overview-section"
            >
              <div className="section-title-row">
                <h2 id="overview-section-title">Overblik</h2>
                <Select
                  className="month-select"
                  hideLabel
                  id="overview-month"
                  labelText="Måned"
                  onChange={(event) => setSelectedMonthId(event.target.value)}
                  size="sm"
                  value={selectedOverview.id}
                >
                  {overviewData.monthlyOverviews.map((overview) => (
                    <SelectItem
                      key={overview.id}
                      text={overview.label}
                      value={overview.id}
                    />
                  ))}
                </Select>
              </div>
              <Grid narrow className="overview-nested-grid">
                {selectedOverview.dashboardMetrics.map((metric) => (
                  <Column key={metric.label} lg={4} md={4} sm={4}>
                    <Tile className="metric-tile">
                      <span>{metric.label}</span>
                      <strong>{metric.value}</strong>
                      <span
                        className={`metric-pill metric-pill--${metric.type}`}
                      >
                        {metric.change}
                      </span>
                    </Tile>
                  </Column>
                ))}
                {selectedOverview.sectionSummaries
                  .filter((summary) => summary.id !== "expenses")
                  .map((summary) => (
                    <Column key={summary.id} lg={4} md={4} sm={4}>
                      <Tile className="section-summary">
                        <div>
                          <p className="budget-kicker">{summary.label}</p>
                          <h2>{summary.title}</h2>
                        </div>
                        <strong>{summary.value}</strong>
                        <p className="summary-pill">{summary.detail}</p>
                      </Tile>
                    </Column>
                  ))}
              </Grid>
            </section>

            <Tile className="panel spending-panel">
              <div className="panel__header">
                <div>
                  <p className="budget-kicker">{selectedOverview.label}</p>
                  <h2>Forbrug pr. kategori</h2>
                </div>
              </div>
              <SpendingVisualization
                items={selectedOverview.categorySpend}
                monthLabel={selectedOverview.label}
                totalAmount={selectedOverview.spendingTotal}
              />
            </Tile>

            <Tile className="panel">
              <IncomeExpenseChart />
            </Tile>
          </div>
        </Column>

        <Column lg={5} md={8} sm={4}>
          <Tile className="panel accounts-panel">
            <div className="panel__header">
              <div>
                <p className="budget-kicker">Bankkonti</p>
                <h2>Konti</h2>
              </div>
              <span className="metric-pill metric-pill--green">Klar</span>
            </div>
            <StructuredListWrapper className="accounts-list" isCondensed>
              <StructuredListHead>
                <StructuredListRow head>
                  <StructuredListCell head>Konto</StructuredListCell>
                  <StructuredListCell head>Bevægelse</StructuredListCell>
                </StructuredListRow>
              </StructuredListHead>
              <StructuredListBody>
                {overviewData.accounts.map((account) => (
                  <StructuredListRow key={account.name}>
                    <StructuredListCell>
                      <div className="account-name">
                        <strong>{account.name}</strong>
                        {"note" in account ? <span>{account.note}</span> : null}
                      </div>
                    </StructuredListCell>
                    <StructuredListCell>{account.balance}</StructuredListCell>
                  </StructuredListRow>
                ))}
              </StructuredListBody>
            </StructuredListWrapper>
            <p className="accounts-panel__meta">Sidst synkroniseret i dag kl. 20:40</p>
          </Tile>
        </Column>
      </Grid>

      <footer className="budget-footer">
        <Account size={16} />
        <span>Dansk UI, engelsk kode, lokal-first data.</span>
        <Link href="https://carbondesignsystem.com/" target="_blank">
          Carbon Design System
        </Link>
      </footer>
    </>
  );
}
