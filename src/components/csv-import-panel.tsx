"use client";

import { useRef, useState, type DragEvent } from "react";
import { Button, InlineNotification, TextInput, Tile } from "@carbon/react";
import { DocumentImport } from "@carbon/icons-react";

type ImportStatus = {
  kind: "success" | "error" | "info";
  title: string;
  subtitle: string;
};

async function readImportResponse(response: Response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { error: text };
  }
}

export function CsvImportPanel({
  accountId,
  accountName,
  accountNumber,
  compact = false,
}: {
  accountId?: string;
  accountName?: string;
  accountNumber?: string | null;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [balance, setBalance] = useState("");
  const [status, setStatus] = useState<ImportStatus | null>(null);

  async function uploadFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setStatus({
        kind: "error",
        title: "Forkert filtype",
        subtitle: "Vælg en CSV-fil i samme format som Posteringsdetaljer.csv.",
      });
      return;
    }

    setIsUploading(true);
    setStatus({
      kind: "info",
      title: "Importerer",
      subtitle: file.name,
    });

    const formData = new FormData();
    formData.append("file", file);
    if (accountId) {
      formData.append("account_id", accountId);
    }
    if (accountName) {
      formData.append("account_name", accountName);
    }
    if (accountNumber) {
      formData.append("account_number", accountNumber);
    }
    if (balance.trim()) {
      formData.append("balance", balance);
    }

    try {
      const response = await fetch("/api/import/csv", {
        method: "POST",
        body: formData,
      });
      const result = await readImportResponse(response);

      if (!response.ok) {
        throw new Error(
          typeof result.error === "string"
            ? result.error
            : "CSV-importen fejlede.",
        );
      }

      const inserted = typeof result.inserted === "number" ? result.inserted : 0;
      const duplicates =
        typeof result.duplicates === "number" ? result.duplicates : 0;
      const warning =
        typeof result.warning === "string" && result.warning.trim()
          ? ` ${result.warning}`
          : "";

      setStatus({
        kind: "success",
        title: "CSV importeret",
        subtitle: `${inserted} nye posteringer importeret, ${duplicates} dubletter sprunget over.${balance.trim() && !warning ? " Saldo er opdateret." : ""}${warning}`,
      });
      window.dispatchEvent(new Event("familybalance:sync"));
    } catch (error) {
      setStatus({
        kind: "error",
        title: "Import fejlede",
        subtitle:
          error instanceof Error
            ? error.message
            : "Tjek filen og prøv igen.",
      });
    } finally {
      setIsUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files.item(0);

    if (file) {
      void uploadFile(file);
    }
  }

  return (
    <Tile
      className={`csv-import-panel${compact ? " csv-import-panel--compact" : ""}${
        isDragging ? " csv-import-panel--dragging" : ""
      }`}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <div className="csv-import-panel__content">
        <DocumentImport size={24} />
        <div>
          <p className="budget-kicker">Importer data</p>
          <h2>{accountName ? `Drop CSV til ${accountName}` : "Drop din bank-CSV her"}</h2>
          <p>
            Brug samme format som Posteringsdetaljer.csv. Importen gemmer kun nye
            posteringer.
          </p>
        </div>
      </div>
      <div className="csv-import-panel__actions">
        <TextInput
          id={`csv-import-balance-${accountId ?? "default"}`}
          labelText="Saldo efter denne CSV"
          onChange={(event) => setBalance(event.target.value)}
          placeholder="Fx 64.844,61"
          size="sm"
          value={balance}
        />
        <input
          accept=".csv,text/csv"
          aria-label="Vælg CSV-fil"
          hidden
          onChange={(event) => {
            const file = event.target.files?.item(0);

            if (file) {
              void uploadFile(file);
            }
          }}
          ref={inputRef}
          type="file"
        />
        <Button
          disabled={isUploading}
          kind="secondary"
          onClick={() => inputRef.current?.click()}
          size="sm"
        >
          {isUploading ? "Importerer..." : "Vælg CSV"}
        </Button>
      </div>
      {status ? (
        <InlineNotification
          hideCloseButton
          kind={status.kind}
          lowContrast
          subtitle={status.subtitle}
          title={status.title}
        />
      ) : null}
    </Tile>
  );
}
