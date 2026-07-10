import { useEffect, useMemo, useState } from "react";
import {
  Utensils, Plus, Minus, X, Search, User, Phone,
  CheckCircle2, Clock, ChefHat, Trophy, ArrowLeft, Trash2,
} from "lucide-react";
import type { Tenant, Product, Order } from "../../../../types";
import { apiJson } from "../../../../lib/api";
import { Modal, ModalFooter, Button, Input, useToast, EmptyState } from "../../../../components";
import socket from "../../../../lib/socket";

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

interface RegisteredTable {
  id: string;
  label: string;
}

interface CartLine {
  product: Product;
  variant?: { id: string; name: string; price: number };
  quantity: number;
  notes: string;
  price: number;
}

interface LeaderboardEntry {
  operatorName: string;
  orderCount: number;
  total: number;
}

interface WaiterPanelProps {
  tenant: Tenant;
  operatorName?: string | null;
  orders?: Order[];
  onOrderCreated?: () => void;
  waiterCalls?: Array<{ tableId: string; customerName: string; note: string; requestBill: boolean; timestamp: number }>;
  onOpenFullscreen?: () => void;
}

type ActiveTable = {
  tableId: string;
  orders: Order[];
  total: number;
  itemCount: number;
  wantsCheckout: boolean;
  lastAt: string;
};

