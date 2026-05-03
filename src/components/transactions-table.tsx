"use client";

import {
  DataTable,
  Search,
  Select,
  SelectItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@carbon/react";
import { categories } from "@/lib/categories";
import { transactionHeaders, transactions } from "@/lib/mock-data";

export function TransactionsTable({
  title = "Seneste poster",
  kicker = "Poster",
}: {
  title?: string;
  kicker?: string;
}) {
  return (
    <DataTable rows={transactions} headers={transactionHeaders}>
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
                placeholder="Søg modpart eller tekst"
                size="sm"
              />
              <Select
                id={`${kicker}-category-filter`}
                labelText="Kategori"
                size="sm"
                defaultValue="all"
              >
                <SelectItem value="all" text="Alle kategorier" />
                {categories.map((category) => (
                  <SelectItem
                    key={category.slug}
                    value={category.slug}
                    text={category.name}
                  />
                ))}
              </Select>
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
                {rows.map((row) => {
                  const { key, ...rowProps } = getRowProps({ row });

                  return (
                    <TableRow key={key} {...rowProps}>
                      {row.cells.map((cell) => (
                        <TableCell key={cell.id}>{cell.value}</TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </DataTable>
  );
}
