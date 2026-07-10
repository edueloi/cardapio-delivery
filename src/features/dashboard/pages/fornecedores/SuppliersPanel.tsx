import { useEffect, useState, useCallback, useRef } from "react";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Edit2,
  Grid3X3,
  Heart,
  List,
  Loader2,
  Minus,
  Package,
  Phone,
  Plus,
  Search,
  ShoppingCart,
  Star,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import type { InventoryItem, Supplier, SupplierCatalogItem, SupplierType, Tenant } from "../../../../types";
import { Modal, ModalFooter, Button, Input, Select } from "../../../../components";
import { apiJson } from "../../../../lib/api";
import SupplierProductsModal from "./SupplierProductsModal";

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
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
    return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
  }
  if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
}

function whatsappUrl(phone: string, message?: string) {
  const d = phone.replace(/\D/g, "");
  const num = d.startsWith("55") ? d : `55${d}`;
  return `https://wa.me/${num}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

function fmtPrice(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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

// ─── Supplier Modal ───────────────────────────────────────────────────────────

interface SupplierModalProps {
  supplier: Supplier | null;
  inventoryItems: InventoryItem[];
  onClose: () => void;
  onSaved: () => void;
  slug: string;
}

function SupplierModal({ supplier, inventoryItems, onClose, onSaved, slug }: SupplierModalProps) {
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
  const [showProductsModal, setShowProductsModal] = useState(false);
  const [catalogItems, setCatalogItems] = useState<SupplierCatalogItem[]>([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  // Products selected before supplier is saved (new supplier flow)
  const [pendingProducts, setPendingProducts] = useState<{ name: string; unit: string }[]>([]);

  // Load catalog items when editing an existing supplier
  useEffect(() => {
    if (supplier && !catalogLoaded) {
      apiJson<SupplierCatalogItem[]>(`/api/tenants/${slug}/suppliers/${supplier.id}/catalog`)
        .then(items => { setCatalogItems(Array.isArray(items) ? items : []); setCatalogLoaded(true); })
        .catch(() => { setCatalogItems([]); setCatalogLoaded(true); });
    }
  }, [supplier, slug, catalogLoaded]);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError("Nome é obrigatório."); return; }
    setSaving(true); setError("");
    try {
      const url = isEdit
        ? `/api/tenants/${slug}/suppliers/${supplier!.id}`
        : `/api/tenants/${slug}/suppliers`;
      const saved = await apiJson<{ id: string }>(url, { method: isEdit ? "PUT" : "POST", body: JSON.stringify(form) });

      // After creating a new supplier, save any pending products
      if (!isEdit && pendingProducts.length > 0 && saved?.id) {
        await Promise.all(
          pendingProducts.map(p =>
            apiJson(`/api/tenants/${slug}/suppliers/${saved.id}/catalog`, {
              method: "POST",
              body: JSON.stringify({ name: p.name, unit: p.unit || null, price: null, notes: null }),
            }).catch(() => null)
          )
        );
      }

      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isEdit ? `Editar — ${supplier!.name}` : "Novo Fornecedor"}
      size="lg"
      mobileStyle="fullscreen"
      footer={
        <ModalFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="primary" loading={saving} onClick={handleSubmit}>
            {isEdit ? "Salvar alterações" : "Cadastrar"}
          </Button>
        </ModalFooter>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 py-1">
        {error && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-100">
            <div className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
            <p className="text-sm text-red-600 font-medium">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Nome *" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Distribuidora XYZ" />
          <Select label="Tipo" value={form.type} onChange={(e) => set("type", e.target.value)}>
            {SUPPLIER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="CPF / CNPJ" value={form.cpfCnpj ?? ""} onChange={(e) => set("cpfCnpj", maskCpfCnpj(e.target.value))} placeholder="000.000.000-00" inputMode="numeric" />
          <Input label="Telefone / WhatsApp" value={form.phone ?? ""} onChange={(e) => set("phone", maskPhone(e.target.value))} placeholder="(11) 99999-9999" inputMode="numeric" />
        </div>

        <Input label="E-mail" type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} placeholder="contato@fornecedor.com" />

        <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Endereço</p>
          <div className="grid grid-cols-2 gap-3">
            <Input label="CEP" value={form.cep ?? ""} onChange={(e) => set("cep", e.target.value)} onBlur={handleCepBlur} placeholder="00000-000" inputMode="numeric" iconRight={cepLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" /> : undefined} />
            <Input label="Número" value={form.number ?? ""} onChange={(e) => set("number", e.target.value)} placeholder="123" />
          </div>
          <Input label="Logradouro" value={form.street ?? ""} onChange={(e) => set("street", e.target.value)} placeholder="Rua Exemplo" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Complemento" value={form.complement ?? ""} onChange={(e) => set("complement", e.target.value)} placeholder="Sala 2" />
            <Input label="Bairro" value={form.neighborhood ?? ""} onChange={(e) => set("neighborhood", e.target.value)} placeholder="Centro" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Cidade" value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} placeholder="São Paulo" />
            <Input label="Estado (UF)" value={form.state ?? ""} onChange={(e) => set("state", e.target.value.toUpperCase())} placeholder="SP" maxLength={2} />
          </div>
        </div>

        {/* Produtos/insumos do fornecedor */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-500">Produtos fornecidos</p>
              {(catalogItems.length > 0 || pendingProducts.length > 0) && (
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {isEdit ? catalogItems.length : pendingProducts.length} produto{(isEdit ? catalogItems.length : pendingProducts.length) !== 1 ? "s" : ""} selecionado{(isEdit ? catalogItems.length : pendingProducts.length) !== 1 ? "s" : ""}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowProductsModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#C9A227] hover:bg-[#b8911f] text-white text-xs font-black transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              {(isEdit ? catalogItems.length : pendingProducts.length) > 0 ? "Gerenciar produtos" : "Adicionar produtos"}
            </button>
          </div>
          {isEdit && catalogItems.length > 0 ? (
            <div className="max-h-40 overflow-y-auto divide-y divide-slate-50">
              {catalogItems.map(item => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                  <Package className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  <span className="text-sm text-slate-700 flex-1 truncate">{item.name}</span>
                  {item.unit && <span className="text-xs text-slate-400 shrink-0">{item.unit}</span>}
                  {item.price != null && (
                    <span className="text-xs font-bold text-[#C9A227] shrink-0">
                      R$ {item.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : !isEdit && pendingProducts.length > 0 ? (
            <div className="max-h-40 overflow-y-auto divide-y divide-slate-50">
              {pendingProducts.map((item, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <Package className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  <span className="text-sm text-slate-700 flex-1 truncate">{item.name}</span>
                  {item.unit && <span className="text-xs text-slate-400 shrink-0">{item.unit}</span>}
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-5 text-center">
              <p className="text-sm text-slate-400">Nenhum produto selecionado ainda.</p>
            </div>
          )}
        </div>

        {/* Products modal */}
        {showProductsModal && (
          <SupplierProductsModal
            supplierId={supplier?.id ?? null}
            supplierName={form.name || "Novo fornecedor"}
            slug={slug}
            existingItems={isEdit ? catalogItems : pendingProducts.map((p, i) => ({ id: String(i), supplierId: "", name: p.name, unit: p.unit, price: null, notes: null, sortOrder: i, createdAt: "", updatedAt: "" }))}
            onClose={() => setShowProductsModal(false)}
            onSaved={(items) => { setCatalogItems(items); setShowProductsModal(false); }}
            onPendingSelected={(items) => { setPendingProducts(items); setShowProductsModal(false); }}
          />
        )}

        <div>
          <p className="ds-label mb-1.5">Observações</p>
          <textarea
            value={form.notes ?? ""}
            onChange={(e) => set("notes", e.target.value)}
            rows={3}
            placeholder="Prazo de entrega, condições de pagamento..."
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#C9A227]/40 focus:border-[#C9A227] bg-white"
          />
        </div>

        <div className="flex items-center gap-6 pt-1">
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
    </Modal>
  );
}

// ─── Catalog Item Form ────────────────────────────────────────────────────────

interface CatalogItemFormProps {
  item: SupplierCatalogItem | null;
  onSave: (data: { name: string; unit: string; price: string; notes: string }) => Promise<void>;
  onCancel: () => void;
}

function CatalogItemForm({ item, onSave, onCancel }: CatalogItemFormProps) {
  const [name, setName] = useState(item?.name ?? "");
  const [unit, setUnit] = useState(item?.unit ?? "");
  const [price, setPrice] = useState(item?.price != null ? String(item.price) : "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onSave({ name: name.trim(), unit, price, notes });
    setSaving(false);
  }

  return (
    <form onSubmit={handle} className="bg-slate-50 rounded-2xl p-4 space-y-3 border border-slate-200">
      <p className="text-xs font-black uppercase tracking-widest text-slate-500">{item ? "Editar item" : "Novo item"}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do produto *"
          required
          className="col-span-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A227]/30 focus:border-[#C9A227] bg-white"
        />
        <input
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="Unidade (kg, L, cx...)"
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A227]/30 focus:border-[#C9A227] bg-white"
        />
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value.replace(",", "."))}
          placeholder="Preço estimado (R$)"
          type="number"
          step="0.01"
          min="0"
          className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A227]/30 focus:border-[#C9A227] bg-white"
        />
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Observação (opcional)"
          className="col-span-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A227]/30 focus:border-[#C9A227] bg-white"
        />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-100 transition-colors">Cancelar</button>
        <button type="submit" disabled={saving || !name.trim()} className="flex-1 py-2 rounded-xl bg-[#0A1628] text-white text-sm font-bold hover:bg-[#1a2d4e] transition-colors disabled:opacity-50">
          {saving ? "Salvando..." : item ? "Salvar" : "Adicionar"}
        </button>
      </div>
    </form>
  );
}

// ─── Supplier Drawer ──────────────────────────────────────────────────────────

interface DrawerProps {
  supplier: Supplier;
  slug: string;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
}

type DrawerTab = "info" | "catalog" | "order";

interface OrderItem {
  catalogItem: SupplierCatalogItem;
  qty: number;
}

function SupplierDrawer({ supplier, slug, onClose, onEdit, onDelete, onToggleFavorite }: DrawerProps) {
  const [tab, setTab] = useState<DrawerTab>("catalog");
  const [catalogItems, setCatalogItems] = useState<SupplierCatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [addingItem, setAddingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<SupplierCatalogItem | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const printRef = useRef<HTMLDivElement>(null);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const items = await apiJson<SupplierCatalogItem[]>(`/api/tenants/${slug}/suppliers/${supplier.id}/catalog`);
      setCatalogItems(Array.isArray(items) ? items : []);
    } catch {
      setCatalogItems([]);
    } finally {
      setCatalogLoading(false);
    }
  }, [slug, supplier.id]);

  useEffect(() => { loadCatalog(); }, [loadCatalog]);

  async function handleAddItem(data: { name: string; unit: string; price: string; notes: string }) {
    await apiJson(`/api/tenants/${slug}/suppliers/${supplier.id}/catalog`, {
      method: "POST",
      body: JSON.stringify({
        name: data.name,
        unit: data.unit || null,
        price: data.price ? parseFloat(data.price) : null,
        notes: data.notes || null,
      }),
    });
    setAddingItem(false);
    loadCatalog();
  }

  async function handleEditItem(data: { name: string; unit: string; price: string; notes: string }) {
    if (!editingItem) return;
    await apiJson(`/api/tenants/${slug}/suppliers/${supplier.id}/catalog/${editingItem.id}`, {
      method: "PUT",
      body: JSON.stringify({
        name: data.name,
        unit: data.unit || null,
        price: data.price ? parseFloat(data.price) : null,
        notes: data.notes || null,
      }),
    });
    setEditingItem(null);
    loadCatalog();
  }

  async function handleDeleteItem(item: SupplierCatalogItem) {
    await apiJson(`/api/tenants/${slug}/suppliers/${supplier.id}/catalog/${item.id}`, { method: "DELETE" });
    loadCatalog();
  }

  function toggleOrderItem(item: SupplierCatalogItem) {
    setOrderItems((prev) => {
      const exists = prev.find((o) => o.catalogItem.id === item.id);
      if (exists) return prev.filter((o) => o.catalogItem.id !== item.id);
      return [...prev, { catalogItem: item, qty: 1 }];
    });
  }

  function setQty(itemId: string, qty: number) {
    if (qty <= 0) {
      setOrderItems((prev) => prev.filter((o) => o.catalogItem.id !== itemId));
    } else {
      setOrderItems((prev) => prev.map((o) => o.catalogItem.id === itemId ? { ...o, qty } : o));
    }
  }

  const orderTotal = orderItems.reduce((sum, o) => sum + (o.catalogItem.price ?? 0) * o.qty, 0);
  const hasTotal = orderItems.some((o) => o.catalogItem.price != null);

  function buildWhatsAppMessage() {
    const lines = [
      `*Pedido de Compra*`,
      ``,
      `Olá, *${supplier.name}*!`,
      `Segue nosso pedido:`,
      ``,
      ...orderItems.map((o) => {
        const price = o.catalogItem.price != null ? ` — ${fmtPrice(o.catalogItem.price)} cada` : "";
        const unit = o.catalogItem.unit ? ` ${o.catalogItem.unit}` : "";
        return `• ${o.qty}${unit} × ${o.catalogItem.name}${price}`;
      }),
    ];
    if (hasTotal) lines.push(``, `*Total estimado: ${fmtPrice(orderTotal)}*`);
    lines.push(``, `Aguardamos confirmação. Obrigado!`);
    return lines.join("\n");
  }

  function handlePrint() {
    const date = new Date().toLocaleDateString("pt-BR");
    const rows = orderItems.map((o) => {
      const price = o.catalogItem.price != null ? fmtPrice(o.catalogItem.price) : "—";
      const subtotal = o.catalogItem.price != null ? fmtPrice(o.catalogItem.price * o.qty) : "—";
      const unit = o.catalogItem.unit ?? "";
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9">${o.catalogItem.name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center">${o.qty} ${unit}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:right">${price}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:right">${subtotal}</td>
      </tr>`;
    }).join("");

    const totalRow = hasTotal
      ? `<tr><td colspan="3" style="padding:10px 12px;font-weight:900;text-align:right">Total estimado</td><td style="padding:10px 12px;font-weight:900;text-align:right">${fmtPrice(orderTotal)}</td></tr>`
      : "";

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Pedido de Compra</title>
    <style>body{font-family:sans-serif;color:#0f172a;padding:32px}h1{font-size:20px;font-weight:900;margin:0}p{margin:4px 0;color:#64748b;font-size:13px}table{width:100%;border-collapse:collapse;margin-top:24px}th{background:#0A1628;color:white;padding:10px 12px;text-align:left;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em}td{font-size:13px}</style>
    </head><body>
    <h1>Pedido de Compra</h1>
    <p>Fornecedor: <strong>${supplier.name}</strong></p>
    <p>Data: ${date}</p>
    ${supplier.phone ? `<p>Telefone: ${fmtPhone(supplier.phone)}</p>` : ""}
    <table><thead><tr><th>Produto</th><th style="text-align:center">Qtd</th><th style="text-align:right">Preço unit.</th><th style="text-align:right">Subtotal</th></tr></thead>
    <tbody>${rows}${totalRow}</tbody></table>
    </body></html>`;

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.print();
  }

  return (
    <div className="fixed inset-0 z-[100] flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="absolute right-0 top-0 bottom-0 w-full max-w-lg bg-white shadow-2xl flex flex-col">

        {/* Header */}
        <div className="bg-[#0A1628] px-5 pt-5 pb-4 shrink-0">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                <Truck className="w-6 h-6 text-[#C9A227]" />
              </div>
              <div className="min-w-0">
                <p className="font-black text-white text-base leading-tight truncate">{supplier.name}</p>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${typeColor(supplier.type)}`}>
                  {typeLabel(supplier.type)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={onToggleFavorite} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
                {supplier.isFavorite
                  ? <Star className="w-4 h-4 fill-[#C9A227] text-[#C9A227]" />
                  : <Star className="w-4 h-4 text-white/40" />}
              </button>
              <button onClick={onEdit} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
                <Edit2 className="w-4 h-4 text-white/60" />
              </button>
              <button onClick={onDelete} className="p-2 rounded-xl hover:bg-red-500/20 transition-colors">
                <Trash2 className="w-4 h-4 text-red-400" />
              </button>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 transition-colors ml-1">
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1">
            {(["info", "catalog", "order"] as DrawerTab[]).map((t) => {
              const labels: Record<DrawerTab, string> = { info: "Dados", catalog: "Catálogo", order: "Pedido" };
              const icons: Record<DrawerTab, React.ReactNode> = {
                info: <Building2 className="w-3.5 h-3.5" />,
                catalog: <Package className="w-3.5 h-3.5" />,
                order: <ShoppingCart className="w-3.5 h-3.5" />,
              };
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                    tab === t ? "bg-[#C9A227] text-white" : "text-white/40 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {icons[t]}
                  {labels[t]}
                  {t === "order" && orderItems.length > 0 && (
                    <span className="bg-white/20 text-white text-[9px] font-black rounded-full px-1.5 py-0.5 ml-0.5">
                      {orderItems.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">

          {/* ── INFO ── */}
          {tab === "info" && (
            <div className="p-5 space-y-4">
              {supplier.phone && (
                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl">
                  <div className="w-9 h-9 rounded-xl bg-slate-200 flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Telefone</p>
                    <p className="text-sm font-bold text-slate-700">{fmtPhone(supplier.phone)}</p>
                  </div>
                  <a href={whatsappUrl(supplier.phone)} target="_blank" rel="noopener noreferrer"
                    className="ml-auto shrink-0 flex items-center gap-1.5 px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-black transition-colors">
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    WhatsApp
                  </a>
                </div>
              )}
              {supplier.email && (
                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl">
                  <div className="w-9 h-9 rounded-xl bg-slate-200 flex items-center justify-center shrink-0">
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">E-mail</p>
                    <p className="text-sm font-bold text-slate-700 truncate">{supplier.email}</p>
                  </div>
                </div>
              )}
              {(supplier.street || supplier.city) && (
                <div className="p-4 bg-slate-50 rounded-2xl">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Endereço</p>
                  <p className="text-sm text-slate-700">
                    {[supplier.street, supplier.number, supplier.complement].filter(Boolean).join(", ")}
                  </p>
                  <p className="text-sm text-slate-500">{[supplier.neighborhood, supplier.city, supplier.state].filter(Boolean).join(" · ")}</p>
                </div>
              )}
              {supplier.cpfCnpj && (
                <div className="p-4 bg-slate-50 rounded-2xl">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">CPF / CNPJ</p>
                  <p className="text-sm font-bold text-slate-700">{supplier.cpfCnpj}</p>
                </div>
              )}
              {supplier.notes && (
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-1">Observações</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{supplier.notes}</p>
                </div>
              )}
            </div>
          )}

          {/* ── CATALOG ── */}
          {tab === "catalog" && (
            <div className="p-5 space-y-4" ref={printRef}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-black text-slate-500 uppercase tracking-widest">
                  {catalogItems.length} {catalogItems.length === 1 ? "item" : "itens"}
                </p>
                {!addingItem && !editingItem && (
                  <button
                    onClick={() => setAddingItem(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#C9A227] hover:bg-[#b8911f] text-white text-xs font-black transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Novo item
                  </button>
                )}
              </div>

              {addingItem && (
                <CatalogItemForm item={null} onSave={handleAddItem} onCancel={() => setAddingItem(false)} />
              )}

              {catalogLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
                </div>
              ) : catalogItems.length === 0 && !addingItem ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                  <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center">
                    <Package className="w-8 h-8 text-slate-300" />
                  </div>
                  <div>
                    <p className="font-black text-slate-500">Nenhum item cadastrado</p>
                    <p className="text-xs text-slate-400 mt-1">Adicione produtos e preços deste fornecedor.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {catalogItems.map((item) => (
                    editingItem?.id === item.id ? (
                      <CatalogItemForm
                        key={item.id}
                        item={item}
                        onSave={handleEditItem}
                        onCancel={() => setEditingItem(null)}
                      />
                    ) : (
                      <div key={item.id} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition-all group">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-slate-800">{item.name}</p>
                            {item.unit && (
                              <span className="text-[10px] font-black uppercase tracking-wide px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-lg">{item.unit}</span>
                            )}
                          </div>
                          {item.price != null && (
                            <p className="text-sm font-black text-[#C9A227] mt-0.5">{fmtPrice(item.price)}</p>
                          )}
                          {item.notes && <p className="text-xs text-slate-400 mt-0.5">{item.notes}</p>}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button onClick={() => { setEditingItem(item); setAddingItem(false); }} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                            <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                          </button>
                          <button onClick={() => handleDeleteItem(item)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors">
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </button>
                        </div>
                        <button
                          onClick={() => { toggleOrderItem(item); setTab("order"); }}
                          className="shrink-0 w-8 h-8 rounded-xl bg-[#0A1628] hover:bg-[#1a2d4e] flex items-center justify-center transition-colors"
                          title="Adicionar ao pedido"
                        >
                          <ShoppingCart className="w-3.5 h-3.5 text-[#C9A227]" />
                        </button>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── ORDER ── */}
          {tab === "order" && (
            <div className="p-5 space-y-4">
              {orderItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                  <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center">
                    <ShoppingCart className="w-8 h-8 text-slate-300" />
                  </div>
                  <div>
                    <p className="font-black text-slate-500">Nenhum item no pedido</p>
                    <p className="text-xs text-slate-400 mt-1">Vá ao Catálogo e clique no ícone de carrinho.</p>
                  </div>
                  <button onClick={() => setTab("catalog")} className="px-4 py-2 rounded-xl bg-[#C9A227] text-white text-xs font-black hover:bg-[#b8911f] transition-colors">
                    Ver Catálogo
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {orderItems.map((o) => (
                      <div key={o.catalogItem.id} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate">{o.catalogItem.name}</p>
                          {o.catalogItem.price != null && (
                            <p className="text-xs text-slate-400">{fmtPrice(o.catalogItem.price)} × {o.qty} = <span className="font-black text-[#C9A227]">{fmtPrice(o.catalogItem.price * o.qty)}</span></p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => setQty(o.catalogItem.id, o.qty - 1)} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
                            <Minus className="w-3 h-3 text-slate-600" />
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={o.qty}
                            onChange={(e) => setQty(o.catalogItem.id, Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-12 text-center border border-slate-200 rounded-lg py-1 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#C9A227]/30"
                          />
                          <button onClick={() => setQty(o.catalogItem.id, o.qty + 1)} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">
                            <Plus className="w-3 h-3 text-slate-600" />
                          </button>
                          <button onClick={() => setQty(o.catalogItem.id, 0)} className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center transition-colors ml-1">
                            <X className="w-3 h-3 text-red-400" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {hasTotal && (
                    <div className="flex items-center justify-between p-4 bg-[#0A1628] rounded-2xl">
                      <p className="text-sm font-black text-white/60 uppercase tracking-wider">Total estimado</p>
                      <p className="text-lg font-black text-[#C9A227]">{fmtPrice(orderTotal)}</p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handlePrint}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-[#0A1628] text-[#0A1628] text-sm font-black hover:bg-[#0A1628] hover:text-white transition-all"
                    >
                      PDF / Imprimir
                    </button>
                    {supplier.phone && (
                      <a
                        href={whatsappUrl(supplier.phone, buildWhatsAppMessage())}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-black transition-colors"
                      >
                        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        Enviar WhatsApp
                      </a>
                    )}
                  </div>
                  <button
                    onClick={() => setOrderItems([])}
                    className="w-full py-2.5 rounded-xl text-sm text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors font-medium"
                  >
                    Limpar pedido
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Card view ────────────────────────────────────────────────────────────────

function SupplierCard({ supplier, onOpen, onEdit, onDelete, onToggleFavorite }: {
  supplier: Supplier;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
}) {
  const catalogCount = supplier._count?.catalogItems ?? 0;
  return (
    <div
      onClick={onOpen}
      className={`relative bg-white rounded-2xl border cursor-pointer ${supplier.isActive ? "border-slate-200 hover:border-[#C9A227]/40 hover:shadow-md" : "border-slate-100 opacity-60"} p-5 flex flex-col gap-4 transition-all`}
    >
      <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }} className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-slate-50 transition-colors">
        {supplier.isFavorite
          ? <Star className="w-4 h-4 fill-[#C9A227] text-[#C9A227]" />
          : <Star className="w-4 h-4 text-slate-300" />}
      </button>

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
        {catalogCount > 0 && (
          <div className="flex items-center gap-2">
            <Package className="w-3.5 h-3.5 text-[#C9A227] shrink-0" />
            <span className="text-xs font-semibold text-[#C9A227]">{catalogCount} produto{catalogCount !== 1 ? "s" : ""} no catálogo</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
        {supplier.phone && (
          <a
            href={whatsappUrl(supplier.phone)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green-50 hover:bg-green-100 text-green-700 text-xs font-black transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            WhatsApp
          </a>
        )}
        <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-2 rounded-xl hover:bg-slate-100 transition-colors">
          <Edit2 className="w-4 h-4 text-slate-400" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-2 rounded-xl hover:bg-red-50 transition-colors">
          <Trash2 className="w-4 h-4 text-red-400" />
        </button>
      </div>
    </div>
  );
}

// ─── Row view ─────────────────────────────────────────────────────────────────

function SupplierRow({ supplier, onOpen, onEdit, onDelete, onToggleFavorite }: {
  supplier: Supplier;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
}) {
  const catalogCount = supplier._count?.catalogItems ?? 0;
  return (
    <div
      onClick={onOpen}
      className={`flex items-center gap-4 px-4 py-3 bg-white rounded-xl border cursor-pointer ${supplier.isActive ? "border-slate-200 hover:border-[#C9A227]/40" : "border-slate-100 opacity-60"} hover:shadow-sm transition-all`}
    >
      <button onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }} className="p-1 shrink-0">
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
      {catalogCount > 0 && (
        <span className="hidden md:inline-block text-xs font-semibold text-[#C9A227] shrink-0">{catalogCount} produto{catalogCount !== 1 ? "s" : ""}</span>
      )}
      <div className="flex items-center gap-1 shrink-0">
        {supplier.phone && (
          <a href={whatsappUrl(supplier.phone)} target="_blank" rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 rounded-xl bg-green-50 hover:bg-green-100 text-green-700 transition-colors">
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          </a>
        )}
        <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-1.5 rounded-xl hover:bg-slate-100 transition-colors">
          <Edit2 className="w-3.5 h-3.5 text-slate-400" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1.5 rounded-xl hover:bg-red-50 transition-colors">
          <Trash2 className="w-3.5 h-3.5 text-red-400" />
        </button>
      </div>
    </div>
  );
}

// ─── Delete confirm ───────────────────────────────────────────────────────────

function DeleteConfirm({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
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
  const [drawerSupplier, setDrawerSupplier] = useState<Supplier | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sup, inv] = await Promise.all([
        apiJson<Supplier[]>(`/api/tenants/${slug}/suppliers`),
        apiJson<InventoryItem[]>(`/api/tenants/${slug}/inventory`),
      ]);
      setSuppliers(Array.isArray(sup) ? sup : []);
      setInventoryItems(Array.isArray(inv) ? inv : []);
    } catch {
      setSuppliers([]);
      setInventoryItems([]);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { load(); }, [load]);

  async function toggleFavorite(supplier: Supplier) {
    await apiJson(`/api/tenants/${slug}/suppliers/${supplier.id}`, {
      method: "PUT",
      body: JSON.stringify({ ...supplier, isFavorite: !supplier.isFavorite, inventoryItemIds: supplier.inventoryItems?.map((i) => i.inventoryItemId) ?? [] }),
    });
    load();
  }

  async function doDelete(supplier: Supplier) {
    await apiJson(`/api/tenants/${slug}/suppliers/${supplier.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    setDrawerSupplier(null);
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
            Gerencie contatos, catálogo de produtos e gere pedidos de compra.
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

        <button
          onClick={() => setFilterFav((v) => !v)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${filterFav ? "bg-[#C9A227]/10 border-[#C9A227] text-[#C9A227]" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
        >
          <Heart className={`w-4 h-4 ${filterFav ? "fill-[#C9A227]" : ""}`} />
          Favoritos {favCount > 0 && <span className="text-xs">({favCount})</span>}
        </button>

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
              onOpen={() => setDrawerSupplier(s)}
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
              onOpen={() => setDrawerSupplier(s)}
              onEdit={() => { setEditTarget(s); setModalOpen(true); }}
              onDelete={() => setDeleteTarget(s)}
              onToggleFavorite={() => toggleFavorite(s)}
            />
          ))}
        </div>
      )}

      {/* Drawer */}
      {drawerSupplier && (
        <SupplierDrawer
          supplier={drawerSupplier}
          slug={slug}
          onClose={() => setDrawerSupplier(null)}
          onEdit={() => { setEditTarget(drawerSupplier); setModalOpen(true); setDrawerSupplier(null); }}
          onDelete={() => { setDeleteTarget(drawerSupplier); setDrawerSupplier(null); }}
          onToggleFavorite={() => toggleFavorite(drawerSupplier)}
        />
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
