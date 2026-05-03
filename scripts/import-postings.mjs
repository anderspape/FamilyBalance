import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const defaultSourcePath = [
  "/Users/andersskovpape/Downloads/Posteringsdetaljer.csv",
  "/Users/andersskovpape/Downloads/Posteringsdetaljer_budget.csv",
].find((path) => existsSync(path));
const sourcePath = resolve(
  process.argv[2] ??
    defaultSourcePath ??
    "/Users/andersskovpape/Downloads/Posteringsdetaljer.csv",
);
const outputPath = resolve("src/lib/mock-data.ts");

const knownAccounts = {
  "9070 1630807898": {
    name: "Fælles budgetkonto",
    balance: 64844.61,
  },
};
const primaryAccountId = "9070 1630807898";
const primaryAccount = knownAccounts[primaryAccountId];

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

function parseAmount(value) {
  return Number(value.replace(/\./g, "").replace(",", "."));
}

function parseDate(value) {
  const [day, month, year] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function monthKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function previousMonthKey(key) {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 2, 1));
  return monthKey(date);
}

function formatKr(value, digits = 0) {
  return `${new Intl.NumberFormat("da-DK", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value)} kr.`;
}

function formatAccountKr(value) {
  return formatKr(value, 2);
}

function formatSignedKr(value, suffix = "") {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${formatKr(Math.abs(Math.round(value)))}${suffix}`;
}

function formatDate(date) {
  return `${String(date.getUTCDate()).padStart(2, "0")}.${String(
    date.getUTCMonth() + 1,
  ).padStart(2, "0")}.${date.getUTCFullYear()}`;
}

function cleanName(row) {
  const parts = [row[0], row[1], row[5]].filter(Boolean).join(" ");
  return parts
    .replace(/\s*Aftalenr\.\s*\d+/gi, "")
    .replace(/\s*Betalingsid\s+\d+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(text, words) {
  const lower = text.toLowerCase();
  return words.some((word) => lower.includes(word));
}

function categoryFor(text, amount) {
  if (amount > 0) {
    if (includesAny(text, ["løn", "månedsløn", "lønoverførsel"])) {
      return { category: "Løn", kind: "income" };
    }

    if (includesAny(text, ["skat", "udbetaling", "børne", "refusion"])) {
      return { category: "Indkomst", kind: "income" };
    }

    return { category: "Indkomst", kind: "income" };
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
    return { category: "Overførsel", kind: "transfer" };
  }

  if (includesAny(text, ["børneopsparing", "nordnet", "spard plus"])) {
    return { category: "Opsparing", kind: "savings" };
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
    return { category: "Bolig", kind: "bill" };
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
    return { category: "Børn", kind: "bill" };
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
    return { category: "Forsikring", kind: "bill" };
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
    return { category: "Transport", kind: "expense" };
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
    return { category: "Faste aftaler", kind: "bill" };
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
    return { category: "Husholdning", kind: "expense" };
  }

  if (includesAny(text, ["tandlæge", "apotek", "sundhed"])) {
    return { category: "Sundhed", kind: "expense" };
  }

  if (includesAny(text, ["streaming", "studio", "træning", "landskamp"])) {
    return { category: "Fritid", kind: "expense" };
  }

  return { category: "Andet", kind: "expense" };
}

function groupByMonth(records, key, predicate) {
  return records.reduce((result, record) => {
    if (!predicate(record)) return result;
    const bucket = monthKey(record.date);
    result[bucket] = (result[bucket] ?? 0) + key(record);
    return result;
  }, {});
}

function sum(records, predicate, mapper = (record) => record.amount) {
  return records.reduce(
    (total, record) => (predicate(record) ? total + mapper(record) : total),
    0,
  );
}

function categorySum(records, selectedMonth, category) {
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

const text = readFileSync(sourcePath, "utf8").replace(/^\uFEFF/, "");
const rows = text
  .trim()
  .split(/\r?\n/)
  .map((line) => line.split(";"))
  .filter((row) => row.length > 4 && row[4]);

const records = rows
  .map((row, index) => {
    const amount = parseAmount(row[4]);
    const date = parseDate(row[7]);
    const merchant = cleanName(row) || "Ukendt postering";
    const category = categoryFor(merchant, amount);

    return {
      id: `tx-${index + 1}`,
      date,
      merchant,
      account: row[2] || row[3] || "Ukendt konto",
      amount,
      counterAccount: row[3],
      ...category,
    };
  })
  .sort((a, b) => b.date.getTime() - a.date.getTime());

const months = [...new Set(records.map((record) => monthKey(record.date)))].sort();
const currentMonth = months.at(-1);
const previousMonth = previousMonthKey(currentMonth);
const currentMonthLabel = monthNames[Number(currentMonth.slice(5)) - 1];

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

const currentIncome = monthlyIncome[currentMonth] ?? 0;
const currentBills = monthlyBills[currentMonth] ?? 0;
const currentSpending = monthlySpending[currentMonth] ?? 0;
const currentExpenses = currentBills + currentSpending;
const currentSavings = monthlySavings[currentMonth] ?? 0;
const currentNet = currentIncome - currentExpenses - currentSavings;

const categories = [
  ...new Set(
    records
      .filter((record) => record.amount < 0 && ["bill", "expense"].includes(record.kind))
      .map((record) => record.category),
  ),
];

const categorySpend = categories
  .map((category) => {
    const value = categorySum(records, currentMonth, category);
    const previousValue = categorySum(records, previousMonth, category);
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
      percent: currentExpenses ? Math.round((value / currentExpenses) * 100) : 0,
      monthIndex,
    };
  })
  .filter((item) => item.value > 0)
  .sort((a, b) => b.value - a.value)
  .slice(0, 5);

function displayMonth(key) {
  const [year, month] = key.split("-").map(Number);
  const label = monthNames[month - 1];
  return `${label[0].toUpperCase()}${label.slice(1)} ${year}`;
}

function accountBalanceAtMonth(accountId, key) {
  const knownAccount = knownAccounts[accountId];
  if (!knownAccount) return undefined;

  const laterMovement = records.reduce((total, record) => {
    if (record.account !== accountId || monthKey(record.date) <= key) {
      return total;
    }

    return total + record.amount;
  }, 0);

  return knownAccount.balance - laterMovement;
}

function buildCategorySpend(key) {
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

function buildMonthlySummary(key, items) {
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

function buildMonthlyOverview(key) {
  const previousKey = previousMonthKey(key);
  const label = displayMonth(key);
  const monthLabel = monthNames[Number(key.slice(5)) - 1];
  const income = monthlyIncome[key] ?? 0;
  const previousMonthIncome = monthlyIncome[previousKey] ?? 0;
  const expenses = (monthlyBills[key] ?? 0) + (monthlySpending[key] ?? 0);
  const priorExpenses = (monthlyBills[previousKey] ?? 0) + (monthlySpending[previousKey] ?? 0);
  const savings = monthlySavings[key] ?? 0;
  const priorSavings = monthlySavings[previousKey] ?? 0;
  const items = buildCategorySpend(key);
  const primaryBalance = accountBalanceAtMonth(primaryAccountId, key);
  const primaryMovement = sum(
    records,
    (record) => record.account === primaryAccountId && monthKey(record.date) === key,
  );

  return {
    id: key,
    label,
    monthlySummary: buildMonthlySummary(key, items),
    dashboardMetrics: [
      {
        label: primaryAccount?.name ?? `Netto i ${monthLabel}`,
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
                    ((monthlyIncome[previousKey] ?? 0) - priorExpenses - priorSavings),
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
const currentOverview = monthlyOverviews.at(-1);
const monthlySummary = currentOverview.monthlySummary;

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

const accountMovement = records.reduce((result, record) => {
  result[record.account] = (result[record.account] ?? 0) + record.amount;
  return result;
}, {});

const accounts = Object.entries(accountMovement)
  .sort(([a], [b]) => {
    if (a === primaryAccountId) return -1;
    if (b === primaryAccountId) return 1;
    return Math.abs(accountMovement[b]) - Math.abs(accountMovement[a]);
  })
  .slice(0, 5)
  .map(([name, movement]) => ({
    name: knownAccounts[name]?.name ?? name,
    balance: knownAccounts[name]
      ? formatAccountKr(knownAccounts[name].balance)
      : formatSignedKr(Math.round(movement)),
    note: knownAccounts[name]
      ? formatSignedKr(Math.round(movement), ` i ${currentMonthLabel}`)
      : "Bevægelse i CSV",
  }));

const transactions = records.slice(0, 12).map((record) => ({
  id: record.id,
  date: formatDate(record.date),
  merchant: record.merchant,
  account: record.account,
  category: record.category,
  amount: formatSignedKr(record.amount, ""),
  status: "CSV",
}));

const categorizationQueue = records
  .filter((record) => record.category === "Andet")
  .slice(0, 3)
  .map((record) => ({
    id: `review-${record.id}`,
    merchant: record.merchant,
    text: `Importeret fra CSV ${formatDate(record.date)}`,
    account: record.account,
    amount: formatSignedKr(record.amount),
  }));

const incomeSources = [
  {
    category: "Løn",
    amount: formatKr(
      Math.round(
        sum(
          records,
          (record) =>
            monthKey(record.date) === currentMonth && record.category === "Løn",
        ),
      ),
    ),
    percent: currentIncome
      ? Math.round(
          (sum(
            records,
            (record) =>
              monthKey(record.date) === currentMonth && record.category === "Løn",
          ) /
            currentIncome) *
            100,
        )
      : 0,
  },
  {
    category: "Anden indkomst",
    amount: formatKr(
      Math.round(
        sum(
          records,
          (record) =>
            monthKey(record.date) === currentMonth &&
            record.kind === "income" &&
            record.category !== "Løn",
        ),
      ),
    ),
    percent: currentIncome
      ? Math.round(
          (sum(
            records,
            (record) =>
              monthKey(record.date) === currentMonth &&
              record.kind === "income" &&
              record.category !== "Løn",
          ) /
            currentIncome) *
            100,
        )
      : 0,
  },
].filter((item) => item.percent > 0);

const savingsGoals = [
  {
    name: "CSV-registreret opsparing",
    saved: formatKr(Math.round(currentSavings)),
    target: formatKr(Math.max(10000, Math.round(currentSavings * 2))),
    percent: currentSavings ? 50 : 0,
  },
  {
    name: "Nettoresultat denne måned",
    saved: formatSignedKr(Math.round(currentNet)),
    target: "Positiv måned",
    percent: currentNet > 0 ? 100 : 25,
  },
];

const source = `export const monthlyOverviews = ${JSON.stringify(
  monthlyOverviews,
  null,
  2,
).replace(/"type": "([^"]+)"/g, '"type": "$1" as const')};

export const dashboardMetrics = ${JSON.stringify(
  currentOverview.dashboardMetrics,
  null,
  2,
).replace(/"type": "([^"]+)"/g, '"type": "$1" as const')};

export const categorySpend = ${JSON.stringify(categorySpend, null, 2)};

export const incomeExpenseHistory = ${JSON.stringify(incomeExpenseHistory, null, 2)};

export const monthlySummary = ${JSON.stringify(monthlySummary)};

export const incomeSources = ${JSON.stringify(incomeSources, null, 2)};

export const savingsGoals = ${JSON.stringify(savingsGoals, null, 2)};

export const sectionSummaries = ${JSON.stringify(
  currentOverview.sectionSummaries,
  null,
  2,
).replace(/"type": "([^"]+)"/g, '"type": "$1" as const')};

export const accounts = ${JSON.stringify(accounts, null, 2)};

export const syncSteps = [
  { label: "Import", description: "CSV læst lokalt" },
  { label: "Kategoriser", description: "Regler anvendt" },
  { label: "Review", description: "Ukendte poster klar" },
];

export const transactionHeaders = [
  { key: "date", header: "Dato" },
  { key: "merchant", header: "Modpart" },
  { key: "account", header: "Konto" },
  { key: "category", header: "Kategori" },
  { key: "amount", header: "Beløb" },
  { key: "status", header: "Status" },
];

export const transactions = ${JSON.stringify(transactions, null, 2)};

export const categorizationQueue = ${JSON.stringify(categorizationQueue, null, 2)};
`;

writeFileSync(outputPath, source);
console.log(`Imported ${records.length} rows from ${sourcePath}`);
console.log(`Wrote ${outputPath}`);
