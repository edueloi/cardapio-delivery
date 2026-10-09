import React, { useState, useEffect } from "react";
import {
  Heart, Gift, Users, Save,
  Search, Star, Settings, MessageCircle, SortAsc, SortDesc
} from "lucide-react";
import type { Tenant, LoyaltyConfig, CustomerLoyalty } from "../../../../types";
import { apiJson, apiFetch } from "../../../../lib/api";
import {
  PageWrapper,
  ContentCard,
  SectionTitle,
  StatCard,
  StatGrid,
  Tabs,
  Button,
  Input,
  Switch,
  Alert,
  Badge,
  EmptyState,
  GridTable,
  usePagination,
  useToast
} from "../../../../components";

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

const SUB_TABS = [
  { id: "config", label: "Configurações", icon: Settings },
  { id: "customers", label: "Clientes", icon: Users },
] as const;

interface LoyaltyPanelProps {
  tenant: Tenant;
  onUpdated: () => void;
}

export default function LoyaltyPanel({ tenant, onUpdated }: LoyaltyPanelProps) {
  const toast = useToast();
  const [config, setConfig] = useState<LoyaltyConfig>(tenant.loyaltyConfig || {
    id: "",
    tenantId: tenant.id,
    enabled: false,
    pointsPerReal: 1,
    minPointsToRedeem: 100,
    redemptionRatio: 0.10,
    maxRedemptionValue: 50
  });

  const [customers, setCustomers] = useState<CustomerLoyalty[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<"config" | "customers">("config");
  const [sortBy, setSortBy] = useState<"points" | "spent" | "orders">("spent");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const data = await apiJson<CustomerLoyalty[]>(`/api/admin/${tenant.id}/loyalty/customers`);
        setCustomers(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Erro ao buscar clientes fidelidade", err);
      }
    };
    if (activeSubTab === "customers") {
      fetchCustomers();
    }
  }, [tenant.id, activeSubTab]);

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      await apiFetch(`/api/admin/${tenant.id}/loyalty/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config)
      });
      onUpdated();
      toast.success("Configurações salvas!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar.");
    } finally {
      setIsSaving(false);
    }
  };

  const sortedCustomers = Array.isArray(customers) ? [...customers]
    .filter(c => c.customerPhone.includes(searchTerm))
    .sort((a, b) => {
      const valA = sortBy === "points" ? a.points : sortBy === "spent" ? a.totalSpent : a.ordersCount;
      const valB = sortBy === "points" ? b.points : sortBy === "spent" ? b.totalSpent : b.ordersCount;
      return sortOrder === "desc" ? valB - valA : valA - valB;
    }) : [];

  const pager = usePagination(sortedCustomers);

  const sendPromo = (phone: string) => {
    const message = encodeURIComponent(`Olá! Notamos que você é um de nossos clientes favoritos. 🌟\n\nComo agradecimento, aqui está um cupom de 10% de desconto para seu próximo pedido: CLIENTE_VIP10\n\nPeça agora: ${window.location.origin}/${tenant.slug}`);
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
  };

  const totalPoints = customers.reduce((acc, c) => acc + c.points, 0);

  return (
    <PageWrapper>
      <div className="space-y-4">
        <SectionTitle
          title="Fidelidade & CRM"
          description="Transforme clientes casuais em fãs do seu negócio."
          icon={Heart}
          action={
            activeSubTab === "config" ? (
              <Button size="sm" loading={isSaving} iconLeft={<Save size={14} />} onClick={handleSaveConfig}>
                Salvar Configurações
              </Button>
            ) : undefined
          }
        />

        <StatGrid cols={2}>
          <StatCard title="Total de Clientes" value={customers.length} icon={Users} description="Participando do programa" color="info" />
          <StatCard title="Pontos em Circulação" value={totalPoints} icon={Star} description="Créditos pendentes" color="warning" />
        </StatGrid>

        <Tabs<typeof SUB_TABS[number]["id"]> items={SUB_TABS} value={activeSubTab} onChange={setActiveSubTab} label="Fidelidade">
          {activeSubTab === "config" ? (
            <ContentCard className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg border border-blue-100 bg-blue-50 flex items-center justify-center shrink-0">
                    <Gift className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-slate-800">Regras de Pontuação</h3>
                    <p className="text-[11px] text-slate-500">Como seus clientes ganham e gastam pontos.</p>
                  </div>
                </div>
                <Switch
                  label="Sistema Ativo"
                  checked={config.enabled}
                  onChange={(enabled) => setConfig({ ...config, enabled })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                <Input
                  label="Pontos por Real Gasto"
                  type="number"
                  value={config.pointsPerReal}
                  onChange={e => setConfig({ ...config, pointsPerReal: Number(e.target.value) })}
                  addonRight="PTS / R$ 1"
                  hint="Recomendado: 1 ponto para cada R$ 1,00."
                />
                <Input
                  label="Mínimo para Resgate"
                  type="number"
                  value={config.minPointsToRedeem}
                  onChange={e => setConfig({ ...config, minPointsToRedeem: Number(e.target.value) })}
                  addonRight="PONTOS"
                  hint="O cliente só pode usar os pontos após atingir este valor."
                />
                <Input
                  label="Valor do Ponto (Ratio)"
                  type="number"
                  step="0.01"
                  value={config.redemptionRatio}
                  onChange={e => setConfig({ ...config, redemptionRatio: Number(e.target.value) })}
                  addonRight="R$ / PONTO"
                  hint="Ex: 0,10 significa que 10 pontos valem R$ 1,00 de desconto."
                />
                <Input
                  label="Desconto Máximo por Pedido"
                  type="number"
                  value={config.maxRedemptionValue || ""}
                  onChange={e => setConfig({ ...config, maxRedemptionValue: Number(e.target.value) })}
                  addonRight="BRL (OPCIONAL)"
                  hint="Limite de desconto para proteger sua margem."
                />
              </div>

              <Alert variant="info" title="Dica de Especialista">
                Sistemas de pontos aumentam a retenção em até 40%. Tente oferecer um "item grátis" quando o cliente atingir 100 pontos, isso cria uma meta visual que estimula a compra.
              </Alert>
            </ContentCard>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                <div className="w-full sm:max-w-[280px]">
                  <Input
                    iconLeft={<Search className="w-4 h-4" />}
                    placeholder="Buscar por telefone..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-slate-500">Ordenar por:</span>
                  {(["spent", "points", "orders"] as const).map(key => (
                    <Button
                      key={key}
                      size="xs"
                      variant={sortBy === key ? "primary" : "outline"}
                      iconRight={sortBy === key ? (sortOrder === "desc" ? <SortDesc size={14} /> : <SortAsc size={14} />) : undefined}
                      onClick={() => {
                        if (sortBy === key) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                        else { setSortBy(key); setSortOrder("desc"); }
                      }}
                    >
                      {key === "spent" ? "Gasto" : key === "points" ? "Pontos" : "Pedidos"}
                    </Button>
                  ))}
                  <span className="text-[11px] text-slate-500">{sortedCustomers.length} clientes encontrados</span>
                </div>
              </div>

              {sortedCustomers.length === 0 ? (
                <ContentCard>
                  <EmptyState icon={Users} title="Nenhum cliente fidelizado ainda." />
                </ContentCard>
              ) : (
                <GridTable
                  data={pager.paginatedData}
                  keyExtractor={(c) => c.id}
                  pagination={{
                    total: sortedCustomers.length,
                    page: pager.page,
                    pageSize: pager.pageSize,
                    onPageChange: pager.setPage,
                    onPageSizeChange: pager.setPageSize,
                  }}
                  columns={[
                    {
                      header: "Cliente (WhatsApp)",
                      render: (customer) => {
                        const isVIP = customer.totalSpent > 500 || customer.ordersCount > 10;
                        const isNew = customer.ordersCount <= 2;
                        return (
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isVIP ? "bg-amber-100 text-amber-600" : "bg-slate-100 text-slate-500"}`}>
                              {isVIP ? <Star className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-medium text-slate-800">{customer.customerPhone}</p>
                                {isVIP && <Badge color="warning" size="sm">VIP</Badge>}
                                {isNew && <Badge color="info" size="sm">Novo</Badge>}
                              </div>
                              <p className="text-[11px] text-slate-500">
                                {isVIP ? "Cliente Estrela" : isNew ? "Primeiras compras" : "Cliente Recorrente"}
                              </p>
                            </div>
                          </div>
                        );
                      },
                    },
                    { header: "Pontos Atuais", render: (c) => <Badge color="warning" icon={<Star size={12} />}>{c.points} pts</Badge> },
                    { header: "Gasto Total", render: (c) => <span className="text-xs font-medium text-slate-700">{fmt(c.totalSpent)}</span> },
                    { header: "Pedidos", render: (c) => <span className="text-xs text-slate-500">{c.ordersCount}</span> },
                    {
                      header: "Ações",
                      className: "text-right",
                      headerClassName: "text-right",
                      render: (c) => (
                        <Button
                          size="xs"
                          variant="success"
                          iconLeft={<MessageCircle size={14} />}
                          title="Disparar Promoção WhatsApp"
                          onClick={() => sendPromo(c.customerPhone)}
                        >
                          Promo
                        </Button>
                      ),
                    },
                  ]}
                />
              )}
            </div>
          )}
        </Tabs>
      </div>
    </PageWrapper>
  );
}
