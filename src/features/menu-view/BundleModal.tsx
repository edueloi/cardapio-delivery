import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, ChevronLeft, ChevronRight, Check, ShoppingCart, Plus } from "lucide-react";
import type { ProductBundle, BundleStep, BundleStepSelection } from "../../types";
import type { Product, ProductVariant, Category } from "../../types";

const BRAND = "#C9A227";
const BRAND_DARK = "#a37d1a";
const BRAND_LIGHT = "#FFF8E7";

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

interface BundleModalProps {
  bundle: ProductBundle;
  categories: Category[];
  onClose: () => void;
  onAdd: (sel: BundleStepSelection[], notes: string, qty: number) => void;
}

function getProductsForStep(step: BundleStep, categories: Category[]): Product[] {
  if (step.sourceType === "category" && step.categoryId) {
    const cat = categories.find((c) => c.id === step.categoryId);
    return cat?.products ?? [];
  }
  if (step.sourceType === "products" && step.productIds?.length) {
    const allProducts = categories.flatMap((c) => c.products);
    return allProducts.filter((p) => step.productIds!.includes(p.id));
  }
  return [];
}

function getVariantForStep(product: Product, step: BundleStep): ProductVariant | undefined {
  if (!step.variantId) return undefined;
  return product.variants?.find((v) => v.id === step.variantId);
}

function getUnitPrice(product: Product, step: BundleStep): number {
  const variant = getVariantForStep(product, step);
  return variant ? variant.price : product.price;
}

