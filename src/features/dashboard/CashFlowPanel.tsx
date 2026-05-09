import React, { useState, useEffect, useCallback } from "react";
import {
  Wallet, ArrowDownCircle, ArrowUpCircle, Lock,
  Unlock, Plus, AlertTriangle, Clock, CheckCircle2,
  TrendingUp, Banknote, CreditCard, QrCode, Receipt,
  History, X,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  PageWrapper, SectionTitle, StatGrid, StatCard, ContentCard,
  Modal, ModalFooter, Button, Input, EmptyState,
} from "../../components";
import { apiJson } from "../../lib/api";
import type { Tenant, CashRegister, CashMovement } from "../../types";

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

const MOVEMENT_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  SANGRIA:          { label: "Sangria",    color: "text-red-600",   bg: "bg-red-50" },
  SUPRIMENTO:       { label: "Suprimento", color: "text-green-600", bg: "bg-green-50" },
  PAYMENT_CASH:     { label: "Dinheiro",   color: "text-blue-600",  bg: "bg-blue-50" },
  PAYMENT_PIX:      { label: "PIX",        color: "text-violet-600",bg: "bg-violet-50" },
  PAYMENT_CREDIT:   { label: "Crédito",    color: "text-orange-600",bg: "bg-orange-50" },
  PAYMENT_DEBIT:    { label: "Débito",     color: "text-cyan-600",  bg: "bg-cyan-50" },
  PAYMENT_VR:       { label: "VR/Ticket",  color: "text-emerald-600",bg: "bg-emerald-50" },
};

interface CashFlowPanelProps {
  slug: string;
  tenant: Tenant;
}

