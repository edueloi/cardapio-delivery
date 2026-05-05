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
  ArrowRightLeft,
  Plus
} from "lucide-react";
import socket from "../../lib/socket";
import { apiFetch } from "../../lib/api";
import { Order, Tenant, CashRegister } from "../../types";
import { motion, AnimatePresence } from "motion/react";
import { 
  Button, 
  DashboardShell,
  IconButton, 
  PageWrapper, 
  SectionTitle, 
  StatGrid, 
  ContentCard, 
  StatCard, 
  Badge, 
  StatusBadge, 
  PaymentBadge,
  FilterLineSegmented,
  EmptyState,
  Modal,
  Input,
  Textarea,
  Switch,
  StatCardColor,
  GridTable
} from "../../components";
import { DASHBOARD_NAVIGATION } from "./config/navigation";
import { type DashboardOrderTabId, type DashboardTabId } from "./types";

export function WhatsAppWidget() {
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

export function OrdersList({ filteredOrders, updateStatus }: { filteredOrders: Order[], updateStatus: any }) {
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
                className="flex flex-col gap-3 p-4 cursor-pointer hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1">
                    <span className="font-bold text-slate-800 text-sm">#{order.id.slice(-4).toUpperCase()}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Cliente: {order.customerName}</span>
                    <OrderWaitTime createdAt={order.createdAt} status={order.status} />
                  </div>
                  <div className="text-xs text-slate-500 font-medium pr-1 sm:truncate sm:max-w-md">
                    {order.items?.map(i => `${i.quantity}x ${i.product?.name}`).join(', ')}
                  </div>
                </div>

                <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-6">
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

                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row" onClick={e => e.stopPropagation()}>
                    {order.status === 'PENDING' && (
                      <Button 
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => updateStatus(order.id, 'PREPARING')}
                      >
                        Aceitar
                      </Button>
                    )}
                    {order.status === 'PREPARING' && (
                      <Button 
                        size="sm"
                        variant="secondary"
                        className="w-full sm:w-auto"
                        onClick={() => updateStatus(order.id, 'SHIPPED')}
                      >
                        {order.orderType === 'DELIVERY' ? 'Despachar' : 'Pronto'}
                      </Button>
                    )}
                    {order.status === 'SHIPPED' && (
                      <Button 
                        size="sm"
                        variant="success"
                        className="w-full sm:w-auto"
                        onClick={() => updateStatus(order.id, 'DELIVERED')}
                      >
                        Concluir
                      </Button>
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

export function StaffList({ tenant }: { tenant: Tenant | null }) {
  return (
    <ContentCard padding="none" className="overflow-hidden">
      <div className="p-5 sm:p-8 border-b border-slate-100 flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center bg-slate-50/50">
         <div>
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Equipe Digital</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Colaboradores ativos na rede</p>
         </div>
         <Button variant="primary" size="md" className="w-full sm:w-auto">
            Novo Membro
         </Button>
      </div>
      <div className="p-5 sm:p-8 space-y-4">
         <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-5 bg-white border border-zinc-100 rounded-2xl transition-all hover:border-amber-200 hover:shadow-lg hover:shadow-slate-100">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 bg-amber-600 flex items-center justify-center rounded-2xl text-white font-black border border-amber-700/10 shadow-lg shadow-amber-100">
                {tenant?.name?.[0] || 'ED'}
              </div>
              <div>
                <p className="font-black text-slate-800 text-base leading-none">Eduardo Eloi (Administrador)</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge color="primary">Acesso Full</Badge>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-200"></span>
                  <Badge color="success" dot>Online agora</Badge>
                </div>
              </div>
            </div>
            <IconButton variant="ghost" size="sm">
               <ChevronRight className="w-5 h-5" />
            </IconButton>
         </div>
         
         <EmptyState 
            title="Expanda sua Equipe" 
            description="Configure atendentes, cozinheiros e motoboys para um fluxo automatizado."
            icon={ClipboardList}
         />
      </div>
    </ContentCard>
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
      const res = await apiFetch('/api/upload', {
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
      <div className="flex flex-col sm:flex-row items-start gap-4">
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

export function ProfileManagement({ tenant, refresh }: { tenant: Tenant | null, refresh: () => void }) {
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
    await apiFetch(`/api/tenants/${tenant?.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    refresh();
    alert("Dados atualizados com sucesso!");
  };

  return (
    <ContentCard padding="lg" className="max-w-4xl mx-auto">
      <form onSubmit={handleUpdate} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <ImageUploader 
            label="Logo / Imagem da Unidade"
            value={form.logoUrl}
            onChange={(val) => setForm({...form, logoUrl: val})}
            description="Esta imagem aparecerá no topo do seu cardápio digital."
          />
          <div className="space-y-6">
            <Input 
              label="Nome do Restaurante"
              value={form.name}
              onChange={e => setForm({...form, name: e.target.value})}
              placeholder="Ex: Smart Burger"
            />
            <Input 
              label="WhatsApp de Contato"
              value={form.whatsapp}
              onChange={e => setForm({...form, whatsapp: e.target.value})}
              placeholder="5511999999999"
            />
          </div>
        </div>

        <Input 
          label="Slogan / Descrição Curta"
          value={form.description}
          onChange={e => setForm({...form, description: e.target.value})}
          placeholder="Ex: O melhor burger da região"
        />

        <Textarea 
          label="Endereço Completo"
          value={form.address}
          onChange={e => setForm({...form, address: e.target.value})}
          placeholder="Rua, Número, Bairro, Cidade - UF"
          rows={2}
        />

        <div className="bg-blue-50 p-5 sm:p-6 rounded-2xl border border-blue-100 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
               <p className="text-[10px] font-black uppercase text-blue-600 tracking-widest mb-1">Link do seu Cardápio</p>
               <p className="text-sm font-bold text-blue-800 break-all">{window.location.origin}/{tenant?.slug}</p>
            </div>
            <Button 
              type="button"
              variant="outline"
              size="xs"
              className="w-full sm:w-auto"
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/${tenant?.slug}`);
                alert("Link copiado!");
              }}
            >
              Copiar Link
            </Button>
        </div>

        <div className="pt-4 flex justify-end">
          <Button type="submit" size="lg" className="w-full sm:w-auto" iconLeft={<CheckCircle2 className="w-5 h-5" />}>
            Salvar Alterações
          </Button>
        </div>
      </form>
    </ContentCard>
  );
}

export function MenuManagement({ tenant, refresh }: { tenant: Tenant | null, refresh: () => void }) {
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
      apiFetch(`/api/tenants/${tenant.slug}/inventory`)
        .then(res => res.json())
        .then(data => setInventoryItems(data))
        .catch(err => console.error(err));
    }
  }, [tenant]);

  const addCategory = async () => {
    if (!newCategory) return;
    await apiFetch('/api/categories', {
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
    
    await apiFetch(url, {
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
    await apiFetch(`/api/products/${id}`, { method: 'DELETE' });
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
      <ContentCard className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Input
          label="Nova Categoria"
          placeholder="Ex: Marmitas"
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          wrapperClassName="flex-1"
        />
        <Button onClick={addCategory} iconLeft={<Plus className="w-4 h-4" />} className="w-full sm:w-auto">
          Adicionar Categoria
        </Button>
      </ContentCard>

      {tenant.categories?.length > 0 ? tenant.categories.map(cat => (
        <div key={cat.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center bg-slate-50/50">
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
                     <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center mb-2 px-1">
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
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                                 <input 
                                   type="text" placeholder="Nome (ex: 500ml)" 
                                   value={v.name} onChange={e => updateVariantField(idx, 'name', e.target.value)}
                                   className="flex-1 bg-slate-50 border p-2 rounded-lg text-[10px] font-bold min-w-0"
                                 />
                                 <input 
                                   type="text" placeholder="Preço" 
                                   value={v.price} onChange={e => updateVariantField(idx, 'price', e.target.value)}
                                   className="w-full sm:w-20 bg-slate-50 border p-2 rounded-lg text-[10px] font-bold"
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

                     <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                     <button onClick={() => {
                        setAddingProductTo(null);
                        setEditingProduct(null);
                        setProdForm({ name: "", description: "", price: "", imageUrl: "", inventoryItemId: "", variants: [] });
                     }} className="w-full sm:w-auto text-slate-400 font-bold text-xs uppercase px-4 py-3">Cancelar</button>
                     <button onClick={() => addProduct(cat.id)} className="w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-lg font-bold text-xs uppercase">
                        {editingProduct ? 'Atualizar' : 'Salvar'}
                     </button>
                  </div>
               </div>
             )}

             {cat.products?.map(prod => (
               <div key={prod.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-3 bg-white border border-slate-100 rounded-xl">
                  <div className="flex gap-4 items-center min-w-0">
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
                  <div className="flex justify-end gap-2 w-full sm:w-auto">
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
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-8 sm:p-12 text-center">
           <Utensils className="w-12 h-12 text-slate-300 mx-auto mb-4" />
           <p className="text-slate-400 font-medium">Nenhuma categoria criada ainda.</p>
        </div>
      )}
    </div>
  );
}

export function FinancePanel({ slug, tenant }: { slug: string, tenant: Tenant }) {
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
        apiFetch(`/api/tenants/${slug}/finance-summary`),
        apiFetch(`/api/tenants/${slug}/cash/current`),
        apiFetch(`/api/tenants/${slug}/cash/history`)
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
    <div className="space-y-6 sm:space-y-8">
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
      <div className="bg-white rounded-[28px] sm:rounded-3xl border border-slate-200 shadow-sm overflow-hidden border-b-4 border-b-blue-600">
         <div className="p-5 sm:p-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
               <div className="flex gap-4 sm:gap-5 items-center">
                  <div className={`p-4 sm:p-5 rounded-[22px] ${currentCash ? 'bg-green-50 text-green-600 shadow-inner' : 'bg-slate-50 text-slate-300'}`}>
                     <Wallet className="w-8 h-8 sm:w-10 sm:h-10" />
                  </div>
                  <div>
                     <h3 className="text-lg sm:text-xl font-black text-slate-800 uppercase tracking-tight">Status do Caixa</h3>
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
                     className="w-full md:w-auto bg-blue-600 text-white px-6 sm:px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-100 active:scale-95 transition-all"
                  >
                     Abrir Caixa
                  </button>
                  ) : (
                  <button 
                     onClick={() => setShowCloseModal(true)}
                     className="w-full md:w-auto bg-red-600 text-white px-6 sm:px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-red-100 active:scale-95 transition-all"
                  >
                     Fechar Caixa
                  </button>
                  )}
               </div>
            </div>

            {currentCash && (
            <div className="mt-8 sm:mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-8 p-5 sm:p-6 bg-slate-50 rounded-2xl border border-slate-100">
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
               <div className="lg:border-l-2 lg:border-white lg:pl-8">
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

         <GridTable 
            data={history}
            keyExtractor={cash => cash.id}
            columns={[
              {
                header: "Data / Hora",
                render: cash => (
                  <div className="flex flex-col">
                    <span className="font-bold">{new Date(cash.openedAt).toLocaleDateString()}</span>
                    <span className="text-[10px] text-slate-400 font-black uppercase">
                      {new Date(cash.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} → {cash.closedAt ? new Date(cash.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                    </span>
                  </div>
                )
              },
              {
                header: "Entrada/Saída",
                render: cash => (
                  <div className="flex gap-4">
                    <div>
                      <p className="text-[9px] text-slate-400 uppercase font-black tracking-tighter">Iniciou</p>
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
                )
              },
              {
                header: "Diferença",
                render: cash => {
                  const diff = (cash.closingBalance || 0) - (cash.expectedBalance || 0);
                  if (!cash.closedAt) return <span className="text-slate-300">--</span>;
                  return (
                    <Badge color={Math.abs(diff) < 0.01 ? "success" : diff > 0 ? "info" : "danger"}>
                      {Math.abs(diff) < 0.01 ? "Bateu Certinho" : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(diff))}
                    </Badge>
                  );
                }
              },
              {
                header: "Ações",
                className: "text-right",
                render: () => <Button variant="ghost" size="xs">Ver Notas</Button>
              }
            ]}
         />
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

      const res = await apiFetch(`/api/tenants/${slug}/cash/${endpoint}`, {
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

export function InventoryPanel({ tenant }: { tenant: Tenant | null }) {
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
    nearExpiry: items.filter(i => {
      if (!i.expirationDate) return false;
      const days = (new Date(i.expirationDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24);
      return days > 0 && days <= 7;
    }).length,
    totalValue: items.reduce((acc, i) => acc + (i.purchasePrice || 0) * i.quantity, 0)
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
        <StatCard 
          title="Próximos do Vencimento" 
          value={stats.nearExpiry} 
          icon={CalendarClock} 
          color="warning"
        />
        <StatCard 
          title="Valor em Insumos" 
          value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalValue)} 
          icon={ArrowRightLeft} 
          color="success"
        />
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px]">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/30">
          <FilterLineSegmented 
            options={[
              { value: 'all', label: 'Todos' },
              { value: 'low', label: 'Críticos' },
              { value: 'expired', label: 'Vencidos' },
              { value: 'sale', label: 'Para Venda' },
              { value: 'internal', label: 'Consumo' }
            ]}
            value={filterType}
            onChange={val => setFilterType(val as any)}
          />

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
            <Input 
              placeholder="Buscar por nome ou código..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="flex-1 md:w-64"
              size="sm"
            />
            <Button 
              onClick={() => { setEditingItem(null); setShowItemForm(true); }}
              size="sm"
              className="w-full sm:w-auto"
              iconLeft={<Plus className="w-4 h-4" />}
            >
              Novo Item
            </Button>
          </div>
        </div>

        <GridTable 
          data={filteredItems}
          keyExtractor={item => item.id}
          emptyMessage="Nenhum item encontrado no inventário."
          columns={[
            {
              header: "Produto",
              render: item => (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:shadow-sm transition-all border border-slate-200/50">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-800 leading-tight">{item.name}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">#{item.code || 'S/COD'} • {item.brand || 'Marca n/d'}</p>
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
                return (
                  <div className="flex flex-col items-center">
                    <span className={`text-sm font-black ${isLow ? 'text-orange-600' : 'text-slate-800'}`}>
                      {item.quantity} {item.unit || 'un'}
                    </span>
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
                const isExpired = item.expirationDate && new Date(item.expirationDate) < new Date();
                const isNearExpiry = item.expirationDate && !isExpired && (new Date(item.expirationDate).getTime() - new Date().getTime()) < (7 * 24 * 60 * 60 * 1000);
                
                return (
                   <div className="space-y-1.5 min-w-[140px]">
                      {isLow && (
                         <Badge color="warning" size="sm" dot>Estoque Crítico</Badge>
                      )}
                      {item.expirationDate ? (
                        <Badge color={isExpired ? "danger" : isNearExpiry ? "warning" : "success"} size="sm">
                          {isExpired ? 'Expirou: ' : 'Vence em: '}
                          {new Date(item.expirationDate).toLocaleDateString()}
                        </Badge>
                      ) : (
                        <span className="text-[11px] text-slate-200 font-black uppercase italic">Sem Início</span>
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
                  <IconButton 
                    variant="ghost" 
                    size="sm"
                    onClick={() => { setEditingItem(item); setShowItemForm(true); }}
                  >
                    <Settings className="w-4 h-4" />
                  </IconButton>
                  <IconButton 
                    variant="ghost" 
                    size="sm"
                    className="text-red-400 hover:text-red-600"
                    onClick={async () => {
                      if (confirm("Deseja realmente remover este item do estoque?")) {
                        await apiFetch(`/api/inventory/items/${item.id}`, { method: 'DELETE' });
                        fetchData();
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </IconButton>
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
    
    await apiFetch(url, {
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
    await apiFetch(url, {
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


