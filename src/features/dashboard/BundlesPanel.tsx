import React, { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Edit2, Package, X, ChevronDown, ChevronUp, GripVertical, Check, Image as ImageIcon, Layers } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button, Modal, ModalFooter, Input, Switch, Badge } from "../../components";
import { apiFetch } from "../../lib/api";
import type { Tenant, Category, ProductBundle, BundleStep } from "../../types";

const BRAND = "#C9A227";
const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

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

interface Props { tenant: Tenant; }

export default function BundlesPanel({ tenant }: Props) {
  const [bundles, setBundles] = useState<ProductBundle[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ProductBundle | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [uploadingImg, setUploadingImg] = useState(false);
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

  function openCreate() {
    setEditing(null);
    setForm({ name: "", description: "", imageUrl: "", price: "", available: true, sortOrder: "0", steps: [newStep()] });
    setModalOpen(true);
  }

  function openEdit(b: ProductBundle) {
    setEditing(b);
    setForm({
      name: b.name,
      description: b.description ?? "",
      imageUrl: b.imageUrl ?? "",
      price: String(b.price),
      available: b.available,
      sortOrder: String(b.sortOrder),
      steps: b.steps.length ? b.steps : [newStep()],
    });
    setModalOpen(true);
  }

  async function save() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        imageUrl: form.imageUrl.trim() || null,
        price: parseFloat(form.price) || 0,
        available: form.available,
        sortOrder: parseInt(form.sortOrder) || 0,
        steps: form.steps,
      };
      if (editing) {
        await apiFetch(`/api/admin/bundles/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } else {
        await apiFetch(`/api/admin/${tenant.slug}/bundles`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      }
      setModalOpen(false);
      await load();
    } finally { setSaving(false); }
  }

  async function remove(id: string) {
    if (!confirm("Remover este combo?")) return;
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

  // ── Step helpers ───────────────────────────────────────────────────────────
  function updateStep(idx: number, patch: Partial<BundleStep>) {
    setForm(f => ({ ...f, steps: f.steps.map((s, i) => i === idx ? { ...s, ...patch } : s) }));
  }
  function addStep() { setForm(f => ({ ...f, steps: [...f.steps, newStep()] })); }
  function removeStep(idx: number) { setForm(f => ({ ...f, steps: f.steps.filter((_, i) => i !== idx) })); }

  // ── All products flat list for "manual" step source ────────────────────────
  const allProducts = categories.flatMap(c => c.products.map(p => ({ ...p, categoryName: c.name })));

  return (
    <div className="p-4 lg:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-black text-slate-900">Combos</h2>
          <p className="text-xs text-slate-400 mt-0.5">Crie combos montáveis por etapas</p>
        </div>
        <Button size="sm" variant="primary" iconLeft={<Plus className="w-3.5 h-3.5" />} onClick={openCreate}>
          Novo combo
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: BRAND }} />
        </div>
      ) : bundles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
            <Package className="w-7 h-7 text-slate-200" />
          </div>
          <p className="text-sm font-bold text-slate-500">Nenhum combo criado</p>
          <p className="text-xs text-slate-400 mt-1">Crie combos como "2 pizzas + refri"</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {bundles.map((b) => (
            <motion.div
              key={b.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
            >
              <div className="flex items-center gap-3 p-4">
                {/* Image or icon */}
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
                    <Badge color={b.available ? "success" : "default"} size="sm">
                      {b.available ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  {b.description && <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{b.description}</p>}
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-sm font-black" style={{ color: BRAND }}>{fmt(b.price)}</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{b.steps.length} etapa{b.steps.length !== 1 ? "s" : ""}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Switch
                    size="sm"
                    checked={b.available}
                    onCheckedChange={() => toggleAvail(b)}
                  />
                  <Button size="xs" variant="ghost" onClick={() => openEdit(b)}>
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => remove(b.id)} loading={deleting === b.id}>
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </Button>
                </div>
              </div>

              {/* Steps preview */}
              {b.steps.length > 0 && (
                <div className="px-4 pb-3 flex gap-1.5 flex-wrap">
                  {b.steps.map((s, i) => (
                    <div key={s.id} className="flex items-center gap-1 bg-slate-50 border border-slate-100 rounded-full px-2.5 py-1">
                      <span className="text-[9px] font-black text-slate-400">{i + 1}</span>
                      <span className="text-[11px] font-bold text-slate-600">{s.label || "Sem título"}</span>
                      {s.flavorMode === "half" && <span className="text-[9px] font-black text-amber-500 ml-0.5">½½</span>}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* ── MODAL ─────────────────────────────────────────────────────────────── */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Editar Combo" : "Novo Combo"}
        size="lg"
        mobileStyle="bottom-sheet"
        footer={
          <ModalFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button variant="primary" onClick={save} loading={saving} disabled={!form.name.trim()}>
              {editing ? "Salvar" : "Criar combo"}
            </Button>
          </ModalFooter>
        }
      >
        <div className="space-y-4 py-1">
          {/* Image */}
          <div className="flex items-center gap-4">
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
                label="Nome do combo"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Combo 2 Pizzas + Refri"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Preço total (R$)"
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
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

          <Input
            label="Descrição (opcional)"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Ex: Economize R$ 15 no combo"
          />

          <div className="flex items-center justify-between py-2 border-y border-slate-100">
            <div>
              <p className="text-sm font-bold text-slate-700">Disponível no cardápio</p>
              <p className="text-xs text-slate-400">Visível para os clientes</p>
            </div>
            <Switch checked={form.available} onCheckedChange={v => setForm(f => ({ ...f, available: v }))} />
          </div>

          {/* Steps */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Etapas do combo</p>
              <Button size="xs" variant="outline" iconLeft={<Plus className="w-3 h-3" />} onClick={addStep}>
                Etapa
              </Button>
            </div>

            <AnimatePresence mode="popLayout">
              {form.steps.map((step, idx) => (
                <motion.div
                  key={step.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-slate-50 rounded-2xl border border-slate-100 p-4 space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0" style={{ background: BRAND }}>
                      {idx + 1}
                    </div>
                    <Input
                      value={step.label}
                      onChange={e => updateStep(idx, { label: e.target.value })}
                      placeholder="Ex: Escolha a pizza grande"
                      className="flex-1"
                    />
                    <button onClick={() => removeStep(idx)} className="w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-red-400 transition-colors shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Step options row */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Sabor mode */}
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Modo</p>
                      <div className="flex gap-1.5">
                        {(["single", "half"] as const).map(mode => (
                          <button
                            key={mode}
                            onClick={() => updateStep(idx, { flavorMode: mode })}
                            className={`flex-1 py-2 rounded-xl text-[11px] font-black border-2 transition-all ${step.flavorMode === mode ? "text-white shadow" : "border-slate-200 text-slate-500 bg-white"}`}
                            style={step.flavorMode === mode ? { background: BRAND, borderColor: BRAND } : {}}
                          >
                            {mode === "single" ? "1 sabor" : "Meio a Meio"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Qty */}
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Quantidade</p>
                      <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
                        <button onClick={() => updateStep(idx, { qty: Math.max(1, step.qty - 1) })} className="text-slate-400 hover:text-slate-700 font-black">−</button>
                        <span className="flex-1 text-center text-sm font-black text-slate-800">{step.qty}</span>
                        <button onClick={() => updateStep(idx, { qty: step.qty + 1 })} className="text-slate-400 hover:text-slate-700 font-black">+</button>
                      </div>
                    </div>
                  </div>

                  {/* Source */}
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Produtos desta etapa</p>
                    <div className="flex gap-1.5 mb-2">
                      {(["category", "products"] as const).map(src => (
                        <button
                          key={src}
                          onClick={() => updateStep(idx, { sourceType: src })}
                          className={`flex-1 py-2 rounded-xl text-[11px] font-black border-2 transition-all ${step.sourceType === src ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 text-slate-500 bg-white"}`}
                        >
                          {src === "category" ? "Por categoria" : "Lista manual"}
                        </button>
                      ))}
                    </div>

                    {step.sourceType === "category" && (
                      <select
                        value={step.categoryId ?? ""}
                        onChange={e => updateStep(idx, { categoryId: e.target.value || undefined })}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:border-amber-300"
                      >
                        <option value="">Selecione uma categoria</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({c.products.length} produtos)</option>
                        ))}
                      </select>
                    )}

                    {step.sourceType === "products" && (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {allProducts.map(p => {
                          const checked = step.productIds?.includes(p.id) ?? false;
                          return (
                            <label key={p.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition-all ${checked ? "border-amber-300 bg-amber-50" : "border-slate-100 bg-white"}`}>
                              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${checked ? "border-amber-400" : "border-slate-300"}`} style={checked ? { background: BRAND } : {}}>
                                {checked && <Check className="w-2.5 h-2.5 text-white" />}
                              </div>
                              <input type="checkbox" className="hidden" checked={checked} onChange={() => {
                                const ids = step.productIds ?? [];
                                updateStep(idx, { productIds: checked ? ids.filter(id => id !== p.id) : [...ids, p.id] });
                              }} />
                              {p.imageUrl && <img src={p.imageUrl} className="w-8 h-8 rounded-lg object-cover shrink-0" alt={p.name} />}
                              <div className="flex-1 min-w-0">
                                <p className="text-[12px] font-bold text-slate-800 leading-snug">{p.name}</p>
                                <p className="text-[10px] text-slate-400">{p.categoryName}</p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Variant filter */}
                  {categories.flatMap(c => c.products).some(p =>
                    (step.sourceType === "category" ? p.categoryId === step.categoryId : step.productIds?.includes(p.id)) && p.variants?.length
                  ) && (
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Variante obrigatória (opcional)</p>
                      <select
                        value={step.variantId ?? ""}
                        onChange={e => updateStep(idx, { variantId: e.target.value || undefined })}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:border-amber-300"
                      >
                        <option value="">Qualquer variante</option>
                        {[...new Map(
                          categories.flatMap(c => c.products)
                            .filter(p => step.sourceType === "category" ? p.categoryId === step.categoryId : step.productIds?.includes(p.id))
                            .flatMap(p => p.variants ?? [])
                            .map(v => [v.id, v])
                        ).values()].map(v => (
                          <option key={v.id} value={v.id}>{v.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {form.steps.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <Layers className="w-6 h-6 text-slate-300 mb-2" />
                <p className="text-xs text-slate-400 font-bold">Nenhuma etapa ainda</p>
                <p className="text-[11px] text-slate-300 mt-0.5">Adicione etapas como "Escolha a pizza", "Escolha o refri"</p>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
