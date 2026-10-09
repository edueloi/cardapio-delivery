import React, { useState } from "react";
import {
  ArrowLeft,
  ArrowRightLeft,
  Boxes,
  CalendarClock,
  CircleDollarSign,
  FileText,
  Info,
  Package,
  Plus,
  Save,
} from "lucide-react";
import {
  Alert,
  Button,
  ContentCard,
  CurrencyInput,
  FormRow,
  IconButton,
  Input,
  Modal,
  ModalFooter,
  PanelCard,
  SectionTitle,
  Select,
  Tabs,
  useToast,
} from "../../../../components";
import { apiFetch } from "../../../../lib/api";
import { Tenant } from "../../../../types";

const UNIT_GROUPS = [
  {
    label: "Massa",
    units: [
      { value: "g",  label: "g — Grama" },
      { value: "kg", label: "kg — Quilograma" },
      { value: "mg", label: "mg — Miligrama" },
    ],
  },
  {
    label: "Volume",
    units: [
      { value: "ml", label: "ml — Mililitro" },
      { value: "l",  label: "l — Litro" },
    ],
  },
  {
    label: "Contagem",
    units: [
      { value: "un",   label: "un — Unidade" },
      { value: "dz",   label: "dz — Dúzia" },
      { value: "cx",   label: "cx — Caixa" },
      { value: "pct",  label: "pct — Pacote" },
      { value: "fd",   label: "fd — Fardo" },
      { value: "saco", label: "saco — Saco" },
    ],
  },
  {
    label: "Comprimento",
    units: [
      { value: "cm", label: "cm — Centímetro" },
      { value: "m",  label: "m — Metro" },
    ],
  },
];

