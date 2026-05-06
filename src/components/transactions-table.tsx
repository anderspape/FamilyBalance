"use client";

import { useEffect, useMemo, useState, type UIEvent } from "react";
import {
  DataTable,
  Search,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@carbon/react";
import {
  clearClientCache,
  readClientCache,
  writeClientCache,
} from "@/lib/client-cache";
import { formatDate, formatMinorKr } from "@/lib/money";
import { transactions } from "@/lib/mock-data";

type Flow = "income" | "expenses" | "savings";

type PosterRow = {
  id: string;
  accountName: string;
  bookingDate: string;
  description: string;
  mainCategory: string;
  subcategory: string;
  postingTypeLabel: string;
  amountMinor: number;
};

type TransactionSortKey =
  | "date"
  | "text"
  | "account"
  | "mainCategory"
  | "subcategory"
  | "type"
  | "amount";
type SortDirection = "asc" | "desc";

const transactionHeaders = [
  { key: "date", header: "Dato" },
  { key: "text", header: "Tekst" },
  { key: "account", header: "Konto" },
  { key: "mainCategory", header: "Hovedkategori" },
  { key: "subcategory", header: "Underkategori" },
  { key: "type", header: "Type" },
  { key: "amount", header: "Beløb" },
];

const posterCacheAgeMs = 60_000;
const pageSize = 50;

export function TransactionsTable({
  title = "Seneste poster",
  kicker = "Poster",
  flow,
  month,
}: {
  title?: string;
  kicker?: string;
  flow?: Flow;
  month?: string;
}) {
  const [posterRows, setPosterRows] = useState<PosterRow[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sortKey, setSortKey] = useState<TransactionSortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [visibleCount, setVisibleCount] = useState(pageSize);

  useEffect(() => {
    if (!flow || !month) {
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({
      flow,
      period: "month",
      month,
    });
    const cacheKey = `poster:${params.toString()}`;

    const loadRows = async (forceRefresh = false) => {
      if (!forceRefresh) {
        const cachedRows = readClientCache<PosterRow[]>(cacheKey, posterCacheAgeMs);
        if (cachedRows) {
          setPosterRows(cachedRows);
        }
      }

      setIsLoading(!readClientCache<PosterRow[]>(cacheKey, posterCacheAgeMs));

      try {
        const response = await fetch(`/api/poster?${params.toString()}`, {
          cache: forceRefresh ? "no-store" : "default",
          signal: controller.signal,
        });
        const data = response.ok ? await response.json() : null;

        if (data?.transactions) {
          setPosterRows(data.transactions);
          writeClientCache(cacheKey, data.transactions);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      } finally {
        setIsLoading(false);
      }
    };

    const timeout = window.setTimeout(() => {
      void loadRows();
    }, 0);
    const handleSync = () => {
      clearClientCache("poster:");
      void loadRows(true);
    };

    window.addEventListener("familybalance:sync", handleSync);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
      window.removeEventListener("familybalance:sync", handleSync);
    };
  }, [flow, month]);

  function toggleSort(nextSortKey: TransactionSortKey) {
    setVisibleCount(pageSize);
    if (sortKey === nextSortKey) {
      setSortDirection((currentDirection) =>
        currentDirection === "asc" ? "desc" : "asc",
      );
      return;
    }

    setSortKey(nextSortKey);
    setSortDirection(nextSortKey === "amount" ? "desc" : "asc");
  }

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    const distanceToBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight;

    if (distanceToBottom < 160) {
      setVisibleCount((currentCount) => currentCount + pageSize);
    }
  }

  const filteredRows = useMemo(() => {
    if (!flow || !month) {
      return transactions.map((transaction) => ({
        id: transaction.id,
        date: transaction.date,
        bookingDate: transaction.date,
        text: transaction.merchant,
        account: transaction.account,
        mainCategory: transaction.category,
        subcategory: transaction.category,
        type: "Forbrug",
        amount: transaction.amount,
        amountMinor: 0,
      }));
    }

    const lowerQuery = query.trim().toLowerCase();

    return posterRows
      .filter((posting) => {
        if (!lowerQuery) return true;

        return [
          posting.bookingDate,
          posting.description,
          posting.accountName,
          posting.mainCategory,
          posting.subcategory,
          posting.postingTypeLabel,
          formatMinorKr(posting.amountMinor),
        ]
          .join(" ")
          .toLowerCase()
          .includes(lowerQuery);
      })
      .map((posting) => ({
        id: posting.id,
        date: formatDate(posting.bookingDate),
        bookingDate: posting.bookingDate,
        text: posting.description,
        account: posting.accountName,
        mainCategory: posting.mainCategory,
        subcategory: posting.subcategory,
        type: posting.postingTypeLabel,
        amount: formatMinorKr(posting.amountMinor),
        amountMinor: posting.amountMinor,
      }));
  }, [flow, month, posterRows, query]);

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const direction = sortDirection === "asc" ? 1 : -1;

      if (sortKey === "amount") {
        return (a.amountMinor - b.amountMinor) * direction;
      }

      if (sortKey === "date") {
        return a.bookingDate.localeCompare(b.bookingDate) * direction;
      }

      return String(a[sortKey]).localeCompare(String(b[sortKey]), "da-DK") * direction;
    });
  }, [filteredRows, sortDirection, sortKey]);

  const rows = useMemo(
    () => sortedRows.slice(0, visibleCount),
    [sortedRows, visibleCount],
  );
  const hasMoreRows = rows.length < sortedRows.length;

  return (
    <DataTable rows={rows} headers={transactionHeaders}>
      {({ rows, headers, getHeaderProps, getRowProps, getTableProps }) => (
        <div className="table-panel">
          <div className="panel__header table-panel__header">
            <div>
              <p className="budget-kicker">{kicker}</p>
              <h2>
                {title}
                <span className="table-panel__count">
                  {sortedRows.length} poster
                </span>
              </h2>
            </div>
            <div className="table-panel__tools">
              <Search
                id={`${kicker}-transaction-search`}
                labelText="Søg i poster"
                onChange={(event) => {
                  setVisibleCount(pageSize);
                  setQuery(event.target.value);
                }}
                placeholder="Søg modpart eller tekst"
                size="sm"
                value={query}
              />
            </div>
          </div>
          <div className="table-scroll" onScroll={handleScroll} tabIndex={0}>
            <Table {...getTableProps()}>
              <TableHead>
                <TableRow>
                  {headers.map((header) => {
                    const { key, ...headerProps } = getHeaderProps({ header });
                    const headerKey = header.key as TransactionSortKey;

                    return (
                      <TableHeader key={key} {...headerProps}>
                        <button
                          className="sortable-header"
                          onClick={() => toggleSort(headerKey)}
                          type="button"
                        >
                          <span>{header.header}</span>
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
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={headers.length}>Henter poster...</TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={headers.length}>
                      Ingen poster i den valgte måned.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => {
                    const { key, ...rowProps } = getRowProps({ row });

                    return (
                      <TableRow key={key} {...rowProps}>
                        {row.cells.map((cell) => (
                          <TableCell key={cell.id}>{cell.value}</TableCell>
                        ))}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            {hasMoreRows ? (
              <button
                className="table-load-more"
                onClick={() => setVisibleCount((currentCount) => currentCount + pageSize)}
                type="button"
              >
                Vis flere poster
              </button>
            ) : null}
          </div>
        </div>
      )}
    </DataTable>
  );
}
