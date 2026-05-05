"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Column,
  Grid,
  Search,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tile,
} from "@carbon/react";
import { Save } from "@carbon/icons-react";
import { categoryGroups, getPostingTypeLabel } from "@/lib/categories";
import type { ImportAccount } from "@/lib/import-accounts";
import { formatDate, formatMinorKr } from "@/lib/money";

type PosterTransaction = {
  id: string;
  importAccountId: string | null;
  accountName: string;
  accountNumber: string;
  bookingDate: string;
  description: string;
  amountMinor: number;
  currency: "DKK";
  category: string;
  categorySlug: string;
  mainCategory: string;
  subcategory: string;
  postingType: string;
  postingTypeLabel: string;
};

type PosterResponse = {
  transactions: PosterTransaction[];
  summary: {
    count: number;
    totalMinor: number;
    averageMinor: number;
    uncategorizedCount: number;
  };
  options: {
    months: string[];
    years: string[];
  };
};

type PosterInitialFilters = {
  accountId?: string;
  period?: string;
  month?: string;
  year?: string;
  query?: string;
};

function displayMonth(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("da-DK", {
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

const categoryDefinitions = categoryGroups.flatMap((group) => group.categories);

export function PosterTable({
  accounts,
  initialFilters = {},
}: {
  accounts: ImportAccount[];
  initialFilters?: PosterInitialFilters;
}) {
  const [transactions, setTransactions] = useState<PosterTransaction[]>([]);
  const [summary, setSummary] = useState<PosterResponse["summary"]>({
    count: 0,
    totalMinor: 0,
    averageMinor: 0,
    uncategorizedCount: 0,
  });
  const [options, setOptions] = useState<PosterResponse["options"]>({
    months: [],
    years: [],
  });
  const [accountId, setAccountId] = useState(initialFilters.accountId ?? "all");
  const [period, setPeriod] = useState(initialFilters.period ?? "all");
  const [month, setMonth] = useState(initialFilters.month ?? "");
  const [year, setYear] = useState(initialFilters.year ?? "");
  const [query, setQuery] = useState(initialFilters.query ?? "");
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState("");

  const searchParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("accountId", accountId);
    params.set("period", period);
    if (month) params.set("month", month);
    if (year) params.set("year", year);
    if (query.trim()) params.set("q", query.trim());

    return params;
  }, [accountId, month, period, query, year]);

  useEffect(() => {
    let isMounted = true;

    async function loadPostings() {
      const response = await fetch(`/api/poster?${searchParams.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok || !isMounted) return;

      const data: PosterResponse = await response.json();
      setTransactions(data.transactions);
      setSummary(data.summary);
      setOptions(data.options);
      setCategoryDrafts(
        Object.fromEntries(
          data.transactions.map((transaction) => [
            transaction.id,
            transaction.categorySlug,
          ]),
        ),
      );
      setMonth((currentMonth) => currentMonth || data.options.months[0] || "");
      setYear((currentYear) => currentYear || data.options.years[0] || "");
    }

    void loadPostings();

    return () => {
      isMounted = false;
    };
  }, [searchParams]);

  async function saveCategory(transaction: PosterTransaction) {
    const nextCategory = categoryDrafts[transaction.id]?.trim();

    if (!nextCategory || nextCategory === transaction.categorySlug) return;

    setSavingId(transaction.id);

    try {
      const response = await fetch("/api/poster", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: transaction.id,
          category: nextCategory,
        }),
      });

      if (!response.ok) {
        throw new Error("Kategorien kunne ikke gemmes.");
      }

      setTransactions((currentTransactions) =>
        currentTransactions.map((currentTransaction) =>
          currentTransaction.id === transaction.id
            ? (() => {
                const selectedCategory = categoryDefinitions.find(
                  (category) => category.slug === nextCategory,
                );

                return {
                  ...currentTransaction,
                  category: selectedCategory?.name ?? currentTransaction.category,
                  categorySlug: nextCategory,
                  mainCategory:
                    selectedCategory?.mainCategory ?? currentTransaction.mainCategory,
                  subcategory: selectedCategory?.name ?? currentTransaction.subcategory,
                  postingType:
                    selectedCategory?.postingType ?? currentTransaction.postingType,
                  postingTypeLabel:
                    selectedCategory
                      ? getPostingTypeLabel(selectedCategory.postingType)
                      : currentTransaction.postingTypeLabel,
                };
              })()
            : currentTransaction,
        ),
      );
      window.dispatchEvent(new Event("familybalance:sync"));
    } finally {
      setSavingId("");
    }
  }

  return (
    <Grid narrow className="budget-grid">
      <Column lg={16} md={8} sm={4}>
        <Tile className="panel poster-panel">
          <div className="poster-toolbar">
            <Select
              id="poster-account"
              labelText="Konto"
              onChange={(event) => setAccountId(event.target.value)}
              size="sm"
              value={accountId}
            >
              <SelectItem text="Alle konti" value="all" />
              {accounts.map((account) => (
                <SelectItem key={account.id} text={account.name} value={account.id} />
              ))}
            </Select>
            <Select
              id="poster-period"
              labelText="Periode"
              onChange={(event) => setPeriod(event.target.value)}
              size="sm"
              value={period}
            >
              <SelectItem text="Hele perioden" value="all" />
              <SelectItem text="Denne måned" value="current-month" />
              <SelectItem text="Valgt måned" value="month" />
              <SelectItem text="År" value="year" />
            </Select>
            {period === "month" ? (
              <Select
                id="poster-month"
                labelText="Måned"
                onChange={(event) => setMonth(event.target.value)}
                size="sm"
                value={month}
              >
                {options.months.map((option) => (
                  <SelectItem
                    key={option}
                    text={displayMonth(option)}
                    value={option}
                  />
                ))}
              </Select>
            ) : null}
            {period === "year" ? (
              <Select
                id="poster-year"
                labelText="År"
                onChange={(event) => setYear(event.target.value)}
                size="sm"
                value={year}
              >
                {options.years.map((option) => (
                  <SelectItem key={option} text={option} value={option} />
                ))}
              </Select>
            ) : null}
            <Search
              id="poster-search"
              labelText="Søg"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Søg i poster"
              size="sm"
              value={query}
            />
          </div>

          <div className="poster-summary">
            <div>
              <span>Antal poster</span>
              <strong>{summary.count}</strong>
            </div>
            <div>
              <span>Ikke kategoriserede</span>
              <strong>{summary.uncategorizedCount}</strong>
            </div>
            <div>
              <span>Samlet beløb</span>
              <strong>{formatMinorKr(summary.totalMinor, 0)}</strong>
            </div>
            <div>
              <span>Gennemsnit</span>
              <strong>{formatMinorKr(summary.averageMinor, 0)}</strong>
            </div>
          </div>

          <div className="table-scroll poster-table-scroll" tabIndex={0}>
            <Table aria-label="Poster">
              <TableHead>
                <TableRow>
                  <TableHeader>Dato</TableHeader>
                  <TableHeader>Beskrivelse</TableHeader>
                  <TableHeader>Konto</TableHeader>
                  <TableHeader>Hovedkategori</TableHeader>
                  <TableHeader>Underkategori</TableHeader>
                  <TableHeader>Type</TableHeader>
                  <TableHeader>Beløb</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>{formatDate(transaction.bookingDate)}</TableCell>
                    <TableCell>{transaction.description}</TableCell>
                    <TableCell>{transaction.accountName}</TableCell>
                    <TableCell>{transaction.mainCategory}</TableCell>
                    <TableCell>
                      <div className="poster-category-editor">
                        <select
                          className="poster-category-select"
                          id={`poster-category-${transaction.id}`}
                          onChange={(event) =>
                            setCategoryDrafts((currentDrafts) => ({
                              ...currentDrafts,
                              [transaction.id]: event.target.value,
                            }))
                          }
                          value={
                            categoryDrafts[transaction.id] ?? transaction.categorySlug
                          }
                        >
                          {categoryGroups.map((group) => (
                            <optgroup key={group.slug} label={group.name}>
                              {group.categories.map((category) => (
                                <option key={category.slug} value={category.slug}>
                                  {category.badge
                                    ? `${category.name} [${category.badge}]`
                                    : category.name}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        <Button
                          hasIconOnly
                          iconDescription="Gem kategori"
                          kind="ghost"
                          onClick={() => saveCategory(transaction)}
                          renderIcon={Save}
                          size="sm"
                          tooltipPosition="left"
                          disabled={savingId === transaction.id}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`posting-type-badge posting-type-badge--${transaction.postingType}`}
                      >
                        {transaction.postingTypeLabel}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`poster-amount${
                          transaction.amountMinor >= 0
                            ? " poster-amount--positive"
                            : " poster-amount--negative"
                        }`}
                      >
                        {formatMinorKr(transaction.amountMinor)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Tile>
      </Column>
    </Grid>
  );
}
