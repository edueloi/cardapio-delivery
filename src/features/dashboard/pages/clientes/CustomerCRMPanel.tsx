import React, { useState, useEffect, useCallback } from "react";
import {
  Users, Phone, Mail, MapPin, Search, Plus,
  Star, ShoppingBag, TrendingUp, ChevronRight, X,
  Trophy, Crown, Award,
} from "lucide-react";
import {
  PageWrapper, SectionTitle, StatGrid, StatCard, ContentCard,
  Modal, ModalFooter, Button, Input, EmptyState, Pagination,
  useToast,
} from "../../../../components";
import { apiFetch, apiJson } from "../../../../lib/api";
import type { Tenant, Order, Customer } from "../../../../types";

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

interface CRMPanelProps {
  slug: string;
  tenant: Tenant;
}

export default function CustomerCRMPanel({ slug, tenant }: CRMPanelProps) {
  const toast = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // Form modal
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({ name: "", phone: "", email: "", address: "", notes: "" });
  const [formLoading, setFormLoading] = useState(false);

  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (searchTerm) params.set("search", searchTerm);
      const res = await apiFetch(`/api/tenants/${slug}/customers?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers);
        setTotal(data.total);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [slug, page, searchTerm]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers, page]);

  const fetchCustomerOrders = async (customer: Customer) => {
    setOrdersLoading(true);
    try {
      const res = await apiFetch(`/api/tenants/${slug}/customers/${customer.id}/orders`);
      if (res.ok) setCustomerOrders(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setOrdersLoading(false);
    }
  };

  const openCustomer = (c: Customer) => {
    setSelectedCustomer(c);
    setCustomerOrders([]);
    fetchCustomerOrders(c);
  };

  const openForm = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({ name: customer.name, phone: customer.phone, email: customer.email || "", address: customer.address || "", notes: customer.notes || "" });
    } else {
      setEditingCustomer(null);
      setFormData({ name: "", phone: "", email: "", address: "", notes: "" });
    }
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.phone) return;
    setFormLoading(true);
    try {
      if (editingCustomer) {
        await apiJson(`/api/tenants/${slug}/customers/${editingCustomer.id}`, {
          method: "PATCH",
          body: JSON.stringify(formData),
        });
      } else {
        await apiJson(`/api/tenants/${slug}/customers`, {
          method: "POST",
          body: JSON.stringify(formData),
        });
      }
      setShowForm(false);
      fetchCustomers();
    } catch { toast.error("Erro ao salvar cliente."); }
    finally { setFormLoading(false); }
  };

  const topCustomers = [...customers].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 3);
  const totalRevenue = customers.reduce((s, c) => s + c.totalSpent, 0);
  const avgTicket = customers.length > 0 ? customers.reduce((s, c) => s + (c.ordersCount > 0 ? c.totalSpent / c.ordersCount : 0), 0) / customers.length : 0;

  const rankIcon = (i: number) => {
    if (i === 0) return <Crown className="w-4 h-4 text-yellow-500" />;
    if (i === 1) return <Trophy className="w-4 h-4 text-slate-400" />;
    return <Award className="w-4 h-4 text-amber-600" />;
  };

  return (
    <PageWrapper className="space-y-4">
      <SectionTitle
        title="Clientes"
        description="Gerencie e acompanhe seus clientes"
        icon={Users}
        action={
          <Button
            variant="primary"
            size="sm"
            iconLeft={<Plus className="w-4 h-4" />}
            onClick={() => openForm()}
          >
            Novo Cliente
          </Button>
        }
      />

      <StatGrid cols={4}>
        <StatCard title="Total de Clientes" value={total} icon={Users} color="info" delay={0} />
        <StatCard title="Receita Total" value={fmt(totalRevenue)} icon={TrendingUp} color="success" delay={0.1} />
        <StatCard title="Ticket Médio" value={fmt(avgTicket)} icon={ShoppingBag} color="default" delay={0.2} />
        <StatCard title="Top Clientes" value={topCustomers.length} icon={Star} color="warning" delay={0.3} />
      </StatGrid>

      {/* Top 3 customers */}
      {topCustomers.length > 0 && (
        <ContentCard>
          <h3 className="mb-3 text-sm font-medium text-slate-800">Melhores clientes</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {topCustomers.map((c, i) => (
              <button
                key={c.id}
                onClick={() => openCustomer(c)}
                className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-blue-50 hover:border-blue-300 border border-transparent transition-all text-left"
              >
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-sm shrink-0">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800 truncate">{c.name}</p>
                  <p className="text-xs text-blue-700 font-semibold">{fmt(c.totalSpent)}</p>
                </div>
                {rankIcon(i)}
              </button>
            ))}
          </div>
        </ContentCard>
      )}

      <div className="max-w-[280px]">
        <Input
          iconLeft={<Search className="w-4 h-4" />}
          placeholder="Buscar por nome, telefone ou e-mail..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Table */}
      <ContentCard padding="none">
        {loading ? (
          <div className="flex justify-center p-12 opacity-30">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : customers.length === 0 ? (
          <EmptyState
            title="Nenhum cliente encontrado"
            description="Cadastre clientes ou eles serão criados automaticamente ao fazer pedidos no PDV."
            icon={Users}
          />
        ) : (
          <>
            <div className="hidden sm:grid grid-cols-5 px-5 py-3 text-[11px] font-semibold text-slate-400 border-b border-slate-100">
              <span className="col-span-2">Cliente</span>
              <span>Pedidos</span>
              <span>Gasto Total</span>
              <span className="text-right">Pontos</span>
            </div>
            <div className="divide-y divide-slate-50">
              {customers.map((c) => (
                <button
                  key={c.id}
                  onClick={() => openCustomer(c)}
                  className="w-full grid grid-cols-1 sm:grid-cols-5 px-5 py-4 hover:bg-slate-50 transition-all text-left gap-1 sm:gap-0 items-center"
                >
                  <div className="col-span-2 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-sm shrink-0">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{c.name}</p>
                      <p className="text-[11px] text-slate-400">{c.phone}</p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 font-semibold">{c.ordersCount} pedidos</p>
                  <p className="text-sm font-semibold text-blue-700">{fmt(c.totalSpent)}</p>
                  <div className="text-right flex items-center justify-end gap-1">
                    <Star className="w-3 h-3 text-yellow-400" />
                    <span className="text-sm font-semibold text-slate-700">{c.loyaltyPoints}</span>
                    <ChevronRight className="w-4 h-4 text-slate-300 ml-1" />
                  </div>
                </button>
              ))}
            </div>
            {total > PAGE_SIZE && (
              <div className="p-4 border-t border-slate-100">
                <Pagination
                  total={total}
                  page={page}
                  pageSize={PAGE_SIZE}
                  onPageChange={setPage}
                  onPageSizeChange={() => {}}
                  showPageSizeSelector={false}
                />
              </div>
            )}
          </>
        )}
      </ContentCard>

      {/* ─── Customer Detail Modal ─── */}
      <Modal
        isOpen={!!selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
        title={selectedCustomer?.name}
        size="xl"
        footer={
          <ModalFooter align="between">
            <Button variant="ghost" onClick={() => setSelectedCustomer(null)}>Fechar</Button>
            <Button variant="outline" onClick={() => { setSelectedCustomer(null); openForm(selectedCustomer!); }}>
              Editar Cliente
            </Button>
          </ModalFooter>
        }
      >
        {selectedCustomer && (
          <div className="space-y-6">
            {/* Info cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-[11px] font-semibold text-slate-400 mb-1">Pedidos</p>
                <p className="text-2xl font-semibold text-slate-800">{selectedCustomer.ordersCount}</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-[11px] font-semibold text-blue-700 mb-1">Gasto Total</p>
                <p className="text-xl font-semibold text-blue-800">{fmt(selectedCustomer.totalSpent)}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-[11px] font-semibold text-slate-400 mb-1">Ticket Médio</p>
                <p className="text-xl font-semibold text-slate-800">
                  {selectedCustomer.ordersCount > 0 ? fmt(selectedCustomer.totalSpent / selectedCustomer.ordersCount) : fmt(0)}
                </p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-3">
                <p className="text-[11px] font-semibold text-yellow-600 mb-1">Pontos</p>
                <p className="text-2xl font-semibold text-yellow-600">{selectedCustomer.loyaltyPoints}</p>
              </div>
            </div>

            {/* Contact */}
            <ContentCard>
              <h4 className="text-xs font-semibold text-slate-500 mb-3">Contato</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-slate-700">{selectedCustomer.phone}</span>
                </div>
                {selectedCustomer.email && (
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-slate-700">{selectedCustomer.email}</span>
                  </div>
                )}
                {selectedCustomer.address && (
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-slate-700">{selectedCustomer.address}</span>
                  </div>
                )}
                {selectedCustomer.notes && (
                  <div className="bg-yellow-50 rounded-lg p-3 text-sm text-yellow-800 italic">
                    {selectedCustomer.notes}
                  </div>
                )}
              </div>
            </ContentCard>

            {/* Order history */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 mb-3">Últimos Pedidos</h4>
              {ordersLoading ? (
                <div className="flex justify-center py-8 opacity-30">
                  <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : customerOrders.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">Nenhum pedido encontrado.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                  {customerOrders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg text-sm">
                      <div>
                        <p className="font-semibold text-slate-800">
                          {new Date(order.createdAt).toLocaleDateString("pt-BR")}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {order.items.length} itens · {order.paymentMethod}
                        </p>
                      </div>
                      <span className="font-semibold text-blue-700">{fmt(order.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ─── Add/Edit Customer Modal ─── */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingCustomer ? "Editar Cliente" : "Novo Cliente"}
        size="sm"
        footer={
          <ModalFooter>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button variant="primary" loading={formLoading} onClick={handleSave}>
              {editingCustomer ? "Salvar" : "Cadastrar"}
            </Button>
          </ModalFooter>
        }
      >
        <div className="space-y-4">
          <Input
            label="Nome *"
            placeholder="Nome completo"
            value={formData.name}
            onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
          />
          <Input
            label="Telefone *"
            placeholder="(00) 00000-0000"
            value={formData.phone}
            onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
          />
          <Input
            label="E-mail"
            type="email"
            placeholder="email@exemplo.com"
            value={formData.email}
            onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
          />
          <Input
            label="Endereço"
            placeholder="Rua, número, bairro..."
            value={formData.address}
            onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
          />
          <Input
            label="Observações"
            placeholder="Preferências, alergias, etc."
            value={formData.notes}
            onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
          />
        </div>
      </Modal>
    </PageWrapper>
  );
}
