import { useEffect, useState, useCallback, useRef } from "react";
import {
  Building2,
  ChevronRight,
  Edit2,
  Heart,
  Loader2,
  MapPin,
  Minus,
  Package,
  Phone,
  Plus,
  ShoppingCart,
  Star,
  Trash2,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import type { InventoryItem, Supplier, SupplierCatalogItem, SupplierType, Tenant } from "../../../../types";
import {
  Alert, Badge, Button, ConfirmModal, EmptyState, FilterLine, FilterLineItem, FilterLineSearch, FilterLineSection,
  FilterLineViewToggle, GridTable, IconButton, Input, Modal, ModalFooter, PageWrapper, SectionTitle, Select,
  StatCard, StatGrid, Tabs, Textarea,
} from "../../../../components";
import type { Column } from "../../../../components";
import { apiJson } from "../../../../lib/api";
import SupplierProductsModal from "./SupplierProductsModal";

interface Props {
  tenant: Tenant;
}

type TypeBadgeColor = "success" | "info" | "warning" | "purple" | "orange" | "default";

const SUPPLIER_TYPES: { value: SupplierType; label: string; color: TypeBadgeColor }[] = [
  { value: "ALIMENTICIO", label: "Alimentício",  color: "success" },
  { value: "BEBIDAS",     label: "Bebidas",      color: "info"    },
  { value: "EMBALAGENS",  label: "Embalagens",   color: "warning" },
  { value: "LIMPEZA",     label: "Limpeza",      color: "purple"  },
  { value: "EQUIPAMENTOS",label: "Equipamentos", color: "orange"  },
  { value: "OUTROS",      label: "Outros",       color: "default" },
];

// Abas do modal de cadastro de fornecedor
const SUPPLIER_FORM_TABS = [
  { id: "dados", label: "Dados", icon: UserRound },
  { id: "endereco", label: "Endereço", icon: MapPin },
  { id: "produtos", label: "Produtos", icon: Package },
] as const;
type SupplierFormTabId = (typeof SUPPLIER_FORM_TABS)[number]["id"];

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
  );
}

