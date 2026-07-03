import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft, ShoppingBag, Plus, Minus, X, ChevronRight, ChevronLeft,
  Store, Search, Check, MapPin, Phone, User, Truck, Package,
  Send, Loader2, CheckCircle2, Clock, Star, Zap,
} from "lucide-react";
import { useToast } from "../../components";

// ── Types ──────────────────────────────────────────────────────────────────

interface Variant { id: string; name: string; price: number; }
interface Product {
  id: string; name: string; description: string | null; price: number;
  imageUrl: string | null; available: boolean; variants: Variant[];
}
interface Category { id: string; name: string; products: Product[]; }
interface TenantMenu {
  id: string; name: string; slug: string; description: string | null;
  logoUrl: string | null; address: string | null; whatsapp: string | null;
  isOpen: boolean; businessHours: string | null;
  delivery_config: string | null; payment_methods: string | null; order_mode: string | null;
  categories: Category[];
}
interface CartItem {
  productId: string; name: string; price: number; qty: number;
  variantId?: string; variantName?: string; note?: string;
}
type OrderType = "DELIVERY" | "PICKUP";
type PayMethod = "PIX" | "CREDIT" | "DEBIT" | "MEAL" | "FOOD" | "CASH";
type CheckoutStep = "info" | "payment" | "review" | "done";

interface Props {
  tenantSlug: string; tenantName: string; tenantLogo: string | null;
  primaryColor: string; onBack: () => void;
}

// ── Constants ──────────────────────────────────────────────────────────────

