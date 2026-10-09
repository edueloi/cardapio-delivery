import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  Eye,
  List,
  Package,
  Plus,
  Search,
  Settings,
  Trash2,
  Utensils,
} from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  ConfirmModal,
  ContentCard,
  EmptyState,
  FilterLine,
  FilterLineSearch,
  FilterLineSection,
  IconButton,
  Input,
  Modal,
  ModalFooter,
  PageWrapper,
  SectionTitle,
  Select,
  StatCard,
  StatGrid,
  Switch,
  useToast,
} from "../../../../components";
import { apiFetch } from "../../../../lib/api";
import { ProductExtraStockLink, Tenant } from "../../../../types";
import { canAccess, type MyMembership } from "../../types";
import { RecipeIngredientDraft } from "../_shared/ManagementShared";
import { ProductForm, type ProdFormState, type ProdTab } from "./ProductForm";

const DRAG_HANDLE = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <circle cx="5" cy="4" r="1.3" fill="currentColor"/><circle cx="11" cy="4" r="1.3" fill="currentColor"/>
    <circle cx="5" cy="8" r="1.3" fill="currentColor"/><circle cx="11" cy="8" r="1.3" fill="currentColor"/>
    <circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="11" cy="12" r="1.3" fill="currentColor"/>
  </svg>
);

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
      className={`flex items-center gap-3 px-3 py-2 transition-colors ${!prod.available ? 'bg-slate-50/50 opacity-70' : 'bg-white'} ${isDragging ? 'opacity-40 z-10 relative' : ''}`}
    >
      {dragEnabled && (
        <button
          {...attributes}
          {...listeners}
          aria-label="Arrastar para reordenar ou mover"
          className="shrink-0 p-1 -ml-1 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing touch-none"
          title="Arrastar para reordenar ou mover"
        >
          {DRAG_HANDLE}
        </button>
      )}
      <div className={`w-10 h-10 bg-slate-100 rounded-lg overflow-hidden shrink-0 ${!prod.available ? 'grayscale opacity-60' : ''}`}>
        {prod.imageUrl
          ? <img src={prod.imageUrl} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-slate-300"><Utensils className="w-4 h-4" /></div>
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-xs font-medium truncate ${!prod.available ? 'text-slate-500' : 'text-slate-800'}`}>{prod.name}</p>
          {!prod.available && <Badge size="sm">Inativo</Badge>}
          {(prod as any).scheduleRule && <Badge size="sm" color="info">Agendado</Badge>}
        </div>
        <p className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
          {prod.variants?.length > 0
            ? `${prod.variants.length} variações • desde ${fmt(Math.min(...prod.variants.map((v: any) => v.price)))}`
            : fmt(prod.price)
          }
          {prod.inventoryItem && (
            <>
              <span className="w-1 h-1 rounded-full bg-slate-300" />
              <span className={`font-medium text-[11px] ${
                prod.inventoryItem.quantity <= 0
                  ? "text-red-600"
                  : prod.inventoryItem.quantity < 5
                    ? "text-amber-600"
                    : "text-emerald-600"
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
          <p className="text-[11px] text-slate-500 truncate mt-0.5">{prod.description}</p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Switch
          size="sm"
          checked={!!prod.available}
          onCheckedChange={() => toggleProductAvailability(prod)}
          title={prod.available ? "Desativar produto" : "Ativar produto"}
          aria-label={prod.available ? "Desativar produto" : "Ativar produto"}
        />
        <IconButton size="xs" variant="ghost" aria-label="Editar produto" title="Editar produto" onClick={() => openEditProduct(prod)}>
          <Settings size={14} />
        </IconButton>
        <IconButton size="xs" variant="ghost" aria-label="Excluir produto" title="Excluir produto" onClick={() => setDeleteProductConfirm(prod.id)}>
          <Trash2 size={14} className="text-red-600" />
        </IconButton>
      </div>
    </div>
  );
}