export default function CashFlowPanel({ slug, tenant }: CashFlowPanelProps) {
  const [currentCash, setCurrentCash] = useState<CashRegister | null>(null);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [history, setHistory] = useState<CashRegister[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<"current" | "history">("current");

  // Open modal
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [openingBalance, setOpeningBalance] = useState("0");
  const [operatorName, setOperatorName] = useState("");
  const [openLoading, setOpenLoading] = useState(false);

  // Close modal
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closingBalance, setClosingBalance] = useState("");
  const [closeNotes, setCloseNotes] = useState("");
  const [closeLoading, setCloseLoading] = useState(false);

  // Sangria/Suprimento modal
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [movementType, setMovementType] = useState<"SANGRIA" | "SUPRIMENTO">("SANGRIA");
  const [movementAmount, setMovementAmount] = useState("");
  const [movementDesc, setMovementDesc] = useState("");
  const [movementLoading, setMovementLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [cashRes, histRes] = await Promise.all([
        fetch(`/api/tenants/${slug}/cash/current`, { headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` } }),
        fetch(`/api/tenants/${slug}/cash/history`, { headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` } }),
      ]);
      const cashData = cashRes.ok ? await cashRes.json() : null;
      const histData = histRes.ok ? await histRes.json() : [];
      setCurrentCash(cashData);
      setHistory(histData);

      if (cashData?.status === "OPEN") {
        const movRes = await fetch(`/api/tenants/${slug}/cash/movements`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
        });
        if (movRes.ok) setMovements(await movRes.json());
      } else {
        setMovements([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleOpenCash = async () => {
    setOpenLoading(true);
    try {
      await apiJson(`/api/tenants/${slug}/cash/open`, {
        method: "POST",
        body: JSON.stringify({ openingBalance: parseFloat(openingBalance || "0"), operatorName }),
      });
      setShowOpenModal(false);
      setOpeningBalance("0");
      setOperatorName("");
      fetchData();
    } catch { alert("Erro ao abrir caixa."); }
    finally { setOpenLoading(false); }
  };

  const handleCloseCash = async () => {
    setCloseLoading(true);
    try {
      await apiJson(`/api/tenants/${slug}/cash/close`, {
        method: "POST",
        body: JSON.stringify({ closingBalance: parseFloat(closingBalance || "0"), notes: closeNotes }),
      });
      setShowCloseModal(false);
      setClosingBalance("");
      setCloseNotes("");
      fetchData();
    } catch { alert("Erro ao fechar caixa."); }
    finally { setCloseLoading(false); }
  };

  const handleMovement = async () => {
    setMovementLoading(true);
    try {
      await apiJson(`/api/tenants/${slug}/cash/movement`, {
        method: "POST",
        body: JSON.stringify({ type: movementType, amount: parseFloat(movementAmount || "0"), description: movementDesc }),
      });
      setShowMovementModal(false);
      setMovementAmount("");
      setMovementDesc("");
      fetchData();
    } catch { alert("Erro ao registrar movimento."); }
    finally { setMovementLoading(false); }
  };

  // Compute breakdown from movements
  const paymentTotals = movements.reduce<Record<string, number>>((acc, m) => {
    if (m.type.startsWith("PAYMENT_")) {
      acc[m.type] = (acc[m.type] || 0) + m.amount;
    }
    return acc;
  }, {});

  const totalSangrias = movements.filter((m) => m.type === "SANGRIA").reduce((s, m) => s + m.amount, 0);
  const totalSuprimentos = movements.filter((m) => m.type === "SUPRIMENTO").reduce((s, m) => s + m.amount, 0);
  const totalVendas = movements.filter((m) => m.type.startsWith("PAYMENT_")).reduce((s, m) => s + m.amount, 0);
  const expectedBalance = (currentCash?.openingBalance ?? 0) + (paymentTotals["PAYMENT_CASH"] ?? 0) + totalSuprimentos - totalSangrias;

  const diffBalance = closingBalance
    ? parseFloat(closingBalance) - expectedBalance
    : 0;

  if (loading) {
    return (
      <PageWrapper>
        <div className="flex items-center justify-center h-40 opacity-30">
          <div className="w-8 h-8 border-4 border-[#C9A227] border-t-transparent rounded-full animate-spin" />
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <SectionTitle
        title="Fluxo de Caixa"
        description="Abertura, fechamento, sangrias e suprimentos"
        icon={Wallet}
        action={
          <div className="flex gap-2 flex-wrap">
            {currentCash?.status === "OPEN" ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setMovementType("SANGRIA"); setShowMovementModal(true); }}
                  iconLeft={<ArrowUpCircle className="w-4 h-4 text-red-500" />}
                >
                  Sangria
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setMovementType("SUPRIMENTO"); setShowMovementModal(true); }}
                  iconLeft={<ArrowDownCircle className="w-4 h-4 text-green-500" />}
                >
                  Suprimento
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => { setClosingBalance(""); setCloseNotes(""); setShowCloseModal(true); }}
                  iconLeft={<Lock className="w-4 h-4" />}
                >
                  Fechar Caixa
                </Button>
              </>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowOpenModal(true)}
                iconLeft={<Unlock className="w-4 h-4" />}
              >
                Abrir Caixa
              </Button>
            )}
          </div>
        }
        className="mb-6"
      />

      {/* Status Banner */}
      {currentCash?.status === "OPEN" ? (
        <div className="bg-green-500 text-white rounded-2xl p-4 mb-6 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-black text-sm">Caixa Aberto</p>
            <p className="text-xs opacity-80">
              Aberto às {new Date(currentCash.openedAt).toLocaleString("pt-BR")}
              {currentCash.operatorName ? ` · ${currentCash.operatorName}` : ""}
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-slate-100 text-slate-500 rounded-2xl p-4 mb-6 flex items-center gap-3">
          <Lock className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-black text-sm">Caixa Fechado</p>
            <p className="text-xs">Abra o caixa para registrar vendas e movimentos.</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <StatGrid cols={4} className="mb-6">
        <StatCard
          title="Fundo de Caixa"
          value={fmt(currentCash?.openingBalance ?? 0)}
          icon={Banknote}
          color="default"
          delay={0}
        />
        <StatCard
          title="Vendas (Total)"
          value={fmt(totalVendas)}
          icon={TrendingUp}
          color="success"
          delay={0.1}
        />
        <StatCard
          title="Sangrias"
          value={fmt(totalSangrias)}
          icon={ArrowUpCircle}
          color="danger"
          delay={0.2}
        />
        <StatCard
          title="Saldo Esperado"
          value={fmt(expectedBalance)}
          icon={Wallet}
          color="info"
          delay={0.3}
        />
      </StatGrid>

      {/* Breakdown by payment method */}
      {currentCash?.status === "OPEN" && totalVendas > 0 && (
        <ContentCard className="mb-6">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-700 mb-4">
            Receita por Método de Pagamento
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {(["PAYMENT_CASH", "PAYMENT_PIX", "PAYMENT_CREDIT", "PAYMENT_DEBIT", "PAYMENT_VR"] as const).map((type) => {
              const meta = MOVEMENT_LABELS[type];
              const val = paymentTotals[type] || 0;
              return (
                <div key={type} className={`rounded-xl p-3 ${meta.bg}`}>
                  <p className={`text-[10px] font-black uppercase tracking-widest ${meta.color} mb-1`}>{meta.label}</p>
                  <p className={`text-lg font-black ${meta.color}`}>{fmt(val)}</p>
                </div>
              );
            })}
          </div>
        </ContentCard>
      )}

      {/* View toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveView("current")}
          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
            activeView === "current" ? "bg-[#0D1B3E] text-white" : "bg-slate-100 text-slate-500"
          }`}
        >
          Movimentos do Caixa
        </button>
        <button
          onClick={() => setActiveView("history")}
          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
            activeView === "history" ? "bg-[#0D1B3E] text-white" : "bg-slate-100 text-slate-500"
          }`}
        >
          Histórico de Fechamentos
        </button>
      </div>

      {/* Movements list */}
      {activeView === "current" && (
        <ContentCard padding="none">
          {movements.length === 0 ? (
            <EmptyState
              title="Nenhum movimento"
              description="Os movimentos do caixa aparecerão aqui conforme as vendas."
              icon={History}
            />
          ) : (
            <div className="divide-y divide-slate-100">
              <div className="hidden sm:grid grid-cols-5 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <span className="col-span-2">Descrição</span>
                <span>Tipo</span>
                <span>Hora</span>
                <span className="text-right">Valor</span>
              </div>
              <AnimatePresence>
                {movements.map((m, i) => {
                  const meta = MOVEMENT_LABELS[m.type] || { label: m.type, color: "text-slate-600", bg: "bg-slate-50" };
                  const isOut = m.type === "SANGRIA";
                  return (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.02 }}
                      className="grid grid-cols-1 sm:grid-cols-5 px-5 py-3 hover:bg-slate-50 gap-1 sm:gap-0"
                    >
                      <div className="col-span-2">
                        <p className="text-sm font-bold text-slate-800">{m.description || meta.label}</p>
                        {m.operatorName && <p className="text-[10px] text-slate-400">{m.operatorName}</p>}
                      </div>
                      <div>
                        <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black ${meta.bg} ${meta.color}`}>
                          {meta.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{new Date(m.createdAt).toLocaleTimeString("pt-BR")}</p>
                      <p className={`text-sm font-black text-right ${isOut ? "text-red-500" : "text-green-600"}`}>
                        {isOut ? "-" : "+"}{fmt(m.amount)}
                      </p>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </ContentCard>
      )}

      {/* History list */}
      {activeView === "history" && (
        <ContentCard padding="none">
          {history.length === 0 ? (
            <EmptyState
              title="Sem histórico"
              description="Os fechamentos de caixa aparecerão aqui."
              icon={History}
            />
          ) : (
            <div className="divide-y divide-slate-100">
              <div className="hidden sm:grid grid-cols-5 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <span className="col-span-2">Abertura</span>
                <span>Fechamento</span>
                <span>Esperado</span>
                <span className="text-right">Diferença</span>
              </div>
              {history.map((h) => {
                const diff = h.closingBalance != null && h.expectedBalance != null
                  ? h.closingBalance - h.expectedBalance
                  : null;
                return (
                  <div key={h.id} className="grid grid-cols-1 sm:grid-cols-5 px-5 py-4 hover:bg-slate-50 gap-1 sm:gap-0">
                    <div className="col-span-2">
                      <p className="text-sm font-bold text-slate-800">
                        {new Date(h.openedAt).toLocaleDateString("pt-BR")}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {new Date(h.openedAt).toLocaleTimeString("pt-BR")} → {h.closedAt ? new Date(h.closedAt).toLocaleTimeString("pt-BR") : "—"}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-slate-700">{fmt(h.closingBalance ?? 0)}</p>
                    <p className="text-sm text-slate-500">{fmt(h.expectedBalance ?? 0)}</p>
                    {diff !== null && (
                      <p className={`text-sm font-black text-right ${Math.abs(diff) < 0.01 ? "text-green-500" : diff < 0 ? "text-red-500" : "text-orange-500"}`}>
                        {diff >= 0 ? "+" : ""}{fmt(diff)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ContentCard>
      )}

      {/* ─── Open Cash Modal ─── */}
      <Modal
        isOpen={showOpenModal}
        onClose={() => setShowOpenModal(false)}
        title="Abrir Caixa"
        size="sm"
        footer={
          <ModalFooter>
            <Button variant="ghost" onClick={() => setShowOpenModal(false)}>Cancelar</Button>
            <Button variant="primary" loading={openLoading} onClick={handleOpenCash}>
              Abrir Caixa
            </Button>
          </ModalFooter>
        }
      >
        <div className="space-y-4">
          <Input
            label="Operador / Responsável"
            placeholder="Nome do operador"
            value={operatorName}
            onChange={(e) => setOperatorName(e.target.value)}
          />
          <Input
            label="Fundo de Caixa (R$)"
            type="number"
            placeholder="0,00"
            value={openingBalance}
            onChange={(e) => setOpeningBalance(e.target.value)}
          />
          <p className="text-xs text-slate-500">
            Informe o valor em dinheiro presente no caixa no momento da abertura.
          </p>
        </div>
      </Modal>

      {/* ─── Close Cash Modal ─── */}
      <Modal
        isOpen={showCloseModal}
        onClose={() => setShowCloseModal(false)}
        title="Fechar Caixa"
        size="sm"
        footer={
          <ModalFooter>
            <Button variant="ghost" onClick={() => setShowCloseModal(false)}>Cancelar</Button>
            <Button variant="danger" loading={closeLoading} onClick={handleCloseCash}>
              Confirmar Fechamento
            </Button>
          </ModalFooter>
        }
      >
        <div className="space-y-4">
          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Fundo de caixa</span>
              <span className="font-bold">{fmt(currentCash?.openingBalance ?? 0)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Vendas em dinheiro</span>
              <span className="font-bold text-green-600">+{fmt(paymentTotals["PAYMENT_CASH"] ?? 0)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Sangrias</span>
              <span className="font-bold text-red-500">-{fmt(totalSangrias)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Suprimentos</span>
              <span className="font-bold text-green-600">+{fmt(totalSuprimentos)}</span>
            </div>
            <div className="flex justify-between text-sm font-black border-t border-slate-200 pt-2">
              <span>Saldo Esperado</span>
              <span className="text-[#C9A227]">{fmt(expectedBalance)}</span>
            </div>
          </div>

          <Input
            label="Saldo Contado em Caixa (R$)"
            type="number"
            placeholder="0,00"
            value={closingBalance}
            onChange={(e) => setClosingBalance(e.target.value)}
          />

          {closingBalance && (
            <div className={`rounded-xl p-3 text-sm font-black ${Math.abs(diffBalance) < 0.01 ? "bg-green-50 text-green-700" : diffBalance < 0 ? "bg-red-50 text-red-700" : "bg-orange-50 text-orange-700"}`}>
              {Math.abs(diffBalance) < 0.01
                ? "✓ Caixa confere"
                : diffBalance < 0
                ? `Falta ${fmt(Math.abs(diffBalance))} no caixa`
                : `Sobra ${fmt(diffBalance)} no caixa`}
            </div>
          )}

          <Input
            label="Observações (opcional)"
            placeholder="Motivo de diferenças, etc."
            value={closeNotes}
            onChange={(e) => setCloseNotes(e.target.value)}
          />
        </div>
      </Modal>

      {/* ─── Sangria/Suprimento Modal ─── */}
      <Modal
        isOpen={showMovementModal}
        onClose={() => setShowMovementModal(false)}
        title={movementType === "SANGRIA" ? "Registrar Sangria" : "Registrar Suprimento"}
        size="sm"
        footer={
          <ModalFooter>
            <Button variant="ghost" onClick={() => setShowMovementModal(false)}>Cancelar</Button>
            <Button
              variant={movementType === "SANGRIA" ? "danger" : "primary"}
              loading={movementLoading}
              onClick={handleMovement}
            >
              Confirmar
            </Button>
          </ModalFooter>
        }
      >
        <div className="space-y-4">
          <div className={`rounded-xl p-3 text-sm ${movementType === "SANGRIA" ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
            {movementType === "SANGRIA"
              ? "Sangria: retirada de dinheiro do caixa para depósito ou segurança."
              : "Suprimento: adição de troco ou fundo extra ao caixa."}
          </div>
          <Input
            label="Valor (R$)"
            type="number"
            placeholder="0,00"
            value={movementAmount}
            onChange={(e) => setMovementAmount(e.target.value)}
          />
          <Input
            label="Descrição (opcional)"
            placeholder="Ex: Depósito banco, troco adicional..."
            value={movementDesc}
            onChange={(e) => setMovementDesc(e.target.value)}
          />
        </div>
      </Modal>
    </PageWrapper>
  );
}
