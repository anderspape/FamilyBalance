"use client";

import { useRef, useState, type DragEvent } from "react";
import { Button, InlineNotification, Tile } from "@carbon/react";
import { DocumentImport } from "@carbon/icons-react";

type ImportStatus = {
  kind: "success" | "error" | "info";
  title: string;
  subtitle: string;
};

export function CsvImportPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
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

    try {
      const response = await fetch("/api/import/csv", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "CSV-importen fejlede.");
      }

      setStatus({
        kind: "success",
        title: "CSV importeret",
        subtitle: `${result.inserted} nye posteringer importeret, ${result.duplicates} dubletter sprunget over.`,
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
      className={`csv-import-panel${isDragging ? " csv-import-panel--dragging" : ""}`}
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
          <h2>Drop din bank-CSV her</h2>
          <p>
            Brug samme format som Posteringsdetaljer.csv. Importen gemmer kun nye
            posteringer.
          </p>
        </div>
      </div>
      <div className="csv-import-panel__actions">
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
