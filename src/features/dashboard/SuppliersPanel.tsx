import { useEffect, useState, useCallback } from "react";
import {
  Building2,
  ChevronDown,
  Edit2,
  ExternalLink,
  Grid3X3,
  Heart,
  List,
  Loader2,
  Phone,
  Plus,
  Search,
  Star,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import type { InventoryItem, Supplier, SupplierType, Tenant } from "../../types";

interface Props {
  tenant: Tenant;
}

const SUPPLIER_TYPES: { value: SupplierType; label: string; color: string }[] = [
  { value: "ALIMENTICIO", label: "Alimentício",  color: "bg-green-100 text-green-700"  },
  { value: "BEBIDAS",     label: "Bebidas",      color: "bg-blue-100 text-blue-700"    },
  { value: "EMBALAGENS",  label: "Embalagens",   color: "bg-yellow-100 text-yellow-700"},
  { value: "LIMPEZA",     label: "Limpeza",      color: "bg-purple-100 text-purple-700"},
  { value: "EQUIPAMENTOS",label: "Equipamentos", color: "bg-orange-100 text-orange-700"},
  { value: "OUTROS",      label: "Outros",       color: "bg-slate-100 text-slate-600"  },
];

function typeLabel(type: SupplierType) {
  return SUPPLIER_TYPES.find((t) => t.value === type)?.label ?? type;
}
function typeColor(type: SupplierType) {
  return SUPPLIER_TYPES.find((t) => t.value === type)?.color ?? "bg-slate-100 text-slate-600";
}

function fmtPhone(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return phone;
}

function maskPhone(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0,2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
}

function maskCpfCnpj(value: string) {
  const d = value.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) {
    // CPF: 000.000.000-00
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
    return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
  }
  // CNPJ: 00.000.000/0000-00
  if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
}

function whatsappUrl(phone: string) {
  const d = phone.replace(/\D/g, "");
  const num = d.startsWith("55") ? d : `55${d}`;
  return `https://wa.me/${num}`;
}

// ─── CEP lookup ──────────────────────────────────────────────────────────────

async function fetchCep(cep: string) {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    const data = await res.json();
    if (data.erro) return null;
    return data;
  } catch {
    return null;
  }
}

// ─── Blank form ───────────────────────────────────────────────────────────────

