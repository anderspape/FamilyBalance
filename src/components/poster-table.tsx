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
  TextInput,
  Tile,
} from "@carbon/react";
import { Save } from "@carbon/icons-react";
import { categories } from "@/lib/categories";
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
  kind: string;
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

const categoryNames = categories.map((category) => category.name);

function displayMonth(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("da-DK", {
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function PosterTable({ accounts }: { accounts: ImportAccount[] }) {
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
  const [accountId, setAccountId] = useState("all");
  const [period, setPeriod] = useState("all");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [query, setQuery] = useState("");
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
            transaction.category,
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

    if (!nextCategory || nextCategory === transaction.category) return;

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
            ? { ...currentTransaction, category: nextCategory }
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

          <datalist id="poster-category-options">
            {categoryNames.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>

          <div className="table-scroll poster-table-scroll" tabIndex={0}>
            <Table aria-label="Poster">
              <TableHead>
                <TableRow>
                  <TableHeader>Dato</TableHeader>
                  <TableHeader>Beskrivelse</TableHeader>
                  <TableHeader>Konto</TableHeader>
                  <TableHeader>Kategori</TableHeader>
                  <TableHeader>Beløb</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>{formatDate(transaction.bookingDate)}</TableCell>
                    <TableCell>{transaction.description}</TableCell>
                    <TableCell>{transaction.accountName}</TableCell>
                    <TableCell>
                      <div className="poster-category-editor">
                        <TextInput
                          id={`poster-category-${transaction.id}`}
                          labelText="Kategori"
                          list="poster-category-options"
                          hideLabel
                          onChange={(event) =>
                            setCategoryDrafts((currentDrafts) => ({
                              ...currentDrafts,
                              [transaction.id]: event.target.value,
                            }))
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              void saveCategory(transaction);
                            }
                          }}
                          size="sm"
                          value={categoryDrafts[transaction.id] ?? transaction.category}
                        />
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
