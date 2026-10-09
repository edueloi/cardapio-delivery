import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import {
  AlertTriangle,
  ArrowRightLeft,
  CalendarClock,
  CircleDollarSign,
  Ban,
  Boxes,
  Package,
  Plus,
  ShoppingBag,
  Settings,
  Trash2,
} from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  ConfirmModal,
  CurrencyInput,
  FilterLine,
  FilterLineItem,
  FilterLineSearch,
  FilterLineSection,
  FilterLineSegmented,
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
  Tabs,
} from "../../../../components";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiFetch } from "../../../../lib/api";
import { InventoryItemForm } from "./InventoryItemForm";
import { Tenant } from "../../../../types";

const STOCK_VIEWS = [
  { id: "all", label: "Todos", icon: Package },
  { id: "low", label: "Críticos", icon: AlertTriangle },
  { id: "expiring", label: "A Vencer", icon: CalendarClock },
  { id: "expired", label: "Vencidos", icon: Ban },
  { id: "sale", label: "Para Venda", icon: ShoppingBag },
  { id: "internal", label: "Consumo", icon: Boxes },
] as const;
type StockView = (typeof STOCK_VIEWS)[number]["id"];

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
        <FilterLineSegmented
          value={type}
          onChange={(v) => setType(v as "IN" | "OUT")}
          options={[
            { value: "IN", label: "Entrada (Adicionar)" },
            { value: "OUT", label: "Saída (Baixa/Perda)" },
          ]}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isNewBatch}
                onChange={(e) => setIsNewBatch(e.target.checked)}
                className="h-4 w-4 rounded accent-blue-600"
              />
              <span className="text-xs font-medium text-slate-700">Registrar como novo lote / validade</span>
            </label>

            {isNewBatch && (
              <div className="grid grid-cols-1 gap-3 pt-3 border-t border-slate-200 sm:grid-cols-2">
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
          <Button type="submit" loading={loading} variant={type === "IN" ? "success" : "danger"}>
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
  const [filterType, setFilterType] = useState<StockView>("all");
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

  // O item abre em tela cheia; o histórico do navegador (?item=) faz o botão
  // "voltar" fechar o formulário em vez de sair do painel.
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const itemParam = searchParams.get("item");
  const historySeen = useRef(false);

  const openItemForm = (target: any | null) => {
    setEditingItem(target);
    setShowItemForm(true);
    const next = new URLSearchParams(window.location.search);
    next.set("item", target?.id ?? "novo");
    historySeen.current = true;
    navigate({ search: next.toString() });
  };

  const leaveItemForm = () => {
    setShowItemForm(false);
    setEditingItem(null);
    if (searchParams.get("item")) {
      historySeen.current = false;
      navigate(-1);
    }
  };

  const openItemEditor = (item: any) => {
    const baseItem = resolveBaseInventoryItem(item);
    if (!baseItem) return;
    openItemForm(baseItem);
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

  useEffect(() => {
    if (itemParam) {
      historySeen.current = true;
      if (!showItemForm) {
        if (itemParam === "novo") { setEditingItem(null); setShowItemForm(true); }
        else {
          const found = items.find(i => i.id === itemParam);
          if (found) { setEditingItem(found); setShowItemForm(true); }
        }
      }
      return;
    }
    if (historySeen.current) {
      historySeen.current = false;
      setShowItemForm(false);
      setEditingItem(null);
    }
  }, [itemParam, items]);

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

  if (showItemForm) {
    return (
      <PageWrapper>
        <InventoryItemForm
          tenant={tenant}
          item={editingItem}
          categories={categories}
          onClose={leaveItemForm}
          onSave={() => { leaveItemForm(); fetchData(); }}
          refreshCategories={fetchData}
        />
      </PageWrapper>
    );
  }

  if (loading) return <div className="p-20 text-center text-xs text-slate-500 animate-pulse">Carregando Inventário...</div>;

  const tabItems = STOCK_VIEWS.map((v) =>
    v.id === "low" ? { ...v, badge: stats.lowStock || undefined }
    : v.id === "expiring" ? { ...v, badge: stats.nearExpiry || undefined }
    : v.id === "expired" ? { ...v, badge: stats.expired || undefined }
    : v
  );

  return (
    <PageWrapper>
    <div className="space-y-4">
      <SectionTitle
        title="Estoque"
        description="Controle insumos, lotes, validades e movimentações."
        icon={Package}
        action={
          <Button
            onClick={() => openItemForm(null)}
            size="sm"
            iconLeft={<Plus size={14} />}
          >
            Novo Item
          </Button>
        }
      />

      {/* Stats Summary */}
      <StatGrid cols={4}>
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
          className={`cursor-pointer ${stats.nearExpiry > 0 ? "rounded-lg ring-2 ring-amber-400 ring-offset-2" : ""}`}
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
      </StatGrid>

      <Tabs<StockView> items={tabItems} value={filterType} onChange={setFilterType} label="Visões do estoque">
        <FilterLine>
          <FilterLineSection grow>
            <FilterLineItem grow minWidth={180} className="sm:max-w-[280px]">
              <FilterLineSearch
                aria-label="Buscar item de estoque"
                placeholder="Buscar por nome ou código..."
                value={searchTerm}
                onChange={setSearchTerm}
              />
            </FilterLineItem>
            <FilterLineItem minWidth={180}>
              <Select
                aria-label="Filtrar por categoria"
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
              >
                <option value="all">Todas as categorias</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} ({items.filter(i => i.categoryId === cat.id).length})
                  </option>
                ))}
              </Select>
            </FilterLineItem>
            {filterCategory !== "all" && (
              <Button variant="ghost" size="sm" onClick={() => setFilterCategory("all")} title="Limpar filtro">
                Limpar filtro ({filteredItems.length} item(s))
              </Button>
            )}
          </FilterLineSection>
          <FilterLineSection align="right">
            <Button
              type="button"
              variant="outline"
              size="sm"
              iconLeft={<Settings size={14} />}
              onClick={() => setShowManageCategories(true)}
              title="Editar ou excluir categorias de estoque"
            >
              Categorias
            </Button>
          </FilterLineSection>
        </FilterLine>

        <GridTable 
          data={groupedItems}
          keyExtractor={item => item.id}
          isRowExpanded={(item) => expandedRows.has(item.id)}
          onRowClick={(item) => item.isGroup && toggleRow(item.id)}
          renderDesktopExpandedContent={(item) => {
            if (!item.isGroup) return null;
            return (
              <div className="px-6 py-4 bg-slate-50/50 rounded-b-lg border-t border-slate-100">
                <div className="flex items-center gap-2 mb-3">
                  <h4 className="text-[11px] font-semibold text-slate-400">Lotes ({item.batches.length})</h4>
                  <div className="h-px bg-slate-200 flex-1" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {item.batches.map((batch: any) => {
                    const bIsExpired = batch.expirationDate && new Date(batch.expirationDate) < new Date();
                    return (
                      <div key={batch.id} className="bg-white p-3 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors flex flex-col gap-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-[10px] text-slate-400 font-semibold">Lote / SKU</p>
                            <p className="text-sm font-semibold text-slate-700">{batch.code || "S/COD"}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] text-slate-400 font-semibold">Qtd</p>
                            <p className="text-sm font-semibold text-slate-800">{batch.quantity} <span className="text-slate-400 font-medium text-xs">{batch.unit}</span></p>
                          </div>
                        </div>
                        <div className="flex justify-between items-end mt-1 pt-2 border-t border-slate-100">
                          <div>
                            <p className="text-[10px] text-slate-400 font-semibold mb-0.5">Validade</p>
                            {batch.expirationDate ? (
                              <p className={`text-xs font-semibold ${bIsExpired ? "text-red-500" : "text-emerald-600"}`}>
                                {new Date(batch.expirationDate).toLocaleDateString("pt-BR")}
                              </p>
                            ) : (
                              <p className="text-[11px] font-semibold text-slate-400 italic">Sem validade</p>
                            )}
                          </div>
                          <div className="flex gap-0.5">
                            <IconButton aria-label="Editar lote" variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openItemForm(batch); }}>
                              <Settings className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600" />
                            </IconButton>
                            <IconButton aria-label="Remover lote" variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDeletingItem(batch); }}>
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
                  <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 transition-all border border-slate-200/50 relative">
                    <Package className="h-4 w-4" />
                    {item.isGroup && (
                      <span className="absolute -top-1.5 -right-1.5 bg-blue-100 text-blue-700 text-[10px] font-semibold w-4 h-4 rounded-full flex items-center justify-center border border-blue-200">{item.batches.length}</span>
                    )}
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-slate-800 leading-tight flex items-center gap-2">
                      {item.name}
                      {item.isGroup && (
                        <span className="text-[11px] text-slate-400 font-semibold">Múltiplos Lotes</span>
                      )}
                    </p>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                      {item.isGroup ? `${item.brand || 'Marca n/d'} • Várias Validades`:`#${item.code || 'S/COD'} • ${item.brand || 'Marca n/d'}`}
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
                    <span className={`text-sm font-semibold ${isLow ? 'text-orange-600' : 'text-slate-800'}`}>
                      {item.quantity} {item.unit || item.purchaseUnit || 'un'}
                    </span>
                    {hasConversion && granularTotal !== null && (
                      <span className="text-[11px] text-blue-700 font-medium bg-blue-50 px-1.5 py-0.5 rounded-md">
                        ≈ {granularTotal.toLocaleString("pt-BR")} {item.stockUnit}
                      </span>
                    )}
                    {item.weight && <p className="text-[10px] text-slate-400 italic">({item.weight})</p>}
                  </div>
                );
              }
            },
            {
              header: "Custos",
              render: item => (
                <div className="space-y-0.5">
                  <p className="text-[11px] font-semibold text-slate-400">Compra: <span className="text-slate-800 font-semibold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.purchasePrice || 0)}</span></p>
                  {item.sellingPrice && (
                    <p className="text-[11px] font-semibold text-slate-400">Venda: <span className="text-emerald-600 font-semibold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.sellingPrice)}</span></p>
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
                          <p className="text-[11px] font-semibold text-amber-600 animate-pulse">
                            ⚠ {daysLeft === 0 ? "Vence hoje!" : `${daysLeft} dia${daysLeft === 1 ? "" : "s"} restante${daysLeft === 1 ? "" : "s"}`}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-300 font-semibold italic">Sem validade</span>
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
                    variant="outline"
                    size="sm"
                    className="hidden sm:flex"
                    onClick={(e) => { e.stopPropagation(); openQuickAdjust(item); }}
                  >
                    Movimentar
                  </Button>
                  <IconButton 
                    variant="ghost" 
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); openItemEditor(item); }}
                    aria-label="Editar item"
                    title={item.isGroup ? "Editar lote mais antigo" : "Editar"}
                  >
                    <Settings className="w-4 h-4" />
                  </IconButton>
                  {!item.isGroup && (
                    <IconButton
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-600"
                      aria-label="Remover item"
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
      </Tabs>
    </div>

      <AnimatePresence>
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
              <span className="block mt-2 text-amber-600 text-xs font-medium">
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
    </PageWrapper>
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
            <div key={cat.id} className="flex items-center gap-2 border border-zinc-100 rounded-lg px-3 py-2 bg-white">
              {isEditing ? (
                <>
                  <Input
                    autoFocus
                    size="sm"
                    wrapperClassName="flex-1 min-w-0"
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") saveEdit(cat.id); if (e.key === "Escape") setEditingId(null); }}
                  />
                  <Button size="xs" onClick={() => saveEdit(cat.id)} disabled={savingId === cat.id}>
                    Salvar
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => setEditingId(null)}>
                    Cancelar
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-slate-700 truncate">{cat.name}</p>
                    <p className="text-[11px] text-slate-400 font-semibold">{count} item(ns)</p>
                  </div>
                  <IconButton size="sm" aria-label="Editar nome" title="Editar nome" onClick={() => startEdit(cat)}>
                    <Settings size={14} />
                  </IconButton>
                  <IconButton size="sm" aria-label="Excluir categoria" title="Excluir categoria" className="text-slate-400 hover:text-red-500" onClick={() => askDelete(cat)}>
                    <Trash2 size={14} />
                  </IconButton>
                </>
              )}
            </div>
          );
        })}
        {categories.length === 0 && (
          <p className="text-center text-xs text-slate-500 py-6">Nenhuma categoria cadastrada ainda.</p>
        )}
      </div>

      <form onSubmit={handleAdd} className="flex items-center gap-2 pt-2 border-t border-zinc-100">
        <Input
          wrapperClassName="flex-1 min-w-0"
          value={addingName}
          onChange={e => setAddingName(e.target.value)}
          placeholder="Nova categoria..."
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
              <span className="block mt-2 text-amber-600 text-xs font-medium">
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
