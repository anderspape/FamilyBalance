const apiBaseUrl = "https://bankaccountdata.gocardless.com/api/v2";

type GoCardlessToken = {
  access: string;
};

type GoCardlessRefreshToken = {
  refresh: string;
};

type GoCardlessRequisition = {
  id: string;
  link: string;
  accounts?: string[];
};

type GoCardlessBalance = {
  balanceAmount: {
    amount: string;
    currency: string;
  };
  balanceType?: string;
};

type GoCardlessAccountDetails = {
  account?: {
    name?: string;
    displayName?: string;
    ownerName?: string;
    iban?: string;
    bban?: string;
    currency?: string;
  };
};

type GoCardlessTransaction = {
  transactionId?: string;
  bookingDate?: string;
  valueDate?: string;
  remittanceInformationUnstructured?: string;
  creditorName?: string;
  debtorName?: string;
  transactionAmount: {
    amount: string;
    currency: string;
  };
};

type GoCardlessTransactions = {
  transactions?: {
    booked?: GoCardlessTransaction[];
    pending?: GoCardlessTransaction[];
  };
};

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}

async function request<T>(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

  if (init.body) {
    headers.set("Content-Type", "application/json");
  }

  if (init.token) {
    headers.set("Authorization", `Bearer ${init.token}`);
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GoCardless ${response.status}: ${body}`);
  }

  return response.json() as Promise<T>;
}

export function getInstitutionId() {
  return process.env.GOCARDLESS_INSTITUTION_ID ?? "SANDBOXFINANCE_SFIN0000";
}

async function createRefreshToken() {
  return request<GoCardlessRefreshToken>("/token/new/", {
    method: "POST",
    body: JSON.stringify({
      secret_id: getRequiredEnv("GOCARDLESS_SECRET_ID"),
      secret_key: getRequiredEnv("GOCARDLESS_SECRET_KEY"),
    }),
  });
}

export async function createAccessToken() {
  const refreshToken = await createRefreshToken();

  return request<GoCardlessToken>("/token/refresh/", {
    method: "POST",
    body: JSON.stringify({
      refresh: refreshToken.refresh,
    }),
  });
}

export async function createRequisition({
  redirect,
  reference,
}: {
  redirect: string;
  reference: string;
}) {
  const token = await createAccessToken();

  return request<GoCardlessRequisition>("/requisitions/", {
    method: "POST",
    token: token.access,
    body: JSON.stringify({
      redirect,
      institution_id: getInstitutionId(),
      reference,
      user_language: "DA",
    }),
  });
}

export async function getRequisition(requisitionId: string) {
  const token = await createAccessToken();

  return request<GoCardlessRequisition>(`/requisitions/${requisitionId}/`, {
    token: token.access,
  });
}

export async function getAccountDetails(accountId: string, token: string) {
  return request<GoCardlessAccountDetails>(`/accounts/${accountId}/details/`, {
    token,
  });
}

export async function getAccountBalances(accountId: string, token: string) {
  return request<{ balances: GoCardlessBalance[] }>(
    `/accounts/${accountId}/balances/`,
    { token },
  );
}

export async function getAccountTransactions(accountId: string, token: string) {
  return request<GoCardlessTransactions>(
    `/accounts/${accountId}/transactions/`,
    { token },
  );
}

export function formatBalance(balances: GoCardlessBalance[]) {
  const preferred =
    balances.find((balance) => balance.balanceType === "closingBooked") ??
    balances.find((balance) => balance.balanceType === "interimAvailable") ??
    balances[0];

  if (!preferred) {
    return "0 kr.";
  }

  return new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency: preferred.balanceAmount.currency,
    maximumFractionDigits: 2,
  }).format(Number(preferred.balanceAmount.amount));
}

export function balanceMinor(balances: GoCardlessBalance[]) {
  const preferred =
    balances.find((balance) => balance.balanceType === "closingBooked") ??
    balances.find((balance) => balance.balanceType === "interimAvailable") ??
    balances[0];

  if (!preferred) {
    return { amountMinor: 0, currency: "DKK" };
  }

  return {
    amountMinor: Math.round(Number(preferred.balanceAmount.amount) * 100),
    currency: preferred.balanceAmount.currency,
  };
}

export function transactionLabel(transaction: GoCardlessTransaction) {
  return (
    transaction.remittanceInformationUnstructured ??
    transaction.creditorName ??
    transaction.debtorName ??
    "Bankpostering"
  );
}
