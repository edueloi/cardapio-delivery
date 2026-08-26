import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, X, ShoppingBag } from "lucide-react";
import type { Product, Tenant } from "../../types";

const BRAND = "#C9A227";

export interface ProductSelectionGroup {
  sourceType: "category" | "products";
  categoryId?: string;
  productIds?: string[];
  qty: number;
  label?: string;
}

// Lê os grupos de seleção embutidos no produto — ex: numa marmita, "Guarnição" (escolha
// 1), "Arroz" (escolha 1), "Feijão" (escolha 1), cada um sua própria categoria/opções.
// Aceita tanto o formato antigo (um único objeto — produtos cadastrados antes de suportar
// múltiplos grupos) quanto o novo (array), sem precisar migrar dados existentes.
// Compartilhado por todas as telas de cliente (balcão, mesa, PDV, delivery).
export function parseSelectionGroups(product: Product | null | undefined): ProductSelectionGroup[] {
  if (!product) return [];
  const raw = (product as any).selectionGroup;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    return list.filter((g) => g && typeof g.qty === "number" && g.qty >= 1);
  } catch {
    return [];
  }
}

export function getSelectionGroupOptions(tenant: Tenant | null | undefined, group: ProductSelectionGroup): Product[] {
  if (!tenant?.categories) return [];
  if (group.sourceType === "category") {
    return tenant.categories.find((c) => c.id === group.categoryId)?.products || [];
  }
  return tenant.categories.flatMap((c) => c.products).filter((p) => group.productIds?.includes(p.id));
}

export function formatSelectionGroupNote(group: ProductSelectionGroup, selectedIds: string[], options: Product[]): string {
  if (selectedIds.length === 0) return "";
  const names = selectedIds.map((id) => options.find((p) => p.id === id)?.name).filter(Boolean);
  if (names.length === 0) return "";
  return `${group.label || "Escolha"}: ${names.join(" + ")}`;
}

// Junta as notas de todos os grupos num único texto pra guardar no item do pedido —
// ex: "Guarnição: Batata frita | Arroz: Arroz branco | Feijão: Feijão carioca".
export function formatSelectionGroupsNote(groups: ProductSelectionGroup[], selectedIdsByGroup: string[][], optionsByGroup: Product[][]): string {
  return groups
    .map((g, i) => formatSelectionGroupNote(g, selectedIdsByGroup[i] || [], optionsByGroup[i] || []))
    .filter(Boolean)
    .join(" | ");
}

export function selectionGroupsComplete(groups: ProductSelectionGroup[], selectedIdsByGroup: string[][]): boolean {
  return groups.every((g, i) => (selectedIdsByGroup[i]?.length ?? 0) === g.qty);
}

interface SelectionGroupPickerProps {
  groups: ProductSelectionGroup[];
  optionsByGroup: Product[][];
  initialSelections?: string[][];
  onConfirm: (selectedIdsByGroup: string[][]) => void;
  onCancel: () => void;
}

