import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { 
  ClipboardList, 
  Utensils, 
  CheckCircle2, 
  Clock, 
  ChevronRight, 
  Phone,
  MessageSquare,
  LayoutDashboard,
  Settings,
  Menu,
  X,
  Info,
  CircleDollarSign,
  TrendingUp,
  Wallet,
  History,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Monitor,
  Trash2,
  Image as ImageIcon,
  Package,
  AlertTriangle,
  CalendarClock,
  ArrowRightLeft
} from "lucide-react";
import socket from "../lib/socket";
import { Order, Tenant, CashRegister } from "../types";
import { motion, AnimatePresence } from "motion/react";

export default function Dashboard() {
  const { slug } = useParams();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'live-orders' | 'history' | 'staff' | 'menu' | 'profile' | 'finance' | 'inventory'>('overview');
  const [subTab, setSubTab] = useState<'pending' | 'preparing' | 'shipped'>('pending');
  const [loading, setLoading] = useState(true);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const fetchTenant = () => {
    fetch(`/api/tenants/${slug}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setTenant(null);
          setLoading(false);
          return;
        }
        setTenant(data);
        socket.emit("join-tenant", data.id);
        fetchOrders(data.id);
        setLoading(false);
      })
      .catch(() => {
        setTenant(null);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchTenant();

    // Real-time listeners
    socket.on("new-order", (newOrder: Order) => {
      setOrders(prev => Array.isArray(prev) ? [newOrder, ...prev] : [newOrder]);
      new Audio('/notification.mp3').play().catch(() => {}); // Optional sound
    });

    socket.on("order-status-updated", (updatedOrder: Order) => {
      setOrders(prev => Array.isArray(prev) ? prev.map(o => o.id === updatedOrder.id ? updatedOrder : o) : []);
    });

    return () => {
      socket.off("new-order");
      socket.off("order-status-updated");
    };
  }, [slug]);

  const fetchOrders = (tenantId: string) => {
    fetch(`/api/admin/${tenantId}/orders`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setOrders(data);
        } else {
          setOrders([]);
        }
      })
      .catch(() => setOrders([]));
  };

  const updateStatus = async (orderId: string, status: string) => {
    try {
      await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
    } catch (err) {
      console.error(err);
    }
  };

  const statusMap = {
    pending: 'PENDING',
    preparing: 'PREPARING',
    completed: 'DELIVERED'
  };

  const filteredOrders = [...orders].filter(order => {
    if (activeTab === 'live-orders') {
      if (subTab === 'pending') return order.status === 'PENDING';
      if (subTab === 'preparing') return order.status === 'PREPARING';
      if (subTab === 'shipped') return order.status === 'SHIPPED';
    }
    if (activeTab === 'history') return order.status === 'DELIVERED' || order.status === 'CANCELLED';
    return true;
  }).sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F172A] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!tenant) {
    return (
       <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Painel não encontrado</h1>
          <p className="text-slate-400 mb-6">Não conseguimos localizar as configurações para {slug}</p>
          <Link to="/" className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold">Voltar ao Início</Link>
       </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col md:flex-row font-sans relative">
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between p-4 bg-[#0F172A] text-white sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-white uppercase text-xs">
            {tenant?.name?.[0] || 'G'}
          </div>
          <span className="font-bold tracking-tight text-sm uppercase">{tenant?.name}</span>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-[#0F172A] text-slate-300 flex flex-col transition-transform duration-300 ease-in-out md:translate-x-0 md:sticky md:top-0 md:h-screen shrink-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-white uppercase">
              {tenant?.name?.[0] || 'G'}
            </div>
            <span className="text-lg font-semibold text-white tracking-tight leading-none">
              {tenant?.name || 'SmartMenu'}
            </span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-500 hover:text-white">
             <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 py-6 px-4 space-y-1">
          {[
            { id: 'overview', icon: LayoutDashboard, label: 'Visão Geral', tab: 'overview' },
            { id: 'orders', icon: Clock, label: 'Painel de Pedidos', tab: 'live-orders' },
            { id: 'history', icon: History, label: 'Histórico', tab: 'history' },
            { id: 'menu', icon: Utensils, label: 'Cardápio', tab: 'menu' },
            { id: 'inventory', icon: Package, label: 'Estoque', tab: 'inventory' },
            { id: 'finance', icon: CircleDollarSign, label: 'Financeiro', tab: 'finance' },
            { id: 'profile', icon: Settings, label: 'Configurações', tab: 'profile' },
            { id: 'staff', icon: ClipboardList, label: 'Equipe', tab: 'staff' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.tab as any);
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium transition-colors cursor-pointer ${
                activeTab === item.tab
                  ? 'bg-slate-800 text-white shadow-sm' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <item.icon className="w-4 h-4" />
              <span className="text-sm">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
           <Link 
              to={`/${slug}`}
              className="flex items-center gap-3 w-full p-2 text-slate-400 hover:text-white transition-colors"
           >
              <Utensils className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-widest">Ver Cardápio</span>
           </Link>
        </div>

        <div className="p-6 bg-slate-950/50">
          <div className="flex items-center gap-2 text-[10px] text-green-500/80 font-mono">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div> 
            Server Online
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden" 
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Header */}
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 md:px-8 flex items-center justify-between shrink-0 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-slate-800">Painel Operacional</h2>
            <span className="bg-blue-50 text-blue-700 text-[10px] px-2 py-1 rounded font-bold uppercase border border-blue-100 tracking-wide">
              {tenant?.name || 'Unidade'}
            </span>
          </div>
          <div className="flex items-center gap-6">
            <Link 
              to={`/${slug}/display`}
              target="_blank"
              className="text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-2 group"
            >
               <span className="text-xs font-bold uppercase tracking-widest group-hover:underline">Painel TV</span>
               <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-200">
                  <Monitor className="w-4 h-4" />
               </div>
            </Link>
            <Link 
              to={`/${slug}`}
              className="text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-2 group"
            >
               <span className="text-xs font-bold uppercase tracking-widest group-hover:underline">Ver Cardápio</span>
               <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-200">
                  <Utensils className="w-4 h-4" />
               </div>
            </Link>
            <div className="hidden sm:flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              <span className="text-xs font-medium text-slate-600">Bot Atendimento: Ativo</span>
            </div>
            <div className="w-10 h-10 bg-slate-50 rounded-full border border-slate-200 flex items-center justify-center font-bold text-slate-400 text-sm">
              JS
            </div>
          </div>
        </header>

        <div className="p-4 md:p-8 overflow-y-auto">
          {activeTab === 'overview' && (
            <>
              {/* Stats Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
                  <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Pedidos Hoje</div>
                  <div className="text-2xl font-bold text-slate-800">{orders.length}</div>
                  <div className="text-[10px] text-green-600 mt-1 font-medium">↑ Atualizado agora</div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
                  <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Ticket Médio</div>
                  <div className="text-2xl font-bold text-slate-800">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(orders.reduce((acc, o) => acc + o.total, 0) / (orders.length || 1))}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 font-medium">Estável hoje</div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
                  <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Vendas Totais</div>
                   <div className="text-2xl font-bold text-blue-600">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(orders.reduce((acc, o) => acc + o.total, 0))}
                  </div>
                  <div className="text-[10px] text-blue-500 mt-1 font-medium">Acumulado do dia</div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
                  <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Fila Cozinha</div>
                  <div className="text-2xl font-bold text-orange-600">
                    {orders.filter(o => o.status === 'PREPARING').length}
                  </div>
                  <div className="text-[10px] text-orange-400 mt-1 font-medium">Requisições ativas</div>
                </div>
              </div>

              <div className="grid grid-cols-12 gap-6">
                 <div className="col-span-12 lg:col-span-8 space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                       <h3 className="text-lg font-bold text-slate-800 mb-4">Resumo da Operação</h3>
                       <div className="grid grid-cols-3 gap-4">
                          <button onClick={() => { setActiveTab('live-orders'); setSubTab('pending'); }} className="p-4 bg-blue-50 rounded-2xl text-center hover:bg-blue-100 transition-colors">
                             <div className="text-2xl font-black text-blue-600">{orders.filter(o => o.status === 'PENDING').length}</div>
                             <div className="text-[10px] font-black uppercase text-blue-400 tracking-wider">Aguardando</div>
                          </button>
                          <button onClick={() => { setActiveTab('live-orders'); setSubTab('preparing'); }} className="p-4 bg-orange-50 rounded-2xl text-center hover:bg-orange-100 transition-colors">
                             <div className="text-2xl font-black text-orange-600">{orders.filter(o => o.status === 'PREPARING').length}</div>
                             <div className="text-[10px] font-black uppercase text-orange-400 tracking-wider">Em Preparo</div>
                          </button>
                          <button onClick={() => { setActiveTab('history'); }} className="p-4 bg-green-50 rounded-2xl text-center hover:bg-green-100 transition-colors">
                             <div className="text-2xl font-black text-green-600">{orders.filter(o => o.status === 'DELIVERED').length}</div>
                             <div className="text-[10px] font-black uppercase text-green-400 tracking-wider">Entregues</div>
                          </button>
                       </div>
                    </div>
                    {/* Add Recent Activity or Charts here if needed */}
                 </div>
                 <div className="col-span-12 lg:col-span-4">
                    <WhatsAppWidget />
                 </div>
              </div>
            </>
          )}

          {activeTab === 'live-orders' && (
            <div className="space-y-6">
               <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight">O que está acontecendo agora?</h3>
                  <div className="flex bg-white p-1 rounded-xl border border-slate-200">
                    {[
                      { id: 'pending', label: 'Pendentes' },
                      { id: 'preparing', label: 'Cozinha' },
                      { id: 'shipped', label: 'Prontos' }
                    ].map(st => (
                      <button
                        key={st.id}
                        onClick={() => setSubTab(st.id as any)}
                        className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                          subTab === st.id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        {st.label} ({orders.filter(o => o.status === (st.id === 'pending' ? 'PENDING' : st.id === 'preparing' ? 'PREPARING' : 'SHIPPED')).length})
                      </button>
                    ))}
                  </div>
               </div>
               <div className="grid grid-cols-12 gap-6">
                  <div className="col-span-12 lg:col-span-9">
                    <OrdersList filteredOrders={filteredOrders} updateStatus={updateStatus} />
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-6">
               <h3 className="text-2xl font-black text-slate-800 tracking-tight">Relatório de Encerramento</h3>
               <div className="grid grid-cols-12 gap-6">
                  <div className="col-span-12 lg:col-span-12">
                    <OrdersList filteredOrders={filteredOrders} updateStatus={updateStatus} />
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'menu' && (
            <div className="space-y-6">
               <div className="bg-blue-600 rounded-3xl p-8 text-white mb-8 shadow-xl shadow-blue-100 flex justify-between items-center overflow-hidden relative">
                  <div className="relative z-10">
                     <h3 className="text-3xl font-black tracking-tight mb-2">Cardápio Inteligente</h3>
                     <p className="text-blue-100 font-medium">Gerencie categorias, preços e disponibilidades em tempo real.</p>
                  </div>
                  <Utensils className="w-32 h-32 absolute -right-8 -bottom-8 text-blue-500/30 rotate-12" />
               </div>
               <MenuManagement tenant={tenant} refresh={fetchTenant} />
            </div>
          )}

          {activeTab === 'finance' && (
             <div className="space-y-6">
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">Fluxo de Caixa</h3>
                <FinancePanel slug={slug!} tenant={tenant} />
             </div>
          )}

          {activeTab === 'profile' && (
            <div className="space-y-6">
               <h3 className="text-2xl font-black text-slate-800 tracking-tight">Configurações da Unidade</h3>
               <ProfileManagement tenant={tenant} refresh={fetchTenant} />
            </div>
          )}

          {activeTab === 'staff' && (
            <div className="space-y-6">
               <h3 className="text-2xl font-black text-slate-800 tracking-tight">Equipe de Atendimento</h3>
               <StaffList tenant={tenant} />
            </div>
          )}
          {activeTab === 'inventory' && (
            <div className="space-y-6">
               <div className="flex items-center justify-between">
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight underline decoration-blue-500 decoration-4 underline-offset-4">Gestão de Insumos</h3>
                  <div className="flex items-center gap-2">
                     <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                     <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Estoque Integrado</span>
                  </div>
               </div>
               <InventoryPanel tenant={tenant} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function WhatsAppWidget() {
  return (
    <div className="bg-[#075E54] text-white p-6 rounded-2xl shadow-xl relative overflow-hidden group border-b-4 border-emerald-800 h-full">
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg">
            <MessageSquare className="w-4 h-4" />
          </div>
          <span className="text-xs font-black uppercase tracking-widest opacity-80">SmartBot Ativo</span>
        </div>
        <div className="space-y-4">
          <div className="bg-emerald-900/40 p-3 rounded-xl border border-emerald-400/20">
            <div className="text-[10px] text-emerald-300 font-bold uppercase mb-1">Status Automação</div>
            <div className="text-xs italic truncate font-medium">Auto-atendimento em execução...</div>
          </div>
          <div className="flex justify-between items-center text-[11px] font-bold px-1">
            <span className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Conectado
            </span>
            <span className="opacity-60 text-[9px]">API ONLINE</span>
          </div>
        </div>
        <button className="mt-6 w-full bg-white text-[#075E54] py-3 rounded-xl font-black text-xs shadow-md active:scale-95 hover:bg-emerald-50 transition-all uppercase tracking-wider">
          Configurar Respostas
        </button>
      </div>
      <div className="absolute -right-16 -bottom-16 text-emerald-400/10 text-[180px] font-bold rotate-12 pointer-events-none group-hover:rotate-0 transition-transform duration-700">
        💬
      </div>
    </div>
  );
}

function OrderWaitTime({ createdAt, status }: { createdAt: string, status: string }) {
  const [wait, setWait] = useState("");

  useEffect(() => {
    if (status === 'DELIVERED' || status === 'CANCELLED') {
      setWait("--");
      return;
    }
    const update = () => {
      const diff = Math.floor((new Date().getTime() - new Date(createdAt).getTime()) / 60000);
      setWait(`${diff} min`);
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [createdAt, status]);

  if (wait === "--") return null;

  return <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">{wait}</span>;
}

function OrdersList({ filteredOrders, updateStatus }: { filteredOrders: Order[], updateStatus: any }) {
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  return (
    <AnimatePresence mode="popLayout">
      {filteredOrders.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm"
        >
          <div className="text-4xl mb-4 opacity-20">📋</div>
          <p className="text-slate-400 font-bold text-sm uppercase tracking-wide">Nenhum pedido aqui por enquanto.</p>
        </motion.div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map(order => (
            <motion.div
              key={order.id}
              layout
              className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden border-l-4 transition-all"
              style={{ 
                borderLeftColor: 
                  order.status === 'PENDING' ? '#FBBF24' : 
                  order.status === 'PREPARING' ? '#3B82F6' : '#22C55E' 
              }}
            >
              <div 
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50"
                onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-bold text-slate-800 text-sm">#{order.id.slice(-4).toUpperCase()}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Cliente: {order.customerName}</span>
                    <OrderWaitTime createdAt={order.createdAt} status={order.status} />
                  </div>
                  <div className="text-xs text-slate-500 font-medium truncate max-w-md">
                    {order.items?.map(i => `${i.quantity}x ${i.product?.name}`).join(', ')}
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right hidden sm:block">
                    <span className={`block px-2 py-0.5 rounded text-[10px] font-bold uppercase mb-1 ${
                      order.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                      order.status === 'PREPARING' ? 'bg-blue-100 text-blue-700' : 
                      order.status === 'SHIPPED' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {order.status === 'PENDING' ? 'Novo Pedido' : 
                       order.status === 'PREPARING' ? 'Em Preparo' : 
                       order.status === 'SHIPPED' ? (order.orderType === 'DELIVERY' ? 'Em Trânsito' : 'Pronto') : 'Concluído'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium shrink-0">
                      {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                    {order.status === 'PENDING' && (
                      <button 
                        onClick={() => updateStatus(order.id, 'PREPARING')}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm"
                      >
                        Aceitar
                      </button>
                    )}
                    {order.status === 'PREPARING' && (
                      <button 
                        onClick={() => updateStatus(order.id, 'SHIPPED')}
                        className="bg-orange-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-orange-700 transition-colors shadow-sm"
                      >
                        {order.orderType === 'DELIVERY' ? 'Despachar' : 'Pronto'}
                      </button>
                    )}
                    {order.status === 'SHIPPED' && (
                      <button 
                        onClick={() => updateStatus(order.id, 'DELIVERED')}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-green-700 transition-colors shadow-sm"
                      >
                        Concluir
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {expandedOrder === order.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-slate-100 bg-slate-50/30 p-4"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div className="space-y-3">
                          <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Itens do Pedido</h4>
                          {order.items?.map((item, itIdx) => (
                            <div key={`${order.id}-item-${itIdx}`} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                               <div className="flex justify-between items-start">
                                  <div className="flex flex-col">
                                     <span className="text-sm font-bold text-slate-800">{item.quantity}x {item.product?.name}</span>
                                     {item.productVariantId && (
                                        <span className="text-[10px] text-blue-600 font-black uppercase tracking-tighter">
                                           Tamanho Selecionado
                                        </span>
                                     )}
                                  </div>
                                  <span className="text-xs font-medium text-slate-400">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price * item.quantity)}</span>
                               </div>
                               {item.notes && (
                                 <div className="mt-2 text-[11px] text-orange-600 font-bold bg-orange-50 p-2 rounded-lg border border-orange-100 flex items-start gap-2">
                                    <Utensils className="w-3 h-3 mt-0.5 shrink-0" />
                                    <span>Obs: {item.notes}</span>
                                 </div>
                               )}
                            </div>
                          ))}
                       </div>
                       
                       <div className="space-y-4">
                          <div>
                            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1 mb-2">Informações Adicionais</h4>
                            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-3">
                               <div className="flex items-center justify-between">
                                 <div className="flex items-center gap-2">
                                    <Phone className="w-3 h-3 text-slate-300" />
                                    <span className="text-xs font-bold text-slate-600">{order.customerPhone}</span>
                                 </div>
                                 <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${order.orderType === 'DELIVERY' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                                    {order.orderType === 'DELIVERY' ? 'Delivery' : 'Retirada'}
                                 </span>
                               </div>

                               <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100 italic">
                                  {order.address}
                               </div>

                               <div className="pt-2 border-t border-slate-100">
                                  <div className="flex items-center justify-between mb-1">
                                     <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Pagamento</span>
                                     <span className="text-xs font-bold text-blue-600">{order.paymentMethod}</span>
                                  </div>
                                  {order.paymentDetail && (
                                     <div className="bg-blue-50 text-blue-700 text-[11px] font-bold p-2 rounded-lg border border-blue-100 flex items-center gap-2">
                                        <Info className="w-3 h-3" />
                                        <span>{order.paymentMethod === 'CASH' ? `Troco para: ${order.paymentDetail}` : `Bandeira: ${order.paymentDetail}`}</span>
                                     </div>
                                  )}
                               </div>
                            </div>
                          </div>

                          <div className="bg-[#0F172A] p-4 rounded-xl text-white flex justify-between items-center">
                             <span className="text-[10px] font-black uppercase tracking-widest">Total do Pedido</span>
                             <span className="text-lg font-black">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total)}</span>
                          </div>
                       </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}

function StaffList({ tenant }: { tenant: Tenant | null }) {
  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
      <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
         <div>
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Equipe Digital</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Colaboradores ativos na rede</p>
         </div>
         <button className="bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-xs shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 uppercase tracking-widest">
            Novo Membro
         </button>
      </div>
      <div className="p-8 space-y-4">
         <div className="flex items-center justify-between p-5 bg-white border border-slate-100 rounded-2xl transition-all hover:border-blue-200 hover:shadow-lg hover:shadow-slate-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-600 flex items-center justify-center rounded-2xl text-white font-black border border-blue-700/10 shadow-lg shadow-blue-100">
                {tenant?.name?.[0] || 'ED'}
              </div>
              <div>
                <p className="font-black text-slate-800 text-base leading-none">Eduardo Eloi (Administrador)</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-blue-600 font-black uppercase tracking-widest">Acesso Full</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-200"></span>
                  <span className="flex items-center gap-1.5 text-[10px] text-green-500 font-black uppercase tracking-widest">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                    Online agora
                  </span>
                </div>
              </div>
            </div>
            <div className="p-2 text-slate-400">
               <ChevronRight className="w-5 h-5" />
            </div>
         </div>
         
         <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-100">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-6 shadow-sm border border-slate-100 text-slate-200">
               <ClipboardList className="w-8 h-8" />
            </div>
            <h4 className="text-lg font-black text-slate-800">Expanda sua Equipe</h4>
            <p className="text-slate-400 text-sm max-w-[280px] text-center mt-2 font-medium">Configure atendentes, cozinheiros e motoboys para um fluxo automatizado.</p>
         </div>
      </div>
    </div>
  );
}

// Componente de Upload de Imagem Reutilizável
function ImageUploader({ value, onChange, label, description }: { value: string, onChange: (val: string) => void, label: string, description?: string }) {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.url) {
        onChange(data.url);
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao enviar imagem");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">{label}</label>
      <div className="flex items-start gap-4">
        <div className="relative w-24 h-24 rounded-3xl bg-slate-100 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden group shrink-0 shadow-inner">
          {uploading ? (
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          ) : value ? (
            <>
              <img src={value} className="w-full h-full object-cover" alt="Preview" />
              <div 
                onClick={() => onChange("")}
                className="absolute inset-0 bg-red-600/80 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer group"
              >
                <div className="flex flex-col items-center gap-1">
                   <Trash2 className="w-5 h-5" />
                   <span className="text-[8px] font-black uppercase tracking-widest">Remover</span>
                </div>
              </div>
            </>
          ) : (
            <label className="cursor-pointer flex flex-col items-center gap-1 w-full h-full justify-center hover:bg-slate-50 transition-colors">
              <ImageIcon className="w-6 h-6 text-slate-300" />
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Upload</span>
              <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
            </label>
          )}
        </div>
        <div className="flex-1 py-1">
           <p className="text-[10px] text-slate-400 font-medium italic leading-tight">
              {description || "Escolha uma imagem do seu dispositivo para carregar. Formatos aceitos: PNG, JPG, WEBP."}
           </p>
           {value && (
              <div className="mt-2 text-[9px] bg-green-50 text-green-600 font-black uppercase tracking-widest px-2 py-0.5 rounded-full w-fit flex items-center gap-1">
                 <CheckCircle2 className="w-3 h-3" />
                 Imagem Carregada
              </div>
           )}
        </div>
      </div>
    </div>
  );
}

function ProfileManagement({ tenant, refresh }: { tenant: Tenant | null, refresh: () => void }) {
  const [form, setForm] = useState({
    name: tenant?.name || "",
    description: tenant?.description || "",
    address: tenant?.address || "",
    logoUrl: tenant?.logoUrl || "",
    whatsapp: tenant?.whatsapp || ""
  });

  useEffect(() => {
    if (tenant) {
      setForm({
        name: tenant.name || "",
        description: tenant.description || "",
        address: tenant.address || "",
        logoUrl: tenant.logoUrl || "",
        whatsapp: tenant.whatsapp || ""
      });
    }
  }, [tenant]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(`/api/tenants/${tenant?.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    refresh();
    alert("Dados atualizados com sucesso!");
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 bg-slate-50/50">
         <h3 className="font-bold text-slate-800">Dados do Estabelecimento</h3>
      </div>
      <form onSubmit={handleUpdate} className="p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <ImageUploader 
            label="Logo / Imagem da Unidade"
            value={form.logoUrl}
            onChange={(val) => setForm({...form, logoUrl: val})}
            description="Esta imagem aparecerá no topo do seu cardápio digital."
          />
          <div className="space-y-6">
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Nome do Restaurante</label>
              <input 
                type="text" 
                value={form.name} 
                onChange={e => setForm({...form, name: e.target.value})}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">WhatsApp de Contato</label>
              <input 
                type="text" 
                value={form.whatsapp} 
                onChange={e => setForm({...form, whatsapp: e.target.value})}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Descrição Curta / Slogan</label>
          <input 
            type="text" 
            value={form.description} 
            onChange={e => setForm({...form, description: e.target.value})}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Endereço Completo</label>
          <textarea 
            value={form.address} 
            onChange={e => setForm({...form, address: e.target.value})}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Taxa de Entrega Padrão</label>
             <div className="relative">
               <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">R$</span>
               <input 
                type="number" 
                step="0.01"
                placeholder="0,00"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Tempo Médio Entrega (min)</label>
            <input 
              type="text" 
              placeholder="30-45"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 flex items-center justify-between">
            <div>
               <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest mb-1">Link do seu Cardápio</p>
               <p className="text-sm font-bold text-blue-800">{window.location.origin}/{tenant?.slug}</p>
            </div>
            <button 
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/${tenant?.slug}`);
                alert("Link copiado!");
              }}
              className="bg-white text-blue-600 px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest shadow-sm border border-blue-100"
            >
              Copiar Link
            </button>
        </div>
        <button type="submit" className="bg-[#0F172A] text-white px-8 py-4 rounded-xl font-black text-sm uppercase tracking-widest shadow-xl active:scale-95 transition-all w-full md:w-auto">
          Salvar Alterações do Estabelecimento
        </button>
      </form>
    </div>
  );
}

function MenuManagement({ tenant, refresh }: { tenant: Tenant | null, refresh: () => void }) {
  const [newCategory, setNewCategory] = useState("");
  const [addingProductTo, setAddingProductTo] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [prodForm, setProdForm] = useState({ 
    name: "", 
    description: "", 
    price: "", 
    imageUrl: "",
    inventoryItemId: "",
    variants: [] as { name: string, price: string, description: string, inventoryItemId: string }[]
  });

  useEffect(() => {
    if (tenant) {
      fetch(`/api/tenants/${tenant.slug}/inventory`)
        .then(res => res.json())
        .then(data => setInventoryItems(data))
        .catch(err => console.error(err));
    }
  }, [tenant]);

  const addCategory = async () => {
    if (!newCategory) return;
    await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCategory, tenantId: tenant?.id })
    });
    setNewCategory("");
    refresh();
  };

  const addProduct = async (categoryId: string) => {
    const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products';
    const method = editingProduct ? 'PATCH' : 'POST';
    
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...prodForm, categoryId, tenantId: tenant?.id, available: true })
    });
    setAddingProductTo(null);
    setEditingProduct(null);
    setProdForm({ name: "", description: "", price: "", imageUrl: "", inventoryItemId: "", variants: [] });
    refresh();
  };

  const startEditing = (prod: any) => {
    setEditingProduct(prod);
    setAddingProductTo(prod.categoryId);
    setProdForm({
      name: prod.name,
      description: prod.description || "",
      price: String(prod.price),
      imageUrl: prod.imageUrl || "",
      inventoryItemId: prod.inventoryItemId || "",
      variants: prod.variants?.map((v: any) => ({
        name: v.name,
        price: String(v.price),
        description: v.description || "",
        inventoryItemId: v.inventoryItemId || ""
      })) || []
    });
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("Excluir produto?")) return;
    await fetch(`/api/products/${id}`, { method: 'DELETE' });
    refresh();
  };

  const addVariantField = () => {
    setProdForm(prev => ({
      ...prev,
      variants: [...prev.variants, { name: "", price: "", description: "", inventoryItemId: "" }]
    }));
  };

  const removeVariantField = (index: number) => {
    setProdForm(prev => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index)
    }));
  };

  const updateVariantField = (index: number, field: string, value: string) => {
    setProdForm(prev => ({
      ...prev,
      variants: prev.variants.map((v, i) => i === index ? { ...v, [field]: value } : v)
    }));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex gap-4">
        <input 
          type="text" 
          placeholder="Nova Categoria (ex: Marmitas)" 
          value={newCategory}
          onChange={e => setNewCategory(e.target.value)}
          className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button onClick={addCategory} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold text-sm">
          Adicionar Categoria
        </button>
      </div>

      {tenant.categories?.length > 0 ? tenant.categories.map(cat => (
        <div key={cat.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
             <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs">{cat.name}</h3>
             <button 
                onClick={() => setAddingProductTo(addingProductTo === cat.id ? null : cat.id)}
                className="text-blue-600 font-bold text-xs hover:underline"
              >
               + Adicionar Produto
             </button>
          </div>
          
          <div className="p-4 space-y-3">
             {addingProductTo === cat.id && (
               <div className="bg-slate-50 p-4 rounded-xl border-2 border-dashed border-slate-200 mb-4 animate-in fade-in slide-in-from-top-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <input 
                      type="text" placeholder="Nome do item" 
                      value={prodForm.name} onChange={e => setProdForm({...prodForm, name: e.target.value})}
                      className="bg-white border p-3 rounded-xl text-xs font-bold"
                    />
                    <input 
                      type="text" placeholder="Preço base (em R$)" 
                      value={prodForm.price} onChange={e => setProdForm({...prodForm, price: e.target.value})}
                      className="bg-white border p-3 rounded-xl text-xs font-bold"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 px-1 text-blue-600">Vincular ao Estoque (opcional)</label>
                    <select 
                      value={prodForm.inventoryItemId}
                      onChange={e => setProdForm({...prodForm, inventoryItemId: e.target.value})}
                      className="w-full bg-white border p-3 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Nenhum item de estoque vinculado</option>
                      {inventoryItems.map(item => (
                        <option key={item.id} value={item.id}>{item.name} ({item.quantity} {item.unit} em estoque)</option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-4">
                    <ImageUploader 
                      label="Foto do Produto"
                      value={prodForm.imageUrl}
                      onChange={(val) => setProdForm({...prodForm, imageUrl: val})}
                      description="Fotos de alta qualidade convertem mais vendas."
                    />
                  </div>

                  <textarea 
                    placeholder="Descrição do item..." 
                    value={prodForm.description} onChange={e => setProdForm({...prodForm, description: e.target.value})}
                    className="w-full bg-white border p-3 rounded-xl text-xs mb-4"
                    rows={2}
                  />

                  {/* Variants Section */}
                  <div className="mb-4">
                     <div className="flex justify-between items-center mb-2 px-1">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Tamanhos / Variantes (Opcional)</span>
                        <button 
                          onClick={addVariantField}
                          className="text-blue-600 font-bold text-[10px] uppercase hover:underline"
                        >
                          + Add Tamanho
                        </button>
                     </div>
                     <div className="space-y-3">
                        {prodForm.variants.map((v, idx) => (
                           <div key={`new-var-${idx}`} className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                              <div className="flex gap-2 items-start">
                                 <input 
                                   type="text" placeholder="Nome (ex: 500ml)" 
                                   value={v.name} onChange={e => updateVariantField(idx, 'name', e.target.value)}
                                   className="flex-1 bg-slate-50 border p-2 rounded-lg text-[10px] font-bold"
                                 />
                                 <input 
                                   type="text" placeholder="Preço" 
                                   value={v.price} onChange={e => updateVariantField(idx, 'price', e.target.value)}
                                   className="w-20 bg-slate-50 border p-2 rounded-lg text-[10px] font-bold"
                                 />
                                 <button onClick={() => removeVariantField(idx)} className="p-2 text-slate-300 hover:text-red-500">
                                    <X className="w-4 h-4" />
                                 </button>
                              </div>
                              <select 
                                 value={v.inventoryItemId}
                                 onChange={e => updateVariantField(idx, 'inventoryItemId', e.target.value)}
                                 className="w-full bg-slate-100/50 border p-2 rounded-lg text-[10px] font-bold"
                              >
                                 <option value="">Nenhum item vinculado</option>
                                 {inventoryItems.map(item => (
                                   <option key={item.id} value={item.id}>{item.name}</option>
                                 ))}
                              </select>
                           </div>
                        ))}
                     </div>
                  </div>

                     <div className="flex justify-end gap-3">
                     <button onClick={() => {
                        setAddingProductTo(null);
                        setEditingProduct(null);
                        setProdForm({ name: "", description: "", price: "", imageUrl: "", inventoryItemId: "", variants: [] });
                     }} className="text-slate-400 font-bold text-xs uppercase px-4">Cancelar</button>
                     <button onClick={() => addProduct(cat.id)} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold text-xs uppercase">
                        {editingProduct ? 'Atualizar' : 'Salvar'}
                     </button>
                  </div>
               </div>
             )}

             {cat.products?.map(prod => (
               <div key={prod.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl">
                  <div className="flex gap-4 items-center">
                     <div className="w-12 h-12 bg-slate-50 rounded-lg overflow-hidden border">
                        <img src={prod.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=100'} className="w-full h-full object-cover" />
                     </div>
                     <div>
                        <p className="text-sm font-bold text-slate-800">{prod.name}</p>
                        <p className="text-[10px] text-slate-400 font-medium">
                          {prod.variants && prod.variants.length > 0 
                            ? `${prod.variants.length} variações • Desde ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.min(...prod.variants.map((v: any) => v.price)))}`
                            : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(prod.price)
                          }
                        </p>
                     </div>
                  </div>
                  <div className="flex gap-2">
                     <button onClick={() => startEditing(prod)} className="text-blue-500 hover:text-blue-700 p-2 text-[10px] font-black uppercase tracking-widest">
                        Editar
                     </button>
                     <button onClick={() => deleteProduct(prod.id)} className="text-red-400 hover:text-red-600 p-2 text-[10px] font-black uppercase tracking-widest">
                        Excluir
                     </button>
                  </div>
               </div>
             ))}
          </div>
        </div>
      )) : (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center">
           <Utensils className="w-12 h-12 text-slate-300 mx-auto mb-4" />
           <p className="text-slate-400 font-medium">Nenhuma categoria criada ainda.</p>
        </div>
      )}
    </div>
  );
}

function FinancePanel({ slug, tenant }: { slug: string, tenant: Tenant }) {
  const [summary, setSummary] = useState<{ daily: number, dailyCount: number, weekly: number, monthly: number } | null>(null);
  const [currentCash, setCurrentCash] = useState<CashRegister & { expectedBalance?: number } | null>(null);
  const [history, setHistory] = useState<CashRegister[]>([]);
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchFinanceData = async () => {
    setLoading(true);
    try {
      const [sumRes, cashRes, historyRes] = await Promise.all([
        fetch(`/api/tenants/${slug}/finance-summary`),
        fetch(`/api/tenants/${slug}/cash/current`),
        fetch(`/api/tenants/${slug}/cash/history`)
      ]);
      const sumData = await sumRes.json();
      const cashData = await cashRes.json();
      const historyData = await historyRes.json();
      setSummary(sumData);
      setCurrentCash(cashData);
      setHistory(historyData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinanceData();
  }, [slug]);

  if (loading) return (
    <div className="flex items-center justify-center p-12">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform">
               <TrendingUp className="w-24 h-24 text-blue-600" />
            </div>
            <div className="flex items-center justify-between mb-4">
               <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <TrendingUp className="w-5 h-5" />
               </div>
               <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Ganhos Hoje</span>
            </div>
            <div className="text-3xl font-black text-slate-800 tracking-tight">
               {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(summary?.daily || 0)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-wide">
               {summary?.dailyCount || 0} pedidos concluídos
            </div>
         </div>

         <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform">
               <Calendar className="w-24 h-24 text-indigo-600" />
            </div>
            <div className="flex items-center justify-between mb-4">
               <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <Calendar className="w-5 h-5" />
               </div>
               <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Na Semana</span>
            </div>
            <div className="text-3xl font-black text-slate-800 tracking-tight">
               {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(summary?.weekly || 0)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-wide">Últimos 7 dias</div>
         </div>

         <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform">
               <CircleDollarSign className="w-24 h-24 text-emerald-600" />
            </div>
            <div className="flex items-center justify-between mb-4">
               <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <CircleDollarSign className="w-5 h-5" />
               </div>
               <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">No Mês</span>
            </div>
            <div className="text-3xl font-black text-slate-800 tracking-tight">
               {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(summary?.monthly || 0)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-wide">
              {new Date().toLocaleString('pt-BR', { month: 'long' })}
            </div>
         </div>
      </div>

      {/* Cash Register Control */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden border-b-4 border-b-blue-600">
         <div className="p-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
               <div className="flex gap-5 items-center">
                  <div className={`p-5 rounded-[22px] ${currentCash ? 'bg-green-50 text-green-600 shadow-inner' : 'bg-slate-50 text-slate-300'}`}>
                     <Wallet className="w-10 h-10" />
                  </div>
                  <div>
                     <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Status do Caixa</h3>
                     <div className="flex items-center gap-2 mt-1">
                        <div className={`w-2.5 h-2.5 rounded-full ${currentCash ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}></div>
                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">
                           {currentCash ? 'Aberto no momento' : 'Fechado'}
                        </span>
                     </div>
                  </div>
               </div>

               <div className="flex gap-3 w-full md:w-auto">
                  {!currentCash ? (
                  <button 
                     onClick={() => setShowOpenModal(true)}
                     className="w-full md:w-auto bg-blue-600 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-100 active:scale-95 transition-all"
                  >
                     Abrir Caixa
                  </button>
                  ) : (
                  <button 
                     onClick={() => setShowCloseModal(true)}
                     className="w-full md:w-auto bg-red-600 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-red-100 active:scale-95 transition-all"
                  >
                     Fechar Caixa
                  </button>
                  )}
               </div>
            </div>

            {currentCash && (
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 p-6 bg-slate-50 rounded-2xl border border-slate-100">
               <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Início da Sessão</p>
                  <p className="text-sm font-black text-slate-800">
                     {new Date(currentCash.openedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-tighter">Hoje</p>
               </div>
               <div>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 text-slate-400">Fundo de Troco</p>
                  <p className="text-sm font-black text-slate-800">
                     {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(currentCash.openingBalance)}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-tighter">Saldo Inicial</p>
               </div>
               <div>
                  <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest mb-1">Vendas em Dinheiro</p>
                  <p className="text-sm font-black text-blue-700">
                     {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((currentCash.expectedBalance || 0) - currentCash.openingBalance)}
                  </p>
                  <p className="text-[10px] text-blue-400 mt-1 font-bold uppercase tracking-tighter">Registrado no Sistema</p>
               </div>
               <div className="border-l-2 border-white pl-8">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Total Esperado</p>
                  <p className="text-lg font-black text-blue-600 leading-none">
                     {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(currentCash.expectedBalance || 0)}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase tracking-tighter">Esperado na Gaveta</p>
               </div>
            </div>
            )}
         </div>
      </div>

      {/* History List */}
      <div className="space-y-4">
         <div className="flex items-center gap-3 px-1">
            <History className="w-5 h-5 text-slate-400" />
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Últimos Fechamentos</h3>
         </div>

         <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
            {history.length > 0 ? (
               <div className="overflow-x-auto">
                  <table className="w-full text-left">
                     <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                           <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Data / Hora</th>
                           <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Entrada/Saída</th>
                           <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Diferença</th>
                           <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Status</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50">
                        {history.map((cash) => {
                           const diff = (cash.closingBalance || 0) - (cash.expectedBalance || 0);
                           return (
                              <tr key={cash.id} className="hover:bg-slate-50/50 transition-colors">
                                 <td className="px-6 py-5">
                                    <div className="text-sm font-bold text-slate-700">
                                       {new Date(cash.openedAt).toLocaleDateString()}
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                                       {new Date(cash.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} → {cash.closedAt ? new Date(cash.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                                    </div>
                                 </td>
                                 <td className="px-6 py-5">
                                    <div className="flex gap-4">
                                       <div>
                                          <p className="text-[9px] text-slate-400 uppercase font-black tracking-tighter">Iniciou com</p>
                                          <p className="text-xs font-bold text-slate-600">
                                             {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cash.openingBalance)}
                                          </p>
                                       </div>
                                       <div>
                                          <p className="text-[9px] text-slate-400 uppercase font-black tracking-tighter">Retirou</p>
                                          <p className="text-xs font-black text-slate-800">
                                             {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cash.closingBalance || 0)}
                                          </p>
                                       </div>
                                    </div>
                                 </td>
                                 <td className="px-6 py-5">
                                    {Math.abs(diff) < 0.01 ? (
                                       <span className="text-[10px] font-black px-3 py-1 bg-green-50 text-green-600 rounded-full uppercase tracking-widest">Bateu Certinho</span>
                                    ) : (
                                       <div className="flex items-center gap-2">
                                          {diff > 0 ? (
                                             <div className="p-1.5 bg-green-50 text-green-600 rounded-lg">
                                                <ArrowUpRight className="w-3 h-3" />
                                             </div>
                                          ) : (
                                             <div className="p-1.5 bg-red-50 text-red-600 rounded-lg">
                                                <ArrowDownRight className="w-3 h-3" />
                                             </div>
                                          )}
                                          <span className={`text-sm font-black ${diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                             {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(diff))}
                                          </span>
                                       </div>
                                    )}
                                 </td>
                                 <td className="px-6 py-5 text-right pr-12">
                                     <button className="text-[10px] font-black uppercase text-blue-600 hover:underline tracking-widest">Ver Notas</button>
                                 </td>
                              </tr>
                           );
                        })}
                     </tbody>
                  </table>
               </div>
            ) : (
               <div className="p-12 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-200">
                     <History className="w-8 h-8" />
                  </div>
                  <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Nenhum histórico disponível</p>
               </div>
            )}
         </div>
      </div>

      {showOpenModal && (
        <CashRegisterModal 
          type="open" 
          slug={slug} 
          onClose={() => setShowOpenModal(false)} 
          onSuccess={() => {
            setShowOpenModal(false);
            fetchFinanceData();
          }} 
        />
      )}

      {showCloseModal && currentCash && (
        <CashRegisterModal 
          type="close" 
          slug={slug} 
          expected={currentCash.expectedBalance || 0}
          onClose={() => setShowCloseModal(false)} 
          onSuccess={() => {
            setShowCloseModal(false);
            fetchFinanceData();
          }} 
        />
      )}
    </div>
  );
}

function CashRegisterModal({ type, slug, expected, onClose, onSuccess }: { 
  type: 'open' | 'close', 
  slug: string, 
  expected?: number,
  onClose: () => void, 
  onSuccess: () => void 
}) {
  const [value, setValue] = useState(type === 'close' ? String(expected || 0) : "");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const endpoint = type === 'open' ? 'open' : 'close';
      const body = type === 'open' 
        ? { openingBalance: value } 
        : { closingBalance: value, notes };

      const res = await fetch(`/api/tenants/${slug}/cash/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        onSuccess();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const diff = type === 'close' && expected ? parseFloat(value) - expected : 0;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
       <motion.div 
         initial={{ opacity: 0, scale: 0.95, y: 20 }}
         animate={{ opacity: 1, scale: 1, y: 0 }}
         className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
       >
          <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
             <div>
                <h3 className="font-black text-slate-800 uppercase tracking-tight text-lg">
                  {type === 'open' ? 'Abrir Caixa' : 'Fechar Caixa'}
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Fluxo de Loja Diário</p>
             </div>
             <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-400" />
             </button>
          </div>

          <div className="p-8 space-y-6">
             {type === 'close' && expected !== undefined && (
               <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                  <div className="flex justify-between items-center mb-1">
                     <span className="text-[10px] font-black uppercase text-blue-400 tracking-widest">Expectativa do Sistema</span>
                     <span className="text-sm font-black text-blue-600">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(expected)}
                     </span>
                  </div>
                  <p className="text-[10px] text-blue-400 font-medium leading-tight">Valor esperado com base em vendas em dinheiro e saldo de abertura.</p>
               </div>
             )}

             <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 px-1">
                  {type === 'open' ? 'Valor Inicial em Caixa' : 'Valor Total em Espécie (Contado)'}
                </label>
                <div className="relative">
                   <div className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">R$</div>
                   <input 
                     type="number"
                     step="0.01"
                     value={value}
                     onChange={e => setValue(e.target.value)}
                     className="w-full bg-slate-50 border-2 border-slate-100 p-4 pl-12 rounded-2xl font-black text-slate-800 focus:border-blue-500 outline-none transition-all placeholder:text-slate-300"
                     placeholder="0,00"
                   />
                </div>
             </div>

             {type === 'close' && (
               <>
                 {Math.abs(diff) > 0.01 && (
                   <div className={`p-4 rounded-2xl border ${diff > 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                      <div className="flex items-center gap-2 mb-1">
                         <Info className={`w-4 h-4 ${diff > 0 ? 'text-green-500' : 'text-red-500'}`} />
                         <span className={`text-xs font-black uppercase tracking-tight ${diff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {diff > 0 ? 'Sobra de Caixa' : 'Quebra de Caixa'}
                         </span>
                      </div>
                      <p className={`text-lg font-black ${diff > 0 ? 'text-green-700' : 'text-red-700'}`}>
                         {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(diff))}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">Conforme valor contado vs esperado pelo sistema.</p>
                   </div>
                 )}

                 <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 px-1">Obsevações</label>
                    <textarea 
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl text-sm text-slate-600 focus:border-blue-500 outline-none transition-all"
                      rows={3}
                      placeholder="Alguma divergência ou anotação importante..."
                    />
                 </div>
               </>
             )}

             <button 
               onClick={handleSubmit}
               disabled={loading || !value}
               className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2
                 ${type === 'open' ? 'bg-blue-600 text-white shadow-blue-200' : 'bg-red-600 text-white shadow-red-200'}
                 ${loading || !value ? 'opacity-50 grayscale cursor-not-allowed shadow-none' : ''}
               `}
             >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Wallet className="w-5 h-5" />
                    {type === 'open' ? 'Confirmar Abertura' : 'Confirmar Fechamento'}
                  </>
                )}
             </button>
          </div>
       </motion.div>
    </div>
  );
}

function InventoryPanel({ tenant }: { tenant: Tenant | null }) {
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "low" | "expired" | "internal" | "sale">("all");

  const fetchData = async () => {
    if (!tenant) return;
    try {
      const [iRes, cRes] = await Promise.all([
        fetch(`/api/tenants/${tenant.slug}/inventory`),
        fetch(`/api/tenants/${tenant.slug}/inventory/categories`)
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
    
    if (filterType === "low") return matchesSearch && item.minStock && item.quantity <= item.minStock;
    if (filterType === "expired") return matchesSearch && item.expirationDate && new Date(item.expirationDate) < new Date();
    if (filterType === "internal") return matchesSearch && item.usage === "INTERNAL";
    if (filterType === "sale") return matchesSearch && item.usage === "SALE";
    
    return matchesSearch;
  });

  const stats = {
    totalItems: items.length,
    lowStock: items.filter(i => i.minStock && i.quantity <= i.minStock).length,
    expired: items.filter(i => i.expirationDate && new Date(i.expirationDate) < new Date()).length,
    totalValue: items.reduce((acc, i) => acc + (i.purchasePrice || 0) * i.quantity, 0)
  };

  if (loading) return <div className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">Carregando Inventário...</div>;

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total em Estoque', value: stats.totalItems, icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Abaixo do Mínimo', value: stats.lowStock, icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Itens Vencidos', value: stats.expired, icon: CalendarClock, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Valor Investido', value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalValue), icon: CircleDollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map((s, idx) => (
          <div key={idx} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className={`w-12 h-12 ${s.bg} ${s.color} rounded-2xl flex items-center justify-center`}>
              <s.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-0.5">{s.label}</p>
              <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden min-h-[500px]">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/30">
          <div className="flex bg-white rounded-xl border border-slate-200 p-1 flex-wrap">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'low', label: 'Críticos' },
              { id: 'expired', label: 'Vencidos' },
              { id: 'sale', label: 'Para Venda' },
              { id: 'internal', label: 'Consumo' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilterType(f.id as any)}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  filterType === f.id ? 'bg-[#0F172A] text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <input 
              type="text" 
              placeholder="Buscar por nome ou código..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 flex-1 md:w-64 shadow-sm"
            />
            <button 
              onClick={() => { setEditingItem(null); setShowItemForm(true); }}
              className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 active:scale-95 transition-all shadow-xl shadow-blue-100 whitespace-nowrap"
            >
              Novo Item
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 italic">
                <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Produto</th>
                <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Categoria</th>
                <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Quantidade</th>
                <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Custos</th>
                <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Status/Validade</th>
                <th className="p-4 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => {
                const isLow = item.minStock && item.quantity <= item.minStock;
                const isExpired = item.expirationDate && new Date(item.expirationDate) < new Date();
                const isNearExpiry = item.expirationDate && !isExpired && (new Date(item.expirationDate).getTime() - new Date().getTime()) < (7 * 24 * 60 * 60 * 1000);

                return (
                  <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:shadow-sm transition-all border border-slate-200/50">
                          <Package className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-800 leading-tight">{item.name}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">#{item.code || 'S/COD'} • {item.brand || 'Marca n/d'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-[10px] font-black uppercase tracking-tighter text-blue-600 bg-blue-50 px-3 py-1 rounded-full whitespace-nowrap">
                        {item.category?.name || 'Geral'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                       <span className={`text-sm font-black ${isLow ? 'text-orange-600' : 'text-slate-800'}`}>
                          {item.quantity} {item.unit || 'un'}
                       </span>
                       {item.weight && <p className="text-[9px] text-slate-400 italic">({item.weight})</p>}
                    </td>
                    <td className="p-4">
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-bold text-slate-400">Compra: <span className="text-slate-800 font-black">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.purchasePrice || 0)}</span></p>
                        {item.sellingPrice && (
                          <p className="text-[10px] font-bold text-slate-400">Venda: <span className="text-emerald-600 font-black">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.sellingPrice)}</span></p>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                       <div className="space-y-1.5 min-w-[140px]">
                          {isLow && (
                             <div className="flex items-center gap-1 text-[9px] font-black text-orange-600 uppercase bg-orange-100 px-2.5 py-1 rounded-full w-fit">
                                <AlertTriangle className="w-3 h-3" /> Estoque Crítico
                             </div>
                          )}
                          {item.expirationDate ? (
                            <div className={`flex items-center gap-1 text-[9px] font-black uppercase px-2.5 py-1 rounded-full w-fit ${
                              isExpired ? 'bg-red-100 text-red-600' : isNearExpiry ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'
                            }`}>
                              <CalendarClock className="w-3 h-3" />
                              {isExpired ? 'Expirou: ' : 'Vence em: '}
                              {new Date(item.expirationDate).toLocaleDateString()}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-200 font-black uppercase italic">Sem Início</span>
                          )}
                       </div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={() => { setEditingItem(item); setShowItemForm(true); }}
                          className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-white rounded-xl transition-all shadow-sm border border-transparent hover:border-blue-100"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={async () => {
                            if (confirm("Deseja realmente remover este item do estoque?")) {
                              await fetch(`/api/inventory/items/${item.id}`, { method: 'DELETE' });
                              fetchData();
                            }
                          }}
                          className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-white rounded-xl transition-all shadow-sm border border-transparent hover:border-red-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-28 text-center bg-slate-50/20">
                    <div className="w-20 h-20 bg-white shadow-xl rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-100">
                       <Package className="w-8 h-8 text-slate-200" />
                    </div>
                    <h4 className="text-xl font-black text-slate-800 mb-2">Nada por aqui ainda!</h4>
                    <p className="text-slate-400 text-sm font-medium uppercase tracking-widest mb-8 max-w-sm mx-auto">Comece a cadastrar seus insumos para ter o controle total da sua operação.</p>
                    <button 
                       onClick={() => { setEditingItem(null); setShowItemForm(true); }}
                       className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-100"
                    >
                       Cadastrar Primeiro Item
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
      </AnimatePresence>
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
    purchaseDate: item?.purchaseDate ? new Date(item.purchaseDate).toISOString().split('T')[0] : ""
  });

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = item ? `/api/inventory/items/${item.id}` : `/api/inventory/items`;
    const method = item ? 'PATCH' : 'POST';
    
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        ...form, 
        tenantId: tenant?.id,
        purchasePrice: parseFloat(form.purchasePrice.toString()) || 0,
        sellingPrice: form.sellingPrice ? parseFloat(form.sellingPrice.toString()) : null,
        quantity: parseFloat(form.quantity.toString()) || 0,
        minStock: form.minStock ? parseFloat(form.minStock.toString()) : null
      })
    });
    onSave();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-[#0F172A]/90 backdrop-blur-md" 
        onClick={onClose}
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 100 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 100 }}
        className="relative bg-white rounded-[40px] shadow-2xl w-full max-w-4xl overflow-hidden border border-white/20"
      >
        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
           <div>
              <h3 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">{item ? 'Ajustar Insumo' : 'Novo Registro Técnico'}</h3>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-1">Configuração detalhada de mercadorias no estoque.</p>
           </div>
           <button onClick={onClose} className="w-12 h-12 flex items-center justify-center bg-white shadow-xl rounded-full hover:bg-slate-50 transition-colors border border-slate-100">
              <X className="w-5 h-5 text-slate-400" />
           </button>
        </div>

        <form onSubmit={handleSubmit} className="p-10 grid grid-cols-1 md:grid-cols-2 gap-10 max-h-[75vh] overflow-y-auto custom-scrollbar">
           <div className="space-y-8">
              <div className="flex items-center gap-3 mb-2">
                 <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-100">
                    <Info className="w-4 h-4 text-white" />
                 </div>
                 <h4 className="text-xs font-black uppercase text-slate-800 tracking-widest">Identificação Básica</h4>
              </div>
              
              <div className="space-y-5">
                 <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 px-1">Nome de Cadastro</label>
                    <input 
                      required
                      type="text" 
                      value={form.name} 
                      onChange={e => setForm({...form, name: e.target.value})}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-black focus:border-blue-500 transition-all outline-none"
                      placeholder="Ex: Coca-Cola 350ml"
                    />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 px-1">SKU / Cód Barrax</label>
                      <input 
                        type="text" 
                        value={form.code} 
                        onChange={e => setForm({...form, code: e.target.value})}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-black focus:border-blue-500 transition-all outline-none"
                        placeholder="78900..."
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 px-1">Marca / Fabr.</label>
                      <input 
                        type="text" 
                        value={form.brand} 
                        onChange={e => setForm({...form, brand: e.target.value})}
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-black focus:border-blue-500 transition-all outline-none"
                        placeholder="Ex: Ambev"
                      />
                    </div>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 px-1">Categoria</label>
                    <div className="flex gap-2">
                       <select 
                         value={form.categoryId} 
                         onChange={e => setForm({...form, categoryId: e.target.value})}
                         className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-2xl p-3 text-xs font-black uppercase focus:border-blue-500 transition-all outline-none"
                       >
                         <option value="">Selecione...</option>
                         {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                       </select>
                       <button 
                         type="button" 
                         onClick={() => setIsCategoryModalOpen(true)}
                         className="w-12 h-12 bg-white border-2 border-slate-100 hover:bg-slate-50 rounded-2xl flex items-center justify-center transition-all shadow-sm"
                       >
                         +
                       </button>
                    </div>
                 </div>
                 <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 px-1">Tipo de Aplicação</label>
                    <select 
                       value={form.usage}
                       onChange={e => setForm({...form, usage: e.target.value})}
                       className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-3 text-xs font-black uppercase focus:border-blue-500 transition-all outline-none"
                    >
                       <option value="SALE">Comercial (Final)</option>
                       <option value="INTERNAL">Interno (Insumo)</option>
                    </select>
                 </div>
              </div>
           </div>

           <div className="space-y-8">
              <div className="flex items-center gap-3 mb-2">
                 <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-100">
                    <CircleDollarSign className="w-4 h-4 text-white" />
                 </div>
                 <h4 className="text-xs font-black uppercase text-slate-800 tracking-widest">Financeiro e Logística</h4>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 px-1">Quantidade Atual</label>
                    <input 
                      required
                      type="number" step="0.001"
                      value={form.quantity} 
                      onChange={e => setForm({...form, quantity: e.target.value})}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-lg font-black focus:border-orange-500 transition-all outline-none"
                    />
                 </div>
                 <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 px-1">Peso / Unidade</label>
                    <div className="flex gap-2">
                       <input 
                         type="text" 
                         value={form.unit} 
                         onChange={e => setForm({...form, unit: e.target.value})}
                         className="w-20 bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-black focus:border-blue-500 transition-all outline-none text-center"
                         placeholder="un"
                       />
                       <input 
                         type="text" 
                         value={form.weight} 
                         onChange={e => setForm({...form, weight: e.target.value})}
                         className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-black focus:border-blue-500 transition-all outline-none"
                         placeholder="Ex: 500g / 1.5L"
                       />
                    </div>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 px-1">Alerta: Estoque Mín.</label>
                   <input 
                      type="number" step="0.01"
                      value={form.minStock} 
                      onChange={e => setForm({...form, minStock: e.target.value})}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-black focus:border-red-500 transition-all outline-none"
                   />
                </div>
                <div>
                   <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 px-1">Custo de Compra (R$)</label>
                   <input 
                      type="number" step="0.01"
                      value={form.purchasePrice} 
                      onChange={e => setForm({...form, purchasePrice: e.target.value})}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-black focus:border-emerald-500 transition-all outline-none"
                   />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 px-1">Data Registro Compra</label>
                   <input 
                      type="date" 
                      value={form.purchaseDate} 
                      onChange={e => setForm({...form, purchaseDate: e.target.value})}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-black focus:border-blue-500 transition-all outline-none"
                   />
                 </div>
                 <div>
                   <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 px-1">Limite de Validade</label>
                   <input 
                      type="date" 
                      value={form.expirationDate} 
                      onChange={e => setForm({...form, expirationDate: e.target.value})}
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-black focus:border-blue-500 transition-all outline-none"
                   />
                 </div>
              </div>
           </div>
           
           <div className="md:col-span-2 pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-end gap-3 mt-4">
              <button 
                type="button" 
                onClick={onClose}
                className="px-10 py-5 rounded-3xl font-black text-[11px] uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all"
              >
                Descartar Mudanças
              </button>
              <button 
                type="submit"
                className="bg-[#0F172A] text-white px-16 py-5 rounded-3xl font-black text-[11px] uppercase tracking-widest shadow-2xl shadow-slate-200 hover:bg-slate-800 active:scale-95 transition-all text-center"
              >
                {item ? 'Atualizar Inventário' : 'Efetivar Cadastro'}
              </button>
           </div>
        </form>
      </motion.div>

      <AnimatePresence>
         {isCategoryModalOpen && (
           <div className="fixed inset-0 z-[75] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setIsCategoryModalOpen(false)}
              />
              <motion.div 
                initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                className="relative bg-white rounded-[32px] p-10 w-full max-w-md shadow-2xl border border-slate-100"
              >
                 <div className="mb-6">
                    <h4 className="text-2xl font-black text-slate-800 tracking-tight">Novas Categorias</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Organize seus insumos tecnicamente.</p>
                 </div>
                 <CategoryForm 
                    tenantId={tenant?.id || ""} 
                    onSuccess={() => { refreshCategories(); setIsCategoryModalOpen(false); }} 
                    onClose={() => setIsCategoryModalOpen(false)}
                    isInventory
                 />
              </motion.div>
           </div>
         )}
      </AnimatePresence>
    </div>
  );
}

function CategoryForm({ tenantId, onSuccess, onClose, isInventory = false }: { tenantId: string, onSuccess: () => void, onClose: () => void, isInventory?: boolean }) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const url = isInventory ? "/api/inventory/categories" : "/api/categories";
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, tenantId })
    });
    onSuccess();
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 px-1">Nome Administrativo</label>
        <input 
          required autoFocus
          type="text" value={name} onChange={e => setName(e.target.value)}
          className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-black focus:border-blue-500 outline-none transition-all"
          placeholder="Ex: Embalagens, Frios..."
        />
      </div>
      <div className="flex gap-3 pt-2">
         <button 
           type="button" 
           onClick={onClose}
           className="flex-1 px-4 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 active:scale-95 transition-all"
         >
            Voltar
         </button>
         <button 
           type="submit" 
           disabled={loading}
           className="flex-1 bg-blue-600 text-white px-4 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-100 active:scale-95 transition-all"
         >
            {loading ? "Gravando..." : "Confirmar Cadastro"}
         </button>
      </div>
    </form>
  );
}