const PAY_CONFIG: { id: PayMethod; key: string; label: string; sublabel: string; icon: React.ReactNode }[] = [
  { id: "PIX",    key: "pix",    label: "Pix",           sublabel: "Instantâneo",      icon: <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M11.354 2.168a.9.9 0 0 1 1.292 0l2.828 2.829 2.829-2.829a.9.9 0 0 1 1.273 1.273l-2.829 2.829 2.829 2.828a.9.9 0 0 1-1.273 1.273l-2.829-2.828-2.828 2.828a.9.9 0 0 1-1.273-1.273l2.828-2.828-2.828-2.829a.9.9 0 0 1-.02-1.273Zm.02 9.556-2.828 2.828-2.829-2.828a.9.9 0 0 0-1.273 1.273l2.829 2.829-2.829 2.828a.9.9 0 1 0 1.273 1.273l2.829-2.828 2.828 2.828a.9.9 0 0 0 1.273-1.273l-2.828-2.828 2.828-2.829a.9.9 0 0 0-1.273-1.273Z"/></svg> },
  { id: "CREDIT", key: "credit", label: "Crédito",       sublabel: "Cartão de crédito", icon: <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20"/><path d="M6 15h4"/></svg> },
  { id: "DEBIT",  key: "debit",  label: "Débito",        sublabel: "Cartão de débito",  icon: <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20"/><circle cx="17" cy="15" r="1.5" fill="currentColor"/></svg> },
  { id: "MEAL",   key: "meal",   label: "Vale Refeição", sublabel: "Alimentação",       icon: <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg> },
  { id: "FOOD",   key: "food",   label: "Vale Aliment.", sublabel: "Alimentação",       icon: <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2v6a6 6 0 0 0 12 0V2"/><path d="M6 14H4v6h16v-6h-2"/></svg> },
  { id: "CASH",   key: "cash",   label: "Dinheiro",      sublabel: "Pagar na entrega",  icon: <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/></svg> },
];

// ── Helpers ────────────────────────────────────────────────────────────────

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
function maskCep(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}
function parseJson(raw: string | null) { try { return raw ? JSON.parse(raw) : {}; } catch { return {}; } }
function getDeliveryFee(raw: string | null) { const c = parseJson(raw); return typeof c.delivery_fee === "number" ? c.delivery_fee : 0; }
function getMinOrder(raw: string | null) { const c = parseJson(raw); return typeof c.min_order === "number" ? c.min_order : 0; }
function getEnabledPayments(raw: string | null) {
  const c = parseJson(raw);
  return PAY_CONFIG.filter(p => !c[p.key] || c[p.key].enabled !== false);
}
function formatAddress(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const a = JSON.parse(raw);
    if (typeof a === "object") {
      return [
        a.street && a.number ? `${a.street}, ${a.number}` : a.street,
        a.neighborhood, a.city && a.state ? `${a.city} - ${a.state}` : a.city,
      ].filter(Boolean).join(", ") || null;
    }
  } catch {}
  return typeof raw === "string" && !raw.startsWith("{") ? raw : null;
}

// ── Field ──────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-black uppercase tracking-widest text-gray-400">{label}</label>
      {children}
    </div>
  );
}

const inp = "w-full px-4 py-3.5 rounded-2xl bg-gray-50 border border-gray-100 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:border-gray-300 transition-all";

// ── Product Modal ──────────────────────────────────────────────────────────

function ProductModal({ product, primary, onClose, onAdd }: {
  product: Product; primary: string;
  onClose: () => void;
  onAdd: (item: Omit<CartItem, "qty">, qty: number) => void;
}) {
  const [variant, setVariant] = useState<Variant | null>(
    product.variants.length === 1 ? product.variants[0] : null
  );
  const [note, setNote] = useState("");
  const [qty, setQty] = useState(1);
  const price = variant ? variant.price : product.price;
  const canAdd = product.variants.length === 0 || variant !== null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.7)" }} onClick={onClose}>
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 32, stiffness: 320 }}
        className="w-full max-w-lg bg-white rounded-t-[2rem] overflow-hidden shadow-2xl max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}>

        {/* Imagem */}
        {product.imageUrl ? (
          <div className="relative flex-shrink-0" style={{ height: 240 }}>
            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 50%)" }} />
            <button onClick={onClose}
              className="absolute top-4 left-4 w-10 h-10 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg">
              <X className="w-5 h-5 text-gray-700" />
            </button>
            <div className="absolute bottom-4 left-5 right-5">
              <h2 className="text-2xl font-black text-white drop-shadow-lg">{product.name}</h2>
              <p className="text-xl font-black mt-1 drop-shadow-lg" style={{ color: "white" }}>
                {product.variants.length > 1
                  ? `A partir de ${fmt(Math.min(...product.variants.map(v => v.price)))}`
                  : fmt(price)}
              </p>
            </div>
          </div>
        ) : (
          <div className="relative flex-shrink-0 bg-gray-50 px-5 pt-5 pb-4">
            <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors">
              <X className="w-5 h-5 text-gray-600" />
            </button>
            <h2 className="text-xl font-black text-gray-900 pr-12">{product.name}</h2>
            <p className="text-2xl font-black mt-1" style={{ color: primary }}>{fmt(price)}</p>
          </div>
        )}

        <div className="overflow-y-auto flex-1 px-5 py-4">
          {product.description && !product.imageUrl && (
            <p className="text-sm text-gray-500 leading-relaxed mb-4">{product.description}</p>
          )}
          {product.description && product.imageUrl && (
            <p className="text-sm text-gray-500 leading-relaxed mb-4">{product.description}</p>
          )}

          {/* Variantes */}
          {product.variants.length > 1 && (
            <div className="mb-5">
              <div className="flex items-center justify-between mb-3">
                <p className="font-black text-gray-900 text-sm">Escolha uma opção</p>
                <span className="text-[10px] font-black uppercase px-2 py-1 rounded-full bg-red-50 text-red-500">Obrigatório</span>
              </div>
              <div className="space-y-2">
                {product.variants.map(v => (
                  <button key={v.id} onClick={() => setVariant(v)}
                    className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border-2 transition-all ${variant?.id === v.id ? "bg-opacity-5 shadow-sm" : "border-gray-100 bg-gray-50 hover:border-gray-200"}`}
                    style={variant?.id === v.id ? { borderColor: primary, background: primary + "08" } : {}}>
                    <span className="font-semibold text-sm text-gray-800">{v.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-black text-gray-800">{fmt(v.price)}</span>
                      <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all"
                        style={variant?.id === v.id
                          ? { borderColor: primary, background: primary }
                          : { borderColor: "#d1d5db" }}>
                        {variant?.id === v.id && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Observação */}
          <div>
            <p className="font-black text-gray-900 text-sm mb-2">Alguma observação? <span className="text-gray-400 font-normal text-xs">(opcional)</span></p>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              placeholder="Ex: sem cebola, maionese à parte..."
              rows={3} maxLength={140}
              className="w-full text-sm border-2 border-gray-100 rounded-2xl px-4 py-3 resize-none focus:outline-none focus:border-gray-200 bg-gray-50 text-gray-700 placeholder-gray-400 transition-all" />
            <p className="text-xs text-gray-400 text-right mt-1">{note.length}/140</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-8 pt-3 bg-white flex-shrink-0 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <div className="flex items-center border-2 border-gray-200 rounded-2xl overflow-hidden">
              <button onClick={() => setQty(q => Math.max(1, q - 1))}
                className="w-12 h-12 flex items-center justify-center hover:bg-gray-50 transition-colors">
                <Minus className="w-4 h-4 text-gray-600" />
              </button>
              <span className="w-8 text-center font-black text-gray-900 text-base">{qty}</span>
              <button onClick={() => setQty(q => q + 1)}
                className="w-12 h-12 flex items-center justify-center hover:bg-gray-50 transition-colors">
                <Plus className="w-4 h-4 text-gray-600" />
              </button>
            </div>
            <button disabled={!canAdd}
              onClick={() => {
                if (canAdd) {
                  onAdd({ productId: product.id, name: product.name, price, variantId: variant?.id, variantName: variant?.name, note: note || undefined }, qty);
                  onClose();
                }
              }}
              className="flex-1 h-12 rounded-2xl font-black text-white text-sm disabled:opacity-40 shadow-lg transition-transform active:scale-95"
              style={{ background: canAdd ? primary : "#9ca3af" }}>
              Adicionar · {fmt(price * qty)}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Checkout ───────────────────────────────────────────────────────────────

function CheckoutDrawer({ items, tenant, primary, deliveryFee, minOrder, enabledPays, onClose, onOrderPlaced }: {
  items: CartItem[]; tenant: TenantMenu; primary: string;
  deliveryFee: number; minOrder: number;
  enabledPays: typeof PAY_CONFIG;
  onClose: () => void; onOrderPlaced: () => void;
}) {
  const toast = useToast();
  const [step, setStep] = useState<CheckoutStep>("info");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "", phone: "", orderType: "DELIVERY" as OrderType,
    cep: "", street: "", number: "", complement: "", neighborhood: "", city: "", state: "",
    payMethod: "CASH" as PayMethod, payDetail: "",
  });
  const [cepLoading, setCepLoading] = useState(false);

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const fee = form.orderType === "PICKUP" ? 0 : deliveryFee;
  const total = subtotal + fee;
  const meetsMin = minOrder === 0 || subtotal >= minOrder;
  const canDeliver = tenant.order_mode !== "PICKUP_ONLY";
  const canPickup = tenant.order_mode !== "DELIVERY_ONLY";

  const addressStr = form.orderType === "PICKUP" ? "Retirada no local" :
    [form.street && form.number ? `${form.street}, ${form.number}` : form.street,
      form.complement, form.neighborhood,
      form.city && form.state ? `${form.city} - ${form.state}` : form.city,
      form.cep ? `CEP ${form.cep}` : ""].filter(Boolean).join(", ");

  async function fetchCep(cep: string) {
    const d = cep.replace(/\D/g, "");
    if (d.length !== 8) return;
    setCepLoading(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
      const data = await r.json();
      if (!data.erro) setForm(f => ({ ...f, street: data.logradouro || "", neighborhood: data.bairro || "", city: data.localidade || "", state: data.uf || "" }));
    } catch {} finally { setCepLoading(false); }
  }

  async function handleOrder() {
    setLoading(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: form.name,
          customerPhone: form.phone.replace(/\D/g, ""),
          address: addressStr,
          orderType: form.orderType,
          paymentMethod: form.payMethod,
          paymentDetail: form.payDetail || null,
          tenantId: tenant.id,
          deliveryFee: fee,
          items: items.map(i => ({ productId: i.productId, productVariantId: i.variantId ?? null, quantity: i.qty, notes: i.note ?? null })),
        }),
      });
      if (res.ok) setStep("done");
      else toast.error("Erro ao enviar pedido. Tente novamente.");
    } catch { toast.error("Erro de conexão."); }
    setLoading(false);
  }

  const canGoNext = form.name.trim().length >= 2 && form.phone.replace(/\D/g, "").length >= 10 &&
    (form.orderType === "PICKUP" || (form.street.trim() && form.number.trim() && form.city.trim()));

  const steps: CheckoutStep[] = ["info", "payment", "review"];
  const stepIdx = steps.indexOf(step as any);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.65)" }}
      onClick={() => step !== "done" && onClose()}>
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 32, stiffness: 300 }}
        className="w-full max-w-lg bg-white rounded-t-[2rem] overflow-hidden shadow-2xl max-h-[94vh] flex flex-col"
        onClick={e => e.stopPropagation()}>

        {/* Handle bar */}
        {step !== "done" && <div className="flex justify-center pt-3 pb-1 flex-shrink-0"><div className="w-10 h-1 bg-gray-200 rounded-full" /></div>}

        {/* Header */}
        <div className="flex items-center px-5 py-3 flex-shrink-0">
          {step !== "info" && step !== "done" ? (
            <button onClick={() => setStep(step === "payment" ? "info" : "payment")}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors mr-2">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
          ) : <div className="w-9 mr-2" />}

          <div className="flex-1">
            <h3 className="font-black text-gray-900 text-base">
              {step === "info" && "Seus dados"}
              {step === "payment" && "Forma de pagamento"}
              {step === "review" && "Revise seu pedido"}
              {step === "done" && "Pedido confirmado!"}
            </h3>
            {step !== "done" && (
              <p className="text-xs text-gray-400 mt-0.5">{tenant.name}</p>
            )}
          </div>

          {step !== "done" && (
            <button onClick={onClose} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors">
              <X className="w-4 h-4 text-gray-600" />
            </button>
          )}
        </div>

        {/* Progress */}
        {step !== "done" && (
          <div className="flex gap-1.5 px-5 pb-4 flex-shrink-0">
            {steps.map((s, i) => (
              <div key={s} className="flex-1 h-1 rounded-full transition-all duration-500"
                style={{ background: stepIdx >= i ? primary : "#e5e7eb" }} />
            ))}
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-5 py-2">
          <AnimatePresence mode="wait">

            {/* INFO */}
            {step === "info" && (
              <motion.div key="info" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5 pb-4">
                {/* Tipo */}
                {canDeliver && canPickup && (
                  <Field label="Como quer receber?">
                    <div className="grid grid-cols-2 gap-2">
                      {([["DELIVERY", "Entrega", Truck, "Receber em casa"] as const, ["PICKUP", "Retirada", Package, "Buscar no local"] as const])
                        .filter(([t]) => t === "DELIVERY" ? canDeliver : canPickup)
                        .map(([type, label, Icon, sub]) => (
                          <button key={type} onClick={() => setForm(f => ({ ...f, orderType: type }))}
                            className={`flex flex-col items-center gap-1 py-4 px-3 rounded-2xl border-2 transition-all ${form.orderType === type ? "shadow-md" : "border-gray-100 bg-gray-50 hover:border-gray-200"}`}
                            style={form.orderType === type ? { borderColor: primary, background: primary + "0d" } : {}}>
                            <Icon className="w-5 h-5" style={form.orderType === type ? { color: primary } : { color: "#9ca3af" }} />
                            <span className="font-black text-sm" style={form.orderType === type ? { color: primary } : { color: "#374151" }}>{label}</span>
                            <span className="text-[10px] text-gray-400">{sub}</span>
                          </button>
                        ))}
                    </div>
                  </Field>
                )}

                {/* Nome */}
                <Field label="Seu nome">
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Como te chamamos?" className={inp + " pl-11"} />
                  </div>
                </Field>

                {/* WhatsApp */}
                <Field label="WhatsApp">
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: maskPhone(e.target.value) }))}
                      placeholder="(00) 00000-0000" inputMode="tel" className={inp + " pl-11"} />
                  </div>
                </Field>

                {/* Endereço */}
                {form.orderType === "DELIVERY" && (
                  <div className="space-y-3 pt-2 border-t border-gray-100">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Endereço de entrega</p>

                    <Field label="CEP">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input value={form.cep} onChange={e => setForm(f => ({ ...f, cep: maskCep(e.target.value) }))}
                            onBlur={e => fetchCep(e.target.value)}
                            placeholder="00000-000" inputMode="numeric" className={inp + " pl-11"} />
                          {cepLoading && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />}
                        </div>
                        <button onClick={() => fetchCep(form.cep)}
                          className="px-4 rounded-2xl text-xs font-black bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                          Buscar
                        </button>
                      </div>
                    </Field>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <Field label="Rua / Av.">
                          <input value={form.street} onChange={e => setForm(f => ({ ...f, street: e.target.value }))}
                            placeholder="Nome da rua" className={inp} />
                        </Field>
                      </div>
                      <Field label="Número">
                        <input value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))}
                          placeholder="Nº" inputMode="numeric" className={inp} />
                      </Field>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Complemento">
                        <input value={form.complement} onChange={e => setForm(f => ({ ...f, complement: e.target.value }))}
                          placeholder="Apto, Sala…" className={inp} />
                      </Field>
                      <Field label="Bairro">
                        <input value={form.neighborhood} onChange={e => setForm(f => ({ ...f, neighborhood: e.target.value }))}
                          placeholder="Bairro" className={inp} />
                      </Field>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <Field label="Cidade">
                          <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                            placeholder="Cidade" className={inp} />
                        </Field>
                      </div>
                      <Field label="Estado">
                        <input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value.toUpperCase().slice(0, 2) }))}
                          placeholder="SP" maxLength={2} className={inp} />
                      </Field>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* PAYMENT */}
            {step === "payment" && (
              <motion.div key="payment" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3 pb-4">
                <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Como vai pagar?</p>
                <div className="space-y-2">
                  {enabledPays.map(p => {
                    const selected = form.payMethod === p.id;
                    return (
                      <button key={p.id} onClick={() => setForm(f => ({ ...f, payMethod: p.id, payDetail: "" }))}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all text-left"
                        style={selected
                          ? { borderColor: primary, background: primary + "10", color: primary }
                          : { borderColor: "#f3f4f6", background: "#f9fafb", color: "#374151" }}>
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
                          style={{ background: selected ? primary + "20" : "#e5e7eb", color: selected ? primary : "#6b7280" }}>
                          {p.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-black leading-tight">{p.label}</p>
                          <p className="text-[11px] opacity-60 leading-tight">{p.sublabel}</p>
                        </div>
                        <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                          style={{ borderColor: selected ? primary : "#d1d5db", background: selected ? primary : "transparent" }}>
                          {selected && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {(["CREDIT", "DEBIT", "MEAL", "FOOD"] as PayMethod[]).includes(form.payMethod) && (
                  <div className="pt-1">
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2">Bandeira</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(form.payMethod === "MEAL" || form.payMethod === "FOOD"
                        ? ["Alelo", "Sodexo", "Ticket", "VR Benefícios", "VeroCard", "Visa", "Mastercard", "Elo"]
                        : ["Visa", "Mastercard", "Elo", "Hipercard", "Amex"]
                      ).map(b => {
                        const sel = form.payDetail === b;
                        return (
                          <button key={b} onClick={() => setForm(f => ({ ...f, payDetail: b }))}
                            className="py-2.5 px-3 rounded-xl border-2 text-xs font-black transition-all"
                            style={sel
                              ? { borderColor: primary, background: primary + "10", color: primary }
                              : { borderColor: "#f3f4f6", background: "#f9fafb", color: "#6b7280" }}>
                            {b}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {form.payMethod === "CASH" && (
                  <div className="pt-1">
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2">Troco para quanto? <span className="normal-case text-gray-300">(opcional)</span></p>
                    <input value={form.payDetail} onChange={e => setForm(f => ({ ...f, payDetail: e.target.value }))}
                      placeholder="Ex: R$ 50,00" className={inp} />
                  </div>
                )}
              </motion.div>
            )}

            {/* REVIEW */}
            {step === "review" && (
              <motion.div key="review" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3 pb-4">
                {/* Itens */}
                <div className="rounded-2xl overflow-hidden border border-gray-100">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                    <p className="text-xs font-black text-gray-500 uppercase tracking-wider">Itens do pedido</p>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {items.map(item => (
                      <div key={`${item.productId}-${item.variantId ?? ""}`} className="flex items-start justify-between px-4 py-3 gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-xs text-white mt-0.5"
                            style={{ background: primary }}>
                            {item.qty}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 text-sm">{item.name}</p>
                            {item.variantName && <p className="text-xs text-gray-500">{item.variantName}</p>}
                            {item.note && <p className="text-xs text-gray-400 italic">{item.note}</p>}
                          </div>
                        </div>
                        <span className="font-black text-sm text-gray-900 flex-shrink-0">{fmt(item.price * item.qty)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 space-y-1.5">
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Subtotal</span><span className="font-semibold">{fmt(subtotal)}</span>
                    </div>
                    {fee > 0 && (
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>Taxa de entrega</span><span className="font-semibold">{fmt(fee)}</span>
                      </div>
                    )}
                    {fee === 0 && form.orderType === "DELIVERY" && (
                      <div className="flex justify-between text-sm font-bold text-green-600">
                        <span>Entrega</span><span>Grátis 🎉</span>
                      </div>
                    )}
                    <div className="flex justify-between font-black text-base pt-1 border-t border-gray-200">
                      <span className="text-gray-900">Total</span>
                      <span style={{ color: primary }}>{fmt(total)}</span>
                    </div>
                  </div>
                </div>

                {/* Info do cliente */}
                <div className="rounded-2xl overflow-hidden border border-gray-100">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                    <p className="text-xs font-black text-gray-500 uppercase tracking-wider">Seus dados</p>
                  </div>
                  <div className="px-4 py-3 space-y-2">
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-7 h-7 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <User className="w-3.5 h-3.5 text-gray-500" />
                      </div>
                      <div>
                        <span className="font-bold text-gray-900">{form.name}</span>
                        <span className="text-gray-400 ml-2 text-xs">{form.phone}</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 text-sm">
                      <div className="w-7 h-7 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        {form.orderType === "DELIVERY" ? <Truck className="w-3.5 h-3.5 text-gray-500" /> : <Package className="w-3.5 h-3.5 text-gray-500" />}
                      </div>
                      <span className="text-gray-700 text-sm leading-snug">{addressStr}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-7 h-7 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm">{PAY_CONFIG.find(p => p.id === form.payMethod)?.emoji}</span>
                      </div>
                      <span className="font-bold text-gray-900">
                        {PAY_CONFIG.find(p => p.id === form.payMethod)?.label}
                        {form.payDetail && <span className="text-gray-400 font-normal ml-1">· {form.payDetail}</span>}
                      </span>
                    </div>
                  </div>
                </div>

                {!meetsMin && minOrder > 0 && (
                  <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl">
                    <span className="text-lg">⚠️</span>
                    <p className="text-sm text-amber-700 font-medium">
                      Pedido mínimo: <strong>{fmt(minOrder)}</strong> — faltam {fmt(minOrder - subtotal)}
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {/* DONE */}
            {step === "done" && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center py-8 text-center gap-5 pb-4">
                <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.15, type: "spring", damping: 14, stiffness: 200 }}
                  className="w-24 h-24 rounded-3xl flex items-center justify-center shadow-xl"
                  style={{ background: `linear-gradient(135deg, ${primary}, ${primary}cc)` }}>
                  <CheckCircle2 className="w-12 h-12 text-white" strokeWidth={2} />
                </motion.div>

                <div>
                  <h3 className="text-2xl font-black text-gray-900">Pedido enviado!</h3>
                  <p className="text-sm text-gray-500 mt-2 leading-relaxed max-w-xs mx-auto">
                    Seu pedido foi registrado em <strong className="text-gray-800">{tenant.name}</strong> e você receberá confirmação pelo WhatsApp.
                  </p>
                </div>

                <div className="w-full bg-gray-50 rounded-2xl p-4 text-left space-y-3 border border-gray-100">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Total do pedido</span>
                    <span className="font-black text-lg" style={{ color: primary }}>{fmt(total)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Pagamento</span>
                    <span className="font-bold text-gray-800 text-sm">
                      {PAY_CONFIG.find(p => p.id === form.payMethod)?.emoji}{" "}
                      {PAY_CONFIG.find(p => p.id === form.payMethod)?.label}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">{form.orderType === "DELIVERY" ? "Entrega" : "Retirada"}</span>
                    <span className="font-bold text-gray-800 text-sm truncate max-w-[60%] text-right text-xs">{addressStr}</span>
                  </div>
                </div>

                <button onClick={() => { onOrderPlaced(); onClose(); }}
                  className="w-full py-4 rounded-2xl font-black text-white text-base shadow-lg active:scale-95 transition-transform"
                  style={{ background: primary }}>
                  Fechar
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Footer CTA */}
        {step !== "done" && (
          <div className="px-5 pb-8 pt-3 bg-white flex-shrink-0 border-t border-gray-100">
            {step === "info" && (
              <button disabled={!canGoNext} onClick={() => setStep("payment")}
                className="w-full h-14 rounded-2xl font-black text-white text-base flex items-center justify-center gap-2 transition-all disabled:opacity-40 shadow-lg active:scale-95"
                style={{ background: canGoNext ? primary : "#9ca3af" }}>
                Continuar <ChevronRight className="w-5 h-5" />
              </button>
            )}
            {step === "payment" && (
              <button onClick={() => setStep("review")}
                className="w-full h-14 rounded-2xl font-black text-white text-base flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"
                style={{ background: primary }}>
                Revisar pedido <ChevronRight className="w-5 h-5" />
              </button>
            )}
            {step === "review" && (
              <button disabled={loading || !meetsMin} onClick={handleOrder}
                className="w-full h-14 rounded-2xl font-black text-white text-base flex items-center justify-center gap-2 disabled:opacity-40 shadow-lg active:scale-95 transition-transform"
                style={{ background: primary }}>
                {loading
                  ? <Loader2 className="w-5 h-5 animate-spin" />
                  : <><Send className="w-5 h-5" /> Confirmar pedido</>}
              </button>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

export default function CondominiumMenuView({ tenantSlug, tenantName, tenantLogo, primaryColor, onBack }: Props) {
  const [tenant, setTenant] = useState<TenantMenu | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);

  const catRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const catBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/tenants/${tenantSlug}`)
      .then(r => r.json())
      .then(d => { setTenant(d); if (d.categories?.[0]) setActiveCat(d.categories[0].id); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [tenantSlug]);

  useEffect(() => {
    if (!tenant) return;
    const obs: IntersectionObserver[] = [];
    tenant.categories.forEach(cat => {
      const el = catRefs.current[cat.id];
      if (!el) return;
      const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) setActiveCat(cat.id); }, { rootMargin: "-30% 0px -60% 0px" });
      o.observe(el); obs.push(o);
    });
    return () => obs.forEach(o => o.disconnect());
  }, [tenant]);

  useEffect(() => {
    if (!activeCat || !catBarRef.current) return;
    const pill = catBarRef.current.querySelector(`[data-cat="${activeCat}"]`) as HTMLElement | null;
    pill?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeCat]);

  function scrollToCat(catId: string) {
    setActiveCat(catId);
    catRefs.current[catId]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function addToCart(item: Omit<CartItem, "qty">, qty: number) {
    setCart(prev => {
      const key = `${item.productId}-${item.variantId ?? ""}`;
      const ex = prev.find(i => `${i.productId}-${i.variantId ?? ""}` === key);
      if (ex) return prev.map(i => `${i.productId}-${i.variantId ?? ""}` === key ? { ...i, qty: i.qty + qty } : i);
      return [...prev, { ...item, qty }];
    });
  }

  function changeQty(productId: string, variantId: string | undefined, delta: number) {
    setCart(prev =>
      prev.map(i => `${i.productId}-${i.variantId ?? ""}` === `${productId}-${variantId ?? ""}` ? { ...i, qty: i.qty + delta } : i)
        .filter(i => i.qty > 0)
    );
  }

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const cartSubtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const deliveryFee = getDeliveryFee(tenant?.delivery_config ?? null);
  const minOrder = getMinOrder(tenant?.delivery_config ?? null);
  const enabledPays = getEnabledPayments(tenant?.payment_methods ?? null);

  const filteredCats = (tenant?.categories ?? []).map(cat => ({
    ...cat,
    products: cat.products.filter(p =>
      !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description ?? "").toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(cat => !search || cat.products.length > 0);

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-4">
        <div className="relative">
          {tenantLogo
            ? <img src={tenantLogo} alt="" className="w-20 h-20 rounded-3xl object-cover shadow-lg" />
            : <div className="w-20 h-20 rounded-3xl bg-gray-100 flex items-center justify-center shadow-lg">
                <Store className="w-10 h-10 text-gray-300" />
              </div>}
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white shadow flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: primaryColor }} />
          </div>
        </div>
        <div className="text-center">
          <p className="font-black text-gray-900">{tenantName}</p>
          <p className="text-sm text-gray-400 mt-0.5">Carregando cardápio...</p>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-white px-6 text-center">
        <Store className="w-14 h-14 text-gray-200" />
        <p className="text-gray-500 font-medium">Cardápio indisponível</p>
        <button onClick={onBack} className="text-sm text-gray-400 underline">Voltar</button>
      </div>
    );
  }

  return (
    <motion.div initial={{ x: "100%", opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: "100%", opacity: 0 }}
      transition={{ type: "spring", damping: 30, stiffness: 280 }}
      className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── Sticky header ─────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-white" style={{ boxShadow: "0 1px 0 #f3f4f6" }}>
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={onBack}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors flex-shrink-0">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>

          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            {tenantLogo
              ? <img src={tenantLogo} alt="" className="w-9 h-9 rounded-xl object-cover flex-shrink-0 shadow-sm" />
              : <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm" style={{ background: primaryColor + "22" }}>
                  <Store className="w-4 h-4" style={{ color: primaryColor }} />
                </div>}
            <div className="min-w-0">
              <p className="font-black text-gray-900 text-sm truncate leading-tight">{tenant.name}</p>
              <div className="flex items-center gap-1.5">
                <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full ${tenant.isOpen ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                  {tenant.isOpen ? "● Aberto" : "● Fechado"}
                </span>
                {deliveryFee === 0 && <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">Entrega grátis</span>}
              </div>
            </div>
          </div>

          <button onClick={() => { setShowSearch(v => !v); setSearch(""); }}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
            <Search className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Search */}
        <AnimatePresence>
          {showSearch && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden">
              <div className="px-4 pb-3">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 rounded-2xl">
                  <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar no cardápio..."
                    className="flex-1 bg-transparent text-sm focus:outline-none text-gray-800 placeholder-gray-400" />
                  {search && (
                    <button onClick={() => setSearch("")} className="flex-shrink-0">
                      <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Category pills */}
        {!search && (
          <div ref={catBarRef} className="flex gap-2 overflow-x-auto px-4 pb-3" style={{ scrollbarWidth: "none" }}>
            {tenant.categories.map(cat => (
              <button key={cat.id} data-cat={cat.id} onClick={() => scrollToCat(cat.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-black tracking-wide transition-all ${activeCat === cat.id ? "text-white shadow-md" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                style={activeCat === cat.id ? { background: primaryColor } : {}}>
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Hero card ─────────────────────────────────────────── */}
      {!search && (
        <div className="bg-white mb-2">
          <div className="px-4 py-5 flex items-center gap-4">
            <div className="relative flex-shrink-0">
              {tenantLogo
                ? <img src={tenantLogo} alt="" className="w-20 h-20 rounded-3xl object-cover"
                    style={{ boxShadow: `0 8px 24px ${primaryColor}44` }} />
                : <div className="w-20 h-20 rounded-3xl flex items-center justify-center"
                    style={{ background: `linear-gradient(135deg, ${primaryColor}22, ${primaryColor}11)` }}>
                    <Store className="w-10 h-10" style={{ color: primaryColor }} />
                  </div>}
              {tenant.isOpen && (
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-green-500 border-2 border-white shadow" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-black text-gray-900 leading-tight">{tenant.name}</h1>
              {tenant.description && (
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{tenant.description}</p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {deliveryFee === 0
                  ? <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
                      <Zap className="w-3 h-3" /> Entrega grátis
                    </span>
                  : <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-full font-semibold">
                      Entrega: {fmt(deliveryFee)}
                    </span>}
                {minOrder > 0 && (
                  <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-full font-semibold">
                    Mín. {fmt(minOrder)}
                  </span>
                )}
                {formatAddress(tenant.address) && (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full max-w-[150px] truncate">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{formatAddress(tenant.address)}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Products ──────────────────────────────────────────── */}
      <div className="flex-1 pb-36">
        {filteredCats.length === 0
          ? (
            <div className="flex flex-col items-center gap-3 py-24 text-center px-6">
              <div className="w-16 h-16 rounded-3xl bg-gray-100 flex items-center justify-center">
                <Search className="w-8 h-8 text-gray-300" />
              </div>
              <p className="font-bold text-gray-500">Nada encontrado para</p>
              <p className="text-gray-400 text-sm">"{search}"</p>
            </div>
          )
          : filteredCats.map(cat => (
            <div key={cat.id} ref={el => { catRefs.current[cat.id] = el; }} className="mb-2">
              {/* Category header */}
              <div className="px-4 pt-6 pb-3 bg-white">
                <h2 className="font-black text-gray-900 text-base">{cat.name}</h2>
                <p className="text-xs text-gray-400 mt-0.5 font-medium">{cat.products.length} {cat.products.length === 1 ? "item" : "itens"}</p>
              </div>

              {/* Products list */}
              <div className="bg-white">
                {cat.products.map((product, idx) => {
                  const inCart = cart.find(i => i.productId === product.id);
                  return (
                    <button key={product.id} onClick={() => setSelectedProduct(product)}
                      className={`w-full flex items-start gap-4 px-4 py-4 text-left group transition-colors hover:bg-gray-50 ${idx < cat.products.length - 1 ? "border-b border-gray-50" : ""}`}>

                      {/* Info */}
                      <div className="flex-1 min-w-0 py-0.5">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-900 text-sm leading-snug">{product.name}</p>
                          {inCart && (
                            <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white"
                              style={{ background: primaryColor }}>
                              {inCart.qty}
                            </span>
                          )}
                        </div>
                        {product.description && (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{product.description}</p>
                        )}
                        <div className="mt-2">
                          {product.variants.length > 1
                            ? <span className="text-sm font-black text-gray-800">
                                A partir de {fmt(Math.min(...product.variants.map(v => v.price)))}
                              </span>
                            : <span className="text-sm font-black text-gray-900">{fmt(product.price)}</span>}
                        </div>
                      </div>

                      {/* Imagem + botão */}
                      <div className="flex-shrink-0 relative">
                        {product.imageUrl ? (
                          <>
                            <img src={product.imageUrl} alt={product.name}
                              className="w-28 h-24 object-cover rounded-2xl shadow-sm" />
                            <div
                              className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center shadow-lg text-white transition-transform group-hover:scale-110 group-hover:shadow-xl"
                              style={{ background: primaryColor }}>
                              <Plus className="w-4 h-4" strokeWidth={2.5} />
                            </div>
                          </>
                        ) : (
                          <div
                            className="w-11 h-11 rounded-2xl border-2 flex items-center justify-center transition-transform group-hover:scale-110"
                            style={{ borderColor: primaryColor + "66", background: primaryColor + "0d" }}>
                            <Plus className="w-5 h-5" style={{ color: primaryColor }} strokeWidth={2.5} />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
      </div>

      {/* ── Floating cart button ───────────────────────────────── */}
      <AnimatePresence>
        {cartCount > 0 && !showCheckout && (
          <motion.div
            initial={{ y: 100, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 100, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 24, stiffness: 300 }}
            className="fixed bottom-6 left-4 right-4 z-40">
            <button onClick={() => setShowCheckout(true)}
              className="w-full flex items-center justify-between px-5 py-4 rounded-2xl text-white font-black text-sm shadow-2xl active:scale-95 transition-transform"
              style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)` }}>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow"
                    style={{ color: primaryColor }}>
                    <span className="text-[10px] font-black">{cartCount}</span>
                  </div>
                </div>
                <span>{cartCount === 1 ? "1 item" : `${cartCount} itens`} na sacola</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-sm font-black">{fmt(cartSubtotal)}</span>
                <ChevronRight className="w-4 h-4 opacity-80" />
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modals ────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedProduct && (
          <ProductModal product={selectedProduct} primary={primaryColor}
            onClose={() => setSelectedProduct(null)} onAdd={addToCart} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCheckout && (
          <CheckoutDrawer
            items={cart} tenant={tenant} primary={primaryColor}
            deliveryFee={deliveryFee} minOrder={minOrder} enabledPays={enabledPays}
            onClose={() => setShowCheckout(false)}
            onOrderPlaced={() => { setCart([]); setShowCheckout(false); }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