export default function WaiterPanel({
  tenant,
  operatorName,
  orders = [],
  onOrderCreated,
  waiterCalls = [],
  onOpenFullscreen,
}: WaiterPanelProps) {
  const toast = useToast();
  const [registeredTables, setRegisteredTables] = useState<RegisteredTable[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [showNewTable, setShowNewTable] = useState(false);
  const [newTableLabel, setNewTableLabel] = useState("");
  const [creatingTable, setCreatingTable] = useState(false);
  const [newTableError, setNewTableError] = useState("");

  const fetchTables = () => {
    apiJson<RegisteredTable[]>(`/api/tenants/${tenant.slug}/tables`)
      .then((data) => setRegisteredTables(Array.isArray(data) ? data : []))
      .catch(() => setRegisteredTables([]));
  };

  useEffect(() => { fetchTables(); }, [tenant.slug]);

  const handleCreateTable = async () => {
    if (!newTableLabel.trim()) return;
    setCreatingTable(true);
    setNewTableError("");
    try {
      await apiJson(`/api/tenants/${tenant.slug}/tables`, {
        method: "POST",
        body: JSON.stringify({ label: newTableLabel.trim() }),
      });
      fetchTables();
      setShowNewTable(false);
      setNewTableLabel("");
    } catch (err: any) {
      setNewTableError(err?.message || "Erro ao criar mesa.");
    } finally {
      setCreatingTable(false);
    }
  };

  const activeTables = useMemo(() => {
    const map = new Map<string, ActiveTable>();
    orders.forEach((o) => {
      if (!o.tableId || o.orderType !== "DINE_IN") return;
      if (o.status === "DELIVERED" || o.status === "CANCELLED") return;
      const existing = map.get(o.tableId);
      const wantsCheckout = waiterCalls.some((w) => w.tableId === o.tableId && w.requestBill);
      if (existing) {
        existing.orders.push(o);
        existing.total += o.total;
        existing.itemCount += o.items.reduce((acc, i) => acc + i.quantity, 0);
        if (o.createdAt > existing.lastAt) existing.lastAt = o.createdAt;
        existing.wantsCheckout = existing.wantsCheckout || wantsCheckout;
      } else {
        map.set(o.tableId, {
          tableId: o.tableId,
          orders: [o],
          total: o.total,
          itemCount: o.items.reduce((acc, i) => acc + i.quantity, 0),
          wantsCheckout,
          lastAt: o.createdAt,
        });
      }
    });
    return map;
  }, [orders, waiterCalls]);

  const availableTables = registeredTables.filter((t) => !activeTables.has(t.label));
  const occupiedTables = Array.from(activeTables.values()).sort((a, b) => {
    const na = Number(a.tableId), nb = Number(b.tableId);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return a.tableId.localeCompare(b.tableId, "pt-BR");
  });

  const openLeaderboard = async () => {
    setShowLeaderboard(true);
    setLeaderboardLoading(true);
    try {
      const data = await apiJson<LeaderboardEntry[]>(`/api/tenants/${tenant.slug}/waiter/leaderboard`);
      setLeaderboard(data);
    } catch {
      setLeaderboard([]);
    } finally {
      setLeaderboardLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#FAFAF8]">
      {/* Topo */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-[#C9A227]/10 text-[#C9A227] flex items-center justify-center">
            <Utensils className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-sm font-black text-slate-800 leading-tight">Garçom</p>
            {operatorName && <p className="text-[10px] text-slate-400 font-bold leading-tight">{operatorName}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewTable(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#C9A227]/10 text-[#C9A227] hover:bg-[#C9A227]/20 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nova mesa</span>
          </button>
          <button
            onClick={openLeaderboard}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-[#0D1B3E] hover:bg-slate-50 transition-colors"
          >
            <Trophy className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Placar</span>
          </button>
          {onOpenFullscreen && (
            <button
              onClick={onOpenFullscreen}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-[#0D1B3E] hover:bg-slate-50 transition-colors"
            >
              Tela cheia
            </button>
          )}
        </div>
      </div>

      {/* Grade de mesas */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {registeredTables.length === 0 ? (
          <EmptyState
            title="Nenhuma mesa cadastrada"
            description="Crie a primeira mesa para começar a atender."
            icon={Utensils}
            action={
              <Button variant="primary" onClick={() => setShowNewTable(true)} iconLeft={<Plus className="w-4 h-4" />}>
                Nova mesa
              </Button>
            }
          />
        ) : (
          <>
            {occupiedTables.length > 0 && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                  Mesas ocupadas
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {occupiedTables.map((t) => (
                    <button
                      key={t.tableId}
                      onClick={() => setSelectedTable(t.tableId)}
                      className={`bg-white p-4 rounded-3xl border-2 hover:shadow-lg transition-all text-left space-y-2 ${
                        t.wantsCheckout ? "border-red-300" : "border-amber-200"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xl font-black text-slate-800">Mesa {t.tableId}</span>
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${t.wantsCheckout ? "bg-red-50 text-red-500" : "bg-amber-50 text-amber-500"}`}>
                          <Clock className="w-4 h-4" />
                        </div>
                      </div>
                      {t.wantsCheckout && (
                        <p className="text-[9px] font-black uppercase tracking-widest text-red-500">Pediu a conta</p>
                      )}
                      <p className="text-xs text-slate-400 font-bold">{t.itemCount} item{t.itemCount !== 1 ? "s" : ""}</p>
                      <p className="text-sm font-black text-slate-700">{fmt(t.total)}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
                Mesas livres
              </p>
              {availableTables.length === 0 ? (
                <p className="text-xs text-slate-400 font-bold">Todas as mesas estão ocupadas.</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                  {availableTables.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTable(t.label)}
                      className="bg-white border border-slate-200 hover:border-[#C9A227] rounded-2xl py-4 text-center transition-all"
                    >
                      <span className="text-base font-black text-slate-600">{t.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {selectedTable && (
        <ComandaModal
          tenant={tenant}
          tableId={selectedTable}
          operatorName={operatorName}
          existingOrders={activeTables.get(selectedTable)?.orders ?? []}
          onClose={() => setSelectedTable(null)}
          onChanged={() => { onOrderCreated?.(); }}
        />
      )}

      {/* Placar */}
      <Modal isOpen={showLeaderboard} onClose={() => setShowLeaderboard(false)} title="Placar do dia" size="sm">
        <div className="p-4 sm:p-5">
          {leaderboardLoading ? (
            <div className="flex items-center justify-center p-10">
              <div className="w-8 h-8 border-4 border-[#C9A227] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : leaderboard.length === 0 ? (
            <EmptyState title="Nenhuma comanda hoje" description="O placar mostra quantas comandas cada garçom lançou hoje." icon={Trophy} />
          ) : (
            <div className="space-y-2">
              {leaderboard.map((entry, idx) => (
                <div key={entry.operatorName} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${idx === 0 ? "bg-[#C9A227] text-white" : "bg-white text-slate-400 border border-slate-200"}`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-800 text-sm truncate">{entry.operatorName}</p>
                    <p className="text-[10px] text-slate-400 font-bold">{entry.orderCount} comanda{entry.orderCount !== 1 ? "s" : ""}</p>
                  </div>
                  <p className="font-black text-[#C9A227] text-sm shrink-0">{fmt(entry.total)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Nova mesa */}
      <Modal
        isOpen={showNewTable}
        onClose={() => { setShowNewTable(false); setNewTableError(""); setNewTableLabel(""); }}
        title="Nova mesa"
        size="sm"
        footer={
          <ModalFooter>
            <Button variant="outline" onClick={() => setShowNewTable(false)}>Cancelar</Button>
            <Button variant="primary" onClick={handleCreateTable} loading={creatingTable} disabled={!newTableLabel.trim()}>Criar</Button>
          </ModalFooter>
        }
      >
        <div className="p-4 sm:p-5 space-y-3">
          {newTableError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-xs font-bold">{newTableError}</div>
          )}
          <Input
            label="Identificação da mesa"
            placeholder="Ex: 5, VIP, Varanda"
            value={newTableLabel}
            onChange={(e) => setNewTableLabel(e.target.value)}
            autoFocus
          />
        </div>
      </Modal>
    </div>
  );
}

// ─── Modal de comanda: produtos + itens lançados + cliente opcional ──────────

function ComandaModal({
  tenant,
  tableId,
  operatorName,
  existingOrders,
  onClose,
  onChanged,
}: {
  tenant: Tenant;
  tableId: string;
  operatorName?: string | null;
  existingOrders: Order[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showCustomer, setShowCustomer] = useState(false);
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerLookup, setCustomerLookup] = useState<"idle" | "loading" | "found" | "new">("idle");
  const [closing, setClosing] = useState(false);
  const [variantPicker, setVariantPicker] = useState<Product | null>(null);
  const [editingNotesKey, setEditingNotesKey] = useState<string | null>(null);

  const existingCustomer = existingOrders.find((o) => o.customerId)?.customerName;

  const allProducts = useMemo(() => {
    let products: Product[] = [];
    tenant.categories?.forEach((cat) => {
      if (!selectedCategoryId || cat.id === selectedCategoryId) products = [...products, ...cat.products];
    });
    if (searchTerm) {
      products = products.filter((p) => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return products.filter((p) => p.available).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [tenant, selectedCategoryId, searchTerm]);

  const cartKey = (productId: string, variantId?: string) => variantId ? `${productId}::${variantId}` : productId;

  const addToCart = (product: Product, variant?: { id: string; name: string; price: number }) => {
    if (!variant && product.variants && product.variants.length > 0) {
      setVariantPicker(product);
      return;
    }
    setCart((prev) => {
      const key = cartKey(product.id, variant?.id);
      const existing = prev.find((i) => cartKey(i.product.id, i.variant?.id) === key);
      if (existing) return prev.map((i) => (cartKey(i.product.id, i.variant?.id) === key ? { ...i, quantity: i.quantity + 1 } : i));
      return [...prev, { product, variant, quantity: 1, notes: "", price: variant?.price ?? product.price }];
    });
    setVariantPicker(null);
  };

  const updateQty = (productId: string, variantId: string | undefined, delta: number) => {
    const key = cartKey(productId, variantId);
    setCart((prev) => prev
      .map((i) => (cartKey(i.product.id, i.variant?.id) === key ? { ...i, quantity: i.quantity + delta } : i))
      .filter((i) => i.quantity > 0));
  };

  const updateNotes = (productId: string, variantId: string | undefined, notes: string) => {
    const key = cartKey(productId, variantId);
    setCart((prev) => prev.map((i) => (cartKey(i.product.id, i.variant?.id) === key ? { ...i, notes } : i)));
  };

  const cartTotal = cart.reduce((acc, i) => acc + i.price * i.quantity, 0);

  const lookupCustomer = async () => {
    const digits = customerPhone.replace(/\D/g, "");
    if (digits.length < 8) return;
    setCustomerLookup("loading");
    try {
      const found = await apiJson<{ name: string } | null>(`/api/tenants/${tenant.slug}/customers/by-phone/${digits}`);
      if (found?.name) {
        setCustomerName(found.name);
        setCustomerLookup("found");
      } else {
        setCustomerLookup("new");
      }
    } catch {
      setCustomerLookup("new");
    }
  };

  const handleLaunch = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      await apiJson(`/api/tenants/${tenant.slug}/pdv/order`, {
        method: "POST",
        body: JSON.stringify({
          customerName: customerName || `Mesa ${tableId}`,
          customerPhone: customerPhone.replace(/\D/g, "") || "00000000000",
          orderType: "DINE_IN",
          tableId,
          paymentMethod: "CASH",
          operatorName: operatorName || undefined,
          source: "waiter",
          items: cart.map((i) => ({ productId: i.product.id, productVariantId: i.variant?.id, quantity: i.quantity, price: i.price, notes: i.notes || undefined })),
        }),
      });
      toast.show("Pedido lançado para a cozinha.", "success");
      setCart([]);
      onChanged();
    } catch (err: any) {
      toast.show(err?.message || "Erro ao lançar pedido.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkServed = async () => {
    const openOrders = existingOrders.filter((o) => o.status !== "DELIVERED" && o.status !== "CANCELLED" && o.status !== "AWAITING_PAYMENT" && o.status !== "MERGED");
    if (openOrders.length === 0) { onClose(); return; }
    setClosing(true);
    try {
      // AWAITING_PAYMENT, não DELIVERED: a mesa foi servida mas a venda só é fechada de
      // verdade (e entra nos relatórios) quando o PDV cobra o cliente e fatura.
      await Promise.all(openOrders.map((o) =>
        apiJson(`/api/orders/${o.id}/status`, { method: "PATCH", body: JSON.stringify({ status: "AWAITING_PAYMENT" }) })
      ));
      // Avisa o caixa/PDV (badge de solicitação em Mesas/Comandas) que essa mesa está
      // pronta pra fechar a conta — mesmo evento que já existe quando o próprio cliente
      // pede a conta pelo cardápio da mesa.
      socket.emit("request-checkout", { tenantId: tenant.id, tableId, customerName: existingCustomer || "" });
      toast.show(`Mesa ${tableId} enviada para o caixa fechar.`, "success");
      onChanged();
      onClose();
    } catch (err: any) {
      toast.show(err?.message || "Erro ao encerrar mesa.", "error");
    } finally {
      setClosing(false);
    }
  };

  const allItemsLaunched = existingOrders.flatMap((o) => o.items.filter((i) => i.product));

  return (
    <Modal isOpen onClose={onClose} title={`Mesa ${tableId}`} size="lg" mobileStyle="bottom-sheet">
      <div className="flex flex-col max-h-[75vh]">
        {/* Cliente opcional */}
        <div className="px-4 sm:px-5 pt-4">
          {!showCustomer && !existingCustomer ? (
            <button
              onClick={() => setShowCustomer(true)}
              className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-[#0D1B3E]"
            >
              <User className="w-3.5 h-3.5" /> Vincular cliente (opcional)
            </button>
          ) : existingCustomer && !showCustomer ? (
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <User className="w-3.5 h-3.5" /> {existingCustomer}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 mb-2">
              <Input
                placeholder="Telefone"
                value={customerPhone}
                onChange={(e) => { setCustomerPhone(e.target.value); setCustomerLookup("idle"); }}
                onBlur={lookupCustomer}
                iconLeft={<Phone className="w-3.5 h-3.5" />}
              />
              <Input
                placeholder="Nome do cliente"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                iconLeft={<User className="w-3.5 h-3.5" />}
              />
            </div>
          )}
        </div>

        {/* Itens já lançados nesta mesa */}
        {allItemsLaunched.length > 0 && (
          <div className="px-4 sm:px-5 pt-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Já lançado</p>
            <div className="space-y-1 max-h-28 overflow-y-auto mb-2">
              {allItemsLaunched.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-bold">{item.quantity}x {item.product?.name}</span>
                  <span className="text-slate-400">{fmt(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Busca de produto */}
        <div className="px-4 sm:px-5 pt-2">
          <Input
            placeholder="Buscar produto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            iconLeft={<Search className="w-4 h-4" />}
          />
        </div>

        <div className="flex gap-2 px-4 sm:px-5 pt-2 overflow-x-auto shrink-0">
          <button
            onClick={() => setSelectedCategoryId(null)}
            className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${!selectedCategoryId ? "bg-[#0D1B3E] text-white" : "bg-slate-100 text-slate-500"}`}
          >
            Tudo
          </button>
          {tenant.categories?.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategoryId(cat.id)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${selectedCategoryId === cat.id ? "bg-[#0D1B3E] text-white" : "bg-slate-100 text-slate-500"}`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Lista de produtos — mesmo estilo visual do cardápio digital, compacto */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 grid grid-cols-2 sm:grid-cols-3 gap-3 auto-rows-min">
          {allProducts.map((p) => {
            const hasVariants = !!p.variants && p.variants.length > 0;
            const minPrice = hasVariants ? Math.min(...p.variants!.map((v) => v.price)) : p.price;
            return (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                className="flex flex-col bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md hover:border-slate-200 transition-all text-left"
              >
                <div className="relative w-full aspect-[4/3] shrink-0 overflow-hidden bg-slate-100 flex items-center justify-center">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt={p.name} loading="lazy" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl">🍽️</span>
                  )}
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-lg bg-[#C9A227] text-white flex items-center justify-center shadow">
                    <Plus className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="px-2.5 py-2 flex-1 min-w-0 min-h-[2.5rem]">
                  <p title={p.name} className="text-[11px] font-black text-slate-800 leading-tight line-clamp-2">{p.name}</p>
                  <p className="text-[10px] font-bold text-[#C9A227] mt-1">
                    {hasVariants && <span className="text-slate-400 font-normal mr-1">a partir de</span>}
                    {fmt(minPrice)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Carrinho da rodada atual */}
        {cart.length > 0 && (
          <div className="border-t border-slate-100 px-4 sm:px-5 py-3 space-y-2 max-h-52 overflow-y-auto shrink-0">
            {cart.map((item) => {
              const lineKey = cartKey(item.product.id, item.variant?.id);
              return (
                <div key={lineKey} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQty(item.product.id, item.variant?.id, -1)} className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center"><Minus className="w-3 h-3" /></button>
                      <span className="w-6 text-center text-xs font-black">{item.quantity}</span>
                      <button onClick={() => updateQty(item.product.id, item.variant?.id, 1)} className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center"><Plus className="w-3 h-3" /></button>
                    </div>
                    <span className="flex-1 text-xs font-bold text-slate-700 truncate">
                      {item.product.name}{item.variant ? ` — ${item.variant.name}` : ""}
                    </span>
                    <span className="text-xs font-black text-slate-600">{fmt(item.price * item.quantity)}</span>
                  </div>
                  {editingNotesKey === lineKey ? (
                    <input
                      autoFocus
                      type="text"
                      value={item.notes}
                      onChange={(e) => updateNotes(item.product.id, item.variant?.id, e.target.value)}
                      onBlur={() => setEditingNotesKey(null)}
                      placeholder="Observação (ex: sem cebola)"
                      className="w-full ml-8 bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-2.5 text-[11px] text-slate-700 placeholder-slate-300 focus:border-[#C9A227] outline-none"
                    />
                  ) : (
                    <button
                      onClick={() => setEditingNotesKey(lineKey)}
                      className="ml-8 flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {item.notes ? <span className="italic text-slate-500">{item.notes}</span> : <span>+ Adicionar observação</span>}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="border-t border-slate-100 p-4 sm:p-5 space-y-2 shrink-0">
          {cart.length > 0 && (
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase tracking-widest text-slate-400">Total da rodada</span>
              <span className="text-lg font-black text-slate-800">{fmt(cartTotal)}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={handleMarkServed} loading={closing} iconLeft={<CheckCircle2 className="w-4 h-4" />}>
              Fechar Mesa
            </Button>
            <Button variant="primary" onClick={handleLaunch} loading={submitting} disabled={cart.length === 0} iconLeft={<ChefHat className="w-4 h-4" />}>
              Enviar p/ cozinha
            </Button>
          </div>
        </div>
      </div>

      {/* Seleção de tamanho/variante */}
      <Modal isOpen={!!variantPicker} onClose={() => setVariantPicker(null)} title={variantPicker?.name || "Escolha o tamanho"} size="sm">
        <div className="p-4 sm:p-5 space-y-2">
          {variantPicker?.variants?.map((v) => {
            const outOfStock = !!v.inventoryItem && v.inventoryItem.quantity <= 0;
            return (
            <button
              key={v.id}
              onClick={() => !outOfStock && addToCart(variantPicker, { id: v.id, name: v.name, price: v.price })}
              disabled={outOfStock}
              className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all text-left ${
                outOfStock ? "border-slate-100 opacity-50 cursor-not-allowed" : "border-slate-200 hover:border-[#C9A227]"
              }`}
            >
              <div>
                <span className="text-sm font-black text-slate-700">{v.name}</span>
                {outOfStock && <p className="text-[10px] text-red-500 font-bold">Esgotado</p>}
              </div>
              <span className="text-sm font-black text-[#C9A227]">{fmt(v.price)}</span>
            </button>
            );
          })}
        </div>
      </Modal>
    </Modal>
  );
}
