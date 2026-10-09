import React, { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Edit2, Image as ImageIcon, Star, Check, FileText, Tag, CalendarClock } from "lucide-react";
import { apiFetch, apiJson } from "../../../../lib/api";
import { ConfirmModal, useToast, DatePicker, PageWrapper, SectionTitle, ContentCard, Button, IconButton, Input, Textarea, Select, Switch, Badge, EmptyState, Modal, ModalFooter, Tabs } from "../../../../components";
import type { Tenant, Product } from "../../../../types";

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
  promoPrice?: number | null;
  product?: { id: string; name: string; price: number; imageUrl?: string };
}

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

interface Props {
  tenant: Tenant;
  refresh?: () => void;
}

const formTabs = [
  { id: "geral", label: "Geral", icon: FileText },
  { id: "imagem", label: "Imagem", icon: ImageIcon },
  { id: "produto", label: "Produto e preço", icon: Tag },
  { id: "periodo", label: "Período", icon: CalendarClock },
] as const;
type FormTab = typeof formTabs[number]["id"];

const emptyForm = {
  title: "",
  description: "",
  imageUrl: "",
  linkProductId: "",
  promoPrice: "",
  active: true,
  startDate: "",
  startTime: "",
  endDate: "",
  endTime: "",
};

const fromISO = (iso?: string | null) => {
  if (!iso) return { d: "", t: "" };
  const date = new Date(iso);
  if (isNaN(date.getTime())) return { d: "", t: "" };
  const d = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const t = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return { d, t };
};

const toISO = (d?: string, t?: string) => {
  if (!d) return null;
  const timeStr = t || "00:00";
  const [year, month, day] = d.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  const date = new Date(year, month - 1, day, hour, minute);
  return date.toISOString();
};

