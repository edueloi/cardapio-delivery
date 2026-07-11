import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  AlertCircle,
  ArrowRightLeft,
  Bell,
  Building2,
  ChefHat,
  CheckCircle,
  CheckCircle2,
  Clock,
  Clock3,
  CreditCard,
  Edit3,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Info,
  MapPin,
  Package,
  Plus,
  QrCode,
  Ruler,
  Save,
  Settings,
  Smartphone,
  Store,
  Trash2,
  Truck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import {
  Button,
  ContentCard,
  Input,
  Modal,
  ModalFooter,
  Switch,
  useToast,
} from "../../../../components";
import { apiFetch, apiJson } from "../../../../lib/api";
import { DeliveryZone, KmRange, PaymentConfig, Tenant } from "../../../../types";

export const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

const MAX_UPLOAD_SIZE_MB = 5;

export function ImageUploader({ value, onChange, label, description }: { value: string, onChange: (val: string) => void, label: string, description?: string }) {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite selecionar o mesmo arquivo de novo depois de um erro
    if (!file) return;

    if (file.size > MAX_UPLOAD_SIZE_MB * 1024 * 1024) {
      toast.error(`Imagem muito grande (máx. ${MAX_UPLOAD_SIZE_MB}MB). Escolha um arquivo menor.`);
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await apiFetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        if (res.status === 413) throw new Error(`Imagem muito grande (máx. ${MAX_UPLOAD_SIZE_MB}MB).`);
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Erro ao enviar imagem.");
      }
      const data = await res.json();
      if (data.url) {
        onChange(data.url);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao enviar imagem");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">{label}</label>
      <div className="flex flex-col sm:flex-row items-start gap-4">
        <div className="relative w-24 h-24 rounded-3xl bg-slate-100 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden group shrink-0 shadow-inner">
          {uploading ? (
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          ) : value ? (
            <>
              <img src={value} className="w-full h-full object-cover" alt="Preview" />
              <div 
                onClick={() => onChange("")}
                className="absolute inset-0 bg-red-600/80 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer group"
              >
                <div className="flex flex-col items-center gap-1">
                   <Trash2 className="w-5 h-5" />
                   <span className="text-[8px] font-black uppercase tracking-widest">Remover</span>
                </div>
              </div>
            </>
          ) : (
            <label className="cursor-pointer flex flex-col items-center gap-1 w-full h-full justify-center hover:bg-slate-50 transition-colors">
              <ImageIcon className="w-6 h-6 text-slate-300" />
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Upload</span>
              <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
            </label>
          )}
        </div>
        <div className="flex-1 py-1">
           <p className="text-[10px] text-slate-400 font-medium italic leading-tight">
              {description || "Escolha uma imagem do seu dispositivo para carregar. Formatos aceitos: PNG, JPG, WEBP."}
           </p>
           <p className="text-[9px] text-slate-300 font-medium leading-tight mt-1">
              Recomendado: imagem quadrada (ex: 500x500px), máximo {MAX_UPLOAD_SIZE_MB}MB.
           </p>
           {value && (
              <div className="mt-2 text-[9px] bg-green-50 text-green-600 font-black uppercase tracking-widest px-2 py-0.5 rounded-full w-fit flex items-center gap-1">
                 <CheckCircle2 className="w-3 h-3" />
                 Imagem Carregada
              </div>
           )}
        </div>
      </div>
    </div>
  );
}

// Miniatura de upload compacta pra foto de variante (tamanho/sabor) — mesmo endpoint
// do ImageUploader de produto, mas sem label/descrição pra caber numa linha de formulário.
export function VariantImageUploader({ value, onChange }: { value: string, onChange: (val: string) => void }) {
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
    formData.append('file', file);

    try {
      const res = await apiFetch('/api/upload', { method: 'POST', body: formData });
      if (!res.ok) {
        if (res.status === 413) throw new Error(`Imagem muito grande (máx. ${MAX_UPLOAD_SIZE_MB}MB).`);
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Erro ao enviar imagem.");
      }
      const data = await res.json();
      if (data.url) onChange(data.url);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao enviar imagem");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="relative w-11 h-11 rounded-lg bg-slate-100 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden group shrink-0">
      {uploading ? (
        <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      ) : value ? (
        <>
          <img src={value} className="w-full h-full object-cover" alt="Preview" />
          <div
            onClick={() => onChange("")}
            className="absolute inset-0 bg-red-600/80 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </div>
        </>
      ) : (
        <label className="cursor-pointer flex items-center justify-center w-full h-full hover:bg-slate-50 transition-colors">
          <ImageIcon className="w-4 h-4 text-slate-300" />
          <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
        </label>
      )}
    </div>
  );
}

// Aviso sobre a impressora térmica — só aparece dentro do app desktop Electron
// (window.pdvDesktop). A configuração em si (escolher impressora, testar) é feita numa
// janela própria do app, aberta com F9 — não dá pra chegar nela pelo navegador porque o
// app roda em modo kiosk (tela cheia, sem barra/menu).
export function DesktopPrinterSettings() {
  const desktop = typeof window !== "undefined" ? (window as any).pdvDesktop : null;
  if (!desktop) return null;

  return (
    <div className="pt-5 border-t border-zinc-100">
      <p className="text-sm font-black text-slate-900">Impressora Térmica (App Desktop)</p>
      <p className="text-xs text-slate-500 mt-1">
        Aperte <kbd className="px-1.5 py-0.5 bg-zinc-100 rounded font-black text-slate-600">F9</kbd> no app desktop para escolher a impressora e testar a impressão direta (sem diálogo do navegador).
      </p>
    </div>
  );
}

