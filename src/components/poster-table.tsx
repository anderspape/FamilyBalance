"use client";

import { useEffect, useMemo, useState, type UIEvent } from "react";
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
import {
  clearClientCache,
  readClientCache,
  writeClientCache,
} from "@/lib/client-cache";
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
  category?: string;
};

type PosterSortKey =
  | "bookingDate"
  | "description"
  | "accountName"
  | "mainCategory"
  | "subcategory"
  | "postingTypeLabel"
  | "amountMinor";
type SortDirection = "asc" | "desc";

function displayMonth(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("da-DK", {
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

const categoryDefinitions = categoryGroups.flatMap((group) => group.categories);
const posterCacheAgeMs = 60_000;
const pageSize = 50;

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
  const [categoryFilter, setCategoryFilter] = useState(
    initialFilters.category ?? "all",
  );
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState("");
  const [sortKey, setSortKey] = useState<PosterSortKey>("bookingDate");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [visibleCount, setVisibleCount] = useState(pageSize);

  const searchParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set("accountId", accountId);
    params.set("period", period);
    if (month) params.set("month", month);
    if (year) params.set("year", year);
    if (query.trim()) params.set("q", query.trim());
    if (categoryFilter !== "all") params.set("category", categoryFilter);

    return params;
  }, [accountId, categoryFilter, month, period, query, year]);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function loadPostings(forceRefresh = false) {
      const cacheKey = `poster:${searchParams.toString()}`;
      const cachedData = !forceRefresh
        ? readClientCache<PosterResponse>(cacheKey, posterCacheAgeMs)
        : null;

      if (cachedData) {
        setTransactions(cachedData.transactions);
        setSummary(cachedData.summary);
        setOptions(cachedData.options);
        setCategoryDrafts(
          Object.fromEntries(
            cachedData.transactions.map((transaction) => [
              transaction.id,
              transaction.categorySlug,
            ]),
          ),
        );
      }

      const response = await fetch(`/api/poster?${searchParams.toString()}`, {
        cache: forceRefresh ? "no-store" : "default",
        signal: controller.signal,
      }).catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return null;
        }

        throw error;
      });
      if (!response?.ok || !isMounted) return;

      const data: PosterResponse = await response.json();
      setTransactions(data.transactions);
      setSummary(data.summary);
      setOptions(data.options);
      writeClientCache(cacheKey, data);
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

    const timeout = window.setTimeout(() => void loadPostings(), query ? 180 : 0);
    const handleSync = () => {
      clearClientCache("poster:");
      void loadPostings(true);
    };

    window.addEventListener("familybalance:sync", handleSync);

    return () => {
      isMounted = false;
      window.clearTimeout(timeout);
      controller.abort();
      window.removeEventListener("familybalance:sync", handleSync);
    };
  }, [query, searchParams]);

  function toggleSort(nextSortKey: PosterSortKey) {
    setVisibleCount(pageSize);
    if (sortKey === nextSortKey) {
      setSortDirection((currentDirection) =>
        currentDirection === "asc" ? "desc" : "asc",
      );
      return;
    }

    setSortKey(nextSortKey);
    setSortDirection(nextSortKey === "amountMinor" ? "desc" : "asc");
  }

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    const distanceToBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight;

    if (distanceToBottom < 160) {
      setVisibleCount((currentCount) => currentCount + pageSize);
    }
  }

  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1;

      if (sortKey === "amountMinor") {
        return (a.amountMinor - b.amountMinor) * direction;
      }

      return String(a[sortKey]).localeCompare(String(b[sortKey]), "da-DK") * direction;
    });
  }, [sortDirection, sortKey, transactions]);

  const visibleTransactions = useMemo(
    () => sortedTransactions.slice(0, visibleCount),
    [sortedTransactions, visibleCount],
  );
  const hasMoreTransactions = visibleTransactions.length < sortedTransactions.length;

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

      clearClientCache();
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
              onChange={(event) => {
                setVisibleCount(pageSize);
                setAccountId(event.target.value);
              }}
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
              onChange={(event) => {
                setVisibleCount(pageSize);
                setPeriod(event.target.value);
              }}
              size="sm"
              value={period}
            >
              <SelectItem text="Hele perioden" value="all" />
              <SelectItem text="Denne måned" value="current-month" />
              <SelectItem text="Sidste 3 mdr." value="last-3-months" />
              <SelectItem text="Sidste 12 mdr." value="last-12-months" />
              <SelectItem text="Valgt måned" value="month" />
              <SelectItem text="År" value="year" />
            </Select>
            <Select
              id="poster-category-filter"
              labelText="Kategori"
              onChange={(event) => {
                setVisibleCount(pageSize);
                setCategoryFilter(event.target.value);
              }}
              size="sm"
              value={categoryFilter}
            >
              <SelectItem text="Alle kategorier" value="all" />
              {categoryGroups.map((group) => (
                <SelectItem
                  key={group.name}
                  text={group.name}
                  value={group.name}
                />
              ))}
              {categoryGroups.flatMap((group) =>
                group.categories.map((category) => (
                  <SelectItem
                    key={category.slug}
                    text={`${group.name} / ${category.name}`}
                    value={category.slug}
                  />
                )),
              )}
            </Select>
            {period === "month" ? (
              <Select
                id="poster-month"
                labelText="Måned"
                onChange={(event) => {
                  setVisibleCount(pageSize);
                  setMonth(event.target.value);
                }}
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
                onChange={(event) => {
                  setVisibleCount(pageSize);
                  setYear(event.target.value);
                }}
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
              onChange={(event) => {
                setVisibleCount(pageSize);
                setQuery(event.target.value);
              }}
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

          <div
            className="table-scroll poster-table-scroll"
            onScroll={handleScroll}
            tabIndex={0}
          >
            <Table aria-label="Poster">
              <TableHead>
                <TableRow>
                  {[
                    ["bookingDate", "Dato"],
                    ["description", "Beskrivelse"],
                    ["accountName", "Konto"],
                    ["mainCategory", "Hovedkategori"],
                    ["subcategory", "Underkategori"],
                    ["postingTypeLabel", "Type"],
                    ["amountMinor", "Beløb"],
                  ].map(([key, label]) => {
                    const headerKey = key as PosterSortKey;

                    return (
                      <TableHeader key={key}>
                        <button
                          className="sortable-header"
                          onClick={() => toggleSort(headerKey)}
                          type="button"
                        >
                          <span>{label}</span>
                          {sortKey === headerKey ? (
                            <span aria-hidden="true">
                              {sortDirection === "asc" ? "↑" : "↓"}
                            </span>
                          ) : null}
                        </button>
                      </TableHeader>
                    );
                  })}
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleTransactions.map((transaction) => (
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
                                    ? `${category.name} [${
                                        category.badge === "Regn"
                                          ? "Regning"
                                          : "Indkomst"
                                      }]`
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
            {hasMoreTransactions ? (
              <button
                className="table-load-more"
                onClick={() =>
                  setVisibleCount((currentCount) => currentCount + pageSize)
                }
                type="button"
              >
                Vis flere poster
              </button>
            ) : null}
          </div>
        </Tile>
      </Column>
    </Grid>
  );
}
