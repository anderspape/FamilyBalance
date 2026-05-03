# Budget

Lokal-first prototype til husstandsøkonomi bygget med Next.js, Carbon React og Supabase-klient. Første slice fokuserer på designretningen: overblik, bankstatus, transaktioner og kategoriseringsreview med mock-data.

## Stack

- Next.js App Router
- Carbon React, Carbon Icons og Carbon styles
- Supabase JS client
- TypeScript og Sass

## Kør lokalt

Den lokale Homebrew Node-installation fejler i øjeblikket på en manglende `libsimdjson.30.dylib`. Brug derfor den bundled Codex Node runtime, indtil system-Node er repareret:

```bash
/usr/bin/env PATH=/Users/andersskovpape/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/usr/local/opt/node/bin:/usr/bin:/bin:/usr/sbin:/sbin \
  /Users/andersskovpape/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
  /usr/local/opt/node/libexec/lib/node_modules/npm/bin/npm-cli.js run dev
```

Åbn derefter [http://localhost:3000](http://localhost:3000).

Når system-Node virker igen, kan du bruge den almindelige kommando:

```bash
npm run dev
```

## Bankforbindelse

Appen har et provider-lag til bankforbindelser. GoCardless-adapteren er isoleret, men GoCardless Bank Account Data tager ikke nye signups lige nu, så den er kun klar til brug hvis du allerede har credentials.

1. Opret credentials hos den valgte open-banking provider.
2. Kopier `.env.example` til `.env.local`.
3. Udfyld providerens secrets.
4. Brug sandbox først, og skift derefter til en rigtig bank-institution senere.

Flowet er:

- `Forbind bank` opretter en requisition og sender dig til bank-consent.
- `/api/bank/callback` gemmer connection-state på den loggede bruger i Supabase.
- `Synkroniser nu` kalder `/api/bank/sync`, henter konti, saldi og posteringer og refresher overblikket.

## FamilyBalance login

Login kører via Supabase Auth med email magic link.

1. Opret et Supabase-projekt.
2. Kør SQL-migrationerne i `supabase/migrations/` i rækkefølge.
3. Udfyld disse værdier i `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Når Supabase-variablerne er sat, bliver `/overblik`, `/indkomst`, `/udgifter` og `/opsparing` beskyttet af login. Uden Supabase-variabler kan appen stadig køre i prototype-mode med CSV/mock fallback.

Bank-state gemmes i Supabase-tabellerne `bank_connections`, `bank_accounts` og `bank_transactions`, når en bruger er logget ind.

## CSV-import

Overblikket har en CSV-dropzone, der understøtter samme format som `Posteringsdetaljer.csv`.

- `POST /api/import/csv` modtager `multipart/form-data` med feltet `file`.
- Poster gemmes i `imported_transactions`.
- `source_hash` deduplikerer samme postering pr. bruger.
- `/api/budget-data` bruger importerede poster som datakilde, når de findes.

Kør også migrationen:

```txt
supabase/migrations/002_imported_transactions.sql
```

## Render

`render.yaml` beskriver en Render web service til FamilyBalance.

Render kræver, at projektet ligger i et GitHub/GitLab/Bitbucket-repo. Når repoet er pushed:

1. Opret en Blueprint på Render fra repoet.
2. Sæt `NEXT_PUBLIC_APP_URL` til Render-appens HTTPS-url.
3. Sæt Supabase env vars i Render.
4. Tilføj Render callback URL i Supabase Auth:

```text
https://<din-render-app>.onrender.com/auth/callback
```

Når en open-banking provider er valgt senere, sættes bank-callbacken til:

```text
https://<din-render-app>.onrender.com/api/bank/callback
```

## Verificering

```bash
npm run lint
npm run build
```

Hvis system-Node stadig fejler, brug samme bundled Node-prefix som ovenfor.
