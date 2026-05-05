export type PostingType =
  | "income"
  | "bill"
  | "expense"
  | "savings"
  | "transfer"
  | "reimbursement"
  | "ignored"
  | "uncategorized";

export type CategoryDefinition = {
  slug: string;
  name: string;
  mainCategory: string;
  postingType: PostingType;
  badge?: "Regn" | "Ind";
  aliases?: string[];
};

export type CategoryGroup = {
  slug: string;
  name: string;
  categories: CategoryDefinition[];
};

const bill = "bill" satisfies PostingType;
const income = "income" satisfies PostingType;
const expense = "expense" satisfies PostingType;
const savings = "savings" satisfies PostingType;

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " og ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function category(
  mainCategory: string,
  name: string,
  postingType: PostingType,
  options: Pick<CategoryDefinition, "badge" | "aliases"> = {},
): CategoryDefinition {
  return {
    slug: slugify(`${mainCategory}-${name}`),
    name,
    mainCategory,
    postingType,
    ...options,
  };
}

function group(
  slug: string,
  name: string,
  items: Array<[string, PostingType, Pick<CategoryDefinition, "badge" | "aliases">?]>,
): CategoryGroup {
  return {
    slug,
    name,
    categories: items.map(([categoryName, postingType, options]) =>
      category(name, categoryName, postingType, options),
    ),
  };
}

export const categoryGroups = [
  group("housing", "Bolig", [
    ["Boliglån/husleje", bill, { badge: "Regn", aliases: ["Bolig"] }],
    ["El/vand/varme/renovation", bill, { badge: "Regn" }],
    ["Ejerforening", bill, { badge: "Regn" }],
    ["Ejendomsskat", bill, { badge: "Regn" }],
    ["Husforsikring", bill, { badge: "Regn", aliases: ["Forsikring"] }],
    ["Indbo- & familieforsikring", bill, { badge: "Regn" }],
    ["Alarmsystem", bill, { badge: "Regn" }],
    ["Udgifter fritidshus", bill, { badge: "Regn" }],
    ["Ombygning & vedligehold", expense],
    ["Have & planter", expense],
    ["Andre boligudgifter", expense],
  ]),
  group("transport", "Transport", [
    ["Bil-, MC-, bådlån o.l.", bill, { badge: "Regn" }],
    ["Brændstof", expense],
    ["Bilforsikring & autohjælp", bill, { badge: "Regn" }],
    ["Ejerafgift/grøn afgift", bill, { badge: "Regn" }],
    ["Bus/tog/færge o.l.", expense],
    ["Taxi", expense],
    ["Parkering", expense],
    ["Værksted & reservedele", expense],
    ["Anden transport", expense],
  ]),
  group("household", "Husholdning", [
    ["Dagligvarer", expense, { aliases: ["Husholdning"] }],
    ["Kiosk/bager & specialbutikker", expense],
    ["Kantine- & frokostordning", expense],
  ]),
  group("living", "Andre leveomkostninger", [
    ["Apotek & medicin", expense, { aliases: ["Sundhed"] }],
    ["Behandling & læger", expense],
    ["Underholds- & børnebidrag", bill, { badge: "Regn", aliases: ["Børn"] }],
    ["Institution", bill, { badge: "Regn" }],
    ["Fagforening & a-kasse", bill, { badge: "Regn", aliases: ["Faste aftaler"] }],
    ["Livs- & ulykkesforsikring", bill, { badge: "Regn" }],
    ["Sundheds- & sygeforsikring", bill, { badge: "Regn" }],
    ["Briller & kontaktlinser", expense],
    ["TV & streaming", bill, { badge: "Regn", aliases: ["Fritid"] }],
    ["Telefoni & internet", bill, { badge: "Regn" }],
    ["Studieudgifter", expense],
    ["Foreninger & kontingenter", bill, { badge: "Regn" }],
  ]),
  group("personal", "Privatforbrug", [
    ["Fastfood & takeaway", expense],
    ["Bar/cafe & restaurant", expense],
    ["Tøj/sko & accessories", expense],
    ["Møbler & boligudstyr", expense],
    ["Elektronik & computerudstyr", expense],
    ["Film/musik & læsestof", expense],
    ["Online services & software", expense],
    ["Hobby & sportsudstyr", expense],
    ["Biograf/koncerter & forlystelser", expense],
    ["Frisør & personlig pleje", expense],
    ["Sport & fritid", expense],
    ["Hus & havehjælp", expense],
    ["Spil & legetøj", expense],
    ["Tips & lotto", expense],
    ["Babyudstyr", expense],
    ["Kæledyr", expense],
    ["Gaver & velgørenhed", expense],
    ["Tobak & alkohol", expense],
    ["Kontanthævning & check", expense],
    ["Højskole- & kursusophold", expense],
    ["Serviceydelser & rådgivning", expense],
    ["Andet privatforbrug", expense, { aliases: ["Andet"] }],
  ]),
  group("travel", "Ferie", [
    ["Fly & Hotel", expense],
    ["Billeje", expense],
    ["Sommerhus & camping", expense],
    ["Ferieaktiviteter", expense],
    ["Rejseforsikring", expense],
  ]),
  group("misc", "Diverse", [
    ["Ukendt", "uncategorized", { aliases: ["Ukategoriseret"] }],
    ["Bankgebyrer", expense],
    ["Rykkergebyrer", expense],
    ["Bøder & afgifter", expense],
    ["Restskat", expense],
    ["Offentligt gebyr", expense],
  ]),
  group("debt", "Lån & gæld", [
    ["Studielån", bill, { badge: "Regn" }],
    ["Forbrugslån", bill, { badge: "Regn" }],
    ["Private lån (venner & familie)", bill, { badge: "Regn" }],
    ["Udlånsrenter", expense],
  ]),
  group("savings", "Pension & Opsparing", [
    ["Pensionsopsparing", bill, { badge: "Regn", aliases: ["Opsparing"] }],
    ["Børneopsparing", bill, { badge: "Regn" }],
    ["Anden opsparing", bill, { badge: "Regn" }],
    ["Værdipapirshandel", savings],
  ]),
  group("income", "Indkomst", [
    ["Løn", income, { badge: "Ind", aliases: ["Indkomst"] }],
    ["Pensionsudbetaling", income, { badge: "Ind" }],
    ["Dagpenge/overførselsindkomst", income],
    ["SU & studielån", income, { badge: "Ind" }],
    ["Børnepenge", income, { badge: "Ind" }],
    ["Underholds- & børnebidrag", income, { badge: "Ind" }],
    ["Feriepenge", income, { badge: "Ind" }],
    ["Renteindtægter", income, { badge: "Ind" }],
    ["Udbytte & afkast", income, { badge: "Ind" }],
    ["Overskydende skat", income, { badge: "Ind" }],
    ["Boligstøtte", income, { badge: "Ind" }],
    ["Anden indkomst", income, { badge: "Ind" }],
  ]),
  group("hidden", "Vis ikke", [
    ["Kontooverførsel", "transfer", { aliases: ["Overførsel"] }],
    ["Udlæg", "reimbursement"],
    ["Ignorer", "ignored"],
  ]),
] as const satisfies CategoryGroup[];