// Fluxo passo a passo pelos grupos de seleção embutidos no produto — ex: numa marmita,
// primeiro escolhe a Guarnição, depois o Arroz, depois o Feijão; dentro de cada grupo,
// cada unidade é escolhida em sua própria etapa (avança sozinho ao tocar), igual ao fluxo
// de combos, terminando numa tela de resumo com TODOS os grupos pra revisar/trocar antes
// de confirmar. Preço nunca muda aqui — quem chama decide o preço (sempre o fixo do produto pai).
export default function SelectionGroupPicker({ groups, optionsByGroup, initialSelections, onConfirm, onCancel }: SelectionGroupPickerProps) {
  const [groupIdx, setGroupIdx] = useState(0);
  const [unitIdx, setUnitIdx] = useState(0);
  const [selections, setSelections] = useState<string[][]>(
    () => initialSelections ?? groups.map((g) => Array.from({ length: g.qty }, () => null as unknown as string))
  );
  const [showSummary, setShowSummary] = useState(false);

  const group = groups[groupIdx];
  const options = optionsByGroup[groupIdx] || [];

  const pick = (productId: string) => {
    const next = selections.map((arr) => [...arr]);
    next[groupIdx][unitIdx] = productId;
    setSelections(next);
    setTimeout(() => {
      if (unitIdx < group.qty - 1) {
        setUnitIdx((i) => i + 1);
      } else if (groupIdx < groups.length - 1) {
        setGroupIdx((i) => i + 1);
        setUnitIdx(0);
      } else {
        setShowSummary(true);
      }
    }, 220);
  };

  const goBack = () => {
    if (showSummary) { setShowSummary(false); return; }
    if (unitIdx > 0) { setUnitIdx((i) => i - 1); return; }
    if (groupIdx > 0) { setGroupIdx((i) => i - 1); setUnitIdx(groups[groupIdx - 1].qty - 1); return; }
    onCancel();
  };

  const allDone = selections.every((arr) => arr.every((s) => s != null));
  const totalUnits = groups.reduce((acc, g) => acc + g.qty, 0);
  const doneUnits = groups.reduce((acc, g, gi) => acc + (gi < groupIdx ? g.qty : gi === groupIdx ? unitIdx + (selections[gi][unitIdx] ? 1 : 0) : 0), 0);
  const progress = showSummary ? 1 : totalUnits > 0 ? doneUnits / totalUnits : 0;

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onCancel}
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
      />
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
        className="relative bg-white w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: "92vh" }}
      >
        <div className="px-5 pt-7 pb-4 shrink-0 border-b border-slate-100">
          <div className="flex items-center gap-3 mb-4">
            <motion.button whileTap={{ scale: 0.88 }} onClick={goBack} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </motion.button>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mb-0.5">
                {showSummary ? "Confirme sua escolha" : `${group.label || "Escolha os itens"}${group.qty > 1 ? ` · ${unitIdx + 1}/${group.qty}` : ""}`}
              </p>
              <h2 className="text-[15px] font-black text-slate-900 leading-tight truncate">
                {showSummary ? "Resumo das escolhas" : group.qty > 1 ? `${unitIdx + 1}ª unidade` : (group.label || "Escolha os itens")}
              </h2>
            </div>
            <motion.button whileTap={{ scale: 0.88 }} onClick={onCancel} className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
              <X className="w-4 h-4 text-slate-500" />
            </motion.button>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${BRAND} 0%, #a37d1a 100%)` }}
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          <AnimatePresence mode="wait">
            {!showSummary ? (
              <motion.div
                key={`unit-${groupIdx}-${unitIdx}`}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="px-4 py-3 grid grid-cols-1 gap-2"
              >
                {options.map((product) => {
                  const selected = selections[groupIdx][unitIdx] === product.id;
                  return (
                    <motion.button
                      key={product.id}
                      onClick={() => pick(product.id)}
                      whileTap={{ scale: 0.98 }}
                      className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 text-left transition-all duration-150 ${
                        selected ? "shadow-md" : "border-slate-100 bg-slate-50 hover:border-slate-200"
                      }`}
                      style={selected ? { borderColor: BRAND, background: "#FFF8E7" } : {}}
                    >
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} className="w-12 h-12 rounded-xl object-cover shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-xl shrink-0">🍽️</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold leading-snug ${selected ? "text-amber-800" : "text-slate-800"}`}>{product.name}</p>
                        {product.description && (
                          <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1 leading-relaxed">{product.description}</p>
                        )}
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${selected ? "border-amber-400" : "border-slate-200"}`}>
                        {selected && <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="w-3 h-3 rounded-full" style={{ background: BRAND }} />}
                      </div>
                    </motion.button>
                  );
                })}
              </motion.div>
            ) : (
              <motion.div
                key="summary"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.2 }}
                className="px-5 py-4 space-y-4"
              >
                {groups.map((g, gi) => (
                  <div key={gi} className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{g.label || `Grupo ${gi + 1}`}</p>
                    {selections[gi].map((id, ui) => {
                      const product = (optionsByGroup[gi] || []).find((p) => p.id === id);
                      return (
                        <div key={ui} className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: BRAND }} />
                            <p className="text-sm font-bold text-slate-800 truncate">{product?.name || "—"}</p>
                          </div>
                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => { setShowSummary(false); setGroupIdx(gi); setUnitIdx(ui); }}
                            className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-800 transition-colors shrink-0"
                          >
                            Trocar
                          </motion.button>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {showSummary && (
          <div className="shrink-0 border-t border-slate-50 p-4 pb-6 bg-white">
            <motion.button
              whileTap={{ scale: 0.97 }}
              disabled={!allDone}
              onClick={() => onConfirm(selections)}
              className="w-full flex items-center justify-center gap-3 px-5 py-4 rounded-2xl text-[14px] font-black text-white shadow-2xl disabled:opacity-40"
              style={{ background: `linear-gradient(135deg, ${BRAND} 0%, #a37d1a 100%)` }}
            >
              <ShoppingBag className="w-4 h-4" />
              Confirmar escolha
            </motion.button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