function UnitSelectInput({
  label,
  value,
  onChange,
  hint,
  size = "sm",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleToggle = () => {
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setOpenUp(rect.bottom + 210 > window.innerHeight);
    }
    setOpen((o) => !o);
  };

  const allUnits = UNIT_GROUPS.flatMap((g) => g.units);
  const _matched = allUnits.find((u) => u.value === value.trim().toLowerCase());

  return (
    <div ref={ref} className="relative">
      <label className="block text-[11px] font-semibold text-slate-500 mb-1">
        {label}
      </label>
      <div
        className="flex items-center gap-1 border border-zinc-200 rounded-lg bg-white cursor-pointer hover:border-blue-400 focus-within:border-blue-400 transition-colors px-2"
        style={{ height: size === "sm" ? "34px" : "40px" }}
        onClick={handleToggle}
      >
        <input
          className="flex-1 text-xs font-semibold bg-transparent outline-none text-slate-800 placeholder:text-slate-400 min-w-0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          placeholder="un, kg, ml…"
          autoComplete="off"
        />
        <svg className={`w-3 h-3 text-slate-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {hint && <p className="text-[11px] text-slate-500 mt-0.5">{hint}</p>}
      {open && (
        <div className={`absolute z-50 w-44 bg-white border border-zinc-200 rounded-lg overflow-y-auto max-h-48 ${openUp ? "bottom-full mb-1" : "top-full mt-1"} left-0`}>
          {UNIT_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 bg-zinc-50 border-b border-zinc-100 sticky top-0">
                {group.label}
              </div>
              {group.units.map((u) => (
                <button
                  key={u.value}
                  type="button"
                  onClick={() => { onChange(u.value); setOpen(false); }}
                  className={`w-full text-left px-2 py-1.5 text-[11px] flex items-center gap-2 hover:bg-blue-50 transition-colors ${
                    value === u.value ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-700 font-medium"
                  }`}
                >
                  <span className="font-semibold text-slate-900 w-6 shrink-0">{u.value}</span>
                  <span className="text-slate-500 text-[11px] flex-1 truncate">{u.label.split(" — ")[1]}</span>
                  {value === u.value && (
                    <svg className="w-3 h-3 text-blue-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const ITEM_FORM_TABS = [
  { id: "geral", label: "Geral", icon: FileText },
  { id: "estoque", label: "Estoque", icon: Boxes },
  { id: "financeiro", label: "Financeiro", icon: CircleDollarSign },
] as const;
type ItemFormTab = (typeof ITEM_FORM_TABS)[number]["id"];

export function InventoryItemForm({ tenant, item, categories, onClose, onSave, refreshCategories }: {
  tenant: Tenant | null,
  item: any | null,
  categories: any[],
  onClose: () => void,
  onSave: () => void,
  refreshCategories: () => void
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: item?.name || "",
    code: item?.code || "",
    brand: item?.brand || "",
    purchasePrice: item?.purchasePrice || "",
    sellingPrice: item?.sellingPrice || "",
    quantity: item?.quantity ?? "",
    minStock: item?.minStock || "",
    unit: item?.unit || "un",
    weight: item?.weight || "",
    usage: item?.usage || "SALE",
    categoryId: item?.categoryId || "",
    expirationDate: item?.expirationDate ? new Date(item.expirationDate).toISOString().split('T')[0] : "",
    purchaseDate: item?.purchaseDate ? new Date(item.purchaseDate).toISOString().split('T')[0] : "",
    // Conversão inteligente
    purchaseUnit: item?.purchaseUnit || "",
    purchaseQty: item?.purchaseQty || "",
    stockUnit: item?.stockUnit || "",
  });

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formTab, setFormTab] = useState<ItemFormTab>("geral");

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (loading) return;
    if (!form.name.trim()) { setFormTab("geral"); toast.error("Informe o nome do item."); return; }
    if (form.quantity === "" || form.quantity === null || form.quantity === undefined) { setFormTab("estoque"); toast.error("Informe a quantidade."); return; }
    setLoading(true);
    try {
      const url = item ? `/api/inventory/items/${item.id}` : `/api/inventory/items`;
      const method = item ? 'PATCH' : 'POST';
      await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          tenantId: tenant?.id,
          purchasePrice: parseFloat(form.purchasePrice.toString()) || 0,
          sellingPrice: form.sellingPrice ? parseFloat(form.sellingPrice.toString()) : null,
          quantity: parseFloat(form.quantity.toString()) || 0,
          minStock: form.minStock ? parseFloat(form.minStock.toString()) : null,
          purchaseUnit: form.purchaseUnit || null,
          purchaseQty: form.purchaseQty ? parseFloat(form.purchaseQty.toString()) : null,
          stockUnit: form.stockUnit || null,
        })
      });
      onSave();
    } finally {
      setLoading(false);
    }
  };

  const hasConversion = form.purchaseUnit && form.purchaseQty && form.stockUnit;

  return (
    <div className="space-y-4">
      <Button type="button" variant="ghost" size="sm" iconLeft={<ArrowLeft size={14} />} onClick={onClose}>Voltar</Button>
      <SectionTitle
        icon={Package}
        title={item ? "Editar item de estoque" : "Novo item de estoque"}
        description={form.name || "Estoque"}
      />

      <ContentCard padding="md">
        <form id="inventory-form" onSubmit={handleSubmit} noValidate className="space-y-4">
          <Tabs<ItemFormTab> items={ITEM_FORM_TABS} value={formTab} onChange={setFormTab} label="Dados do item de estoque">
            {formTab === "geral" && (
              <div className="space-y-3">
                <PanelCard title="Identificação" icon={Info} contentClassName="space-y-3">
                  <FormRow>
                    <Input label="Nome" required placeholder="Ex: Coca-Cola 350ml" value={form.name} onChange={e => set("name", e.target.value)} />
                    <Select label="Uso" value={form.usage} onChange={e => set("usage", e.target.value)}>
                      <option value="SALE">Venda direta</option>
                      <option value="INTERNAL">Insumo interno</option>
                    </Select>
                  </FormRow>
                  <FormRow>
                    <Input label="SKU" placeholder="78900..." value={form.code} onChange={e => set("code", e.target.value)} />
                    <Input label="Marca" placeholder="Ambev" value={form.brand} onChange={e => set("brand", e.target.value)} />
                  </FormRow>
                  <div className="flex flex-col gap-1">
                    <label className="ds-label">Categoria</label>
                    <div className="flex gap-1.5 sm:max-w-[50%]">
                      <Select value={form.categoryId} onChange={e => set("categoryId", e.target.value)} wrapperClassName="flex-1 min-w-0">
                        <option value="">Selecione...</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </Select>
                      <IconButton type="button" variant="outline" aria-label="Nova categoria" onClick={() => setIsCategoryModalOpen(true)}>
                        <Plus size={14} />
                      </IconButton>
                    </div>
                  </div>
                </PanelCard>
              </div>
            )}

            {formTab === "estoque" && (
              <div className="space-y-3">
                <PanelCard title="Quantidade e unidade" icon={Boxes} contentClassName="space-y-3">
                  <FormRow>
                    <Input label="Quantidade" required type="number" step="0.001" placeholder="0" value={form.quantity} onChange={e => set("quantity", e.target.value)} />
                    <Input label="Mín. alerta" type="number" step="0.01" placeholder="0" value={form.minStock} onChange={e => set("minStock", e.target.value)} />
                  </FormRow>
                  <FormRow>
                    <UnitSelectInput label="Unidade de armazenamento" value={form.unit} onChange={v => set("unit", v)} size="md" />
                    <Input label="Peso/Volume" placeholder="500g, 1.5L" value={form.weight} onChange={e => set("weight", e.target.value)} />
                  </FormRow>
                </PanelCard>

                <PanelCard
                  title="Conversão de unidades (opcional)"
                  icon={ArrowRightLeft}
                  description="Use quando compra em uma unidade mas consome em outra. Ex: compra 1 garrafa (un) de óleo que contém 1000 ml — na produção desconta em ml."
                  contentClassName="space-y-3"
                >
                  <FormRow cols={3}>
                    <UnitSelectInput label="Unidade de compra" value={form.purchaseUnit} onChange={v => set("purchaseUnit", v)} hint="como você compra" size="md" />
                    <Input label="Conteúdo por unidade" type="number" step="0.001" placeholder="1000" hint="quantidade contida" value={form.purchaseQty} onChange={e => set("purchaseQty", e.target.value)} />
                    <UnitSelectInput label="Unidade granular" value={form.stockUnit} onChange={v => set("stockUnit", v)} hint="usada na produção" size="md" />
                  </FormRow>
                  {hasConversion && (
                    <Alert variant="info">
                      1 <b>{form.purchaseUnit}</b> = <b>{form.purchaseQty} {form.stockUnit}</b>
                      {form.quantity !== "" ? (
                        <> → estoque total: <b>{(parseFloat(form.quantity.toString()) * parseFloat(form.purchaseQty.toString())).toLocaleString("pt-BR")} {form.stockUnit}</b></>
                      ) : null}
                    </Alert>
                  )}
                  {(form.purchaseUnit || form.purchaseQty || form.stockUnit) && !hasConversion && (
                    <Alert variant="warning">Preencha os 3 campos para ativar a conversão automática.</Alert>
                  )}
                </PanelCard>
              </div>
            )}

            {formTab === "financeiro" && (
              <div className="space-y-3">
                <PanelCard title="Preços" icon={CircleDollarSign} contentClassName="space-y-3">
                  <FormRow>
                    <CurrencyInput label="Custo (R$)" value={form.purchasePrice} onChange={v => set("purchasePrice", v)} />
                    <CurrencyInput label="Venda (R$)" value={form.sellingPrice} onChange={v => set("sellingPrice", v)} />
                  </FormRow>
                </PanelCard>
                <PanelCard title="Datas" icon={CalendarClock} contentClassName="space-y-3">
                  <FormRow>
                    <Input label="Compra" type="date" value={form.purchaseDate} onChange={e => set("purchaseDate", e.target.value)} />
                    <Input label="Validade" type="date" value={form.expirationDate} onChange={e => set("expirationDate", e.target.value)} />
                  </FormRow>
                </PanelCard>
              </div>
            )}
          </Tabs>

          <div className="sticky bottom-0 z-10 -mx-3 -mb-3 flex flex-wrap items-center justify-end gap-2 rounded-b-lg border-t border-slate-100 bg-white px-3 py-3">
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>Cancelar</Button>
            <Button type="submit" iconLeft={<Save size={14} />} loading={loading} disabled={loading}>
              {loading ? "Salvando..." : item ? "Salvar alterações" : "Cadastrar item"}
            </Button>
          </div>
        </form>
      </ContentCard>

      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title="Nova Categoria"
        size="sm"
        mobileStyle="center"
      >
        <CategoryForm
          tenantId={tenant?.id || ""}
          onSuccess={() => { refreshCategories(); setIsCategoryModalOpen(false); }}
          onClose={() => setIsCategoryModalOpen(false)}
          isInventory
        />
      </Modal>
    </div>
  );
}

function CategoryForm({ tenantId, onSuccess, onClose, isInventory = false }: { tenantId: string, onSuccess: () => void, onClose: () => void, isInventory?: boolean }) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const url = isInventory ? "/api/inventory/categories" : "/api/categories";
    await apiFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, tenantId })
    });
    onSuccess();
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input
        label="Nome da categoria"
        required
        autoFocus
        placeholder="Ex: Embalagens, Frios..."
        value={name}
        onChange={e => setName(e.target.value)}
      />
      <ModalFooter>
        <Button variant="ghost" type="button" onClick={onClose} disabled={loading}>Voltar</Button>
        <Button variant="primary" type="submit" disabled={loading}>
          {loading ? "Salvando..." : "Criar Categoria"}
        </Button>
      </ModalFooter>
    </form>
  );
}

