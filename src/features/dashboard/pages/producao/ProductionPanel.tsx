import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  ChefHat,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  Droplets,
  Factory,
  Flame,
  History,
  Link2,
  Package,
  Pencil,
  Play,
  Copy,
  Plus,
  Scale,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Combobox,
  ConfirmModal,
  ContentCard,
  Divider,
  EmptyState,
  FilterLine,
  FilterLineItem,
  FilterLineSearch,
  FilterLineSection,
  FilterLineSegmented,
  FormRow,
  GridTable,
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
  Tabs,
  Textarea,
  useToast,
} from "../../../../components";
import { apiJson } from "../../../../lib/api";
import {
  calculateProductionSimulation,
  PRODUCTION_OVERHEAD_MODE_OPTIONS,
  PRODUCTION_OVERHEAD_TYPE_OPTIONS,
  PRODUCTION_UNIT_SUGGESTIONS,
  roundProductionValue,
} from "../../../../lib/production";
import type {
  InventoryItem,
  Product,
  ProductionOverheadType,
  ProductionRecipe,
  ProductionRecipeIngredient,
  ProductionRecipeOverhead,
  ProductionRun,
  ProductionSimulation,
  Tenant,
} from "../../../../types";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});

const PRODUCTION_UNIT_OPTIONS = [
  { value: "kg", label: "Quilograma", subtitle: "1 kg = 1000 g", group: "Peso", badge: "kg" },
  { value: "g", label: "Grama", subtitle: "Medidas menores de massa", group: "Peso", badge: "g" },
  { value: "mg", label: "Miligrama", subtitle: "Micromedidas de massa", group: "Peso", badge: "mg" },
  { value: "l", label: "Litro", subtitle: "Volumes maiores", group: "Volume", badge: "l" },
  { value: "ml", label: "Mililitro", subtitle: "Volumes menores", group: "Volume", badge: "ml" },
  { value: "un", label: "Unidade", subtitle: "Peças individuais", group: "Contagem", badge: "un" },
  { value: "dz", label: "Dúzia", subtitle: "12 unidades", group: "Contagem", badge: "dz" },
  { value: "cm", label: "Centímetro", subtitle: "Medidas lineares pequenas", group: "Comprimento", badge: "cm" },
  { value: "m", label: "Metro", subtitle: "Medidas lineares maiores", group: "Comprimento", badge: "m" },
];

type RecipeFilter = "all" | "active" | "critical" | "inactive";
type ProductionTab = "recipes" | "history";
type EditorTab = "base" | "ingredients" | "overheads" | "instructions";

const PRODUCTION_FILTER_OPTIONS = [
  { value: "all", label: "Todas" },
  { value: "active", label: "Ativas" },
  { value: "critical", label: "Críticas" },
  { value: "inactive", label: "Inativas" },
] as const;

const EDITOR_TABS = [
  { id: "base", label: "Identificação", icon: ClipboardList },
  { id: "ingredients", label: "Insumos", icon: Package },
  { id: "overheads", label: "Custos indiretos", icon: CircleDollarSign },
  { id: "instructions", label: "Modo de preparo", icon: ChefHat },
] as const;

function productionTabs(recipeCount: number, runCount: number) {
  return [
    { id: "recipes", label: "Fichas Técnicas", icon: ChefHat, badge: recipeCount },
    { id: "history", label: "Histórico", icon: History, badge: runCount },
  ] as const;
}

interface RecipeSummary {
  recipe: ProductionRecipe;
  simulation: ProductionSimulation;
}

function formatCurrency(value: number) {
  return currencyFormatter.format(Number(value || 0));
}

function formatNumber(value: number) {
  return numberFormatter.format(Number(value || 0));
}

function formatQuantity(value: number, unit?: string | null) {
  return `${formatNumber(value)} ${unit || "un"}`.trim();
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR");
}

function createRowId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getOverheadAccent(type: ProductionOverheadType) {
  switch (type) {
    case "ENERGIA":
      return { color: "info" as const, icon: <Zap className="h-3.5 w-3.5" /> };
    case "AGUA":
      return { color: "teal" as const, icon: <Droplets className="h-3.5 w-3.5" /> };
    case "GAS":
      return { color: "orange" as const, icon: <Flame className="h-3.5 w-3.5" /> };
    case "MAO_DE_OBRA":
      return { color: "primary" as const, icon: <CircleDollarSign className="h-3.5 w-3.5" /> };
    case "EMBALAGEM":
      return { color: "purple" as const, icon: <Package className="h-3.5 w-3.5" /> };
    default:
      return { color: "default" as const, icon: <ClipboardList className="h-3.5 w-3.5" /> };
  }
}

