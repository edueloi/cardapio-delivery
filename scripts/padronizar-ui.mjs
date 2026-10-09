// Normaliza tokens Tailwind para o padrão de UI (ver src/components/ui/PADRAO-TELAS.md).
// Uso: node scripts/padronizar-ui.mjs <arquivo|pasta> [...]   (--dry mostra só a contagem)
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const targets = args.filter(a => !a.startsWith("--"));

// Telas fora do escopo: vitrine pública, login, tour, PDV em tela cheia.
const IGNORE = [/[\/]features[\/]menu-view[\/]/, /[\/]features[\/]condominium-view[\/]/, /[\/]features[\/]public-dashboard[\/]/, /[\/]features[\/]auth[\/]/, /LandingPage/, /Kitchen(Display|Global)Page/, /TvAppPage/];

const sizeMap = { "8": "10", "9": "10", "10": "11" };
const rules = [
  // prefixos de variante (sm:, hover:, md:...) ficam preservados porque casamos só o token final
  [/(?<![\w\[-])((?:[a-z0-9-]+:)*)uppercase(?![\w-])/g, ""],
  [/(?<![\w\[-])((?:[a-z0-9-]+:)*)tracking-(?:widest|wider|wide|tight|tighter|\[[^\]\s]+\])(?![\w-])/g, ""],
  [/(?<![\w\[-])((?:[a-z0-9-]+:)*)font-(?:black|extrabold|bold)(?![\w-])/g, "$1font-semibold"],
  [/(?<![\w\[-])((?:[a-z0-9-]+:)*)text-\[(8|9|10)px\](?![\w-])/g, (m, p, n) => `${p}text-[${sizeMap[n]}px]`],
  [/(?<![\w\[-])((?:[a-z0-9-]+:)*)rounded((?:-[trbl]{1,2})?)-(?:2xl|3xl|xl)(?![\w-])/g, "$1rounded$2-lg"],
  [/(?<![\w\[-])((?:[a-z0-9-]+:)*)shadow-(?:lg|xl|2xl)(?:\s+shadow-[a-z]+-\d+\/\d+)?(?![\w-])/g, "$1shadow-sm"],
  [/(?<![\w\[-])((?:[a-z0-9-]+:)*)shadow-md(?![\w-])/g, "$1shadow-sm"],
];

function walk(p, out = []) {
  const st = fs.statSync(p);
  if (st.isDirectory()) { for (const f of fs.readdirSync(p)) if (f !== "node_modules") walk(path.join(p, f), out); }
  else if (/\.tsx$/.test(p) && !IGNORE.some(r => r.test(p.split(path.sep).join("/")))) out.push(p);
  return out;
}

let changed = 0;
for (const file of targets.flatMap(t => walk(t))) {
  const src = fs.readFileSync(file, "utf8");
  let out = src;
  for (const [re, rep] of rules) out = out.replace(re, rep);
  // tira espaços duplos deixados dentro de strings de classe e antes de aspas
  out = out.replace(/(["'`])([^"'`\n]*?)\1/g, (m, q, body) => /  | $|^ /.test(body) && /[a-z]-|:/.test(body) ? q + body.replace(/ {2,}/g, " ").replace(/^ +| +$/g, "") + q : m);
  if (out !== src) { changed++; if (!dry) fs.writeFileSync(file, out); console.log((dry ? "[dry] " : "") + file); }
}
console.log(`${changed} arquivo(s) alterado(s)`);
