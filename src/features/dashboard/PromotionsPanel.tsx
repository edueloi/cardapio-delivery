import React, { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Edit2, Image as ImageIcon, Star, ToggleLeft, ToggleRight, GripVertical, X, Check, ExternalLink } from "lucide-react";
import { apiFetch, apiJson } from "../../lib/api";
import type { Tenant, Product } from "../../types";

interface Promotion {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  linkProductId?: string;
  active: boolean;
  sortOrder: number;
  startsAt?: string;
  endsAt?: string;
  product?: { id: string; name: string; price: number; imageUrl?: string };
}

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

interface Props {
  tenant: Tenant;
  refresh?: () => void;
}

const emptyForm = {
  title: "",
  description: "",
  imageUrl: "",
  linkProductId: "",
  active: true,
  startsAt: "",
  endsAt: "",
};

export default function PromotionsPanel({ tenant }: Props) {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/admin/${tenant.id}/promotions`).then(r => r.json());
      setPromotions(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tenant.id]);

  useEffect(() => {
    // Load all products for linking
    apiFetch(`/api/tenants/${tenant.slug}`)
      .then(r => r.json())
      .then(data => {
        const allProducts: Product[] = (data.categories || []).flatMap((c: any) => c.products || []);
        setProducts(allProducts);
      });
  }, [tenant.slug]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (p: Promotion) => {
    setEditing(p);
    setForm({
      title: p.title,
      description: p.description || "",
      imageUrl: p.imageUrl || "",
      linkProductId: p.linkProductId || "",
      active: p.active,
      startsAt: p.startsAt ? p.startsAt.slice(0, 16) : "",
      endsAt: p.endsAt ? p.endsAt.slice(0, 16) : "",
    });
    setShowForm(true);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiFetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      setForm(f => ({ ...f, imageUrl: data.url }));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description || null,
        imageUrl: form.imageUrl || null,
        linkProductId: form.linkProductId || null,
        active: form.active,
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
        sortOrder: editing ? editing.sortOrder : promotions.length,
      };
      if (editing) {
        await apiJson(`/api/admin/promotions/${editing.id}`, { method: "PATCH", body: JSON.stringify(payload), headers: { "Content-Type": "application/json" } });
      } else {
        await apiJson(`/api/admin/${tenant.id}/promotions`, { method: "POST", body: JSON.stringify(payload), headers: { "Content-Type": "application/json" } });
      }
      setShowForm(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover essa promoção?")) return;
    await apiJson(`/api/admin/promotions/${id}`, { method: "DELETE" });
    await load();
  };

  const handleToggle = async (p: Promotion) => {
    await apiJson(`/api/admin/promotions/${p.id}`, { method: "PATCH", body: JSON.stringify({ active: !p.active }), headers: { "Content-Type": "application/json" } });
    await load();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#0D1B3E] to-[#1a2d5a] rounded-3xl p-6 sm:p-8 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 overflow-hidden relative">
        <div className="relative z-10">
          <h3 className="text-2xl sm:text-3xl font-black tracking-tight mb-1">Promoções & Banners</h3>
          <p className="text-[#C9A227]/80 font-medium text-sm">
            Crie banners com imagem completa que aparecem no carrossel do cardápio.
          </p>
        </div>
        <Star className="w-24 h-24 absolute -right-4 -bottom-4 text-[#C9A227]/10 rotate-12" />
        <button
          onClick={openCreate}
          className="relative z-10 flex items-center gap-2 bg-[#C9A227] hover:bg-amber-400 text-black font-black px-5 py-3 rounded-2xl transition-all active:scale-95 text-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          Nova Promoção
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400 text-sm">Carregando...</div>
      ) : promotions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
          <Star className="w-12 h-12 text-slate-200" />
          <div className="text-center">
            <p className="font-bold text-slate-600">Nenhuma promoção criada</p>
            <p className="text-sm mt-1">Crie banners para destacar itens no cardápio</p>
          </div>
          <button onClick={openCreate} className="mt-2 flex items-center gap-2 bg-[#C9A227] text-black font-black px-5 py-2.5 rounded-xl text-sm hover:bg-amber-400 transition-all">
            <Plus className="w-4 h-4" /> Criar primeira promoção
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {promotions.map(p => (
            <div key={p.id} className={`bg-white rounded-2xl shadow-sm border overflow-hidden transition-all ${p.active ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
              {/* Banner Image */}
              <div className="relative w-full aspect-[16/7] bg-slate-100 overflow-hidden">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-10 h-10 text-slate-300" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-3 right-3">
                  <p className="text-white font-bold text-sm leading-tight line-clamp-1">{p.title}</p>
                  {p.product && (
                    <p className="text-amber-400 text-xs font-black mt-0.5">{fmt(p.product.price)}</p>
                  )}
                </div>
                <div className="absolute top-2 right-2">
                  <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${p.active ? 'bg-green-500 text-white' : 'bg-slate-400 text-white'}`}>
                    {p.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="p-4 space-y-3">
                {p.description && (
                  <p className="text-slate-500 text-xs line-clamp-2">{p.description}</p>
                )}
                {p.product && (
                  <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
                    {p.product.imageUrl && <img src={p.product.imageUrl} className="w-6 h-6 rounded-lg object-cover" />}
                    <span className="text-xs font-semibold text-slate-600">{p.product.name}</span>
                    <span className="text-xs text-amber-600 font-black ml-auto">{fmt(p.product.price)}</span>
                  </div>
                )}
                {(p.startsAt || p.endsAt) && (
                  <p className="text-[10px] text-slate-400">
                    {p.startsAt ? `De ${new Date(p.startsAt).toLocaleDateString('pt-BR')}` : ''}
                    {p.endsAt ? ` até ${new Date(p.endsAt).toLocaleDateString('pt-BR')}` : ''}
                  </p>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => handleToggle(p)}
                    title={p.active ? "Desativar" : "Ativar"}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${p.active ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                  >
                    {p.active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                    {p.active ? 'Ativo' : 'Inativo'}
                  </button>
                  <button
                    onClick={() => openEdit(p)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Editar
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="ml-auto p-1.5 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white px-6 py-5 border-b border-slate-100 flex items-center justify-between rounded-t-3xl">
              <h3 className="text-lg font-black text-slate-800">
                {editing ? "Editar Promoção" : "Nova Promoção"}
              </h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Image Upload */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500">Imagem do Banner</label>
                <div
                  className="relative w-full aspect-[16/7] bg-slate-100 rounded-2xl overflow-hidden cursor-pointer group border-2 border-dashed border-slate-200 hover:border-amber-400 transition-all"
                  onClick={() => fileRef.current?.click()}
                >
                  {form.imageUrl ? (
                    <>
                      <img src={form.imageUrl} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                        <span className="text-white text-xs font-bold">Trocar imagem</span>
                      </div>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400">
                      {uploadingImage ? (
                        <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <ImageIcon className="w-8 h-8" />
                          <span className="text-xs font-medium">Clique para fazer upload da imagem</span>
                          <span className="text-[10px] text-slate-300">Recomendado: 1200×500px</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                {form.imageUrl && (
                  <div className="flex items-center gap-2">
                    <input
                      value={form.imageUrl}
                      onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))}
                      placeholder="Ou cole a URL da imagem"
                      className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 text-slate-600 focus:outline-none focus:border-amber-400"
                    />
                    <button onClick={() => setForm(f => ({ ...f, imageUrl: "" }))} className="text-slate-400 hover:text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Title */}
              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500">Título *</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Ex: Combo Especial do Dia"
                  className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-700 focus:outline-none focus:border-amber-400 transition-all"
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500">Descrição</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Texto que aparece no banner..."
                  rows={2}
                  className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-700 focus:outline-none focus:border-amber-400 transition-all resize-none"
                />
              </div>

              {/* Link Product */}
              <div className="space-y-1">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500">Vincular a um Produto (opcional)</label>
                <select
                  value={form.linkProductId}
                  onChange={e => setForm(f => ({ ...f, linkProductId: e.target.value }))}
                  className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-700 focus:outline-none focus:border-amber-400 bg-white transition-all"
                >
                  <option value="">— Nenhum produto —</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} — {fmt(p.price)}</option>
                  ))}
                </select>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500">Início (opcional)</label>
                  <input
                    type="datetime-local"
                    value={form.startsAt}
                    onChange={e => setForm(f => ({ ...f, startsAt: e.target.value }))}
                    className="w-full border border-slate-200 rounded-2xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-500">Fim (opcional)</label>
                  <input
                    type="datetime-local"
                    value={form.endsAt}
                    onChange={e => setForm(f => ({ ...f, endsAt: e.target.value }))}
                    className="w-full border border-slate-200 rounded-2xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Active Toggle */}
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setForm(f => ({ ...f, active: !f.active }))}
                  className={`w-12 h-6 rounded-full transition-all relative ${form.active ? 'bg-green-500' : 'bg-slate-200'}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${form.active ? 'left-6' : 'left-0.5'}`} />
                </div>
                <span className="text-sm font-semibold text-slate-700">{form.active ? 'Promoção ativa (visível no cardápio)' : 'Promoção inativa (oculta)'}</span>
              </label>
            </div>

            <div className="sticky bottom-0 bg-white px-6 py-4 border-t border-slate-100 flex gap-3 rounded-b-3xl">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-3 rounded-2xl border border-slate-200 text-slate-500 font-bold text-sm hover:bg-slate-50 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.title.trim()}
                className="flex-1 py-3 rounded-2xl bg-[#C9A227] hover:bg-amber-400 text-black font-black text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                {editing ? "Salvar alterações" : "Criar promoção"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