function flattenProducts(tenant: Tenant | null) {
  if (!tenant?.categories) return [];
  return tenant.categories
    .flatMap((category) => category.products || [])
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export default function ProductionPanel({ tenant }: { tenant: Tenant | null }) {
  const toast = useToast();
  const [recipes, setRecipes] = useState<ProductionRecipe[]>([]);
  const [runs, setRuns] = useState<ProductionRun[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Abas
  const [activeTab, setActiveTab] = useState<ProductionTab>("recipes");

  // Receitas
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<RecipeFilter>("all");
  const [selectedRecipe, setSelectedRecipe] = useState<ProductionRecipe | null>(null);
  const [previewQuantity, setPreviewQuantity] = useState("");

  // Modais
  const [editingRecipe, setEditingRecipe] = useState<ProductionRecipe | null>(null);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [recipeToProduce, setRecipeToProduce] = useState<ProductionRecipe | null>(null);
  const [selectedRun, setSelectedRun] = useState<ProductionRun | null>(null);
  const [recipeToDelete, setRecipeToDelete] = useState<ProductionRecipe | null>(null);
  const [deleting, setDeleting] = useState(false);

  const products = flattenProducts(tenant);

  const fetchData = async () => {
    if (!tenant) return;
    setLoading(true);
    setError("");
    try {
      const [inventoryData, recipeData, runData] = await Promise.all([
        apiJson<InventoryItem[]>(`/api/tenants/${tenant.slug}/inventory`),
        apiJson<ProductionRecipe[]>(`/api/tenants/${tenant.slug}/production/recipes`),
        apiJson<ProductionRun[]>(`/api/tenants/${tenant.slug}/production/runs`),
      ]);
      setInventoryItems(Array.isArray(inventoryData) ? inventoryData : []);
      setRecipes(Array.isArray(recipeData) ? recipeData : []);
      setRuns(Array.isArray(runData) ? runData : []);
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : "Falha ao carregar a central de produção.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, [tenant?.id, tenant?.slug]);

  useEffect(() => {
    if (selectedRecipe) {
      setPreviewQuantity(String(selectedRecipe.outputQuantity || 1));
    }
  }, [selectedRecipe?.id, selectedRecipe?.outputQuantity]);

  const recipeSummaries: RecipeSummary[] = recipes.map((recipe) => ({
    recipe,
    simulation: calculateProductionSimulation({
      recipe,
      inventoryItems,
      quantityProduced: recipe.outputQuantity || 1,
      linkedProduct: recipe.product || null,
    }),
  }));

  const filteredRecipes = recipeSummaries.filter(({ recipe, simulation }) => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !normalizedSearch ||
      recipe.name.toLowerCase().includes(normalizedSearch) ||
      (recipe.product?.name || "").toLowerCase().includes(normalizedSearch);
    if (!matchesSearch) return false;
    if (filter === "active") return recipe.active;
    if (filter === "inactive") return !recipe.active;
    if (filter === "critical") return simulation.missingItems > 0;
    return true;
  });

  const previewSimulation = selectedRecipe
    ? calculateProductionSimulation({
        recipe: selectedRecipe,
        inventoryItems,
        quantityProduced: Number(previewQuantity) || selectedRecipe.outputQuantity || 1,
        linkedProduct: selectedRecipe.product || null,
      })
    : null;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthlyRuns = runs.filter((run) => new Date(run.createdAt) >= monthStart);
  const monthlyCost = monthlyRuns.reduce((sum, run) => sum + run.totalCost, 0);
  const activeRecipes = recipes.filter((recipe) => recipe.active).length;
  const criticalRecipes = recipeSummaries.filter((entry) => entry.simulation.missingItems > 0).length;

  if (!tenant) return null;

  return (
    <PageWrapper>
    <div className="min-w-0 space-y-4">
      <SectionTitle
        title="Central de Produção"
        description="Fichas técnicas, conversão de unidades, consumo projetado, baixa automática e histórico de custos"
        icon={Factory}
        action={
          <>
            <Button
              variant="outline"
              size="sm"
              iconLeft={<Plus size={14} />}
              onClick={() => { setEditingRecipe(null); setShowRecipeModal(true); }}
            >
              Nova Receita
            </Button>
            <Button
              variant="primary"
              size="sm"
              iconLeft={<Play size={14} />}
              onClick={() => selectedRecipe && setRecipeToProduce(selectedRecipe)}
              disabled={!selectedRecipe}
            >
              Registrar Produção
            </Button>
          </>
        }
      />

      <StatGrid cols={4}>
        <StatCard title="Receitas Cadastradas" value={recipes.length} icon={ChefHat} color="info" />
        <StatCard title="Receitas Críticas" value={criticalRecipes} icon={AlertTriangle} color={criticalRecipes > 0 ? "warning" : "success"} />
        <StatCard title="Receitas Ativas" value={activeRecipes} icon={Package} color="success" />
        <StatCard title="Custo Produzido" value={formatCurrency(monthlyCost)} icon={CircleDollarSign} color="info" />
      </StatGrid>

      {error && (
        <Alert
          variant="error"
          title="Falha ao carregar a central de produção"
          action={<Button variant="danger" size="sm" onClick={() => void fetchData()}>Tentar Novamente</Button>}
        >
          {error}
        </Alert>
      )}

      <Tabs items={productionTabs(recipes.length, runs.length)} value={activeTab} onChange={(v) => setActiveTab(v as ProductionTab)} label="Seções da produção">
      {/* Aba Fichas Técnicas */}
      {activeTab === "recipes" && (
        <>
          <FilterLine>
            <FilterLineSection grow wrap className="gap-2">
              <FilterLineItem fullOnMobile={false} grow className="min-w-0 sm:max-w-[280px]">
                <FilterLineSearch
                  value={searchTerm}
                  onChange={setSearchTerm}
                  placeholder="Buscar receita ou produto..."
                  aria-label="Buscar receitas"
                  className="h-[34px]"
                />
              </FilterLineItem>
              <FilterLineSegmented
                size="sm"
                value={filter}
                onChange={(v) => setFilter(v as RecipeFilter)}
                options={PRODUCTION_FILTER_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.value === "all" ? `Todas (${recipes.length})` : option.label,
                }))}
              />
            </FilterLineSection>
          </FilterLine>

          <ContentCard padding="md" className="min-w-0 space-y-4">
            {loading ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-6 py-16 text-center text-xs text-slate-500">
                Carregando receitas...
              </div>
            ) : filteredRecipes.length === 0 ? (
              <EmptyState
                icon={ChefHat}
                title="Nenhuma receita encontrada"
                description="Cadastre sua primeira ficha técnica para controlar ingredientes, custo e produção."
                action={(
                  <Button variant="primary" size="sm" iconLeft={<Plus size={14} />} onClick={() => { setEditingRecipe(null); setShowRecipeModal(true); }}>
                    Criar Receita
                  </Button>
                )}
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {filteredRecipes.map(({ recipe, simulation }) => (
                  <div
                    key={recipe.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedRecipe(recipe)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedRecipe(recipe); } }}
                    className={`flex min-w-0 cursor-pointer flex-col gap-3 rounded-lg border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${
                      selectedRecipe?.id === recipe.id
                        ? "border-blue-500 ring-1 ring-blue-200"
                        : !recipe.active
                          ? "border-slate-200 bg-slate-50/50"
                          : simulation.missingItems > 0
                            ? "border-amber-200 bg-amber-50"
                            : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                        <ChefHat className="h-[18px] w-[18px]" />
                      </div>
                      {!recipe.active ? (
                        <Badge color="default" size="sm">Inativa</Badge>
                      ) : simulation.missingItems > 0 ? (
                        <Badge color="warning" size="sm">Falta estoque</Badge>
                      ) : (
                        <Badge color="success" size="sm">Ativa</Badge>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="line-clamp-2 break-words text-[13px] font-medium leading-snug text-slate-900">{recipe.name}</p>
                      <p className="mt-1 break-words text-[11px] leading-snug text-slate-500">
                        {recipe.product?.name || "Sem produto vinculado"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">Base {formatQuantity(recipe.outputQuantity, recipe.outputUnit)}</p>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                      <span className="font-semibold tabular-nums text-slate-900">{formatCurrency(simulation.totalCost)}</span>
                      <span className="shrink-0 whitespace-nowrap">{recipe.ingredients.length} insumo(s)</span>
                    </div>
                    <div className="flex items-center gap-1.5 border-t border-slate-100 pt-3" onClick={(e) => e.stopPropagation()}>
                      <IconButton size="sm" variant="ghost" aria-label="Registrar produção" title="Registrar produção" onClick={() => setRecipeToProduce(recipe)}>
                        <Play className="h-4 w-4" />
                      </IconButton>
                      <IconButton size="sm" variant="ghost" aria-label="Editar receita" title="Editar receita" onClick={() => { setEditingRecipe(recipe); setShowRecipeModal(true); }}>
                        <Pencil className="h-4 w-4" />
                      </IconButton>
                      <IconButton size="sm" variant="ghost" aria-label="Duplicar receita" title="Duplicar receita" onClick={() => void handleDuplicateRecipe(tenant.slug, recipe, fetchData, toast.error)}>
                        <Copy className="h-4 w-4" />
                      </IconButton>
                      <IconButton size="sm" variant="ghost" aria-label="Excluir receita" className="ml-auto text-red-600 hover:text-red-700" title="Excluir receita" onClick={() => setRecipeToDelete(recipe)}>
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ContentCard>

          {/* Painel de detalhes (slide-over) */}
          {selectedRecipe && previewSimulation && (
            <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true">
              <div className="absolute inset-0 bg-slate-900/40" onClick={() => setSelectedRecipe(null)} />
              <div className="relative flex h-full w-full max-w-md flex-col gap-4 overflow-y-auto bg-white p-5 shadow-lg">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="min-w-0 break-words text-base font-semibold text-slate-900">{selectedRecipe.name}</p>
                      <Badge color={selectedRecipe.active ? "success" : "default"}>
                        {selectedRecipe.active ? "Ativa" : "Inativa"}
                      </Badge>
                      {previewSimulation.missingItems > 0 && (
                        <Badge color="warning">{previewSimulation.missingItems} item(ns) em falta</Badge>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed text-slate-500">
                      {selectedRecipe.description || "Receita pronta para controle de produção, estoque e CMV."}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Badge color="info" icon={<Scale className="h-3.5 w-3.5" />}>
                        Base {formatQuantity(selectedRecipe.outputQuantity, selectedRecipe.outputUnit)}
                      </Badge>
                      {selectedRecipe.product && (
                        <Badge color="primary" icon={<Link2 className="h-3.5 w-3.5" />} className="max-w-full shrink truncate">
                          {selectedRecipe.product.name}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <IconButton size="sm" variant="ghost" aria-label="Fechar" title="Fechar" onClick={() => setSelectedRecipe(null)} className="shrink-0">
                    <X className="h-4 w-4" />
                  </IconButton>
                </div>

                <div>
                  <p className="mb-1.5 text-[11px] font-semibold text-slate-500">Quantidade a produzir</p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={previewQuantity}
                      onChange={(e) => setPreviewQuantity(e.target.value)}
                      addonRight={selectedRecipe.outputUnit}
                      className="flex-1"
                    />
                    {[1, 2, 5].map((multiplier) => (
                      <Button
                        key={multiplier}
                        size="xs"
                        variant="outline"
                        onClick={() => setPreviewQuantity(String(roundProductionValue(selectedRecipe.outputQuantity * multiplier)))}
                      >
                        x{multiplier}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <SummaryTile label="Custo de insumos" value={formatCurrency(previewSimulation.totalIngredientCost)} icon={<Package className="h-4 w-4" />} />
                  <SummaryTile label="Custos indiretos" value={formatCurrency(previewSimulation.totalOverheadCost)} icon={<CircleDollarSign className="h-4 w-4" />} />
                  <SummaryTile label="Custo total" value={formatCurrency(previewSimulation.totalCost)} icon={<ChefHat className="h-4 w-4" />} />
                  <SummaryTile label="CMV por unidade" value={formatCurrency(previewSimulation.costPerOutput)} icon={<Factory className="h-4 w-4" />} />
                </div>

                {selectedRecipe.product?.price ? (
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold text-emerald-600">Margem estimada</p>
                        <p className="mt-1 text-xs font-semibold text-emerald-800">Preço do produto: {formatCurrency(selectedRecipe.product.price)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-semibold text-emerald-700">
                          {formatCurrency(selectedRecipe.product.price - previewSimulation.costPerOutput)}
                        </p>
                        <p className="text-[11px] font-semibold text-emerald-600">por {selectedRecipe.outputUnit}</p>
                      </div>
                    </div>
                  </div>
                ) : null}

                <Divider />

                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Consumo projetado</p>
                    <p className="text-[11px] text-slate-500">Conversão automática para a unidade do estoque.</p>
                  </div>
                  {previewSimulation.ingredients.map((ingredient) => (
                    <div
                      key={ingredient.id}
                      className={`rounded-lg border p-4 ${ingredient.available ? "border-emerald-100 bg-emerald-50/40" : "border-amber-200 bg-amber-50/70"}`}
                    >
                      <div className="flex flex-col gap-3">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="break-words text-sm font-semibold text-slate-900">{ingredient.itemName}</p>
                            <Badge color={ingredient.available ? "success" : "warning"}>
                              {ingredient.available ? "Disponível" : "Ajuste estoque"}
                            </Badge>
                          </div>
                          <p className="text-[11px] font-semibold text-slate-500">
                            Receita: {formatQuantity(ingredient.requestedQuantity, ingredient.unit)}
                            {ingredient.convertedQuantity !== null ? `• Estoque: ${formatQuantity(ingredient.convertedQuantity, ingredient.inventoryUnit)}` : ""}
                          </p>
                          {ingredient.message && <p className="text-[11px] font-semibold text-amber-700">{ingredient.message}</p>}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-right sm:grid-cols-4">
                          <MetricPill label="Antes" value={formatQuantity(ingredient.stockBefore, ingredient.inventoryUnit)} />
                          <MetricPill label="Depois" value={formatQuantity(ingredient.stockAfter, ingredient.inventoryUnit)} />
                          <MetricPill label="Custo unit." value={formatCurrency(ingredient.unitCost)} />
                          <MetricPill label="Custo total" value={formatCurrency(ingredient.totalCost)} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {previewSimulation.overheads.length > 0 && (
                  <>
                    <Divider />
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-slate-900">Custos indiretos</p>
                      {previewSimulation.overheads.map((overhead) => {
                        const accent = getOverheadAccent(overhead.type);
                        return (
                          <div key={overhead.id} className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge color={accent.color} icon={accent.icon}>{overhead.label}</Badge>
                                <span className="text-[11px] font-semibold text-slate-500">
                                  {overhead.calculationMode === "PER_OUTPUT_UNIT" ? "Por unidade produzida" : "Por receita base"}
                                </span>
                              </div>
                              {overhead.notes && <p className="text-[11px] text-slate-500">{overhead.notes}</p>}
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-slate-900">{formatCurrency(overhead.totalCost)}</p>
                              <p className="text-[11px] text-slate-500">Base {formatCurrency(overhead.cost)}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {previewSimulation.outputSnapshot && (
                  <>
                    <Divider />
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Entrada do produto final</p>
                          <p className="text-[11px] text-slate-500">Ao concluir, o item vinculado recebe entrada automática.</p>
                        </div>
                        <Badge color={previewSimulation.outputSnapshot.canRestock ? "success" : "warning"}>
                          {previewSimulation.outputSnapshot.canRestock ? "Entrada configurada" : "Configuração pendente"}
                        </Badge>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <MetricPill label="Produção planejada" value={formatQuantity(previewSimulation.outputSnapshot.requestedQuantity, previewSimulation.outputSnapshot.requestedUnit)} />
                        <MetricPill
                          label="Estoque final"
                          value={previewSimulation.outputSnapshot.convertedQuantity !== null
                            ? formatQuantity(previewSimulation.outputSnapshot.convertedQuantity, previewSimulation.outputSnapshot.inventoryUnit)
                            : "Sem conversão"}
                        />
                      </div>
                      {previewSimulation.outputSnapshot.message && (
                        <p className="mt-3 text-[11px] font-semibold text-amber-700">{previewSimulation.outputSnapshot.message}</p>
                      )}
                    </div>
                  </>
                )}

                {selectedRecipe.instructions && (
                  <>
                    <Divider />
                    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
                      <p className="text-sm font-semibold text-slate-900">Modo de preparo</p>
                      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">
                        {selectedRecipe.instructions}
                      </p>
                    </div>
                  </>
                )}

                <div className="mt-auto flex flex-col gap-3 pt-2 sm:flex-row">
                  <Button variant="primary" size="lg" iconLeft={<Play className="h-4 w-4" />} onClick={() => setRecipeToProduce(selectedRecipe)}>
                    Registrar Agora
                  </Button>
                  <Button variant="outline" size="lg" iconLeft={<Pencil className="h-4 w-4" />} onClick={() => { setEditingRecipe(selectedRecipe); setShowRecipeModal(true); }}>
                    Editar Ficha
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Aba Histórico */}
      {activeTab === "history" && (
        <ContentCard padding="md" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-sm font-medium text-slate-900">Produções registradas</h3>
            </div>
            <p className="text-xs text-slate-500">
              Cada registro mantém os custos, consumo e movimentação do momento em que foi produzido.
            </p>
          </div>

          {loading ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-6 py-16 text-center text-xs text-slate-500">
              Carregando histórico...
            </div>
          ) : runs.length === 0 ? (
            <EmptyState
              icon={Clock3}
              title="Nenhuma produção registrada"
              description="Assim que você concluir um lote, o histórico exibirá custo total, CMV e detalhes do consumo."
            />
          ) : (
            <GridTable
              data={runs}
              keyExtractor={(row) => row.id}
              noDesktopCard
              renderMobileItem={(run) => (
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">{run.recipeName}</p>
                    <Badge color="info">{run.batchCode}</Badge>
                  </div>
                  <p className="text-[11px] font-semibold text-slate-500">
                    {formatQuantity(run.quantityProduced, run.unit)} • {formatCurrency(run.totalCost)}
                  </p>
                </div>
              )}
              renderMobileExpandedContent={(run) => (
                <div className="space-y-4 px-4 py-4">
                  <div className="grid grid-cols-2 gap-3">
                    <MetricPill label="CMV unitário" value={formatCurrency(run.costPerOutput)} />
                    <MetricPill label="Registrado em" value={formatDateTime(run.createdAt)} />
                  </div>
                  {run.createdByName && (
                    <p className="text-[11px] font-semibold text-slate-500">Produzido por {run.createdByName}</p>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setSelectedRun(run)}>Ver Detalhes</Button>
                </div>
              )}
              columns={[
                {
                  header: "Lote",
                  render: (run) => (
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-900">{run.batchCode}</p>
                      <p className="text-[11px] font-semibold text-slate-500">{run.recipeName}</p>
                    </div>
                  ),
                },
                {
                  header: "Produzido",
                  render: (run) => (
                    <span className="text-xs font-medium text-slate-900">{formatQuantity(run.quantityProduced, run.unit)}</span>
                  ),
                },
                {
                  header: "Custos",
                  render: (run) => (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-slate-900">{formatCurrency(run.totalCost)}</p>
                      <p className="text-[11px] text-slate-500">{formatCurrency(run.costPerOutput)} por {run.unit}</p>
                    </div>
                  ),
                },
                {
                  header: "Responsável",
                  render: (run) => (
                    <span className="text-xs text-slate-600">{run.createdByName || "Equipe"}</span>
                  ),
                },
                {
                  header: "Data",
                  render: (run) => (
                    <span className="text-xs text-slate-600">{formatDateTime(run.createdAt)}</span>
                  ),
                },
                {
                  header: "Ações",
                  className: "text-right",
                  render: (run) => (
                    <div className="flex items-center justify-end">
                      <Button size="sm" variant="ghost" onClick={() => setSelectedRun(run)}>Detalhes</Button>
                    </div>
                  ),
                },
              ]}
              onRowClick={(run) => setSelectedRun(run)}
            />
          )}
        </ContentCard>
      )}
      </Tabs>

      {/* Modais */}
      {showRecipeModal && (
        <RecipeEditorModal
          tenant={tenant}
          inventoryItems={inventoryItems}
          products={products}
          recipe={editingRecipe}
          onClose={() => { setShowRecipeModal(false); setEditingRecipe(null); }}
          onSaved={async () => { setShowRecipeModal(false); setEditingRecipe(null); await fetchData(); }}
        />
      )}

      {recipeToProduce && (
        <ProductionRunModal
          tenant={tenant}
          recipe={recipeToProduce}
          inventoryItems={inventoryItems}
          onClose={() => setRecipeToProduce(null)}
          onSaved={async () => { setRecipeToProduce(null); await fetchData(); }}
        />
      )}

      {selectedRun && (
        <ProductionRunDetailsModal run={selectedRun} onClose={() => setSelectedRun(null)} />
      )}

      <ConfirmModal
        isOpen={!!recipeToDelete}
        title="Excluir receita"
        message={`Deseja excluir a receita "${recipeToDelete?.name}"? O histórico de produções anteriores será preservado.`}
        confirmLabel="Excluir"
        variant="danger"
        loading={deleting}
        onConfirm={async () => {
          if (!recipeToDelete) return;
          setDeleting(true);
          try {
            await apiJson(`/api/tenants/${tenant.slug}/production/recipes/${recipeToDelete.id}`, { method: "DELETE" });
            if (selectedRecipe?.id === recipeToDelete.id) setSelectedRecipe(null);
            setRecipeToDelete(null);
            await fetchData();
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Falha ao excluir receita.");
          } finally {
            setDeleting(false);
          }
        }}
        onClose={() => setRecipeToDelete(null)}
      />
    </div>
    </PageWrapper>
  );
}

function SummaryTile({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 break-words text-[11px] text-slate-500">{label}</p>
        <div className="rounded-lg bg-white p-2 text-blue-600 border border-slate-200">{icon}</div>
      </div>
      <p className="mt-3 break-words text-base font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-3">
      <p className="break-words text-[11px] text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function UnitCombobox({
  label,
  value,
  onChange,
  placeholder = "Selecione a unidade",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <Combobox
        options={PRODUCTION_UNIT_OPTIONS}
        value={value}
        onChange={(nextValue) => onChange(String(Array.isArray(nextValue) ? nextValue[0] || "" : nextValue || ""))}
        placeholder={placeholder}
        searchPlaceholder="Buscar unidade..."
        allowCustom
        onCustomAdd={(customValue) => onChange(customValue)}
        size="sm"
        emptyMessage="Nenhuma unidade encontrada."
      />
    </div>
  );
}

async function handleDuplicateRecipe(slug: string, recipe: ProductionRecipe, refresh: () => Promise<void>, onError: (message: string) => void) {
  try {
    await apiJson(`/api/tenants/${slug}/production/recipes`, {
      method: "POST",
      body: JSON.stringify({
        name: `${recipe.name} (cópia)`,
        description: recipe.description || "",
        productId: null,
        outputQuantity: recipe.outputQuantity,
        outputUnit: recipe.outputUnit,
        instructions: recipe.instructions || "",
        active: recipe.active,
        ingredients: recipe.ingredients.map((i) => ({ ...i, id: undefined })),
        overheads: recipe.overheads.map((o) => ({ ...o, id: undefined })),
      }),
    });
    await refresh();
  } catch (error) {
    onError(error instanceof Error ? error.message : "Falha ao duplicar receita.");
  }
}


function RecipeEditorModal({
  tenant,
  inventoryItems,
  products,
  recipe,
  onClose,
  onSaved,
}: {
  tenant: Tenant;
  inventoryItems: InventoryItem[];
  products: Product[];
  recipe: ProductionRecipe | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const toast = useToast();
  const [name, setName] = useState(recipe?.name || "");
  const [description, setDescription] = useState(recipe?.description || "");
  const [productId, setProductId] = useState(recipe?.productId || "");
  const [outputQuantity, setOutputQuantity] = useState(String(recipe?.outputQuantity || 1));
  const [outputUnit, setOutputUnit] = useState(recipe?.outputUnit || "un");
  const [instructions, setInstructions] = useState(recipe?.instructions || "");
  const [active, setActive] = useState(recipe?.active ?? true);
  const [ingredients, setIngredients] = useState<ProductionRecipeIngredient[]>(
    recipe?.ingredients?.length
      ? recipe.ingredients
      : [{ id: createRowId("ingredient"), inventoryItemId: "", itemName: "", quantity: 0, unit: "g", notes: "" }],
  );
  const [overheads, setOverheads] = useState<ProductionRecipeOverhead[]>(recipe?.overheads || []);
  const [saving, setSaving] = useState(false);
  const [editorTab, setEditorTab] = useState<EditorTab>("base");

  const inventoryMap = new Map(inventoryItems.map((item) => [item.id, item]));

  const addIngredient = () => {
    setIngredients((current) => [
      ...current,
      { id: createRowId("ingredient"), inventoryItemId: "", itemName: "", quantity: 0, unit: "g", notes: "" },
    ]);
  };

  const addOverhead = () => {
    setOverheads((current) => [
      ...current,
      { id: createRowId("overhead"), label: "", type: "ENERGIA", cost: 0, calculationMode: "PER_RECIPE", notes: "" },
    ]);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !(Number(outputQuantity) > 0)) {
      setEditorTab("base");
      toast.error("Informe o nome da receita e um rendimento base válido.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name,
        description,
        productId: productId || null,
        outputQuantity: Number(outputQuantity),
        outputUnit,
        instructions,
        active,
        ingredients: ingredients.map((ingredient) => ({
          ...ingredient,
          quantity: Number(ingredient.quantity),
          itemName: inventoryMap.get(ingredient.inventoryItemId)?.name || ingredient.itemName,
        })),
        overheads: overheads.map((overhead) => ({ ...overhead, cost: Number(overhead.cost) })),
      };

      await apiJson<ProductionRecipe>(
        recipe
          ? `/api/tenants/${tenant.slug}/production/recipes/${recipe.id}`
          : `/api/tenants/${tenant.slug}/production/recipes`,
        { method: recipe ? "PATCH" : "POST", body: JSON.stringify(payload) },
      );

      await onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar receita.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={recipe ? "Editar Ficha Técnica" : "Nova Ficha Técnica"}
      size="2xl"
      mobileStyle="fullscreen"
      footer={(
        <ModalFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="primary" type="submit" form="production-recipe-form" loading={saving}>
            {recipe ? "Salvar Alterações" : "Criar Receita"}
          </Button>
        </ModalFooter>
      )}
    >
      <form id="production-recipe-form" onSubmit={handleSubmit} className="space-y-6">
        <Tabs items={EDITOR_TABS} value={editorTab} onChange={(v) => setEditorTab(v as EditorTab)} label="Seções da ficha técnica">
        {editorTab === "base" && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Identificação da receita</p>
              <p className="text-[11px] text-slate-500">Dê nome, descreva o rendimento e vincule ao produto final do cardápio.</p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <span className="text-[11px] font-medium text-slate-500">Ativa</span>
              <Switch checked={active} onCheckedChange={setActive} size="sm" />
            </div>
          </div>
          <div className="mt-4 space-y-4">
            <Input label="Nome da receita" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Bolo de cenoura premium" required />
            <Textarea label="Descrição" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Explique o que esta produção gera, em que contexto é usada e qual o padrão desejado." />
            <FormRow cols={3}>
              <Select label="Produto vinculado" value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">Sem vínculo automático</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>{product.name}</option>
                ))}
              </Select>
              <Input label="Rendimento base" type="number" min="0.001" step="0.001" value={outputQuantity} onChange={(e) => setOutputQuantity(e.target.value)} required />
              <UnitCombobox label={`Unidade (${PRODUCTION_UNIT_SUGGESTIONS.join(", ")})`} value={outputUnit} onChange={setOutputUnit} />
            </FormRow>
          </div>
        </div>
        )}

        {editorTab === "ingredients" && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Insumos e consumo</p>
              <p className="text-[11px] text-slate-500">Use a unidade da receita e o sistema converte para a unidade cadastrada no estoque.</p>
            </div>
            <Button type="button" variant="outline" size="sm" iconLeft={<Plus className="h-4 w-4" />} onClick={addIngredient}>
              Adicionar Insumo
            </Button>
          </div>
          <div className="mt-4 space-y-4">
            {ingredients.map((ingredient, index) => {
              const stockItem = inventoryMap.get(ingredient.inventoryItemId);
              return (
                <div key={ingredient.id} className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">Insumo {index + 1}</p>
                    {ingredients.length > 1 && (
                      <IconButton type="button" size="sm" variant="ghost" aria-label="Remover insumo" className="text-red-600 hover:text-red-700" onClick={() => setIngredients((current) => current.filter((row) => row.id !== ingredient.id))}>
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    )}
                  </div>
                  <div className="mt-4 space-y-4">
                    <FormRow cols={3}>
                      <Select
                        label="Item do estoque"
                        value={ingredient.inventoryItemId}
                        onChange={(e) => {
                          const item = inventoryMap.get(e.target.value);
                          setIngredients((current) =>
                            current.map((row) =>
                              row.id === ingredient.id
                                ? { ...row, inventoryItemId: e.target.value, itemName: item?.name || "", unit: item?.unit || row.unit || "g" }
                                : row,
                            ),
                          );
                        }}
                      >
                        <option value="">Selecione...</option>
                        {inventoryItems.map((item) => (
                          <option key={item.id} value={item.id}>{item.name} • {formatQuantity(item.quantity, item.unit)}</option>
                        ))}
                      </Select>
                      <Input
                        label="Quantidade na receita"
                        type="number"
                        min="0.001"
                        step="0.001"
                        value={String(ingredient.quantity)}
                        onChange={(e) =>
                          setIngredients((current) =>
                            current.map((row) => row.id === ingredient.id ? { ...row, quantity: Number(e.target.value) } : row),
                          )
                        }
                      />
                      <UnitCombobox
                        label="Unidade da receita"
                        value={ingredient.unit}
                        onChange={(nextUnit) =>
                          setIngredients((current) =>
                            current.map((row) => row.id === ingredient.id ? { ...row, unit: nextUnit } : row),
                          )
                        }
                      />
                    </FormRow>
                    <Textarea
                      label="Observação do insumo"
                      value={String(ingredient.notes || "")}
                      onChange={(e) =>
                        setIngredients((current) =>
                          current.map((row) => row.id === ingredient.id ? { ...row, notes: e.target.value } : row),
                        )
                      }
                      placeholder="Ex.: peneirar antes de misturar, bater separado, reservar para cobertura..."
                    />
                    {stockItem && (
                      <div className="rounded-lg border border-slate-200 bg-white p-3 text-[11px] text-slate-600">
                        Estoque atual: <strong>{formatQuantity(stockItem.quantity, stockItem.unit)}</strong> •
                        custo unitário: <strong>{formatCurrency(stockItem.purchasePrice || 0)}</strong>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        )}

        {editorTab === "overheads" && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Custos indiretos</p>
              <p className="text-[11px] text-slate-500">Cadastre energia, água, gás, mão de obra, embalagem e demais despesas de produção.</p>
            </div>
            <Button type="button" variant="outline" size="sm" iconLeft={<Plus className="h-4 w-4" />} onClick={addOverhead}>
              Adicionar Custo
            </Button>
          </div>
          <div className="mt-4 space-y-4">
            {overheads.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-sm text-slate-500">
                Nenhum custo adicional cadastrado ainda.
              </div>
            ) : (
              overheads.map((overhead, index) => (
                <div key={overhead.id} className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">Custo {index + 1}</p>
                    <IconButton type="button" size="sm" variant="ghost" aria-label="Remover custo" className="text-red-600 hover:text-red-700" onClick={() => setOverheads((current) => current.filter((row) => row.id !== overhead.id))}>
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
                  <div className="mt-4 space-y-4">
                    <FormRow cols={2}>
                      <Input
                        label="Descrição"
                        value={overhead.label}
                        onChange={(e) => setOverheads((current) => current.map((row) => row.id === overhead.id ? { ...row, label: e.target.value } : row))}
                        placeholder="Ex.: gás do forno, embalagem premium..."
                      />
                      <Input
                        label="Valor"
                        type="number"
                        min="0"
                        step="0.01"
                        value={String(overhead.cost)}
                        onChange={(e) => setOverheads((current) => current.map((row) => row.id === overhead.id ? { ...row, cost: Number(e.target.value) } : row))}
                      />
                    </FormRow>
                    <FormRow cols={2}>
                      <Select
                        label="Categoria"
                        value={overhead.type}
                        onChange={(e) => setOverheads((current) => current.map((row) => row.id === overhead.id ? { ...row, type: e.target.value as ProductionOverheadType } : row))}
                      >
                        {PRODUCTION_OVERHEAD_TYPE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </Select>
                      <Select
                        label="Aplicação"
                        value={overhead.calculationMode}
                        onChange={(e) => setOverheads((current) => current.map((row) => row.id === overhead.id ? { ...row, calculationMode: e.target.value as ProductionRecipeOverhead["calculationMode"] } : row))}
                      >
                        {PRODUCTION_OVERHEAD_MODE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </Select>
                    </FormRow>
                    <Textarea
                      label="Observação"
                      value={String(overhead.notes || "")}
                      onChange={(e) => setOverheads((current) => current.map((row) => row.id === overhead.id ? { ...row, notes: e.target.value } : row))}
                      placeholder="Ex.: custo médio por fornada, embalagem usada apenas em pedidos especiais..."
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        )}

        {editorTab === "instructions" && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
          <p className="text-sm font-semibold text-slate-900">Modo de preparo / padrão</p>
          <p className="text-[11px] text-slate-500">Registre o processo para reproduzir a mesma produção com consistência.</p>
          <Textarea
            className="mt-4 min-h-[160px]"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Descreva etapas, tempos, temperaturas, ordem de mistura, peso final, acabamento e cuidados de execução."
          />
        </div>
        )}
        </Tabs>
      </form>
    </Modal>
  );
}

function ProductionRunModal({
  tenant,
  recipe,
  inventoryItems,
  onClose,
  onSaved,
}: {
  tenant: Tenant;
  recipe: ProductionRecipe;
  inventoryItems: InventoryItem[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const toast = useToast();
  const [quantityProduced, setQuantityProduced] = useState(String(recipe.outputQuantity || 1));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const simulation = calculateProductionSimulation({
    recipe,
    inventoryItems,
    quantityProduced: Number(quantityProduced) || recipe.outputQuantity || 1,
    linkedProduct: recipe.product || null,
  });

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await apiJson<ProductionRun>(`/api/tenants/${tenant.slug}/production/runs`, {
        method: "POST",
        body: JSON.stringify({ recipeId: recipe.id, quantityProduced: Number(quantityProduced), notes }),
      });
      await onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao registrar produção.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Registrar Produção • ${recipe.name}`}
      size="xl"
      mobileStyle="bottom-sheet"
      footer={(
        <ModalFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="primary" type="submit" form="production-run-form" loading={saving} disabled={simulation.missingItems > 0}>
            Confirmar Produção
          </Button>
        </ModalFooter>
      )}
    >
      <form id="production-run-form" onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge color="info">{formatQuantity(recipe.outputQuantity, recipe.outputUnit)} por receita</Badge>
            {recipe.product && <Badge color="primary">{recipe.product.name}</Badge>}
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Input
              label="Quantidade a produzir"
              type="number"
              min="0.001"
              step="0.001"
              value={quantityProduced}
              onChange={(e) => setQuantityProduced(e.target.value)}
              addonRight={recipe.outputUnit}
            />
            <Textarea
              label="Observação do lote"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex.: produção para sexta à noite, lote teste, encomenda especial..."
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <SummaryTile label="Insumos" value={formatCurrency(simulation.totalIngredientCost)} icon={<Package className="h-4 w-4" />} />
          <SummaryTile label="Custos indiretos" value={formatCurrency(simulation.totalOverheadCost)} icon={<CircleDollarSign className="h-4 w-4" />} />
          <SummaryTile label="Custo total" value={formatCurrency(simulation.totalCost)} icon={<ChefHat className="h-4 w-4" />} />
          <SummaryTile label="CMV unitário" value={formatCurrency(simulation.costPerOutput)} icon={<Factory className="h-4 w-4" />} />
        </div>

        {simulation.missingItems > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
              <div>
                <p className="text-sm font-semibold text-amber-900">Produção bloqueada até ajustar o estoque</p>
                <p className="mt-1 text-[11px] leading-relaxed text-amber-700">
                  Há insumos com saldo insuficiente ou unidade incompatível. Corrija o estoque antes de confirmar.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {simulation.ingredients.map((ingredient) => (
            <div
              key={ingredient.id}
              className={`rounded-lg border p-4 ${ingredient.available ? "border-emerald-100 bg-emerald-50/40" : "border-amber-200 bg-amber-50/70"}`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{ingredient.itemName}</p>
                  <p className="text-[11px] text-slate-500">
                    {formatQuantity(ingredient.requestedQuantity, ingredient.unit)}
                    {ingredient.convertedQuantity !== null ? ` • baixa ${formatQuantity(ingredient.convertedQuantity, ingredient.inventoryUnit)}` : ""}
                  </p>
                  {ingredient.message && <p className="mt-1 text-[11px] font-semibold text-amber-700">{ingredient.message}</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">{formatCurrency(ingredient.totalCost)}</p>
                  <p className="text-[11px] text-slate-500">saldo após: {formatQuantity(ingredient.stockAfter, ingredient.inventoryUnit)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </form>
    </Modal>
  );
}

function ProductionRunDetailsModal({ run, onClose }: { run: ProductionRun; onClose: () => void }) {
  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Detalhes do lote ${run.batchCode}`}
      size="xl"
      mobileStyle="fullscreen"
      footer={(
        <ModalFooter>
          <Button variant="primary" onClick={onClose}>Fechar</Button>
        </ModalFooter>
      )}
    >
      <div className="space-y-5">
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <p className="break-words text-base font-semibold text-slate-900">{run.recipeName}</p>
              <p className="mt-1 text-sm text-slate-500">
                Produzido em {formatDateTime(run.createdAt)}{run.createdByName ? ` por ${run.createdByName}` : ""}
              </p>
              {run.notes && (
                <p className="mt-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">{run.notes}</p>
              )}
            </div>
            <div className="grid w-full gap-3 shrink-0 md:w-[260px]">
              <MetricPill label="Produzido" value={formatQuantity(run.quantityProduced, run.unit)} />
              <MetricPill label="Custo total" value={formatCurrency(run.totalCost)} />
              <MetricPill label="CMV unitário" value={formatCurrency(run.costPerOutput)} />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-900">Consumo registrado</p>
          {run.ingredientsSnapshot.map((ingredient) => (
            <div key={ingredient.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-1">
                  <p className="break-words text-sm font-semibold text-slate-900">{ingredient.itemName}</p>
                  <p className="text-[11px] text-slate-500">
                    Receita: {formatQuantity(ingredient.requestedQuantity, ingredient.unit)}
                    {ingredient.convertedQuantity !== null ? ` • baixa real ${formatQuantity(ingredient.convertedQuantity, ingredient.inventoryUnit)}` : ""}
                  </p>
                </div>
                <div className="grid w-full grid-cols-2 gap-3 shrink-0 lg:w-[240px]">
                  <MetricPill label="Antes" value={formatQuantity(ingredient.stockBefore, ingredient.inventoryUnit)} />
                  <MetricPill label="Depois" value={formatQuantity(ingredient.stockAfter, ingredient.inventoryUnit)} />
                  <MetricPill label="Custo unitário" value={formatCurrency(ingredient.unitCost)} />
                  <MetricPill label="Custo consumido" value={formatCurrency(ingredient.totalCost)} />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-900">Custos indiretos aplicados</p>
          {run.overheadsSnapshot.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-sm text-slate-500">
              Nenhum custo indireto foi aplicado neste lote.
            </div>
          ) : (
            run.overheadsSnapshot.map((overhead) => {
              const accent = getOverheadAccent(overhead.type);
              return (
                <div key={overhead.id} className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <Badge color={accent.color} icon={accent.icon}>{overhead.label}</Badge>
                    <p className="text-[11px] text-slate-500">
                      {overhead.calculationMode === "PER_OUTPUT_UNIT" ? "Aplicado por unidade produzida" : "Aplicado pela receita base"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">{formatCurrency(overhead.totalCost)}</p>
                    <p className="text-[11px] text-slate-500">Base {formatCurrency(overhead.cost)}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {run.outputSnapshot && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Entrada do produto final</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <MetricPill label="Produção registrada" value={formatQuantity(run.outputSnapshot.requestedQuantity, run.outputSnapshot.requestedUnit)} />
              <MetricPill
                label="Entrada no estoque"
                value={run.outputSnapshot.convertedQuantity !== null
                  ? formatQuantity(run.outputSnapshot.convertedQuantity, run.outputSnapshot.inventoryUnit)
                  : "Não aplicada"}
              />
            </div>
            {run.outputSnapshot.stockAfter !== undefined && run.outputSnapshot.stockAfter !== null && (
              <div className="mt-3">
                <MetricPill label="Saldo final do item" value={formatQuantity(run.outputSnapshot.stockAfter, run.outputSnapshot.inventoryUnit)} />
              </div>
            )}
            {run.outputSnapshot.message && (
              <p className="mt-3 text-[11px] font-semibold text-amber-700">{run.outputSnapshot.message}</p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
