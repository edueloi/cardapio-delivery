import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck, Users, Link as LinkIcon, Plus, Trash2, Copy,
  Clock, CheckCircle2, XCircle, RefreshCw, LogOut, ChevronDown, ChevronUp,
  Wallet, TrendingUp, Star, CalendarDays, Package, BarChart3,
  ArrowUpRight, Crown, Zap, Building2, Mail, Edit3, X, Store, MapPin, Search, Loader2,
  KeyRound,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../../lib/auth";
import { apiFetch, apiJson } from "../../lib/api";
import {
  Button, Input, Modal, ModalFooter, EmptyState,
  StatCard, StatGrid, ContentCard, PageWrapper, SectionTitle,
  useToast,
} from "../../components";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Account {
  id: string; name: string; email: string; isSuperAdmin: boolean; createdAt: string;
  memberships: { role: string; tenant: { id: string; name: string; slug: string } }[];
}
interface Invite {
  id: string; token: string; note: string | null; usedAt: string | null;
  usedByEmail: string | null; expiresAt: string; createdAt: string;
  createdBy: { name: string; email: string };
}
interface Plan {
  id: string; name: string; description: string | null; price: number;
  durationDays: number; features: string | null; isActive: boolean; color: string;
  defaultStaffPermissions: string | null; // JSON: string[] of tab ids, null = all
}
interface Subscription {
  id: string; accountId: string; planId: string; status: string;
  startsAt: string; expiresAt: string; pricePaid: number; notes: string | null;
  createdAt: string;
  account: { id: string; name: string; email: string };
  plan: Plan;
}
interface Stats {
  accounts: number; tenants: number; invites: number;
  totalRevenue: number; monthlyRevenue: number;
  activeSubscriptions: number; expiredSubscriptions: number;
  revenueByMonth: Record<string, number>;
  subscriptions: Subscription[];
  plans: Plan[];
}

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
const fmtDate = (d: string) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
const fmtShort = (d: string) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
const monthLabel = (key: string) => {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
};

function daysUntil(d: string) {
  const diff = new Date(d).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function inviteUrl(token: string) { return `${window.location.origin}/cadastro/${token}`; }

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatusBadge({ status, expiresAt }: { status: string; expiresAt?: string }) {
  const expired = expiresAt && new Date(expiresAt) < new Date();
  if (status === "CANCELLED") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
      <X className="w-3 h-3" /> Cancelado
    </span>
  );
  if (status === "TRIAL") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
      <Zap className="w-3 h-3" /> Trial
    </span>
  );
  if (expired || status === "EXPIRED") return (
    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-700">
      <XCircle className="w-3 h-3" /> Expirado
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-green-100 text-green-700">
      <CheckCircle2 className="w-3 h-3" /> Ativo
    </span>
  );
}

function InviteStatusBadge({ invite }: { invite: Invite }) {
  if (invite.usedAt) return <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-green-100 text-green-700"><CheckCircle2 className="w-3 h-3" /> Usado</span>;
  if (new Date() > new Date(invite.expiresAt)) return <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-700"><XCircle className="w-3 h-3" /> Expirado</span>;
  return <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"><Clock className="w-3 h-3" /> Aguardando</span>;
}