// Modal de vínculo de estoque
export function InventoryLinkField({
  inventoryItems,
  value,
  onChange,
  autoDisable,
  onAutoDisableChange,
  allCategories,
  editingProductId,
}: {
  inventoryItems: any[];
  value: string;
  onChange: (val: string) => void;
  autoDisable: boolean;
  onAutoDisableChange: (val: boolean) => void;
  allCategories: any[];
  editingProductId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Apenas itens de VENDA (não uso interno)
  const saleItems = inventoryItems.filter(item => item.usage !== 'INTERNAL');

  // Verifica quais itens já estão vinculados a outros produtos (exceto o editando)
  const allProducts = allCategories.flatMap((c: any) => c.products || []);
  const usedItemIds = new Set(
    allProducts
      .filter((p: any) => p.id !== editingProductId && p.inventoryItemId)
      .map((p: any) => p.inventoryItemId)
  );

  const selectedItem = saleItems.find(i => i.id === value);

  const filtered = saleItems.filter(item =>
    !search || item.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-2">
      <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400">Vincular ao estoque (opcional)</label>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between gap-3 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm font-bold text-left hover:border-amber-300 hover:bg-amber-50/30 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-400"
      >
        {selectedItem ? (
          <div className="flex-1 min-w-0">
            <span className="text-slate-800 truncate block">{selectedItem.name}</span>
            <span className={`text-[10px] font-black uppercase ${selectedItem.quantity <= 0 ? "text-red-500" : selectedItem.quantity < 5 ? "text-amber-500" : "text-green-600"}`}>
              {selectedItem.quantity <= 0 ? "Esgotado" : `${selectedItem.quantity} ${selectedItem.unit || 'un'}`}
            </span>
          </div>
        ) : (
          <span className="text-slate-400">Sem vínculo de estoque</span>
        )}
        <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>

      {value && (
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input type="checkbox" checked={autoDisable} onChange={e => onAutoDisableChange(e.target.checked)} className="w-4 h-4 rounded accent-amber-500" />
          <span className="text-xs font-semibold text-slate-600">Desativar automaticamente quando o estoque zerar</span>
        </label>
      )}

      {saleItems.length === 0 && (
        <p className="text-[11px] text-slate-400 italic">Nenhum item de venda cadastrado no estoque.</p>
      )}

      {/* Modal de seleção */}
      <Modal isOpen={open} onClose={() => { setOpen(false); setSearch(""); }} title="Vincular ao Estoque" size="md" mobileStyle="bottom-sheet"
        footer={<ModalFooter><Button variant="ghost" onClick={() => { onChange(""); setOpen(false); setSearch(""); }}>Remover vínculo</Button><Button variant="outline" onClick={() => { setOpen(false); setSearch(""); }}>Fechar</Button></ModalFooter>}
      >
        <div className="space-y-3 p-1">
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar item..."
            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); setSearch(""); }}
              className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-left transition-colors ${!value ? "bg-amber-50 border border-amber-200 text-amber-800" : "hover:bg-slate-50 text-slate-500"}`}
            >
              Sem vínculo de estoque
            </button>
            {filtered.map((item: any) => {
              const alreadyUsed = usedItemIds.has(item.id);
              const isSelected = value === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={alreadyUsed && !isSelected}
                  onClick={() => { onChange(item.id); setOpen(false); setSearch(""); }}
                  className={`w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm text-left transition-colors ${
                    isSelected ? "bg-amber-50 border border-amber-200" :
                    alreadyUsed ? "opacity-50 cursor-not-allowed bg-slate-50" :
                    "hover:bg-slate-50 border border-transparent"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-800 truncate">{item.name}</p>
                    <p className={`text-[10px] font-black uppercase ${item.quantity <= 0 ? "text-red-500" : item.quantity < 5 ? "text-amber-500" : "text-green-600"}`}>
                      {item.quantity <= 0 ? "Esgotado" : `${item.quantity} ${item.unit || 'un'}`}
                    </p>
                    {alreadyUsed && !isSelected && <p className="text-[10px] text-slate-400 font-semibold">Já vinculado a outro produto</p>}
                  </div>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-center text-sm text-slate-400 py-6">Nenhum item encontrado</p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Modal de vínculo de produção
export function ProductionLinkField({
  recipes,
  value,
  onChange,
  allCategories,
  editingProductId,
}: {
  recipes: any[];
  value: string;
  onChange: (val: string) => void;
  allCategories: any[];
  editingProductId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const activeRecipes = recipes.filter((r: any) => r.active);

  // Verifica quais receitas já estão vinculadas a outros produtos
  const allProducts = allCategories.flatMap((c: any) => c.products || []);
  const usedRecipeIds = new Set(
    allProducts
      .filter((p: any) => p.id !== editingProductId && p.recipeId)
      .map((p: any) => p.recipeId)
  );

  const selectedRecipe = activeRecipes.find((r: any) => r.id === value);

  const filtered = activeRecipes.filter((r: any) =>
    !search || r.name.toLowerCase().includes(search.toLowerCase())
  );

  if (activeRecipes.length === 0) return null;

  return (
    <div className="space-y-2">
      <label className="block text-[11px] font-black uppercase tracking-widest text-orange-600">Vincular à produção (opcional)</label>
      <p className="text-[11px] text-slate-500 -mt-1">Ao vender, os insumos da receita são descontados do estoque automaticamente.</p>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between gap-3 bg-orange-50/60 border border-orange-200 rounded-xl px-3 py-2.5 text-sm font-bold text-left hover:border-orange-300 hover:bg-orange-50 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400"
      >
        {selectedRecipe ? (
          <div className="flex-1 min-w-0">
            <span className="text-slate-800 truncate block">{selectedRecipe.name}</span>
            <span className="text-[10px] text-orange-600 font-semibold">Rende {selectedRecipe.outputQuantity} {selectedRecipe.outputUnit}</span>
          </div>
        ) : (
          <span className="text-slate-400">Sem vínculo de produção</span>
        )}
        <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
      </button>

      {selectedRecipe && (
        <div className="rounded-xl border border-orange-200 bg-white px-3 py-2 text-[11px] text-orange-800 space-y-1">
          <p className="font-black">📋 {selectedRecipe.name}</p>
          <p className="text-orange-600">A cada <b>1 unidade</b> vendida, o sistema desconta <b>1/{selectedRecipe.outputQuantity} {selectedRecipe.outputUnit}</b> dos insumos.</p>
          {selectedRecipe.ingredients?.length > 0 && (
            <p className="text-orange-500">Insumos: {selectedRecipe.ingredients.map((i: any) => i.itemName).join(", ")}</p>
          )}
        </div>
      )}

      {/* Modal de seleção */}
      <Modal isOpen={open} onClose={() => { setOpen(false); setSearch(""); }} title="Vincular à Produção" size="md" mobileStyle="bottom-sheet"
        footer={<ModalFooter><Button variant="ghost" onClick={() => { onChange(""); setOpen(false); setSearch(""); }}>Remover vínculo</Button><Button variant="outline" onClick={() => { setOpen(false); setSearch(""); }}>Fechar</Button></ModalFooter>}
      >
        <div className="space-y-3 p-1">
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar receita..."
            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false); setSearch(""); }}
              className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-left transition-colors ${!value ? "bg-orange-50 border border-orange-200 text-orange-800" : "hover:bg-slate-50 text-slate-500"}`}
            >
              Sem vínculo de produção
            </button>
            {filtered.map((recipe: any) => {
              const alreadyUsed = usedRecipeIds.has(recipe.id);
              const isSelected = value === recipe.id;
              return (
                <button
                  key={recipe.id}
                  type="button"
                  disabled={alreadyUsed && !isSelected}
                  onClick={() => { onChange(recipe.id); setOpen(false); setSearch(""); }}
                  className={`w-full flex items-start justify-between gap-3 rounded-xl px-3 py-2.5 text-sm text-left transition-colors ${
                    isSelected ? "bg-orange-50 border border-orange-200" :
                    alreadyUsed ? "opacity-50 cursor-not-allowed bg-slate-50" :
                    "hover:bg-slate-50 border border-transparent"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-800">{recipe.name}</p>
                    <p className="text-[10px] text-orange-600 font-semibold">Rende {recipe.outputQuantity} {recipe.outputUnit}</p>
                    {recipe.ingredients?.length > 0 && (
                      <p className="text-[10px] text-slate-400 truncate">Insumos: {recipe.ingredients.map((i: any) => i.itemName).join(", ")}</p>
                    )}
                    {alreadyUsed && !isSelected && <p className="text-[10px] text-slate-400 font-semibold">Já vinculado a outro produto</p>}
                  </div>
                  {isSelected && <CheckCircle2 className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-center text-sm text-slate-400 py-6">Nenhuma receita encontrada</p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

export interface RecipeIngredientDraft {
  _key: string;
  inventoryItemId: string;
  quantity: string;
  unit: string;
}

const RECIPE_UNIT_OPTIONS = ["g", "kg", "ml", "l", "un", "dz", "cm", "m"];

// Lista simples de insumos que o produto consome ao ser vendido — cada item do
// estoque pode ter sua própria quantidade e unidade (100g de frango, 1un de espeto,
// 10g de sal...). Some tudo isso vira uma ProductionRecipe por trás, mas o usuário
// não precisa saber disso nem entender "rendimento" — a dedução já é automática na venda.
export function RecipeIngredientsField({
  inventoryItems,
  value,
  onChange,
}: {
  inventoryItems: any[];
  value: RecipeIngredientDraft[];
  onChange: (val: RecipeIngredientDraft[]) => void;
}) {
  const [pickerOpenFor, setPickerOpenFor] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const saleItems = inventoryItems;
  const itemById = new Map(saleItems.map((item: any) => [item.id, item]));

  const addIngredient = () => {
    const draft: RecipeIngredientDraft = {
      _key: crypto.randomUUID(),
      inventoryItemId: "",
      quantity: "",
      unit: "un",
    };
    onChange([...value, draft]);
    setPickerOpenFor(draft._key);
  };

  const updateIngredient = (key: string, patch: Partial<RecipeIngredientDraft>) => {
    onChange(value.map(ing => ing._key === key ? { ...ing, ...patch } : ing));
  };

  const removeIngredient = (key: string) => {
    onChange(value.filter(ing => ing._key !== key));
  };

  const filtered = saleItems.filter((item: any) =>
    !search || item.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-2">
      <label className="block text-[11px] font-black uppercase tracking-widest text-orange-600">Insumos usados (opcional)</label>
      <p className="text-[11px] text-slate-500 -mt-1">Ao vender este produto, as quantidades abaixo são descontadas do estoque automaticamente.</p>

      <div className="space-y-2">
        {value.map(ing => {
          const item = itemById.get(ing.inventoryItemId);
          return (
            <div key={ing._key} className="flex items-center gap-2 bg-orange-50/60 border border-orange-200 rounded-xl px-2.5 py-2">
              <button
                type="button"
                onClick={() => { setPickerOpenFor(ing._key); setSearch(""); }}
                className="flex-1 min-w-0 text-left text-sm font-bold text-slate-800 truncate hover:text-orange-600"
              >
                {item ? item.name : <span className="text-slate-400 font-semibold">Escolher item do estoque...</span>}
              </button>
              <input
                type="number"
                inputMode="decimal"
                placeholder="Qtd"
                value={ing.quantity}
                onChange={e => updateIngredient(ing._key, { quantity: e.target.value })}
                className="w-16 bg-white border border-orange-200 rounded-lg px-2 py-1.5 text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
              <select
                value={ing.unit}
                onChange={e => updateIngredient(ing._key, { unit: e.target.value })}
                className="bg-white border border-orange-200 rounded-lg px-1.5 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                {RECIPE_UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <button
                type="button"
                onClick={() => removeIngredient(ing._key)}
                className="p-1.5 text-slate-400 hover:text-red-500 shrink-0"
                title="Remover insumo"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={addIngredient}
        className="w-full flex items-center justify-center gap-1.5 border-2 border-dashed border-orange-200 rounded-xl px-3 py-2 text-xs font-black uppercase tracking-wide text-orange-600 hover:bg-orange-50 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" /> Adicionar insumo
      </button>

      {saleItems.length === 0 && (
        <p className="text-[11px] text-slate-400 italic">Nenhum item cadastrado no estoque ainda.</p>
      )}

      {/* Modal de seleção do item de estoque para o insumo sendo editado */}
      <Modal
        isOpen={!!pickerOpenFor}
        onClose={() => { setPickerOpenFor(null); setSearch(""); }}
        title="Escolher item do estoque"
        size="md"
        mobileStyle="bottom-sheet"
        footer={<ModalFooter><Button variant="outline" onClick={() => { setPickerOpenFor(null); setSearch(""); }}>Fechar</Button></ModalFooter>}
      >
        <div className="space-y-3 p-1">
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar item..."
            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {filtered.map((item: any) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (pickerOpenFor) {
                    updateIngredient(pickerOpenFor, {
                      inventoryItemId: item.id,
                      unit: item.stockUnit || item.unit || "un",
                    });
                  }
                  setPickerOpenFor(null);
                  setSearch("");
                }}
                className="w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm text-left hover:bg-slate-50 border border-transparent transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-black text-slate-800 truncate">{item.name}</p>
                  <p className={`text-[10px] font-black uppercase ${item.quantity <= 0 ? "text-red-500" : item.quantity < 5 ? "text-amber-500" : "text-green-600"}`}>
                    {item.quantity <= 0 ? "Esgotado" : `${item.quantity} ${item.unit || 'un'}`}
                  </p>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-sm text-slate-400 py-6">Nenhum item encontrado</p>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

export const DAY_KEYS_UI = ["sun","mon","tue","wed","thu","fri","sat"] as const;
export const DAY_LABELS: Record<string, string> = { sun:"Domingo", mon:"Segunda", tue:"Terça", wed:"Quarta", thu:"Quinta", fri:"Sexta", sat:"Sábado" };

export function TimeInput({ value, onChange, label, accent = false }: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  accent?: boolean;
}) {
  const [raw, setRaw] = React.useState(value);

  React.useEffect(() => { setRaw(value); }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    let v = e.target.value.replace(/[^\d]/g, "");
    if (v.length > 4) v = v.slice(0, 4);
    let formatted = v;
    if (v.length >= 3) formatted = v.slice(0, 2) + ":" + v.slice(2);
    setRaw(formatted);
    if (v.length === 4) {
      const hh = parseInt(v.slice(0, 2));
      const mm = parseInt(v.slice(2, 4));
      if (hh <= 23 && mm <= 59)
        onChange(`${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
    }
  }

  function handleBlur() {
    const digits = raw.replace(/[^\d]/g, "");
    if (digits.length === 4) {
      const hh = Math.min(Number(digits.slice(0, 2)), 23);
      const mm = Math.min(Number(digits.slice(2, 4)), 59);
      const normalized = `${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}`;
      setRaw(normalized);
      onChange(normalized);
    } else {
      setRaw(value);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{label}</span>}
      <div className={`
        group relative flex items-center overflow-hidden transition-all duration-200
        rounded-[10px] border shadow-sm
        ${accent
          ? "bg-amber-50 border-amber-200 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/20"
          : "bg-zinc-50 border-zinc-200 focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-500/10 focus-within:bg-white"
        }
      `}>
        <input
          type="text"
          inputMode="numeric"
          maxLength={5}
          value={raw}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="00:00"
          className={`
            bg-transparent px-3 py-2 text-xs font-black tracking-widest
            focus:outline-none w-[68px] text-center
            ${accent ? "text-amber-700 placeholder:text-amber-300" : "text-zinc-800 placeholder:text-zinc-300"}
          `}
        />
      </div>
    </div>
  );
}

export const DEFAULT_HOURS = Object.fromEntries(DAY_KEYS_UI.map(d => [d, { enabled: !["sun"].includes(d), open: "08:00", close: "22:00", breakEnabled: false, breakStart: "12:00", breakEnd: "13:00" }]));

export const DEFAULT_PAYMENTS: PaymentConfig = {
  pix: { enabled: true, label: "Pix" },
  credit: { enabled: true, label: "Cartão de Crédito" },
  debit: { enabled: true, label: "Cartão de Débito" },
  meal: { enabled: false, label: "Vale Refeição" },
  food: { enabled: false, label: "Vale Alimentação" },
  cash: { enabled: true, label: "Dinheiro", allowChange: true }
};

export function parseAddress(raw: string | null | undefined) {
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export function buildAddressString(addr: AddressForm): string {
  const parts = [
    addr.street && addr.number ? `${addr.street}, ${addr.number}` : addr.street || "",
    addr.complement,
    addr.neighborhood,
    addr.city && addr.state ? `${addr.city} - ${addr.state}` : addr.city || addr.state,
    addr.country !== "Brasil" ? addr.country : "",
    addr.cep ? `CEP ${addr.cep}` : "",
  ].filter(Boolean);
  return parts.join(", ");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function maskPhone(value: string | null | undefined): string {
  if (!value) return "";
  const digits = String(value).replace(/\D/g, "");
  // Remove 55 prefix if present for masking
  const clean = (digits.startsWith("55") && digits.length >= 12) ? digits.slice(2) : digits;
  
  if (clean.length <= 2) return clean.length > 0 ? `(${clean}` : "";
  if (clean.length <= 6) return `(${clean.slice(0, 2)}) ${clean.slice(2)}`;
  if (clean.length <= 10) return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7, 11)}`;
}

export function unmaskPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  // Se já tem 12 ou 13 dígitos e começa com 55, mantém. 
  // Caso contrário, se tem 10 ou 11 (DDD + número), adiciona 55.
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}

export interface AddressForm {
  cep: string; street: string; number: string; complement: string;
  neighborhood: string; city: string; state: string; country: string;
}

export const EMPTY_ADDR: AddressForm = { cep: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "", country: "Brasil" };

export const CARD_BRANDS_LIST = [
  { id: 'visa', label: 'Visa' },
  { id: 'mastercard', label: 'Mastercard' },
  { id: 'elo', label: 'Elo' },
  { id: 'amex', label: 'American Express' },
  { id: 'hipercard', label: 'Hipercard' },
  { id: 'vr', label: 'VR Refeição' },
  { id: 'sodexo', label: 'Sodexo' },
  { id: 'ticket', label: 'Ticket' },
  { id: 'alelo', label: 'Alelo' }
];

// ─── ScheduleDay default helpers ──────────────────────────────────────────────
const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DEFAULT_SCHEDULE_DAYS = WEEKDAY_LABELS.map((label, i) => ({
  weekday: i, label, enabled: false, times: ["09:00", "18:00"],
}));

export function parseScheduleDays(raw?: string | null) {
  try { return raw ? JSON.parse(raw) : DEFAULT_SCHEDULE_DAYS; } catch { return DEFAULT_SCHEDULE_DAYS; }
}

// ── Condomínios do tenant ─────────────────────────────────────────────────────

const DAY_KEYS_COND = ["sun","mon","tue","wed","thu","fri","sat"] as const;
const DAY_LABELS_COND: Record<string,string> = { sun:"Dom", mon:"Seg", tue:"Ter", wed:"Qua", thu:"Qui", fri:"Sex", sat:"Sáb" };

export function CondominiumsCard({ tenant }: { tenant: Tenant | null }) {
  const [condos, setCondos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [localAddr, setLocalAddr] = useState("");
  const [localHours, setLocalHours] = useState<Record<string, { enabled: boolean; open: string; close: string }>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!tenant?.id) return;
    setLoading(true);
    apiJson<any[]>(`/api/owner/tenants/${tenant.id}/condominiums`)
      .then(d => setCondos(Array.isArray(d) ? d : []))
      .catch((e) => { console.error("[CondominiumsCard] erro:", e); setCondos([]); })
      .finally(() => setLoading(false));
  }, [tenant?.id]);

  function startEdit(condo: any) {
    setEditingId(condo.id);
    setLocalAddr(condo.localAddress || "");
    try {
      setLocalHours(condo.localHours ? JSON.parse(condo.localHours) : getDefaultHours());
    } catch { setLocalHours(getDefaultHours()); }
  }

  function getDefaultHours() {
    return Object.fromEntries(DAY_KEYS_COND.map(d => [d, { enabled: !["sun"].includes(d), open: "08:00", close: "22:00" }]));
  }

  async function handleSave(condId: string) {
    if (!tenant?.id) return;
    setSaving(true);
    try {
      await apiJson(`/api/owner/tenants/${tenant.id}/condominiums/${condId}`, {
        method: "PATCH",
        body: JSON.stringify({ localAddress: localAddr || null, localHours: JSON.stringify(localHours) }),
      });
      setCondos(prev => prev.map(c => c.id === condId ? { ...c, localAddress: localAddr || null, localHours: JSON.stringify(localHours) } : c));
      setEditingId(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    setSaving(false);
  }

  if (loading) return null;
  if (condos.length === 0) return null;

  return (
    <ContentCard padding="lg">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
          <Building2 className="w-4 h-4 text-amber-600" />
        </div>
        <div>
          <p className="text-sm font-black text-slate-900">Condomínios vinculados</p>
          <p className="text-xs text-slate-500">Configure seu endereço local e horários em cada condomínio.</p>
        </div>
        {saved && <span className="ml-auto flex items-center gap-1 text-xs text-green-600 font-bold"><CheckCircle className="w-3.5 h-3.5" /> Salvo!</span>}
      </div>

      <div className="space-y-3">
        {condos.map(condo => {
          const isEditing = editingId === condo.id;
          let hoursPreview = "";
          if (condo.localHours) {
            try {
              const h = JSON.parse(condo.localHours);
              const days = DAY_KEYS_COND.filter(d => h[d]?.enabled).map(d => DAY_LABELS_COND[d]);
              hoursPreview = days.length > 0 ? days.join(", ") : "Sem horários";
            } catch {}
          }

          return (
            <div key={condo.id} className="border border-slate-200 rounded-2xl overflow-hidden">
              {/* Header do condo */}
              <div className="flex items-center gap-3 px-4 py-3 bg-slate-50">
                {condo.logoUrl
                  ? <img src={condo.logoUrl} alt="" className="w-8 h-8 rounded-xl object-cover flex-shrink-0" />
                  : <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0"><Building2 className="w-4 h-4 text-amber-500" /></div>}
                <div className="flex-1 min-w-0">
                  <p className="font-black text-slate-900 text-sm truncate">{condo.name}</p>
                  <a href={`/cond/${condo.slug}`} target="_blank" rel="noreferrer"
                    className="text-[10px] text-amber-600 hover:underline font-mono flex items-center gap-1">
                    /cond/{condo.slug} <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <button type="button" onClick={() => isEditing ? setEditingId(null) : startEdit(condo)}
                  className={`p-2 rounded-xl transition-colors text-xs font-bold flex items-center gap-1.5 ${isEditing ? "bg-slate-200 text-slate-600" : "bg-amber-100 text-amber-700 hover:bg-amber-200"}`}>
                  <Edit3 className="w-3.5 h-3.5" />
                  {isEditing ? "Cancelar" : "Editar"}
                </button>
              </div>

              {/* Info resumida (quando não editando) */}
              {!isEditing && (
                <div className="px-4 py-3 space-y-1.5">
                  <div className="flex items-start gap-2 text-xs text-slate-600">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                    <span>{condo.localAddress || <span className="text-slate-400 italic">Sem endereço local definido</span>}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span>{hoursPreview || <span className="text-slate-400 italic">Sem horários definidos — aparece fechado</span>}</span>
                  </div>
                </div>
              )}

              {/* Formulário de edição */}
              {isEditing && (
                <div className="px-4 py-4 space-y-4">
                  {/* Endereço local */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">
                      Endereço neste local
                    </label>
                    <input
                      value={localAddr}
                      onChange={e => setLocalAddr(e.target.value)}
                      placeholder="Ex: Bloco A, Loja 12 — Rua das Flores, 100"
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-300 transition-all"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Este endereço será exibido para clientes neste condomínio.</p>
                  </div>

                  {/* Horários por dia */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">
                      Horários neste local
                    </label>
                    <div className="space-y-2">
                      {DAY_KEYS_COND.map(d => {
                        const day = localHours[d] ?? { enabled: false, open: "08:00", close: "22:00" };
                        return (
                          <div key={d} className="flex items-center gap-3">
                            <button type="button" onClick={() => setLocalHours(h => ({ ...h, [d]: { ...day, enabled: !day.enabled } }))}
                              className={`w-10 h-6 rounded-full transition-colors flex-shrink-0 ${day.enabled ? "bg-amber-400" : "bg-slate-200"}`}>
                              <div className={`w-5 h-5 bg-white rounded-full shadow-sm mx-auto transition-transform ${day.enabled ? "translate-x-2" : "-translate-x-2"}`} />
                            </button>
                            <span className={`text-xs font-black w-8 flex-shrink-0 ${day.enabled ? "text-slate-900" : "text-slate-400"}`}>{DAY_LABELS_COND[d]}</span>
                            {day.enabled ? (
                              <div className="flex items-center gap-2 flex-1">
                                <input type="time" value={day.open}
                                  onChange={e => setLocalHours(h => ({ ...h, [d]: { ...day, open: e.target.value } }))}
                                  className="flex-1 px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-300" />
                                <span className="text-xs text-slate-400">até</span>
                                <input type="time" value={day.close}
                                  onChange={e => setLocalHours(h => ({ ...h, [d]: { ...day, close: e.target.value } }))}
                                  className="flex-1 px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-300" />
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic">Fechado</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <button type="button" onClick={() => handleSave(condo.id)} disabled={saving}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-60 transition-colors shadow-sm">
                    {saving ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Salvando...</> : <><Save className="w-4 h-4" /> Salvar configurações</>}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ContentCard>
  );
}

export function KitchenPasswordCard({ tenantId }: { tenantId: string }) {
  const toast = useToast();
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiJson<{ hasPassword: boolean }>(`/api/admin/${tenantId}/kitchen/config`)
      .then((data) => setHasPassword(data.hasPassword))
      .catch(() => setHasPassword(false));
  }, [tenantId]);

  const handleSave = async () => {
    if (password && password.length < 4) {
      toast.error("A senha deve ter pelo menos 4 caracteres.");
      return;
    }
    setSaving(true);
    try {
      const data = await apiJson<{ hasPassword: boolean }>(`/api/admin/${tenantId}/kitchen/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      setHasPassword(data.hasPassword);
      setPassword("");
      toast.success(data.hasPassword ? "Senha da cozinha salva!" : "Senha da cozinha removida.");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar senha.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ContentCard padding="lg">
      <div className="flex items-center gap-3 mb-1">
        <ChefHat className="w-4 h-4 text-slate-400" />
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Painel de Cozinha</p>
        {hasPassword !== null && (
          <span className={`ml-auto text-[9px] font-black uppercase px-2 py-1 rounded-full ${hasPassword ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
            {hasPassword ? "Configurado" : "Não configurado"}
          </span>
        )}
      </div>
      <p className="text-[10px] text-slate-400 mb-6">
        Defina uma senha para abrir a tela <strong>/cozinha/{"{sua-loja}"}</strong> em um tablet ou TV fixo na cozinha —
        não precisa de conta de funcionário, só dessa senha. Fica conectado indefinidamente até alguém sair manualmente.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
        <div className="flex-1 space-y-1.5">
          <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
            {hasPassword ? "Nova senha (deixe em branco para manter a atual)" : "Senha da cozinha"}
          </label>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 4 caracteres"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-bold focus:border-[#C9A227] outline-none transition-all"
          />
        </div>
        <button
          type="button"
          disabled={saving || !password}
          onClick={handleSave}
          className="bg-[#0D1B3E] hover:bg-slate-800 disabled:opacity-40 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all shrink-0"
        >
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </ContentCard>
  );
}

interface KitchenStaffMember {
  id: string;
  name: string;
  username: string;
  active: boolean;
  createdAt: string;
}

interface KitchenAccessRequestItem {
  id: string;
  name: string;
  username: string;
  storeQuery: string;
  contact: string | null;
  createdAt: string;
}

export function KitchenAccessRequestsCard({ tenantId, onApproved }: { tenantId: string; onApproved: () => void }) {
  const toast = useToast();
  const [requests, setRequests] = useState<KitchenAccessRequestItem[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approvePassword, setApprovePassword] = useState("");

  const fetchRequests = () => {
    apiJson<KitchenAccessRequestItem[]>(`/api/admin/${tenantId}/kitchen/access-requests`)
      .then((data) => setRequests(Array.isArray(data) ? data : []))
      .catch(() => setRequests([]));
  };

  useEffect(() => { fetchRequests(); }, [tenantId]);

  const handleApprove = async (requestId: string) => {
    if (approvePassword.length < 4) { toast.error("A senha deve ter pelo menos 4 caracteres."); return; }
    try {
      await apiFetch(`/api/admin/${tenantId}/kitchen/access-requests/${requestId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: approvePassword }),
      });
      setApprovingId(null);
      setApprovePassword("");
      fetchRequests();
      onApproved();
      toast.success("Acesso aprovado!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao aprovar solicitação.");
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      await apiFetch(`/api/admin/${tenantId}/kitchen/access-requests/${requestId}/reject`, { method: "POST" });
      fetchRequests();
      toast.success("Solicitação rejeitada.");
    } catch (err: any) {
      toast.error(err.message || "Erro ao rejeitar solicitação.");
    }
  };

  if (requests.length === 0) return null;

  return (
    <ContentCard padding="lg">
      <div className="flex items-center gap-3 mb-1">
        <Bell className="w-4 h-4 text-amber-500" />
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Solicitações de Acesso</p>
        <span className="ml-auto text-[9px] font-black uppercase px-2 py-1 rounded-full bg-amber-100 text-amber-700">
          {requests.length} pendente{requests.length > 1 ? "s" : ""}
        </span>
      </div>
      <p className="text-[10px] text-slate-400 mb-6">
        Pedidos de acesso feitos por funcionários direto em cozinha.boxsys.com.br. Aprove definindo uma senha,
        ou rejeite se não reconhecer a pessoa.
      </p>
      <div className="space-y-2">
        {requests.map((r) => (
          <div key={r.id} className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-700">{r.name} <span className="text-slate-400 font-normal">@{r.username}</span></p>
                {r.contact && <p className="text-[10px] text-slate-400">Contato: {r.contact}</p>}
              </div>
              {approvingId !== r.id && (
                <div className="flex items-center gap-3 shrink-0">
                  <button onClick={() => { setApprovingId(r.id); setApprovePassword(""); }} className="text-[10px] font-black uppercase text-green-600 hover:text-green-700">Aprovar</button>
                  <button onClick={() => handleReject(r.id)} className="text-[10px] font-black uppercase text-red-500 hover:text-red-600">Rejeitar</button>
                </div>
              )}
            </div>
            {approvingId === r.id && (
              <div className="flex items-center gap-2 mt-3">
                <input
                  type="text"
                  value={approvePassword}
                  onChange={(e) => setApprovePassword(e.target.value)}
                  placeholder="Defina a senha (mín. 4 caracteres)"
                  autoFocus
                  className="flex-1 bg-white border border-slate-200 rounded-lg py-1.5 px-3 text-xs font-bold outline-none focus:border-[#C9A227]"
                />
                <button onClick={() => handleApprove(r.id)} className="text-[10px] font-black uppercase text-green-600 hover:text-green-700 shrink-0">Confirmar</button>
                <button onClick={() => { setApprovingId(null); setApprovePassword(""); }} className="text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 shrink-0">Cancelar</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </ContentCard>
  );
}

export function KitchenStaffCard({ tenantId }: { tenantId: string }) {
  const toast = useToast();
  const [staff, setStaff] = useState<KitchenStaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPassword, setEditPassword] = useState("");

  const fetchStaff = () => {
    apiJson<KitchenStaffMember[]>(`/api/admin/${tenantId}/kitchen/staff`)
      .then((data) => setStaff(Array.isArray(data) ? data : []))
      .catch(() => setStaff([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchStaff(); }, [tenantId]);

  const handleCreate = async () => {
    if (!name.trim()) { toast.error("Informe o nome do funcionário."); return; }
    if (!username.trim()) { toast.error("Informe um usuário (único no sistema)."); return; }
    if (password.length < 4) { toast.error("A senha deve ter pelo menos 4 caracteres."); return; }
    setSaving(true);
    try {
      await apiFetch(`/api/admin/${tenantId}/kitchen/staff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), username: username.trim(), password }),
      });
      setName(""); setUsername(""); setPassword("");
      fetchStaff();
      toast.success("Funcionário cadastrado!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao cadastrar funcionário.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (member: KitchenStaffMember) => {
    try {
      await apiFetch(`/api/admin/${tenantId}/kitchen/staff/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !member.active }),
      });
      fetchStaff();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar funcionário.");
    }
  };

  const handleResetPassword = async (memberId: string) => {
    if (editPassword.length < 4) { toast.error("A senha deve ter pelo menos 4 caracteres."); return; }
    try {
      await apiFetch(`/api/admin/${tenantId}/kitchen/staff/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: editPassword }),
      });
      setEditingId(null);
      setEditPassword("");
      toast.success("Senha atualizada!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar senha.");
    }
  };

  const handleDelete = async (member: KitchenStaffMember) => {
    if (!window.confirm(`Remover ${member.name} do acesso à cozinha?`)) return;
    try {
      await apiFetch(`/api/admin/${tenantId}/kitchen/staff/${member.id}`, { method: "DELETE" });
      fetchStaff();
      toast.success("Funcionário removido.");
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover funcionário.");
    }
  };

  return (
    <ContentCard padding="lg">
      <div className="flex items-center gap-3 mb-1">
        <Users className="w-4 h-4 text-slate-400" />
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Equipe da Cozinha</p>
      </div>
      <p className="text-[10px] text-slate-400 mb-6">
        Cadastre cada pessoa que trabalha na cozinha com nome, usuário e senha próprios — assim o app mostra
        quem está com o pedido em mãos, e a pessoa consegue logar direto em <strong>cozinha.boxsys.com.br</strong> com
        esse usuário (não precisa mais digitar o nome da loja). Continua funcionando junto com a senha única acima.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-end mb-6">
        <div className="flex-1 space-y-1.5">
          <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Nome</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: João"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-bold focus:border-[#C9A227] outline-none transition-all"
          />
        </div>
        <div className="flex-1 space-y-1.5">
          <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Usuário</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Ex: joao.pizzaria"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-bold focus:border-[#C9A227] outline-none transition-all"
          />
        </div>
        <div className="flex-1 space-y-1.5">
          <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Senha</label>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 4 caracteres"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-bold focus:border-[#C9A227] outline-none transition-all"
          />
        </div>
        <button
          type="button"
          disabled={saving || !name.trim() || !username.trim() || !password}
          onClick={handleCreate}
          className="bg-[#0D1B3E] hover:bg-slate-800 disabled:opacity-40 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all shrink-0"
        >
          {saving ? "Salvando..." : "Adicionar"}
        </button>
      </div>

      {!loading && staff.length === 0 && (
        <p className="text-xs text-slate-300 text-center py-4">Nenhum funcionário cadastrado ainda.</p>
      )}

      {staff.length > 0 && (
        <div className="space-y-2">
          {staff.map((member) => (
            <div key={member.id} className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
              <div className={`w-2 h-2 rounded-full shrink-0 ${member.active ? "bg-green-500" : "bg-slate-300"}`} />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-bold text-slate-700 truncate block">{member.name}</span>
                <span className="text-[10px] text-slate-400">@{member.username}</span>
              </div>

              {editingId === member.id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Nova senha"
                    autoFocus
                    className="bg-white border border-slate-200 rounded-lg py-1.5 px-3 text-xs font-bold w-32 outline-none focus:border-[#C9A227]"
                  />
                  <button onClick={() => handleResetPassword(member.id)} className="text-[10px] font-black uppercase text-green-600 hover:text-green-700">Salvar</button>
                  <button onClick={() => { setEditingId(null); setEditPassword(""); }} className="text-[10px] font-black uppercase text-slate-400 hover:text-slate-600">Cancelar</button>
                </div>
              ) : (
                <div className="flex items-center gap-3 shrink-0">
                  <button onClick={() => { setEditingId(member.id); setEditPassword(""); }} className="text-[10px] font-black uppercase text-slate-400 hover:text-slate-600">Trocar senha</button>
                  <button onClick={() => handleToggleActive(member)} className={`text-[10px] font-black uppercase ${member.active ? "text-amber-600 hover:text-amber-700" : "text-green-600 hover:text-green-700"}`}>
                    {member.active ? "Desativar" : "Ativar"}
                  </button>
                  <button onClick={() => handleDelete(member)} className="text-[10px] font-black uppercase text-red-500 hover:text-red-600">Remover</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </ContentCard>
  );
}

export function KmRangeAdder({ onAdd }: { onAdd: (range: KmRange) => void }) {
  const [upToKm, setUpToKm] = useState("");
  const [fee, setFee] = useState("");

  const handleAdd = () => {
    const km = parseFloat(upToKm);
    if (!km || km <= 0) return;
    onAdd({ id: Date.now().toString(), upToKm: km, fee: parseFloat(fee) || 0 });
    setUpToKm("");
    setFee("");
  };

  return (
    <div className="border border-dashed border-slate-300 rounded-xl p-3 space-y-3 bg-slate-50/50">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Adicionar faixa de distância</p>
      <div className="flex gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[140px]">
          <span className="text-xs font-bold text-slate-400 shrink-0">Até</span>
          <input
            type="number"
            min="0.1"
            step="0.5"
            value={upToKm}
            onChange={e => setUpToKm(e.target.value)}
            placeholder="5"
            className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <span className="text-xs font-bold text-slate-400 shrink-0">km</span>
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-[140px]">
          <span className="text-xs font-bold text-slate-400 shrink-0">Taxa R$</span>
          <input
            type="number"
            min="0"
            step="0.50"
            value={fee}
            onChange={e => setFee(e.target.value)}
            placeholder="0,00"
            className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
      </div>
      <Button type="button" size="xs" variant="outline" disabled={!upToKm || parseFloat(upToKm) <= 0} onClick={handleAdd}>
        + Adicionar faixa
      </Button>
    </div>
  );
}

export function ZoneAdder({ onAdd }: { onAdd: (zone: DeliveryZone) => void }) {
  const [cepInput, setCepInput] = useState("");
  const [fee, setFee] = useState("");
  const [cepInfo, setCepInfo] = useState<{ cep: string; label: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fmtCep = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 8);
    return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
  };

  const searchCep = async (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (digits.length !== 8) {
      setCepInfo(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const d = await r.json();
      if (d.erro) {
        setError("CEP não encontrado");
        setCepInfo(null);
        return;
      }
      setCepInfo({ cep: digits, label: [d.bairro, d.localidade, d.uf].filter(Boolean).join(", ") });
    } catch {
      setError("Erro ao buscar CEP");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    if (!cepInfo) return;
    onAdd({
      id: Date.now().toString(),
      label: cepInfo.label,
      ceps: [cepInfo.cep],
      fee: parseFloat(fee) || 0,
    });
    setCepInput("");
    setFee("");
    setCepInfo(null);
  };

  return (
    <div className="border border-dashed border-slate-300 rounded-xl p-3 space-y-3 bg-slate-50/50">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Adicionar zona por CEP</p>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            value={cepInput}
            onChange={e => {
              setCepInput(fmtCep(e.target.value));
              setCepInfo(null);
              setError("");
            }}
            onBlur={e => searchCep(e.target.value)}
            placeholder="00000-000"
            inputMode="numeric"
            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-400 pr-8"
          />
          {loading && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          )}
        </div>
        <button
          type="button"
          onClick={() => searchCep(cepInput)}
          className="px-3 py-2 bg-slate-100 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors whitespace-nowrap"
        >
          Buscar
        </button>
      </div>

      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

      {cepInfo && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
          <span className="text-xs font-bold text-green-800 flex-1">
            {cepInput} - {cepInfo.label}
          </span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-slate-400 shrink-0">Taxa R$</span>
        <input
          type="number"
          min="0"
          step="0.50"
          value={fee}
          onChange={e => setFee(e.target.value)}
          placeholder="0,00"
          className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <span className="text-xs text-slate-400">(0 = grátis)</span>
      </div>

      <Button type="button" size="xs" variant="outline" disabled={!cepInfo} onClick={handleAdd}>
        + Adicionar zona
      </Button>
    </div>
  );
}
