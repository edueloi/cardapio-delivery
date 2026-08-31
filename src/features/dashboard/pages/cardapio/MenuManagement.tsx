import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CheckCircle2,
  CircleDollarSign,
  Eye,
  FileText,
  List,
  Package,
  Plus,
  Search,
  Settings,
  Trash2,
  Utensils,
  X,
} from "lucide-react";
import {
  Badge,
  Button,
  ConfirmModal,
  ContentCard,
  CurrencyInput,
  FilterLineSegmented,
  Input,
  Modal,
  ModalFooter,
  PageWrapper,
  SectionTitle,
  Select,
  Switch,
  Textarea,
  useToast,
} from "../../../../components";
import { apiFetch } from "../../../../lib/api";
import { Tenant } from "../../../../types";
import { canAccess, type MyMembership } from "../../types";
import {
  ImageUploader,
  InventoryLinkField,
  RecipeIngredientDraft,
  RecipeIngredientsField,
  VariantImageUploader,
} from "../_shared/ManagementShared";

function SortableProductRow({
  prod, dragEnabled, fmt, toggleProductAvailability, openEditProduct, setDeleteProductConfirm,
}: {
  prod: any;
  dragEnabled: boolean;
  fmt: (n: number) => string;
  toggleProductAvailability: (prod: any) => void;
  openEditProduct: (prod: any) => void;
  setDeleteProductConfirm: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: prod.id,
    data: { type: "product", categoryId: prod.categoryId },
    disabled: !dragEnabled,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`grid grid-cols-[auto_48px_minmax(0,1fr)] sm:flex sm:items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 transition-colors ${!prod.available ? 'bg-slate-50/50 opacity-70' : 'bg-white'} ${isDragging ? 'opacity-40 z-10 relative' : ''}`}
    >
      {dragEnabled && (
        <button
          {...attributes}
          {...listeners}
          className="shrink-0 p-1 -ml-1 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing touch-none"
          title="Arrastar para reordenar ou mover"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="5" cy="4" r="1.3" fill="currentColor"/><circle cx="11" cy="4" r="1.3" fill="currentColor"/>
            <circle cx="5" cy="8" r="1.3" fill="currentColor"/><circle cx="11" cy="8" r="1.3" fill="currentColor"/>
            <circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="11" cy="12" r="1.3" fill="currentColor"/>
          </svg>
        </button>
      )}
      <div className={`w-12 h-12 bg-slate-100 rounded-xl overflow-hidden shrink-0 transition-all duration-500 ${!prod.available ? 'grayscale opacity-60 scale-95 border-2 border-slate-200' : 'border border-transparent'}`}>
        {prod.imageUrl
          ? <img src={prod.imageUrl} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-slate-300"><Utensils className="w-5 h-5" /></div>
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`text-sm font-bold truncate transition-colors ${!prod.available ? 'text-slate-400 italic' : 'text-slate-800'}`}>{prod.name}</p>
          {!prod.available && (
            <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-white bg-slate-400 px-1.5 py-0.5 rounded-full shadow-sm">Inativo</span>
          )}
          {(prod as any).scheduleRule && (
            <span className="shrink-0 text-[9px] font-black uppercase tracking-widest text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded-full">📅 Agendado</span>
          )}
        </div>
        <p className="text-xs text-slate-400 font-medium flex items-center gap-2">
          {prod.variants?.length > 0
            ? `${prod.variants.length} variações • desde ${fmt(Math.min(...prod.variants.map((v: any) => v.price)))}`
            : fmt(prod.price)
          }
          {prod.inventoryItem && (
            <>
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              <span className={`font-black uppercase text-[10px] ${
                prod.inventoryItem.quantity <= 0
                  ? "text-red-500"
                  : prod.inventoryItem.quantity < 5
                    ? "text-amber-500"
                    : "text-green-600"
              }`}>
                {prod.inventoryItem.quantity <= 0
                  ? "Esgotado"
                  : `${prod.inventoryItem.quantity} ${prod.inventoryItem.unit || 'un'}`
                }
              </span>
            </>
          )}
        </p>
        {prod.description && (
          <p className="text-[11px] text-slate-400 truncate mt-0.5">{prod.description}</p>
        )}
      </div>
      <div className="col-span-3 sm:col-span-1 flex items-center justify-end gap-1 shrink-0 border-t border-slate-100 pt-2 sm:border-0 sm:pt-0">
        <button
          onClick={() => toggleProductAvailability(prod)}
          title={prod.available ? "Desativar produto" : "Ativar produto"}
          className={`p-2 rounded-lg transition-colors ${prod.available ? 'text-green-500 hover:text-slate-400 hover:bg-slate-100' : 'text-slate-300 hover:text-green-500 hover:bg-green-50'}`}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            {prod.available
              ? <><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.6"/><path d="M5.5 8L7 9.5L10.5 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></>
              : <><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.6"/><path d="M6 6L10 10M10 6L6 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></>
            }
          </svg>
        </button>
        <button onClick={() => openEditProduct(prod)} className="p-2 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
          <Settings className="w-4 h-4" />
        </button>
        <button onClick={() => setDeleteProductConfirm(prod.id)} className="p-2 text-slate-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function ProductRowGhost({ prod, fmt }: { prod: any; fmt: (n: number) => string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl shadow-2xl border border-[#C9A227]/40 rotate-1">
      <div className="w-12 h-12 bg-slate-100 rounded-xl overflow-hidden shrink-0">
        {prod.imageUrl
          ? <img src={prod.imageUrl} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-slate-300"><Utensils className="w-5 h-5" /></div>
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-800 truncate">{prod.name}</p>
        <p className="text-xs text-slate-400 font-medium">{fmt(prod.price)}</p>
      </div>
    </div>
  );
}