export default function PromotionsPanel({ tenant }: Props) {
  const toast = useToast();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [formTab, setFormTab] = useState<FormTab>("geral");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/admin/${tenant.id}/promotions`).then(r => r.json());
      setPromotions(Array.isArray(data) ? data : []);
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
    setFormTab("geral");
    setShowForm(true);
  };

  const openEdit = (p: Promotion) => {
    setEditing(p);
    setForm({
      title: p.title,
      description: p.description || "",
      imageUrl: p.imageUrl || "",
      linkProductId: p.linkProductId || "",
      promoPrice: p.promoPrice?.toString() || "",
      active: p.active,
      startDate: fromISO(p.startsAt).d,
      startTime: fromISO(p.startsAt).t,
      endDate: fromISO(p.endsAt).d,
      endTime: fromISO(p.endsAt).t,
    });
    setFormTab("geral");
    setShowForm(true);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx. 5MB). Escolha um arquivo menor.");
      return;
    }
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiFetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) {
        if (res.status === 413) throw new Error("Imagem muito grande (máx. 5MB).");
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Erro ao enviar imagem.");
      }
      const data = await res.json();
      setForm(f => ({ ...f, imageUrl: data.url }));
    } catch (err: any) {
      toast.error(err?.message || "Erro ao enviar imagem");
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
        promoPrice: form.promoPrice ? parseFloat(form.promoPrice.replace(',', '.')) : null,
        active: form.active,
        startsAt: toISO(form.startDate, form.startTime),
        endsAt: toISO(form.endDate, form.endTime),
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
    await apiJson(`/api/admin/promotions/${id}`, { method: "DELETE" });
    await load();
  };

  const handleToggle = async (p: Promotion) => {
    await apiJson(`/api/admin/promotions/${p.id}`, { method: "PATCH", body: JSON.stringify({ active: !p.active }), headers: { "Content-Type": "application/json" } });
    await load();
  };

  return (
    <PageWrapper>
      <div className="space-y-4">
        <SectionTitle
          icon={Star}
          title="Promoções e banners"
          description="Crie banners com imagem completa que aparecem no carrossel do cardápio."
          action={<Button size="sm" iconLeft={<Plus size={14} />} onClick={openCreate}>Nova promoção</Button>}
        />

        {loading ? (
          <div role="status" className="flex items-center justify-center py-16 text-xs text-slate-500">Carregando...</div>
        ) : promotions.length === 0 ? (
          <ContentCard>
            <EmptyState
              icon={Star}
              title="Nenhuma promoção criada"
              description="Crie banners para destacar itens no cardápio"
              action={<Button size="sm" iconLeft={<Plus size={14} />} onClick={openCreate}>Criar primeira promoção</Button>}
            />
          </ContentCard>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {promotions.map(p => (
              <ContentCard key={p.id} padding="none" className={`overflow-hidden flex flex-col transition-all ${p.active ? '' : 'opacity-60'}`}>
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
                    <p className="text-white font-medium text-sm leading-tight line-clamp-1">{p.title}</p>
                    {p.product && (
                      <p className="text-white text-xs font-semibold mt-0.5">
                        {p.promoPrice ? (
                          <>
                            <span className="line-through text-slate-300 font-normal mr-1.5">{fmt(p.product.price)}</span>
                            {fmt(p.promoPrice)}
                          </>
                        ) : (
                          fmt(p.product.price)
                        )}
                      </p>
                    )}
                  </div>
                  <div className="absolute top-2 right-2">
                    <Badge color={p.active ? 'success' : 'default'} size="sm">{p.active ? 'Ativo' : 'Inativo'}</Badge>
                  </div>
                </div>

                <div className="p-3 space-y-2 flex-1">
                  {p.description && (
                    <p className="text-slate-500 text-xs line-clamp-2">{p.description}</p>
                  )}
                  {p.product && (
                    <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                      {p.product.imageUrl && <img src={p.product.imageUrl} className="w-6 h-6 rounded-lg object-cover" />}
                      <span className="text-xs font-medium text-slate-600">{p.product.name}</span>
                      <div className="ml-auto text-right flex flex-col">
                        {p.promoPrice ? (
                          <>
                            <span className="text-[11px] text-slate-500 line-through leading-none">{fmt(p.product.price)}</span>
                            <span className="text-xs text-blue-700 font-semibold leading-none">{fmt(p.promoPrice)}</span>
                          </>
                        ) : (
                          <span className="text-xs text-blue-700 font-semibold leading-none">{fmt(p.product.price)}</span>
                        )}
                      </div>
                    </div>
                  )}
                  {(p.startsAt || p.endsAt) && (
                    <p className="text-[11px] text-slate-500">
                      {p.startsAt ? `De ${new Date(p.startsAt).toLocaleDateString('pt-BR')} ` : ''}
                      {p.startsAt && p.startsAt.length > 10 ? new Date(p.startsAt).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}) : ''}
                      {p.endsAt ? ` até ${new Date(p.endsAt).toLocaleDateString('pt-BR')} ` : ''}
                      {p.endsAt && p.endsAt.length > 10 ? new Date(p.endsAt).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}) : ''}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 p-3 bg-slate-50/50 border-t border-slate-100">
                  <Switch
                    checked={p.active}
                    onCheckedChange={() => handleToggle(p)}
                    title={p.active ? "Desativar" : "Ativar"}
                    aria-label={p.active ? "Desativar promoção" : "Ativar promoção"}
                    label={p.active ? 'Ativo' : 'Inativo'}
                  />
                  <Button variant="outline" size="xs" iconLeft={<Edit2 size={14} />} onClick={() => openEdit(p)} className="ml-auto">Editar</Button>
                  <IconButton variant="ghost" size="xs" aria-label="Remover promoção" onClick={() => setDeleteConfirm(p.id)}>
                    <Trash2 size={14} className="text-red-600" />
                  </IconButton>
                </div>
              </ContentCard>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? "Editar Promoção" : "Nova Promoção"}
        size="lg"
        footer={
          <ModalFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.title.trim()}
              loading={saving}
              iconLeft={<Check size={14} />}
            >
              {editing ? "Salvar alterações" : "Criar promoção"}
            </Button>
          </ModalFooter>
        }
      >
        <Tabs<FormTab> items={formTabs} value={formTab} onChange={setFormTab} label="Dados da promoção">
          {formTab === "geral" && (
            <div className="space-y-3">
              <Input
                label="Título *"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Ex: Combo Especial do Dia"
              />
              <Textarea
                label="Descrição"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Texto que aparece no banner..."
                rows={2}
              />
              <Switch
                checked={form.active}
                onCheckedChange={v => setForm(f => ({ ...f, active: v }))}
                label={form.active ? 'Promoção ativa (visível no cardápio)' : 'Promoção inativa (oculta)'}
              />
            </div>
          )}

          {formTab === "imagem" && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600">Imagem do Banner</label>
              <div
                className="relative w-full aspect-[16/7] bg-slate-100 rounded-lg overflow-hidden cursor-pointer group border-2 border-dashed border-slate-200 hover:border-blue-400 transition-all"
                onClick={() => fileRef.current?.click()}
              >
                {form.imageUrl ? (
                  <>
                    <img src={form.imageUrl} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                      <span className="text-white text-xs font-medium">Trocar imagem</span>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500">
                    {uploadingImage ? (
                      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <ImageIcon className="w-8 h-8" />
                        <span className="text-xs font-medium">Clique para fazer upload da imagem</span>
                        <span className="text-[11px] text-slate-500 text-center px-6">Recomendado: 1200×500px, foto do produto sem texto — o título e o preço já são escritos por cima automaticamente</span>
                      </>
                    )}
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
              {form.imageUrl && (
                <div className="flex justify-end">
                  <Button variant="ghost" size="xs" iconLeft={<Trash2 size={14} />} onClick={() => setForm(f => ({ ...f, imageUrl: "" }))} className="text-red-600">
                    Remover Imagem
                  </Button>
                </div>
              )}
            </div>
          )}

          {formTab === "produto" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="Vincular a um Produto"
                value={form.linkProductId}
                onChange={e => {
                  const linkProductId = e.target.value;
                  if (!linkProductId) {
                    setForm(f => ({ ...f, linkProductId, promoPrice: "" }));
                  } else {
                    setForm(f => ({ ...f, linkProductId }));
                  }
                }}
              >
                <option value="">— Nenhum produto —</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} — {fmt(p.price)}</option>
                ))}
              </Select>
              {form.linkProductId && (
                <Input
                  label="Valor da Promoção"
                  type="number"
                  step="0.01"
                  placeholder="Opcional"
                  value={form.promoPrice}
                  onChange={e => setForm(f => ({ ...f, promoPrice: e.target.value }))}
                />
              )}
            </div>
          )}

          {formTab === "periodo" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Início (opcional)</label>
                <div className="flex gap-2">
                  <div className="flex-1 min-w-0">
                    <DatePicker
                      value={form.startDate}
                      onChange={v => setForm(f => ({ ...f, startDate: v || "" }))}
                      placeholder="dd/mm/aaaa"
                    />
                  </div>
                  <Input
                    type="time"
                    aria-label="Hora de início"
                    wrapperClassName="w-28"
                    value={form.startTime}
                    onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Fim (opcional)</label>
                <div className="flex gap-2">
                  <div className="flex-1 min-w-0">
                    <DatePicker
                      value={form.endDate}
                      onChange={v => setForm(f => ({ ...f, endDate: v || "" }))}
                      placeholder="dd/mm/aaaa"
                    />
                  </div>
                  <Input
                    type="time"
                    aria-label="Hora de fim"
                    wrapperClassName="w-28"
                    value={form.endTime}
                    onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          )}
        </Tabs>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={async () => {
          if (deleteConfirm) await handleDelete(deleteConfirm);
          setDeleteConfirm(null);
        }}
        title="Remover promoção"
        message="Tem certeza que deseja remover essa promoção?"
        confirmLabel="Remover"
        variant="danger"
      />
    </PageWrapper>
  );
}