export const categoryDefinitions = categoryGroups.flatMap((item) => item.categories);

export const categories = categoryGroups.map((item) => ({
  slug: item.slug,
  name: item.name,
}));

export const categoryOptions = categoryDefinitions.map((item) => ({
  value: item.slug,
  label: item.badge ? `${item.name} [${item.badge}]` : item.name,
  group: item.mainCategory,
  postingType: item.postingType,
}));

const normalizedCategoryLookup = new Map<string, CategoryDefinition[]>();

function normalizeKey(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function addLookup(key: string, item: CategoryDefinition) {
  const normalizedKey = normalizeKey(key);
  const items = normalizedCategoryLookup.get(normalizedKey) ?? [];
  items.push(item);
  normalizedCategoryLookup.set(normalizedKey, items);
}

for (const item of categoryDefinitions) {
  addLookup(item.slug, item);
  addLookup(item.name, item);
  addLookup(`${item.mainCategory} / ${item.name}`, item);

  for (const alias of item.aliases ?? []) {
    addLookup(alias, item);
  }
}

export function resolveCategory(
  value: string | null | undefined,
  postingTypeHint?: PostingType | null,
) {
  const key = normalizeKey(value ?? "");
  const candidates = normalizedCategoryLookup.get(key) ?? [];

  return (
    candidates.find((item) => item.postingType === postingTypeHint) ??
    candidates[0] ??
    normalizedCategoryLookup.get("ukendt")![0]
  );
}

export function getPostingTypeLabel(postingType: PostingType) {
  switch (postingType) {
    case "income":
      return "Ind";
    case "bill":
      return "Regn";
    case "savings":
      return "Opsparing";
    case "transfer":
      return "Overførsel";
    case "reimbursement":
      return "Udlæg";
    case "ignored":
      return "Ignorer";
    case "uncategorized":
      return "Ukendt";
    case "expense":
    default:
      return "Forbrug";
  }
}

export function isVisibleSpendingType(postingType: PostingType) {
  return postingType === "bill" || postingType === "expense";
}
