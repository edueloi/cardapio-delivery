import React, { useState, useEffect, useRef } from "react";
import {
  Plus, Trash2, Edit2, Package, X, Check, Image as ImageIcon,
  Layers, ChevronDown, ChevronRight, Sparkles, Copy,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button, Modal, ModalFooter, Input, Switch, Badge } from "../../components";
import { apiFetch } from "../../lib/api";
import type { Tenant, Category, ProductBundle, BundleStep } from "../../types";

const BRAND = "#C9A227";

function fmtCurrency(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

function maskMoney(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  const num = parseInt(digits, 10) / 100;
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseMoney(masked: string): number {
  return parseFloat(masked.replace(/\./g, "").replace(",", ".")) || 0;
}

// ─── Templates ───────────────────────────────────────────────────────────────

interface Template {
  id: string;
  category: string;
  emoji: string;
  name: string;
  description: string;
  price: string; // masked
  steps: Omit<BundleStep, "id">[];
}

const TEMPLATES: Template[] = [
  // ── PIZZARIA ──────────────────────────────────────────────────────────────
  {
    id: "pizza-2-refri",
    category: "Pizzaria",
    emoji: "🍕",
    name: "2 Pizzas + Refri 2L",
    description: "Escolha 2 pizzas (tamanho e sabor) e 1 refrigerante 2L",
    price: "89,90",
    steps: [
      { label: "1ª Pizza — Tamanho", description: "Escolha o tamanho", sourceType: "category", flavorMode: "single", qty: 1, required: true },
      { label: "1ª Pizza — Sabor", description: "Escolha o sabor (meio a meio disponível)", sourceType: "category", flavorMode: "half", qty: 1, required: true },
      { label: "2ª Pizza — Tamanho", description: "Escolha o tamanho", sourceType: "category", flavorMode: "single", qty: 1, required: true },
      { label: "2ª Pizza — Sabor", description: "Escolha o sabor (meio a meio disponível)", sourceType: "category", flavorMode: "half", qty: 1, required: true },
      { label: "Borda", description: "Opcional — borda recheada ou simples", sourceType: "category", flavorMode: "single", qty: 1, required: false },
      { label: "Refrigerante 2L", description: "Escolha o sabor", sourceType: "category", flavorMode: "single", qty: 1, required: true },
    ],
  },
  {
    id: "pizza-família",
    category: "Pizzaria",
    emoji: "🍕",
    name: "Pizza Família Completa",
    description: "1 pizza grande (meio a meio) + borda + 2 refris",
    price: "69,90",
    steps: [
      { label: "Pizza Grande — Sabor", description: "Meio a meio disponível", sourceType: "category", flavorMode: "half", qty: 1, required: true },
      { label: "Borda", description: "Borda recheada, de catupiry, de chocolate...", sourceType: "category", flavorMode: "single", qty: 1, required: false },
      { label: "Bebida", description: "Escolha 2 refrigerantes ou sucos", sourceType: "category", flavorMode: "single", qty: 2, required: true },
    ],
  },
  // ── LANCHONETE ────────────────────────────────────────────────────────────
  {
    id: "combo-burguer",
    category: "Lanchonete",
    emoji: "🍔",
    name: "Combo Burguer Clássico",
    description: "Hambúrguer + batata frita + bebida",
    price: "39,90",
    steps: [
      { label: "Hambúrguer", description: "Escolha o tipo", sourceType: "category", flavorMode: "single", qty: 1, required: true },
      { label: "Acompanhamento", description: "Batata frita, onion rings...", sourceType: "category", flavorMode: "single", qty: 1, required: true },
      { label: "Bebida", description: "Refrigerante, suco ou milkshake", sourceType: "category", flavorMode: "single", qty: 1, required: true },
    ],
  },
  {
    id: "combo-duplo-burguer",
    category: "Lanchonete",
    emoji: "🍔",
    name: "Combo Duplo",
    description: "2 hambúrgueres + 2 batatas + 2 bebidas",
    price: "69,90",
    steps: [
      { label: "1º Hambúrguer", sourceType: "category", flavorMode: "single", qty: 1, required: true },
      { label: "2º Hambúrguer", sourceType: "category", flavorMode: "single", qty: 1, required: true },
      { label: "Acompanhamentos", sourceType: "category", flavorMode: "single", qty: 2, required: true },
      { label: "Bebidas", sourceType: "category", flavorMode: "single", qty: 2, required: true },
    ],
  },
  // ── PASTELARIA ────────────────────────────────────────────────────────────
  {
    id: "combo-pastel-suco",
    category: "Pastelaria",
    emoji: "🥟",
    name: "Combo Pastel + Caldo/Suco",
    description: "2 pastéis à sua escolha + caldo de cana ou suco",
    price: "22,90",
    steps: [
      { label: "Pastéis", description: "Escolha 2 sabores de pastel", sourceType: "category", flavorMode: "single", qty: 2, required: true },
      { label: "Bebida", description: "Caldo de cana, suco natural ou refrigerante", sourceType: "category", flavorMode: "single", qty: 1, required: true },
    ],
  },
  {
    id: "combo-pastel-mega",
    category: "Pastelaria",
    emoji: "🥟",
    name: "Combo Mega Pastel",
    description: "4 pastéis + 2 bebidas",
    price: "42,90",
    steps: [
      { label: "Pastéis", description: "Escolha 4 sabores", sourceType: "category", flavorMode: "single", qty: 4, required: true },
      { label: "Bebidas", description: "2 bebidas à sua escolha", sourceType: "category", flavorMode: "single", qty: 2, required: true },
    ],
  },
  // ── MARMITA ───────────────────────────────────────────────────────────────
  {
    id: "marmita-executiva",
    category: "Marmita",
    emoji: "🍱",
    name: "Marmita Executiva",
    description: "Proteína + 2 acompanhamentos + salada",
    price: "24,90",
    steps: [
      { label: "Proteína", description: "Frango, carne, peixe...", sourceType: "category", flavorMode: "single", qty: 1, required: true },
      { label: "Acompanhamentos", description: "Arroz, feijão, macarrão, purê...", sourceType: "category", flavorMode: "single", qty: 2, required: true },
      { label: "Salada", description: "Salada simples ou especial", sourceType: "category", flavorMode: "single", qty: 1, required: false },
      { label: "Bebida", description: "Suco ou água", sourceType: "category", flavorMode: "single", qty: 1, required: false },
    ],
  },
  {
    id: "marmita-fitness",
    category: "Marmita",
    emoji: "🥗",
    name: "Marmita Fitness",
    description: "Proteína grelhada + acompanhamento fit + salada",
    price: "29,90",
    steps: [
      { label: "Proteína Grelhada", description: "Frango, tilápia, carne magra...", sourceType: "category", flavorMode: "single", qty: 1, required: true },
      { label: "Carboidrato", description: "Arroz integral, batata doce, quinoa...", sourceType: "category", flavorMode: "single", qty: 1, required: true },
      { label: "Legumes/Salada", description: "Mix de folhas, legumes no vapor...", sourceType: "category", flavorMode: "single", qty: 1, required: true },
    ],
  },
  // ── DOCERIA / CONFEITARIA ─────────────────────────────────────────────────
  {
    id: "caixa-doces",
    category: "Doceria",
    emoji: "🍫",
    name: "Caixa de Doces",
    description: "Monte sua caixa com doces variados",
    price: "35,00",
    steps: [
      { label: "Doces (caixa com 12)", description: "Brigadeiro, beijinho, bicho-de-pé...", sourceType: "category", flavorMode: "single", qty: 12, required: true },
    ],
  },
  {
    id: "combo-café",
    category: "Doceria",
    emoji: "☕",
    name: "Combo Café da Tarde",
    description: "Bebida quente + 2 doces ou salgados",
    price: "18,90",
    steps: [
      { label: "Bebida", description: "Café, cappuccino, chocolate quente...", sourceType: "category", flavorMode: "single", qty: 1, required: true },
      { label: "Acompanhamento", description: "Doces, bolos, salgados", sourceType: "category", flavorMode: "single", qty: 2, required: true },
    ],
  },
  // ── AÇAÍ ──────────────────────────────────────────────────────────────────
  {
    id: "acai-completo",
    category: "Açaí",
    emoji: "🫐",
    name: "Açaí Completo",
    description: "Tamanho + base + complementos + adicionais",
    price: "32,00",
    steps: [
      { label: "Tamanho", description: "300ml, 500ml, 700ml, 1L...", sourceType: "category", flavorMode: "single", qty: 1, required: true },
      { label: "Base", description: "Açaí puro, com banana, com leite condensado...", sourceType: "category", flavorMode: "single", qty: 1, required: true },
      { label: "Complementos", description: "Granola, leite em pó, castanha, morango...", sourceType: "category", flavorMode: "single", qty: 3, required: false },
      { label: "Adicionais", description: "Leite condensado, mel, paçoca...", sourceType: "category", flavorMode: "single", qty: 2, required: false },
    ],
  },
  // ── SUSHI ─────────────────────────────────────────────────────────────────
  {
    id: "combo-sushi",
    category: "Sushi",
    emoji: "🍣",
    name: "Combo Sushi",
    description: "Monte seu combo com peças à sua escolha",
    price: "59,90",
    steps: [
      { label: "Hot Roll (8 peças)", description: "Escolha o recheio", sourceType: "category", flavorMode: "single", qty: 1, required: true },
      { label: "Uramaki (8 peças)", description: "Escolha o recheio", sourceType: "category", flavorMode: "single", qty: 1, required: true },
      { label: "Temaki", description: "Pequeno, médio ou grande", sourceType: "category", flavorMode: "single", qty: 1, required: false },
      { label: "Bebida", description: "Refrigerante, saquê, suco", sourceType: "category", flavorMode: "single", qty: 1, required: true },
    ],
  },
  // ── CHURRASCO ─────────────────────────────────────────────────────────────
  {
    id: "combo-churrasco",
    category: "Churrasco",
    emoji: "🥩",
    name: "Combo Churrasco",
    description: "Carne + acompanhamentos + bebida",
    price: "49,90",
    steps: [
      { label: "Corte", description: "Picanha, fraldinha, costela, frango...", sourceType: "category", flavorMode: "single", qty: 1, required: true },
      { label: "Acompanhamentos", description: "Farofa, vinagrete, pão de alho, arroz...", sourceType: "category", flavorMode: "single", qty: 2, required: true },
      { label: "Bebida", description: "Cerveja, refrigerante, suco", sourceType: "category", flavorMode: "single", qty: 1, required: true },
    ],
  },
];

const TEMPLATE_CATEGORIES = [...new Set(TEMPLATES.map(t => t.category))];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const newStep = (): BundleStep => ({
  id: crypto.randomUUID(),
  label: "",
  description: "",
  sourceType: "category",
  categoryId: undefined,
  productIds: [],
  variantId: undefined,
  flavorMode: "single",
  qty: 1,
  required: true,
});

function fromTemplate(tpl: Template): BundleStep[] {
  return tpl.steps.map(s => ({ ...s, id: crypto.randomUUID(), productIds: [] }));
}

interface Props { tenant: Tenant; }

// ─── Main panel ──────────────────────────────────────────────────────────────

export default function BundlesPanel({ tenant }: Props) {
  const [bundles, setBundles] = useState<ProductBundle[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "new-choose" | "editor">("list");
  const [editing, setEditing] = useState<ProductBundle | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [templateCat, setTemplateCat] = useState<string>(TEMPLATE_CATEGORIES[0]);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<{
    name: string; description: string; imageUrl: string;
    price: string; available: boolean; sortOrder: string;
    steps: BundleStep[];
  }>({ name: "", description: "", imageUrl: "", price: "", available: true, sortOrder: "0", steps: [] });

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/admin/${tenant.slug}/bundles`).then(r => r.json());
      setBundles(Array.isArray(data) ? data : []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [tenant.slug]);

  useEffect(() => {
    apiFetch(`/api/admin/tenant/${tenant.slug}`)
      .then(r => r.json())
      .then(data => { if (data.categories) setCategories(data.categories); })
      .catch(() => {});
  }, [tenant.slug]);

  function openFromTemplate(tpl: Template) {
    setEditing(null);
    setForm({
      name: tpl.name,
      description: tpl.description,
      imageUrl: "",
      price: tpl.price,
      available: true,
      sortOrder: "0",
      steps: fromTemplate(tpl),
    });
    setView("editor");
  }

  function openBlank() {
    setEditing(null);
    setForm({ name: "", description: "", imageUrl: "", price: "", available: true, sortOrder: "0", steps: [newStep()] });
    setView("editor");
  }

  function openEdit(b: ProductBundle) {
    setEditing(b);
    setForm({
      name: b.name,
      description: b.description ?? "",
      imageUrl: b.imageUrl ?? "",
      price: b.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
      available: b.available,
      sortOrder: String(b.sortOrder),
      steps: b.steps.length ? b.steps : [newStep()],
    });
    setView("editor");
  }

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        imageUrl: form.imageUrl.trim() || null,
        price: parseMoney(form.price),
        available: form.available,
        sortOrder: parseInt(form.sortOrder) || 0,
        steps: form.steps,
      };
      if (editing) {
        await apiFetch(`/api/admin/bundles/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } else {
        await apiFetch(`/api/admin/${tenant.slug}/bundles`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }
      setView("list");
      await load();
    } finally { setSaving(false); }
  }

  async function remove(id: string) {
    setDeleting(id);
    try {
      await apiFetch(`/api/admin/bundles/${id}`, { method: "DELETE" });
      await load();
    } finally { setDeleting(null); }
  }

  async function toggleAvail(b: ProductBundle) {
    await apiFetch(`/api/admin/bundles/${b.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...b, available: !b.available, steps: b.steps }),
    });
    await load();
  }

  async function uploadImage(file: File) {
    setUploadingImg(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const r = await apiFetch("/api/upload", { method: "POST", body: fd });
      const d = await r.json();
      if (d.url) setForm(f => ({ ...f, imageUrl: d.url }));
    } finally { setUploadingImg(false); }
  }

  function updateStep(idx: number, patch: Partial<BundleStep>) {
    setForm(f => ({ ...f, steps: f.steps.map((s, i) => i === idx ? { ...s, ...patch } : s) }));
  }
  function addStep() { setForm(f => ({ ...f, steps: [...f.steps, newStep()] })); }
  function removeStep(idx: number) { setForm(f => ({ ...f, steps: f.steps.filter((_, i) => i !== idx) })); }
  function duplicateStep(idx: number) {
    setForm(f => {
      const copy = { ...f.steps[idx], id: crypto.randomUUID() };
      const steps = [...f.steps];
      steps.splice(idx + 1, 0, copy);
      return { ...f, steps };
    });
  }

  const allProducts = categories.flatMap(c => c.products.map(p => ({ ...p, categoryName: c.name })));

  // ── VIEW: LIST ─────────────────────────────────────────────────────────────
  if (view === "list") {
    return (
      <div className="space-y-6">
        {/* Header banner */}
        <div className="bg-[#0D1B3E] rounded-[28px] p-6 sm:p-8 text-white shadow-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 overflow-hidden relative">
          <div className="relative z-10">
            <h3 className="text-2xl sm:text-3xl font-black tracking-tight mb-1">Combos</h3>
            <p className="text-[#C9A227]/80 text-sm sm:text-base font-medium">
              Crie combos montáveis por etapas — pizzas, lanches, marmitas e mais.
            </p>
          </div>
          <Layers className="w-24 h-24 sm:w-28 sm:h-28 absolute -right-6 -bottom-6 text-[#C9A227]/15 rotate-12" />
          <button
            onClick={() => setView("new-choose")}
            className="relative z-10 shrink-0 flex items-center gap-2 px-5 py-3 bg-[#C9A227] hover:bg-[#b8911f] rounded-2xl text-white font-black text-sm shadow-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo combo
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: BRAND }} />
          </div>
        ) : bundles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center">
              <Layers className="w-10 h-10 text-slate-300" />
            </div>
            <div>
              <p className="font-black text-slate-600 text-lg">Nenhum combo criado</p>
              <p className="text-sm text-slate-400 mt-1">Use os modelos prontos para começar em segundos.</p>
            </div>
            <button onClick={() => setView("new-choose")} className="flex items-center gap-2 px-5 py-2.5 bg-[#C9A227] hover:bg-[#b8911f] text-white rounded-xl font-black text-sm transition-colors">
              <Sparkles className="w-4 h-4" />
              Escolher modelo
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {bundles.map((b) => (
              <div key={b.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:border-slate-300 transition-all">
                <div className="flex items-center gap-3 p-4">
                  {b.imageUrl ? (
                    <img src={b.imageUrl} alt={b.name} className="w-14 h-14 rounded-xl object-cover shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                      <Layers className="w-6 h-6 text-slate-300" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-black text-slate-900">{b.name}</h3>
                      <Badge color={b.available ? "success" : "default"} size="sm">{b.available ? "Ativo" : "Inativo"}</Badge>
                    </div>
                    {b.description && <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{b.description}</p>}
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-sm font-black" style={{ color: BRAND }}>{fmtCurrency(b.price)}</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{b.steps.length} etapa{b.steps.length !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Switch size="sm" checked={b.available} onCheckedChange={() => toggleAvail(b)} />
                    <Button size="xs" variant="ghost" onClick={() => openEdit(b)}><Edit2 className="w-3.5 h-3.5" /></Button>
                    <Button size="xs" variant="ghost" onClick={() => remove(b.id)} loading={deleting === b.id}><Trash2 className="w-3.5 h-3.5 text-red-400" /></Button>
                  </div>
                </div>
                {b.steps.length > 0 && (
                  <div className="px-4 pb-3 flex gap-1.5 flex-wrap border-t border-slate-50 pt-2.5">
                    {b.steps.map((s, i) => (
                      <div key={s.id} className="flex items-center gap-1 bg-slate-50 border border-slate-100 rounded-full px-2.5 py-1">
                        <span className="text-[9px] font-black text-slate-400">{i + 1}</span>
                        <span className="text-[11px] font-bold text-slate-600">{s.label || "Sem título"}</span>
                        {s.flavorMode === "half" && <span className="text-[9px] font-black text-amber-500 ml-0.5">½½</span>}
                        {!s.required && <span className="text-[9px] text-slate-400 ml-0.5">opt.</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── VIEW: NEW — CHOOSE ────────────────────────────────────────────────────
  if (view === "new-choose") {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setView("list")} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
            <ChevronRight className="w-5 h-5 text-slate-400 rotate-180" />
          </button>
          <div>
            <h2 className="text-lg font-black text-slate-900">Escolha um modelo</h2>
            <p className="text-xs text-slate-400 mt-0.5">Selecione um modelo pronto ou comece do zero</p>
          </div>
        </div>

        {/* Blank option */}
        <button
          onClick={openBlank}
          className="w-full flex items-center gap-4 p-5 bg-white border-2 border-dashed border-slate-200 rounded-2xl hover:border-[#C9A227] hover:bg-[#C9A227]/5 transition-all group text-left"
        >
          <div className="w-12 h-12 rounded-2xl bg-slate-100 group-hover:bg-[#C9A227]/10 flex items-center justify-center shrink-0 transition-colors">
            <Plus className="w-6 h-6 text-slate-400 group-hover:text-[#C9A227] transition-colors" />
          </div>
          <div>
            <p className="font-black text-slate-700 group-hover:text-[#0A1628] transition-colors">Começar do zero</p>
            <p className="text-xs text-slate-400 mt-0.5">Crie um combo completamente personalizado</p>
          </div>
        </button>

        {/* Category tabs */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Modelos prontos</p>
          <div className="flex gap-2 flex-wrap mb-4">
            {TEMPLATE_CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setTemplateCat(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                  templateCat === cat
                    ? "bg-[#0A1628] text-white"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {TEMPLATES.filter(t => t.category === templateCat).map(tpl => (
              <button
                key={tpl.id}
                onClick={() => openFromTemplate(tpl)}
                className="text-left p-5 bg-white border border-slate-200 rounded-2xl hover:border-[#C9A227]/60 hover:shadow-md transition-all group"
              >
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-3xl">{tpl.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-slate-800 text-sm group-hover:text-[#0A1628] leading-tight">{tpl.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{tpl.description}</p>
                  </div>
                  <span className="font-black text-sm shrink-0" style={{ color: BRAND }}>R$ {tpl.price}</span>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {tpl.steps.map((s, i) => (
                    <span key={i} className="text-[10px] font-bold px-2 py-0.5 bg-slate-50 border border-slate-100 rounded-full text-slate-500">
                      {s.qty > 1 ? `${s.qty}×` : ""}{s.label || `Etapa ${i+1}`}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-[#C9A227] opacity-0 group-hover:opacity-100 transition-opacity">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="text-xs font-black">Usar este modelo</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── VIEW: EDITOR ──────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-8">
      {/* Top bar */}
      <div className="flex items-center gap-3 sticky top-0 bg-[#F4F6FA] z-10 py-2 -mx-4 px-4 sm:-mx-7 sm:px-7">
        <button onClick={() => setView("list")} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
          <ChevronRight className="w-5 h-5 text-slate-400 rotate-180" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-400 font-bold">
            {editing ? "Editando combo" : "Novo combo"}
          </p>
          <p className="font-black text-slate-800 text-sm truncate">{form.name || "Sem título"}</p>
        </div>
        <button
          onClick={save}
          disabled={saving || !form.name.trim()}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#C9A227] hover:bg-[#b8911f] disabled:opacity-50 text-white rounded-xl font-black text-sm transition-all"
        >
          {saving ? <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : <Check className="w-4 h-4" />}
          {editing ? "Salvar" : "Criar combo"}
        </button>
      </div>

      {/* ── Dados básicos ── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dados do combo</p>

        {/* Image + name */}
        <div className="flex items-start gap-4">
          <div
            className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center cursor-pointer hover:border-amber-300 transition-colors overflow-hidden shrink-0"
            onClick={() => fileRef.current?.click()}
          >
            {form.imageUrl ? (
              <img src={form.imageUrl} className="w-full h-full object-cover" alt="combo" />
            ) : uploadingImg ? (
              <div className="w-5 h-5 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: BRAND }} />
            ) : (
              <ImageIcon className="w-6 h-6 text-slate-300" />
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) uploadImage(e.target.files[0]); }} />
          <div className="flex-1 space-y-3">
            <Input
              label="Nome do combo *"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ex: Combo 2 Pizzas + Refri"
            />
          </div>
        </div>

        <Input
          label="Descrição (opcional)"
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Ex: Economize R$ 15 no combo • 2 pizzas grandes + refri 2L"
        />

        {/* Price + order */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Preço total (R$)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">R$</span>
              <input
                type="text"
                inputMode="numeric"
                value={form.price}
                onChange={e => setForm(f => ({ ...f, price: maskMoney(e.target.value) }))}
                placeholder="0,00"
                className="w-full pl-9 pr-3 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#C9A227]/30 focus:border-[#C9A227] bg-white"
              />
            </div>
          </div>
          <Input
            label="Ordem de exibição"
            type="number"
            min="0"
            value={form.sortOrder}
            onChange={e => setForm(f => ({ ...f, sortOrder: e.target.value }))}
          />
        </div>

        {/* Toggle disponível */}
        <div className="flex items-center justify-between py-3 border-t border-slate-100">
          <div>
            <p className="text-sm font-bold text-slate-700">Disponível no cardápio</p>
            <p className="text-xs text-slate-400">Visível para os clientes</p>
          </div>
          <Switch checked={form.available} onCheckedChange={v => setForm(f => ({ ...f, available: v }))} />
        </div>
      </div>

      {/* ── Etapas ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-black text-slate-800">Etapas do combo</p>
            <p className="text-xs text-slate-400 mt-0.5">Cada etapa é uma escolha que o cliente faz</p>
          </div>
          <button
            onClick={addStep}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0A1628] hover:bg-[#1a2d4e] text-white text-xs font-black transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Etapa
          </button>
        </div>

        <AnimatePresence mode="popLayout">
          {form.steps.map((step, idx) => (
            <StepCard
              key={step.id}
              step={step}
              idx={idx}
              categories={categories}
              allProducts={allProducts}
              onUpdate={patch => updateStep(idx, patch)}
              onRemove={() => removeStep(idx)}
              onDuplicate={() => duplicateStep(idx)}
            />
          ))}
        </AnimatePresence>

        {form.steps.length === 0 && (
          <div
            className="flex flex-col items-center justify-center py-12 bg-white border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:border-[#C9A227] transition-colors"
            onClick={addStep}
          >
            <Layers className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-sm font-bold text-slate-400">Clique para adicionar a primeira etapa</p>
            <p className="text-xs text-slate-300 mt-0.5">Ex: "Escolha a pizza", "Escolha o refrigerante"</p>
          </div>
        )}

        {form.steps.length > 0 && (
          <button
            onClick={addStep}
            className="w-full py-3 border-2 border-dashed border-slate-200 rounded-2xl text-sm text-slate-400 font-bold hover:border-[#C9A227] hover:text-[#C9A227] transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Adicionar etapa
          </button>
        )}
      </div>
    </div>
  );
}

// ─── StepCard component ────────────────────────────────────────────────────

interface StepCardProps {
  step: BundleStep;
  idx: number;
  categories: Category[];
  allProducts: Array<{ id: string; name: string; imageUrl?: string | null; categoryName: string; categoryId: string; variants?: Array<{ id: string; name: string }> }>;
  onUpdate: (patch: Partial<BundleStep>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}

function StepCard({ step, idx, categories, allProducts, onUpdate, onRemove, onDuplicate }: StepCardProps) {
  const [expanded, setExpanded] = useState(true);

  const relevantProducts = allProducts.filter(p =>
    step.sourceType === "category"
      ? p.categoryId === step.categoryId
      : step.productIds?.includes(p.id)
  );

  const variantOptions = [...new Map(
    relevantProducts.flatMap(p => p.variants ?? []).map(v => [v.id, v])
  ).values()];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
    >
      {/* Step header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black text-white shrink-0" style={{ background: BRAND }}>
          {idx + 1}
        </div>
        <input
          value={step.label}
          onChange={e => onUpdate({ label: e.target.value })}
          placeholder={`Etapa ${idx + 1} — Ex: Escolha a pizza`}
          className="flex-1 text-sm font-bold text-slate-800 bg-transparent focus:outline-none placeholder:text-slate-300"
        />
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onDuplicate} title="Duplicar etapa" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setExpanded(v => !v)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "" : "-rotate-90"}`} />
          </button>
          <button onClick={onRemove} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Description */}
          <input
            value={step.description ?? ""}
            onChange={e => onUpdate({ description: e.target.value })}
            placeholder="Instrução para o cliente (ex: Escolha o sabor da pizza)"
            className="w-full text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#C9A227]/30 focus:border-[#C9A227]"
          />

          {/* Mode + Qty + Required row */}
          <div className="grid grid-cols-3 gap-3">
            {/* Flavor mode */}
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Modo de sabor</p>
              <div className="flex flex-col gap-1">
                {(["single", "half"] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => onUpdate({ flavorMode: mode })}
                    className={`py-2 rounded-xl text-[11px] font-black border-2 transition-all ${step.flavorMode === mode ? "text-white shadow-sm" : "border-slate-200 text-slate-500 bg-white"}`}
                    style={step.flavorMode === mode ? { background: BRAND, borderColor: BRAND } : {}}
                  >
                    {mode === "single" ? "1 sabor" : "½ a ½"}
                  </button>
                ))}
              </div>
            </div>

            {/* Qty */}
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Quantidade</p>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 flex flex-col items-center gap-1">
                <button onClick={() => onUpdate({ qty: step.qty + 1 })} className="w-full flex items-center justify-center h-7 rounded-lg hover:bg-slate-200 text-slate-600 font-black transition-colors text-lg leading-none">+</button>
                <span className="text-xl font-black text-slate-800">{step.qty}</span>
                <button onClick={() => onUpdate({ qty: Math.max(1, step.qty - 1) })} className="w-full flex items-center justify-center h-7 rounded-lg hover:bg-slate-200 text-slate-600 font-black transition-colors text-lg leading-none">−</button>
              </div>
            </div>

            {/* Required toggle */}
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Obrigatorio</p>
              <div className="flex flex-col gap-1">
                {[true, false].map(v => (
                  <button
                    key={String(v)}
                    onClick={() => onUpdate({ required: v })}
                    className={`py-2 rounded-xl text-[11px] font-black border-2 transition-all ${step.required === v ? "bg-[#0A1628] border-[#0A1628] text-white" : "border-slate-200 text-slate-500 bg-white"}`}
                  >
                    {v ? "Sim" : "Opcional"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Source type */}
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Fonte de produtos</p>
            <div className="flex gap-2 mb-3">
              {(["category", "products"] as const).map(src => (
                <button
                  key={src}
                  onClick={() => onUpdate({ sourceType: src })}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black border-2 transition-all ${step.sourceType === src ? "bg-[#0A1628] text-white border-[#0A1628]" : "border-slate-200 text-slate-500 bg-white"}`}
                >
                  {src === "category" ? "Por categoria" : "Seleção manual"}
                </button>
              ))}
            </div>

            {step.sourceType === "category" && (
              <div className="relative">
                <select
                  value={step.categoryId ?? ""}
                  onChange={e => onUpdate({ categoryId: e.target.value || undefined })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#C9A227]/30 focus:border-[#C9A227] appearance-none pr-8"
                >
                  <option value="">— Selecione uma categoria —</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.products.length} produto{c.products.length !== 1 ? "s" : ""})</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            )}

            {step.sourceType === "products" && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {allProducts.length === 0 && <p className="text-xs text-slate-400 text-center py-4">Nenhum produto cadastrado</p>}
                {allProducts.map(p => {
                  const checked = step.productIds?.includes(p.id) ?? false;
                  return (
                    <label
                      key={p.id}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition-all ${checked ? "border-amber-300 bg-amber-50" : "border-slate-100 bg-slate-50 hover:bg-slate-100"}`}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${checked ? "border-amber-400" : "border-slate-300"}`} style={checked ? { background: BRAND } : {}}>
                        {checked && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <input type="checkbox" className="hidden" checked={checked} onChange={() => {
                        const ids = step.productIds ?? [];
                        onUpdate({ productIds: checked ? ids.filter(id => id !== p.id) : [...ids, p.id] });
                      }} />
                      {p.imageUrl && <img src={p.imageUrl} className="w-8 h-8 rounded-lg object-cover shrink-0" alt={p.name} />}
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold text-slate-800 leading-snug truncate">{p.name}</p>
                        <p className="text-[10px] text-slate-400">{p.categoryName}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Variant filter — only if relevant products have variants */}
          {variantOptions.length > 0 && (
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Filtrar por variante (opcional)</p>
              <p className="text-[10px] text-slate-400 mb-2">Restringe esta etapa a somente uma variante (ex: "Grande", "Com borda")</p>
              <div className="relative">
                <select
                  value={step.variantId ?? ""}
                  onChange={e => onUpdate({ variantId: e.target.value || undefined })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#C9A227]/30 focus:border-[#C9A227] appearance-none pr-8"
                >
                  <option value="">Qualquer variante</option>
                  {variantOptions.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
