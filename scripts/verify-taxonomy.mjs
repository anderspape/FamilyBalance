import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const sourcePath = resolve(process.cwd(), "src/lib/categories.ts");
const source = readFileSync(sourcePath, "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
});
const sandbox = {
  module: { exports: {} },
  require,
};
sandbox.exports = sandbox.module.exports;

vm.runInNewContext(transpiled.outputText, sandbox, { filename: sourcePath });

const {
  categoryDefinitions,
  categoryGroups,
  isVisibleSpendingType,
} = sandbox.module.exports;
const errors = [];
const seen = new Set();

for (const item of categoryDefinitions) {
  const identity = `${item.mainCategory} / ${item.name}`;

  if (seen.has(identity)) {
    errors.push(`${identity} findes mere end én gang.`);
  }

  seen.add(identity);

  if (!item.mainCategory || !item.postingType) {
    errors.push(`${item.name} mangler hovedkategori eller posttype.`);
  }

  if (item.badge === "Regn" && item.postingType !== "bill") {
    errors.push(`${item.name} har Regn, men posttype ${item.postingType}.`);
  }

  if (item.badge === "Ind" && item.postingType !== "income") {
    errors.push(`${item.name} har Ind, men posttype ${item.postingType}.`);
  }

  if (item.mainCategory === "Vis ikke" && isVisibleSpendingType(item.postingType)) {
    errors.push(`${item.name} under Vis ikke må ikke tælle som synligt forbrug.`);
  }
}

for (const group of categoryGroups) {
  if (!group.categories.length) {
    errors.push(`${group.name} har ingen underkategorier.`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(
  `Taxonomy OK: ${categoryGroups.length} hovedkategorier, ${categoryDefinitions.length} underkategorier.`,
);
