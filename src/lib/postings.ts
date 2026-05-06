import { createHash } from "node:crypto";
import {
  isVisibleSpendingType,
  resolveCategory,
  type PostingType,
} from "@/lib/categories";
import type { ImportAccount } from "@/lib/import-accounts";

const monthNames = [
  "jan",
  "feb",
  "mar",
  "apr",
  "maj",
  "jun",
  "jul",
  "aug",
  "sep",
  "okt",
  "nov",
  "dec",
];

const knownAccounts: Record<string, { name: string; balance: number }> = {
  "9070 1630807898": {
    name: "Fælles budgetkonto",
    balance: 64844.61,
  },
};

const primaryAccountId = "9070 1630807898";

export type ImportedPosting = {
  sourceHash: string;
  importAccountId?: string | null;
  accountName: string;
  accountNumber: string;
  bookingDate: string;
  description: string;
  amountMinor: number;
  currency: "DKK";
  category: string;
  kind: PostingType;
  raw: Record<string, string>;
};

export type StoredImportedPosting = ImportedPosting & {
  id?: string;
  createdAt?: string;
};

export type BudgetInsight = {
  id: string;
  type: "status" | "anomaly" | "category" | "recurring" | "cashflow" | "data_quality";
  severity: "positive" | "neutral" | "warning" | "critical";
  title: string;
  body: string;
  metric: string;
  actionLabel: string;
  actionHref: string;
};

export type PostingAccountOverride = {
  accountName?: string;
  accountNumber?: string;
};

type PostingRecord = StoredImportedPosting & {
  amount: number;
  date: Date;
  mainCategory: string;
  subcategory: string;
};

type InsightCandidate = BudgetInsight & {
  priority: number;
};

function toBudgetInsight(candidate: InsightCandidate): BudgetInsight {
  return {
    id: candidate.id,
    type: candidate.type,
    severity: candidate.severity,
    title: candidate.title,
    body: candidate.body,
    metric: candidate.metric,
    actionLabel: candidate.actionLabel,
    actionHref: candidate.actionHref,
  };
}

function parseCsvLine(line: string, delimiter = ";") {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === delimiter && !quoted) {
      cells.push(cell.trim());
      cell = "";
      continue;
    }

    cell += char;
  }

  cells.push(cell.trim());
  return cells;
}

function parseAmount(value: string) {
  const normalized = value
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");

  return Number(normalized);
}

function parseDate(value: string) {
  const match = value.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);

  if (!match) {
    return null;
  }

  const [, dayValue, monthValue, yearValue] = match;
  const day = Number(dayValue);
  const month = Number(monthValue);
  const year =
    yearValue.length === 2 ? Number(`20${yearValue}`) : Number(yearValue);

  if (!day || !month || !year) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day));
}

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function previousMonthKey(key: string) {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 2, 1));
  return monthKey(date);
}

function formatKr(value: number, digits = 0) {
  return `${new Intl.NumberFormat("da-DK", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)} kr.`;
}

function formatAccountKr(value: number) {
  return formatKr(value, 2);
}