export default function BundleModal({ bundle, categories, onClose, onAdd }: BundleModalProps) {
  const [stepIdx, setStepIdx] = useState(0);
  const [selections, setSelections] = useState<(BundleStepSelection | null)[]>(
    bundle.steps.map(() => null)
  );
  const [notes, setNotes] = useState("");
  const [qty, setQty] = useState(1);
  const [showSummary, setShowSummary] = useState(false);

  const currentStep = bundle.steps[stepIdx];
  const products = useMemo(
    () => (currentStep ? getProductsForStep(currentStep, categories) : []),
    [currentStep, categories]
  );
  const currentSel = selections[stepIdx];

  const allDone = selections.every((s) => s !== null);
  const isLast = stepIdx === bundle.steps.length - 1;

  function selectSingle(product: Product) {
    const variant = getVariantForStep(product, currentStep);
    const upd: BundleStepSelection = {
      stepId: currentStep.id,
      stepLabel: currentStep.label,
      flavorMode: "single",
      qty: currentStep.qty,
      productId: product.id,
      productName: product.name,
      variantId: variant?.id,
      variantName: variant?.name,
      unitPrice: getUnitPrice(product, currentStep),
    };
    const next = [...selections];
    next[stepIdx] = upd;
    setSelections(next);
    // auto-advance after short delay
    setTimeout(() => {
      if (stepIdx < bundle.steps.length - 1) setStepIdx((i) => i + 1);
      else setShowSummary(true);
    }, 280);
  }

  function selectHalfA(product: Product) {
    const variant = getVariantForStep(product, currentStep);
    const prev = (currentSel as BundleStepSelection) ?? {
      stepId: currentStep.id, stepLabel: currentStep.label,
      flavorMode: "half", qty: currentStep.qty, unitPrice: 0,
    };
    const next = [...selections];
    next[stepIdx] = {
      ...prev,
      halfA: { productId: product.id, productName: product.name, variantId: variant?.id, variantName: variant?.name },
      unitPrice: getUnitPrice(product, currentStep),
    } as BundleStepSelection;
    setSelections(next);
  }

  function selectHalfB(product: Product) {
    const variant = getVariantForStep(product, currentStep);
    const prev = (currentSel as BundleStepSelection) ?? {
      stepId: currentStep.id, stepLabel: currentStep.label,
      flavorMode: "half", qty: currentStep.qty, unitPrice: 0,
    };
    const next = [...selections];
    next[stepIdx] = {
      ...prev,
      halfB: { productId: product.id, productName: product.name, variantId: variant?.id, variantName: variant?.name },
      unitPrice: (prev as any).unitPrice ?? getUnitPrice(product, currentStep),
    } as BundleStepSelection;
    setSelections(next);
  }

  const halfReady =
    currentStep?.flavorMode === "half" &&
    !!(currentSel as any)?.halfA &&
    !!(currentSel as any)?.halfB;

  function advanceHalf() {
    if (!halfReady) return;
    if (stepIdx < bundle.steps.length - 1) setStepIdx((i) => i + 1);
    else setShowSummary(true);
  }

  function goBack() {
    if (showSummary) { setShowSummary(false); return; }
    if (stepIdx > 0) setStepIdx((i) => i - 1);
    else onClose();
  }

  const progress = showSummary ? 1 : (stepIdx + (currentSel ? 1 : 0)) / bundle.steps.length;

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
        className="relative bg-white w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: "92vh" }}
      >
        {/* Drag handle */}
        <div className="absolute top-3 left-0 right-0 flex justify-center pointer-events-none sm:hidden z-10">
          <div className="w-10 h-1 rounded-full bg-black/10" />
        </div>

        {/* Header */}
        <div className="px-5 pt-7 pb-4 shrink-0 border-b border-slate-100">
          <div className="flex items-center gap-3 mb-4">
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={goBack}
              className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0"
            >
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </motion.button>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 mb-0.5">
                {showSummary ? "Resumo do combo" : `Etapa ${stepIdx + 1} de ${bundle.steps.length}`}
              </p>
              <h2 className="text-[15px] font-black text-slate-900 leading-tight truncate">
                {showSummary ? bundle.name : currentStep?.label}
              </h2>
            </div>
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0"
            >
              <X className="w-4 h-4 text-slate-500" />
            </motion.button>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${BRAND} 0%, ${BRAND_DARK} 100%)` }}
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            />
          </div>

          {/* Step dots */}
          <div className="flex gap-1.5 mt-2.5 items-center">
            {bundle.steps.map((_, i) => (
              <motion.div
                key={i}
                animate={{
                  width: i === stepIdx && !showSummary ? 20 : 6,
                  opacity: i <= stepIdx || showSummary ? 1 : 0.25,
                }}
                transition={{ duration: 0.25 }}
                className="h-1.5 rounded-full"
                style={{ background: (i < stepIdx || showSummary) ? BRAND : i === stepIdx ? BRAND : "#CBD5E1" }}
              />
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <AnimatePresence mode="wait">
            {!showSummary ? (
              <motion.div
                key={`step-${stepIdx}`}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                {currentStep?.description && (
                  <p className="px-5 pt-4 pb-1 text-xs text-slate-400 leading-relaxed">{currentStep.description}</p>
                )}

                {/* SINGLE MODE */}
                {currentStep?.flavorMode === "single" && (
                  <div className="px-4 py-3 grid grid-cols-1 gap-2">
                    {products.map((product) => {
                      const selected = currentSel?.productId === product.id;
                      const variant = getVariantForStep(product, currentStep);
                      const price = getUnitPrice(product, currentStep);
                      return (
                        <motion.button
                          key={product.id}
                          onClick={() => selectSingle(product)}
                          whileTap={{ scale: 0.98 }}
                          className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 text-left transition-all duration-150 ${
                            selected ? "shadow-md" : "border-slate-100 bg-slate-50 hover:border-slate-200"
                          }`}
                          style={selected ? { borderColor: BRAND, background: BRAND_LIGHT } : {}}
                        >
                          {product.imageUrl && (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="w-12 h-12 rounded-xl object-cover shrink-0"
                            />
                          )}
                          {!product.imageUrl && (
                            <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-xl shrink-0">🍕</div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-bold leading-snug ${selected ? "text-amber-800" : "text-slate-800"}`}>
                              {product.name}
                            </p>
                            {product.description && (
                              <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1 leading-relaxed">{product.description}</p>
                            )}
                            {variant && (
                              <span className="text-[10px] font-black uppercase tracking-widest mt-0.5 block" style={{ color: BRAND }}>
                                {variant.name}
                              </span>
                            )}
                          </div>
                          <div className="shrink-0 flex items-center gap-2">
                            {currentStep.qty > 1 && (
                              <span className="text-[10px] text-slate-400 font-bold">{currentStep.qty}×</span>
                            )}
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${selected ? "border-amber-400" : "border-slate-200"}`}>
                              {selected && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="w-3 h-3 rounded-full"
                                  style={{ background: BRAND }}
                                />
                              )}
                            </div>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                )}

                {/* HALF MODE */}
                {currentStep?.flavorMode === "half" && (
                  <div className="px-4 py-3 space-y-4">
                    {/* Half A */}
                    <div>
                      <div className="flex items-center gap-2 mb-2.5">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white" style={{ background: BRAND }}>1</div>
                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">1º Sabor</p>
                        {(currentSel as any)?.halfA && (
                          <div className="ml-auto flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
                            <Check className="w-3 h-3 text-amber-500" />
                            <span className="text-[10px] font-black text-amber-700 truncate max-w-[120px]">
                              {(currentSel as any).halfA.productName}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-1 gap-1.5">
                        {products.map((product) => {
                          const selected = (currentSel as any)?.halfA?.productId === product.id;
                          return (
                            <motion.button
                              key={product.id}
                              onClick={() => selectHalfA(product)}
                              whileTap={{ scale: 0.98 }}
                              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl border-2 text-left transition-all duration-150 ${
                                selected ? "shadow-sm" : "border-slate-100 bg-white hover:border-slate-200"
                              }`}
                              style={selected ? { borderColor: BRAND, background: BRAND_LIGHT } : {}}
                            >
                              {product.imageUrl && (
                                <img src={product.imageUrl} alt={product.name} className="w-10 h-10 rounded-xl object-cover shrink-0" />
                              )}
                              {!product.imageUrl && (
                                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-lg shrink-0">🍕</div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className={`text-[13px] font-bold leading-snug ${selected ? "text-amber-800" : "text-slate-800"}`}>{product.name}</p>
                                {product.description && (
                                  <p className="text-[11px] text-slate-400 line-clamp-1 leading-relaxed">{product.description}</p>
                                )}
                              </div>
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? "border-amber-400" : "border-slate-200"}`}>
                                {selected && <div className="w-2.5 h-2.5 rounded-full" style={{ background: BRAND }} />}
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-slate-100" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">meio a meio</span>
                      <div className="flex-1 h-px bg-slate-100" />
                    </div>

                    {/* Half B */}
                    <div>
                      <div className="flex items-center gap-2 mb-2.5">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white" style={{ background: "#374151" }}>2</div>
                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">2º Sabor</p>
                        {(currentSel as any)?.halfB && (
                          <div className="ml-auto flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-full px-2.5 py-1">
                            <Check className="w-3 h-3 text-slate-500" />
                            <span className="text-[10px] font-black text-slate-600 truncate max-w-[120px]">
                              {(currentSel as any).halfB.productName}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-1 gap-1.5">
                        {products.map((product) => {
                          const selected = (currentSel as any)?.halfB?.productId === product.id;
                          return (
                            <motion.button
                              key={product.id}
                              onClick={() => selectHalfB(product)}
                              whileTap={{ scale: 0.98 }}
                              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-2xl border-2 text-left transition-all duration-150 ${
                                selected ? "shadow-sm" : "border-slate-100 bg-white hover:border-slate-200"
                              }`}
                              style={selected ? { borderColor: "#374151", background: "#F8F9FA" } : {}}
                            >
                              {product.imageUrl && (
                                <img src={product.imageUrl} alt={product.name} className="w-10 h-10 rounded-xl object-cover shrink-0" />
                              )}
                              {!product.imageUrl && (
                                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-lg shrink-0">🍕</div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className={`text-[13px] font-bold leading-snug ${selected ? "text-slate-900" : "text-slate-800"}`}>{product.name}</p>
                                {product.description && (
                                  <p className="text-[11px] text-slate-400 line-clamp-1 leading-relaxed">{product.description}</p>
                                )}
                              </div>
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? "border-slate-600" : "border-slate-200"}`}>
                                {selected && <div className="w-2.5 h-2.5 rounded-full bg-slate-700" />}
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              /* ── SUMMARY VIEW ─────────────────────────────────────────── */
              <motion.div
                key="summary"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.22 }}
                className="px-5 py-4 space-y-4"
              >
                {/* Bundle image + name */}
                {bundle.imageUrl && (
                  <div className="relative h-36 rounded-2xl overflow-hidden">
                    <img src={bundle.imageUrl} alt={bundle.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 60%)" }} />
                    <div className="absolute bottom-3 left-4">
                      <p className="text-white font-black text-base">{bundle.name}</p>
                    </div>
                  </div>
                )}

                {/* Selections */}
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Suas escolhas</p>
                  {selections.map((sel, i) => {
                    if (!sel) return null;
                    const step = bundle.steps[i];
                    return (
                      <div key={i} className="bg-slate-50 rounded-2xl p-3.5 border border-slate-100">
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{step.label}</p>
                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => { setShowSummary(false); setStepIdx(i); }}
                            className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
                          >
                            Editar
                          </motion.button>
                        </div>
                        {sel.flavorMode === "single" ? (
                          <div className="flex items-center gap-2.5">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: BRAND }} />
                            <p className="text-sm font-bold text-slate-800">
                              {sel.qty > 1 && <span className="text-slate-400 mr-1">{sel.qty}×</span>}
                              {sel.productName}
                              {sel.variantName && <span className="font-normal text-slate-500"> · {sel.variantName}</span>}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: BRAND }} />
                              <p className="text-sm font-bold text-slate-800">
                                ½ {sel.halfA?.productName}
                                {sel.halfA?.variantName && <span className="font-normal text-slate-500"> · {sel.halfA.variantName}</span>}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full shrink-0 bg-slate-400" />
                              <p className="text-sm font-bold text-slate-800">
                                ½ {sel.halfB?.productName}
                                {sel.halfB?.variantName && <span className="font-normal text-slate-500"> · {sel.halfB.variantName}</span>}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Observações</p>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ex: sem cebola, bem passado…"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm resize-none min-h-[68px] font-medium text-slate-700 focus:outline-none focus:border-amber-300 transition-all"
                  />
                </div>

                {/* Qty */}
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-slate-700">Quantidade</p>
                  <div className="flex items-center gap-3 bg-slate-50 rounded-2xl p-2 border border-slate-100">
                    <motion.button
                      whileTap={{ scale: 0.88 }}
                      onClick={() => setQty((q) => Math.max(1, q - 1))}
                      className="w-9 h-9 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center"
                      style={{ color: qty === 1 ? "#CBD5E1" : "#374151" }}
                    >
                      <span className="text-lg font-bold leading-none">−</span>
                    </motion.button>
                    <motion.span
                      key={qty}
                      initial={{ scale: 0.7 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      className="text-lg font-black w-7 text-center text-slate-900"
                    >
                      {qty}
                    </motion.span>
                    <motion.button
                      whileTap={{ scale: 0.88 }}
                      onClick={() => setQty((q) => q + 1)}
                      className="w-9 h-9 rounded-xl shadow-sm flex items-center justify-center text-white"
                      style={{ background: "linear-gradient(135deg, #111 0%, #333 100%)" }}
                    >
                      <Plus className="w-4 h-4" />
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-50 p-4 pb-6 bg-white">
          {!showSummary && currentStep?.flavorMode === "half" ? (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={advanceHalf}
              disabled={!halfReady}
              className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl text-[14px] font-black transition-all shadow-lg ${
                halfReady ? "text-white" : "bg-slate-100 text-slate-400 cursor-not-allowed"
              }`}
              style={halfReady ? { background: "linear-gradient(135deg, #111 0%, #333 100%)" } : {}}
            >
              <span>{isLast ? "Ver resumo" : "Próxima etapa"}</span>
              <ChevronRight className="w-5 h-5" />
            </motion.button>
          ) : showSummary ? (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => onAdd(selections.filter(Boolean) as BundleStepSelection[], notes, qty)}
              className="w-full flex items-center justify-between px-5 py-4 rounded-2xl text-[14px] font-black text-white shadow-2xl relative overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${BRAND} 0%, ${BRAND_DARK} 100%)` }}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                  <ShoppingCart className="w-4 h-4" />
                </div>
                <span>Adicionar combo</span>
              </div>
              <motion.span
                key={`${qty}-${bundle.price}`}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="font-black"
              >
                {fmt(bundle.price * qty)}
              </motion.span>
            </motion.button>
          ) : null}
        </div>
      </motion.div>
    </div>
  );
}