function EmptyCategoryDropZone({ categoryId, isDraggingProduct, openNewProduct }: {
  categoryId: string;
  isDraggingProduct: boolean;
  openNewProduct: (categoryId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${categoryId}-empty`, data: { type: "category-drop", categoryId } });
  return (
    <div
      ref={setNodeRef}
      className={`px-4 py-6 text-center transition-colors ${isOver ? 'bg-amber-50' : ''}`}
    >
      <p className="text-xs text-slate-400 font-medium">
        {isDraggingProduct ? "Solte aqui para mover para esta categoria" : "Nenhum produto ainda."}
      </p>
      <button onClick={() => openNewProduct(categoryId)} className="mt-2 text-xs font-black text-[#C9A227] hover:underline">
        + Adicionar produto
      </button>
    </div>
  );
}

function SortableCategoryCard({
  cat, dragEnabled, openNewProduct, openEditCategory, openEditProduct,
  toggleProductAvailability, setDeleteProductConfirm, fmt,
}: {
  cat: any;
  dragEnabled: boolean;
  openNewProduct: (categoryId: string) => void;
  openEditCategory: (cat: any) => void;
  openEditProduct: (prod: any) => void;
  toggleProductAvailability: (prod: any) => void;
  setDeleteProductConfirm: (id: string) => void;
  fmt: (n: number) => string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cat.id,
    data: { type: "category" },
    disabled: !dragEnabled,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const productIds = (cat.products || []).map((p: any) => p.id);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden mb-3 last:mb-0 ${isDragging ? 'opacity-40 z-10 relative' : ''}`}
    >
      {/* Category header */}
      <div className="px-3 sm:px-4 py-3 border-b border-slate-100 bg-slate-50/60 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {dragEnabled && (
            <button
              {...attributes}
              {...listeners}
              className="shrink-0 p-1 -ml-1 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing touch-none"
              title="Arrastar para reordenar categoria"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <circle cx="5" cy="4" r="1.3" fill="currentColor"/><circle cx="11" cy="4" r="1.3" fill="currentColor"/>
                <circle cx="5" cy="8" r="1.3" fill="currentColor"/><circle cx="11" cy="8" r="1.3" fill="currentColor"/>
                <circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="11" cy="12" r="1.3" fill="currentColor"/>
              </svg>
            </button>
          )}
          <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs truncate">{cat.name}
            <span className="ml-2 text-zinc-400 font-bold normal-case tracking-normal">{cat.products?.length || 0} itens</span>
          </h3>
        </div>
        <div className="flex items-center justify-end gap-1 shrink-0">
          <button
            onClick={() => openNewProduct(cat.id)}
            className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-[#C9A227] hover:text-[#A8841C] px-2 py-1.5 rounded-lg hover:bg-amber-50 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Produto
          </button>
          <button
            onClick={() => openEditCategory(cat)}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            title="Editar categoria"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="divide-y divide-slate-50">
        {cat.products?.length === 0 && (
          <EmptyCategoryDropZone categoryId={cat.id} isDraggingProduct={dragEnabled} openNewProduct={openNewProduct} />
        )}
        <SortableContext items={productIds} strategy={verticalListSortingStrategy}>
          {cat.products?.map((prod: any) => (
            <SortableProductRow
              key={prod.id}
              prod={{ ...prod, categoryId: cat.id }}
              dragEnabled={dragEnabled}
              fmt={fmt}
              toggleProductAvailability={toggleProductAvailability}
              openEditProduct={openEditProduct}
              setDeleteProductConfirm={setDeleteProductConfirm}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

export function MenuManagement({ tenant, refresh, membership }: { tenant: Tenant | null, refresh: () => void, membership?: MyMembership | null }) {
  const canManageInventory = canAccess(membership ?? null, "inventory");
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string>("all");
  // Lazy initializer: popula de imediato com o que o tenant já trouxer, evitando
  // o "flash vazio" que aparecia sempre que esta tela era desmontada e remontada
  // (ex: trocar para "Estoque" e voltar) antes do useEffect abaixo rodar.
  const [localCategories, setLocalCategories] = useState<any[]>(() => tenant?.categories || []);

  // Category modal
  const [catModal, setCatModal] = useState<{ open: boolean; editing: { id: string; name: string } | null }>({ open: false, editing: null });
  const [catName, setCatName] = useState("");
  const [catSaving, setCatSaving] = useState(false);

  // Delete confirm modals
  const [deleteProductConfirm, setDeleteProductConfirm] = useState<string | null>(null);
  const [deleteCategoryConfirm, setDeleteCategoryConfirm] = useState<{ id: string; name: string } | null>(null);

  // Product modal
  const [prodModal, setProdModal] = useState<{ open: boolean; categoryId: string | null }>({ open: false, categoryId: null });
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [inventoryCategories, setInventoryCategories] = useState<any[]>([]);
  const [productionRecipes, setProductionRecipes] = useState<any[]>([]);
  const [prodForm, setProdForm] = useState({
    name: "", description: "", price: "", imageUrl: "", inventoryItemId: "", recipeId: "",
    available: true, pdvOnly: false, kitchenPrint: false, autoDisableWhenOutOfStock: false,
    scheduleRuleEnabled: false,
    scheduleRuleType: "weekday" as "weekday" | "daterange" | "both",
    scheduleRuleWeekdays: [] as number[],
    scheduleRuleStartTime: "",
    scheduleRuleEndTime: "",
    scheduleRuleStartDate: "",
    scheduleRuleEndDate: "",
    variants: [] as { _key: string, name: string, price: string, description: string, inventoryItemId: string, imageUrl: string }[],
    extras: [] as { id: string, label: string, price: string }[],
    // Grupos de seleção embutidos — cada um deixa o cliente escolher N itens de uma
    // categoria/lista, sem alterar o preço fixo do produto. Uma marmita pode ter vários:
    // "Guarnição" (escolha 1), "Arroz" (escolha 1), "Feijão" (escolha 1) — cada grupo sua
    // própria categoria de opções.
    selectionGroups: [] as { _key: string, sourceType: "category" | "products", categoryId: string, productIds: string[], qty: string, label: string }[],
    // Fiscal NFC-e
    ncm: "", cfop: "5102", csosn: "400", unitCom: "UN", origem: 0, aliqIcms: 0,
  });
  const [extraInput, setExtraInput] = useState({ label: "", price: "" });
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredientDraft[]>([]);

  useEffect(() => {
    if (tenant) {
      setLocalCategories(tenant.categories || []);
      // Sem permissão de Estoque, o servidor responde 403 (não um array) — sem checar
      // res.ok isso virava `setInventoryItems({error: "..."})`, quebrando o .map() do
      // seletor "Vincular ao estoque" em silêncio: parecia que não existia nenhum
      // insumo, quando na verdade era a permissão que faltava (nunca avisava o dono).
      apiFetch(`/api/tenants/${tenant.slug}/inventory`)
        .then(res => res.ok ? res.json() : Promise.reject(res))
        .then(data => setInventoryItems(Array.isArray(data) ? data : []))
        .catch((err) => {
          setInventoryItems([]);
          if (err?.status === 403 && canManageInventory === false) {
            toast.error("Sem permissão de Estoque — peça ao proprietário para liberar em Equipe > permissões.");
          }
        });
      apiFetch(`/api/tenants/${tenant.slug}/inventory/categories`)
        .then(res => res.json())
        .then(data => setInventoryCategories(Array.isArray(data) ? data : []))
        .catch(() => {});
      apiFetch(`/api/tenants/${tenant.slug}/production/recipes`)
        .then(res => res.json())
        .then(data => setProductionRecipes(Array.isArray(data) ? data : []))
        .catch(() => {});
    }
  }, [tenant]);

  const openNewCategory = () => { setCatName(""); setCatModal({ open: true, editing: null }); };
  const openEditCategory = (cat: { id: string; name: string }) => { setCatName(cat.name); setCatModal({ open: true, editing: cat }); };
  const closeCatModal = () => setCatModal({ open: false, editing: null });

  const saveCategory = async () => {
    if (!catName.trim()) return;
    setCatSaving(true);
    try {
      if (catModal.editing) {
        await apiFetch(`/api/categories/${catModal.editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: catName.trim() })
        });
        setLocalCategories(cats => cats.map(c => c.id === catModal.editing!.id ? { ...c, name: catName.trim() } : c));
      } else {
        const res = await apiFetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: catName.trim(), tenantId: tenant?.id })
        });
        const newCat = await res.json();
        setLocalCategories(cats => [...cats, { ...newCat, products: [] }]);
      }
      closeCatModal();
    } finally {
      setCatSaving(false);
    }
  };

  const deleteCategory = async (id: string) => {
    await apiFetch(`/api/categories/${id}`, { method: 'DELETE' });
    if (selectedCat === id) setSelectedCat("all");
    setLocalCategories(cats => cats.filter(c => c.id !== id));
  };

  const openNewProduct = (categoryId: string) => {
    setEditingProduct(null);
    setProdForm({ name: "", description: "", price: "", imageUrl: "", inventoryItemId: "", recipeId: "", available: true, pdvOnly: false, kitchenPrint: false, autoDisableWhenOutOfStock: false, scheduleRuleEnabled: false, scheduleRuleType: "weekday", scheduleRuleWeekdays: [], scheduleRuleStartTime: "", scheduleRuleEndTime: "", scheduleRuleStartDate: "", scheduleRuleEndDate: "", variants: [], extras: [], selectionGroups: [], ncm: "", cfop: "5102", csosn: "400", unitCom: "UN", origem: 0, aliqIcms: 0 });
    setExtraInput({ label: "", price: "" });
    setRecipeIngredients([]);
    setProdModal({ open: true, categoryId });
  };

  const openEditProduct = (prod: any) => {
    setEditingProduct(prod);
    let parsedExtras: { id: string, label: string, price: string }[] = [];
    try {
      const raw = prod.extras ? JSON.parse(prod.extras) : [];
      parsedExtras = raw.map((e: any) => ({ id: e.id, label: e.label, price: String(e.price ?? 0) }));
    } catch {}
    let scheduleRuleEnabled = false;
    let scheduleRuleType: "weekday" | "daterange" | "both" = "weekday";
    let scheduleRuleWeekdays: number[] = [];
    let scheduleRuleStartTime = "";
    let scheduleRuleEndTime = "";
    let scheduleRuleStartDate = "";
    let scheduleRuleEndDate = "";
    try {
      if (prod.scheduleRule) {
        const rule = JSON.parse(prod.scheduleRule);
        scheduleRuleEnabled = true;
        scheduleRuleType = rule.type || "weekday";
        scheduleRuleWeekdays = rule.weekdays || [];
        scheduleRuleStartTime = rule.weekdayStartTime || "";
        scheduleRuleEndTime = rule.weekdayEndTime || "";
        scheduleRuleStartDate = rule.startDate || "";
        scheduleRuleEndDate = rule.endDate || "";
      }
    } catch {}
    let selectionGroups: { _key: string, sourceType: "category" | "products", categoryId: string, productIds: string[], qty: string, label: string }[] = [];
    try {
      if (prod.selectionGroup) {
        const parsed = JSON.parse(prod.selectionGroup);
        // Aceita tanto o formato antigo (um objeto só) quanto o novo (array de grupos).
        const list = Array.isArray(parsed) ? parsed : [parsed];
        selectionGroups = list.filter((sg: any) => sg && sg.qty).map((sg: any) => ({
          _key: crypto.randomUUID(),
          sourceType: sg.sourceType === "products" ? "products" : "category",
          categoryId: sg.categoryId || "",
          productIds: sg.productIds || [],
          qty: String(sg.qty ?? 1),
          label: sg.label || "",
        }));
      }
    } catch {}
    setProdForm({
      name: prod.name, description: prod.description || "", price: String(prod.price),
      imageUrl: prod.imageUrl || "", inventoryItemId: prod.inventoryItemId || "", recipeId: prod.recipeId || "",
      available: prod.available !== false,
      pdvOnly: prod.pdvOnly || false,
      kitchenPrint: prod.kitchenPrint === true,
      autoDisableWhenOutOfStock: prod.autoDisableWhenOutOfStock || false,
      scheduleRuleEnabled,
      scheduleRuleType,
      scheduleRuleWeekdays,
      scheduleRuleStartTime,
      scheduleRuleEndTime,
      scheduleRuleStartDate,
      scheduleRuleEndDate,
      variants: prod.variants?.map((v: any) => ({ _key: v.id || crypto.randomUUID(), name: v.name, price: String(v.price), description: v.description || "", inventoryItemId: v.inventoryItemId || "", imageUrl: v.imageUrl || "" })) || [],
      extras: parsedExtras,
      selectionGroups,
      ncm: prod.ncm || "", cfop: prod.cfop || "5102", csosn: prod.csosn || "400",
      unitCom: prod.unitCom || "UN", origem: prod.origem ?? 0, aliqIcms: prod.aliqIcms ?? 0,
    });
    setExtraInput({ label: "", price: "" });
    const linkedRecipe = prod.recipeId ? productionRecipes.find((r: any) => r.id === prod.recipeId) : null;
    setRecipeIngredients(
      linkedRecipe?.ingredients?.map((ing: any) => ({
        _key: crypto.randomUUID(),
        inventoryItemId: ing.inventoryItemId,
        quantity: String(ing.quantity ?? ""),
        unit: ing.unit || "un",
      })) || []
    );
    setProdModal({ open: true, categoryId: prod.categoryId });
  };



  const closeProdModal = () => { setProdModal({ open: false, categoryId: null }); setEditingProduct(null); };

  const saveProduct = async () => {
    if (!prodForm.name.trim()) {
      toast.error("Informe o nome do produto.");
      return;
    }
    if (!prodModal.categoryId) {
      toast.error("Selecione uma categoria.");
      return;
    }
    const hasVariants = prodForm.variants.length > 0;
    if (!hasVariants && (!prodForm.price || isNaN(parseFloat(prodForm.price)))) {
      toast.error("Informe o preço do produto.");
      return;
    }
    if (hasVariants) {
      const invalidVariant = prodForm.variants.find(v => !v.name.trim() || !v.price || isNaN(parseFloat(v.price)));
      if (invalidVariant) {
        toast.error("Preencha nome e preço de todas as variações.");
        return;
      }
    }
    const validIngredients = recipeIngredients.filter(ing => ing.inventoryItemId && ing.quantity && !isNaN(parseFloat(ing.quantity)));
    const incompleteIngredient = recipeIngredients.find(ing => !ing.inventoryItemId || !ing.quantity || isNaN(parseFloat(ing.quantity)));
    if (incompleteIngredient) {
      toast.error("Preencha o item e a quantidade de todos os insumos, ou remova a linha vazia.");
      return;
    }
    const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products';
    let scheduleRule: string | null = null;
    if (prodForm.scheduleRuleEnabled) {
      const rule: any = { type: prodForm.scheduleRuleType };
      if (prodForm.scheduleRuleType === "weekday" || prodForm.scheduleRuleType === "both") {
        rule.weekdays = prodForm.scheduleRuleWeekdays;
        if (prodForm.scheduleRuleStartTime) rule.weekdayStartTime = prodForm.scheduleRuleStartTime;
        if (prodForm.scheduleRuleEndTime) rule.weekdayEndTime = prodForm.scheduleRuleEndTime;
      }
      if (prodForm.scheduleRuleType === "daterange" || prodForm.scheduleRuleType === "both") {
        rule.startDate = prodForm.scheduleRuleStartDate;
        rule.endDate = prodForm.scheduleRuleEndDate;
      }
      scheduleRule = JSON.stringify(rule);
    }
    let selectionGroup: string | null = null;
    if (prodForm.selectionGroups.length > 0) {
      // Os dois mecanismos resolvem "escolher o sabor" de formas diferentes — variação
      // já cria um preço por opção, grupo de seleção mantém preço fixo do produto e
      // reaproveita outra categoria. Juntos, o cliente escolhe a mesma coisa duas vezes
      // (foi exatamente o bug visto em produção no "1 espeto tradicional").
      if (hasVariants) {
        toast.error("Este produto já tem variações — remova-as antes de ativar \"Cliente escolhe itens\", ou remova os grupos de seleção. Os dois juntos fazem o cliente escolher o sabor duas vezes.");
        return;
      }
      const builtGroups: { sourceType: "category" | "products"; categoryId?: string; productIds?: string[]; qty: number; label?: string }[] = [];
      for (const g of prodForm.selectionGroups) {
        const qty = parseInt(g.qty, 10);
        if (!qty || qty < 1) {
          toast.error(`"${g.label || "Grupo de seleção"}": informe quantos itens o cliente deve escolher.`);
          return;
        }
        if (g.sourceType === "category" && !g.categoryId) {
          toast.error(`"${g.label || "Grupo de seleção"}": selecione a categoria de onde vêm as opções.`);
          return;
        }
        if (g.sourceType === "products" && g.productIds.length === 0) {
          toast.error(`"${g.label || "Grupo de seleção"}": selecione ao menos um item para a seleção.`);
          return;
        }
        builtGroups.push({
          sourceType: g.sourceType,
          categoryId: g.sourceType === "category" ? g.categoryId : undefined,
          productIds: g.sourceType === "products" ? g.productIds : undefined,
          qty,
          label: g.label || undefined,
        });
      }
      selectionGroup = JSON.stringify(builtGroups);
    }
    const res = await apiFetch(url, {
      method: editingProduct ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...prodForm,
        extras: JSON.stringify(prodForm.extras.map(e => ({ id: e.id, label: e.label, price: parseFloat(e.price) || 0 }))),
        selectionGroup,
        scheduleRule,
        categoryId: prodModal.categoryId,
        tenantId: tenant?.id
      })
    });
    let saved = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(saved?.error || "Falha ao salvar produto.");
      return;
    }

    const recipeSyncResult = await syncProductRecipe(
      { ...saved, recipeId: editingProduct?.recipeId || null },
      validIngredients
    );
    if (recipeSyncResult !== null) saved = { ...saved, recipeId: recipeSyncResult || null };

    if (editingProduct) {
      setLocalCategories(cats => cats.map(cat => ({
        ...cat,
        products: cat.products?.map((p: any) => p.id === saved.id ? { ...p, ...saved } : p)
      })));
    } else {
      setLocalCategories(cats => cats.map(cat =>
        cat.id === prodModal.categoryId
          ? { ...cat, products: [...(cat.products || []), saved] }
          : cat
      ));
    }
    apiFetch(`/api/tenants/${tenant?.slug}/production/recipes`)
      .then(r => r.json())
      .then(data => setProductionRecipes(Array.isArray(data) ? data : []))
      .catch(() => {});
    closeProdModal();
  };

  // Sincroniza a lista simples de "insumos usados" com uma ProductionRecipe por trás —
  // o usuário só vê "insumo + quantidade + unidade", nunca "receita"/"rendimento".
  const syncProductRecipe = async (product: any, ingredients: typeof recipeIngredients): Promise<string | null> => {
    if (!tenant) return null;
    const existingRecipeId: string | null = product.recipeId || null;

    if (ingredients.length === 0) {
      if (existingRecipeId) {
        await apiFetch(`/api/products/${product.id}/recipe`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipeId: null }),
        }).catch(() => {});
        await apiFetch(`/api/tenants/${tenant.slug}/production/recipes/${existingRecipeId}`, { method: 'DELETE' }).catch(() => {});
        return "";
      }
      return null;
    }

    const payload = {
      name: `Insumos — ${product.name}`,
      outputQuantity: 1,
      outputUnit: "un",
      productId: product.id,
      ingredients: ingredients.map(ing => ({ inventoryItemId: ing.inventoryItemId, quantity: parseFloat(ing.quantity), unit: ing.unit })),
      active: true,
    };

    const url = existingRecipeId
      ? `/api/tenants/${tenant.slug}/production/recipes/${existingRecipeId}`
      : `/api/tenants/${tenant.slug}/production/recipes`;
    const res = await apiFetch(url, {
      method: existingRecipeId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const recipe = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(recipe?.error || "Falha ao salvar os insumos do produto.");
      return null;
    }
    if (!existingRecipeId) {
      await apiFetch(`/api/products/${product.id}/recipe`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipeId: recipe.id }),
      }).catch(() => {});
    }
    return recipe.id;
  };

  const deleteProduct = async (id: string) => {
    const res = await apiFetch(`/api/products/${id}`, { method: 'DELETE' });
    if (res.status === 409) {
      const data = await res.json().catch(() => ({}));
      if (data?.deactivated) {
        toast.error(data.error || "Produto já usado em pedidos — foi desativado em vez de excluído.");
        setLocalCategories(cats => cats.map(cat => ({
          ...cat,
          products: cat.products?.map((p: any) => p.id === id ? { ...p, available: false } : p)
        })));
        return;
      }
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data?.error || "Falha ao excluir produto.");
      return;
    }
    setLocalCategories(cats => cats.map(cat => ({
      ...cat,
      products: cat.products?.filter((p: any) => p.id !== id)
    })));
  };

  // ── Drag-and-drop: categorias e produtos (@dnd-kit) ────────────────────────
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );
  const [activeDragCategory, setActiveDragCategory] = useState<any | null>(null);
  const [activeDragProduct, setActiveDragProduct] = useState<any | null>(null);

  const reorderCategories = async (draggedId: string, targetId: string) => {
    if (draggedId === targetId || !tenant) return;
    const current = [...localCategories];
    const fromIdx = current.findIndex(c => c.id === draggedId);
    const toIdx = current.findIndex(c => c.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const reordered = [...current];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setLocalCategories(reordered);
    try {
      await apiFetch('/api/categories/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: tenant.id, orderedIds: reordered.map(c => c.id) }),
      });
    } catch {
      setLocalCategories(current); // reverte em caso de falha
    }
  };

  const reorderOrMoveProduct = async (
    draggedProductId: string,
    fromCategoryId: string,
    targetProductId: string | null,
    toCategoryId: string
  ) => {
    if (!tenant) return;
    const previous = localCategories.map(c => ({ ...c, products: [...(c.products || [])] }));

    let next = localCategories.map(c => ({ ...c, products: [...(c.products || [])] }));
    const fromCat = next.find(c => c.id === fromCategoryId);
    const draggedProd = fromCat?.products.find((p: any) => p.id === draggedProductId);
    if (!fromCat || !draggedProd) return;

    // Remove da categoria de origem
    fromCat.products = fromCat.products.filter((p: any) => p.id !== draggedProductId);

    const toCat = next.find(c => c.id === toCategoryId);
    if (!toCat) return;
    const targetIdx = targetProductId ? toCat.products.findIndex((p: any) => p.id === targetProductId) : -1;
    const insertAt = targetIdx === -1 ? toCat.products.length : targetIdx;
    toCat.products.splice(insertAt, 0, { ...draggedProd, categoryId: toCategoryId });

    setLocalCategories(next);
    try {
      await apiFetch('/api/products/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: tenant.id,
          categoryId: toCategoryId,
          orderedIds: toCat.products.map((p: any) => p.id),
          movedProductId: fromCategoryId !== toCategoryId ? draggedProductId : undefined,
          targetCategoryId: fromCategoryId !== toCategoryId ? toCategoryId : undefined,
        }),
      });
    } catch {
      setLocalCategories(previous); // reverte em caso de falha
    }
  };

  const duplicateProductToCatalog = async () => {
    if (!editingProduct || !prodModal.categoryId) return;
    const res = await apiFetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${prodForm.name} (cópia)`,
        description: prodForm.description,
        price: prodForm.price,
        imageUrl: prodForm.imageUrl,
        available: prodForm.available,
        categoryId: prodModal.categoryId,
        tenantId: tenant?.id,
      })
    });
    const saved = await res.json();
    setLocalCategories(cats => cats.map(cat =>
      cat.id === prodModal.categoryId
        ? { ...cat, products: [...(cat.products || []), saved] }
        : cat
    ));
    toast.success(`"${saved.name}" duplicado no catálogo com sucesso!`);
  };

  const duplicateProductToInventory = async () => {
    if (!editingProduct || !tenant) return;
    const res = await apiFetch('/api/inventory/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: prodForm.name,
        tenantId: tenant.id,
        quantity: 0,
        unit: 'un',
        usage: 'SALE',
        purchasePrice: parseFloat(prodForm.price) || 0,
        sellingPrice: parseFloat(prodForm.price) || 0,
      })
    });
    const saved = await res.json();
    toast.success(`"${saved.name}" criado no Estoque! Vá em Estoque para configurar quantidade e unidades.`);
  };

  const toggleProductAvailability = async (prod: any) => {
    const newAvailable = !prod.available;
    setLocalCategories(cats => cats.map(cat => ({
      ...cat,
      products: cat.products?.map((p: any) => p.id === prod.id ? { ...p, available: newAvailable } : p)
    })));
    await apiFetch(`/api/products/${prod.id}/availability`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ available: newAvailable })
    });
  };

  const addVariantField = () => setProdForm(prev => ({ ...prev, variants: [...prev.variants, { _key: crypto.randomUUID(), name: "", price: "", description: "", inventoryItemId: "", imageUrl: "" }] }));
  const removeVariantField = (i: number) => setProdForm(prev => ({ ...prev, variants: prev.variants.filter((_, idx) => idx !== i) }));
  const updateVariantField = (i: number, field: string, value: string) => setProdForm(prev => ({ ...prev, variants: prev.variants.map((v, idx) => idx === i ? { ...v, [field]: value } : v) }));

  const addSelectionGroupField = () => setProdForm(prev => ({ ...prev, selectionGroups: [...prev.selectionGroups, { _key: crypto.randomUUID(), sourceType: "category" as const, categoryId: "", productIds: [] as string[], qty: "1", label: "" }] }));
  const removeSelectionGroupField = (i: number) => setProdForm(prev => ({ ...prev, selectionGroups: prev.selectionGroups.filter((_, idx) => idx !== i) }));
  const updateSelectionGroupField = (i: number, field: string, value: any) => setProdForm(prev => ({ ...prev, selectionGroups: prev.selectionGroups.map((g, idx) => idx === i ? { ...g, [field]: value } : g) }));

  const categories = localCategories;
  const visibleCategories = categories
    .filter(cat => selectedCat === "all" || cat.id === selectedCat)
    .map(cat => ({
      ...cat,
      products: (cat.products || []).filter(p =>
        !search || p.name.toLowerCase().includes(search.toLowerCase())
      )
    }))
    .filter(cat => !search || cat.products.length > 0);

  // Arrastar só faz sentido quando a ordem exibida é a ordem real (sem filtro de busca/categoria)
  const dragEnabled = !search && selectedCat === "all";

  const fmt = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

  return (
    <div className="min-w-0 space-y-4">

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Category filter dropdown */}
        <div className="relative flex-1">
          <select
            value={selectedCat}
            onChange={e => setSelectedCat(e.target.value)}
            className="w-full appearance-none bg-white border border-zinc-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400 pr-8"
          >
            <option value="all">Todas as categorias ({categories.length})</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name} ({cat.products?.length || 0})</option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </span>
        </div>

        {/* Search */}
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.6"/><path d="M10 10L12.5 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
          </span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar produto..."
            className="w-full bg-white border border-zinc-200 rounded-xl pl-9 pr-4 py-2.5 text-sm font-bold text-slate-700 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>

        <Button onClick={openNewCategory} iconLeft={<Plus className="w-4 h-4" />} className="shrink-0 w-full sm:w-auto">
          Nova Categoria
        </Button>
      </div>

      {/* Empty state */}
      {categories.length === 0 && (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center flex flex-col items-center gap-4">
          <Utensils className="w-12 h-12 text-slate-300" />
          <div>
            <p className="text-slate-700 font-black text-base">Comece criando uma categoria</p>
            <p className="text-slate-400 text-sm mt-1 max-w-xs mx-auto">
              Categorias organizam seu cardápio — ex: <span className="font-bold">Pastéis</span>, <span className="font-bold">Bebidas</span>, <span className="font-bold">Sobremesas</span>. Depois disso você adiciona os produtos dentro de cada uma.
            </p>
          </div>
          <Button onClick={openNewCategory} iconLeft={<Plus className="w-4 h-4" />}>
            Adicionar primeira categoria
          </Button>
        </div>
      )}

      {/* Category + product list — um único DndContext cobre categorias e produtos,
          permitindo arrastar um produto de uma categoria para outra. */}
      <DndContext
        sensors={dndSensors}
        collisionDetection={closestCenter}
        onDragStart={(e: DragStartEvent) => {
          if (!dragEnabled) return;
          const kind = (e.active.data.current as any)?.type;
          if (kind === "category") {
            setActiveDragCategory(categories.find(c => c.id === e.active.id) || null);
          } else if (kind === "product") {
            const cat = categories.find(c => c.id === (e.active.data.current as any).categoryId);
            setActiveDragProduct(cat?.products?.find((p: any) => p.id === e.active.id) || null);
          }
        }}
        onDragEnd={(e: DragEndEvent) => {
          const { active, over } = e;
          setActiveDragCategory(null);
          setActiveDragProduct(null);
          if (!dragEnabled || !over || active.id === over.id) return;

          const activeType = (active.data.current as any)?.type;
          const overType = (over.data.current as any)?.type;

          if (activeType === "category" && overType === "category") {
            void reorderCategories(String(active.id), String(over.id));
            return;
          }

          if (activeType === "product") {
            const fromCategoryId = (active.data.current as any).categoryId;
            if (overType === "product") {
              const toCategoryId = (over.data.current as any).categoryId;
              void reorderOrMoveProduct(String(active.id), fromCategoryId, String(over.id), toCategoryId);
            } else if (overType === "category-drop") {
              // Soltou sobre o corpo de uma categoria vazia
              void reorderOrMoveProduct(String(active.id), fromCategoryId, null, String(over.id));
            }
          }
        }}
        onDragCancel={() => { setActiveDragCategory(null); setActiveDragProduct(null); }}
      >
        <SortableContext items={visibleCategories.map(c => c.id)} strategy={verticalListSortingStrategy}>
          {visibleCategories.map(cat => (
            <SortableCategoryCard
              key={cat.id}
              cat={cat}
              dragEnabled={dragEnabled}
              openNewProduct={openNewProduct}
              openEditCategory={openEditCategory}
              openEditProduct={openEditProduct}
              toggleProductAvailability={toggleProductAvailability}
              setDeleteProductConfirm={setDeleteProductConfirm}
              fmt={fmt}
            />
          ))}
        </SortableContext>
        <DragOverlay>
          {activeDragCategory && (
            <div className="bg-white rounded-2xl border-2 border-[#C9A227] shadow-2xl px-4 py-3 opacity-95 rotate-1">
              <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs">{activeDragCategory.name}</h3>
            </div>
          )}
          {activeDragProduct && <ProductRowGhost prod={activeDragProduct} fmt={fmt} />}
        </DragOverlay>
      </DndContext>

      {/* Search no result */}
      {search && visibleCategories.length === 0 && categories.length > 0 && (
        <div className="text-center py-10 text-slate-400 text-sm font-medium">
          Nenhum produto encontrado para "<span className="font-bold">{search}</span>"
        </div>
      )}

      {/* Modal: categoria */}
      <Modal
        isOpen={catModal.open}
        onClose={closeCatModal}
        title={catModal.editing ? "Editar categoria" : "Nova categoria"}
        size="sm"
        mobileStyle="bottom-sheet"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {catModal.editing && (
              <Button variant="ghost" className="text-red-500 hover:bg-red-50 sm:mr-auto" onClick={() => { closeCatModal(); setDeleteCategoryConfirm({ id: catModal.editing!.id, name: catName }); }}>
                Excluir categoria
              </Button>
            )}
            <Button variant="outline" onClick={closeCatModal}>Cancelar</Button>
            <Button onClick={saveCategory} loading={catSaving}>{catModal.editing ? "Salvar" : "Criar categoria"}</Button>
          </div>
        }
      >
        <div className="p-4 sm:p-5">
          <Input
            label="Nome da categoria"
            placeholder="Ex: Pastéis, Bebidas, Sobremesas..."
            value={catName}
            onChange={e => setCatName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && saveCategory()}
            autoFocus
          />
          <p className="text-xs text-slate-400 mt-2">Categorias agrupam os produtos no cardápio do cliente.</p>
        </div>
      </Modal>

      {/* Modal: produto */}
      <Modal
        isOpen={prodModal.open}
        onClose={closeProdModal}
        title={editingProduct ? "Editar produto" : "Novo produto"}
        size="lg"
        mobileStyle="fullscreen"
        footer={
          <div className="flex flex-col gap-2">
            {editingProduct && (
              <div className="flex gap-2 flex-wrap pb-1 border-b border-slate-100">
                <button
                  type="button"
                  onClick={duplicateProductToCatalog}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors border border-blue-100"
                >
                  <span>📋</span> Duplicar no Catálogo
                </button>
                {canManageInventory && (
                  <button
                    type="button"
                    onClick={duplicateProductToInventory}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors border border-amber-100"
                  >
                    <span>📦</span> Criar no Estoque
                  </button>
                )}
              </div>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={closeProdModal}>Cancelar</Button>
              <Button onClick={saveProduct}>{editingProduct ? "Salvar alterações" : "Adicionar produto"}</Button>
            </div>
          </div>
        }
      >
        <div className="p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Nome do produto" placeholder="Ex: Pastel de carne" value={prodForm.name} onChange={e => setProdForm({ ...prodForm, name: e.target.value })} />
            <CurrencyInput label="Preço base (R$)" value={prodForm.price} onChange={v => setProdForm({ ...prodForm, price: v })} />
          </div>
          <Input label="Descrição (opcional)" placeholder="Ingredientes, detalhes..." value={prodForm.description} onChange={e => setProdForm({ ...prodForm, description: e.target.value })} />

          <ImageUploader label="Foto do produto" value={prodForm.imageUrl} onChange={val => setProdForm({ ...prodForm, imageUrl: val })} description="Fotos de alta qualidade convertem mais vendas." />

          {/* Vínculo de estoque */}
          <InventoryLinkField
            inventoryItems={inventoryItems}
            inventoryCategories={inventoryCategories}
            value={prodForm.inventoryItemId}
            onChange={val => setProdForm({ ...prodForm, inventoryItemId: val })}
            autoDisable={prodForm.autoDisableWhenOutOfStock}
            onAutoDisableChange={val => setProdForm({ ...prodForm, autoDisableWhenOutOfStock: val })}
            allCategories={localCategories}
            editingProductId={editingProduct?.id}
          />

          {/* Vínculo de receita de produção */}
          <RecipeIngredientsField
            inventoryItems={inventoryItems}
            inventoryCategories={inventoryCategories}
            value={recipeIngredients}
            onChange={setRecipeIngredients}
          />

          <div className="flex items-center justify-between py-1 border-t border-slate-100">
            <div>
              <p className="text-sm font-bold text-slate-700">Produto ativo no cardápio</p>
              <p className="text-xs text-slate-400">Clientes conseguem ver e pedir este produto</p>
            </div>
            <button
              type="button"
              onClick={() => setProdForm(f => ({ ...f, available: !f.available }))}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${prodForm.available ? 'bg-green-500' : 'bg-slate-200'}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition duration-200 ${prodForm.available ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between py-1 border-t border-slate-100">
            <div>
              <p className="text-sm font-bold text-slate-700">Exclusivo PDV</p>
              <p className="text-xs text-slate-400">Visível apenas no PDV, não aparece no cardápio online</p>
            </div>
            <button
              type="button"
              onClick={() => setProdForm(f => ({ ...f, pdvOnly: !f.pdvOnly }))}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${prodForm.pdvOnly ? 'bg-blue-500' : 'bg-slate-200'}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition duration-200 ${prodForm.pdvOnly ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between py-1 border-t border-slate-100">
            <div>
              <p className="text-sm font-bold text-slate-700">Vai para a cozinha</p>
              <p className="text-xs text-slate-400">Ative para itens que precisam de preparo — bebidas/embalagens ficam desativadas por padrão</p>
            </div>
            <button
              type="button"
              onClick={() => setProdForm(f => ({ ...f, kitchenPrint: !f.kitchenPrint }))}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${prodForm.kitchenPrint === true ? 'bg-orange-500' : 'bg-slate-200'}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition duration-200 ${prodForm.kitchenPrint === true ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          {/* Disponibilidade Automática */}
          <div className="border-t border-zinc-100 pt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-bold text-slate-700">Disponibilidade Automática</p>
                <p className="text-xs text-slate-400">Produto aparece/some do cardápio online automaticamente</p>
              </div>
              <button
                type="button"
                onClick={() => setProdForm(f => ({ ...f, scheduleRuleEnabled: !f.scheduleRuleEnabled }))}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${prodForm.scheduleRuleEnabled ? 'bg-amber-500' : 'bg-slate-200'}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition duration-200 ${prodForm.scheduleRuleEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            {prodForm.scheduleRuleEnabled && (
              <div className="space-y-3 bg-amber-50 border border-amber-200 rounded-2xl p-3">
                {/* Tipo de regra */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-800 mb-2">Tipo de regra</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { value: "weekday",   label: "Dia da semana" },
                      { value: "daterange", label: "Período (datas)" },
                      { value: "both",      label: "Os dois" },
                    ] as const).map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setProdForm(f => ({ ...f, scheduleRuleType: opt.value }))}
                        className={`text-[10px] font-black py-1.5 px-2 rounded-lg border-2 transition-all ${prodForm.scheduleRuleType === opt.value ? "border-amber-400 bg-white text-amber-700" : "border-amber-200 text-slate-500 hover:border-amber-300"}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dias da semana */}
                {(prodForm.scheduleRuleType === "weekday" || prodForm.scheduleRuleType === "both") && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-800 mb-2">Dias ativos</p>
                    <div className="flex flex-wrap gap-1.5">
                      {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((label, idx) => {
                        const active = prodForm.scheduleRuleWeekdays.includes(idx);
                        return (
                          <button
                            key={label}
                            type="button"
                            onClick={() => setProdForm(f => ({
                              ...f,
                              scheduleRuleWeekdays: active
                                ? f.scheduleRuleWeekdays.filter(d => d !== idx)
                                : [...f.scheduleRuleWeekdays, idx]
                            }))}
                            className={`w-10 h-8 text-xs font-black rounded-lg border-2 transition-all ${active ? "border-amber-400 bg-amber-400 text-white" : "border-amber-200 bg-white text-slate-500 hover:border-amber-300"}`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Horário nos dias ativos */}
                {(prodForm.scheduleRuleType === "weekday" || prodForm.scheduleRuleType === "both") && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-800 mb-2">Horário (opcional)</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold block mb-1">Aparece às</label>
                        <input
                          type="time"
                          value={prodForm.scheduleRuleStartTime}
                          onChange={e => setProdForm(f => ({ ...f, scheduleRuleStartTime: e.target.value }))}
                          className="w-full bg-white border border-amber-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold block mb-1">Some às</label>
                        <input
                          type="time"
                          value={prodForm.scheduleRuleEndTime}
                          onChange={e => setProdForm(f => ({ ...f, scheduleRuleEndTime: e.target.value }))}
                          className="w-full bg-white border border-amber-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 italic mt-1.5">Deixe em branco para ficar visível o dia todo (00:00–23:59).</p>
                  </div>
                )}

                {/* Período de datas */}
                {(prodForm.scheduleRuleType === "daterange" || prodForm.scheduleRuleType === "both") && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-800 mb-2">Período de visibilidade</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold block mb-1">Data início</label>
                        <input
                          type="date"
                          value={prodForm.scheduleRuleStartDate}
                          onChange={e => setProdForm(f => ({ ...f, scheduleRuleStartDate: e.target.value }))}
                          className="w-full bg-white border border-amber-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold block mb-1">Data fim</label>
                        <input
                          type="date"
                          value={prodForm.scheduleRuleEndDate}
                          onChange={e => setProdForm(f => ({ ...f, scheduleRuleEndDate: e.target.value }))}
                          className="w-full bg-white border border-amber-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Adicionais / Extras */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Adicionais / Observações</span>
            </div>
            <p className="text-xs text-slate-400 mb-3">Ex: Gelo, Limão, Sem Cebola, Molho extra. O cliente seleciona antes de adicionar ao carrinho.</p>
            <div className="flex gap-2 mb-3">
              <input
                placeholder="Nome (ex: Gelo)"
                value={extraInput.label}
                onChange={e => setExtraInput(prev => ({ ...prev, label: e.target.value }))}
                onKeyDown={e => {
                  if (e.key === 'Enter' && extraInput.label.trim()) {
                    e.preventDefault();
                    setProdForm(prev => ({ ...prev, extras: [...prev.extras, { id: crypto.randomUUID(), label: extraInput.label.trim(), price: extraInput.price }] }));
                    setExtraInput({ label: "", price: "" });
                  }
                }}
                className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-400 min-w-0"
              />
              <input
                placeholder="R$ (0 = grátis)"
                value={extraInput.price}
                onChange={e => setExtraInput(prev => ({ ...prev, price: e.target.value }))}
                className="w-28 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button
                onClick={() => {
                  if (!extraInput.label.trim()) return;
                  setProdForm(prev => ({ ...prev, extras: [...prev.extras, { id: crypto.randomUUID(), label: extraInput.label.trim(), price: extraInput.price }] }));
                  setExtraInput({ label: "", price: "" });
                }}
                className="px-3 py-2 bg-amber-500 text-white rounded-xl text-sm font-black hover:bg-amber-600"
              >+</button>
            </div>
            {prodForm.extras.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {prodForm.extras.map((ex) => (
                  <span key={ex.id} className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold px-3 py-1.5 rounded-full">
                    {ex.label}{parseFloat(ex.price) > 0 ? ` +R$${parseFloat(ex.price).toFixed(2)}` : ' (grátis)'}
                    <button onClick={() => setProdForm(prev => ({ ...prev, extras: prev.extras.filter(e => e.id !== ex.id) }))} className="hover:text-red-500 ml-0.5">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Grupos de seleção embutidos — cada um deixa o cliente escolher N itens de uma
              categoria/lista, sem mudar o preço fixo do produto (ex: numa marmita, um grupo
              "Guarnição" escolhe 1, outro "Arroz" escolhe 1, outro "Feijão" escolhe 1 — cada
              um sua própria categoria de opções cadastrada). Incompatível com variações — as
              duas coisas resolvem "escolher o sabor"; juntas, o cliente escolhe a mesma coisa
              duas vezes (bug visto em produção no "1 espeto tradicional", cadastrado com
              variações E grupo ao mesmo tempo). */}
          <div>
            {prodForm.variants.length > 0 && prodForm.selectionGroups.length > 0 && (
              <p className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
                Este produto já tem variações — remova-as ou remova os grupos de seleção abaixo. Os dois juntos fazem o cliente escolher o sabor duas vezes.
              </p>
            )}
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Cliente escolhe itens (preço fixo)</span>
              <button
                type="button"
                disabled={prodForm.variants.length > 0}
                onClick={addSelectionGroupField}
                className={`text-xs font-black hover:underline ${prodForm.variants.length > 0 ? "text-slate-300 cursor-not-allowed" : "text-[#C9A227]"}`}
              >+ Adicionar grupo</button>
            </div>
            <p className="text-xs text-slate-400 mb-3">Ex: numa marmita, um grupo "Guarnição" (escolhe 1), outro "Arroz" (escolhe 1) — cada grupo puxa de uma categoria já cadastrada, sem alterar o preço do produto.</p>

            {prodForm.selectionGroups.length > 0 && (
              <div className="space-y-3">
                {prodForm.selectionGroups.map((g, idx) => (
                  <div key={g._key} className="p-4 bg-amber-50/50 rounded-2xl border border-amber-100 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        placeholder={`Rótulo do grupo ${idx + 1} (ex: Guarnição)`}
                        value={g.label}
                        onChange={e => updateSelectionGroupField(idx, "label", e.target.value)}
                        className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:border-[#C9A227] outline-none bg-white"
                      />
                      <button type="button" onClick={() => removeSelectionGroupField(idx)} className="p-2 text-slate-300 hover:text-red-500 shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => updateSelectionGroupField(idx, "sourceType", "category")}
                        className={`flex-1 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-colors ${g.sourceType === "category" ? "bg-[#0D1B3E] text-white" : "bg-white border border-slate-200 text-slate-500"}`}
                      >Categoria inteira</button>
                      <button
                        type="button"
                        onClick={() => updateSelectionGroupField(idx, "sourceType", "products")}
                        className={`flex-1 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-colors ${g.sourceType === "products" ? "bg-[#0D1B3E] text-white" : "bg-white border border-slate-200 text-slate-500"}`}
                      >Itens específicos</button>
                    </div>

                    {g.sourceType === "category" ? (
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Categoria de onde vêm as opções</label>
                        <select
                          value={g.categoryId}
                          onChange={e => updateSelectionGroupField(idx, "categoryId", e.target.value)}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:border-[#C9A227] outline-none bg-white"
                        >
                          <option value="">Selecione...</option>
                          {localCategories.filter(c => c.id !== prodModal.categoryId).map(c => (
                            <option key={c.id} value={c.id}>{c.name} ({c.products?.length || 0} itens)</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Selecione os itens que entram como opção</label>
                        <div className="max-h-48 overflow-y-auto space-y-1 bg-white rounded-xl border border-slate-200 p-2">
                          {localCategories.flatMap(c => c.products || []).map((p: any) => {
                            const checked = g.productIds.includes(p.id);
                            return (
                              <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => updateSelectionGroupField(idx, "productIds", checked
                                    ? g.productIds.filter(id => id !== p.id)
                                    : [...g.productIds, p.id])}
                                  className="w-3.5 h-3.5 rounded accent-amber-500"
                                />
                                <span className="text-xs font-bold text-slate-700">{p.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Quantos itens o cliente escolhe neste grupo</label>
                      <input
                        type="number"
                        min={1}
                        value={g.qty}
                        onChange={e => updateSelectionGroupField(idx, "qty", e.target.value.replace(/\D/g, ""))}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:border-[#C9A227] outline-none bg-white"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dados Fiscais NFC-e */}
          <details className="group">
            <summary className="flex items-center gap-2 cursor-pointer select-none text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors list-none">
              <FileText className="w-3.5 h-3.5" />
              Dados Fiscais (NFC-e)
            </summary>
            <div className="mt-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
              <p className="text-[10px] text-slate-400 font-medium">Preencha apenas se o módulo fiscal (NFC-e) estiver ativo nas configurações da loja.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">NCM</label>
                  <input type="text" maxLength={10} value={prodForm.ncm}
                    onChange={e => setProdForm(f => ({ ...f, ncm: e.target.value.replace(/\D/g, "") }))}
                    placeholder="00000000"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:border-[#C9A227] outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">CFOP</label>
                  <select value={prodForm.cfop} onChange={e => setProdForm(f => ({ ...f, cfop: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:border-[#C9A227] outline-none bg-white"
                  >
                    <option value="5102">5102 — Venda mercadoria adquirida</option>
                    <option value="5405">5405 — Venda c/ ST</option>
                    <option value="5101">5101 — Venda de produção própria</option>
                    <option value="5933">5933 — Simples Nacional — serviço</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">CSOSN</label>
                  <select value={prodForm.csosn} onChange={e => setProdForm(f => ({ ...f, csosn: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:border-[#C9A227] outline-none bg-white"
                  >
                    <option value="400">400 — Isento ICMS (Simples)</option>
                    <option value="102">102 — Tributada sem permissão crédito</option>
                    <option value="103">103 — Isento faixa receita bruta</option>
                    <option value="500">500 — ICMS cobrado por ST</option>
                    <option value="900">900 — Outros</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Unidade</label>
                  <select value={prodForm.unitCom} onChange={e => setProdForm(f => ({ ...f, unitCom: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:border-[#C9A227] outline-none bg-white"
                  >
                    {["UN","KG","G","L","ML","CX","PC","PT","PAR","DZ"].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Origem</label>
                  <select value={prodForm.origem} onChange={e => setProdForm(f => ({ ...f, origem: Number(e.target.value) }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:border-[#C9A227] outline-none bg-white"
                  >
                    <option value={0}>0 — Nacional</option>
                    <option value={1}>1 — Estrangeira (importação direta)</option>
                    <option value={2}>2 — Estrangeira (mercado interno)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Alíq. ICMS %</label>
                  <input type="number" min={0} max={100} step={0.01} value={prodForm.aliqIcms}
                    onChange={e => setProdForm(f => ({ ...f, aliqIcms: parseFloat(e.target.value) || 0 }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:border-[#C9A227] outline-none bg-white"
                  />
                </div>
              </div>
            </div>
          </details>

          {/* Variantes — desabilitado quando o grupo de seleção está ativo (os dois juntos
              fazem o cliente escolher o sabor duas vezes, ver nota acima). */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Tamanhos / Variantes</span>
              {prodForm.selectionGroups.length > 0 ? (
                <span className="text-[10px] font-bold text-slate-400">Remova os grupos de seleção para usar variações</span>
              ) : (
                <button onClick={addVariantField} className="text-xs font-black text-[#C9A227] hover:underline">+ Adicionar</button>
              )}
            </div>
            <div className="space-y-3">
              {prodForm.variants.map((v, idx) => (
                <div key={v._key} className="flex gap-2 items-start bg-zinc-50/60 border border-zinc-100 rounded-xl p-2">
                  <VariantImageUploader
                    value={v.imageUrl}
                    onChange={(val) => updateVariantField(idx, 'imageUrl', val)}
                  />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex gap-2 items-center">
                      <input placeholder="Nome (ex: 500ml)" value={v.name} onChange={e => updateVariantField(idx, 'name', e.target.value)}
                        className="flex-1 bg-white border border-zinc-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-400 min-w-0" />
                      <input placeholder="R$" value={v.price} onChange={e => updateVariantField(idx, 'price', e.target.value)}
                        className="w-20 bg-white border border-zinc-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-400" />
                      <button onClick={() => removeVariantField(idx)} className="p-2 text-slate-300 hover:text-red-500 shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <select
                      value={v.inventoryItemId}
                      onChange={e => updateVariantField(idx, 'inventoryItemId', e.target.value)}
                      className="w-full bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      <option value="">Sem vínculo de estoque (opcional)</option>
                      {inventoryItems.filter((item: any) => item.usage !== 'INTERNAL').map((item: any) => (
                        <option key={item.id} value={item.id}>
                          {item.name} — {item.quantity <= 0 ? "Esgotado" : `${item.quantity} ${item.unit || 'un'}`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal: confirmar exclusão de produto */}
      <ConfirmModal
        isOpen={!!deleteProductConfirm}
        onClose={() => setDeleteProductConfirm(null)}
        onConfirm={() => { deleteProduct(deleteProductConfirm!); setDeleteProductConfirm(null); }}
        title="Excluir produto"
        message="Tem certeza que deseja excluir este produto? Essa ação não pode ser desfeita."
        confirmLabel="Excluir"
        variant="danger"
      />

      {/* Modal: confirmar exclusão de categoria */}
      <ConfirmModal
        isOpen={!!deleteCategoryConfirm}
        onClose={() => setDeleteCategoryConfirm(null)}
        onConfirm={() => { deleteCategory(deleteCategoryConfirm!.id); setDeleteCategoryConfirm(null); }}
        title="Excluir categoria"
        message={<>Tem certeza que deseja excluir a categoria <strong>"{deleteCategoryConfirm?.name}"</strong> e todos os seus produtos? Essa ação não pode ser desfeita.</>}
        confirmLabel="Excluir tudo"
        variant="danger"
      />
    </div>
  );
}
