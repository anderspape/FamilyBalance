"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Column, Grid, InlineNotification, TextInput, Tile } from "@carbon/react";
import { Add, Wallet } from "@carbon/icons-react";
import { CsvImportPanel } from "@/components/csv-import-panel";
import type { ImportAccount } from "@/lib/import-accounts";
import { formatDate, formatMinorKr } from "@/lib/money";

export function CsvImportWorkspace() {
  const [accounts, setAccounts] = useState<ImportAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [name, setName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadAccounts() {
      const response = await fetch("/api/import/accounts", { cache: "no-store" });
      if (!response.ok || !isMounted) return;

      const data = await response.json();
      const nextAccounts = data.accounts ?? [];

      setAccounts(nextAccounts);
      setSelectedAccountId((currentId) =>
        nextAccounts.some((account: ImportAccount) => account.id === currentId)
          ? currentId
          : nextAccounts[0]?.id ?? "",
      );
    }

    void loadAccounts();

    return () => {
      isMounted = false;
    };
  }, []);

  async function createAccount(input: {
    name: string;
    accountNumber?: string;
    description?: string;
  }) {
    setIsCreating(true);
    setError("");

    try {
      const response = await fetch("/api/import/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Kontoen kunne ikke oprettes.");
      }

      setAccounts((currentAccounts) => [...currentAccounts, data.account]);
      setSelectedAccountId(data.account.id);
      setName("");
      setAccountNumber("");
      setDescription("");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Kontoen kunne ikke oprettes.",
      );
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <Grid narrow className="budget-grid import-layout">
      <Column lg={5} md={8} sm={4}>
        <Tile className="panel import-accounts-panel">
          <div className="panel__header">
            <div>
              <h2>Opret konto</h2>
              <p className="panel__description">
                Tilføj kun en konto, hvis den ikke allerede findes i listen.
              </p>
            </div>
          </div>

          <form
            className="import-account-form"
            onSubmit={(event) => {
              event.preventDefault();
              void createAccount({
                name,
                accountNumber,
                description,
              });
            }}
          >
            <TextInput
              id="import-account-name"
              labelText="Kontonavn"
              onChange={(event) => setName(event.target.value)}
              placeholder="Fx Budgetkonto"
              value={name}
            />
            <TextInput
              id="import-account-number"
              labelText="Kontonummer"
              onChange={(event) => setAccountNumber(event.target.value)}
              placeholder="Valgfrit"
              value={accountNumber}
            />
            <TextInput
              id="import-account-description"
              labelText="Beskrivelse"
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Valgfrit"
              value={description}
            />
            <Button disabled={!name.trim() || isCreating} renderIcon={Add} type="submit">
              {isCreating ? "Opretter..." : "Opret konto"}
            </Button>
          </form>

          {error ? (
            <InlineNotification
              hideCloseButton
              kind="error"
              lowContrast
              subtitle={error}
              title="Konto fejlede"
            />
          ) : null}
        </Tile>
      </Column>

      <Column lg={11} md={8} sm={4}>
        <div className="import-workspace">
          <Tile className="panel import-account-list">
            <div className="panel__header">
              <div>
                <h2>Oprettede konti</h2>
                <p className="panel__description">
                  Vælg den konto, filen hører til. Valget styrer også saldo og
                  filtrering på Poster-siden.
                </p>
              </div>
            </div>
            <div className="import-account-options">
              {accounts.length ? (
                accounts.map((account) => (
                  <button
                    className={`import-account-option${
                      account.id === selectedAccountId
                        ? " import-account-option--selected"
                        : ""
                    }`}
                    key={account.id}
                    onClick={() => setSelectedAccountId(account.id)}
                    type="button"
                  >
                    <Wallet size={20} />
                    <span>
                      <strong>{account.name}</strong>
                      <small>
                        {account.accountNumber ??
                          account.description ??
                          "CSV-import konto"}
                      </small>
                      <small>
                        Saldo{" "}
                        {account.balanceMinor !== null
                          ? formatMinorKr(account.balanceMinor)
                          : "ikke angivet"}
                        {account.lastPostingDate
                          ? ` · seneste post ${formatDate(account.lastPostingDate)}`
                          : ""}
                      </small>
                    </span>
                    {account.id === selectedAccountId ? (
                      <span className="import-account-option__status">Valgt</span>
                    ) : null}
                  </button>
                ))
              ) : (
                <p className="import-empty-state">
                  Ingen konti endnu. Opret for eksempel Budgetkonto eller
                  Husholdning til venstre.
                </p>
              )}
            </div>
          </Tile>

          {selectedAccount ? (
            <CsvImportPanel
              accountId={selectedAccount.id}
              accountName={selectedAccount.name}
              accountNumber={selectedAccount.accountNumber}
              compact
            />
          ) : null}
        </div>
      </Column>
    </Grid>
  );
}