function ProductRowGhost({ prod, fmt }: { prod: any; fmt: (n: number) => string }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-white rounded-lg border border-blue-300 rotate-1">
      <div className="w-10 h-10 bg-slate-100 rounded-lg overflow-hidden shrink-0">
        {prod.imageUrl
          ? <img src={prod.imageUrl} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-slate-300"><Utensils className="w-4 h-4" /></div>
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-800 truncate">{prod.name}</p>
        <p className="text-[11px] text-slate-500">{fmt(prod.price)}</p>
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
      className={`px-3 py-5 text-center transition-colors ${isOver ? 'bg-blue-50' : ''}`}
    >
      <p className="text-xs text-slate-500">
        {isDraggingProduct ? "Solte aqui para mover para esta categoria" : "Nenhum produto ainda."}
      </p>
      <Button variant="ghost" size="xs" className="mt-1" iconLeft={<Plus size={14} />} onClick={() => openNewProduct(categoryId)}>
        Adicionar produto
      </Button>
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
      className={`bg-white rounded-lg border border-slate-200 overflow-hidden mb-3 last:mb-0 ${isDragging ? 'opacity-40 z-10 relative' : ''}`}
    >
      <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {dragEnabled && (
            <button
              {...attributes}
              {...listeners}
              aria-label="Arrastar para reordenar categoria"
              className="shrink-0 p-1 -ml-1 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing touch-none"
              title="Arrastar para reordenar categoria"
            >
              {DRAG_HANDLE}
            </button>
          )}
          <h3 className="font-medium text-slate-800 text-sm truncate">{cat.name}
            <span className="ml-2 text-[11px] text-slate-500 font-normal">{cat.products?.length || 0} itens</span>
          </h3>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="xs" iconLeft={<Plus size={14} />} onClick={() => openNewProduct(cat.id)}>Produto</Button>
          <IconButton size="xs" variant="ghost" aria-label="Editar categoria" title="Editar categoria" onClick={() => openEditCategory(cat)}>
            <Settings size={14} />
          </IconButton>
        </div>
      </div>

      <div className="divide-y divide-slate-100">
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
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  // Lazy initializer: popula de imediato com o que o tenant já trouxer, evitando
  // o "flash vazio" que aparecia sempre que esta tela era desmontada e remontada
  // (ex: trocar para "Estoque" e voltar) antes do useEffect abaixo rodar.
  const [localCategories, setLocalCategories] = useState<any[]>(() => tenant?.categories || []);

  // Conferência fiscal em lote. O NCM continua sendo informado produto a produto,
  // pois depende da composição; o perfil em lote altera somente o CFOP.
  const [fiscalReviewOpen, setFiscalReviewOpen] = useState(false);
  const [fiscalReviewSearch, setFiscalReviewSearch] = useState("");
  const [fiscalDrafts, setFiscalDrafts] = useState<Record<string, {
    ncm: string; cfop: string; csosn: string; unitCom: string; origem: number; aliqIcms: number;
  }>>({});
  const [fiscalSaving, setFiscalSaving] = useState(false);

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
  const [prodTab, setProdTab] = useState<ProdTab>("geral");
  const [prodSaving, setProdSaving] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [inventoryCategories, setInventoryCategories] = useState<any[]>([]);
  const [productionRecipes, setProductionRecipes] = useState<any[]>([]);
  const [prodForm, setProdForm] = useState<ProdFormState>({
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
    extras: [] as { id: string, label: string, price: string, stockLinks: ProductExtraStockLink[], autoApplyOnTakeout: boolean }[],
    // Grupos de seleção embutidos — cada um deixa o cliente escolher N itens de uma
    // categoria/lista, sem alterar o preço fixo do produto. Uma marmita pode ter vários:
    // "Guarnição" (escolha 1), "Arroz" (escolha 1), "Feijão" (escolha 1) — cada grupo sua
    // própria categoria de opções.
    selectionGroups: [] as { _key: string, sourceType: "category" | "products", categoryId: string, productIds: string[], qty: string, label: string }[],
    // Fiscal NFC-e
    ncm: "", cfop: "5102", csosn: "102", unitCom: "UN", origem: 0, aliqIcms: 0,
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
      // Mesmo bug do /inventory acima: sem permissão, o servidor responde 403 (não um
      // array) — sem checar res.ok isso virava uma lista vazia em silêncio, fazendo
      // "Insumos Usados" parecer sem nenhum insumo vinculado mesmo quando já existia um.
      apiFetch(`/api/tenants/${tenant.slug}/production/recipes`)
        .then(res => res.ok ? res.json() : Promise.reject(res))
        .then(data => setProductionRecipes(Array.isArray(data) ? data : []))
        .catch((err) => {
          setProductionRecipes([]);
          if (err?.status === 403) {
            toast.error("Sem permissão de Produção/Cardápio para ver os insumos — peça ao proprietário para liberar em Equipe > permissões.");
          }
        });
    }
  }, [tenant]);

  // Produto abre em tela cheia; o histórico do navegador (?produto=) faz o botão
  // "voltar" do navegador fechar o formulário em vez de sair do painel.
  const productParam = searchParams.get("produto");
  const historySeen = useRef(false);
  const pushProductHistory = (value: string) => {
    const next = new URLSearchParams(window.location.search);
    next.set("produto", value);
    historySeen.current = true;
    navigate({ search: next.toString() });
  };
  useEffect(() => {
    if (productParam) { historySeen.current = true; return; }
    if (historySeen.current) {
      historySeen.current = false;
      setProdModal(m => (m.open ? { open: false, categoryId: null } : m));
      setEditingProduct(null);
    }
  }, [productParam]);

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
    setProdTab("geral");
    setProdModal({ open: true, categoryId });
    pushProductHistory("novo");
  };

  const openEditProduct = (prod: any) => {
    setEditingProduct(prod);
    let parsedExtras: { id: string, label: string, price: string, stockLinks: ProductExtraStockLink[], autoApplyOnTakeout: boolean }[] = [];
    try {
      const raw = prod.extras ? JSON.parse(prod.extras) : [];
      parsedExtras = raw.map((e: any) => {
        // Migra automaticamente o formato antigo (1 vínculo solto) pra stockLinks —
        // produtos salvos antes dessa mudança continuam abrindo normalmente.
        const stockLinks: ProductExtraStockLink[] = Array.isArray(e.stockLinks) && e.stockLinks.length > 0
          ? e.stockLinks.map((l: any) => ({ id: l.id || crypto.randomUUID(), inventoryItemId: l.inventoryItemId, quantity: Number(l.quantity) || 0, unit: l.unit || "un" }))
          : e.inventoryItemId
            ? [{ id: crypto.randomUUID(), inventoryItemId: e.inventoryItemId, quantity: e.inventoryQuantity != null ? Number(e.inventoryQuantity) : 1, unit: e.inventoryUnit || "un" }]
            : [];
        return {
          id: e.id,
          label: e.label,
          price: String(e.price ?? 0),
          stockLinks,
          autoApplyOnTakeout: !!e.autoApplyOnTakeout,
        };
      });
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
      ncm: prod.ncm || "", cfop: prod.cfop || "5102", csosn: prod.csosn || "102",
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
    setProdTab("geral");
    setProdModal({ open: true, categoryId: prod.categoryId });
    pushProductHistory(String(prod.id));
  };



  const closeProdModal = () => { setProdModal({ open: false, categoryId: null }); setEditingProduct(null); };
  const leaveProductPage = () => {
    closeProdModal();
    if (searchParams.get("produto")) {
      historySeen.current = false;
      navigate(-1);
    }
  };

  const saveProduct = async () => {
    if (prodSaving) return;
    setProdSaving(true);
    try {
      await doSaveProduct();
    } finally {
      setProdSaving(false);
    }
  };

  const doSaveProduct = async () => {
    if (!prodForm.name.trim()) {
      setProdTab("geral");
      toast.error("Informe o nome do produto.");
      return;
    }
    if (!prodModal.categoryId) {
      setProdTab("geral");
      toast.error("Selecione uma categoria.");
      return;
    }
    const hasVariants = prodForm.variants.length > 0;
    if (!hasVariants && (!prodForm.price || isNaN(parseFloat(prodForm.price)))) {
      setProdTab("geral");
      toast.error("Informe o preço do produto.");
      return;
    }
    if (hasVariants) {
      const invalidVariant = prodForm.variants.find(v => !v.name.trim() || !v.price || isNaN(parseFloat(v.price)));
      if (invalidVariant) {
        setProdTab("variantes");
        toast.error("Preencha nome e preço de todas as variações.");
        return;
      }
    }
    const validIngredients = recipeIngredients.filter(ing => ing.inventoryItemId && ing.quantity && !isNaN(parseFloat(ing.quantity)));
    const incompleteIngredient = recipeIngredients.find(ing => !ing.inventoryItemId || !ing.quantity || isNaN(parseFloat(ing.quantity)));
    if (incompleteIngredient) {
      setProdTab("estoque");
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
        setProdTab("selecao");
        toast.error("Este produto já tem variações — remova-as antes de ativar \"Cliente escolhe itens\", ou remova os grupos de seleção. Os dois juntos fazem o cliente escolher o sabor duas vezes.");
        return;
      }
      const builtGroups: { sourceType: "category" | "products"; categoryId?: string; productIds?: string[]; qty: number; label?: string }[] = [];
      for (const g of prodForm.selectionGroups) {
        const qty = parseInt(g.qty, 10);
        if (!qty || qty < 1) {
          setProdTab("selecao");
          toast.error(`"${g.label || "Grupo de seleção"}": informe quantos itens o cliente deve escolher.`);
          return;
        }
        if (g.sourceType === "category" && !g.categoryId) {
          setProdTab("selecao");
          toast.error(`"${g.label || "Grupo de seleção"}": selecione a categoria de onde vêm as opções.`);
          return;
        }
        if (g.sourceType === "products" && g.productIds.length === 0) {
          setProdTab("selecao");
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
        extras: JSON.stringify(prodForm.extras.map(e => ({
          id: e.id,
          label: e.label,
          price: parseFloat(e.price) || 0,
          stockLinks: e.stockLinks
            .filter(l => l.inventoryItemId)
            .map(l => ({ id: l.id, inventoryItemId: l.inventoryItemId, quantity: l.quantity || 1, unit: l.unit || "un" })),
          autoApplyOnTakeout: e.stockLinks.some(l => l.inventoryItemId) && e.autoApplyOnTakeout ? true : undefined,
        }))),
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
    leaveProductPage();
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
        toast.warning("Este produto já foi usado em pedidos e não pode ser excluído (mantém o histórico de vendas), mas foi desativado e não aparece mais no cardápio.");
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
  const addTakeoutKit = () => setProdForm(prev => {
    if (prev.extras.some(extra => extra.autoApplyOnTakeout)) return prev;
    return {
      ...prev,
      extras: [...prev.extras, {
        id: crypto.randomUUID(), label: "Kit para viagem", price: "0",
        stockLinks: [], autoApplyOnTakeout: true,
      }],
    };
  });

  const categories = localCategories;
  const allCatalogProducts = categories.flatMap((category: any) => category.products || []);

  const openFiscalReview = () => {
    setFiscalDrafts(Object.fromEntries(allCatalogProducts.map((product: any) => [product.id, {
      ncm: product.ncm || "",
      cfop: product.cfop || "",
      csosn: product.csosn || "102",
      unitCom: product.unitCom || "UN",
      origem: product.origem ?? 0,
      aliqIcms: product.aliqIcms ?? 0,
    }])));
    setFiscalReviewSearch("");
    setFiscalReviewOpen(true);
  };

  const updateFiscalDraft = (productId: string, patch: Partial<typeof fiscalDrafts[string]>) => {
    setFiscalDrafts(current => ({
      ...current,
      [productId]: { ...current[productId], ...patch },
    }));
  };

  const fiscalReviewProducts = allCatalogProducts.filter((product: any) =>
    !fiscalReviewSearch.trim() || product.name.toLowerCase().includes(fiscalReviewSearch.trim().toLowerCase())
  );
  const productsWithFiscalPending = allCatalogProducts.filter((product: any) => !product.ncm || !product.cfop);

  const applyFiscalProfile = (cfop: "5101" | "5102") => {
    setFiscalDrafts(current => {
      const next = { ...current };
      for (const product of fiscalReviewProducts) {
        next[product.id] = { ...next[product.id], cfop };
      }
      return next;
    });
  };

  const saveFiscalReview = async () => {
    const changed = allCatalogProducts.filter((product: any) => {
      const draft = fiscalDrafts[product.id];
      return draft && (
        draft.ncm !== (product.ncm || "") ||
        draft.cfop !== (product.cfop || "") ||
        draft.csosn !== (product.csosn || "102") ||
        draft.unitCom !== (product.unitCom || "UN") ||
        draft.origem !== (product.origem ?? 0) ||
        draft.aliqIcms !== (product.aliqIcms ?? 0)
      );
    });

    if (changed.length === 0) {
      toast.error("Não há alterações fiscais para salvar.");
      return;
    }

    const invalid = changed.find((product: any) => {
      const draft = fiscalDrafts[product.id];
      const ncm = draft.ncm.replace(/\D/g, "");
      return !/^\d{8}$/.test(ncm) || ncm === "00000000" || !/^\d{4}$/.test(draft.cfop);
    });
    if (invalid) {
      toast.error(`Revise NCM e CFOP de “${invalid.name}”. O NCM deve ter 8 dígitos e o CFOP, 4.`);
      return;
    }

    setFiscalSaving(true);
    try {
      for (const product of changed) {
        const draft = fiscalDrafts[product.id];
        const response = await apiFetch(`/api/owner/products/${product.id}/fiscal`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...draft, ncm: draft.ncm.replace(/\D/g, "") }),
        });
        const saved = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(saved?.error || `Não foi possível salvar “${product.name}”.`);
        setLocalCategories(current => current.map(category => ({
          ...category,
          products: category.products?.map((item: any) => item.id === product.id ? { ...item, ...saved } : item),
        })));
      }
      toast.success(`${changed.length} produto${changed.length > 1 ? "s" : ""} fiscal${changed.length > 1 ? "is" : ""} atualizado${changed.length > 1 ? "s" : ""}.`);
      setFiscalReviewOpen(false);
      refresh();
    } catch (error: any) {
      toast.error(error?.message || "Falha ao salvar os dados fiscais.");
    } finally {
      setFiscalSaving(false);
    }
  };

  const visibleCategories = categories
    .filter(cat => selectedCat === "all" || cat.id === selectedCat)
    .map(cat => ({
      ...cat,
      products: (cat.products || []).filter(p => {
        if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
        if (statusFilter === "active" && p.available === false) return false;
        if (statusFilter === "inactive" && p.available !== false) return false;
        return true;
      })
    }))
    .filter(cat => (!search && statusFilter === "all") || cat.products.length > 0);

  // Arrastar só faz sentido quando a ordem exibida é a ordem real (sem filtro de busca/categoria/status)
  const dragEnabled = !search && selectedCat === "all" && statusFilter === "all";

  const fmt = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);

  // ── Modal de produto: aba "Viagem" é o adicional com autoApplyOnTakeout=true,
  // separado dos demais extras (que o cliente escolhe) desde que a UI ganhou aba própria.
  const takeoutExtraIndex = prodForm.extras.findIndex(e => e.autoApplyOnTakeout);
  const takeoutExtra = takeoutExtraIndex >= 0 ? prodForm.extras[takeoutExtraIndex] : null;
  const visibleExtras = prodForm.extras.filter(e => !e.autoApplyOnTakeout);
  const enableTakeoutKit = (enabled: boolean) => {
    if (enabled) { if (!takeoutExtra) addTakeoutKit(); return; }
    if (takeoutExtra) setProdForm(prev => ({ ...prev, extras: prev.extras.filter(e => e.id !== takeoutExtra.id) }));
  };
  const updateTakeoutExtra = (patch: Partial<typeof prodForm.extras[number]>) => {
    if (!takeoutExtra) return;
    setProdForm(prev => ({ ...prev, extras: prev.extras.map(x => x.id === takeoutExtra.id ? { ...x, ...patch } : x) }));
  };

  const confirmModals = (
    <>
      <ConfirmModal
        isOpen={!!deleteProductConfirm}
        onClose={() => setDeleteProductConfirm(null)}
        onConfirm={() => { deleteProduct(deleteProductConfirm!); setDeleteProductConfirm(null); }}
        title="Excluir produto"
        message="Tem certeza que deseja excluir este produto? Essa ação não pode ser desfeita."
        confirmLabel="Excluir"
        variant="danger"
      />
      <ConfirmModal
        isOpen={!!deleteCategoryConfirm}
        onClose={() => setDeleteCategoryConfirm(null)}
        onConfirm={() => { deleteCategory(deleteCategoryConfirm!.id); setDeleteCategoryConfirm(null); }}
        title="Excluir categoria"
        message={<>Tem certeza que deseja excluir a categoria <strong>"{deleteCategoryConfirm?.name}"</strong> e todos os seus produtos? Essa ação não pode ser desfeita.</>}
        confirmLabel="Excluir tudo"
        variant="danger"
      />
    </>
  );

  // ── Página de produto (tela inteira, com histórico do navegador via ?produto=) ──
  if (prodModal.open) {
    return (
      <PageWrapper>
        <ProductForm
          isEditing={!!editingProduct}
          editingProductId={editingProduct?.id}
          prodForm={prodForm}
          setProdForm={setProdForm}
          tab={prodTab}
          onTabChange={setProdTab}
          saving={prodSaving}
          onSave={saveProduct}
          onCancel={leaveProductPage}
          onDelete={() => { const id = editingProduct?.id; leaveProductPage(); if (id) setDeleteProductConfirm(id); }}
          onDuplicate={duplicateProductToCatalog}
          onDuplicateToInventory={duplicateProductToInventory}
          canManageInventory={canManageInventory}
          categories={localCategories}
          currentCategoryId={prodModal.categoryId}
          inventoryItems={inventoryItems}
          inventoryCategories={inventoryCategories}
          recipeIngredients={recipeIngredients}
          setRecipeIngredients={setRecipeIngredients}
          extraInput={extraInput}
          setExtraInput={setExtraInput}
          takeoutExtra={takeoutExtra}
          visibleExtras={visibleExtras}
          enableTakeoutKit={enableTakeoutKit}
          updateTakeoutExtra={updateTakeoutExtra}
          addVariantField={addVariantField}
          removeVariantField={removeVariantField}
          updateVariantField={updateVariantField}
          addSelectionGroupField={addSelectionGroupField}
          removeSelectionGroupField={removeSelectionGroupField}
          updateSelectionGroupField={updateSelectionGroupField}
        />
        {confirmModals}
      </PageWrapper>
    );
  }

  const activeProductsCount = allCatalogProducts.filter((p: any) => p.available !== false).length;
  const inactiveProductsCount = allCatalogProducts.length - activeProductsCount;
  const hasFilters = !!search || statusFilter !== "all" || selectedCat !== "all";

  return (
    <PageWrapper>
      <div className="space-y-4">
        <SectionTitle
          icon={Utensils}
          title="Cardápio"
          description="Gerencie categorias, preços e disponibilidades em tempo real."
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={openFiscalReview}>
                Conferência fiscal{productsWithFiscalPending.length > 0 ? ` (${productsWithFiscalPending.length})` : ""}
              </Button>
              <Button size="sm" onClick={openNewCategory} iconLeft={<Plus size={14} />}>Nova categoria</Button>
            </div>
          }
        />

        {categories.length > 0 && (
          <StatGrid cols={4}>
            <StatCard title="Categorias" value={categories.length} icon={List} color="info" />
            <StatCard title="Produtos" value={allCatalogProducts.length} icon={Package} color="info" />
            <StatCard title="Ativos" value={activeProductsCount} icon={CheckCircle2} color="success" />
            <StatCard title="Inativos" value={inactiveProductsCount} icon={Eye} color={inactiveProductsCount > 0 ? "warning" : "info"} />
          </StatGrid>
        )}

        {categories.length > 0 && (
          <FilterLine>
            <FilterLineSection grow>
              <FilterLineSearch aria-label="Buscar produto" value={search} onChange={setSearch} placeholder="Buscar produto..." className="max-w-[280px]" />
              <Select
                aria-label="Filtrar por categoria"
                wrapperClassName="w-full sm:w-56"
                value={selectedCat}
                onChange={e => setSelectedCat(e.target.value)}
              >
                <option value="all">Todas as categorias ({categories.length})</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name} ({cat.products?.length || 0})</option>
                ))}
              </Select>
              <Select
                aria-label="Filtrar por status"
                wrapperClassName="w-full sm:w-44"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
              >
                <option value="all">Ativos e inativos</option>
                <option value="active">Somente ativos</option>
                <option value="inactive">Somente inativos</option>
              </Select>
            </FilterLineSection>
            {hasFilters && (
              <FilterLineSection align="right">
                <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setSelectedCat("all"); setStatusFilter("all"); }}>Limpar filtros</Button>
              </FilterLineSection>
            )}
          </FilterLine>
        )}

        {categories.length === 0 && (
          <ContentCard>
            <EmptyState
              icon={Utensils}
              title="Comece criando uma categoria"
              description="Categorias organizam seu cardápio — ex: Pastéis, Bebidas, Sobremesas. Depois disso você adiciona os produtos dentro de cada uma."
              action={<Button size="sm" onClick={openNewCategory} iconLeft={<Plus size={14} />}>Adicionar primeira categoria</Button>}
            />
          </ContentCard>
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
              <div className="bg-white rounded-lg border-2 border-blue-500 px-3 py-2 opacity-95 rotate-1">
                <h3 className="font-medium text-slate-800 text-sm">{activeDragCategory.name}</h3>
              </div>
            )}
            {activeDragProduct && <ProductRowGhost prod={activeDragProduct} fmt={fmt} />}
          </DragOverlay>
        </DndContext>

        {/* Search / filtro sem resultado */}
        {(search || statusFilter !== "all") && visibleCategories.length === 0 && categories.length > 0 && (
          <ContentCard>
            <EmptyState
              icon={Search}
              title={search ? `Nenhum produto encontrado para "${search}"` : statusFilter === "inactive" ? "Nenhum produto inativo no momento." : "Nenhum produto ativo encontrado."}
              description="Ajuste os filtros para ver mais produtos."
            />
          </ContentCard>
        )}
      </div>

      <Modal
        isOpen={fiscalReviewOpen}
        onClose={() => !fiscalSaving && setFiscalReviewOpen(false)}
        title="Conferência fiscal do cardápio"
        size="full"
        mobileStyle="fullscreen"
        footer={
          <ModalFooter align="between">
            <p className="text-xs text-slate-500 hidden sm:block">NCM identifica o produto; CFOP identifica se é produção própria ou revenda.</p>
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={() => setFiscalReviewOpen(false)} disabled={fiscalSaving}>Cancelar</Button>
              <Button onClick={saveFiscalReview} loading={fiscalSaving}>Salvar alterações</Button>
            </div>
          </ModalFooter>
        }
      >
        <div className="space-y-3">
          <Alert variant="warning" title="Confirme o NCM com o contador antes de salvar.">
            Produção própria aplica o CFOP 5101; revenda aplica 5102. Esses atalhos não alteram o NCM, pois ele depende da composição do produto.
          </Alert>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <Input
              aria-label="Buscar produto para conferir"
              wrapperClassName="w-full lg:flex-1 lg:max-w-[280px]"
              value={fiscalReviewSearch}
              onChange={event => setFiscalReviewSearch(event.target.value)}
              placeholder="Buscar produto para conferir..."
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => applyFiscalProfile("5101")}>Produção própria (5101)</Button>
              <Button variant="outline" size="sm" onClick={() => applyFiscalProfile("5102")}>Revenda (5102)</Button>
            </div>
          </div>
          <p className="text-xs text-slate-500">Os atalhos são aplicados apenas aos {fiscalReviewProducts.length} produtos exibidos no filtro. Campos em destaque precisam de revisão antes da emissão.</p>
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full min-w-[760px] text-left">
              <thead className="bg-zinc-50 text-[11px] font-medium text-slate-500">
                <tr><th className="px-3 py-2">Produto</th><th className="px-3 py-2">NCM</th><th className="px-3 py-2">CFOP</th><th className="px-3 py-2">CSOSN</th><th className="px-3 py-2">Unidade</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {fiscalReviewProducts.map((product: any) => {
                  const draft = fiscalDrafts[product.id];
                  const invalidNcm = !draft?.ncm || !/^\d{8}$/.test(draft.ncm.replace(/\D/g, "")) || draft.ncm.replace(/\D/g, "") === "00000000";
                  return <tr key={product.id} className="bg-white">
                    <td className="px-3 py-2"><p className="text-xs font-medium text-slate-800">{product.name}</p>{invalidNcm && <p className="mt-0.5 text-[11px] font-medium text-red-600">NCM pendente</p>}</td>
                    <td className="px-3 py-2"><Input aria-label={`NCM de ${product.name}`} wrapperClassName="w-32" value={draft?.ncm || ""} maxLength={8} onChange={event => updateFiscalDraft(product.id, { ncm: event.target.value.replace(/\D/g, "") })} placeholder="8 dígitos" status={invalidNcm ? "error" : "default"} /></td>
                    <td className="px-3 py-2"><Select aria-label={`CFOP de ${product.name}`} wrapperClassName="w-52" value={draft?.cfop || ""} onChange={event => updateFiscalDraft(product.id, { cfop: event.target.value })}><option value="">Selecione</option><option value="5101">5101 — Produção própria</option><option value="5102">5102 — Revenda</option><option value="5405">5405 — ST</option><option value="5933">5933 — Serviço</option></Select></td>
                    <td className="px-3 py-2"><Select aria-label={`CSOSN de ${product.name}`} wrapperClassName="w-24" value={draft?.csosn || "102"} onChange={event => updateFiscalDraft(product.id, { csosn: event.target.value })}><option value="102">102</option><option value="103">103</option><option value="500">500</option><option value="900">900</option></Select></td>
                    <td className="px-3 py-2"><Select aria-label={`Unidade de ${product.name}`} wrapperClassName="w-24" value={draft?.unitCom || "UN"} onChange={event => updateFiscalDraft(product.id, { unitCom: event.target.value })}>{["UN", "KG", "G", "L", "ML", "CX", "PC", "PT", "PAR", "DZ"].map(unit => <option key={unit} value={unit}>{unit}</option>)}</Select></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      {/* Modal: categoria */}
      <Modal
        isOpen={catModal.open}
        onClose={closeCatModal}
        title={catModal.editing ? "Editar categoria" : "Nova categoria"}
        size="sm"
        footer={
          <ModalFooter align={catModal.editing ? "between" : "right"}>
            {catModal.editing && (
              <Button variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => { closeCatModal(); setDeleteCategoryConfirm({ id: catModal.editing!.id, name: catName }); }}>
                Excluir categoria
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={closeCatModal}>Cancelar</Button>
              <Button onClick={saveCategory} loading={catSaving}>{catModal.editing ? "Salvar" : "Criar categoria"}</Button>
            </div>
          </ModalFooter>
        }
      >
        <div className="space-y-2">
          <Input
            label="Nome da categoria"
            placeholder="Ex: Pastéis, Bebidas, Sobremesas..."
            value={catName}
            onChange={e => setCatName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && saveCategory()}
            autoFocus
          />
          <p className="text-[11px] text-slate-500">Categorias agrupam os produtos no cardápio do cliente.</p>
        </div>
      </Modal>

      {confirmModals}
    </PageWrapper>
  );
}