function blankForm(): Omit<Supplier, "id" | "tenantId" | "createdAt" | "updatedAt"> & { inventoryItemIds: string[] } {
  return {
    name: "",
    cpfCnpj: "",
    type: "OUTROS",
    phone: "",
    email: "",
    cep: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    country: "Brasil",
    notes: "",
    isFavorite: false,
    isActive: true,
    inventoryItemIds: [],
  };
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ModalProps {
  supplier: Supplier | null;
  inventoryItems: InventoryItem[];
  onClose: () => void;
  onSaved: () => void;
  slug: string;
}

function SupplierModal({ supplier, inventoryItems, onClose, onSaved, slug }: ModalProps) {
  const token = localStorage.getItem("auth_token") ?? "";
  const isEdit = !!supplier;
  const [form, setForm] = useState(() => {
    if (supplier) {
      return {
        name: supplier.name,
        cpfCnpj: supplier.cpfCnpj ?? "",
        type: supplier.type,
        phone: supplier.phone ?? "",
        email: supplier.email ?? "",
        cep: supplier.cep ?? "",
        street: supplier.street ?? "",
        number: supplier.number ?? "",
        complement: supplier.complement ?? "",
        neighborhood: supplier.neighborhood ?? "",
        city: supplier.city ?? "",
        state: supplier.state ?? "",
        country: supplier.country ?? "Brasil",
        notes: supplier.notes ?? "",
        isFavorite: supplier.isFavorite,
        isActive: supplier.isActive,
        inventoryItemIds: supplier.inventoryItems?.map((i) => i.inventoryItemId) ?? [],
      };
    }
    return blankForm();
  });
  const [cepLoading, setCepLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  async function handleCepBlur() {
    const digits = form.cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepLoading(true);
    const data = await fetchCep(digits);
    setCepLoading(false);
    if (data) {
      setForm((f) => ({
        ...f,
        street: data.logradouro ?? f.street,
        neighborhood: data.bairro ?? f.neighborhood,
        city: data.localidade ?? f.city,
        state: data.uf ?? f.state,
      }));
    }
  }

  function toggleItem(id: string) {
    setForm((f) => ({
      ...f,
      inventoryItemIds: f.inventoryItemIds.includes(id)
        ? f.inventoryItemIds.filter((x) => x !== id)
        : [...f.inventoryItemIds, id],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Nome é obrigatório."); return; }
    setSaving(true); setError("");
    try {
      const url = isEdit
        ? `/api/tenants/${slug}/suppliers/${supplier!.id}`
        : `/api/tenants/${slug}/suppliers`;
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? "Erro ao salvar"); }
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">{isEdit ? "Editar" : "Novo"} Fornecedor</p>
            <h2 className="text-xl font-black text-slate-800">{isEdit ? supplier!.name : "Cadastrar fornecedor"}</h2>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && <p className="text-sm text-red-500 bg-red-50 px-4 py-2 rounded-xl">{error}</p>}

          {/* Nome + Tipo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-1">
              <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Nome *</label>
              <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Distribuidora XYZ" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40 focus:border-[#C9A227]" />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Tipo</label>
              <div className="relative">
                <select value={form.type} onChange={(e) => set("type", e.target.value)} className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40 focus:border-[#C9A227] appearance-none bg-white">
                  {SUPPLIER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* CPF/CNPJ + Telefone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">CPF / CNPJ</label>
              <input value={form.cpfCnpj ?? ""} onChange={(e) => set("cpfCnpj", maskCpfCnpj(e.target.value))} placeholder="000.000.000-00 ou 00.000.000/0000-00" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40 focus:border-[#C9A227]" />
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Telefone / WhatsApp</label>
              <input value={form.phone ?? ""} onChange={(e) => set("phone", maskPhone(e.target.value))} placeholder="(11) 99999-9999" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40 focus:border-[#C9A227]" />
            </div>
          </div>

          {/* E-mail */}
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">E-mail</label>
            <input type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} placeholder="contato@fornecedor.com" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40 focus:border-[#C9A227]" />
          </div>

          {/* Endereço */}
          <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-black uppercase tracking-widest text-slate-400">Endereço</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="col-span-1">
                <label className="block text-xs text-slate-500 mb-1">CEP</label>
                <div className="relative">
                  <input
                    value={form.cep ?? ""}
                    onChange={(e) => set("cep", e.target.value)}
                    onBlur={handleCepBlur}
                    placeholder="00000-000"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40 focus:border-[#C9A227] bg-white"
                  />
                  {cepLoading && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-slate-400" />}
                </div>
              </div>
              <div className="col-span-1 sm:col-span-2">
                <label className="block text-xs text-slate-500 mb-1">Logradouro</label>
                <input value={form.street ?? ""} onChange={(e) => set("street", e.target.value)} placeholder="Rua Exemplo" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40 focus:border-[#C9A227] bg-white" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Número</label>
                <input value={form.number ?? ""} onChange={(e) => set("number", e.target.value)} placeholder="123" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40 focus:border-[#C9A227] bg-white" />
              </div>
              <div className="col-span-1 sm:col-span-1">
                <label className="block text-xs text-slate-500 mb-1">Complemento</label>
                <input value={form.complement ?? ""} onChange={(e) => set("complement", e.target.value)} placeholder="Sala 2" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40 focus:border-[#C9A227] bg-white" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Bairro</label>
                <input value={form.neighborhood ?? ""} onChange={(e) => set("neighborhood", e.target.value)} placeholder="Centro" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40 focus:border-[#C9A227] bg-white" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Cidade</label>
                <input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} placeholder="São Paulo" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40 focus:border-[#C9A227] bg-white" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Estado (UF)</label>
                <input value={form.state ?? ""} onChange={(e) => set("state", e.target.value)} placeholder="SP" maxLength={2} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40 focus:border-[#C9A227] bg-white uppercase" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">País</label>
                <input value={form.country ?? "Brasil"} onChange={(e) => set("country", e.target.value)} placeholder="Brasil" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40 focus:border-[#C9A227] bg-white" />
              </div>
            </div>
          </div>

          {/* Itens de estoque vinculados */}
          {inventoryItems.length > 0 && (
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Insumos fornecidos</label>
              <div className="max-h-40 overflow-y-auto space-y-1 border border-slate-200 rounded-xl p-2">
                {inventoryItems.map((item) => (
                  <label key={item.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.inventoryItemIds.includes(item.id)}
                      onChange={() => toggleItem(item.id)}
                      className="accent-[#C9A227] w-4 h-4"
                    />
                    <span className="text-sm text-slate-700">{item.name}</span>
                    {item.unit && <span className="text-xs text-slate-400 ml-auto">{item.unit}</span>}
                  </label>
                ))}
              </div>
              {form.inventoryItemIds.length > 0 && (
                <p className="text-xs text-slate-400 mt-1">{form.inventoryItemIds.length} insumo(s) vinculado(s)</p>
              )}
            </div>
          )}

          {/* Observações */}
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-1.5">Observações</label>
            <textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} rows={3} placeholder="Prazo de entrega, condições de pagamento..." className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40 focus:border-[#C9A227]" />
          </div>

          {/* Favorito + Ativo */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={form.isFavorite} onChange={(e) => set("isFavorite", e.target.checked)} className="accent-[#C9A227] w-4 h-4" />
              <span className="text-sm text-slate-600 font-medium">Favorito</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} className="accent-[#C9A227] w-4 h-4" />
              <span className="text-sm text-slate-600 font-medium">Ativo</span>
            </label>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100">
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors">Cancelar</button>
          <button onClick={handleSubmit} disabled={saving} className="px-6 py-2.5 rounded-xl text-sm font-black bg-[#C9A227] hover:bg-[#b8911f] text-white shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? "Salvar alterações" : "Cadastrar fornecedor"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Card view ────────────────────────────────────────────────────────────────

function SupplierCard({ supplier, onEdit, onDelete, onToggleFavorite }: {
  supplier: Supplier;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
}) {
  const itemCount = supplier.inventoryItems?.length ?? 0;
  return (
    <div className={`relative bg-white rounded-2xl border ${supplier.isActive ? "border-slate-200" : "border-slate-100 opacity-60"} p-5 flex flex-col gap-4 hover:shadow-md transition-all`}>
      {/* Favorite badge */}
      <button onClick={onToggleFavorite} className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-slate-50 transition-colors">
        {supplier.isFavorite
          ? <Star className="w-4 h-4 fill-[#C9A227] text-[#C9A227]" />
          : <Star className="w-4 h-4 text-slate-300" />}
      </button>

      {/* Avatar + name */}
      <div className="flex items-start gap-3 pr-8">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center shrink-0">
          <Truck className="w-6 h-6 text-slate-400" />
        </div>
        <div className="min-w-0">
          <p className="font-black text-slate-800 text-base leading-tight truncate">{supplier.name}</p>
          <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${typeColor(supplier.type)}`}>
            {typeLabel(supplier.type)}
          </span>
        </div>
      </div>

      {/* Contact info */}
      <div className="space-y-1.5">
        {supplier.phone && (
          <div className="flex items-center gap-2">
            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-sm text-slate-600 truncate">{fmtPhone(supplier.phone)}</span>
          </div>
        )}
        {supplier.city && (
          <div className="flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-sm text-slate-500 truncate">{[supplier.city, supplier.state].filter(Boolean).join(" / ")}</span>
          </div>
        )}
        {itemCount > 0 && (
          <div className="flex items-center gap-2">
            <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-xs text-slate-400">{itemCount} insumo{itemCount !== 1 ? "s" : ""} vinculado{itemCount !== 1 ? "s" : ""}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
        {supplier.phone && (
          <a
            href={whatsappUrl(supplier.phone)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green-50 hover:bg-green-100 text-green-700 text-xs font-black transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            WhatsApp
          </a>
        )}
        <button onClick={onEdit} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
          <Edit2 className="w-4 h-4 text-slate-400" />
        </button>
        <button onClick={onDelete} className="p-2 rounded-xl hover:bg-red-50 transition-colors">
          <Trash2 className="w-4 h-4 text-red-400" />
        </button>
      </div>
    </div>
  );
}

// ─── Row view ─────────────────────────────────────────────────────────────────

function SupplierRow({ supplier, onEdit, onDelete, onToggleFavorite }: {
  supplier: Supplier;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
}) {
  const itemCount = supplier.inventoryItems?.length ?? 0;
  return (
    <div className={`flex items-center gap-4 px-4 py-3 bg-white rounded-xl border ${supplier.isActive ? "border-slate-200" : "border-slate-100 opacity-60"} hover:border-slate-300 transition-all`}>
      <button onClick={onToggleFavorite} className="p-1 shrink-0">
        {supplier.isFavorite
          ? <Star className="w-4 h-4 fill-[#C9A227] text-[#C9A227]" />
          : <Star className="w-4 h-4 text-slate-300" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-slate-800 text-sm truncate">{supplier.name}</p>
        {(supplier.city || supplier.phone) && (
          <p className="text-xs text-slate-400 truncate mt-0.5">
            {[supplier.city && `${supplier.city}${supplier.state ? `/${supplier.state}` : ""}`, supplier.phone && fmtPhone(supplier.phone)].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
      <span className={`hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide shrink-0 ${typeColor(supplier.type)}`}>
        {typeLabel(supplier.type)}
      </span>
      {itemCount > 0 && (
        <span className="hidden md:inline-block text-xs text-slate-400 shrink-0">{itemCount} insumo{itemCount !== 1 ? "s" : ""}</span>
      )}
      <div className="flex items-center gap-1 shrink-0">
        {supplier.phone && (
          <a href={whatsappUrl(supplier.phone)} target="_blank" rel="noopener noreferrer"
            className="p-1.5 rounded-xl bg-green-50 hover:bg-green-100 text-green-700 transition-colors">
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          </a>
        )}
        <button onClick={onEdit} className="p-1.5 rounded-xl hover:bg-slate-100 transition-colors">
          <Edit2 className="w-3.5 h-3.5 text-slate-400" />
        </button>
        <button onClick={onDelete} className="p-1.5 rounded-xl hover:bg-red-50 transition-colors">
          <Trash2 className="w-3.5 h-3.5 text-red-400" />
        </button>
      </div>
    </div>
  );
}

// ─── Delete confirm ───────────────────────────────────────────────────────────

function DeleteConfirm({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl p-7 w-full max-w-sm text-center space-y-5">
        <div className="w-16 h-16 rounded-3xl bg-red-50 flex items-center justify-center mx-auto">
          <Trash2 className="w-8 h-8 text-red-400" />
        </div>
        <div>
          <p className="font-black text-slate-800 text-lg">Remover fornecedor?</p>
          <p className="text-sm text-slate-500 mt-1"><strong>{name}</strong> será removido permanentemente.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Cancelar</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-black transition-colors">Remover</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function SuppliersPanel({ tenant }: Props) {
  const token = localStorage.getItem("auth_token") ?? "";
  const slug = tenant.slug;
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<SupplierType | "ALL">("ALL");
  const [filterFav, setFilterFav] = useState(false);
  const [filterInactive, setFilterInactive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Supplier | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, iRes] = await Promise.all([
        fetch(`/api/tenants/${slug}/suppliers`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/tenants/${slug}/inventory`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (sRes.ok) setSuppliers(await sRes.json());
      if (iRes.ok) setInventoryItems(await iRes.json());
    } finally {
      setLoading(false);
    }
  }, [slug, token]);

  useEffect(() => { load(); }, [load]);

  async function toggleFavorite(supplier: Supplier) {
    await fetch(`/api/tenants/${slug}/suppliers/${supplier.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...supplier, isFavorite: !supplier.isFavorite, inventoryItemIds: supplier.inventoryItems?.map((i) => i.inventoryItemId) ?? [] }),
    });
    load();
  }

  async function doDelete(supplier: Supplier) {
    await fetch(`/api/tenants/${slug}/suppliers/${supplier.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setDeleteTarget(null);
    load();
  }

  const filtered = suppliers.filter((s) => {
    if (!filterInactive && !s.isActive) return false;
    if (filterFav && !s.isFavorite) return false;
    if (filterType !== "ALL" && s.type !== filterType) return false;
    if (search) {
      const q = search.toLowerCase();
      return s.name.toLowerCase().includes(q) || (s.city ?? "").toLowerCase().includes(q) || (s.phone ?? "").includes(q);
    }
    return true;
  });

  const favCount = suppliers.filter((s) => s.isFavorite && s.isActive).length;

  return (
    <div className="space-y-6">
      {/* Header banner */}
      <div className="bg-[#0D1B3E] rounded-[28px] sm:rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-[#0D1B3E]/20 flex flex-col items-start gap-5 sm:flex-row sm:justify-between sm:items-center overflow-hidden relative">
        <div className="relative z-10 max-w-md">
          <h3 className="text-2xl sm:text-3xl font-black tracking-tight mb-2">Fornecedores</h3>
          <p className="text-[#C9A227]/80 font-medium text-sm sm:text-base">
            Gerencie contatos, chame via WhatsApp e vincule insumos ao estoque.
          </p>
        </div>
        <Truck className="w-24 h-24 sm:w-32 sm:h-32 absolute -right-6 -bottom-6 sm:-right-8 sm:-bottom-8 text-[#C9A227]/15 -rotate-12" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar fornecedor..."
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A227]/30 focus:border-[#C9A227]"
          />
        </div>

        {/* Type filter */}
        <div className="relative">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as SupplierType | "ALL")}
            className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A227]/30 appearance-none bg-white pr-8 pl-3"
          >
            <option value="ALL">Todos os tipos</option>
            {SUPPLIER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        </div>

        {/* Fav filter */}
        <button
          onClick={() => setFilterFav((v) => !v)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${filterFav ? "bg-[#C9A227]/10 border-[#C9A227] text-[#C9A227]" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
        >
          <Heart className={`w-4 h-4 ${filterFav ? "fill-[#C9A227]" : ""}`} />
          Favoritos {favCount > 0 && <span className="text-xs">({favCount})</span>}
        </button>

        {/* View toggle */}
        <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden">
          <button onClick={() => setViewMode("grid")} className={`px-3 py-2.5 ${viewMode === "grid" ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-50"} transition-colors`}>
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button onClick={() => setViewMode("list")} className={`px-3 py-2.5 ${viewMode === "list" ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-50"} transition-colors`}>
            <List className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={() => { setEditTarget(null); setModalOpen(true); }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C9A227] hover:bg-[#b8911f] text-white text-sm font-black shadow-sm transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Novo fornecedor
        </button>
      </div>

      {/* Show inactive toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilterInactive((v) => !v)}
          className={`text-xs font-semibold px-3 py-1 rounded-lg transition-colors ${filterInactive ? "bg-slate-200 text-slate-700" : "text-slate-400 hover:text-slate-600"}`}
        >
          {filterInactive ? "Ocultar inativos" : "Mostrar inativos"}
        </button>
        <span className="text-xs text-slate-400">{filtered.length} fornecedor{filtered.length !== 1 ? "es" : ""}</span>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center">
            <Truck className="w-10 h-10 text-slate-300" />
          </div>
          <div>
            <p className="font-black text-slate-600 text-lg">{search || filterType !== "ALL" || filterFav ? "Nenhum fornecedor encontrado" : "Nenhum fornecedor cadastrado"}</p>
            <p className="text-sm text-slate-400 mt-1">
              {search || filterType !== "ALL" || filterFav ? "Tente ajustar os filtros." : "Clique em \"Novo fornecedor\" para começar."}
            </p>
          </div>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => (
            <SupplierCard
              key={s.id}
              supplier={s}
              onEdit={() => { setEditTarget(s); setModalOpen(true); }}
              onDelete={() => setDeleteTarget(s)}
              onToggleFavorite={() => toggleFavorite(s)}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <SupplierRow
              key={s.id}
              supplier={s}
              onEdit={() => { setEditTarget(s); setModalOpen(true); }}
              onDelete={() => setDeleteTarget(s)}
              onToggleFavorite={() => toggleFavorite(s)}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <SupplierModal
          supplier={editTarget}
          inventoryItems={inventoryItems}
          slug={slug}
          onClose={() => { setModalOpen(false); setEditTarget(null); }}
          onSaved={() => { setModalOpen(false); setEditTarget(null); load(); }}
        />
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <DeleteConfirm
          name={deleteTarget.name}
          onConfirm={() => doDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
