import React, { useState, useEffect } from "react";
import { X, DollarSign, CreditCard, Smartphone, CheckCircle, Plus, Trash2, Split, AlertTriangle, ChevronDown } from "lucide-react";
import { cn } from "@/src/lib/utils";

interface PaymentEntry {
  method: "cash" | "card" | "pix";
  amount: string;
  installments?: number;
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  comanda: any;
  onConfirm: (paymentMethod: string, paymentDetails: any) => Promise<void>;
}

const METHOD_CONFIG = {
  cash: { label: "Dinheiro",  icon: DollarSign,  activeBg: "bg-emerald-500", bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", activeText: "text-white" },
  card: { label: "Cartão",    icon: CreditCard,   activeBg: "bg-blue-500",    bg: "bg-blue-50 border-blue-200",       text: "text-blue-700",    activeText: "text-white" },
  pix:  { label: "Pix",       icon: Smartphone,   activeBg: "bg-violet-500",  bg: "bg-violet-50 border-violet-200",   text: "text-violet-700",  activeText: "text-white" },
};

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseBRL(s: string): number {
  const clean = s.replace(/[^\d,]/g, "").replace(",", ".");
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

function formatInput(v: string): string {
  const digits = v.replace(/\D/g, "");
  if (!digits) return "";
  const num = parseInt(digits, 10) / 100;
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function PaymentModal({ isOpen, onClose, comanda, onConfirm }: PaymentModalProps) {
  const [mode, setMode] = useState<"single" | "mixed">("single");
  const [singleMethod, setSingleMethod]     = useState<"cash" | "card" | "pix">("cash");
  const [singleInstallments, setSingleInstallments] = useState(1);
  const [singleAmount, setSingleAmount]     = useState(""); // vazio = pagar tudo
  const [entries, setEntries] = useState<PaymentEntry[]>([
    { method: "cash", amount: "" },
    { method: "pix",  amount: "" },
  ]);
  const [loading, setLoading] = useState(false);

  const total      = comanda ? Number(comanda.total)       : 0;
  const alreadyPaid = comanda ? Number(comanda.paidAmount || 0) : 0;
  const remaining  = Math.max(0, total - alreadyPaid);

  useEffect(() => {
    if (isOpen) {
      setMode("single");
      setSingleMethod("cash");
      setSingleInstallments(1);
      setSingleAmount("");
      setEntries([{ method: "cash", amount: "" }, { method: "pix", amount: "" }]);
    }
  }, [isOpen]);

  // ── Cálculos modo único ──────────────────────────────────────────────────────
  const singleAmountNum  = singleAmount ? parseBRL(singleAmount) : remaining;
  const singleIsPartial  = singleAmountNum < remaining - 0.01;
  const singleBalance    = remaining - singleAmountNum;
  const singleOverpay    = singleAmountNum > remaining + 0.01;

  // ── Cálculos modo misto ──────────────────────────────────────────────────────
  const mixedTotal     = entries.reduce((s, e) => s + parseBRL(e.amount), 0);
  const mixedRemaining = remaining - mixedTotal;
  const mixedIsPartial = mixedRemaining > 0.01 && mixedTotal > 0.01;
  const canConfirmMixed = mixedTotal > 0.01 && mixedTotal <= remaining + 0.01;

  const handleConfirm = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (mode === "single") {
        if (singleOverpay) return;
        const paying = singleAmountNum;
        const isPartial = paying < remaining - 0.01;
        const details = {
          mode: "single",
          method: singleMethod,
          amount: paying,
          installments: singleMethod === "card" ? singleInstallments : 1,
          isPartial,
          totalPaying: paying,
        };
        await onConfirm(singleMethod, details);
      } else {
        const validEntries = entries.filter(e => parseBRL(e.amount) > 0);
        if (!validEntries.length) return;
        const methods = [...new Set(validEntries.map(e => e.method))];
        const methodLabel = methods.length === 1 ? methods[0] : "mixed";
        const totalPaying = validEntries.reduce((s, e) => s + parseBRL(e.amount), 0);
        const isPartial = totalPaying < remaining - 0.01;
        const details = {
          mode: "mixed",
          entries: validEntries.map(e => ({
            method: e.method,
            amount: parseBRL(e.amount),
            installments: e.method === "card" ? (e.installments || 1) : 1,
          })),
          isPartial,
          totalPaying,
        };
        await onConfirm(methodLabel, details);
      }
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const updateEntry = (idx: number, field: keyof PaymentEntry, value: any) =>
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));

  const addEntry    = () => setEntries(prev => [...prev, { method: "cash", amount: "" }]);
  const removeEntry = (idx: number) => setEntries(prev => prev.filter((_, i) => i !== idx));

  if (!isOpen || !comanda) return null;

  const canConfirmSingle = singleAmountNum > 0.01 && !singleOverpay;

  return (
    <div
      className="fixed inset-0 bg-black/60 z-[100] flex items-end sm:items-center justify-center sm:p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-[28px] sm:rounded-[28px] shadow-2xl w-full sm:max-w-md overflow-hidden border border-zinc-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-black text-zinc-900 tracking-tight">Finalizar Pagamento</h3>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-0.5">
              {comanda.client?.name} • Comanda #{comanda.id?.slice(-6).toUpperCase()}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-100 text-zinc-400 rounded-xl transition-all">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">

          {/* Total box */}
          <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-100 text-center">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">
              {alreadyPaid > 0 ? "Saldo Restante" : "Total da Comanda"}
            </p>
            <p className="text-3xl font-black text-zinc-900 tracking-tighter">{fmtBRL(remaining)}</p>
            {alreadyPaid > 0 && (
              <div className="mt-2 flex items-center justify-center gap-3 text-[10px] font-bold flex-wrap">
                <span className="text-zinc-400">Total: {fmtBRL(total)}</span>
                <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
                  Já pago: {fmtBRL(alreadyPaid)}
                </span>
              </div>
            )}
          </div>

          {/* Tabs: único / misto */}
          <div className="flex gap-1 p-1 bg-zinc-100 rounded-xl">
            {([["single", CheckCircle, "Pagamento Único"], ["mixed", Split, "Misto"]] as const).map(([v, Icon, label]) => (
              <button
                key={v}
                onClick={() => setMode(v)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                  mode === v ? "bg-white shadow-sm text-zinc-900" : "text-zinc-400 hover:text-zinc-600"
                )}
              >
                <Icon size={12} /> {label}
              </button>
            ))}
          </div>

          {/* ── MODO ÚNICO ── */}
          {mode === "single" && (
            <div className="space-y-4">
              {/* Método */}
              <div>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Forma de Pagamento</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["cash", "card", "pix"] as const).map(m => {
                    const cfg  = METHOD_CONFIG[m];
                    const Icon = cfg.icon;
                    const active = singleMethod === m;
                    return (
                      <button
                        key={m}
                        onClick={() => setSingleMethod(m)}
                        className={cn(
                          "flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all",
                          active ? `${cfg.activeBg} border-transparent shadow-lg` : `${cfg.bg} hover:opacity-90`
                        )}
                      >
                        <Icon size={22} className={active ? cfg.activeText : cfg.text} />
                        <span className={cn("text-[10px] font-black uppercase tracking-wider", active ? "text-white" : cfg.text)}>
                          {cfg.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Campo de valor */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Valor a Pagar</p>
                  <button
                    onClick={() => setSingleAmount("")}
                    className="text-[10px] font-black text-amber-600 hover:text-amber-700"
                  >
                    Pagar tudo ({fmtBRL(remaining)})
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-zinc-400">R$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={singleAmount}
                    onChange={e => setSingleAmount(formatInput(e.target.value))}
                    placeholder={fmtBRL(remaining).replace("R$ ", "")}
                    className={cn(
                      "w-full pl-10 pr-4 py-3 border-2 rounded-2xl text-lg font-black text-zinc-900 outline-none transition-all",
                      singleOverpay
                        ? "border-red-300 bg-red-50 focus:border-red-400"
                        : singleIsPartial && singleAmount
                        ? "border-amber-300 bg-amber-50 focus:border-amber-400"
                        : "border-zinc-200 bg-white focus:border-amber-400"
                    )}
                  />
                </div>

                {/* Feedback de valor */}
                {singleAmount && (
                  <div className={cn(
                    "mt-2 flex items-center justify-between p-2.5 rounded-xl text-xs font-black border",
                    singleOverpay
                      ? "bg-red-50 border-red-200 text-red-700"
                      : singleIsPartial
                      ? "bg-amber-50 border-amber-200 text-amber-700"
                      : "bg-emerald-50 border-emerald-200 text-emerald-700"
                  )}>
                    <span>
                      {singleOverpay
                        ? "⚠️ Valor acima do saldo"
                        : singleIsPartial
                        ? `⚠️ Pagamento parcial — saldo restante:`
                        : "✅ Quita o total"}
                    </span>
                    {singleIsPartial && !singleOverpay && <span>{fmtBRL(singleBalance)}</span>}
                    {singleOverpay && <span>-{fmtBRL(singleAmountNum - remaining)}</span>}
                  </div>
                )}

                {/* Info pagamento parcial */}
                {singleIsPartial && singleAmount && !singleOverpay && (
                  <div className="flex items-start gap-2 mt-2 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                    <AlertTriangle size={13} className="text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-blue-600 font-medium leading-relaxed">
                      Será registrado <strong>{fmtBRL(singleAmountNum)}</strong> agora. O saldo de <strong>{fmtBRL(singleBalance)}</strong> ficará em aberto para cobrança futura.
                    </p>
                  </div>
                )}
              </div>

              {/* Parcelamento */}
              {singleMethod === "card" && (
                <div>
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Parcelamento</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3, 4, 5, 6].map(n => {
                      const parcela = (singleAmount ? singleAmountNum : remaining) / n;
                      return (
                        <button
                          key={n}
                          onClick={() => setSingleInstallments(n)}
                          className={cn(
                            "py-2.5 rounded-xl border text-xs font-black transition-all",
                            singleInstallments === n
                              ? "bg-blue-500 text-white border-transparent shadow-sm"
                              : "bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100"
                          )}
                        >
                          {n === 1 ? "À vista" : `${n}x`}
                          {n > 1 && (
                            <span className="block text-[8px] font-bold opacity-80">
                              {fmtBRL(parcela)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── MODO MISTO ── */}
          {mode === "mixed" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Divisão do Pagamento</p>
                <button onClick={addEntry} className="flex items-center gap-1 text-[10px] font-black text-amber-600 hover:text-amber-700">
                  <Plus size={12} /> Adicionar
                </button>
              </div>

              {entries.map((entry, idx) => (
                <div key={idx} className="flex items-start gap-2 p-3 bg-zinc-50 rounded-2xl border border-zinc-100">
                  <select
                    value={entry.method}
                    onChange={e => updateEntry(idx, "method", e.target.value)}
                    className="text-xs font-bold bg-white border border-zinc-200 rounded-xl px-2 py-2 outline-none text-zinc-700 cursor-pointer"
                  >
                    <option value="cash">💵 Dinheiro</option>
                    <option value="card">💳 Cartão</option>
                    <option value="pix">📲 Pix</option>
                  </select>
                  <div className="flex-1">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">R$</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={entry.amount}
                        onChange={e => updateEntry(idx, "amount", formatInput(e.target.value))}
                        placeholder="0,00"
                        className="w-full pl-9 pr-3 py-2 text-sm font-bold bg-white border border-zinc-200 rounded-xl outline-none focus:border-amber-400 text-zinc-900"
                      />
                    </div>
                    {entry.method === "card" && (
                      <select
                        value={entry.installments || 1}
                        onChange={e => updateEntry(idx, "installments", parseInt(e.target.value))}
                        className="mt-1.5 w-full text-xs font-bold bg-white border border-zinc-200 rounded-xl px-2 py-1.5 outline-none text-blue-600 cursor-pointer"
                      >
                        {[1,2,3,4,5,6].map(n => (
                          <option key={n} value={n}>
                            {n === 1 ? "À vista" : `${n}x de ${fmtBRL((parseBRL(entry.amount) || 0) / n)}`}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  {entries.length > 1 && (
                    <button onClick={() => removeEntry(idx)} className="p-1.5 hover:bg-red-50 text-zinc-300 hover:text-red-400 rounded-lg transition-all mt-0.5">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}

              {/* Saldo misto */}
              <div className={cn(
                "flex items-center justify-between p-3 rounded-xl text-xs font-black border",
                Math.abs(mixedRemaining) < 0.01
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : mixedRemaining > 0
                  ? "bg-amber-50 border-amber-200 text-amber-700"
                  : "bg-red-50 border-red-200 text-red-700"
              )}>
                <span>
                  {Math.abs(mixedRemaining) < 0.01
                    ? "✅ Valores conferem!"
                    : mixedRemaining > 0
                    ? "⚠️ Faltam"
                    : "⚠️ Excesso"}
                </span>
                {Math.abs(mixedRemaining) >= 0.01 && <span>{fmtBRL(Math.abs(mixedRemaining))}</span>}
              </div>

              {mixedIsPartial && (
                <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                  <AlertTriangle size={13} className="text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-blue-600 font-medium leading-relaxed">
                    Será registrado <strong>{fmtBRL(mixedTotal)}</strong> agora. O saldo de <strong>{fmtBRL(mixedRemaining)}</strong> ficará em aberto.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-100 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || (mode === "single" && !canConfirmSingle) || (mode === "mixed" && !canConfirmMixed)}
            className={cn(
              "flex-[2] py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg",
              loading || (mode === "single" && !canConfirmSingle) || (mode === "mixed" && !canConfirmMixed)
                ? "bg-zinc-200 text-zinc-400 cursor-not-allowed shadow-none"
                : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20 active:scale-95"
            )}
          >
            <CheckCircle size={14} />
            {loading
              ? "Processando..."
              : mode === "single" && singleIsPartial && singleAmount
              ? `Pagar ${fmtBRL(singleAmountNum)} (Parcial)`
              : mode === "mixed" && mixedIsPartial
              ? `Pagar ${fmtBRL(mixedTotal)} (Parcial)`
              : "Confirmar Pagamento"}
          </button>
        </div>
      </div>
    </div>
  );
}
