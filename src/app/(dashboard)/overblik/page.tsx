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
  incomeExpenseHistory as staticIncomeExpenseHistory,
  monthlyOverviews as staticMonthlyOverviews,
} from "@/lib/mock-data";
import { IncomeExpenseChart } from "@/components/income-expense-chart";
import {
  clearClientCache,
  readClientCache,
  writeClientCache,
} from "@/lib/client-cache";
import type { BudgetInsight } from "@/lib/postings";

type AccountOverview = {
  name: string;
  balance: string;
  note?: string;
  meta?: string;
};

type MonthlyOverview = (typeof staticMonthlyOverviews)[number] & {
  statusSummary?: string;
  insights?: BudgetInsight[];
};

type OverviewData = {
  accounts: AccountOverview[];
  insights: BudgetInsight[];
  incomeExpenseHistory: typeof staticIncomeExpenseHistory;
  monthlyOverviews: MonthlyOverview[];
};

const budgetDataCacheKey = "budget-data";
const budgetDataCacheAgeMs = 60_000;

export default function OverviewPage() {
  const [overviewData, setOverviewData] = useState<OverviewData>({
    accounts: staticAccounts,
    insights: [],
    incomeExpenseHistory: staticIncomeExpenseHistory,
    monthlyOverviews: staticMonthlyOverviews as MonthlyOverview[],
  });
  const [selectedMonthId, setSelectedMonthId] = useState(
    staticMonthlyOverviews.at(-1)?.id ?? "",
  );
  const fetchBudgetData = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh) {
      const cachedData = readClientCache<OverviewData>(
        budgetDataCacheKey,
        budgetDataCacheAgeMs,
      );

      if (cachedData) {
        setOverviewData(cachedData);
      }
    }

    const response = await fetch("/api/budget-data", {
      cache: forceRefresh ? "no-store" : "default",
    });
    if (!response.ok) return;

    const data = await response.json();
    const nextOverviewData = {
      accounts: data.accounts ?? staticAccounts,
      insights: data.insights ?? [],
      incomeExpenseHistory: data.incomeExpenseHistory ?? staticIncomeExpenseHistory,
      monthlyOverviews: data.monthlyOverviews ?? staticMonthlyOverviews,
    };

    setOverviewData(nextOverviewData);
    writeClientCache(budgetDataCacheKey, nextOverviewData);
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
    const timeout = window.setTimeout(() => void fetchBudgetData(), 0);
    const handleSync = () => {
      clearClientCache();
      void fetchBudgetData(true);
    };

    window.addEventListener("familybalance:sync", handleSync);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("familybalance:sync", handleSync);
    };
  }, [fetchBudgetData]);

  const selectedOverview = useMemo(
    () =>
      overviewData.monthlyOverviews.find(
        (overview) => overview.id === selectedMonthId,
      ) ?? overviewData.monthlyOverviews.at(-1)!,
    [overviewData.monthlyOverviews, selectedMonthId],
  );
  const selectedInsights =
    selectedOverview.insights?.length
      ? selectedOverview.insights
      : overviewData.insights;

  return (
    <>
      <Grid className="budget-hero" narrow>
        <Column lg={12} md={8} sm={4}>
          <h1>Overblik over indkomst, udgifter og opsparing.</h1>
          <p className="ai-summary">
            <MagicWand size={20} />
            <span>{selectedOverview.monthlySummary}</span>
          </p>
          <div className="overview-page-controls">
            <label htmlFor="overview-month">Måned</label>
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
        </Column>
      </Grid>

      <Grid narrow className="budget-grid overview-layout">
        <Column lg={11} md={8} sm={4}>
          <div className="overview-main">
            {selectedInsights.length ? (
              <section
                aria-labelledby="insights-section-title"
                className="insights-section"
              >
                <div className="section-title-row">
                  <h2 id="insights-section-title">Indsigter</h2>
                </div>
                <div className="insights-grid">
                  {selectedInsights.map((insight) => (
                    <Tile
                      className={`insight-card insight-card--${insight.severity}`}
                      key={insight.id}
                    >
                      <div className="insight-card__header">
                        <span>{insight.metric}</span>
                        <strong>{insight.title}</strong>
                      </div>
                      <p>{insight.body}</p>
                      <Link href={insight.actionHref}>{insight.actionLabel}</Link>
                    </Tile>
                  ))}
                </div>
              </section>
            ) : null}

            <section
              aria-labelledby="overview-section-title"
              className="overview-section"
            >
              <div className="section-title-row">
                <h2 id="overview-section-title">Overblik</h2>
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
              <p className="overview-status-summary">
                <MagicWand size={18} />
                <span>
                  {selectedOverview.statusSummary ??
                    "Importer flere måneder for at få en tydeligere statusanalyse."}
                </span>
              </p>
            </section>

            <Tile className="panel">
              <IncomeExpenseChart history={overviewData.incomeExpenseHistory} />
            </Tile>
          </div>
        </Column>

        <Column lg={5} md={8} sm={4}>
          <Tile className="panel accounts-panel">
            <div className="panel__header">
              <div>
                <h2>Konti</h2>
              </div>
            </div>
            <StructuredListWrapper className="accounts-list" isCondensed>
              <StructuredListHead>
                <StructuredListRow head>
                  <StructuredListCell head>Konto</StructuredListCell>
                  <StructuredListCell head>Saldo</StructuredListCell>
                </StructuredListRow>
              </StructuredListHead>
              <StructuredListBody>
                {overviewData.accounts.map((account) => (
                  <StructuredListRow key={account.name}>
                    <StructuredListCell>
                      <div className="account-name">
                        <strong>{account.name}</strong>
                        {account.note ? <span>{account.note}</span> : null}
                        {account.meta ? <span>{account.meta}</span> : null}
                      </div>
                    </StructuredListCell>
                    <StructuredListCell>{account.balance}</StructuredListCell>
                  </StructuredListRow>
                ))}
              </StructuredListBody>
            </StructuredListWrapper>
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
