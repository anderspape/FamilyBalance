"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Column, Grid, InlineNotification, TextInput, Tile } from "@carbon/react";
import { Add, Wallet } from "@carbon/icons-react";
import { CsvImportPanel } from "@/components/csv-import-panel";
import { clearClientCache } from "@/lib/client-cache";
import type { ImportAccount } from "@/lib/import-accounts";
import { formatDate, formatMinorKr } from "@/lib/money";

export function CsvImportWorkspace() {
  const [accounts, setAccounts] = useState<ImportAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [name, setName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [description, setDescription] = useState("");
  const [showClosed, setShowClosed] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [updatingAccountId, setUpdatingAccountId] = useState("");
  const [error, setError] = useState("");

  const visibleAccounts = useMemo(
    () => accounts.filter((account) => (showClosed ? account.closedAt : !account.closedAt)),
    [accounts, showClosed],
  );
  const selectedAccount = useMemo(
    () => visibleAccounts.find((account) => account.id === selectedAccountId) ?? null,
    [selectedAccountId, visibleAccounts],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadAccounts() {
      const response = await fetch("/api/import/accounts", { cache: "default" });
      if (!response.ok || !isMounted) return;

      const data = await response.json();
      const nextAccounts = data.accounts ?? [];

      setAccounts(nextAccounts);
      setSelectedAccountId((currentId) =>
        nextAccounts.some(
          (account: ImportAccount) => !account.closedAt && account.id === currentId,
        )
          ? currentId
          : nextAccounts.find((account: ImportAccount) => !account.closedAt)?.id ?? "",
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
      clearClientCache();
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

  async function setAccountClosed(account: ImportAccount, closed: boolean) {
    setUpdatingAccountId(account.id);
    setError("");

    try {
      const response = await fetch("/api/import/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: account.id, closed }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Kontoen kunne ikke opdateres.");
      }

      const nextAccounts = data.accounts ?? [];
      setAccounts(nextAccounts);
      clearClientCache();
      setSelectedAccountId((currentId) => {
        if (
          nextAccounts.some(
            (nextAccount: ImportAccount) =>
              !nextAccount.closedAt && nextAccount.id === currentId,
          )
        ) {
          return currentId;
        }

        return (
          nextAccounts.find((nextAccount: ImportAccount) => !nextAccount.closedAt)?.id ??
          ""
        );
      });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Kontoen kunne ikke opdateres.",
      );
    } finally {
      setUpdatingAccountId("");
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
              <div className="import-account-view-toggle">
                <Button
                  kind={showClosed ? "ghost" : "tertiary"}
                  onClick={() => setShowClosed(false)}
                  size="sm"
                >
                  Vis åbne
                </Button>
                <Button
                  kind={showClosed ? "tertiary" : "ghost"}
                  onClick={() => setShowClosed(true)}
                  size="sm"
                >
                  Vis lukkede
                </Button>
              </div>
            </div>
            <div className="import-account-options">
              {visibleAccounts.length ? (
                visibleAccounts.map((account) => (
                  <div
                    className={`import-account-option${
                      account.id === selectedAccountId
                        ? " import-account-option--selected"
                        : ""
                    }`}
                    key={account.id}
                    onClick={() => setSelectedAccountId(account.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedAccountId(account.id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
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
                    <span className="import-account-option__actions">
                      {account.closedAt ? (
                        <Button
                          disabled={updatingAccountId === account.id}
                          kind="ghost"
                          onClick={(event) => {
                            event.stopPropagation();
                            void setAccountClosed(account, false);
                          }}
                          size="sm"
                          type="button"
                        >
                          Genåbn
                        </Button>
                      ) : (
                        <>
                          <Button
                            kind="ghost"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedAccountId(account.id);
                            }}
                            size="sm"
                            type="button"
                          >
                            Importer CSV
                          </Button>
                          <Button
                            disabled={updatingAccountId === account.id}
                            kind="ghost"
                            onClick={(event) => {
                              event.stopPropagation();
                              void setAccountClosed(account, true);
                            }}
                            size="sm"
                            type="button"
                          >
                            Luk konto
                          </Button>
                        </>
                      )}
                      {account.id === selectedAccountId ? (
                        <span className="import-account-option__status">Valgt</span>
                      ) : null}
                    </span>
                  </div>
                ))
              ) : (
                <p className="import-empty-state">
                  {showClosed
                    ? "Ingen lukkede konti."
                    : "Ingen konti endnu. Opret for eksempel Budgetkonto eller Husholdning til venstre."}
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
