import React, { useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import {
  AlertTriangle,
  ArrowRightLeft,
  CalendarClock,
  CircleDollarSign,
  Info,
  Package,
  Plus,
  Settings,
  Trash2,
} from "lucide-react";
import {
  Badge,
  Button,
  ConfirmModal,
  CurrencyInput,
  FilterLineSegmented,
  GridTable,
  IconButton,
  Input,
  Modal,
  ModalFooter,
  Select,
  StatCard,
} from "../../../../components";
import { apiFetch } from "../../../../lib/api";
import { Tenant } from "../../../../types";

function QuickAdjustModal({ isOpen, onClose, item, tenantId, onSave }: any) {
  const [type, setType] = useState<"IN" | "OUT">("IN");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [isNewBatch, setIsNewBatch] = useState(false);
  const [newExpirationDate, setNewExpirationDate] = useState("");
  const [newCode, setNewCode] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setType("IN");
      setQuantity("");
      setReason("");
      setIsNewBatch(false);
      setNewExpirationDate("");
      setNewCode("");
    }
  }, [isOpen]);

  if (!isOpen || !item) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const baseItemId = item.batches?.[0]?.id || item.id;
    if (!quantity || Number(quantity) <= 0) return alert("Quantidade inválida");
    setLoading(true);
    try {
      const res = await apiFetch(`/api/inventory/items/quick-adjust`, {
        method: "POST",
        body: JSON.stringify({
          tenantId,
          baseItemId,
          type,
          quantity: Number(quantity),
          reason,
          isNewBatch: type === "IN" ? isNewBatch : false,
          newExpirationDate: type === "IN" && isNewBatch && newExpirationDate ? newExpirationDate : undefined,
          newCode: type === "IN" && isNewBatch && newCode ? newCode : undefined,
        })
      });
      if (res.ok) {
        onSave();
        onClose();
      } else {
        const data = await res.json().catch(() => null);
        alert(data?.error || "Erro ao realizar ajuste.");
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao realizar ajuste.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={`Ajustar ${item.name}`} isOpen={isOpen} onClose={onClose} size="sm">
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-3 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setType("IN")}
            className={`py-2 text-xs font-black uppercase rounded-lg transition-colors ${type === "IN" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
          >
            Entrada (Adicionar)
          </button>
          <button
            type="button"
            onClick={() => setType("OUT")}
            className={`py-2 text-xs font-black uppercase rounded-lg transition-colors ${type === "OUT" ? "bg-white text-red-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
          >
            Saída (Baixa/Perda)
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label={`Quantidade (${item.unit || "un"})`}
            type="number"
            step="0.01"
            min="0.01"
            required
            value={quantity}
            onChange={(e: any) => setQuantity(e.target.value)}
          />
          <Input
            label="Motivo"
            placeholder={type === "IN" ? "Ex: Compra, Devolução" : "Ex: Vencido, Quebra"}
            value={reason}
            onChange={(e: any) => setReason(e.target.value)}
          />
        </div>

        {type === "IN" && (
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isNewBatch}
                onChange={(e) => setIsNewBatch(e.target.checked)}
                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 border-slate-300"
              />
              <span className="text-sm font-bold text-slate-700">Registrar como novo lote / validade</span>
            </label>

            {isNewBatch && (
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200">
                <Input
                  label="Nova Validade"
                  type="date"
                  value={newExpirationDate}
                  onChange={(e: any) => setNewExpirationDate(e.target.value)}
                />
                <Input
                  label="Lote / SKU"
                  value={newCode}
                  onChange={(e: any) => setNewCode(e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        <div className="pt-4 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading} className={type === "IN" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}>
            Confirmar {type === "IN" ? "Entrada" : "Saída"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function InventoryPanel({ tenant }: { tenant: Tenant | null }) {
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "low" | "expiring" | "expired" | "internal" | "sale">("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [deletingItem, setDeletingItem] = useState<any | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [adjustingItem, setAdjustingItem] = useState<any | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [showManageCategories, setShowManageCategories] = useState(false);

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const resolveBaseInventoryItem = (item: any | null) => {
    if (!item) return null;
    return item.batches?.[0] ?? item;
  };

  const openItemEditor = (item: any) => {
    const baseItem = resolveBaseInventoryItem(item);
    if (!baseItem) return;
    setEditingItem(baseItem);
    setShowItemForm(true);
  };

  const openQuickAdjust = (item: any) => {
    const baseItem = resolveBaseInventoryItem(item);
    if (!baseItem) return;
    setAdjustingItem(baseItem);
  };

  const fetchData = async () => {
    if (!tenant) return;
    try {
      const [iRes, cRes] = await Promise.all([
        apiFetch(`/api/tenants/${tenant.slug}/inventory`),
        apiFetch(`/api/tenants/${tenant.slug}/inventory/categories`)
      ]);
      setItems(await iRes.json());
      setCategories(await cRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tenant]);

  const filteredItems = items.filter(item => {
    const nameStr = item.name || "";
    const codeStr = item.code || "";
    const matchesSearch = nameStr.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          codeStr.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === "all" || item.categoryId === filterCategory;

    if (!matchesSearch || !matchesCategory) return false;
    if (filterType === "low") return item.minStock && item.quantity <= item.minStock;
    if (filterType === "expired") return item.expirationDate && new Date(item.expirationDate) < new Date();
    if (filterType === "expiring") {
      if (!item.expirationDate) return false;
      const days = (new Date(item.expirationDate).getTime() - Date.now()) / 86400000;
      return days >= 0 && days <= 5;
    }
    if (filterType === "internal") return item.usage === "INTERNAL";
    if (filterType === "sale") return item.usage === "SALE";
    return true;
  });

  const groupedItemsMap = new Map<string, any[]>();
  for (const item of filteredItems) {
    const key = item.name;
    if (!groupedItemsMap.has(key)) groupedItemsMap.set(key, []);
    groupedItemsMap.get(key)!.push(item);
  }

  const groupedItems = Array.from(groupedItemsMap.values()).map(group => {
    group.sort((a, b) => {
      if (a.expirationDate && !b.expirationDate) return -1;
      if (!a.expirationDate && b.expirationDate) return 1;
      if (a.expirationDate && b.expirationDate) return new Date(a.expirationDate).getTime() - new Date(b.expirationDate).getTime();
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    const base = group[0];
    const totalQty = group.reduce((acc, i) => acc + i.quantity, 0);

    return {
      ...base,
      id: group.length > 1 ? `group-${base.name}` : base.id,
      isGroup: group.length > 1,
      batches: group,
      quantity: totalQty, // Override with total
    };
  });
  const stats = {
    totalItems: items.length,
    lowStock: items.filter(i => i.minStock && i.quantity <= i.minStock).length,
    expired: items.filter(i => i.expirationDate && new Date(i.expirationDate) < new Date()).length,
    nearExpiry: items.filter(i => {
      if (!i.expirationDate) return false;
      const days = (new Date(i.expirationDate).getTime() - Date.now()) / 86400000;
      return days >= 0 && days <= 5;
    }).length,
    totalValue: groupedItems.reduce((acc, g) => {
      const gValue = g.batches.reduce((gAcc: number, b: any) => gAcc + (b.purchasePrice || 0) * b.quantity, 0);
      return acc + gValue;
    }, 0)
  };

  if (loading) return <div className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">Carregando Inventário...</div>;

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Total em Estoque" 
          value={stats.totalItems} 
          icon={Package} 
          color="info"
        />
        <StatCard 
          title="Itens Críticos" 
          value={stats.lowStock} 
          icon={AlertTriangle} 
          color="warning"
        />
        <div
          className={`cursor-pointer transition-transform hover:scale-[1.02] ${stats.nearExpiry > 0 ? "ring-2 ring-amber-400 ring-offset-2 rounded-2xl" : ""}`}
          onClick={() => stats.nearExpiry > 0 && setFilterType("expiring")}
          title={stats.nearExpiry > 0 ? "Ver itens a vencer em até 5 dias" : ""}
        >
          <StatCard
            title="Próximos do Vencimento"
            value={stats.nearExpiry}
            icon={CalendarClock}
            color={stats.nearExpiry > 0 ? "warning" : "info"}
          />
        </div>
        <StatCard 
          title="Valor em Insumos" 
          value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalValue)} 
          icon={ArrowRightLeft} 
          color="success"
        />
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
        <div className="p-4 border-b border-slate-100 flex flex-col gap-3 bg-slate-50/30">
          {/* Row 1: tabs de tipo */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <FilterLineSegmented
              options={[
                { value: 'all', label: 'Todos' },
                { value: 'low', label: 'Críticos' },
                { value: 'expiring', label: stats.nearExpiry > 0 ? `⚠ A Vencer (${stats.nearExpiry})` : 'A Vencer' },
                { value: 'expired', label: 'Vencidos' },
                { value: 'sale', label: 'Para Venda' },
                { value: 'internal', label: 'Consumo' },
              ]}
              value={filterType}
              onChange={val => setFilterType(val as any)}
            />
            <Button
              onClick={() => { setEditingItem(null); setShowItemForm(true); }}
              size="sm"
              iconLeft={<Plus className="w-4 h-4" />}
            >
              Novo Item
            </Button>
          </div>

          {/* Row 2: busca + filtro categoria */}
          <div className="flex flex-col sm:flex-row items-stretch gap-2">
            <div className="relative flex-1">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                type="text"
                placeholder="Buscar por nome ou código..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs font-semibold border border-zinc-200 rounded-lg bg-white outline-none focus:border-amber-400 transition-colors placeholder:text-slate-400"
              />
            </div>
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M6 8h12M9 12h6" />
              </svg>
              <select
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                className="pl-8 pr-8 py-2 text-xs font-semibold border border-zinc-200 rounded-lg bg-white outline-none focus:border-amber-400 transition-colors appearance-none cursor-pointer text-slate-700 min-w-[160px]"
              >
                <option value="all">Todas as categorias</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} ({items.filter(i => i.categoryId === cat.id).length})
                  </option>
                ))}
              </select>
              <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
              {filterCategory !== "all" && (
                <button
                  onClick={() => setFilterCategory("all")}
                  className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors"
                  title="Limpar filtro"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowManageCategories(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-zinc-200 rounded-lg bg-white text-slate-600 hover:bg-zinc-50 transition-colors shrink-0"
              title="Editar ou excluir categorias de estoque"
            >
              <Settings className="w-3.5 h-3.5" />
              Categorias
            </button>
          </div>

          {/* Badge de filtro ativo */}
          {filterCategory !== "all" && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Filtrando por:</span>
              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-[11px] font-black px-2 py-0.5 rounded-full">
                {categories.find(c => c.id === filterCategory)?.name}
                <button onClick={() => setFilterCategory("all")} className="hover:text-red-500 transition-colors">×</button>
              </span>
              <span className="text-[10px] text-slate-400">{filteredItems.length} item(s)</span>
            </div>
          )}
        </div>

        <GridTable 
          data={groupedItems}
          keyExtractor={item => item.id}
          isRowExpanded={(item) => expandedRows.has(item.id)}
          onRowClick={(item) => item.isGroup && toggleRow(item.id)}
          renderDesktopExpandedContent={(item) => {
            if (!item.isGroup) return null;
            return (
              <div className="px-6 py-4 bg-slate-50/50 rounded-b-xl border-t border-slate-100 shadow-inner">
                <div className="flex items-center gap-2 mb-3">
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Lotes ({item.batches.length})</h4>
                  <div className="h-px bg-slate-200 flex-1" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {item.batches.map((batch: any) => {
                    const bIsExpired = batch.expirationDate && new Date(batch.expirationDate) < new Date();
                    return (
                      <div key={batch.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 transition-colors flex flex-col gap-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Lote / SKU</p>
                            <p className="text-sm font-black text-slate-700">{batch.code || "S/COD"}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Qtd</p>
                            <p className="text-sm font-black text-slate-800">{batch.quantity} <span className="text-slate-400 font-medium text-xs">{batch.unit}</span></p>
                          </div>
                        </div>
                        <div className="flex justify-between items-end mt-1 pt-2 border-t border-slate-100">
                          <div>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Validade</p>
                            {batch.expirationDate ? (
                              <p className={`text-xs font-bold ${bIsExpired ? "text-red-500" : "text-emerald-600"}`}>
                                {new Date(batch.expirationDate).toLocaleDateString("pt-BR")}
                              </p>
                            ) : (
                              <p className="text-[10px] font-bold text-slate-400 italic">Sem validade</p>
                            )}
                          </div>
                          <div className="flex gap-0.5">
                            <IconButton variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setEditingItem(batch); setShowItemForm(true); }}>
                              <Settings className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
                            </IconButton>
                            <IconButton variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDeletingItem(batch); }}>
                              <Trash2 className="w-3.5 h-3.5 text-red-400 hover:text-red-600" />
                            </IconButton>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }}
          emptyMessage="Nenhum item encontrado no inventário."
          columns={[
            {
              header: "Produto",
              render: item => (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:shadow-sm transition-all border border-slate-200/50 relative">
                    <Package className="w-5 h-5" />
                    {item.isGroup && (
                      <span className="absolute -top-1.5 -right-1.5 bg-amber-100 text-amber-700 text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-amber-200 shadow-sm">{item.batches.length}</span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-800 leading-tight flex items-center gap-2">
                      {item.name}
                      {item.isGroup && (
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Múltiplos Lotes</span>
                      )}
                    </p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                      {item.isGroup ? `${item.brand || 'Marca n/d'} • Várias Validades` : `#${item.code || 'S/COD'} • ${item.brand || 'Marca n/d'}`}
                    </p>
                  </div>
                </div>
              )
            },
            {
              header: "Categoria",
              render: item => (
                <Badge color="primary" size="sm">
                  {item.category?.name || 'Geral'}
                </Badge>
              )
            },
            {
              header: "Quantidade",
              className: "text-center",
              render: item => {
                const isLow = item.minStock && item.quantity <= item.minStock;
                const hasConversion = item.purchaseUnit && item.purchaseQty && item.stockUnit;
                const granularTotal = hasConversion ? item.quantity * item.purchaseQty : null;
                return (
                  <div className="flex flex-col items-center gap-0.5">
                    <span className={`text-sm font-black ${isLow ? 'text-orange-600' : 'text-slate-800'}`}>
                      {item.quantity} {item.unit || item.purchaseUnit || 'un'}
                    </span>
                    {hasConversion && granularTotal !== null && (
                      <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded-md">
                        ≈ {granularTotal.toLocaleString("pt-BR")} {item.stockUnit}
                      </span>
                    )}
                    {item.weight && <p className="text-[9px] text-slate-400 italic">({item.weight})</p>}
                  </div>
                );
              }
            },
            {
              header: "Custos",
              render: item => (
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold text-slate-400">Compra: <span className="text-slate-800 font-black">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.purchasePrice || 0)}</span></p>
                  {item.sellingPrice && (
                    <p className="text-[10px] font-bold text-slate-400">Venda: <span className="text-emerald-600 font-black">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.sellingPrice)}</span></p>
                  )}
                </div>
              )
            },
            {
              header: "Status/Validade",
              render: item => {
                const isLow = item.minStock && item.quantity <= item.minStock;
                if (item.isGroup) {
                  return (
                    <div className="space-y-1.5 min-w-[140px]">
                      {isLow && <Badge color="warning" size="sm" dot>Estoque Crítico</Badge>}
                      {item.hasExpired && <Badge color="danger" size="sm">Contém Vencidos</Badge>}
                      {item.hasExpiring && !item.hasExpired && <Badge color="warning" size="sm">Vencendo em breve</Badge>}
                      {!isLow && !item.hasExpired && !item.hasExpiring && <Badge color="success" size="sm">Dentro do Prazo</Badge>}
                    </div>
                  );
                }

                const isExpired = item.expirationDate && new Date(item.expirationDate) < new Date();
                const daysLeft = item.expirationDate
                  ? Math.ceil((new Date(item.expirationDate).getTime() - Date.now()) / 86400000)
                  : null;
                const isNearExpiry = daysLeft !== null && daysLeft >= 0 && daysLeft <= 5;

                return (
                  <div className="space-y-1.5 min-w-[140px]">
                    {isLow && (
                      <Badge color="warning" size="sm" dot>Estoque Crítico</Badge>
                    )}
                    {item.expirationDate ? (
                      <div className="space-y-0.5">
                        <Badge color={isExpired ? "danger" : isNearExpiry ? "warning" : "success"} size="sm">
                          {isExpired
                            ? `Venceu: ${new Date(item.expirationDate).toLocaleDateString("pt-BR")}`
                            : `Vence em: ${new Date(item.expirationDate).toLocaleDateString("pt-BR")}`}
                        </Badge>
                        {isNearExpiry && !isExpired && (
                          <p className="text-[10px] font-black text-amber-600 animate-pulse">
                            ⚠ {daysLeft === 0 ? "Vence hoje!" : `${daysLeft} dia${daysLeft === 1 ? "" : "s"} restante${daysLeft === 1 ? "" : "s"}`}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-300 font-bold italic">Sem validade</span>
                    )}
                  </div>
                );
              }
            },
            {
              header: "Ações",
              className: "text-right",
              render: item => (
                <div className="flex items-center justify-end gap-1">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 hidden sm:flex"
                    onClick={(e) => { e.stopPropagation(); openQuickAdjust(item); }}
                  >
                    Movimentar
                  </Button>
                  <IconButton 
                    variant="ghost" 
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); openItemEditor(item); }}
                    title={item.isGroup ? "Editar lote mais antigo" : "Editar"}
                  >
                    <Settings className="w-4 h-4" />
                  </IconButton>
                  {!item.isGroup && (
                    <IconButton
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-600"
                      onClick={(e) => { e.stopPropagation(); setDeletingItem(item); }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </IconButton>
                  )}
                </div>
              )
            }
          ]}
        />
      </div>

      <AnimatePresence>
        {showItemForm && (
          <InventoryItemModal
            tenant={tenant}
            item={editingItem}
            categories={categories}
            onClose={() => setShowItemForm(false)}
            onSave={() => { setShowItemForm(false); fetchData(); }}
            refreshCategories={fetchData}
          />
        )}
        <QuickAdjustModal
          isOpen={!!adjustingItem}
          onClose={() => setAdjustingItem(null)}
          item={adjustingItem}
          tenantId={tenant?.id}
          onSave={fetchData}
        />
      </AnimatePresence>

      {/* Modal de confirmação de exclusão */}
      <ConfirmModal
        isOpen={!!deletingItem}
        onClose={() => setDeletingItem(null)}
        onConfirm={async () => {
          if (!deletingItem) return;
          setDeleteLoading(true);
          try {
            await apiFetch(`/api/inventory/items/${deletingItem.id}`, { method: 'DELETE' });
            fetchData();
          } finally {
            setDeleteLoading(false);
            setDeletingItem(null);
          }
        }}
        title="Remover item do estoque"
        message={
          <span>
            Tem certeza que deseja remover <strong>{deletingItem?.name}</strong> do estoque?
            {deletingItem?.quantity > 0 && (
              <span className="block mt-2 text-amber-600 text-xs font-semibold">
                Ainda há {deletingItem.quantity} {deletingItem.unit || "un"} em estoque.
              </span>
            )}
          </span>
        }
        confirmLabel="Remover"
        loading={deleteLoading}
        variant="danger"
      />

      <Modal
        isOpen={showManageCategories}
        onClose={() => setShowManageCategories(false)}
        title="Categorias de Estoque"
        size="sm"
        mobileStyle="center"
      >
        <ManageInventoryCategoriesList
          tenant={tenant}
          categories={categories}
          items={items}
          onChange={fetchData}
        />
      </Modal>
    </div>
  );
}

function ManageInventoryCategoriesList({ tenant, categories, items, onChange }: {
  tenant: Tenant | null;
  categories: any[];
  items: any[];
  onChange: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleteItemCount, setDeleteItemCount] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [addingName, setAddingName] = useState("");
  const [addingLoading, setAddingLoading] = useState(false);

  const startEdit = (cat: any) => {
    setEditingId(cat.id);
    setEditingName(cat.name);
  };

  const saveEdit = async (id: string) => {
    const name = editingName.trim();
    if (!name) return;
    setSavingId(id);
    try {
      await apiFetch(`/api/inventory/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      onChange();
      setEditingId(null);
    } finally {
      setSavingId(null);
    }
  };

  const askDelete = (cat: any) => {
    setDeleteTarget(cat);
    setDeleteItemCount(items.filter(i => i.categoryId === cat.id).length);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await apiFetch(`/api/inventory/categories/${deleteTarget.id}?force=true`, { method: "DELETE" });
      onChange();
    } finally {
      setDeleteLoading(false);
      setDeleteTarget(null);
      setDeleteItemCount(null);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = addingName.trim();
    if (!name || !tenant) return;
    setAddingLoading(true);
    try {
      await apiFetch("/api/inventory/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, tenantId: tenant.id }),
      });
      onChange();
      setAddingName("");
    } finally {
      setAddingLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
        {categories.map(cat => {
          const count = items.filter(i => i.categoryId === cat.id).length;
          const isEditing = editingId === cat.id;
          return (
            <div key={cat.id} className="flex items-center gap-2 border border-zinc-100 rounded-xl px-3 py-2 bg-white">
              {isEditing ? (
                <>
                  <input
                    autoFocus
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") saveEdit(cat.id); if (e.key === "Escape") setEditingId(null); }}
                    className="flex-1 min-w-0 text-sm font-semibold border border-zinc-200 rounded-lg px-2 py-1.5 outline-none focus:border-amber-400"
                  />
                  <button
                    onClick={() => saveEdit(cat.id)}
                    disabled={savingId === cat.id}
                    className="text-xs font-bold text-amber-600 hover:text-amber-700 px-2 py-1 disabled:opacity-50"
                  >
                    Salvar
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="text-xs font-semibold text-slate-400 hover:text-slate-600 px-1"
                  >
                    Cancelar
                  </button>
                </>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-700 truncate">{cat.name}</p>
                    <p className="text-[10px] text-slate-400 font-semibold">{count} item(ns)</p>
                  </div>
                  <button
                    onClick={() => startEdit(cat)}
                    className="p-1.5 text-slate-400 hover:text-amber-600 transition-colors"
                    title="Editar nome"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => askDelete(cat)}
                    className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                    title="Excluir categoria"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          );
        })}
        {categories.length === 0 && (
          <p className="text-center text-sm text-slate-400 py-6">Nenhuma categoria cadastrada ainda.</p>
        )}
      </div>

      <form onSubmit={handleAdd} className="flex items-center gap-2 pt-2 border-t border-zinc-100">
        <input
          value={addingName}
          onChange={e => setAddingName(e.target.value)}
          placeholder="Nova categoria..."
          className="flex-1 min-w-0 text-sm font-semibold border border-zinc-200 rounded-lg px-3 py-2 outline-none focus:border-amber-400"
        />
        <Button type="submit" size="sm" disabled={!addingName.trim() || addingLoading}>
          Adicionar
        </Button>
      </form>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => { setDeleteTarget(null); setDeleteItemCount(null); }}
        onConfirm={confirmDelete}
        title="Excluir categoria"
        message={
          <span>
            Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>?
            {!!deleteItemCount && (
              <span className="block mt-2 text-amber-600 text-xs font-semibold">
                Esta categoria tem {deleteItemCount} item(ns) de estoque. Eles ficarão sem categoria, mas não serão apagados.
              </span>
            )}
          </span>
        }
        confirmLabel="Excluir"
        loading={deleteLoading}
        variant="danger"
      />
    </div>
  );
}

const UNIT_GROUPS = [
  {
    label: "Massa",
    units: [
      { value: "g",  label: "g — Grama" },
      { value: "kg", label: "kg — Quilograma" },
      { value: "mg", label: "mg — Miligrama" },
    ],
  },
  {
    label: "Volume",
    units: [
      { value: "ml", label: "ml — Mililitro" },
      { value: "l",  label: "l — Litro" },
    ],
  },
  {
    label: "Contagem",
    units: [
      { value: "un",   label: "un — Unidade" },
      { value: "dz",   label: "dz — Dúzia" },
      { value: "cx",   label: "cx — Caixa" },
      { value: "pct",  label: "pct — Pacote" },
      { value: "fd",   label: "fd — Fardo" },
      { value: "saco", label: "saco — Saco" },
    ],
  },
  {
    label: "Comprimento",
    units: [
      { value: "cm", label: "cm — Centímetro" },
      { value: "m",  label: "m — Metro" },
    ],
  },
];

function UnitSelectInput({
  label,
  value,
  onChange,
  hint,
  size = "sm",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleToggle = () => {
    if (!open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setOpenUp(rect.bottom + 210 > window.innerHeight);
    }
    setOpen((o) => !o);
  };

  const allUnits = UNIT_GROUPS.flatMap((g) => g.units);
  const _matched = allUnits.find((u) => u.value === value.trim().toLowerCase());

  return (
    <div ref={ref} className="relative">
      <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
        {label}
      </label>
      <div
        className="flex items-center gap-1 border border-zinc-200 rounded-lg bg-white cursor-pointer hover:border-amber-400 focus-within:border-amber-400 transition-colors px-2"
        style={{ height: size === "sm" ? "34px" : "40px" }}
        onClick={handleToggle}
      >
        <input
          className="flex-1 text-xs font-bold bg-transparent outline-none text-slate-800 placeholder:text-slate-400 min-w-0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          placeholder="un, kg, ml…"
          autoComplete="off"
        />
        <svg className={`w-3 h-3 text-slate-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {hint && <p className="text-[9px] text-amber-600 mt-0.5">{hint}</p>}
      {open && (
        <div className={`absolute z-50 w-44 bg-white border border-zinc-200 rounded-xl shadow-xl overflow-y-auto max-h-48 ${openUp ? "bottom-full mb-1" : "top-full mt-1"} left-0`}>
          {UNIT_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="px-2 py-1 text-[9px] font-black uppercase tracking-widest text-slate-400 bg-zinc-50 border-b border-zinc-100 sticky top-0">
                {group.label}
              </div>
              {group.units.map((u) => (
                <button
                  key={u.value}
                  type="button"
                  onClick={() => { onChange(u.value); setOpen(false); }}
                  className={`w-full text-left px-2 py-1.5 text-[11px] flex items-center gap-2 hover:bg-amber-50 transition-colors ${
                    value === u.value ? "bg-amber-50 text-amber-700 font-black" : "text-slate-700 font-semibold"
                  }`}
                >
                  <span className="font-black text-slate-900 w-6 shrink-0">{u.value}</span>
                  <span className="text-slate-500 text-[10px] flex-1 truncate">{u.label.split(" — ")[1]}</span>
                  {value === u.value && (
                    <svg className="w-3 h-3 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InventoryItemModal({ tenant, item, categories, onClose, onSave, refreshCategories }: {
  tenant: Tenant | null,
  item: any | null,
  categories: any[],
  onClose: () => void,
  onSave: () => void,
  refreshCategories: () => void
}) {
  const [form, setForm] = useState({
    name: item?.name || "",
    code: item?.code || "",
    brand: item?.brand || "",
    purchasePrice: item?.purchasePrice || "",
    sellingPrice: item?.sellingPrice || "",
    quantity: item?.quantity || "",
    minStock: item?.minStock || "",
    unit: item?.unit || "un",
    weight: item?.weight || "",
    usage: item?.usage || "SALE",
    categoryId: item?.categoryId || "",
    expirationDate: item?.expirationDate ? new Date(item.expirationDate).toISOString().split('T')[0] : "",
    purchaseDate: item?.purchaseDate ? new Date(item.purchaseDate).toISOString().split('T')[0] : "",
    // Conversão inteligente
    purchaseUnit: item?.purchaseUnit || "",
    purchaseQty: item?.purchaseQty || "",
    stockUnit: item?.stockUnit || "",
  });

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const url = item ? `/api/inventory/items/${item.id}` : `/api/inventory/items`;
    const method = item ? 'PATCH' : 'POST';
    await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        tenantId: tenant?.id,
        purchasePrice: parseFloat(form.purchasePrice.toString()) || 0,
        sellingPrice: form.sellingPrice ? parseFloat(form.sellingPrice.toString()) : null,
        quantity: parseFloat(form.quantity.toString()) || 0,
        minStock: form.minStock ? parseFloat(form.minStock.toString()) : null,
        purchaseUnit: form.purchaseUnit || null,
        purchaseQty: form.purchaseQty ? parseFloat(form.purchaseQty.toString()) : null,
        stockUnit: form.stockUnit || null,
      })
    });
    setLoading(false);
    onSave();
  };

  const SectionHeader = ({ icon: Icon, label, color }: { icon: React.ElementType; label: string; color: string }) => (
    <div className="flex items-center gap-2.5 mb-4">
      <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={14} className="text-white" />
      </div>
      <span className="text-[11px] font-black uppercase tracking-widest text-zinc-500">{label}</span>
    </div>
  );

  return (
    <>
      <Modal
        isOpen
        onClose={onClose}
        title={item ? "Editar Item" : "Novo Item de Estoque"}
        size="xl"
        mobileStyle="bottom-sheet"
        footer={
          <ModalFooter>
            <Button variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
            <Button variant="primary" onClick={() => {}} disabled={loading}
              className="sm:min-w-[160px]"
              type="submit"
              form="inventory-form"
            >
              {loading ? "Salvando..." : item ? "Salvar Alterações" : "Cadastrar Item"}
            </Button>
          </ModalFooter>
        }
      >
        <form id="inventory-form" onSubmit={handleSubmit} className="space-y-3">

          {/* Identificação */}
          <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 space-y-3">
            <SectionHeader icon={Info} label="Identificação" color="bg-blue-500" />
            <Input
              label="Nome"
              required
              size="sm"
              placeholder="Ex: Coca-Cola 350ml"
              value={form.name}
              onChange={e => set("name", e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input label="SKU" size="sm" placeholder="78900..." value={form.code} onChange={e => set("code", e.target.value)} />
              <Input label="Marca" size="sm" placeholder="Ambev" value={form.brand} onChange={e => set("brand", e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="ds-label">Categoria</label>
              <div className="flex gap-1.5">
                <Select
                  size="sm"
                  value={form.categoryId}
                  onChange={e => set("categoryId", e.target.value)}
                  wrapperClassName="flex-1 min-w-0"
                >
                  <option value="">Selecione...</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="w-8 h-8 shrink-0 rounded-lg border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-100 flex items-center justify-center font-bold transition-colors"
                >
                  +
                </button>
              </div>
            </div>
            <Select label="Uso" size="sm" value={form.usage} onChange={e => set("usage", e.target.value)}>
              <option value="SALE">Venda direta</option>
              <option value="INTERNAL">Insumo interno</option>
            </Select>
          </div>

          {/* Estoque */}
          <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 space-y-3">
            <SectionHeader icon={Package} label="Estoque" color="bg-orange-500" />
            <div className="grid grid-cols-2 gap-2">
              <Input label="Quantidade" required size="sm" type="number" step="0.001" placeholder="0" value={form.quantity} onChange={e => set("quantity", e.target.value)} />
              <Input label="Mín. alerta" size="sm" type="number" step="0.01" placeholder="0" value={form.minStock} onChange={e => set("minStock", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <UnitSelectInput label="Unidade de armazenamento" value={form.unit} onChange={v => set("unit", v)} />
              <Input label="Peso/Volume" size="sm" placeholder="500g, 1.5L" value={form.weight} onChange={e => set("weight", e.target.value)} />
            </div>
          </div>

          {/* Conversão de Unidades */}
          <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3 space-y-3">
            <SectionHeader icon={ArrowRightLeft} label="Conversão de Unidades (opcional)" color="bg-amber-500" />
            <p className="text-[11px] text-amber-700 leading-relaxed -mt-1">
              Use quando compra em uma unidade mas consome em outra. Ex: compra <b>1 garrafa (un)</b> de óleo que contém <b>1000 ml</b> — na produção desconta em <b>ml</b>.
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <UnitSelectInput
                  label="Unidade de compra"
                  value={form.purchaseUnit}
                  onChange={v => set("purchaseUnit", v)}
                  hint="como você compra"
                />
              </div>
              <div>
                <Input
                  label="Conteúdo por unidade"
                  size="sm"
                  type="number"
                  step="0.001"
                  placeholder="1000"
                  value={form.purchaseQty}
                  onChange={e => set("purchaseQty", e.target.value)}
                />
                <p className="text-[9px] text-amber-600 mt-0.5">quantidade contida</p>
              </div>
              <div>
                <UnitSelectInput
                  label="Unidade granular"
                  value={form.stockUnit}
                  onChange={v => set("stockUnit", v)}
                  hint="usada na produção"
                />
              </div>
            </div>
            {/* Preview da conversão */}
            {form.purchaseUnit && form.purchaseQty && form.stockUnit && (
              <div className="bg-white border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
                <span className="text-base">🔄</span>
                <p className="text-[12px] text-amber-800 font-bold">
                  1 <span className="text-amber-600">{form.purchaseUnit}</span>
                  {" = "}
                  <span className="text-amber-600">{form.purchaseQty} {form.stockUnit}</span>
                  {form.quantity ? (
                    <span className="text-slate-500 font-normal ml-1">
                      → estoque total:{" "}
                      <b className="text-amber-700">
                        {(parseFloat(form.quantity.toString()) * parseFloat(form.purchaseQty.toString())).toLocaleString("pt-BR")} {form.stockUnit}
                      </b>
                    </span>
                  ) : null}
                </p>
              </div>
            )}
            {(form.purchaseUnit || form.purchaseQty || form.stockUnit) &&
             !(form.purchaseUnit && form.purchaseQty && form.stockUnit) && (
              <p className="text-[10px] text-amber-500 italic">Preencha os 3 campos para ativar a conversão automática.</p>
            )}
          </div>

          {/* Financeiro */}
          <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 space-y-3">
            <SectionHeader icon={CircleDollarSign} label="Financeiro" color="bg-emerald-500" />
            <div className="grid grid-cols-2 gap-2">
              <CurrencyInput label="Custo (R$)" size="sm" value={form.purchasePrice} onChange={v => set("purchasePrice", v)} />
              <CurrencyInput label="Venda (R$)" size="sm" value={form.sellingPrice} onChange={v => set("sellingPrice", v)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input label="Compra" size="sm" type="date" value={form.purchaseDate} onChange={e => set("purchaseDate", e.target.value)} />
              <Input label="Validade" size="sm" type="date" value={form.expirationDate} onChange={e => set("expirationDate", e.target.value)} />
            </div>
          </div>

        </form>
      </Modal>

      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        title="Nova Categoria"
        size="sm"
        mobileStyle="center"
      >
        <CategoryForm
          tenantId={tenant?.id || ""}
          onSuccess={() => { refreshCategories(); setIsCategoryModalOpen(false); }}
          onClose={() => setIsCategoryModalOpen(false)}
          isInventory
        />
      </Modal>
    </>
  );
}

function CategoryForm({ tenantId, onSuccess, onClose, isInventory = false }: { tenantId: string, onSuccess: () => void, onClose: () => void, isInventory?: boolean }) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const url = isInventory ? "/api/inventory/categories" : "/api/categories";
    await apiFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, tenantId })
    });
    onSuccess();
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Input
        label="Nome da categoria"
        required
        autoFocus
        placeholder="Ex: Embalagens, Frios..."
        value={name}
        onChange={e => setName(e.target.value)}
      />
      <ModalFooter>
        <Button variant="ghost" type="button" onClick={onClose} disabled={loading}>Voltar</Button>
        <Button variant="primary" type="submit" disabled={loading}>
          {loading ? "Salvando..." : "Criar Categoria"}
        </Button>
      </ModalFooter>
    </form>
  );
}

