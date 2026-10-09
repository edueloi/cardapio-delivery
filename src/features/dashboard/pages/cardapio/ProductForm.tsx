import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Copy,
  Eye,
  FileText,
  Image as ImageIcon,
  Layers,
  ListChecks,
  Luggage,
  Package,
  Plus,
  Receipt,
  Save,
  Trash2,
  Warehouse,
  X,
  PlusCircle,
} from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  ContentCard,
  CurrencyInput,
  DatePicker,
  FormRow,
  IconButton,
  Input,
  FiscalCodeLookup,
  Modal,
  PanelCard,
  Select,
  SectionTitle,
  Switch,
  Tabs,
  Textarea,
  useToast,
} from "../../../../components";
import { apiFetch } from "../../../../lib/api";
import { ProductExtraStockLink } from "../../../../types";
import {
  RecipeIngredientDraft,
  RecipeIngredientsField,
  StockLinksField,
  VariantImageUploader,
} from "../_shared/ManagementShared";

// ── Tipos compartilhados com MenuManagement ───────────────────────────────────

export type ProdTab = "geral" | "estoque" | "visibilidade" | "horario" | "adicionais" | "viagem" | "selecao" | "variantes" | "fiscal";

export interface ProdFormExtra {
  id: string;
  label: string;
  price: string;
  stockLinks: ProductExtraStockLink[];
  autoApplyOnTakeout: boolean;
}

export interface ProdFormSelectionGroup {
  _key: string;
  sourceType: "category" | "products";
  categoryId: string;
  productIds: string[];
  qty: string;
  label: string;
}

export interface ProdFormState {
  name: string; description: string; price: string; imageUrl: string; inventoryItemId: string; recipeId: string;
  available: boolean; pdvOnly: boolean; kitchenPrint: boolean; autoDisableWhenOutOfStock: boolean;
  scheduleRuleEnabled: boolean;
  scheduleRuleType: "weekday" | "daterange" | "both";
  scheduleRuleWeekdays: number[];
  scheduleRuleStartTime: string;
  scheduleRuleEndTime: string;
  scheduleRuleStartDate: string;
  scheduleRuleEndDate: string;
  variants: { _key: string; name: string; price: string; description: string; inventoryItemId: string; imageUrl: string }[];
  extras: ProdFormExtra[];
  selectionGroups: ProdFormSelectionGroup[];
  ncm: string; cfop: string; csosn: string; unitCom: string; origem: number; aliqIcms: number;
}

const MAX_UPLOAD_SIZE_MB = 5;

// ── Foto do produto ───────────────────────────────────────────────────────────

function ProductPhotoField({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_UPLOAD_SIZE_MB * 1024 * 1024) {
      toast.error(`Imagem muito grande (máx. ${MAX_UPLOAD_SIZE_MB}MB). Escolha um arquivo menor.`);
      return;
    }
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await apiFetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        if (res.status === 413) throw new Error(`Imagem muito grande (máx. ${MAX_UPLOAD_SIZE_MB}MB).`);
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Erro ao enviar imagem.");
      }
      const data = await res.json();
      if (data.url) onChange(data.url);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao enviar imagem");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="relative w-full max-w-[240px] aspect-square rounded-lg bg-white border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden group">
        {uploading ? (
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        ) : value ? (
          <>
            <img src={value} className="w-full h-full object-cover" alt="Preview" />
            <div
              onClick={() => onChange("")}
              className="absolute inset-0 bg-red-600/80 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
            >
              <div className="flex flex-col items-center gap-1">
                <Trash2 className="w-5 h-5" />
                <span className="text-[11px] font-medium">Remover</span>
              </div>
            </div>
          </>
        ) : (
          <label className="cursor-pointer flex flex-col items-center gap-1.5 w-full h-full justify-center hover:bg-slate-50 transition-colors">
            <ImageIcon className="w-7 h-7 text-slate-300" />
            <span className="text-[11px] font-medium text-slate-500">Enviar foto</span>
            <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
          </label>
        )}
      </div>
      <p className="text-[11px] text-slate-500 leading-tight">Fotos de alta qualidade convertem mais vendas. Recomendado: quadrada, até {MAX_UPLOAD_SIZE_MB}MB.</p>
    </div>
  );
}

// ── Escolha de item do estoque ────────────────────────────────────────────────

