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
  Wallet
} from "lucide-react";
import socket from "../lib/socket";
import { Order, Tenant, CashRegister } from "../types";
import { motion, AnimatePresence } from "motion/react";

export default function Dashboard() {
  const { slug } = useParams();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'preparing' | 'completed' | 'staff' | 'menu' | 'profile' | 'finance'>('pending');
  const [loading, setLoading] = useState(true);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const fetchTenant = () => {
    fetch(`/api/tenants/${slug}`)
      .then(res => res.json())
      .then(data => {
        setTenant(data);
        socket.emit("join-tenant", data.id);
        fetchOrders(data.id);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchTenant();

    // Real-time listeners
    socket.on("new-order", (newOrder: Order) => {
      setOrders(prev => [newOrder, ...prev]);
      new Audio('/notification.mp3').play().catch(() => {}); // Optional sound
    });

    socket.on("order-status-updated", (updatedOrder: Order) => {
      setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    });

    return () => {
      socket.off("new-order");
      socket.off("order-status-updated");
    };
  }, [slug]);

  const fetchOrders = (tenantId: string) => {
    fetch(`/api/admin/${tenantId}/orders`)
      .then(res => res.json())
      .then(data => setOrders(data));
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
    if (activeTab === 'pending') return order.status === 'PENDING';
    if (activeTab === 'preparing') return order.status === 'PREPARING' || order.status === 'SHIPPED';
    if (activeTab === 'completed') return order.status === 'DELIVERED' || order.status === 'CANCELLED';
    return true;
  }).sort((a, b) => {
    if (activeTab === 'preparing') {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
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
            { id: 'dashboard', icon: LayoutDashboard, label: 'Pedidos Ativos', tab: 'pending' },
            { id: 'menu', icon: Utensils, label: 'Gerenciar Cardápio', tab: 'menu' },
            { id: 'finance', icon: CircleDollarSign, label: 'Financeiro', tab: 'finance' },
            { id: 'profile', icon: Settings, label: 'Dados da Loja', tab: 'profile' },
            { id: 'staff', icon: ClipboardList, label: 'Equipe', tab: 'staff' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.tab as any);
                setIsMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md font-medium transition-colors cursor-pointer ${
                (item.id === 'dashboard' && (activeTab === 'pending' || activeTab === 'preparing' || activeTab === 'completed')) || 
                (item.id === 'menu' && activeTab === 'menu') ||
                (item.id === 'finance' && activeTab === 'finance') ||
                (item.id === 'profile' && activeTab === 'profile') ||
                (item.id === 'staff' && activeTab === 'staff')
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
              <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Fila Cozinha</div>
              <div className="text-2xl font-bold text-orange-600">
                {orders.filter(o => o.status === 'PREPARING').length}
              </div>
              <div className="text-[10px] text-orange-400 mt-1 font-medium">Requisições ativas</div>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
              <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">Interações Bot</div>
              <div className="text-2xl font-bold text-blue-600">--</div>
              <div className="text-[10px] text-blue-500 mt-1 font-medium">Simulação ativa</div>
            </div>
          </div>

          {/* Status Tabs */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-none">
            {[
              { id: 'pending', label: 'Pendentes', icon: Clock, count: orders.filter(o => o.status === 'PENDING').length, color: 'blue' },
              { id: 'preparing', label: 'Na Cozinha', icon: Utensils, count: orders.filter(o => o.status === 'PREPARING' || o.status === 'SHIPPED').length, color: 'orange' },
              { id: 'completed', label: 'Concluídos', icon: CheckCircle2, count: orders.filter(o => o.status === 'DELIVERED').length, color: 'green' },
            ].map(tab => (
              <button
                 key={tab.id}
                 onClick={() => setActiveTab(tab.id as any)}
                 className={`flex items-center gap-2 px-5 py-2.5 rounded-xl whitespace-nowrap font-bold text-sm transition-all border ${
                   activeTab === tab.id 
                    ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-200' 
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                 }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                <span className={`text-[10px] px-2 py-0.5 rounded-md ${activeTab === tab.id ? 'bg-white/20' : 'bg-slate-100'}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-8">
              {activeTab === 'pending' || activeTab === 'preparing' || activeTab === 'completed' ? (
                 <OrdersList filteredOrders={filteredOrders} updateStatus={updateStatus} />
              ) : activeTab === 'staff' ? (
                 <StaffList tenant={tenant} />
              ) : activeTab === 'menu' ? (
                 <MenuManagement tenant={tenant} refresh={fetchTenant} />
              ) : activeTab === 'finance' ? (
                 <FinancePanel slug={slug!} tenant={tenant} />
              ) : activeTab === 'profile' ? (
                 <ProfileManagement tenant={tenant} refresh={fetchTenant} />
              ) : null}
            </div>

            {/* Sidebar widgets for Dashboard */}
            <div className="col-span-12 lg:col-span-4 space-y-6">
              {/* WhatsApp Mock Panel */}
              <div className="bg-[#075E54] text-white p-6 rounded-2xl shadow-xl relative overflow-hidden group border-b-4 border-emerald-800">
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest opacity-80">SmartBot Active</span>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-emerald-900/40 p-3 rounded-xl border border-emerald-400/20">
                      <div className="text-[10px] text-emerald-300 font-bold uppercase mb-1">Última Notificação</div>
                      <div className="text-xs italic truncate font-medium">"Olá Eduardo! Recebemos seu pedido #45A2..."</div>
                    </div>
                    <div className="flex justify-between items-center text-[11px] font-bold px-1">
                      <span className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        Bot Online
                      </span>
                      <span className="opacity-60">12 notificações hoje</span>
                    </div>
                  </div>
                  <button className="mt-6 w-full bg-white text-[#075E54] py-3 rounded-xl font-black text-xs shadow-md active:scale-95 hover:bg-emerald-50 transition-all uppercase tracking-wider">
                    Abrir Gerenciador Bot
                  </button>
                </div>
                <div className="absolute -right-16 -bottom-16 text-emerald-400/10 text-[180px] font-bold rotate-12 pointer-events-none group-hover:rotate-0 transition-transform duration-700">
                  💬
                </div>
              </div>

              {/* Equipe Widget */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-bold text-slate-800">Equipe Online</h3>
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-xs font-bold text-slate-400 border border-slate-100">EA</div>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-slate-700">Eduardo Admin</div>
                      <div className="text-[10px] text-slate-400 uppercase font-medium">Proprietário</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 opacity-60">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-xs font-bold text-slate-400 border border-slate-100 border-dashed">--</div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-slate-500 text-dashed">Vago</div>
                      <div className="text-[10px] text-slate-300 uppercase font-medium">Cozinha</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function OrderWaitTime({ createdAt }: { createdAt: string }) {
  const [wait, setWait] = useState("");

  useEffect(() => {
    const update = () => {
      const diff = Math.floor((new Date().getTime() - new Date(createdAt).getTime()) / 60000);
      setWait(`${diff} min`);
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [createdAt]);

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
                    <OrderWaitTime createdAt={order.createdAt} />
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
                                  <span className="text-sm font-bold text-slate-800">{item.quantity}x {item.product?.name}</span>
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
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
         <h3 className="font-bold text-slate-800">Equipe de Profissionais</h3>
         <button className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-xs shadow-sm hover:bg-blue-700 transition-colors">
            Adicionar Membro
         </button>
      </div>
      <div className="p-6 space-y-4">
         <div className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl transition-all hover:border-blue-200">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-slate-100 flex items-center justify-center rounded-lg text-slate-600 font-bold border border-slate-200 uppercase">
                {tenant?.name?.[0] || 'ED'}
              </div>
              <div>
                <p className="font-bold text-slate-800 text-sm">Eduardo Eloi (Você)</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Proprietário</span>
                  <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                  <span className="text-[10px] text-green-500 font-bold uppercase tracking-wider">Online</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-green-50 px-2 py-1 rounded text-green-700">
               <CheckCircle2 className="w-3 h-3" />
               <span className="text-[10px] font-bold uppercase">Ativo</span>
            </div>
         </div>
         <p className="text-slate-400 text-center py-8 text-sm font-medium italic">Nenhum outro profissional cadastrado na rede.</p>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        <div>
          <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Descrição Curta</label>
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
        <div>
          <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">URL da Logo (Imagem)</label>
          <input 
            type="text" 
            value={form.logoUrl} 
            onChange={e => setForm({...form, logoUrl: e.target.value})}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button type="submit" className="bg-[#0F172A] text-white px-8 py-4 rounded-xl font-black text-sm uppercase tracking-widest shadow-xl active:scale-95 transition-all">
          Salvar Alterações
        </button>
      </form>
    </div>
  );
}

function MenuManagement({ tenant, refresh }: { tenant: Tenant | null, refresh: () => void }) {
  const [newCategory, setNewCategory] = useState("");
  const [addingProductTo, setAddingProductTo] = useState<string | null>(null);
  const [prodForm, setProdForm] = useState({ name: "", description: "", price: "", imageUrl: "" });

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
    await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...prodForm, categoryId, tenantId: tenant?.id, available: true })
    });
    setAddingProductTo(null);
    setProdForm({ name: "", description: "", price: "", imageUrl: "" });
    refresh();
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("Excluir produto?")) return;
    await fetch(`/api/products/${id}`, { method: 'DELETE' });
    refresh();
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
                      type="text" placeholder="Preço (ex: 29.90)" 
                      value={prodForm.price} onChange={e => setProdForm({...prodForm, price: e.target.value})}
                      className="bg-white border p-3 rounded-xl text-xs font-bold"
                    />
                  </div>
                  <textarea 
                    placeholder="Descrição do item..." 
                    value={prodForm.description} onChange={e => setProdForm({...prodForm, description: e.target.value})}
                    className="w-full bg-white border p-3 rounded-xl text-xs mb-4"
                    rows={2}
                  />
                  <div className="flex justify-end gap-3">
                     <button onClick={() => setAddingProductTo(null)} className="text-slate-400 font-bold text-xs uppercase px-4">Cancelar</button>
                     <button onClick={() => addProduct(cat.id)} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold text-xs uppercase">Salvar</button>
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
                        <p className="text-[10px] text-slate-400 font-medium">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(prod.price)}</p>
                     </div>
                  </div>
                  <button onClick={() => deleteProduct(prod.id)} className="text-red-400 hover:text-red-600 p-2">
                     Excluir
                  </button>
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
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchFinanceData = async () => {
    setLoading(true);
    try {
      const [sumRes, cashRes] = await Promise.all([
        fetch(`/api/tenants/${slug}/finance-summary`),
        fetch(`/api/tenants/${slug}/cash/current`)
      ]);
      const sumData = await sumRes.json();
      const cashData = await cashRes.json();
      setSummary(sumData);
      setCurrentCash(cashData);
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
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
               <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <TrendingUp className="w-5 h-5" />
               </div>
               <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Ganhos Hoje</span>
            </div>
            <div className="text-2xl font-black text-slate-800">
               {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(summary?.daily || 0)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1 font-bold">{summary?.dailyCount || 0} pedidos concluídos</div>
         </div>

         <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
               <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <TrendingUp className="w-5 h-5" />
               </div>
               <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Na Semana</span>
            </div>
            <div className="text-2xl font-black text-slate-800">
               {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(summary?.weekly || 0)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1 font-bold">Últimos 7 dias</div>
         </div>

         <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
               <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <TrendingUp className="w-5 h-5" />
               </div>
               <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">No Mês</span>
            </div>
            <div className="text-2xl font-black text-slate-800">
               {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(summary?.monthly || 0)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1 font-bold">{new Date().toLocaleString('pt-BR', { month: 'long' })}</div>
         </div>
      </div>

      {/* Cash Register Control */}
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm transition-all hover:shadow-md">
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex gap-4 items-center">
               <div className={`p-4 rounded-2xl ${currentCash ? 'bg-green-50 text-green-600' : 'bg-slate-50 text-slate-400'}`}>
                  <Wallet className="w-8 h-8" />
               </div>
               <div>
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Fluxo de Caixa</h3>
                  <div className="flex items-center gap-2">
                     <div className={`w-2 h-2 rounded-full ${currentCash ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}></div>
                     <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                        {currentCash ? 'Caixa Aberto' : 'Caixa Fechado'}
                     </span>
                  </div>
               </div>
            </div>

            <div className="flex gap-3">
               {!currentCash ? (
                 <button 
                  onClick={() => setShowOpenModal(true)}
                  className="bg-blue-600 text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-200 active:scale-95 transition-all"
                 >
                    Abrir Caixa
                 </button>
               ) : (
                 <button 
                  onClick={() => setShowCloseModal(true)}
                  className="bg-red-600 text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-200 active:scale-95 transition-all"
                 >
                    Fechar Caixa
                 </button>
               )}
            </div>
         </div>

         {currentCash && (
           <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-8 border-t border-slate-100">
              <div>
                 <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Abertura</p>
                 <p className="text-sm font-bold text-slate-800">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(currentCash.openingBalance)}
                 </p>
                 <p className="text-[10px] text-slate-400 mt-0.5">Iniciado às {new Date(currentCash.openedAt).toLocaleTimeString()}</p>
              </div>
              <div>
                 <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Expectativa em Dinheiro</p>
                 <p className="text-sm font-black text-blue-600">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(currentCash.expectedBalance || 0)}
                 </p>
                 <p className="text-[10px] text-slate-400 mt-0.5">Vendas em espécie + saldo inicial</p>
              </div>
           </div>
         )}
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
