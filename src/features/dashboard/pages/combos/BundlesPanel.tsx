import React, { useState, useEffect, useRef } from "react";
import {
  Plus, Trash2, Edit2, X, Check, Image as ImageIcon,
  Layers, ChevronDown, Sparkles, Copy, ArrowLeft, FileText, ListOrdered,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button, IconButton, Input, Select, Switch, Badge, Tabs, PageWrapper, SectionTitle, ContentCard, EmptyState, useToast } from "../../../../components";
import { apiFetch } from "../../../../lib/api";
import type { Tenant, Category, ProductBundle, BundleStep } from "../../../../types";

type EditorTab = "dados" | "etapas";

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
  const toast = useToast();
  const [bundles, setBundles] = useState<ProductBundle[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "new-choose" | "editor">("list");
  const [editing, setEditing] = useState<ProductBundle | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [templateCat, setTemplateCat] = useState<string>(TEMPLATE_CATEGORIES[0]);
  const [editorTab, setEditorTab] = useState<EditorTab>("dados");
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
    setEditorTab("dados");
    setView("editor");
  }

  function openBlank() {
    setEditing(null);
    setForm({ name: "", description: "", imageUrl: "", price: "", available: true, sortOrder: "0", steps: [newStep()] });
    setEditorTab("dados");
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
    setEditorTab("dados");
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
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx. 5MB). Escolha um arquivo menor.");
      return;
    }
    setUploadingImg(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const r = await apiFetch("/api/upload", { method: "POST", body: fd });
      if (!r.ok) {
        if (r.status === 413) throw new Error("Imagem muito grande (máx. 5MB).");
        const d = await r.json().catch(() => null);
        throw new Error(d?.error || "Erro ao enviar imagem.");
      }
      const d = await r.json();
      if (d.url) setForm(f => ({ ...f, imageUrl: d.url }));
    } catch (err: any) {
      toast.error(err?.message || "Erro ao enviar imagem");
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

  const handleSave = () => {
    if (saving) return;
    if (!form.name.trim()) {
      setEditorTab("dados");
      toast.error("Informe o nome do combo.");
      return;
    }
    save();
  };

  // ── VIEW: LIST ─────────────────────────────────────────────────────────────
  if (view === "list") {
    return (
      <PageWrapper>
        <div className="space-y-4">
          <SectionTitle
            icon={Layers}
            title="Combos"
            description="Crie combos montáveis por etapas — pizzas, lanches, marmitas e mais."
            action={<Button size="sm" iconLeft={<Plus size={14} />} onClick={() => setView("new-choose")}>Novo combo</Button>}
          />

          {loading ? (
            <div role="status" className="flex justify-center py-16">
              <div className="w-6 h-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
            </div>
          ) : bundles.length === 0 ? (
            <ContentCard>
              <EmptyState
                icon={Layers}
                title="Nenhum combo criado"
                description="Use os modelos prontos para começar em segundos."
                action={<Button size="sm" iconLeft={<Sparkles size={14} />} onClick={() => setView("new-choose")}>Escolher modelo</Button>}
              />
            </ContentCard>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {bundles.map((b) => (
                <ContentCard key={b.id} padding="none" className="overflow-hidden hover:border-slate-300 transition-all">
                  <div className="flex items-center gap-3 p-3">
                    {b.imageUrl ? (
                      <img src={b.imageUrl} alt={b.name} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                        <Layers className="w-5 h-5 text-slate-300" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-medium text-slate-900">{b.name}</h3>
                        <Badge color={b.available ? "success" : "default"} size="sm">{b.available ? "Ativo" : "Inativo"}</Badge>
                      </div>
                      {b.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{b.description}</p>}
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs font-semibold text-blue-700">{fmtCurrency(b.price)}</span>
                        <span className="text-[11px] text-slate-500">{b.steps.length} etapa{b.steps.length !== 1 ? "s" : ""}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Switch size="sm" aria-label="Disponível no cardápio" checked={b.available} onCheckedChange={() => toggleAvail(b)} />
                      <IconButton size="xs" variant="ghost" aria-label="Editar combo" onClick={() => openEdit(b)}><Edit2 size={14} /></IconButton>
                      <IconButton size="xs" variant="ghost" aria-label="Remover combo" onClick={() => remove(b.id)} loading={deleting === b.id}><Trash2 size={14} className="text-red-600" /></IconButton>
                    </div>
                  </div>
                  {b.steps.length > 0 && (
                    <div className="px-3 pb-3 flex gap-1.5 flex-wrap border-t border-slate-50 pt-2">
                      {b.steps.map((s, i) => (
                        <div key={s.id} className="flex items-center gap-1 bg-slate-50 border border-slate-100 rounded-full px-2.5 py-1">
                          <span className="text-[11px] font-medium text-slate-500">{i + 1}</span>
                          <span className="text-[11px] font-medium text-slate-600">{s.label || "Sem título"}</span>
                          {s.flavorMode === "half" && <span className="text-[11px] font-medium text-blue-600 ml-0.5">½½</span>}
                          {!s.required && <span className="text-[11px] text-slate-500 ml-0.5">opt.</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </ContentCard>
              ))}
            </div>
          )}
        </div>
      </PageWrapper>
    );
  }

  // ── VIEW: NEW — CHOOSE ────────────────────────────────────────────────────
  if (view === "new-choose") {
    const templateTabs = TEMPLATE_CATEGORIES.map(cat => ({ id: cat, label: cat, icon: Sparkles }));
    return (
      <PageWrapper>
        <div className="space-y-4">
          <Button type="button" variant="ghost" size="sm" iconLeft={<ArrowLeft size={14} />} onClick={() => setView("list")}>Voltar</Button>
          <SectionTitle icon={Layers} title="Escolha um modelo" description="Selecione um modelo pronto ou comece do zero" />

          <button
            onClick={openBlank}
            className="w-full flex items-center gap-3 p-3 bg-white border-2 border-dashed border-slate-200 rounded-lg hover:border-blue-400 hover:bg-blue-50/40 transition-all group text-left"
          >
            <div className="w-10 h-10 rounded-lg bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center shrink-0 transition-colors">
              <Plus className="w-5 h-5 text-slate-500 group-hover:text-blue-600 transition-colors" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">Começar do zero</p>
              <p className="text-xs text-slate-500 mt-0.5">Crie um combo completamente personalizado</p>
            </div>
          </button>

          <Tabs<string> items={templateTabs} value={templateCat} onChange={setTemplateCat} label="Categorias de modelos">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {TEMPLATES.filter(t => t.category === templateCat).map(tpl => (
                <button
                  key={tpl.id}
                  onClick={() => openFromTemplate(tpl)}
                  className="text-left p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-300 transition-all group"
                >
                  <div className="flex items-start gap-3 mb-2">
                    <span className="text-2xl">{tpl.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-800 text-sm leading-tight">{tpl.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{tpl.description}</p>
                    </div>
                    <span className="font-semibold text-xs shrink-0 text-blue-700">R$ {tpl.price}</span>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {tpl.steps.map((s, i) => (
                      <span key={i} className="text-[11px] px-2 py-0.5 bg-slate-50 border border-slate-100 rounded-full text-slate-500">
                        {s.qty > 1 ? `${s.qty}×` : ""}{s.label || `Etapa ${i+1}`}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">Usar este modelo</span>
                  </div>
                </button>
              ))}
            </div>
          </Tabs>
        </div>
      </PageWrapper>
    );
  }

  // ── VIEW: EDITOR ──────────────────────────────────────────────────────────
  return (
    <PageWrapper>
      <div className="space-y-4">
        <Button type="button" variant="ghost" size="sm" iconLeft={<ArrowLeft size={14} />} onClick={() => setView("list")}>Voltar</Button>
        <SectionTitle
          icon={Layers}
          title={editing ? "Editar combo" : "Novo combo"}
          description={form.name || "Sem título"}
        />

        <ContentCard padding="md">
          <Tabs<EditorTab>
            items={[
              { id: "dados", label: "Dados", icon: FileText },
              { id: "etapas", label: "Etapas", icon: ListOrdered, badge: form.steps.length },
            ]}
            value={editorTab}
            onChange={setEditorTab}
            label="Dados do combo"
          >
            {editorTab === "dados" && (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div
                    className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center cursor-pointer hover:border-blue-400 transition-colors overflow-hidden shrink-0"
                    onClick={() => fileRef.current?.click()}
                  >
                    {form.imageUrl ? (
                      <img src={form.imageUrl} className="w-full h-full object-cover" alt="combo" />
                    ) : uploadingImg ? (
                      <div className="w-5 h-5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-slate-300" />
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) uploadImage(e.target.files[0]); }} />
                  <div className="flex-1 min-w-0">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Preço total (R$)"
                    type="text"
                    inputMode="numeric"
                    addonLeft="R$"
                    value={form.price}
                    onChange={e => setForm(f => ({ ...f, price: maskMoney(e.target.value) }))}
                    placeholder="0,00"
                  />
                  <Input
                    label="Ordem de exibição"
                    type="number"
                    min="0"
                    value={form.sortOrder}
                    onChange={e => setForm(f => ({ ...f, sortOrder: e.target.value }))}
                  />
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <div>
                    <p className="text-xs font-medium text-slate-700">Disponível no cardápio</p>
                    <p className="text-[11px] text-slate-500">Visível para os clientes</p>
                  </div>
                  <Switch aria-label="Disponível no cardápio" checked={form.available} onCheckedChange={v => setForm(f => ({ ...f, available: v }))} />
                </div>
              </div>
            )}

            {editorTab === "etapas" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-800">Etapas do combo</p>
                    <p className="text-[11px] text-slate-500">Cada etapa é uma escolha que o cliente faz</p>
                  </div>
                  <Button size="sm" iconLeft={<Plus size={14} />} onClick={addStep}>Etapa</Button>
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
                    className="flex flex-col items-center justify-center py-10 bg-white border-2 border-dashed border-slate-200 rounded-lg cursor-pointer hover:border-blue-400 transition-colors"
                    onClick={addStep}
                  >
                    <Layers className="w-8 h-8 text-slate-300 mb-2" />
                    <p className="text-xs font-medium text-slate-500">Clique para adicionar a primeira etapa</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Ex: "Escolha a pizza", "Escolha o refrigerante"</p>
                  </div>
                )}

                {form.steps.length > 0 && (
                  <Button variant="outline" fullWidth iconLeft={<Plus size={14} />} onClick={addStep}>Adicionar etapa</Button>
                )}
              </div>
            )}
          </Tabs>
        </ContentCard>

        <div className="sticky bottom-0 z-10 flex flex-wrap justify-end gap-2 rounded-lg border border-slate-200 bg-white p-3">
          <Button variant="secondary" onClick={() => setView("list")} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} loading={saving} disabled={saving} iconLeft={<Check size={14} />}>
            {saving ? "Salvando..." : editing ? "Salvar" : "Criar combo"}
          </Button>
        </div>
      </div>
    </PageWrapper>
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
      className="bg-white rounded-lg border border-slate-200 overflow-hidden"
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 bg-slate-50/50">
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold text-white bg-blue-600 shrink-0">
          {idx + 1}
        </div>
        <Input
          aria-label={`Título da etapa ${idx + 1}`}
          wrapperClassName="flex-1 min-w-0"
          value={step.label}
          onChange={e => onUpdate({ label: e.target.value })}
          placeholder={`Etapa ${idx + 1} — Ex: Escolha a pizza`}
        />
        <div className="flex items-center gap-1 shrink-0">
          <IconButton size="xs" variant="ghost" onClick={onDuplicate} title="Duplicar etapa" aria-label="Duplicar etapa"><Copy size={14} /></IconButton>
          <IconButton size="xs" variant="ghost" onClick={() => setExpanded(v => !v)} aria-label={expanded ? "Recolher etapa" : "Expandir etapa"}>
            <ChevronDown size={14} className={`transition-transform ${expanded ? "" : "-rotate-90"}`} />
          </IconButton>
          <IconButton size="xs" variant="ghost" onClick={onRemove} aria-label="Remover etapa"><X size={14} className="text-red-600" /></IconButton>
        </div>
      </div>

      {expanded && (
        <div className="p-3 space-y-3">
          <Input
            aria-label="Instrução para o cliente"
            value={step.description ?? ""}
            onChange={e => onUpdate({ description: e.target.value })}
            placeholder="Instrução para o cliente (ex: Escolha o sabor da pizza)"
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <p className="text-xs font-medium text-slate-600 mb-1">Modo de sabor</p>
              <div className="flex gap-1">
                {(["single", "half"] as const).map(mode => (
                  <Button key={mode} size="sm" className="flex-1" variant={step.flavorMode === mode ? "primary" : "outline"} onClick={() => onUpdate({ flavorMode: mode })}>
                    {mode === "single" ? "1 sabor" : "½ a ½"}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-600 mb-1">Quantidade</p>
              <div className="flex items-center gap-1">
                <IconButton size="sm" variant="outline" aria-label="Diminuir quantidade" onClick={() => onUpdate({ qty: Math.max(1, step.qty - 1) })}>−</IconButton>
                <span className="flex-1 text-center text-sm font-semibold text-slate-800">{step.qty}</span>
                <IconButton size="sm" variant="outline" aria-label="Aumentar quantidade" onClick={() => onUpdate({ qty: step.qty + 1 })}>+</IconButton>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-600 mb-1">Obrigatório</p>
              <div className="flex gap-1">
                {[true, false].map(v => (
                  <Button key={String(v)} size="sm" className="flex-1" variant={step.required === v ? "primary" : "outline"} onClick={() => onUpdate({ required: v })}>
                    {v ? "Sim" : "Opcional"}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-600">Fonte de produtos</p>
            <div className="flex gap-1">
              {(["category", "products"] as const).map(src => (
                <Button key={src} size="sm" className="flex-1" variant={step.sourceType === src ? "primary" : "outline"} onClick={() => onUpdate({ sourceType: src })}>
                  {src === "category" ? "Por categoria" : "Seleção manual"}
                </Button>
              ))}
            </div>

            {step.sourceType === "category" && (
              <Select
                aria-label="Categoria"
                value={step.categoryId ?? ""}
                onChange={e => onUpdate({ categoryId: e.target.value || undefined })}
              >
                <option value="">— Selecione uma categoria —</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.products.length} produto{c.products.length !== 1 ? "s" : ""})</option>
                ))}
              </Select>
            )}

            {step.sourceType === "products" && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {allProducts.length === 0 && <p className="text-xs text-slate-500 text-center py-4">Nenhum produto cadastrado</p>}
                {allProducts.map(p => {
                  const checked = step.productIds?.includes(p.id) ?? false;
                  return (
                    <label
                      key={p.id}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-all ${checked ? "border-blue-300 bg-blue-50" : "border-slate-100 bg-slate-50 hover:bg-slate-100"}`}
                    >
                      <input type="checkbox" className="h-4 w-4 accent-blue-600" checked={checked} onChange={() => {
                        const ids = step.productIds ?? [];
                        onUpdate({ productIds: checked ? ids.filter(id => id !== p.id) : [...ids, p.id] });
                      }} />
                      {p.imageUrl && <img src={p.imageUrl} className="w-8 h-8 rounded-lg object-cover shrink-0" alt={p.name} />}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-800 leading-snug truncate">{p.name}</p>
                        <p className="text-[11px] text-slate-500">{p.categoryName}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {variantOptions.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-600">Filtrar por variante (opcional)</p>
              <p className="text-[11px] text-slate-500 mb-1.5">Restringe esta etapa a somente uma variante (ex: "Grande", "Com borda")</p>
              <Select
                aria-label="Variante"
                value={step.variantId ?? ""}
                onChange={e => onUpdate({ variantId: e.target.value || undefined })}
              >
                <option value="">Qualquer variante</option>
                {variantOptions.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </Select>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