function StockPickerModal({
  open, onClose, inventoryItems, inventoryCategories, usedItemIds, value, onPick,
}: {
  open: boolean;
  onClose: () => void;
  inventoryItems: any[];
  inventoryCategories: any[];
  usedItemIds: Set<string>;
  value: string;
  onPick: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  useEffect(() => {
    if (open) { setSearch(""); setCategoryFilter("all"); }
  }, [open]);

  const saleItems = inventoryItems.filter(item => item.usage !== "INTERNAL");
  const categoryById = new Map(inventoryCategories.map((cat: any) => [cat.id, cat]));
  const filtered = saleItems.filter(item =>
    (!search || item.name.toLowerCase().includes(search.toLowerCase())) &&
    (categoryFilter === "all" || item.categoryId === categoryFilter)
  );
  const groupedFiltered = (() => {
    const groups = new Map<string, { label: string; items: any[] }>();
    for (const item of filtered) {
      const key = item.categoryId || "_none";
      if (!groups.has(key)) groups.set(key, { label: categoryById.get(item.categoryId)?.name || "Sem categoria", items: [] });
      groups.get(key)!.items.push(item);
    }
    return Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label));
  })();

  return (
    <Modal isOpen={open} onClose={onClose} title="Escolher item do estoque" size="sm" zIndex={200}>
      <div className="space-y-3">
        <div className="flex gap-2">
          <Input
            autoFocus
            aria-label="Buscar item"
            wrapperClassName="flex-1 min-w-0"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar item..."
          />
          {inventoryCategories.length > 0 && (
            <Select
              aria-label="Categoria do estoque"
              wrapperClassName="w-36 shrink-0"
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
            >
              <option value="all">Categorias</option>
              {inventoryCategories.map((cat: any) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
            </Select>
          )}
        </div>
        <div className="max-h-[50vh] overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => { onPick(""); onClose(); }}
            className={`w-full flex items-center px-3 py-2 text-xs font-medium text-left transition-colors ${!value ? "bg-blue-50 text-blue-700" : "hover:bg-slate-50 text-slate-500"}`}
          >
            Sem vínculo de estoque
          </button>
          {groupedFiltered.map(group => (
            <div key={group.label}>
              {categoryFilter === "all" && (
                <p className="text-[11px] font-medium text-slate-500 bg-slate-50 px-3 py-1.5">{group.label}</p>
              )}
              {group.items.map((item: any) => {
                const alreadyUsed = usedItemIds.has(item.id);
                const isSelected = value === item.id;
                const statusLabel = item.quantity <= 0 ? "Esgotado" : `${item.quantity} ${item.unit || "un"}`;
                const statusColor = item.quantity <= 0 ? "text-red-600" : item.quantity < 5 ? "text-amber-600" : "text-emerald-600";
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={alreadyUsed && !isSelected}
                    onClick={() => { onPick(item.id); onClose(); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${isSelected ? "bg-blue-50" : alreadyUsed ? "opacity-45 cursor-not-allowed" : "hover:bg-slate-50"}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-800 truncate leading-tight">{item.name}</p>
                      {alreadyUsed && !isSelected && <p className="text-[11px] text-slate-500 leading-tight">Já vinculado a outro produto</p>}
                    </div>
                    <span className={`text-[11px] font-medium shrink-0 ${statusColor}`}>{statusLabel}</span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
          ))}
          {filtered.length === 0 && <p className="text-center text-xs text-slate-500 py-8">Nenhum item encontrado</p>}
        </div>
      </div>
    </Modal>
  );
}

// Campo de vínculo de estoque — abre o StockPickerModal acima.
function StockLinkField({
  inventoryItems, inventoryCategories, value, onChange, autoDisable, onAutoDisableChange, allCategories, editingProductId,
}: {
  inventoryItems: any[];
  inventoryCategories: any[];
  value: string;
  onChange: (val: string) => void;
  autoDisable: boolean;
  onAutoDisableChange: (val: boolean) => void;
  allCategories: any[];
  editingProductId?: string;
}) {
  const [open, setOpen] = useState(false);
  const saleItems = inventoryItems.filter(item => item.usage !== "INTERNAL");
  const selectedItem = saleItems.find(i => i.id === value);
  const allProducts = allCategories.flatMap((c: any) => c.products || []);
  const usedItemIds = new Set(
    allProducts.filter((p: any) => p.id !== editingProductId && p.inventoryItemId).map((p: any) => p.inventoryItemId)
  );

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-slate-600">Vincular ao estoque <span className="text-slate-500 font-normal">(opcional)</span></label>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between gap-3 bg-white border border-zinc-200 rounded-lg px-3 h-[34px] text-xs text-left hover:border-blue-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      >
        {selectedItem ? (
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className="text-slate-800 truncate">{selectedItem.name}</span>
            <span className={`text-[11px] font-medium ${selectedItem.quantity <= 0 ? "text-red-600" : selectedItem.quantity < 5 ? "text-amber-600" : "text-emerald-600"}`}>
              {selectedItem.quantity <= 0 ? "Esgotado" : `${selectedItem.quantity} ${selectedItem.unit || "un"}`}
            </span>
          </div>
        ) : (
          <span className="text-slate-500">Sem vínculo de estoque</span>
        )}
        <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {value && (
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={autoDisable} onChange={e => onAutoDisableChange(e.target.checked)} className="h-4 w-4 accent-blue-600" />
          <span className="text-xs text-slate-600">Desativar automaticamente quando o estoque zerar</span>
        </label>
      )}
      {saleItems.length === 0 && <p className="text-[11px] text-slate-500 italic">Nenhum item de venda cadastrado no estoque.</p>}
      <StockPickerModal
        open={open}
        onClose={() => setOpen(false)}
        inventoryItems={inventoryItems}
        inventoryCategories={inventoryCategories}
        usedItemIds={usedItemIds}
        value={value}
        onPick={onChange}
      />
    </div>
  );
}

// ── Formulário (página inteira) ───────────────────────────────────────────────

export interface ProductFormProps {
  isEditing: boolean;
  editingProductId?: string;
  prodForm: ProdFormState;
  setProdForm: React.Dispatch<React.SetStateAction<ProdFormState>>;
  tab: ProdTab;
  onTabChange: (tab: ProdTab) => void;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onDuplicateToInventory: () => void;
  canManageInventory: boolean;
  categories: any[];
  currentCategoryId: string | null;
  inventoryItems: any[];
  inventoryCategories: any[];
  recipeIngredients: RecipeIngredientDraft[];
  setRecipeIngredients: (val: RecipeIngredientDraft[]) => void;
  extraInput: { label: string; price: string };
  setExtraInput: React.Dispatch<React.SetStateAction<{ label: string; price: string }>>;
  takeoutExtra: ProdFormExtra | null;
  visibleExtras: ProdFormExtra[];
  enableTakeoutKit: (enabled: boolean) => void;
  updateTakeoutExtra: (patch: Partial<ProdFormExtra>) => void;
  addVariantField: () => void;
  removeVariantField: (i: number) => void;
  updateVariantField: (i: number, field: string, value: string) => void;
  addSelectionGroupField: () => void;
  removeSelectionGroupField: (i: number) => void;
  updateSelectionGroupField: (i: number, field: string, value: any) => void;
}

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function ProductForm(props: ProductFormProps) {
  const {
    isEditing, editingProductId, prodForm, setProdForm, tab, onTabChange, saving, onSave, onCancel, onDelete,
    onDuplicate, onDuplicateToInventory, canManageInventory, categories, currentCategoryId, inventoryItems,
    inventoryCategories, recipeIngredients, setRecipeIngredients, extraInput, setExtraInput, takeoutExtra,
    visibleExtras, enableTakeoutKit, updateTakeoutExtra, addVariantField, removeVariantField, updateVariantField,
    addSelectionGroupField, removeSelectionGroupField, updateSelectionGroupField,
  } = props;

  const counts: Partial<Record<ProdTab, number>> = {
    adicionais: visibleExtras.length,
    viagem: takeoutExtra?.stockLinks.length || 0,
    selecao: prodForm.selectionGroups.length,
    variantes: prodForm.variants.length,
  };
  const tabItems = ([
    { id: "geral", label: "Geral", icon: FileText },
    { id: "estoque", label: "Estoque", icon: Warehouse },
    { id: "visibilidade", label: "Visibilidade", icon: Eye },
    { id: "horario", label: "Horário", icon: CalendarClock },
    { id: "adicionais", label: "Adicionais", icon: PlusCircle },
    { id: "viagem", label: "Viagem", icon: Luggage },
    { id: "selecao", label: "Seleção", icon: ListChecks },
    { id: "variantes", label: "Variantes", icon: Layers },
    { id: "fiscal", label: "Fiscal", icon: Receipt },
  ] as const).map(t => ({ ...t, badge: counts[t.id] || undefined }));

  const addExtraFromInput = () => {
    if (!extraInput.label.trim()) return;
    setProdForm(prev => ({ ...prev, extras: [...prev.extras, { id: crypto.randomUUID(), label: extraInput.label.trim(), price: extraInput.price, stockLinks: [], autoApplyOnTakeout: false }] }));
    setExtraInput({ label: "", price: "" });
  };

  const weekdayRule = prodForm.scheduleRuleType === "weekday" || prodForm.scheduleRuleType === "both";
  const dateRule = prodForm.scheduleRuleType === "daterange" || prodForm.scheduleRuleType === "both";

  return (
    <div className="space-y-4">
      <Button type="button" variant="ghost" size="sm" iconLeft={<ArrowLeft size={14} />} onClick={onCancel}>Voltar</Button>
      <SectionTitle
        icon={Package}
        title={isEditing ? "Editar produto" : "Novo produto"}
        description={prodForm.name || "Cardápio"}
        action={isEditing ? (
          <Button type="button" variant="outline" size="sm" iconLeft={<Trash2 size={14} className="text-red-600" />} onClick={onDelete}>Excluir produto</Button>
        ) : undefined}
      />

      <ContentCard padding="md">
        <form onSubmit={e => { e.preventDefault(); onSave(); }} className="space-y-4">
          <Tabs<ProdTab> items={tabItems} value={tab} onChange={onTabChange} label="Dados do produto">
            {/* GERAL */}
            {tab === "geral" && (
              <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-4 items-start">
                <PanelCard title="Foto" icon={ImageIcon}>
                  <ProductPhotoField value={prodForm.imageUrl} onChange={val => setProdForm(f => ({ ...f, imageUrl: val }))} />
                </PanelCard>
                <PanelCard title="Identificação e preço" icon={FileText} contentClassName="space-y-3">
                  <FormRow>
                    <Input label="Nome do produto" placeholder="Ex: Pastel de carne" value={prodForm.name} onChange={e => setProdForm(f => ({ ...f, name: e.target.value }))} />
                    <CurrencyInput label="Preço base (R$)" value={prodForm.price} onChange={v => setProdForm(f => ({ ...f, price: v }))} />
                  </FormRow>
                  <Textarea
                    label="Descrição (opcional)"
                    placeholder="Ingredientes, detalhes..."
                    value={prodForm.description}
                    onChange={e => setProdForm(f => ({ ...f, description: e.target.value }))}
                    rows={4}
                  />
                  <Badge color={prodForm.available ? "success" : "default"} dot>{prodForm.available ? "Ativo no cardápio" : "Inativo"}</Badge>
                </PanelCard>
              </div>
            )}

            {/* ESTOQUE */}
            {tab === "estoque" && (
              <div className="space-y-3">
                <PanelCard title="Vínculo de estoque" icon={Warehouse}>
                  <StockLinkField
                    inventoryItems={inventoryItems}
                    inventoryCategories={inventoryCategories}
                    value={prodForm.inventoryItemId}
                    onChange={val => setProdForm(f => ({ ...f, inventoryItemId: val }))}
                    autoDisable={prodForm.autoDisableWhenOutOfStock}
                    onAutoDisableChange={val => setProdForm(f => ({ ...f, autoDisableWhenOutOfStock: val }))}
                    allCategories={categories}
                    editingProductId={editingProductId}
                  />
                </PanelCard>
                <PanelCard title="Insumos usados" icon={Package}>
                  <RecipeIngredientsField
                    inventoryItems={inventoryItems}
                    inventoryCategories={inventoryCategories}
                    value={recipeIngredients}
                    onChange={setRecipeIngredients}
                  />
                </PanelCard>
              </div>
            )}

            {/* VISIBILIDADE */}
            {tab === "visibilidade" && (
              <PanelCard title="Onde o produto aparece" icon={Eye} contentClassName="divide-y divide-slate-100">
                <div className="flex items-center justify-between gap-3 pb-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-800">Produto ativo no cardápio</p>
                    <p className="text-[11px] text-slate-500">Clientes conseguem ver e pedir este produto</p>
                  </div>
                  <Switch aria-label="Produto ativo no cardápio" checked={prodForm.available} onCheckedChange={v => setProdForm(f => ({ ...f, available: v }))} />
                </div>
                <div className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-800">Exclusivo PDV</p>
                    <p className="text-[11px] text-slate-500">Visível apenas no PDV, não aparece no cardápio online</p>
                  </div>
                  <Switch aria-label="Exclusivo PDV" checked={prodForm.pdvOnly} onCheckedChange={v => setProdForm(f => ({ ...f, pdvOnly: v }))} />
                </div>
                <div className="flex items-center justify-between gap-3 pt-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-800">Vai para a cozinha</p>
                    <p className="text-[11px] text-slate-500">Ative para itens que precisam de preparo — bebidas/embalagens ficam desativadas por padrão</p>
                  </div>
                  <Switch aria-label="Vai para a cozinha" checked={prodForm.kitchenPrint === true} onCheckedChange={v => setProdForm(f => ({ ...f, kitchenPrint: v }))} />
                </div>
              </PanelCard>
            )}

            {/* HORÁRIO */}
            {tab === "horario" && (
              <PanelCard title="Disponibilidade automática" icon={CalendarClock} contentClassName="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-800">Aparecer/sumir automaticamente</p>
                    <p className="text-[11px] text-slate-500">Produto aparece/some do cardápio online automaticamente</p>
                  </div>
                  <Switch aria-label="Disponibilidade automática" checked={prodForm.scheduleRuleEnabled} onCheckedChange={v => setProdForm(f => ({ ...f, scheduleRuleEnabled: v }))} />
                </div>

                {prodForm.scheduleRuleEnabled && (
                  <div className="space-y-3 border-t border-slate-100 pt-3">
                    <div>
                      <p className="text-xs font-medium text-slate-600 mb-1.5">Tipo de regra</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {([
                          { value: "weekday", label: "Dia da semana" },
                          { value: "daterange", label: "Período (datas)" },
                          { value: "both", label: "Os dois" },
                        ] as const).map(opt => (
                          <Button
                            key={opt.value}
                            type="button"
                            size="sm"
                            variant={prodForm.scheduleRuleType === opt.value ? "primary" : "outline"}
                            onClick={() => setProdForm(f => ({ ...f, scheduleRuleType: opt.value }))}
                          >
                            {opt.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {weekdayRule && (
                      <div>
                        <p className="text-xs font-medium text-slate-600 mb-1.5">Dias ativos</p>
                        <div className="flex flex-wrap gap-1.5">
                          {WEEKDAY_LABELS.map((label, idx) => {
                            const active = prodForm.scheduleRuleWeekdays.includes(idx);
                            return (
                              <Button
                                key={label}
                                type="button"
                                size="xs"
                                className="w-12"
                                variant={active ? "primary" : "outline"}
                                onClick={() => setProdForm(f => ({
                                  ...f,
                                  scheduleRuleWeekdays: active
                                    ? f.scheduleRuleWeekdays.filter(d => d !== idx)
                                    : [...f.scheduleRuleWeekdays, idx],
                                }))}
                              >
                                {label}
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {weekdayRule && (
                      <div>
                        <p className="text-xs font-medium text-slate-600 mb-1.5">Horário (opcional)</p>
                        <FormRow>
                          <Input type="time" label="Aparece às" value={prodForm.scheduleRuleStartTime} onChange={e => setProdForm(f => ({ ...f, scheduleRuleStartTime: e.target.value }))} />
                          <Input type="time" label="Some às" value={prodForm.scheduleRuleEndTime} onChange={e => setProdForm(f => ({ ...f, scheduleRuleEndTime: e.target.value }))} />
                        </FormRow>
                        <p className="text-[11px] text-slate-500 mt-1.5">Deixe em branco para ficar visível o dia todo (00:00–23:59).</p>
                      </div>
                    )}

                    {dateRule && (
                      <div>
                        <p className="text-xs font-medium text-slate-600 mb-1.5">Período de visibilidade</p>
                        <FormRow>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-600">Data início</label>
                            <DatePicker value={prodForm.scheduleRuleStartDate} onChange={v => setProdForm(f => ({ ...f, scheduleRuleStartDate: v || "" }))} placeholder="dd/mm/aaaa" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-600">Data fim</label>
                            <DatePicker value={prodForm.scheduleRuleEndDate} onChange={v => setProdForm(f => ({ ...f, scheduleRuleEndDate: v || "" }))} placeholder="dd/mm/aaaa" />
                          </div>
                        </FormRow>
                      </div>
                    )}
                  </div>
                )}
              </PanelCard>
            )}

            {/* ADICIONAIS */}
            {tab === "adicionais" && (
              <div className="space-y-3">
                <PanelCard title="Novo adicional" icon={PlusCircle} description="Ex: Gelo, Limão, Sem Cebola, Molho extra. O cliente seleciona antes de adicionar ao carrinho." contentClassName="space-y-3">
                  <div className="flex flex-wrap gap-2 items-end">
                    <Input
                      label="Nome"
                      wrapperClassName="flex-1 min-w-[160px]"
                      placeholder="Nome (ex: Gelo)"
                      value={extraInput.label}
                      onChange={e => setExtraInput(prev => ({ ...prev, label: e.target.value }))}
                      onKeyDown={e => {
                        if (e.key === "Enter" && extraInput.label.trim()) {
                          e.preventDefault();
                          addExtraFromInput();
                        }
                      }}
                    />
                    <Input
                      label="Preço"
                      wrapperClassName="w-36"
                      placeholder="R$ (0 = grátis)"
                      value={extraInput.price}
                      onChange={e => setExtraInput(prev => ({ ...prev, price: e.target.value }))}
                    />
                    <Button type="button" iconLeft={<Plus size={14} />} onClick={addExtraFromInput}>Adicionar</Button>
                  </div>
                </PanelCard>

                {visibleExtras.length > 0 && (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    {visibleExtras.map(ex => (
                      <PanelCard
                        key={ex.id}
                        title={`${ex.label}${parseFloat(ex.price) > 0 ? ` +R$${parseFloat(ex.price).toFixed(2)}` : " (grátis)"}`}
                        action={
                          <IconButton
                            type="button"
                            size="xs"
                            variant="ghost"
                            aria-label="Remover adicional"
                            title="Remover adicional"
                            onClick={() => setProdForm(prev => ({ ...prev, extras: prev.extras.filter(e => e.id !== ex.id) }))}
                          >
                            <Trash2 size={14} className="text-red-600" />
                          </IconButton>
                        }
                      >
                        <StockLinksField
                          value={ex.stockLinks}
                          onChange={links => setProdForm(prev => ({ ...prev, extras: prev.extras.map(x => x.id === ex.id ? { ...x, stockLinks: links } : x) }))}
                          inventoryItems={inventoryItems}
                          inventoryCategories={inventoryCategories}
                        />
                      </PanelCard>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* VIAGEM */}
            {tab === "viagem" && (
              <PanelCard title="Kit para viagem" icon={Luggage} contentClassName="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-800">Consumir kit ao escolher "Para viagem"</p>
                    <p className="text-[11px] text-slate-500">Consome os itens abaixo automaticamente quando o cliente escolhe "Para viagem" — não aparece como opção pro cliente</p>
                  </div>
                  <Switch aria-label="Kit para viagem" checked={!!takeoutExtra} onCheckedChange={enableTakeoutKit} />
                </div>
                {takeoutExtra && (
                  <div className="border-t border-slate-100 pt-3 space-y-2">
                    <StockLinksField
                      value={takeoutExtra.stockLinks}
                      onChange={links => updateTakeoutExtra({ stockLinks: links })}
                      inventoryItems={inventoryItems}
                      inventoryCategories={inventoryCategories}
                    />
                    <p className="text-[11px] text-slate-500">Vincule aqui embalagem, sacola, lacre, canudo ou qualquer outro insumo e informe a quantidade. A baixa acontece automaticamente junto com a venda.</p>
                  </div>
                )}
              </PanelCard>
            )}

            {/* SELEÇÃO */}
            {tab === "selecao" && (
              <div className="space-y-3">
                {prodForm.variants.length > 0 && prodForm.selectionGroups.length > 0 && (
                  <Alert variant="warning">
                    Este produto já tem variações — remova-as ou remova os grupos de seleção abaixo. Os dois juntos fazem o cliente escolher o sabor duas vezes.
                  </Alert>
                )}
                <PanelCard
                  title="Cliente escolhe itens (preço fixo)"
                  icon={ListChecks}
                  description='Ex: numa marmita, um grupo "Guarnição" (escolhe 1), outro "Arroz" (escolhe 1) — cada grupo puxa de uma categoria já cadastrada, sem alterar o preço do produto.'
                  action={
                    <Button type="button" size="xs" variant="outline" iconLeft={<Plus size={14} />} disabled={prodForm.variants.length > 0} onClick={addSelectionGroupField}>
                      Adicionar grupo
                    </Button>
                  }
                />
                {prodForm.selectionGroups.length > 0 && (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    {prodForm.selectionGroups.map((g, idx) => (
                      <PanelCard
                        key={g._key}
                        title={g.label || `Grupo ${idx + 1}`}
                        contentClassName="space-y-3"
                        action={
                          <IconButton type="button" size="xs" variant="ghost" aria-label="Remover grupo" onClick={() => removeSelectionGroupField(idx)}>
                            <Trash2 size={14} className="text-red-600" />
                          </IconButton>
                        }
                      >
                        <Input
                          label="Rótulo do grupo"
                          placeholder={`Rótulo do grupo ${idx + 1} (ex: Guarnição)`}
                          value={g.label}
                          onChange={e => updateSelectionGroupField(idx, "label", e.target.value)}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Button type="button" size="sm" variant={g.sourceType === "category" ? "primary" : "outline"} onClick={() => updateSelectionGroupField(idx, "sourceType", "category")}>Categoria inteira</Button>
                          <Button type="button" size="sm" variant={g.sourceType === "products" ? "primary" : "outline"} onClick={() => updateSelectionGroupField(idx, "sourceType", "products")}>Itens específicos</Button>
                        </div>

                        {g.sourceType === "category" ? (
                          <Select
                            label="Categoria de onde vêm as opções"
                            value={g.categoryId}
                            onChange={e => updateSelectionGroupField(idx, "categoryId", e.target.value)}
                          >
                            <option value="">Selecione...</option>
                            {categories.filter(c => c.id !== currentCategoryId).map(c => (
                              <option key={c.id} value={c.id}>{c.name} ({c.products?.length || 0} itens)</option>
                            ))}
                          </Select>
                        ) : (
                          <div>
                            <label className="text-xs font-medium text-slate-600 block mb-1">Selecione os itens que entram como opção</label>
                            <div className="max-h-48 overflow-y-auto space-y-0.5 rounded-lg border border-slate-200 p-1.5">
                              {categories.flatMap(c => c.products || []).map((p: any) => {
                                const checked = g.productIds.includes(p.id);
                                return (
                                  <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => updateSelectionGroupField(idx, "productIds", checked
                                        ? g.productIds.filter((id: string) => id !== p.id)
                                        : [...g.productIds, p.id])}
                                      className="h-4 w-4 accent-blue-600"
                                    />
                                    <span className="text-xs text-slate-700">{p.name}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <Input
                          label="Quantos itens o cliente escolhe neste grupo"
                          type="number"
                          min={1}
                          value={g.qty}
                          onChange={e => updateSelectionGroupField(idx, "qty", e.target.value.replace(/\D/g, ""))}
                        />
                      </PanelCard>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* VARIANTES */}
            {tab === "variantes" && (
              <div className="space-y-3">
                <PanelCard
                  title="Tamanhos / Variantes"
                  icon={Layers}
                  description={prodForm.selectionGroups.length > 0 ? "Remova os grupos de seleção para usar variações" : "Cada variação tem nome e preço próprios."}
                  action={prodForm.selectionGroups.length > 0 ? undefined : (
                    <Button type="button" size="xs" variant="outline" iconLeft={<Plus size={14} />} onClick={addVariantField}>Adicionar</Button>
                  )}
                />
                {prodForm.variants.length > 0 && (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    {prodForm.variants.map((v, idx) => (
                      <PanelCard
                        key={v._key}
                        title={v.name || `Variação ${idx + 1}`}
                        action={
                          <IconButton type="button" size="xs" variant="ghost" aria-label="Remover variação" onClick={() => removeVariantField(idx)}>
                            <X size={14} className="text-red-600" />
                          </IconButton>
                        }
                      >
                        <div className="flex gap-3 items-start">
                          <VariantImageUploader value={v.imageUrl} onChange={val => updateVariantField(idx, "imageUrl", val)} />
                          <div className="flex-1 min-w-0 space-y-3">
                            <FormRow>
                              <Input label="Nome" placeholder="Nome (ex: 500ml)" value={v.name} onChange={e => updateVariantField(idx, "name", e.target.value)} />
                              <Input label="Preço" placeholder="R$" value={v.price} onChange={e => updateVariantField(idx, "price", e.target.value)} />
                            </FormRow>
                            <Select
                              label="Estoque (opcional)"
                              value={v.inventoryItemId}
                              onChange={e => updateVariantField(idx, "inventoryItemId", e.target.value)}
                            >
                              <option value="">Sem vínculo de estoque (opcional)</option>
                              {inventoryItems.filter((item: any) => item.usage !== "INTERNAL").map((item: any) => (
                                <option key={item.id} value={item.id}>
                                  {item.name} — {item.quantity <= 0 ? "Esgotado" : `${item.quantity} ${item.unit || "un"}`}
                                </option>
                              ))}
                            </Select>
                          </div>
                        </div>
                      </PanelCard>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* FISCAL */}
            {tab === "fiscal" && (
              <PanelCard title="Dados fiscais (NFC-e)" icon={Receipt} description="Preencha apenas se o módulo fiscal (NFC-e) estiver ativo nas configurações da loja." contentClassName="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  <div className="flex items-end gap-2">
                    <Input label="NCM" maxLength={10} value={prodForm.ncm} placeholder="00000000" wrapperClassName="flex-1"
                      onChange={e => setProdForm(f => ({ ...f, ncm: e.target.value.replace(/\D/g, "") }))} />
                    <FiscalCodeLookup onSelect={item => setProdForm(f => ({ ...f, ncm: item.code }))} className="mb-px" />
                  </div>
                  <Select label="CFOP" value={prodForm.cfop} onChange={e => setProdForm(f => ({ ...f, cfop: e.target.value }))}>
                    <option value="5102">5102 — Venda mercadoria adquirida</option>
                    <option value="5405">5405 — Venda c/ ST</option>
                    <option value="5101">5101 — Venda de produção própria</option>
                    <option value="5933">5933 — Simples Nacional — serviço</option>
                  </Select>
                  <Select label="CSOSN" value={prodForm.csosn} onChange={e => setProdForm(f => ({ ...f, csosn: e.target.value }))}>
                    <option value="102">102 — Tributada sem permissão crédito</option>
                    <option value="103">103 — Isento faixa receita bruta</option>
                    <option value="500">500 — ICMS cobrado por ST</option>
                    <option value="900">900 — Outros</option>
                  </Select>
                  <Select label="Unidade" value={prodForm.unitCom} onChange={e => setProdForm(f => ({ ...f, unitCom: e.target.value }))}>
                    {["UN", "KG", "G", "L", "ML", "CX", "PC", "PT", "PAR", "DZ"].map(u => <option key={u} value={u}>{u}</option>)}
                  </Select>
                  <Select label="Origem" value={prodForm.origem} onChange={e => setProdForm(f => ({ ...f, origem: Number(e.target.value) }))}>
                    <option value={0}>0 — Nacional</option>
                    <option value={1}>1 — Estrangeira (importação direta)</option>
                    <option value={2}>2 — Estrangeira (mercado interno)</option>
                  </Select>
                  <Input label="Alíq. ICMS %" type="number" min={0} max={100} step={0.01} value={prodForm.aliqIcms}
                    onChange={e => setProdForm(f => ({ ...f, aliqIcms: parseFloat(e.target.value) || 0 }))} />
                </div>
              </PanelCard>
            )}
          </Tabs>

          <div className="sticky bottom-0 z-10 -mx-3 -mb-3 flex flex-wrap items-center justify-between gap-2 rounded-b-lg border-t border-slate-100 bg-white px-3 py-3">
            <div className="flex flex-wrap gap-2">
              {isEditing && (
                <Button type="button" variant="outline" size="sm" iconLeft={<Copy size={14} />} onClick={onDuplicate}>Duplicar</Button>
              )}
              {isEditing && canManageInventory && (
                <Button type="button" variant="outline" size="sm" iconLeft={<Warehouse size={14} />} onClick={onDuplicateToInventory}>Criar no estoque</Button>
              )}
            </div>
            <div className="flex flex-wrap justify-end gap-2 ml-auto">
              <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>Cancelar</Button>
              <Button type="submit" iconLeft={<Save size={14} />} loading={saving} disabled={saving}>
                {saving ? "Salvando..." : isEditing ? "Salvar alterações" : "Adicionar produto"}
              </Button>
            </div>
          </div>
        </form>
      </ContentCard>
    </div>
  );
}
