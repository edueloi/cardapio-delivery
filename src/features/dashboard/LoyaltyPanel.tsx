import React, { useState, useEffect } from "react";
import { 
  Heart, Gift, Users, Settings, Save, 
  Search, Star, TrendingUp, Award,
  ChevronRight, ArrowUpRight, MessageCircle, Filter, SortAsc, SortDesc
} from "lucide-react";
import { motion } from "motion/react";
import type { Tenant, LoyaltyConfig, CustomerLoyalty } from "../../types";
import { apiJson, apiFetch } from "../../lib/api";
import { 
  ContentCard, 
  SectionTitle,
  StatCard,
  StatGrid
} from "../../components";

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

interface LoyaltyPanelProps {
  tenant: Tenant;
  onUpdated: () => void;
}

export default function LoyaltyPanel({ tenant, onUpdated }: LoyaltyPanelProps) {
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
        setCustomers(data);
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
      alert("Configurações salvas!");
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar.");
    } finally {
      setIsSaving(false);
    }
  };

  const sortedCustomers = [...customers]
    .filter(c => c.customerPhone.includes(searchTerm))
    .sort((a, b) => {
      const valA = sortBy === "points" ? a.points : sortBy === "spent" ? a.totalSpent : a.ordersCount;
      const valB = sortBy === "points" ? b.points : sortBy === "spent" ? b.totalSpent : b.ordersCount;
      return sortOrder === "desc" ? valB - valA : valA - valB;
    });

  const sendPromo = (phone: string) => {
    const message = encodeURIComponent(`Olá! Notamos que você é um de nossos clientes favoritos. 🌟\n\nComo agradecimento, aqui está um cupom de 10% de desconto para seu próximo pedido: CLIENTE_VIP10\n\nPeça agora: ${window.location.origin}/${tenant.slug}`);
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <SectionTitle 
          title="Fidelidade & CRM"
          description="Transforme clientes casuais em fãs do seu negócio."
          icon={Heart}
        />
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => setActiveSubTab("config")}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
              activeSubTab === "config" ? 'bg-white shadow-sm text-[#C9A227]' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Configurações
          </button>
          <button 
            onClick={() => setActiveSubTab("customers")}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
              activeSubTab === "customers" ? 'bg-white shadow-sm text-[#C9A227]' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Clientes (CRM)
          </button>
        </div>
      </div>

      {activeSubTab === "config" ? (
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-8 space-y-6">
            <ContentCard>
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#C9A227]/10 flex items-center justify-center">
                    <Gift className="w-6 h-6 text-[#C9A227]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-800">Regras de Pontuação</h3>
                    <p className="text-xs text-slate-400">Como seus clientes ganham e gastam pontos.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black uppercase text-slate-400">Sistema Ativo</span>
                  <button 
                    onClick={() => setConfig({ ...config, enabled: !config.enabled })}
                    className={`w-12 h-6 rounded-full transition-all relative ${config.enabled ? 'bg-green-500' : 'bg-slate-200'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${config.enabled ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Pontos por Real Gasto</label>
                  <div className="relative">
                    <input 
                      type="number"
                      value={config.pointsPerReal}
                      onChange={e => setConfig({ ...config, pointsPerReal: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-bold focus:border-[#C9A227] outline-none transition-all"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-[#C9A227]">PTS / R$ 1</span>
                  </div>
                  <p className="text-[10px] text-slate-400 italic">Recomendado: 1 ponto para cada R$ 1,00.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Mínimo para Resgate</label>
                  <div className="relative">
                    <input 
                      type="number"
                      value={config.minPointsToRedeem}
                      onChange={e => setConfig({ ...config, minPointsToRedeem: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-bold focus:border-[#C9A227] outline-none transition-all"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-[#C9A227]">PONTOS</span>
                  </div>
                  <p className="text-[10px] text-slate-400 italic">O cliente só pode usar os pontos após atingir este valor.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Valor do Ponto (Ratio)</label>
                  <div className="relative">
                    <input 
                      type="number"
                      step="0.01"
                      value={config.redemptionRatio}
                      onChange={e => setConfig({ ...config, redemptionRatio: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-bold focus:border-[#C9A227] outline-none transition-all"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-[#C9A227]">R$ / PONTO</span>
                  </div>
                  <p className="text-[10px] text-slate-400 italic">Ex: 0,10 significa que 10 pontos valem R$ 1,00 de desconto.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Desconto Máximo por Pedido</label>
                  <div className="relative">
                    <input 
                      type="number"
                      value={config.maxRedemptionValue || ""}
                      onChange={e => setConfig({ ...config, maxRedemptionValue: Number(e.target.value) })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-bold focus:border-[#C9A227] outline-none transition-all"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-[#C9A227]">BRL (OPCIONAL)</span>
                  </div>
                  <p className="text-[10px] text-slate-400 italic">Limite de desconto para proteger sua margem.</p>
                </div>
              </div>

              <div className="mt-12 pt-8 border-t border-slate-100 flex justify-end">
                <button 
                  disabled={isSaving}
                  onClick={handleSaveConfig}
                  className="bg-[#0D1B3E] hover:bg-slate-800 text-white px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-3 transition-all disabled:opacity-50"
                >
                  {isSaving ? "Salvando..." : (
                    <>
                      <Save className="w-4 h-4" />
                      Salvar Configurações
                    </>
                  )}
                </button>
              </div>
            </ContentCard>

            <div className="bg-gradient-to-br from-[#0D1B3E] to-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden">
              <div className="relative z-10 space-y-4">
                <h4 className="text-xl font-black">Dica de Especialista</h4>
                <p className="text-white/60 text-sm leading-relaxed max-w-md">
                  Sistemas de pontos aumentam a retenção em até 40%. Tente oferecer um "item grátis" quando o cliente atingir 100 pontos, isso cria uma meta visual que estimula a compra.
                </p>
                <div className="flex items-center gap-3 pt-2">
                  <TrendingUp className="w-5 h-5 text-[#C9A227]" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#C9A227]">Aumente seu Ticket Médio</span>
                </div>
              </div>
              <Award className="absolute -right-8 -bottom-8 w-48 h-48 text-white/5 -rotate-12" />
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4 space-y-6">
            <StatCard 
              title="Total de Clientes"
              value={customers.length}
              icon={Users}
              description="Participando do programa"
              color="info"
            />
            <StatCard 
              title="Pontos em Circulação"
              value={customers.reduce((acc, c) => acc + c.points, 0)}
              icon={Star}
              description="Créditos pendentes"
              color="warning"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text"
                placeholder="Buscar por telefone..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl py-3 pl-12 pr-4 text-sm focus:border-[#C9A227] outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest mr-2">Ordenar por:</span>
              {(["spent", "points", "orders"] as const).map(key => (
                <button
                  key={key}
                  onClick={() => {
                    if (sortBy === key) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    else { setSortBy(key); setSortOrder("desc"); }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border ${
                    sortBy === key ? 'bg-[#0D1B3E] text-white border-[#0D1B3E]' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {key === "spent" ? "Gasto" : key === "points" ? "Pontos" : "Pedidos"}
                  {sortBy === key && (sortOrder === "desc" ? <SortDesc className="w-3 h-3 inline ml-1" /> : <SortAsc className="w-3 h-3 inline ml-1" />)}
                </button>
              ))}
            </div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
              {sortedCustomers.length} Clientes Encontrados
            </p>
          </div>

          <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Cliente (WhatsApp)</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Pontos Atuais</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Gasto Total</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Pedidos</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sortedCustomers.map(customer => {
                  const isVIP = customer.totalSpent > 500 || customer.ordersCount > 10;
                  const isNew = customer.ordersCount <= 2;

                  return (
                    <tr key={customer.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                            isVIP ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400 group-hover:bg-[#C9A227]/10 group-hover:text-[#C9A227]'
                          }`}>
                            {isVIP ? <Star className="w-5 h-5 fill-amber-600" /> : <Users className="w-5 h-5" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-slate-800">{customer.customerPhone}</p>
                              {isVIP && <span className="text-[8px] font-black uppercase bg-amber-500 text-white px-1.5 py-0.5 rounded shadow-sm">VIP</span>}
                              {isNew && <span className="text-[8px] font-black uppercase bg-blue-500 text-white px-1.5 py-0.5 rounded shadow-sm">Novo</span>}
                            </div>
                            <p className="text-[10px] text-slate-400">
                              {isVIP ? "Cliente Estrela" : isNew ? "Primeiras compras" : "Cliente Recorrente"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-center">
                        <div className="inline-flex items-center gap-2 bg-yellow-50 text-yellow-700 px-3 py-1 rounded-full text-xs font-black">
                          <Star className="w-3 h-3 fill-yellow-700" />
                          {customer.points} pts
                        </div>
                      </td>
                      <td className="px-8 py-5 text-center font-bold text-slate-600">
                        {fmt(customer.totalSpent)}
                      </td>
                      <td className="px-8 py-5 text-center font-bold text-slate-400">
                        {customer.ordersCount}
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => sendPromo(customer.customerPhone)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-green-100 transition-all"
                            title="Disparar Promoção WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            Promo
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {sortedCustomers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-8 py-20 text-center space-y-4">
                      <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto text-slate-300">
                        <Users className="w-8 h-8" />
                      </div>
                      <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Nenhum cliente fidelizado ainda.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