function typeLabel(type: SupplierType) {
  return SUPPLIER_TYPES.find((t) => t.value === type)?.label ?? type;
}
function typeColor(type: SupplierType): TypeBadgeColor {
  return SUPPLIER_TYPES.find((t) => t.value === type)?.color ?? "default";
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
  return `https://wa.me/${num}${message ?`?text=${encodeURIComponent(message)}` : ""}`;
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
  const [tab, setTab] = useState<SupplierFormTabId>("dados");
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
    if (!form.name.trim()) { setTab("dados"); setError("Nome é obrigatório."); return; }
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

  const productCount = isEdit ? catalogItems.length : pendingProducts.length;
  const tabItems = SUPPLIER_FORM_TABS.map((t) => t.id === "produtos" ? { ...t, badge: productCount || undefined } : t);

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
      <form onSubmit={handleSubmit} className="space-y-3 py-1">
        {error && <Alert variant="error">{error}</Alert>}

        <Tabs<SupplierFormTabId> items={tabItems} value={tab} onChange={setTab} label="Dados do fornecedor">
          {tab === "dados" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input label="Nome *" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Distribuidora XYZ" />
                <Select label="Tipo" value={form.type} onChange={(e) => set("type", e.target.value)}>
                  {SUPPLIER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </Select>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input label="CPF / CNPJ" value={form.cpfCnpj ?? ""} onChange={(e) => set("cpfCnpj", maskCpfCnpj(e.target.value))} placeholder="000.000.000-00" inputMode="numeric" />
                <Input label="Telefone / WhatsApp" value={form.phone ?? ""} onChange={(e) => set("phone", maskPhone(e.target.value))} placeholder="(11) 99999-9999" inputMode="numeric" />
              </div>

              <Input label="E-mail" type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} placeholder="contato@fornecedor.com" />

              <Textarea
                label="Observações"
                value={form.notes ?? ""}
                onChange={(e) => set("notes", e.target.value)}
                rows={3}
                placeholder="Prazo de entrega, condições de pagamento..."
              />

              <div className="flex flex-wrap items-center gap-6 pt-1">
                <label className="flex cursor-pointer select-none items-center gap-2">
                  <input type="checkbox" checked={form.isFavorite} onChange={(e) => set("isFavorite", e.target.checked)} className="h-4 w-4 accent-blue-600" />
                  <span className="text-xs font-medium text-slate-600">Favorito</span>
                </label>
                <label className="flex cursor-pointer select-none items-center gap-2">
                  <input type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} className="h-4 w-4 accent-blue-600" />
                  <span className="text-xs font-medium text-slate-600">Ativo</span>
                </label>
              </div>
            </div>
          )}

          {tab === "endereco" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input label="CEP" value={form.cep ?? ""} onChange={(e) => set("cep", e.target.value)} onBlur={handleCepBlur} placeholder="00000-000" inputMode="numeric" iconRight={cepLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" /> : undefined} />
                <Input label="Número" value={form.number ?? ""} onChange={(e) => set("number", e.target.value)} placeholder="123" />
              </div>
              <Input label="Logradouro" value={form.street ?? ""} onChange={(e) => set("street", e.target.value)} placeholder="Rua Exemplo" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input label="Complemento" value={form.complement ?? ""} onChange={(e) => set("complement", e.target.value)} placeholder="Sala 2" />
                <Input label="Bairro" value={form.neighborhood ?? ""} onChange={(e) => set("neighborhood", e.target.value)} placeholder="Centro" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input label="Cidade" value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} placeholder="São Paulo" />
                <Input label="Estado (UF)" value={form.state ?? ""} onChange={(e) => set("state", e.target.value.toUpperCase())} placeholder="SP" maxLength={2} />
              </div>
            </div>
          )}

          {tab === "produtos" && (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2.5">
                <div>
                  <p className="text-xs font-medium text-slate-700">Produtos fornecidos</p>
                  {productCount > 0 && (
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {productCount} produto{productCount !== 1 ? "s" : ""} selecionado{productCount !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
                <Button size="sm" iconLeft={<Plus size={14} />} onClick={() => setShowProductsModal(true)}>
                  {productCount > 0 ? "Gerenciar produtos" : "Adicionar produtos"}
                </Button>
              </div>
              {isEdit && catalogItems.length > 0 ? (
                <div className="max-h-60 divide-y divide-slate-50 overflow-y-auto">
                  {catalogItems.map(item => (
                    <div key={item.id} className="flex items-center gap-3 px-3 py-2">
                      <Package className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                      <span className="flex-1 truncate text-xs text-slate-700">{item.name}</span>
                      {item.unit && <span className="shrink-0 text-[11px] text-slate-500">{item.unit}</span>}
                      {item.price != null && (
                        <span className="shrink-0 text-xs font-medium text-slate-800">
                          R$ {item.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : !isEdit && pendingProducts.length > 0 ? (
                <div className="max-h-60 divide-y divide-slate-50 overflow-y-auto">
                  {pendingProducts.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2">
                      <Package className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                      <span className="flex-1 truncate text-xs text-slate-700">{item.name}</span>
                      {item.unit && <span className="shrink-0 text-[11px] text-slate-500">{item.unit}</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-5 text-center">
                  <p className="text-xs text-slate-500">Nenhum produto selecionado ainda.</p>
                </div>
              )}
            </div>
          )}
        </Tabs>

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
    <form onSubmit={handle} className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-medium text-slate-700">{item ? "Editar item" : "Novo item"}</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Input
          wrapperClassName="col-span-full"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do produto *"
          required
        />
        <Input
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="Unidade (kg, L, cx...)"
        />
        <Input
          value={price}
          onChange={(e) => setPrice(e.target.value.replace(",", "."))}
          placeholder="Preço estimado (R$)"
          type="number"
          step="0.01"
          min="0"
        />
        <Input
          wrapperClassName="col-span-full"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Observação (opcional)"
        />
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" className="flex-1" loading={saving} disabled={saving || !name.trim()}>
          {item ? "Salvar" : "Adicionar"}
        </Button>
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

const DRAWER_TABS = [
  { id: "info", label: "Dados", icon: Building2 },
  { id: "catalog", label: "Catálogo", icon: Package },
  { id: "order", label: "Pedido", icon: ShoppingCart },
] as const;
type DrawerTab = (typeof DRAWER_TABS)[number]["id"];

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
    <style>body{font-family:sans-serif;color:#0f172a;padding:32px}h1{font-size:20px;font-weight:900;margin:0}p{margin:4px 0;color:#64748b;font-size:13px}table{width:100%;border-collapse:collapse;margin-top:24px}th{background:#1e293b;color:white;padding:10px 12px;text-align:left;font-size:12px;font-weight:700;;letter-spacing:0.05em}td{font-size:13px}</style>
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

  const drawerTabItems = DRAWER_TABS.map((t) => t.id === "order" ? { ...t, badge: orderItems.length || undefined } : t);

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={supplier.name}
      subtitle={typeLabel(supplier.type)}
      size="md"
      position="right"
      mobileStyle="fullscreen"
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50">
              <Truck size={15} className="text-blue-600" />
            </div>
            <Badge color={typeColor(supplier.type)}>{typeLabel(supplier.type)}</Badge>
          </div>
          <div className="flex items-center gap-1">
            <IconButton aria-label={supplier.isFavorite ? "Remover dos favoritos" : "Favoritar"} variant="ghost" size="sm" onClick={onToggleFavorite}>
              <Star size={14} className={supplier.isFavorite ? "fill-amber-400 text-amber-500" : "text-slate-400"} />
            </IconButton>
            <IconButton aria-label="Editar fornecedor" variant="ghost" size="sm" onClick={onEdit}>
              <Edit2 size={14} />
            </IconButton>
            <IconButton aria-label="Remover fornecedor" variant="ghost" size="sm" onClick={onDelete}>
              <Trash2 size={14} />
            </IconButton>
          </div>
        </div>

        <Tabs<DrawerTab> items={drawerTabItems} value={tab} onChange={setTab} label="Detalhes do fornecedor">
          {/* ── INFO ── */}
          {tab === "info" && (
            <div className="space-y-3">
              {supplier.phone && (
                <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-200">
                    <Phone className="h-4 w-4 text-slate-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-500">Telefone</p>
                    <p className="text-[13px] font-medium text-slate-700">{fmtPhone(supplier.phone)}</p>
                  </div>
                  <a href={whatsappUrl(supplier.phone)} target="_blank" rel="noopener noreferrer"
                    className="ml-auto flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white transition-colors hover:bg-emerald-700">
                    <WhatsAppIcon className="h-3.5 w-3.5 fill-current" />
                    WhatsApp
                  </a>
                </div>
              )}
              {supplier.email && (
                <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-200">
                    <ChevronRight className="h-4 w-4 text-slate-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-500">E-mail</p>
                    <p className="truncate text-[13px] font-medium text-slate-700">{supplier.email}</p>
                  </div>
                </div>
              )}
              {(supplier.street || supplier.city) && (
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="mb-1 text-[11px] text-slate-500">Endereço</p>
                  <p className="text-xs text-slate-700">
                    {[supplier.street, supplier.number, supplier.complement].filter(Boolean).join(", ")}
                  </p>
                  <p className="text-xs text-slate-500">{[supplier.neighborhood, supplier.city, supplier.state].filter(Boolean).join(" · ")}</p>
                </div>
              )}
              {supplier.cpfCnpj && (
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="mb-1 text-[11px] text-slate-500">CPF / CNPJ</p>
                  <p className="text-[13px] font-medium text-slate-700">{supplier.cpfCnpj}</p>
                </div>
              )}
              {supplier.notes && (
                <Alert variant="warning" title="Observações">
                  <span className="whitespace-pre-wrap">{supplier.notes}</span>
                </Alert>
              )}
            </div>
          )}

          {/* ── CATALOG ── */}
          {tab === "catalog" && (
            <div className="space-y-3" ref={printRef}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate-500">
                  {catalogItems.length} {catalogItems.length === 1 ? "item" : "itens"}
                </p>
                {!addingItem && !editingItem && (
                  <Button size="sm" iconLeft={<Plus size={14} />} onClick={() => setAddingItem(true)}>
                    Novo item
                  </Button>
                )}
              </div>

              {addingItem && (
                <CatalogItemForm item={null} onSave={handleAddItem} onCancel={() => setAddingItem(false)} />
              )}

              {catalogLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
                </div>
              ) : catalogItems.length === 0 && !addingItem ? (
                <EmptyState
                  icon={Package}
                  title="Nenhum item cadastrado"
                  description="Adicione produtos e preços deste fornecedor."
                />
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
                      <div key={item.id} className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 transition-all hover:border-slate-300">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[13px] font-medium text-slate-800">{item.name}</p>
                            {item.unit && <Badge color="default" size="sm">{item.unit}</Badge>}
                          </div>
                          {item.price != null && (
                            <p className="mt-0.5 text-xs font-medium text-slate-800">{fmtPrice(item.price)}</p>
                          )}
                          {item.notes && <p className="mt-0.5 text-[11px] text-slate-500">{item.notes}</p>}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <IconButton aria-label="Editar item" variant="ghost" size="sm" onClick={() => { setEditingItem(item); setAddingItem(false); }}>
                            <Edit2 size={14} />
                          </IconButton>
                          <IconButton aria-label="Remover item" variant="ghost" size="sm" onClick={() => handleDeleteItem(item)}>
                            <Trash2 size={14} />
                          </IconButton>
                          <IconButton
                            aria-label="Adicionar ao pedido"
                            variant="primary"
                            size="sm"
                            onClick={() => { toggleOrderItem(item); setTab("order"); }}
                            title="Adicionar ao pedido"
                          >
                            <ShoppingCart size={14} />
                          </IconButton>
                        </div>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── ORDER ── */}
          {tab === "order" && (
            <div className="space-y-3">
              {orderItems.length === 0 ? (
                <EmptyState
                  icon={ShoppingCart}
                  title="Nenhum item no pedido"
                  description="Vá ao Catálogo e clique no ícone de carrinho."
                  action={<Button size="sm" onClick={() => setTab("catalog")}>Ver Catálogo</Button>}
                />
              ) : (
                <>
                  <div className="space-y-2">
                    {orderItems.map((o) => (
                      <div key={o.catalogItem.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-slate-800">{o.catalogItem.name}</p>
                          {o.catalogItem.price != null && (
                            <p className="text-[11px] text-slate-500">{fmtPrice(o.catalogItem.price)} × {o.qty} = <span className="font-medium text-slate-800">{fmtPrice(o.catalogItem.price * o.qty)}</span></p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <IconButton aria-label="Diminuir quantidade" variant="outline" size="sm" onClick={() => setQty(o.catalogItem.id, o.qty - 1)}>
                            <Minus size={12} />
                          </IconButton>
                          <input
                            type="number"
                            min="1"
                            value={o.qty}
                            aria-label="Quantidade"
                            onChange={(e) => setQty(o.catalogItem.id, Math.max(1, parseInt(e.target.value) || 1))}
                            className="h-8 w-12 rounded-lg border border-slate-200 text-center text-xs font-medium focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/10"
                          />
                          <IconButton aria-label="Aumentar quantidade" variant="outline" size="sm" onClick={() => setQty(o.catalogItem.id, o.qty + 1)}>
                            <Plus size={12} />
                          </IconButton>
                          <IconButton aria-label="Remover do pedido" variant="ghost" size="sm" onClick={() => setQty(o.catalogItem.id, 0)}>
                            <X size={12} />
                          </IconButton>
                        </div>
                      </div>
                    ))}
                  </div>

                  {hasTotal && (
                    <div className="flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50 p-3">
                      <p className="text-xs font-medium text-slate-600">Total estimado</p>
                      <p className="text-sm font-medium text-blue-700">{fmtPrice(orderTotal)}</p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button variant="outline" className="flex-1" onClick={handlePrint}>
                      PDF / Imprimir
                    </Button>
                    {supplier.phone && (
                      <a
                        href={whatsappUrl(supplier.phone, buildWhatsAppMessage())}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-8 flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white transition-colors hover:bg-emerald-700"
                      >
                        <WhatsAppIcon className="h-3.5 w-3.5 fill-current" />
                        Enviar WhatsApp
                      </a>
                    )}
                  </div>
                  <Button variant="ghost" fullWidth onClick={() => setOrderItems([])}>
                    Limpar pedido
                  </Button>
                </>
              )}
            </div>
          )}
        </Tabs>
      </div>
    </Modal>
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
      className={`relative flex cursor-pointer flex-col gap-3 rounded-lg border bg-white p-4 transition-all ${supplier.isActive ? "border-slate-200 hover:border-blue-300" : "border-slate-100 opacity-60"}`}
    >
      <IconButton
        aria-label={supplier.isFavorite ? "Remover dos favoritos" : "Favoritar"}
        variant="ghost"
        size="sm"
        className="absolute right-3 top-3"
        onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
      >
        <Star size={14} className={supplier.isFavorite ? "fill-amber-400 text-amber-500" : "text-slate-300"} />
      </IconButton>

      <div className="flex items-start gap-3 pr-8">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50">
          <Truck size={15} className="text-blue-600" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium leading-tight text-slate-800">{supplier.name}</p>
          <Badge color={typeColor(supplier.type)} size="sm" className="mt-1">{typeLabel(supplier.type)}</Badge>
        </div>
      </div>

      <div className="space-y-1.5">
        {supplier.phone && (
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="truncate text-xs text-slate-600">{fmtPhone(supplier.phone)}</span>
          </div>
        )}
        {supplier.city && (
          <div className="flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="truncate text-xs text-slate-500">{[supplier.city, supplier.state].filter(Boolean).join(" / ")}</span>
          </div>
        )}
        {catalogCount > 0 && (
          <div className="flex items-center gap-2">
            <Package className="h-3.5 w-3.5 shrink-0 text-blue-600" />
            <span className="text-xs font-medium text-blue-700">{catalogCount} produto{catalogCount !== 1 ? "s" : ""} no catálogo</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
        {supplier.phone && (
          <a
            href={whatsappUrl(supplier.phone)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-50 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
          >
            <WhatsAppIcon className="h-3.5 w-3.5 fill-current" />
            WhatsApp
          </a>
        )}
        <IconButton aria-label="Editar fornecedor" variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
          <Edit2 size={14} />
        </IconButton>
        <IconButton aria-label="Remover fornecedor" variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
          <Trash2 size={14} />
        </IconButton>
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
  const activeCount = suppliers.filter((s) => s.isActive).length;
  const catalogTotal = suppliers.reduce((sum, s) => sum + (s._count?.catalogItems ?? 0), 0);

  const typeOptions = [
    { value: "ALL", label: "Todos os tipos" },
    ...SUPPLIER_TYPES.map((t) => ({ value: t.value, label: t.label })),
  ];

  const columns: Column<Supplier>[] = [
    {
      header: "Fornecedor",
      render: (s) => (
        <div className={`flex min-w-0 items-center gap-2 ${s.isActive ? "" : "opacity-60"}`}>
          <IconButton
            aria-label={s.isFavorite ? "Remover dos favoritos" : "Favoritar"}
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); toggleFavorite(s); }}
          >
            <Star size={14} className={s.isFavorite ? "fill-amber-400 text-amber-500" : "text-slate-300"} />
          </IconButton>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-slate-800">{s.name}</p>
            {(s.city || s.phone) && (
              <p className="truncate text-[11px] text-slate-500">
                {[s.city && `${s.city}${s.state ? `/${s.state}` : ""}`, s.phone && fmtPhone(s.phone)].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      header: "Tipo",
      render: (s) => <Badge color={typeColor(s.type)} size="sm">{typeLabel(s.type)}</Badge>,
    },
    {
      header: "Produtos",
      render: (s) => {
        const count = s._count?.catalogItems ?? 0;
        return <span className="text-xs text-slate-500">{count > 0 ? `${count} produto${count !== 1 ? "s" : ""}` : "—"}</span>;
      },
    },
    {
      header: "Ações",
      className: "text-right",
      headerClassName: "text-right",
      render: (s) => (
        <div className="flex items-center justify-end gap-1">
          {s.phone && (
            <a
              href={whatsappUrl(s.phone)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 transition-colors hover:bg-emerald-100"
            >
              <WhatsAppIcon className="h-3.5 w-3.5 fill-current" />
            </a>
          )}
          <IconButton aria-label="Editar fornecedor" variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setEditTarget(s); setModalOpen(true); }}>
            <Edit2 size={14} />
          </IconButton>
          <IconButton aria-label="Remover fornecedor" variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDeleteTarget(s); }}>
            <Trash2 size={14} />
          </IconButton>
        </div>
      ),
    },
  ];

  const hasFilters = !!search || filterType !== "ALL" || filterFav;

  return (
    <PageWrapper>
      <div className="space-y-4">
        <SectionTitle
          title="Fornecedores"
          description="Gerencie contatos, catálogo de produtos e gere pedidos de compra."
          icon={Truck}
          action={
            <Button size="sm" iconLeft={<Plus size={14} />} onClick={() => { setEditTarget(null); setModalOpen(true); }}>
              Novo fornecedor
            </Button>
          }
        />

        <StatGrid cols={3}>
          <StatCard title="Fornecedores ativos" value={activeCount} icon={Truck} color="info" />
          <StatCard title="Favoritos" value={favCount} icon={Heart} color="warning" />
          <StatCard title="Produtos no catálogo" value={catalogTotal} icon={Package} color="success" />
        </StatGrid>

        <FilterLine>
          <FilterLineSection grow>
            <FilterLineItem grow minWidth={180} className="sm:max-w-[280px]">
              <FilterLineSearch aria-label="Buscar fornecedor" value={search} onChange={setSearch} placeholder="Buscar fornecedor..." />
            </FilterLineItem>
            <FilterLineItem minWidth={170}>
              <Select
                aria-label="Filtrar por tipo"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as SupplierType | "ALL")}
                options={typeOptions}
              />
            </FilterLineItem>
            <Button
              variant={filterFav ? "primary" : "outline"}
              size="sm"
              iconLeft={<Heart size={14} className={filterFav ? "fill-current" : ""} />}
              onClick={() => setFilterFav((v) => !v)}
            >
              Favoritos{favCount > 0 ? ` (${favCount})` : ""}
            </Button>
            <Button
              variant={filterInactive ? "primary" : "outline"}
              size="sm"
              onClick={() => setFilterInactive((v) => !v)}
            >
              {filterInactive ? "Ocultar inativos" : "Mostrar inativos"}
            </Button>
          </FilterLineSection>
          <FilterLineSection align="right">
            <span className="text-[11px] text-slate-500">{filtered.length} fornecedor{filtered.length !== 1 ? "es" : ""}</span>
            <FilterLineViewToggle value={viewMode} onChange={(v) => setViewMode(v === "list" ? "list" : "grid")} gridValue="grid" listValue="list" />
          </FilterLineSection>
        </FilterLine>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Truck}
            title={hasFilters ? "Nenhum fornecedor encontrado" : "Nenhum fornecedor cadastrado"}
            description={hasFilters ? "Tente ajustar os filtros." : "Clique em \"Novo fornecedor\" para começar."}
          />
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
          <GridTable
            data={filtered}
            columns={columns}
            keyExtractor={(s) => s.id}
            onRowClick={(s) => setDrawerSupplier(s)}
          />
        )}
      </div>

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
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && doDelete(deleteTarget)}
        title="Remover fornecedor?"
        confirmLabel="Remover"
        message={<><strong>{deleteTarget?.name}</strong> será removido permanentemente.</>}
      />
    </PageWrapper>
  );
}