// Mini bar chart
function RevenueChart({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return null;
  const max = Math.max(...entries.map(([, v]) => v), 1);
  return (
    <div className="flex items-end gap-1 h-14 w-full">
      {entries.map(([key, val]) => {
        const pct = Math.max((val / max) * 100, 4);
        const isLast = key === entries[entries.length - 1][0];
        return (
          <div key={key} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div
              className={`w-full rounded-t-lg transition-all ${isLast ? "bg-amber-400" : "bg-slate-200 group-hover:bg-amber-300"}`}
              style={{ height: `${pct}%` }}
            />
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
              {monthLabel(key)}: {fmt(val)}
            </div>
            <span className="text-[8px] text-slate-400 font-bold">{monthLabel(key)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Condomínios Tab ──────────────────────────────────────────────────────────
interface CondTenantItem {
  id: string;
  sortOrder: number;
  tenant: { id: string; name: string; slug: string; logoUrl: string | null };
}
interface CondominiumItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  primaryColor: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  tenants: CondTenantItem[];
}

function CondominiumsTab() {
  const toast = useToast();
  const [condominiums, setCondominiums] = useState<CondominiumItem[]>([]);
  const [allTenants, setAllTenants] = useState<{ id: string; name: string; slug: string; logoUrl: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Form: criar/editar condomínio
  const [showForm, setShowForm] = useState(false);
  const [editingCond, setEditingCond] = useState<CondominiumItem | null>(null);
  const [form, setForm] = useState({ name: "", slug: "", description: "", address: "", primaryColor: "#C9A227" });
  const [saving, setSaving] = useState(false);

  // Vincular tenant
  const [linkTenantId, setLinkTenantId] = useState("");
  const [linking, setLinking] = useState<string | null>(null);

  // Deletar
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Logo/banner upload
  const [uploadingLogo, setUploadingLogo] = useState<string | null>(null);
  const [uploadingBanner, setUploadingBanner] = useState<string | null>(null);

  // Confirmação de remoção de imagem: { condId, type }
  const [removeImageConfirm, setRemoveImageConfirm] = useState<{ condId: string; type: "logo" | "banner" } | null>(null);
  const [removingImage, setRemovingImage] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [condsRes, tenantsRes] = await Promise.all([
        apiFetch("/api/superadmin/condominiums"),
        apiFetch("/api/superadmin/tenants-list"),
      ]);
      const [condsData, tenantsData] = await Promise.all([condsRes.json(), tenantsRes.json()]);
      setCondominiums(Array.isArray(condsData) ? condsData : []);
      setAllTenants(Array.isArray(tenantsData) ? tenantsData : []);
    } catch {}
    setLoading(false);
  }

  function openCreate() {
    setEditingCond(null);
    setForm({ name: "", slug: "", description: "", address: "", primaryColor: "#C9A227" });
    setShowForm(true);
  }

  function openEdit(cond: CondominiumItem) {
    setEditingCond(cond);
    setForm({ name: cond.name, slug: cond.slug, description: cond.description || "", address: cond.address || "", primaryColor: cond.primaryColor || "#C9A227" });
    setShowForm(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editingCond) {
        const updated = await apiJson<CondominiumItem>(`/api/superadmin/condominiums/${editingCond.id}`, {
          method: "PATCH", body: JSON.stringify({ name: form.name, description: form.description || null, address: form.address || null, primaryColor: form.primaryColor }),
        });
        setCondominiums(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c));
      } else {
        const created = await apiJson<CondominiumItem>("/api/superadmin/condominiums", {
          method: "POST", body: JSON.stringify({ name: form.name, slug: form.slug, description: form.description || null, address: form.address || null, primaryColor: form.primaryColor }),
        });
        if (created) setCondominiums(prev => [created, ...prev]);
        else await loadAll();
      }
      setShowForm(false);
    } catch (e: any) { toast.error(e.message || "Erro ao salvar."); }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await apiJson(`/api/superadmin/condominiums/${deleteId}`, { method: "DELETE" });
      setCondominiums(prev => prev.filter(c => c.id !== deleteId));
      setDeleteId(null);
    } catch {}
    setDeleting(false);
  }

  async function handleLink(condId: string) {
    if (!linkTenantId) return;
    setLinking(condId);
    try {
      const link = await apiJson(`/api/superadmin/condominiums/${condId}/tenants`, {
        method: "POST", body: JSON.stringify({ tenantId: linkTenantId }),
      });
      const tenant = allTenants.find(t => t.id === linkTenantId);
      if (tenant) {
        setCondominiums(prev => prev.map(c => c.id === condId ? {
          ...c,
          tenants: [...c.tenants, { ...(link as any), tenant }],
        } : c));
      }
      setLinkTenantId("");
    } catch (e: any) { toast.error(e.message || "Erro ao vincular."); }
    setLinking(null);
  }

  async function handleUnlink(condId: string, tenantId: string) {
    try {
      await apiJson(`/api/superadmin/condominiums/${condId}/tenants/${tenantId}`, { method: "DELETE" });
      setCondominiums(prev => prev.map(c => c.id === condId ? {
        ...c, tenants: c.tenants.filter(ct => ct.tenant.id !== tenantId),
      } : c));
    } catch {}
  }

  async function handleUpload(condId: string, type: "logo" | "banner", file: File) {
    if (type === "logo") setUploadingLogo(condId);
    else setUploadingBanner(condId);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiFetch(`/api/superadmin/condominiums/${condId}/${type}`, { method: "POST", body: formData });
      const data = await res.json();
      setCondominiums(prev => prev.map(c => c.id === condId ? { ...c, [type === "logo" ? "logoUrl" : "bannerUrl"]: data.url } : c));
    } catch {}
    if (type === "logo") setUploadingLogo(null);
    else setUploadingBanner(null);
  }

  async function handleRemoveImage(condId: string, type: "logo" | "banner") {
    setRemovingImage(true);
    try {
      await apiJson(`/api/superadmin/condominiums/${condId}`, {
        method: "PATCH",
        body: JSON.stringify({ [type === "logo" ? "logoUrl" : "bannerUrl"]: null }),
      });
      setCondominiums(prev => prev.map(c => c.id === condId ? { ...c, [type === "logo" ? "logoUrl" : "bannerUrl"]: null } : c));
      setRemoveImageConfirm(null);
    } catch (e: any) {
      toast.error(e.message || "Erro ao remover imagem.");
    } finally {
      setRemovingImage(false);
    }
  }

  const publicUrl = (slug: string) => `${window.location.origin}/cond/${slug}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <SectionTitle
        title="Condomínios"
        description={`${condominiums.length} condomínio${condominiums.length !== 1 ? "s" : ""} cadastrado${condominiums.length !== 1 ? "s" : ""}`}
        action={<Button variant="primary" iconLeft={<Plus className="w-4 h-4" />} onClick={openCreate}>Novo condomínio</Button>}
      />

      {condominiums.length === 0 ? (
        <ContentCard>
          <EmptyState icon={Building2} title="Nenhum condomínio" description="Crie o primeiro condomínio para agrupar estabelecimentos." />
        </ContentCard>
      ) : (
        condominiums.map(cond => {
          const isExpanded = expanded === cond.id;
          const availableTenants = allTenants.filter(t => !cond.tenants.some(ct => ct.tenant.id === t.id));
          return (
            <ContentCard key={cond.id}>
              {/* Header */}
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden bg-slate-100 flex items-center justify-center border-2"
                  style={{ borderColor: `${cond.primaryColor || "#C9A227"}44` }}
                >
                  {cond.logoUrl ? (
                    <img src={cond.logoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Building2 className="w-5 h-5 text-slate-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 truncate">{cond.name}</span>
                    {!cond.isActive && <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-600">Inativo</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <code className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-mono">/cond/{cond.slug}</code>
                    <span className="text-[10px] text-slate-400">{cond.tenants.length} estabelecimento{cond.tenants.length !== 1 ? "s" : ""}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { navigator.clipboard.writeText(publicUrl(cond.slug)); }}
                    className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-xl transition-colors"
                    title="Copiar link público"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button onClick={() => openEdit(cond)} className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-colors">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDeleteId(cond.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => { setExpanded(isExpanded ? null : cond.id); setLinkTenantId(""); }} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Expandido */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 pt-4 border-t border-zinc-100 space-y-4">
                      {/* Logo / Banner upload */}
                      <div className="grid grid-cols-2 gap-3">
                        {/* LOGO */}
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Logo</label>
                          {cond.logoUrl ? (
                            <div className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-50" style={{ height: 80 }}>
                              <img src={cond.logoUrl} alt="logo" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                                <label className="p-1.5 bg-white rounded-lg cursor-pointer hover:bg-amber-50 transition-colors" title="Trocar">
                                  {uploadingLogo === cond.id ? <Loader2 className="w-4 h-4 animate-spin text-slate-500" /> : <Edit3 className="w-4 h-4 text-slate-600" />}
                                  <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleUpload(cond.id, "logo", e.target.files[0])} />
                                </label>
                                <button type="button" onClick={() => setRemoveImageConfirm({ condId: cond.id, type: "logo" })} className="p-1.5 bg-white rounded-lg hover:bg-red-50 transition-colors" title="Remover">
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <label className="flex flex-col items-center justify-center gap-1 px-3 py-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl cursor-pointer hover:bg-amber-50 hover:border-amber-300 transition-colors text-xs text-slate-400">
                              {uploadingLogo === cond.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                              Enviar logo
                              <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleUpload(cond.id, "logo", e.target.files[0])} />
                            </label>
                          )}
                        </div>
                        {/* BANNER */}
                        <div>
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">Banner</label>
                          {cond.bannerUrl ? (
                            <div className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-50" style={{ height: 80 }}>
                              <img src={cond.bannerUrl} alt="banner" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100">
                                <label className="p-1.5 bg-white rounded-lg cursor-pointer hover:bg-amber-50 transition-colors" title="Trocar">
                                  {uploadingBanner === cond.id ? <Loader2 className="w-4 h-4 animate-spin text-slate-500" /> : <Edit3 className="w-4 h-4 text-slate-600" />}
                                  <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleUpload(cond.id, "banner", e.target.files[0])} />
                                </label>
                                <button type="button" onClick={() => setRemoveImageConfirm({ condId: cond.id, type: "banner" })} className="p-1.5 bg-white rounded-lg hover:bg-red-50 transition-colors" title="Remover">
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <label className="flex flex-col items-center justify-center gap-1 px-3 py-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl cursor-pointer hover:bg-amber-50 hover:border-amber-300 transition-colors text-xs text-slate-400">
                              {uploadingBanner === cond.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                              Enviar banner
                              <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleUpload(cond.id, "banner", e.target.files[0])} />
                            </label>
                          )}
                        </div>
                      </div>

                      {/* Estabelecimentos vinculados */}
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Estabelecimentos vinculados</p>
                        {cond.tenants.length === 0 ? (
                          <p className="text-xs text-slate-400 italic">Nenhum estabelecimento vinculado ainda.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {cond.tenants.map(ct => (
                              <div key={ct.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl">
                                <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                                  {ct.tenant.logoUrl ? <img src={ct.tenant.logoUrl} alt="" className="w-full h-full object-cover" /> : <Store className="w-3.5 h-3.5 text-slate-300" />}
                                </div>
                                <span className="text-xs font-semibold text-slate-700 flex-1 truncate">{ct.tenant.name}</span>
                                <code className="text-[10px] text-slate-400 font-mono">/{ct.tenant.slug}</code>
                                <button onClick={() => handleUnlink(cond.id, ct.tenant.id)} className="p-1 text-slate-300 hover:text-red-500 transition-colors">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Vincular novo */}
                      {availableTenants.length > 0 && (
                        <div className="flex gap-2">
                          <select
                            value={availableTenants.some(t => t.id === linkTenantId) ? linkTenantId : ""}
                            onChange={e => setLinkTenantId(e.target.value)}
                            className="flex-1 h-9 rounded-[10px] border border-zinc-200 bg-zinc-50 px-2 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                          >
                            <option value="">Selecionar estabelecimento...</option>
                            {availableTenants.map(t => (
                              <option key={t.id} value={t.id}>{t.name} (/{t.slug})</option>
                            ))}
                          </select>
                          <Button
                            variant="primary"
                            loading={linking === cond.id}
                            disabled={!linkTenantId}
                            onClick={() => handleLink(cond.id)}
                          >
                            Vincular
                          </Button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </ContentCard>
          );
        })
      )}

      {/* Modal: criar/editar */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingCond ? "Editar condomínio" : "Novo condomínio"} size="sm">
        <div className="space-y-3">
          <div>
            <Input
              label="Nome"
              value={form.name}
              onChange={e => {
                const name = e.target.value;
                const slug = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
                setForm(f => ({ ...f, name, slug }));
              }}
              placeholder="Residencial Park"
            />
            {!editingCond && form.slug && (
              <p className="text-[11px] text-slate-400 mt-1">URL: <span className="font-mono text-amber-600">/cond/{form.slug}</span></p>
            )}
          </div>
          <Input label="Descrição (opcional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Condomínio localizado na Av. ..." />
          <Input label="Endereço (opcional)" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Av. das Flores, 100" />
          <div>
            <label className="ds-label mb-1.5 block">Cor principal</label>
            <input type="color" value={form.primaryColor} onChange={e => setForm(f => ({ ...f, primaryColor: e.target.value }))} className="h-10 w-20 rounded-xl border border-zinc-200 cursor-pointer" />
          </div>
        </div>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
          <Button variant="primary" loading={saving} onClick={handleSave} disabled={!form.name || (!editingCond && !form.slug)}>
            {editingCond ? "Salvar" : "Criar"}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Modal: confirmar exclusão */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Excluir condomínio" size="sm">
        <p className="text-sm text-slate-500 -mt-2 mb-4">Esta ação é irreversível. Todos os vínculos com estabelecimentos serão removidos.</p>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setDeleteId(null)}>Cancelar</Button>
          <Button variant="danger" loading={deleting} onClick={handleDelete}>Excluir</Button>
        </ModalFooter>
      </Modal>

      {/* Modal: confirmar remoção de imagem */}
      <Modal isOpen={!!removeImageConfirm} onClose={() => setRemoveImageConfirm(null)} title={`Remover ${removeImageConfirm?.type === "logo" ? "logo" : "banner"}`} size="sm">
        <p className="text-sm text-slate-500 -mt-2 mb-4">
          Tem certeza que deseja remover {removeImageConfirm?.type === "logo" ? "a logo" : "o banner"} deste condomínio? Você poderá enviar uma nova imagem depois.
        </p>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setRemoveImageConfirm(null)}>Cancelar</Button>
          <Button variant="danger" loading={removingImage} onClick={() => removeImageConfirm && handleRemoveImage(removeImageConfirm.condId, removeImageConfirm.type)}>
            Remover
          </Button>
        </ModalFooter>
      </Modal>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SuperAdminPage() {
  const navigate = useNavigate();
  const { account, logout } = useAuth();
  const isSuperAdmin = (account as any)?.isSuperAdmin;

  const [stats, setStats] = useState<Stats | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"dashboard" | "accounts" | "subscriptions" | "plans" | "invites" | "condominiums">("dashboard");

  // Convites
  const [showNewInvite, setShowNewInvite] = useState(false);
  const [inviteNote, setInviteNote] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteHours, setInviteHours] = useState("48");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [newInviteUrl, setNewInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Delete
  const [deleteAccountId, setDeleteAccountId] = useState<string | null>(null);
  const [deleteInviteId, setDeleteInviteId] = useState<string | null>(null);
  const [deleteSubId, setDeleteSubId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Trocar senha de uma conta
  const [resetPasswordAccount, setResetPasswordAccount] = useState<Account | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState("");

  // Busca (por nome/email da conta ou nome/slug da empresa)
  const [accountSearch, setAccountSearch] = useState("");

  // Planos
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [planForm, setPlanForm] = useState({ name: "", description: "", price: "", durationDays: "30", features: "", color: "#C9A227" });
  const [planDefaultPerms, setPlanDefaultPerms] = useState<string[] | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);

  // Assinaturas
  const [showSubModal, setShowSubModal] = useState(false);
  const [subForm, setSubForm] = useState({ accountId: "", planId: "", pricePaid: "", notes: "" });
  const [savingSub, setSavingSub] = useState(false);

  useEffect(() => {
    if (!account) return;
    if (!isSuperAdmin) { navigate("/painel"); return; }
    load();
  }, [account]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, accRes, invRes] = await Promise.all([
        apiFetch("/api/superadmin/stats"),
        apiFetch("/api/superadmin/accounts"),
        apiFetch("/api/superadmin/invites"),
      ]);
      const [statsData, accData, invData] = await Promise.all([statsRes.json(), accRes.json(), invRes.json()]);
      setStats(statsData);
      setAccounts(accData);
      setInvites(invData);
    } catch {}
    setLoading(false);
  }, []);

  function copyLink(url: string) {
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  async function handleCreateInvite() {
    setCreatingInvite(true);
    try {
      const invite = await apiJson<Invite>("/api/superadmin/invites", {
        method: "POST", body: JSON.stringify({ note: inviteNote.trim() || null, expiresInHours: Number(inviteHours) || 48, sendTo: inviteEmail.trim() || null }),
      });
      setNewInviteUrl(inviteUrl(invite.token));
      setInvites(prev => [{ ...invite, createdBy: { name: account!.name, email: (account as any).email } }, ...prev]);
      setInviteEmail("");
      setInviteNote(""); setInviteHours("48");
    } catch {}
    setCreatingInvite(false);
  }

  async function handleDeleteAccount() {
    if (!deleteAccountId) return;
    setDeleting(true);
    try {
      await apiJson(`/api/superadmin/accounts/${deleteAccountId}`, { method: "DELETE" });
      setAccounts(prev => prev.filter(a => a.id !== deleteAccountId));
    } catch {}
    setDeleting(false); setDeleteAccountId(null);
  }

  async function handleResetPassword() {
    if (!resetPasswordAccount) return;
    if (newPassword.length < 6) {
      setResetPasswordError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    setResettingPassword(true);
    setResetPasswordError("");
    try {
      await apiJson(`/api/superadmin/accounts/${resetPasswordAccount.id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ password: newPassword }),
      });
      setResetPasswordAccount(null);
      setNewPassword("");
    } catch (err: any) {
      setResetPasswordError(err?.message || "Falha ao trocar a senha.");
    } finally {
      setResettingPassword(false);
    }
  }

  async function handleRevokeInvite() {
    if (!deleteInviteId) return;
    setDeleting(true);
    try {
      await apiJson(`/api/superadmin/invites/${deleteInviteId}`, { method: "DELETE" });
      setInvites(prev => prev.filter(i => i.id !== deleteInviteId));
    } catch {}
    setDeleting(false); setDeleteInviteId(null);
  }

  async function handleSavePlan() {
    setSavingPlan(true);
    try {
      const body = JSON.stringify({
        name: planForm.name, description: planForm.description || null,
        price: Number(planForm.price) || 0, durationDays: Number(planForm.durationDays) || 30,
        features: planForm.features || null, color: planForm.color,
        defaultStaffPermissions: planDefaultPerms === null ? null : JSON.stringify(planDefaultPerms),
      });
      if (editingPlan) {
        const updated = await apiJson<Plan>(`/api/superadmin/plans/${editingPlan.id}`, { method: "PATCH", body });
        setStats(s => s ? { ...s, plans: s.plans.map(p => p.id === updated.id ? updated : p) } : s);
      } else {
        const created = await apiJson<Plan>("/api/superadmin/plans", { method: "POST", body });
        setStats(s => s ? { ...s, plans: [...s.plans, created] } : s);
      }
      setShowPlanModal(false);
    } catch {}
    setSavingPlan(false);
  }

  async function handleCreateSub() {
    setSavingSub(true);
    try {
      const sub = await apiJson<Subscription>("/api/superadmin/subscriptions", {
        method: "POST", body: JSON.stringify({ accountId: subForm.accountId, planId: subForm.planId, pricePaid: Number(subForm.pricePaid) || undefined, notes: subForm.notes || null }),
      });
      setStats(s => s ? { ...s, subscriptions: [sub, ...s.subscriptions], activeSubscriptions: s.activeSubscriptions + 1 } : s);
      setShowSubModal(false); setSubForm({ accountId: "", planId: "", pricePaid: "", notes: "" });
    } catch {}
    setSavingSub(false);
  }

  async function handleCancelSub() {
    if (!deleteSubId) return;
    setDeleting(true);
    try {
      await apiJson(`/api/superadmin/subscriptions/${deleteSubId}`, { method: "DELETE" });
      setStats(s => s ? { ...s, subscriptions: s.subscriptions.map(sub => sub.id === deleteSubId ? { ...sub, status: "CANCELLED" } : sub) } : s);
    } catch {}
    setDeleting(false); setDeleteSubId(null);
  }

  const openPlanModal = (plan?: Plan) => {
    if (plan) {
      setEditingPlan(plan);
      setPlanForm({ name: plan.name, description: plan.description || "", price: String(plan.price), durationDays: String(plan.durationDays), features: plan.features || "", color: plan.color || "#C9A227" });
      setPlanDefaultPerms(plan.defaultStaffPermissions ? JSON.parse(plan.defaultStaffPermissions) : null);
    } else {
      setEditingPlan(null);
      setPlanForm({ name: "", description: "", price: "", durationDays: "30", features: "", color: "#C9A227" });
      setPlanDefaultPerms(null);
    }
    setShowPlanModal(true);
  };

  const pendingInvites = invites.filter(i => !i.usedAt && new Date() <= new Date(i.expiresAt));

  const TABS = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3 },
    { id: "accounts", label: "Contas", icon: Users },
    { id: "subscriptions", label: "Assinaturas", icon: Crown },
    { id: "plans", label: "Planos", icon: Package },
    { id: "invites", label: "Convites", icon: LinkIcon },
    { id: "condominiums", label: "Condomínios", icon: Building2 },
  ] as const;

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm font-medium">Carregando painel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0D1B3E] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-900">Super Admin</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest">Box Sys</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-zinc-100 rounded-xl transition-colors" title="Atualizar">
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate("/painel")}
              className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors px-3 py-2 rounded-xl hover:bg-zinc-100"
            >
              <Building2 className="w-4 h-4" /> Ir ao Painel
            </button>
            <button
              onClick={() => { logout(); navigate("/login"); }}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-red-600 transition-colors px-3 py-2 rounded-xl hover:bg-red-50"
            >
              <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-zinc-200 rounded-2xl p-1 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                tab === t.id ? "bg-[#0D1B3E] text-amber-400 shadow-sm" : "text-slate-400 hover:text-slate-700 hover:bg-zinc-50"
              }`}
            >
              <t.icon className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* ══ DASHBOARD ══ */}
        {tab === "dashboard" && stats && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <SectionTitle title="Dashboard" description="Visão geral da plataforma" icon={BarChart3} />

            <StatGrid cols={4}>
              <StatCard title="Contas" value={stats.accounts} icon={Users} color="info" delay={0} description="Total cadastradas" />
              <StatCard title="Estabelecimentos" value={stats.tenants} icon={Building2} color="default" delay={0.05} description="Tenants ativos" />
              <StatCard title="Assinaturas Ativas" value={stats.activeSubscriptions} icon={Crown} color="success" delay={0.1} description="Em vigor hoje" />
              <StatCard title="Receita Total" value={fmt(stats.totalRevenue)} icon={Wallet} color="success" delay={0.15} description="Acumulado" />
            </StatGrid>

            <div className="grid grid-cols-12 gap-4">
              {/* Gráfico receita */}
              <div className="col-span-12 lg:col-span-8">
                <ContentCard padding="lg">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Receita por mês</p>
                      <p className="text-xl font-black text-slate-800 mt-0.5">{fmt(stats.monthlyRevenue)} <span className="text-xs text-slate-400 font-medium">este mês</span></p>
                    </div>
                    <div className="flex items-center gap-1.5 text-green-600 bg-green-50 rounded-xl px-3 py-1.5">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-black uppercase">Receita</span>
                    </div>
                  </div>
                  <RevenueChart data={stats.revenueByMonth} />
                </ContentCard>
              </div>

              {/* Resumo rápido */}
              <div className="col-span-12 lg:col-span-4 space-y-3">
                <ContentCard padding="lg">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Status assinaturas</p>
                  <div className="space-y-2">
                    {[
                      { label: "Ativas", value: stats.activeSubscriptions, color: "bg-green-500" },
                      { label: "Expiradas", value: stats.expiredSubscriptions, color: "bg-red-400" },
                      { label: "Total", value: stats.subscriptions.length, color: "bg-slate-300" },
                    ].map(row => (
                      <div key={row.label} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${row.color}`} />
                          <span className="text-sm text-slate-600">{row.label}</span>
                        </div>
                        <span className="text-sm font-black text-slate-800">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </ContentCard>

                <ContentCard padding="lg">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Convites</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Pendentes</span>
                    <span className="text-xl font-black text-amber-500">{pendingInvites.length}</span>
                  </div>
                </ContentCard>
              </div>
            </div>

            {/* Assinaturas recentes */}
            {stats.subscriptions.length > 0 && (
              <ContentCard padding="none">
                <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Assinaturas Recentes</p>
                  <button onClick={() => setTab("subscriptions")} className="text-[10px] font-black text-amber-500 hover:text-amber-600 flex items-center gap-1">
                    Ver todas <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="divide-y divide-zinc-50">
                  {stats.subscriptions.slice(0, 5).map(sub => (
                    <div key={sub.id} className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-50 transition-colors">
                      <div className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center text-sm font-black text-slate-500 shrink-0">
                        {sub.account.name[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">{sub.account.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">{sub.plan.name} · {fmtShort(sub.startsAt)} → {fmtShort(sub.expiresAt)}</p>
                      </div>
                      <StatusBadge status={sub.status} expiresAt={sub.expiresAt} />
                      <span className="text-sm font-black text-slate-700 shrink-0">{fmt(sub.pricePaid)}</span>
                    </div>
                  ))}
                </div>
              </ContentCard>
            )}
          </motion.div>
        )}

        {/* ══ CONTAS ══ */}
        {tab === "accounts" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <SectionTitle title="Contas" description={`${accounts.length} conta${accounts.length !== 1 ? "s" : ""} cadastrada${accounts.length !== 1 ? "s" : ""}`} icon={Users} />

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={accountSearch}
                onChange={e => setAccountSearch(e.target.value)}
                placeholder="Buscar por nome, e-mail ou empresa..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 bg-white text-sm outline-none focus:border-[#C9A227] transition-colors"
              />
            </div>

            {accounts.length === 0 ? (
              <EmptyState title="Nenhuma conta" description="Nenhuma conta cadastrada." icon={Users} />
            ) : (() => {
              const q = accountSearch.trim().toLowerCase();
              const filteredAccounts = q
                ? accounts.filter(acc =>
                    acc.name.toLowerCase().includes(q) ||
                    acc.email.toLowerCase().includes(q) ||
                    acc.memberships.some(m => m.tenant.name.toLowerCase().includes(q) || m.tenant.slug.toLowerCase().includes(q))
                  )
                : accounts;
              if (filteredAccounts.length === 0) {
                return <EmptyState title="Nenhum resultado" description="Nenhuma conta ou empresa bate com essa busca." icon={Search} />;
              }
              return (
              <div className="space-y-2">
                {filteredAccounts.map(acc => {
                  const isMe = acc.id === (account as any)?.id;
                  const accSubs = stats?.subscriptions.filter(s => s.accountId === acc.id) ?? [];
                  const activeSub = accSubs.find(s => s.status === "ACTIVE" && new Date(s.expiresAt) > new Date());
                  return (
                    <ContentCard key={acc.id} padding="none">
                      <div className="flex items-center gap-4 px-4 py-3">
                        <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-sm font-black text-slate-500 shrink-0">
                          {acc.name[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-black text-slate-800">{acc.name}</p>
                            {acc.isSuperAdmin && (
                              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 border border-amber-200">Super Admin</span>
                            )}
                            {isMe && <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-700">Você</span>}
                            {activeSub && <StatusBadge status="ACTIVE" expiresAt={activeSub.expiresAt} />}
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            <p className="text-xs text-slate-400 flex items-center gap-1"><Mail className="w-3 h-3" />{acc.email}</p>
                            {activeSub && (
                              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                <CalendarDays className="w-3 h-3" />
                                Expira {fmtDate(activeSub.expiresAt)}
                                {daysUntil(activeSub.expiresAt) <= 7 && (
                                  <span className="text-orange-500 font-bold">({daysUntil(activeSub.expiresAt)}d)</span>
                                )}
                              </p>
                            )}
                          </div>
                          {/* Empresa(s) + cargo sempre visíveis — antes só apareciam clicando pra
                              expandir, o que escondia justamente a info mais útil pra achar a
                              conta certa (a quem ela pertence e o que ela pode fazer). */}
                          {acc.memberships.length > 0 && (
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              {acc.memberships.map(m => (
                                <span key={m.tenant.id} className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-zinc-100 rounded-md px-2 py-0.5">
                                  <Building2 className="w-2.5 h-2.5 text-slate-400" />
                                  {m.tenant.name}
                                  <span className="text-slate-400 font-black">· {m.role}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => { setSubForm(f => ({ ...f, accountId: acc.id })); setTab("subscriptions"); setTimeout(() => setShowSubModal(true), 100); }}
                            className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-xl transition-colors"
                            title="Criar assinatura"
                          >
                            <Crown className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setResetPasswordAccount(acc); setNewPassword(""); setResetPasswordError(""); }}
                            className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-colors"
                            title="Trocar senha"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                          {!isMe && !acc.isSuperAdmin && (
                            <button onClick={() => setDeleteAccountId(acc.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </ContentCard>
                  );
                })}
              </div>
              );
            })()}
          </motion.div>
        )}

        {/* ══ ASSINATURAS ══ */}
        {tab === "subscriptions" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <SectionTitle
              title="Assinaturas"
              description="Gerencie planos de acesso dos clientes"
              icon={Crown}
              action={
                <Button size="sm" variant="primary" iconLeft={<Plus className="w-4 h-4" />} onClick={() => { setSubForm({ accountId: "", planId: "", pricePaid: "", notes: "" }); setShowSubModal(true); }}>
                  Nova Assinatura
                </Button>
              }
            />

            {(!stats?.subscriptions || stats.subscriptions.length === 0) ? (
              <EmptyState title="Sem assinaturas" description="Nenhuma assinatura criada ainda." icon={Crown} />
            ) : (
              <ContentCard padding="none">
                <div className="divide-y divide-zinc-50">
                  {stats!.subscriptions.map(sub => {
                    const days = daysUntil(sub.expiresAt);
                    const isExpiring = days <= 7 && days > 0 && sub.status === "ACTIVE";
                    return (
                      <div key={sub.id} className={`flex items-center gap-3 px-5 py-4 hover:bg-zinc-50 transition-colors ${isExpiring ? "bg-orange-50/50" : ""}`}>
                        <div className="w-9 h-9 rounded-xl bg-zinc-100 flex items-center justify-center text-sm font-black text-slate-500 shrink-0">
                          {sub.account.name[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-black text-slate-800">{sub.account.name}</p>
                            <StatusBadge status={sub.status} expiresAt={sub.expiresAt} />
                            {isExpiring && <span className="text-[10px] font-black text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">Expira em {days}d</span>}
                          </div>
                          <p className="text-xs text-slate-400">{sub.account.email}</p>
                          <div className="flex items-center gap-3 text-[10px] text-slate-400 flex-wrap">
                            <span className="flex items-center gap-1"><Crown className="w-3 h-3 text-amber-400" />{sub.plan.name}</span>
                            <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{fmtDate(sub.startsAt)} → {fmtDate(sub.expiresAt)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-black text-slate-700">{fmt(sub.pricePaid)}</span>
                          {sub.status === "ACTIVE" && (
                            <button onClick={() => setDeleteSubId(sub.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ContentCard>
            )}
          </motion.div>
        )}

        {/* ══ PLANOS ══ */}
        {tab === "plans" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <SectionTitle
              title="Planos"
              description="Configure os planos de assinatura disponíveis"
              icon={Package}
              action={
                <Button size="sm" variant="primary" iconLeft={<Plus className="w-4 h-4" />} onClick={() => openPlanModal()}>
                  Novo Plano
                </Button>
              }
            />

            {(!stats?.plans || stats.plans.length === 0) ? (
              <EmptyState title="Sem planos" description="Crie o primeiro plano de assinatura." icon={Package} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {stats!.plans.map(plan => {
                  const subCount = stats!.subscriptions.filter(s => s.planId === plan.id && s.status === "ACTIVE").length;
                  const features = plan.features ? plan.features.split("\n").filter(Boolean) : [];
                  return (
                    <ContentCard key={plan.id} padding="lg">
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${plan.color}20` }}>
                          <Star className="w-5 h-5" style={{ color: plan.color }} />
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openPlanModal(plan)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-zinc-100 rounded-lg transition-colors">
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {!plan.isActive && (
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-zinc-100 text-zinc-500">Inativo</span>
                          )}
                        </div>
                      </div>
                      <h3 className="font-black text-slate-800 text-base">{plan.name}</h3>
                      {plan.description && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{plan.description}</p>}
                      <div className="mt-3">
                        <span className="text-2xl font-black" style={{ color: plan.color }}>{fmt(plan.price)}</span>
                        <span className="text-xs text-slate-400 ml-1">/ {plan.durationDays}d</span>
                      </div>
                      {features.length > 0 && (
                        <ul className="mt-3 space-y-1">
                          {features.map((f, i) => (
                            <li key={i} className="flex items-center gap-1.5 text-xs text-slate-600">
                              <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                              {f}
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">{subCount} assinante{subCount !== 1 ? "s" : ""} ativo{subCount !== 1 ? "s" : ""}</span>
                        <span className="text-[10px] font-black text-slate-500">{plan.durationDays === 30 ? "Mensal" : plan.durationDays === 90 ? "Trimestral" : plan.durationDays === 365 ? "Anual" : `${plan.durationDays} dias`}</span>
                      </div>
                    </ContentCard>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* ══ CONVITES ══ */}
        {tab === "invites" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <SectionTitle
              title="Links de Convite"
              description="Gere links de cadastro único para novos usuários"
              icon={LinkIcon}
              action={
                <Button size="sm" variant="primary" iconLeft={<Plus className="w-4 h-4" />} onClick={() => { setShowNewInvite(true); setNewInviteUrl(null); }}>
                  Gerar Convite
                </Button>
              }
            />

            {invites.length === 0 ? (
              <EmptyState title="Nenhum convite" description="Nenhum convite gerado ainda." icon={LinkIcon} />
            ) : (
              <div className="space-y-2">
                {invites.map(invite => {
                  const url = inviteUrl(invite.token);
                  const used = !!invite.usedAt;
                  const expired = !used && new Date() > new Date(invite.expiresAt);
                  const active = !used && !expired;
                  return (
                    <ContentCard key={invite.id} padding="none">
                      <div className={`px-4 py-4 ${!active ? "opacity-60" : ""}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <InviteStatusBadge invite={invite} />
                              {invite.note && <span className="text-xs text-slate-500 font-medium">{invite.note}</span>}
                            </div>
                            {active && (
                              <div className="flex items-center gap-2">
                                <code className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg truncate max-w-xs font-mono">
                                  {url}
                                </code>
                                <button onClick={() => copyLink(url)} className="p-1.5 text-slate-400 hover:text-amber-500 transition-colors shrink-0" title="Copiar link">
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                            <div className="flex items-center gap-3 text-[10px] text-slate-400 flex-wrap">
                              <span>Criado {fmtDate(invite.createdAt)}</span>
                              <span>Expira {fmtDate(invite.expiresAt)}</span>
                              {invite.usedByEmail && <span>Usado por <span className="text-slate-600 font-bold">{invite.usedByEmail}</span></span>}
                            </div>
                          </div>
                          {!used && (
                            <button onClick={() => setDeleteInviteId(invite.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors shrink-0">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </ContentCard>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* ══ CONDOMÍNIOS ══ */}
        {tab === "condominiums" && (
          <CondominiumsTab />
        )}
      </div>

      {/* ══ MODAIS ══ */}

      {/* Modal: Novo convite */}
      <Modal isOpen={showNewInvite} onClose={() => { setShowNewInvite(false); setNewInviteUrl(null); }} title="Gerar Link de Convite" size="sm">
        <p className="text-sm text-slate-500 -mt-2 mb-4">Link de uso único para cadastro de nova conta.</p>
        {newInviteUrl ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center space-y-3">
              <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto" />
              <p className="text-sm font-black text-green-800">Convite gerado!</p>
              <code className="text-xs text-green-700 break-all font-mono block">{newInviteUrl}</code>
            </div>
            <Button fullWidth variant="primary" iconLeft={<Copy className="w-4 h-4" />} onClick={() => copyLink(newInviteUrl)}>
              {copied ? "Copiado!" : "Copiar link"}
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <Input label="Enviar por e-mail (opcional)" type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="cliente@email.com" hint="Se preenchido, o link será enviado automaticamente ao cadastrar" />
              <Input label="Observação (opcional)" value={inviteNote} onChange={e => setInviteNote(e.target.value)} placeholder="Ex: Para João da Pizzaria Central" hint="Ajuda a identificar para quem foi gerado" />
              <div>
                <label className="ds-label mb-2 block">Validade do link</label>
                <div className="grid grid-cols-4 gap-2">
                  {[{ label: "1h", value: "1" }, { label: "24h", value: "24" }, { label: "48h", value: "48" }, { label: "7 dias", value: "168" }].map(opt => (
                    <button key={opt.value} type="button" onClick={() => setInviteHours(opt.value)}
                      className={`py-2 rounded-xl text-xs font-black border transition-all ${inviteHours === opt.value ? "bg-[#0D1B3E] border-[#0D1B3E] text-amber-400" : "border-zinc-200 text-slate-600 hover:border-zinc-400"}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <ModalFooter>
              <Button variant="ghost" onClick={() => setShowNewInvite(false)}>Cancelar</Button>
              <Button variant="primary" loading={creatingInvite} onClick={handleCreateInvite}>Gerar link</Button>
            </ModalFooter>
          </>
        )}
      </Modal>

      {/* Modal: Criar/Editar plano */}
      <Modal isOpen={showPlanModal} onClose={() => setShowPlanModal(false)} title={editingPlan ? "Editar Plano" : "Novo Plano"} size="sm">
        <div className="space-y-4">
          <Input label="Nome do plano" value={planForm.name} onChange={e => setPlanForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Starter, Pro, Enterprise" />
          <Input label="Descrição (opcional)" value={planForm.description} onChange={e => setPlanForm(f => ({ ...f, description: e.target.value }))} placeholder="Descrição resumida do plano" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Preço (R$)" type="number" value={planForm.price} onChange={e => setPlanForm(f => ({ ...f, price: e.target.value }))} placeholder="0,00" />
            <div>
              <label className="ds-label mb-2 block">Duração</label>
              <div className="grid grid-cols-2 gap-1.5">
                {[{ label: "30d", value: "30" }, { label: "60d", value: "60" }, { label: "90d", value: "90" }, { label: "365d", value: "365" }].map(opt => (
                  <button key={opt.value} type="button" onClick={() => setPlanForm(f => ({ ...f, durationDays: opt.value }))}
                    className={`py-1.5 rounded-lg text-xs font-black border transition-all ${planForm.durationDays === opt.value ? "bg-[#0D1B3E] border-[#0D1B3E] text-amber-400" : "border-zinc-200 text-slate-600 hover:border-zinc-400"}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="ds-label mb-1.5 block">Funcionalidades (uma por linha)</label>
            <textarea
              value={planForm.features}
              onChange={e => setPlanForm(f => ({ ...f, features: e.target.value }))}
              placeholder={"PDV ilimitado\nWhatsApp Bot\nRelatórios avançados"}
              rows={4}
              className="w-full rounded-[10px] border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm text-slate-800 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 resize-none"
            />
          </div>
          <div className="flex items-center gap-3">
            <div>
              <label className="ds-label mb-1.5 block">Cor do plano</label>
              <input type="color" value={planForm.color} onChange={e => setPlanForm(f => ({ ...f, color: e.target.value }))} className="h-10 w-20 rounded-xl border border-zinc-200 cursor-pointer" />
            </div>
          </div>

          {/* Permissões padrão para novos membros da equipe */}
          <div>
            <label className="ds-label mb-2 block">Permissões padrão de equipe (staff/admin)</label>
            <p className="text-[10px] text-slate-400 mb-3">Define quais telas os membros adicionados por clientes deste plano poderão acessar por padrão.</p>
            <div
              onClick={() => setPlanDefaultPerms(null)}
              className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all mb-3 ${planDefaultPerms === null ? "bg-[#0D1B3E] border-[#0D1B3E] text-white" : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300"}`}
            >
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${planDefaultPerms === null ? "border-white bg-white" : "border-slate-300"}`}>
                {planDefaultPerms === null && <div className="w-2 h-2 rounded-full bg-[#0D1B3E]" />}
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest">Acesso total por padrão</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "overview", label: "Visão Geral" }, { id: "pos", label: "PDV — Caixa" },
                { id: "live-orders", label: "Painel Pedidos" }, { id: "kds", label: "Monitor Cozinha" },
                { id: "tables", label: "Mesas" }, { id: "history", label: "Histórico" },
                { id: "menu", label: "Cardápio" }, { id: "inventory", label: "Estoque" },
                { id: "finance", label: "Financeiro" }, { id: "reports", label: "Relatórios" },
                { id: "production", label: "Produção" },
                { id: "customers", label: "CRM" }, { id: "whatsapp", label: "WhatsApp" },
                { id: "downloads", label: "Downloads" },
              ].map(tab => {
                const enabled = planDefaultPerms === null || planDefaultPerms.includes(tab.id);
                return (
                  <button key={tab.id} type="button"
                    onClick={() => {
                      if (planDefaultPerms === null) {
                        const all = ["overview","pos","live-orders","kds","tables","history","menu","inventory","production","finance","reports","customers","whatsapp","downloads"];
                        setPlanDefaultPerms(all.filter(t => t !== tab.id));
                      } else {
                        const has = planDefaultPerms.includes(tab.id);
                        setPlanDefaultPerms(has ? planDefaultPerms.filter(p => p !== tab.id) : [...planDefaultPerms, tab.id]);
                      }
                    }}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all ${enabled ? "bg-white border-amber-300 text-slate-800" : "bg-slate-50 border-slate-100 text-slate-400"}`}
                  >
                    <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center shrink-0 ${enabled ? "bg-amber-400 border-amber-400" : "border-slate-300"}`}>
                      {enabled && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
                    </div>
                    <span className="text-[9px] font-black leading-tight">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowPlanModal(false)}>Cancelar</Button>
          <Button variant="primary" loading={savingPlan} onClick={handleSavePlan}>{editingPlan ? "Salvar" : "Criar plano"}</Button>
        </ModalFooter>
      </Modal>

      {/* Modal: Nova assinatura */}
      <Modal isOpen={showSubModal} onClose={() => setShowSubModal(false)} title="Nova Assinatura" size="sm">
        <div className="space-y-4">
          <div>
            <label className="ds-label mb-1.5 block">Conta</label>
            <select
              value={subForm.accountId}
              onChange={e => setSubForm(f => ({ ...f, accountId: e.target.value }))}
              className="w-full h-10 rounded-[10px] border border-zinc-200 bg-zinc-50 px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
            >
              <option value="">Selecione uma conta...</option>
              {accounts.filter(a => !a.isSuperAdmin).map(a => (
                <option key={a.id} value={a.id}>{a.name} — {a.email}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="ds-label mb-1.5 block">Plano</label>
            <select
              value={subForm.planId}
              onChange={e => {
                const plan = stats?.plans.find(p => p.id === e.target.value);
                setSubForm(f => ({ ...f, planId: e.target.value, pricePaid: plan ? String(plan.price) : f.pricePaid }));
              }}
              className="w-full h-10 rounded-[10px] border border-zinc-200 bg-zinc-50 px-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
            >
              <option value="">Selecione um plano...</option>
              {(stats?.plans ?? []).filter(p => p.isActive).map(p => (
                <option key={p.id} value={p.id}>{p.name} — {fmt(p.price)} / {p.durationDays}d</option>
              ))}
            </select>
          </div>
          <Input label="Valor cobrado (R$)" type="number" value={subForm.pricePaid} onChange={e => setSubForm(f => ({ ...f, pricePaid: e.target.value }))} placeholder="0,00" hint="Deixe em branco para usar o preço do plano" />
          <Input label="Observações (opcional)" value={subForm.notes} onChange={e => setSubForm(f => ({ ...f, notes: e.target.value }))} placeholder="Ex: Desconto de inauguração" />
        </div>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowSubModal(false)}>Cancelar</Button>
          <Button variant="primary" loading={savingSub} onClick={handleCreateSub} disabled={!subForm.accountId || !subForm.planId}>Criar assinatura</Button>
        </ModalFooter>
      </Modal>

      {/* Modal: Trocar senha */}
      <Modal isOpen={!!resetPasswordAccount} onClose={() => setResetPasswordAccount(null)} title="Trocar senha" size="sm">
        <p className="text-sm text-slate-500 -mt-2 mb-4">
          Defina uma nova senha para <span className="font-bold text-slate-700">{resetPasswordAccount?.name}</span> ({resetPasswordAccount?.email}). A senha atual será substituída imediatamente, sem precisar confirmá-la.
        </p>
        <Input
          label="Nova senha"
          type="password"
          value={newPassword}
          onChange={e => { setNewPassword(e.target.value); setResetPasswordError(""); }}
          placeholder="Mínimo 6 caracteres"
        />
        {resetPasswordError && <p className="text-xs text-red-500 font-bold mt-2">{resetPasswordError}</p>}
        <ModalFooter>
          <Button variant="ghost" onClick={() => setResetPasswordAccount(null)}>Cancelar</Button>
          <Button variant="primary" loading={resettingPassword} onClick={handleResetPassword}>Trocar senha</Button>
        </ModalFooter>
      </Modal>

      {/* Modal: Remover conta */}
      <Modal isOpen={!!deleteAccountId} onClose={() => setDeleteAccountId(null)} title="Remover conta" size="sm">
        <p className="text-sm text-slate-500 -mt-2 mb-4">Esta ação é irreversível. A conta e todos os dados associados serão removidos.</p>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setDeleteAccountId(null)}>Cancelar</Button>
          <Button variant="danger" loading={deleting} onClick={handleDeleteAccount}>Remover conta</Button>
        </ModalFooter>
      </Modal>

      {/* Modal: Revogar convite */}
      <Modal isOpen={!!deleteInviteId} onClose={() => setDeleteInviteId(null)} title="Revogar convite" size="sm">
        <p className="text-sm text-slate-500 -mt-2 mb-4">O link será invalidado e não poderá mais ser usado para criar conta.</p>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setDeleteInviteId(null)}>Cancelar</Button>
          <Button variant="danger" loading={deleting} onClick={handleRevokeInvite}>Revogar convite</Button>
        </ModalFooter>
      </Modal>

      {/* Modal: Cancelar assinatura */}
      <Modal isOpen={!!deleteSubId} onClose={() => setDeleteSubId(null)} title="Cancelar assinatura" size="sm">
        <p className="text-sm text-slate-500 -mt-2 mb-4">A assinatura será cancelada. O acesso do cliente pode ser afetado.</p>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setDeleteSubId(null)}>Cancelar</Button>
          <Button variant="danger" loading={deleting} onClick={handleCancelSub}>Confirmar cancelamento</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
