"use client";

import { useEffect, useMemo, useState } from "react";
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

  const rows = useMemo(() => {
    if (!flow || !month) {
      return transactions.map((transaction) => ({
        id: transaction.id,
        date: transaction.date,
        text: transaction.merchant,
        account: transaction.account,
        mainCategory: transaction.category,
        subcategory: transaction.category,
        type: "Forbrug",
        amount: transaction.amount,
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
      .slice(0, 50)
      .map((posting) => ({
        id: posting.id,
        date: formatDate(posting.bookingDate),
        text: posting.description,
        account: posting.accountName,
        mainCategory: posting.mainCategory,
        subcategory: posting.subcategory,
        type: posting.postingTypeLabel,
        amount: formatMinorKr(posting.amountMinor),
      }));
  }, [flow, month, posterRows, query]);

  return (
    <DataTable rows={rows} headers={transactionHeaders}>
      {({ rows, headers, getHeaderProps, getRowProps, getTableProps }) => (
        <div className="table-panel">
          <div className="panel__header table-panel__header">
            <div>
              <p className="budget-kicker">{kicker}</p>
              <h2>{title}</h2>
            </div>
            <div className="table-panel__tools">
              <Search
                id={`${kicker}-transaction-search`}
                labelText="Søg i poster"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Søg modpart eller tekst"
                size="sm"
                value={query}
              />
            </div>
          </div>
          <div className="table-scroll" tabIndex={0}>
            <Table {...getTableProps()}>
              <TableHead>
                <TableRow>
                  {headers.map((header) => {
                    const { key, ...headerProps } = getHeaderProps({ header });

                    return (
                      <TableHeader key={key} {...headerProps}>
                        {header.header}
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
          </div>
        </div>
      )}
    </DataTable>
  );
}
