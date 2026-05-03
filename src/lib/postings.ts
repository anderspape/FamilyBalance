import { createHash } from "node:crypto";

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
  accountName: string;
  accountNumber: string;
  bookingDate: string;
  description: string;
  amountMinor: number;
  currency: "DKK";
  category: string;
  kind: "income" | "bill" | "expense" | "savings" | "transfer";
  raw: Record<string, string>;
};

export type StoredImportedPosting = ImportedPosting & {
  id?: string;
  createdAt?: string;
};

type PostingRecord = StoredImportedPosting & {
  amount: number;
  date: Date;
};

function parseCsvLine(line: string) {
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

    if (char === ";" && !quoted) {
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
  return Number(value.replace(/\./g, "").replace(",", "."));
}

function parseDate(value: string) {
  const [day, month, year] = value.split("-").map(Number);

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

function cleanName(row: string[]) {
  const parts = [row[0], row[1], row[5]].filter(Boolean).join(" ");
  return parts
    .replace(/\s*Aftalenr\.\s*\d+/gi, "")
    .replace(/\s*Betalingsid\s+\d+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(text: string, words: string[]) {
  const lower = text.toLowerCase();
  return words.some((word) => lower.includes(word));
}

function categoryFor(text: string, amount: number) {
  if (amount > 0) {
    if (includesAny(text, ["løn", "månedsløn", "lønoverførsel"])) {
      return { category: "Løn", kind: "income" as const };
    }

    return { category: "Indkomst", kind: "income" as const };
  }

  if (
    includesAny(text, [
      "overførsel konto",
      "til husholdningskonto",
      "til opsparingskonto",
      "til privat",
      "konto 9070",
      "overført til",
    ])
  ) {
    return { category: "Overførsel", kind: "transfer" as const };
  }

  if (includesAny(text, ["børneopsparing", "nordnet", "spard plus"])) {
    return { category: "Opsparing", kind: "savings" as const };
  }

  if (
    includesAny(text, [
      "totalkredit",
      "e/f",
      "andel energi",
      "fiberby",
      "kildegaarden",
      "jensen vvs",
      "gardiner",
      "bauhaus",
    ])
  ) {
    return { category: "Bolig", kind: "bill" as const };
  }

  if (
    includesAny(text, [
      "steinerskole",
      "københavns kommune",
      "institutioner",
      "alma",
      "børn",
      "vestia",
    ])
  ) {
    return { category: "Børn", kind: "bill" as const };
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
    return { category: "Forsikring", kind: "bill" as const };
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
    return { category: "Transport", kind: "expense" as const };
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
    return { category: "Faste aftaler", kind: "bill" as const };
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
    return { category: "Husholdning", kind: "expense" as const };
  }

  if (includesAny(text, ["tandlæge", "apotek", "sundhed"])) {
    return { category: "Sundhed", kind: "expense" as const };
  }

  if (includesAny(text, ["streaming", "studio", "træning", "landskamp"])) {
    return { category: "Fritid", kind: "expense" as const };
  }

  return { category: "Andet", kind: "expense" as const };
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
      ["bill", "expense"].includes(record.kind) &&
      record.category === category,
    (record) => Math.abs(record.amount),
  );
}

function displayMonth(key: string) {
  const [year, month] = key.split("-").map(Number);
  const label = monthNames[month - 1];
  return `${label[0].toUpperCase()}${label.slice(1)} ${year}`;
}

export function parsePostingsCsv(text: string) {
  const rows = text
    .replace(/^\uFEFF/, "")
    .trim()
    .split(/\r?\n/)
    .map(parseCsvLine)
    .filter((row) => row.length > 7 && row[4] && row[7]);

  const postings = rows
    .map((row) => {
      const amount = parseAmount(row[4]);
      const date = parseDate(row[7]);
      const description = cleanName(row) || "Ukendt postering";

      if (!Number.isFinite(amount) || !date) {
        return null;
      }

      const accountNumber = row[2] || row[3] || "Ukendt konto";
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

  return postings;
}

export function buildDashboardDataFromPostings(postings: StoredImportedPosting[]) {
  const records = postings
    .map((posting) => ({
      ...posting,
      amount: posting.amountMinor / 100,
      date: new Date(`${posting.bookingDate}T00:00:00.000Z`),
    }))
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
        .filter((record) => record.amount < 0 && ["bill", "expense"].includes(record.kind))
        .map((record) => record.category),
    ),
  ];

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

  function buildMonthlySummary(key: string, items: ReturnType<typeof buildCategorySpend>) {
    const label = displayMonth(key);
    const income = monthlyIncome[key] ?? 0;
    const expenses = (monthlyBills[key] ?? 0) + (monthlySpending[key] ?? 0);
    const savings = monthlySavings[key] ?? 0;
    const net = income - expenses - savings;
    const top = items[0]?.category ?? "udgifter";

    if (income === 0) {
      return `${label} er stadig tidlig: der er endnu ikke registreret indkomst, mens ${formatKr(
        Math.round(expenses),
      )} er bogført som udgifter. ${top} fylder mest lige nu, og nettoresultatet står på ${formatSignedKr(
        Math.round(net),
      )}`;
    }

    return `${label} viser ${formatKr(Math.round(income))} i indkomst og ${formatKr(
      Math.round(expenses),
    )} i udgifter. ${top} fylder mest i forbruget, og nettoresultatet står på ${formatSignedKr(
      Math.round(net),
    )}`;
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
    const primaryBalance = accountBalanceAtMonth(primaryAccountId, key);
    const primaryMovement = sum(
      records,
      (record) => record.accountNumber === primaryAccountId && monthKey(record.date) === key,
    );

    return {
      id: key,
      label,
      monthlySummary: buildMonthlySummary(key, items),
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
          type: income >= previousMonthIncome ? "green" : "blue",
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
          type: "blue",
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
  const accountMovement = records.reduce<Record<string, number>>((result, record) => {
    result[record.accountNumber] = (result[record.accountNumber] ?? 0) + record.amount;
    return result;
  }, {});
  const accounts = Object.entries(accountMovement)
    .sort(([a], [b]) => {
      if (a === primaryAccountId) return -1;
      if (b === primaryAccountId) return 1;
      return Math.abs(accountMovement[b]) - Math.abs(accountMovement[a]);
    })
    .slice(0, 5)
    .map(([accountNumber, movement]) => ({
      name: knownAccounts[accountNumber]?.name ?? accountNumber,
      balance: knownAccounts[accountNumber]
        ? formatAccountKr(knownAccounts[accountNumber].balance)
        : formatSignedKr(Math.round(movement)),
      note: knownAccounts[accountNumber]
        ? formatSignedKr(Math.round(movement), ` i ${currentMonthLabel}`)
        : "Bevægelse i CSV",
    }));

  return {
    accounts,
    incomeExpenseHistory,
    monthlyOverviews,
    monthlySummary: currentOverview.monthlySummary,
    dashboardMetrics: currentOverview.dashboardMetrics,
    categorySpend: currentOverview.categorySpend,
    sectionSummaries: currentOverview.sectionSummaries,
  };
}