function formatSignedKr(value: number, suffix = "") {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${formatKr(Math.abs(Math.round(value)))}${suffix}`;
}

function formatCompactDate(value: string) {
  return new Intl.DateTimeFormat("da-DK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value.includes("T") ? value : `${value}T00:00:00.000Z`));
}

function previousAverage(
  months: string[],
  values: Record<string, number>,
  key: string,
  count = 3,
) {
  const previousMonths = months.filter((month) => month < key).slice(-count);

  if (!previousMonths.length) {
    return 0;
  }

  return (
    previousMonths.reduce((total, month) => total + (values[month] ?? 0), 0) /
    previousMonths.length
  );
}

function percentChange(current: number, previous: number) {
  if (!previous) return null;

  return Math.round(((current - previous) / previous) * 100);
}

function describeExpenseChange(current: number, previous: number) {
  const change = percentChange(current, previous);

  if (change === null) {
    return current > 0 ? "Der er endnu ikke en tidligere måned at sammenligne med." : "";
  }

  if (change === 0) {
    return "Forbruget ligger på niveau med sidste måned.";
  }

  return `Forbruget er ${Math.abs(change)}% ${
    change < 0 ? "lavere" : "højere"
  } end sidste måned.`;
}

function compactDescription(value: string) {
  return value.length > 54 ? `${value.slice(0, 51).trim()}...` : value;
}

function posterHref(params: Record<string, string>) {
  const searchParams = new URLSearchParams(params);
  return `/poster?${searchParams.toString()}`;
}

function cleanName(row: string[]) {
  const parts = [row[0], row[1], row[5]].filter(Boolean).join(" ");
  return parts
    .replace(/\s*Aftalenr\.\s*\d+/gi, "")
    .replace(/\s*Betalingsid\s+\d+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function detectDelimiter(text: string) {
  const firstDataLine =
    text
      .replace(/^\uFEFF/, "")
      .split(/\r?\n/)
      .find((line) => line.trim()) ?? "";
  const semicolons = (firstDataLine.match(/;/g) ?? []).length;
  const commas = (firstDataLine.match(/,/g) ?? []).length;

  return semicolons >= commas ? ";" : ",";
}

function findAmountCell(row: string[]) {
  const preferred = parseAmount(row[4] ?? "");

  if (Number.isFinite(preferred)) {
    return preferred;
  }

  for (const cell of row) {
    if (!/[+-]?\d/.test(cell)) continue;
    if (parseDate(cell)) continue;

    const amount = parseAmount(cell);

    if (Number.isFinite(amount) && Math.abs(amount) > 0) {
      return amount;
    }
  }

  return Number.NaN;
}

function findDateCell(row: string[]) {
  return parseDate(row[7] ?? "") ?? row.map(parseDate).find(Boolean) ?? null;
}

function findAccountNumber(row: string[]) {
  return (
    row.find((cell) => /^\d{4}\s*\d{6,12}$/.test(cell.trim())) ??
    row[2] ??
    row[3] ??
    "Ukendt konto"
  );
}

function fallbackDescription(row: string[]) {
  return row
    .filter((cell) => {
      if (!cell.trim()) return false;
      if (parseDate(cell)) return false;
      if (Number.isFinite(parseAmount(cell))) return false;
      if (/^\d{4}\s*\d{6,12}$/.test(cell.trim())) return false;
      return !/^(dato|tekst|beløb|saldo|valuta|konto|bogføring)/i.test(cell);
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(text: string, words: string[]) {
  const lower = text.toLowerCase();
  return words.some((word) => lower.includes(word));
}

function isLikelyInternalTransfer(text: string) {
  const lower = text.toLowerCase();
  const transferText =
    includesAny(lower, [
      "overførsel konto",
      "overfoersel konto",
      "konto 9070",
      "overført til",
      "overfort til",
      "til husholdningskonto",
      "til budgetkonto",
      "til opsparingskonto",
    ]) ||
    /^overførsel\b/i.test(text.trim()) ||
    /^overfoersel\b/i.test(text.trim());
  const incomeText = includesAny(lower, [
    "løn",
    "loen",
    "månedsløn",
    "maanedsloen",
    "lønoverførsel",
    "loenoverfoersel",
    "skat",
    "børne",
    "boerne",
    "ungeydelse",
    "refusion",
    "rente",
    "udbytte",
    "afkast",
    "gave",
  ]);

  return transferText && !incomeText;
}

function categoryFor(
  text: string,
  amount: number,
): { category: string; kind: ImportedPosting["kind"] } {
  if (isLikelyInternalTransfer(text)) {
    return { category: "Kontooverførsel", kind: "transfer" as const };
  }

  if (amount > 0) {
    if (includesAny(text, ["løn", "månedsløn", "lønoverførsel"])) {
      return { category: "Løn", kind: "income" as const };
    }

    if (includesAny(text, ["rente", "udbytte", "afkast"])) {
      return { category: "Renteindtægter", kind: "income" as const };
    }

    if (includesAny(text, ["skat"])) {
      return { category: "Overskydende skat", kind: "income" as const };
    }

    return { category: "Anden indkomst", kind: "income" as const };
  }

  if (includesAny(text, ["børneopsparing", "nordnet", "spard plus"])) {
    return { category: "Børneopsparing", kind: "bill" as const };
  }

  if (
    includesAny(text, [
      "totalkredit",
      "husleje",
      "boliglån",
    ])
  ) {
    return { category: "Boliglån/husleje", kind: "bill" as const };
  }

  if (
    includesAny(text, [
      "e/f",
      "ejerforening",
    ])
  ) {
    return { category: "Ejerforening", kind: "bill" as const };
  }

  if (includesAny(text, ["andel energi", "fiberby", "renovation", "vand", "varme"])) {
    return { category: "El/vand/varme/renovation", kind: "bill" as const };
  }

  if (
    includesAny(text, [
      "andel energi",
      "fiberby",
      "kildegaarden",
      "jensen vvs",
      "gardiner",
      "bauhaus",
    ])
  ) {
    return { category: "Andre boligudgifter", kind: "expense" as const };
  }

  if (
    includesAny(text, [
      "steinerskole",
      "københavns kommune",
      "institutioner",
      "børn",
      "vestia",
    ])
  ) {
    return { category: "Institution", kind: "bill" as const };
  }

  if (
    includesAny(text, [
      "forsikring",
      "tandforsikring",
      "gruppeliv",
      "kritiske sygdomme",
      "livsforsikring",
      "danmark erhverv",
    ])
  ) {
    if (includesAny(text, ["bil", "auto", "motor"])) {
      return { category: "Bilforsikring & autohjælp", kind: "bill" as const };
    }

    if (includesAny(text, ["hus", "villa"])) {
      return { category: "Husforsikring", kind: "bill" as const };
    }

    if (includesAny(text, ["sundhed", "syge", "tand"])) {
      return { category: "Sundheds- & sygeforsikring", kind: "bill" as const };
    }

    return { category: "Livs- & ulykkesforsikring", kind: "bill" as const };
  }

  if (
    includesAny(text, [
      "clever",
      "apcoa",
      "parkering",
      "parkzone",
      "dsb",
      "leasing",
      "partnerleasing",
      "jyske finans",
      "billån",
      "motor",
      "cykel",
      "ladcykel",
    ])
  ) {
    if (includesAny(text, ["clever", "brændstof", "benzin", "diesel"])) {
      return { category: "Brændstof", kind: "expense" as const };
    }

    if (includesAny(text, ["apcoa", "parkering", "parkzone"])) {
      return { category: "Parkering", kind: "expense" as const };
    }

    if (includesAny(text, ["dsb", "bus", "tog", "færge"])) {
      return { category: "Bus/tog/færge o.l.", kind: "expense" as const };
    }

    if (includesAny(text, ["leasing", "partnerleasing", "jyske finans", "billån"])) {
      return { category: "Bil-, MC-, bådlån o.l.", kind: "bill" as const };
    }

    return { category: "Anden transport", kind: "expense" as const };
  }

  if (
    includesAny(text, [
      "a-kasse",
      "sygeplejeråd",
      "studiegæld",
      "pension",
      "sos-børnebyerne",
    ])
  ) {
    if (includesAny(text, ["a-kasse", "sygeplejeråd"])) {
      return { category: "Fagforening & a-kasse", kind: "bill" as const };
    }

    if (includesAny(text, ["studiegæld"])) {
      return { category: "Studielån", kind: "bill" as const };
    }

    if (includesAny(text, ["pension"])) {
      return { category: "Pensionsopsparing", kind: "bill" as const };
    }

    return { category: "Foreninger & kontingenter", kind: "bill" as const };
  }

  if (
    includesAny(text, [
      "netto",
      "rema",
      "føtex",
      "coop",
      "meny",
      "lidl",
      "wolt",
      "hjemis",
      "indkøb",
      "tapas",
    ])
  ) {
    if (includesAny(text, ["wolt", "tapas"])) {
      return { category: "Fastfood & takeaway", kind: "expense" as const };
    }

    return { category: "Dagligvarer", kind: "expense" as const };
  }

  if (includesAny(text, ["tandlæge", "apotek", "sundhed"])) {
    if (includesAny(text, ["apotek"])) {
      return { category: "Apotek & medicin", kind: "expense" as const };
    }

    return { category: "Behandling & læger", kind: "expense" as const };
  }

  if (includesAny(text, ["streaming", "studio", "træning", "landskamp"])) {
    if (includesAny(text, ["streaming"])) {
      return { category: "TV & streaming", kind: "bill" as const };
    }

    return { category: "Sport & fritid", kind: "expense" as const };
  }

  return { category: "Ukendt", kind: "uncategorized" as const };
}

export function inferPostingKind(
  category: string,
  amountMinor: number,
): ImportedPosting["kind"] {
  const resolvedCategory = resolveCategory(category);

  if (amountMinor > 0 && resolvedCategory.postingType !== "income") {
    return "income";
  }

  return resolvedCategory.postingType;
}

function sourceHash(row: string[], posting: Omit<ImportedPosting, "sourceHash">) {
  return createHash("sha256")
    .update(
      [
        posting.accountNumber,
        posting.bookingDate,
        posting.description,
        posting.amountMinor,
        row.join("|"),
      ].join("::"),
    )
    .digest("hex");
}

function groupByMonth(
  records: PostingRecord[],
  key: (record: PostingRecord) => number,
  predicate: (record: PostingRecord) => boolean,
) {
  return records.reduce<Record<string, number>>((result, record) => {
    if (!predicate(record)) return result;
    const bucket = monthKey(record.date);
    result[bucket] = (result[bucket] ?? 0) + key(record);
    return result;
  }, {});
}

function sum(
  records: PostingRecord[],
  predicate: (record: PostingRecord) => boolean,
  mapper: (record: PostingRecord) => number = (record) => record.amount,
) {
  return records.reduce(
    (total, record) => (predicate(record) ? total + mapper(record) : total),
    0,
  );
}

function categorySum(records: PostingRecord[], selectedMonth: string, category: string) {
  return sum(
    records,
    (record) =>
      monthKey(record.date) === selectedMonth &&
      record.amount < 0 &&
      isVisibleSpendingType(record.kind) &&
      record.mainCategory === category,
    (record) => Math.abs(record.amount),
  );
}

function incomeCategorySum(
  records: PostingRecord[],
  selectedMonth: string,
  category: string,
) {
  return sum(
    records,
    (record) =>
      monthKey(record.date) === selectedMonth &&
      record.amount > 0 &&
      record.kind === "income" &&
      record.subcategory === category,
  );
}

function displayMonth(key: string) {
  const [year, month] = key.split("-").map(Number);
  const label = monthNames[month - 1];
  return `${label[0].toUpperCase()}${label.slice(1)} ${year}`;
}

export function applyPostingAccountOverride(
  postings: ImportedPosting[],
  account: PostingAccountOverride,
) {
  return postings.map((posting) => ({
    ...posting,
    accountName: account.accountName?.trim() || posting.accountName,
    accountNumber: account.accountNumber?.trim() || posting.accountNumber,
  }));
}

export function parsePostingsCsv(
  text: string,
  account?: PostingAccountOverride,
): ImportedPosting[] {
  const delimiter = detectDelimiter(text);
  const rows = text
    .replace(/^\uFEFF/, "")
    .trim()
    .split(/\r?\n/)
    .map((line) => parseCsvLine(line, delimiter))
    .filter((row) => row.length > 3);

  const postings = rows
    .map((row) => {
      const amount = findAmountCell(row);
      const date = findDateCell(row);
      const description = cleanName(row) || fallbackDescription(row) || "Ukendt postering";

      if (!Number.isFinite(amount) || !date) {
        return null;
      }

      const accountNumber = findAccountNumber(row);
      const accountName = knownAccounts[accountNumber]?.name ?? accountNumber;
      const category = categoryFor(description, amount);
      const posting = {
        accountName,
        accountNumber,
        bookingDate: toDateString(date),
        description,
        amountMinor: Math.round(amount * 100),
        currency: "DKK" as const,
        category: category.category,
        kind: category.kind,
        raw: Object.fromEntries(row.map((value, index) => [`col_${index}`, value])),
      };

      return {
        ...posting,
        sourceHash: sourceHash(row, posting),
      };
    })
    .filter((posting): posting is ImportedPosting => posting !== null);

  if (!postings.length) {
    throw new Error("CSV-filen matcher ikke det forventede posteringsformat.");
  }

  return account ? applyPostingAccountOverride(postings, account) : postings;
}

export function buildDashboardDataFromPostings(
  postings: StoredImportedPosting[],
  importAccounts: ImportAccount[] = [],
) {
  const records = postings
    .map((posting) => {
      const savedCategory = resolveCategory(posting.category, posting.kind);
      const resolvedCategory =
        posting.amountMinor > 0 &&
        savedCategory.postingType === "income" &&
        isLikelyInternalTransfer(posting.description)
          ? resolveCategory("Kontooverførsel", "transfer")
          : savedCategory;

      return {
        ...posting,
        category: resolvedCategory.name,
        kind: resolvedCategory.postingType,
        amount: posting.amountMinor / 100,
        date: new Date(`${posting.bookingDate}T00:00:00.000Z`),
        mainCategory: resolvedCategory.mainCategory,
        subcategory: resolvedCategory.name,
      };
    })
    .sort((a, b) => b.date.getTime() - a.date.getTime());
  const months = [...new Set(records.map((record) => monthKey(record.date)))].sort();

  if (!months.length) {
    return null;
  }

  const monthlyIncome = groupByMonth(
    records,
    (record) => record.amount,
    (record) => record.amount > 0 && record.kind === "income",
  );
  const monthlyBills = groupByMonth(
    records,
    (record) => Math.abs(record.amount),
    (record) => record.amount < 0 && record.kind === "bill",
  );
  const monthlySpending = groupByMonth(
    records,
    (record) => Math.abs(record.amount),
    (record) => record.amount < 0 && record.kind === "expense",
  );
  const monthlySavings = groupByMonth(
    records,
    (record) => Math.abs(record.amount),
    (record) => record.amount < 0 && record.kind === "savings",
  );
  const categories = [
    ...new Set(
      records
        .filter((record) => record.amount < 0 && isVisibleSpendingType(record.kind))
        .map((record) => record.mainCategory),
    ),
  ];
  const incomeCategories = [
    ...new Set(
      records
        .filter((record) => record.amount > 0 && record.kind === "income")
        .map((record) => record.subcategory),
    ),
  ];
  const monthlyExpenses = Object.fromEntries(
    months.map((month) => [
      month,
      (monthlyBills[month] ?? 0) + (monthlySpending[month] ?? 0),
    ]),
  );

  function buildCategorySpend(key: string) {
    return categories
      .map((category) => {
        const value = categorySum(records, key, category);
        const previousValue = categorySum(records, previousMonthKey(key), category);
        const expensesForMonth = (monthlyBills[key] ?? 0) + (monthlySpending[key] ?? 0);
        const monthIndex =
          previousValue === 0
            ? value === 0
              ? "0%"
              : "+100%"
            : `${value - previousValue > 0 ? "+" : ""}${Math.round(
                ((value - previousValue) / previousValue) * 100,
              )}%`;

        return {
          category,
          value: Math.round(value),
          amount: formatKr(Math.round(value)),
          percent: expensesForMonth
            ? Math.round((value / expensesForMonth) * 100)
            : 0,
          monthIndex,
        };
      })
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }

  function buildIncomeSources(key: string) {
    const incomeForMonth = monthlyIncome[key] ?? 0;

    return incomeCategories
      .map((category) => {
        const value = incomeCategorySum(records, key, category);

        return {
          category,
          value: Math.round(value),
          amount: formatKr(Math.round(value)),
          percent: incomeForMonth ? Math.round((value / incomeForMonth) * 100) : 0,
        };
      })
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }

  function buildMonthlySummary(key: string, items: ReturnType<typeof buildCategorySpend>) {
    const label = displayMonth(key);
    const income = monthlyIncome[key] ?? 0;
    const expenses = (monthlyBills[key] ?? 0) + (monthlySpending[key] ?? 0);
    const savings = monthlySavings[key] ?? 0;
    const net = income - expenses - savings;
    const previousExpenses =
      (monthlyBills[previousMonthKey(key)] ?? 0) +
      (monthlySpending[previousMonthKey(key)] ?? 0);
    const averageExpenses = previousAverage(months, monthlyExpenses, key);
    const top = items[0];
    const topShare = top && expenses > 0 ? Math.round((top.value / expenses) * 100) : 0;
    const topPrevious = top ? categorySum(records, previousMonthKey(key), top.category) : 0;
    const topChange = top ? percentChange(top.value, topPrevious) : null;
    const expenseChange = describeExpenseChange(expenses, previousExpenses);
    const averageChange = percentChange(expenses, averageExpenses);
    const averageSentence =
      averageChange === null || averageChange === 0
        ? ""
        : `Det er ${Math.abs(averageChange)}% ${
            averageChange < 0 ? "under" : "over"
          } gennemsnittet for de seneste måneder.`;
    const topSentence = top
      ? `${top.category} er største kategori med ${top.amount} (${topShare}% af udgifterne)${
          topChange === null || topChange === 0
            ? "."
            : `, ${Math.abs(topChange)}% ${
                topChange < 0 ? "lavere" : "højere"
              } end måneden før.`
        }`
      : "Der er endnu ingen udgiftskategori at fremhæve.";

    if (income === 0) {
      return `${label}: der er endnu ikke registreret indkomst, mens ${formatKr(
        Math.round(expenses),
      )} er bogført som udgifter. ${topSentence} Nettoresultatet står på ${formatSignedKr(
        Math.round(net),
      )}. ${expenseChange} ${averageSentence}`.trim();
    }

    return `${label}: ${formatKr(Math.round(income))} i indkomst og ${formatKr(
      Math.round(expenses),
    )} i udgifter. ${topSentence} Nettoresultatet står på ${formatSignedKr(
      Math.round(net),
    )}. ${expenseChange} ${averageSentence}`.trim();
  }

  function buildStatusSummary(key: string) {
    const income = monthlyIncome[key] ?? 0;
    const expenses = (monthlyBills[key] ?? 0) + (monthlySpending[key] ?? 0);
    const savings = monthlySavings[key] ?? 0;
    const net = income - expenses - savings;
    const previousExpenses =
      (monthlyBills[previousMonthKey(key)] ?? 0) +
      (monthlySpending[previousMonthKey(key)] ?? 0);
    const previousIncome = monthlyIncome[previousMonthKey(key)] ?? 0;
    const expenseChange = describeExpenseChange(expenses, previousExpenses);
    const incomeChange = percentChange(income, previousIncome);
    const incomeSentence =
      incomeChange === null
        ? "Indkomsten har endnu ikke et sammenligningspunkt."
        : incomeChange === 0
          ? "Indkomsten matcher sidste måned."
          : `Indkomsten er ${Math.abs(incomeChange)}% ${
              incomeChange < 0 ? "lavere" : "højere"
            } end sidste måned.`;
    const netSentence =
      net >= 0
        ? `Der er ${formatKr(Math.round(net))} tilbage efter udgifter og opsparing.`
        : `Der mangler ${formatKr(Math.abs(Math.round(net)))} for at måneden går i nul efter udgifter og opsparing.`;

    return `${netSentence} ${expenseChange} ${incomeSentence}`;
  }

  function recordsForMonth(key: string) {
    return records.filter((record) => monthKey(record.date) === key);
  }

  function expenseRecordsForMonth(key: string) {
    return recordsForMonth(key).filter(
      (record) => record.amount < 0 && isVisibleSpendingType(record.kind),
    );
  }

  function topCategoryDescriptions(key: string, category: string) {
    return [
      ...new Set(
        expenseRecordsForMonth(key)
          .filter((record) => record.mainCategory === category)
          .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
          .map((record) => compactDescription(record.description)),
      ),
    ].slice(0, 2);
  }

  function topCategoryAmountDescriptions(key: string, category: string) {
    return expenseRecordsForMonth(key)
      .filter((record) => record.mainCategory === category)
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
      .slice(0, 2)
      .map(
        (record) =>
          `${compactDescription(record.description)} (${formatKr(
            Math.abs(Math.round(record.amount)),
          )})`,
      );
  }

  function normalizedRecurringName(record: PostingRecord) {
    return record.description
      .toLowerCase()
      .replace(/\b\d{4,}\b/g, "")
      .replace(/\d+[.,]\d+/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function recurringTotals(key: string) {
    return recordsForMonth(key)
      .filter((record) => record.amount < 0 && ["bill", "savings"].includes(record.kind))
      .reduce<Record<string, { label: string; amount: number }>>((result, record) => {
        const recurringKey = normalizedRecurringName(record);
        if (!recurringKey) return result;

        result[recurringKey] = result[recurringKey] ?? {
          label: compactDescription(record.description),
          amount: 0,
        };
        result[recurringKey].amount += Math.abs(record.amount);
        return result;
      }, {});
  }

  function buildMonthInsights(
    key: string,
    items: ReturnType<typeof buildCategorySpend>,
  ): BudgetInsight[] {
    const label = displayMonth(key);
    const income = monthlyIncome[key] ?? 0;
    const expenses = (monthlyBills[key] ?? 0) + (monthlySpending[key] ?? 0);
    const savings = monthlySavings[key] ?? 0;
    const net = income - expenses - savings;
    const previousKey = previousMonthKey(key);
    const insights: InsightCandidate[] = [];

    insights.push({
      id: `${key}-monthly-health`,
      type: "status",
      severity: net >= 0 ? "positive" : expenses > income ? "warning" : "neutral",
      title: net >= 0 ? "Måneden har luft" : "Måneden er under pres",
      body:
        net >= 0
          ? `${label} har ${formatKr(Math.round(net))} tilbage efter udgifter og opsparing. Det giver plads til ekstra opsparing eller uforudsete udgifter.`
          : `${label} mangler ${formatKr(Math.abs(Math.round(net)))} for at gå i nul efter udgifter og opsparing. Start med de største udgiftsdrivere, før du ændrer småposter.`,
      metric: formatSignedKr(Math.round(net)),
      actionLabel: net >= 0 ? "Se poster" : "Se udgifter",
      actionHref: posterHref({ period: "month", month: key }),
      priority: 100,
    });

    const top = items[0];
    if (top && expenses > 0) {
      const topShare = Math.round((top.value / expenses) * 100);
      const topPrevious = categorySum(records, previousKey, top.category);
      const topChange = percentChange(top.value, topPrevious);
      const descriptions = topCategoryDescriptions(key, top.category);
      const billValue = sum(
        records,
        (record) =>
          monthKey(record.date) === key &&
          record.mainCategory === top.category &&
          record.kind === "bill",
        (record) => Math.abs(record.amount),
      );
      const typeText =
        billValue / top.value >= 0.5 ? "Regninger" : "Forbrugsposter";
      const driverText = descriptions.length
        ? ` De største poster er ${descriptions.join(" og ")}.`
        : "";

      insights.push({
        id: `${key}-top-spending-driver`,
        type: "category",
        severity: topShare >= 40 ? "warning" : "neutral",
        title: `${typeText} i ${top.category} driver udgifterne`,
        body: `${typeText} i ${top.category} fylder ${topShare}% af månedens udgifter med ${top.amount}.${
          topChange === null || topChange === 0
            ? ""
            : ` Det er ${Math.abs(topChange)}% ${
                topChange < 0 ? "lavere" : "højere"
              } end måneden før.`
        }${driverText}`,
        metric: `${topShare}%`,
        actionLabel: "Se poster",
        actionHref: posterHref({ period: "month", month: key, q: top.category }),
        priority: topShare >= 40 ? 90 : 55,
      });
    }

    const categoryChanges = items
      .map((item) => {
        const previousValue = categorySum(records, previousKey, item.category);
        const change = percentChange(item.value, previousValue);
        return {
          ...item,
          previousValue,
          change,
          difference: item.value - previousValue,
        };
      })
      .filter(
        (item) =>
          item.previousValue > 0 &&
          item.change !== null &&
          Math.abs(item.change) >= 20 &&
          Math.abs(item.difference) >= 500,
      )
      .sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
    const categoryChange = categoryChanges[0];

    if (categoryChange && categoryChange.change !== null) {
      const isLower = categoryChange.change < 0;
      const currentDrivers = topCategoryAmountDescriptions(key, categoryChange.category);
      const previousDrivers = topCategoryAmountDescriptions(
        previousKey,
        categoryChange.category,
      );
      const driverSentence = isLower
        ? previousDrivers.length
          ? ` Sidste måned fyldte især ${previousDrivers.join(" og ")}, så faldet ligner en konkret engangspost eller afsluttet betaling.`
          : ""
        : currentDrivers.length
          ? ` Denne måned skyldes stigningen især ${currentDrivers.join(" og ")}.`
          : "";

      insights.push({
        id: `${key}-category-change-${categoryChange.category}`,
        type: "anomaly",
        severity: isLower ? "positive" : "warning",
        title: isLower
          ? `${categoryChange.category} er faldet markant`
          : `${categoryChange.category} ligger højere end normalt`,
        body: `${categoryChange.category} er ${Math.abs(
          categoryChange.change,
        )}% ${
          isLower ? "lavere" : "højere"
        } end sidste måned. Det svarer til ${formatKr(
          Math.abs(Math.round(categoryChange.difference)),
        )} ${
          isLower ? "mindre" : "mere"
        } i månedens udgifter.${driverSentence}`,
        metric: `${isLower ? "↓" : "↑"} ${Math.abs(categoryChange.change)}%`,
        actionLabel: "Se kategori",
        actionHref: posterHref({
          period: "month",
          month: key,
          q: categoryChange.category,
        }),
        priority: isLower ? 70 : 85,
      });
    }

    const currentRecurring = recurringTotals(key);
    const previousRecurring = recurringTotals(previousKey);
    const recurringChange = Object.entries(currentRecurring)
      .map(([recurringKey, current]) => {
        const previous = previousRecurring[recurringKey];
        const change = previous ? percentChange(current.amount, previous.amount) : null;
        return { recurringKey, current, previous, change };
      })
      .filter(
        (item) =>
          item.previous &&
          item.change !== null &&
          Math.abs(item.change) >= 15 &&
          Math.abs(item.current.amount - item.previous.amount) >= 100,
      )
      .sort(
        (a, b) =>
          Math.abs(b.current.amount - (b.previous?.amount ?? 0)) -
          Math.abs(a.current.amount - (a.previous?.amount ?? 0)),
      )[0];

    if (recurringChange?.previous && recurringChange.change !== null) {
      const isLower = recurringChange.change < 0;
      insights.push({
        id: `${key}-recurring-change-${recurringChange.recurringKey}`,
        type: "recurring",
        severity: isLower ? "positive" : "warning",
        title: "Fast betaling har ændret sig",
        body: `${recurringChange.current.label} er ${Math.abs(
          recurringChange.change,
        )}% ${isLower ? "lavere" : "højere"} end sidste måned. Tjek om ændringen er forventet, især hvis posten er en regning eller aftale.`,
        metric: formatKr(Math.round(recurringChange.current.amount)),
        actionLabel: "Se post",
        actionHref: posterHref({
          period: "month",
          month: key,
          q: recurringChange.current.label,
        }),
        priority: 75,
      });
    }

    const uncategorizedCount = recordsForMonth(key).filter(
      (record) => record.kind === "uncategorized",
    ).length;
    const accountsWithoutBalance = importAccounts.filter(
      (account) => account.balanceMinor === null,
    ).length;

    if (uncategorizedCount || accountsWithoutBalance) {
      const parts = [
        uncategorizedCount
          ? `${uncategorizedCount} posteringer mangler en præcis kategori`
          : "",
        accountsWithoutBalance
          ? `${accountsWithoutBalance} konti mangler manuel saldo`
          : "",
      ].filter(Boolean);

      insights.push({
        id: `${key}-cleanup-needed`,
        type: "data_quality",
        severity: uncategorizedCount >= 5 ? "warning" : "neutral",
        title: "Datagrundlaget kan blive skarpere",
        body: `${parts.join(", ")}. Ret det, så coachen kan forklare måneden mere præcist.`,
        metric: `${uncategorizedCount + accountsWithoutBalance}`,
        actionLabel: uncategorizedCount ? "Gennemgå poster" : "Gå til import",
        actionHref: uncategorizedCount
          ? posterHref({ period: "month", month: key, q: "Ukendt" })
          : "/import",
        priority: 60,
      });
    }

    const severityRank = {
      critical: 4,
      warning: 3,
      positive: 2,
      neutral: 1,
    };

    return insights
      .sort(
        (a, b) =>
          severityRank[b.severity] - severityRank[a.severity] ||
          b.priority - a.priority,
      )
      .slice(0, 3)
      .map(toBudgetInsight);
  }

  function buildMonthlySummaryFromInsights(
    key: string,
    insights: BudgetInsight[],
    fallbackSummary: string,
  ) {
    const status = insights.find((insight) => insight.type === "status");
    const driver = insights.find((insight) => insight.type === "category");
    const anomaly = insights.find((insight) => insight.type === "anomaly");

    if (!status) {
      return fallbackSummary;
    }

    return [status.body, driver?.body, anomaly?.body]
      .filter(Boolean)
      .join(" ")
      .replace(displayMonth(key), "Måneden");
  }

  function accountBalanceAtMonth(accountId: string, key: string) {
    const knownAccount = knownAccounts[accountId];
    if (!knownAccount) return undefined;

    const laterMovement = records.reduce((total, record) => {
      if (record.accountNumber !== accountId || monthKey(record.date) <= key) {
        return total;
      }

      return total + record.amount;
    }, 0);

    return knownAccount.balance - laterMovement;
  }

  function buildMonthlyOverview(key: string) {
    const previousKey = previousMonthKey(key);
    const label = displayMonth(key);
    const monthLabel = monthNames[Number(key.slice(5)) - 1];
    const income = monthlyIncome[key] ?? 0;
    const previousMonthIncome = monthlyIncome[previousKey] ?? 0;
    const expenses = (monthlyBills[key] ?? 0) + (monthlySpending[key] ?? 0);
    const priorExpenses =
      (monthlyBills[previousKey] ?? 0) + (monthlySpending[previousKey] ?? 0);
    const savings = monthlySavings[key] ?? 0;
    const priorSavings = monthlySavings[previousKey] ?? 0;
    const items = buildCategorySpend(key);
    const incomeSources = buildIncomeSources(key);
    const fallbackSummary = buildMonthlySummary(key, items);
    const insights = buildMonthInsights(key, items);
    const primaryBalance = accountBalanceAtMonth(primaryAccountId, key);
    const primaryMovement = sum(
      records,
      (record) => record.accountNumber === primaryAccountId && monthKey(record.date) === key,
    );

    return {
      id: key,
      label,
      monthlySummary: buildMonthlySummaryFromInsights(key, insights, fallbackSummary),
      statusSummary: buildStatusSummary(key),
      insights,
      dashboardMetrics: [
        {
          label: knownAccounts[primaryAccountId]?.name ?? `Netto i ${monthLabel}`,
          value:
            primaryBalance !== undefined
              ? formatAccountKr(primaryBalance)
              : formatSignedKr(Math.round(income - expenses - savings)),
          change:
            primaryBalance !== undefined
              ? formatSignedKr(Math.round(primaryMovement), ` i ${monthLabel}`)
              : formatSignedKr(
                  Math.round(
                    income -
                      expenses -
                      savings -
                      ((monthlyIncome[previousKey] ?? 0) -
                        priorExpenses -
                        priorSavings),
                  ),
                  " mod sidste måned",
                ),
          type: primaryMovement >= 0 ? "green" : "blue",
        },
        {
          label: `Forbrug i ${monthLabel}`,
          value: formatKr(Math.round(expenses)),
          change:
            priorExpenses > 0
              ? `${Math.round((expenses / priorExpenses) * 100)}% af sidste måned`
              : "Ny måned",
          type: "blue",
        },
      ],
      sectionSummaries: [
        {
          id: "income",
          title: "Indkomst",
          label: "Denne måned",
          value: formatKr(Math.round(income)),
          detail: formatSignedKr(
            Math.round(income - previousMonthIncome),
            " mod sidste måned",
          ),
          tag: "CSV",
          type: income >= previousMonthIncome ? "green" : "red",
        },
        {
          id: "expenses",
          title: "Udgifter",
          label: "Denne måned",
          value: formatKr(Math.round(expenses)),
          detail:
            priorExpenses > 0
              ? `${Math.round((expenses / priorExpenses) * 100)}% af sidste måned`
              : "Ny måned",
          tag: "CSV",
          type: expenses <= priorExpenses || priorExpenses === 0 ? "green" : "red",
        },
        {
          id: "savings",
          title: "Opsparing",
          label: "Denne måned",
          value: formatKr(Math.round(savings)),
          detail: formatSignedKr(
            Math.round(savings - priorSavings),
            " mod sidste måned",
          ),
          tag: "CSV",
          type: "purple",
        },
      ],
      incomeSources,
      categorySpend: items,
      spendingTotal: formatKr(Math.round(expenses)),
    };
  }

  const monthlyOverviews = months.slice(-13).map(buildMonthlyOverview);
  const currentOverview = monthlyOverviews.at(-1)!;
  const currentMonth = months.at(-1)!;
  const currentMonthLabel = monthNames[Number(currentMonth.slice(5)) - 1];
  const incomeExpenseHistory = months.slice(-13).map((key) => {
    const [year, month] = key.split("-").map(Number);
    return {
      month: monthNames[month - 1],
      year,
      income: Math.round(monthlyIncome[key] ?? 0),
      bills: Math.round(monthlyBills[key] ?? 0),
      spending: Math.round(monthlySpending[key] ?? 0),
    };
  });
  const currentMonthRecords = records.filter(
    (record) => monthKey(record.date) === currentMonth,
  );
  const recordsByImportAccountId = records.reduce<Record<string, PostingRecord[]>>(
    (result, record) => {
      if (record.importAccountId) {
        result[record.importAccountId] = result[record.importAccountId] ?? [];
        result[record.importAccountId].push(record);
      }

      return result;
    },
    {},
  );
  const currentMovementByImportAccountId = currentMonthRecords.reduce<
    Record<string, number>
  >((result, record) => {
    if (record.importAccountId) {
      result[record.importAccountId] =
        (result[record.importAccountId] ?? 0) + record.amount;
    }

    return result;
  }, {});

  const importAccountRows = importAccounts.map((account) => {
    const accountRecords =
      recordsByImportAccountId[account.id] ??
      records.filter(
        (record) =>
          (!record.importAccountId &&
            account.accountNumber &&
            record.accountNumber === account.accountNumber) ||
          (!record.importAccountId && record.accountName === account.name),
      );
    const totalMovement = accountRecords.reduce(
      (total, record) => total + record.amount,
      0,
    );
    const currentMovement = currentMovementByImportAccountId[account.id] ?? 0;
    const note = account.lastImportedAt
      ? `Importeret ${formatCompactDate(account.lastImportedAt)}`
      : "Ingen import endnu";
    const meta = account.lastPostingDate
      ? `Seneste post ${formatCompactDate(account.lastPostingDate)}`
      : undefined;

    return {
      name: account.name,
      balance:
        account.balanceMinor !== null
          ? formatAccountKr(account.balanceMinor / 100)
          : accountRecords.length
            ? formatSignedKr(Math.round(totalMovement))
            : "Saldo ikke angivet",
      note:
        currentMovement !== 0
          ? `${formatSignedKr(Math.round(currentMovement), ` i ${currentMonthLabel}`)} · ${note}`
          : note,
      meta,
    };
  });

  const accountMovement = records.reduce<Record<string, number>>((result, record) => {
    const accountKey = record.accountName || record.accountNumber;
    result[accountKey] = (result[accountKey] ?? 0) + record.amount;
    return result;
  }, {});
  const accounts = importAccountRows.length
    ? importAccountRows
    : Object.entries(accountMovement)
        .sort(([, aMovement], [, bMovement]) => Math.abs(bMovement) - Math.abs(aMovement))
        .slice(0, 5)
        .map(([accountName, movement]) => ({
          name: knownAccounts[accountName]?.name ?? accountName,
          balance: knownAccounts[accountName]
            ? formatAccountKr(knownAccounts[accountName].balance)
            : formatSignedKr(Math.round(movement)),
          note: knownAccounts[accountName]
            ? formatSignedKr(Math.round(movement), ` i ${currentMonthLabel}`)
            : "Importeret fra CSV",
        }));

  return {
    accounts,
    incomeExpenseHistory,
    monthlyOverviews,
    monthlySummary: currentOverview.monthlySummary,
    dashboardMetrics: currentOverview.dashboardMetrics,
    incomeSources: currentOverview.incomeSources,
    categorySpend: currentOverview.categorySpend,
    insights: currentOverview.insights,
    sectionSummaries: currentOverview.sectionSummaries,
  };
}
