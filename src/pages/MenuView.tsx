import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { 
  ShoppingCart, 
  Plus, 
  Minus, 
  X, 
  Send, 
  Loader2, 
  Utensils, 
  ChevronLeft,
  Info,
  MessageSquare,
  CreditCard,
  Wallet,
  Banknote,
  Truck,
  Store,
  MapPin
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import socket from "../lib/socket";
import { Tenant, Product, Order } from "../types";

interface CartItem {
  product: Product;
  quantity: number;
  notes: string;
}

export default function MenuView() {
  const { slug } = useParams();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productNotes, setProductNotes] = useState("");
  const [productQuantity, setProductQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [orderSent, setOrderSent] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("");

  const sectionRefs = useRef<{ [key: string]: HTMLElement | null }>({});

  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    orderType: "DELIVERY" as "DELIVERY" | "PICKUP",
    paymentMethod: "CASH" as "PIX" | "CREDIT" | "DEBIT" | "MEAL" | "CASH",
    paymentDetail: ""
  });

  const [activeOrder, setActiveOrder] = useState<Order | null>(null);

  useEffect(() => {
    fetch(`/api/tenants/${slug}`)
      .then(res => res.json())
      .then(data => {
        setTenant(data);
        if (data.categories?.length > 0) {
          setActiveCategory(data.categories[0]?.id || "");
        }
        setLoading(false);
      });

    // Listen for updates on the order
    socket.on("order-status-updated", (updatedOrder: Order) => {
       setActiveOrder(prev => {
         if (prev?.id === updatedOrder.id) return updatedOrder;
         return prev;
       });
    });

    return () => {
      socket.off("order-status-updated");
    };
  }, [slug]);

  // Handle intersection observer for scroll-spy categories
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveCategory(entry.target.id);
          }
        });
      },
      { rootMargin: "-10% 0px -80% 0px" }
    );

    Object.values(sectionRefs.current).forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, [tenant]);

  const openProduct = (product: Product) => {
    setSelectedProduct(product);
    setProductNotes("");
    setProductQuantity(1);
  };

  const handleAddToCart = () => {
    if (!selectedProduct) return;
    
    setCart(prev => {
      const newItem: CartItem = {
        product: selectedProduct,
        quantity: productQuantity,
        notes: productNotes
      };
      return [...prev, newItem];
    });
    setSelectedProduct(null);
  };

  const updateCartQuantity = (index: number, delta: number) => {
    setCart(prev => {
      const newCart = [...prev];
      const item = newCart[index];
      if (item) {
        const newQuantity = Math.max(1, item.quantity + delta);
        newCart[index] = { ...item, quantity: newQuantity };
      }
      return newCart;
    });
  };

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const total = cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);

  const handleCheckout = async () => {
    if (!form.name || !form.phone) return alert("Preencha nome e telefone!");

    const orderData = {
      customerName: form.name,
      customerPhone: form.phone,
      address: form.orderType === 'DELIVERY' ? form.address : 'Retirada no Local',
      orderType: form.orderType,
      paymentMethod: form.paymentMethod,
      paymentDetail: form.paymentDetail,
      tenantId: tenant?.id,
      items: cart.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
        notes: item.notes
      }))
    };

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData)
      });
      if (res.ok) {
        const order = await res.json();
        setActiveOrder(order);
        setOrderSent(true);
        setCart([]);
        setIsCheckoutOpen(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const scrollToCategory = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 120;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
    </div>
  );

  if (!tenant) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
      <Info className="w-16 h-16 text-gray-200 mb-4" />
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Ops!</h1>
      <p className="text-gray-500">Este cardápio não está disponível no momento.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-32 selection:bg-blue-100">
      {/* Header with Visual Polish */}
      <header className="bg-white px-6 pt-12 pb-16 border-b border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl -mr-32 -mt-32 opacity-50" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-orange-50 rounded-full blur-3xl -ml-24 -mb-24 opacity-50" />
        
        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           className="relative z-10 max-w-lg mx-auto text-center"
        >
          <div className="mb-4">
             <Link 
              to={`/dashboard/${slug}`}
              className="inline-block text-[10px] font-black uppercase text-slate-400 hover:text-blue-500 transition-all tracking-[0.2em] bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full border border-slate-100 shadow-sm"
            >
              Acessar Gestão (Admin)
            </Link>
          </div>

          {tenant.logoUrl ? (
            <img src={tenant.logoUrl} className="w-20 h-20 rounded-3xl mx-auto shadow-xl mb-6 object-cover border-4 border-white" alt="logo" />
          ) : (
            <div className="w-20 h-20 bg-[#0F172A] rounded-3xl mx-auto shadow-xl mb-6 flex items-center justify-center text-white text-3xl font-black">
              {tenant?.name?.[0] || 'S'}
            </div>
          )}
          <h1 className="text-3xl font-black text-[#0F172A] tracking-tight">{tenant.name}</h1>
          <p className="text-slate-500 mt-3 text-sm font-medium leading-relaxed max-w-xs mx-auto italic">
            "{tenant.description}"
          </p>
          
          <div className="flex items-center justify-center gap-4 mt-6">
            <div className="flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
               <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
               Aberto Agora
            </div>
            <div className="text-slate-300">|</div>
            <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
               <Utensils className="w-3 h-3" />
               Delivery & Balcão
            </div>
          </div>
        </motion.div>
      </header>

      {/* Sticky Category Bar */}
      <nav className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100 shadow-sm overflow-x-auto no-scrollbar py-3 px-4">
        <div className="flex gap-2 max-w-lg mx-auto">
          {tenant.categories?.map(cat => (
            <button
              key={`nav-cat-${cat.id}`}
              onClick={() => scrollToCategory(cat.id)}
              className={`px-5 py-2 rounded-2xl whitespace-nowrap text-xs font-bold transition-all ${
                activeCategory === cat.id 
                  ? 'bg-[#0F172A] text-white shadow-lg' 
                  : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </nav>

      {/* Menu Sections with Horizontal Images */}
      <div className="max-w-lg mx-auto px-4 mt-8 space-y-12">
        {tenant.categories?.map((category, catIdx) => (
          <motion.section 
            key={`cat-section-${category.id}`} 
            id={category.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5, delay: catIdx * 0.1 }}
            ref={el => { sectionRefs.current[category.id] = el; }}
            className="scroll-mt-32"
          >
            <div className="flex items-center gap-4 mb-6">
              <h2 className="text-lg font-black text-[#0F172A] uppercase tracking-tight">
                {category.name}
              </h2>
              <div className="flex-1 h-px bg-slate-200/50" />
            </div>

            <div className="grid gap-5">
              {category.products.map((product, pIdx) => (
                <motion.div
                  key={product.id}
                  onClick={() => openProduct(product)}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: pIdx * 0.05 }}
                  whileHover={{ y: -4, boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)" }}
                  whileTap={{ scale: 0.96 }}
                  className="bg-white rounded-2xl shadow-sm flex items-start p-4 gap-4 border border-slate-100 hover:border-blue-200 transition-all cursor-pointer group"
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-800 text-sm group-hover:text-blue-600 transition-colors truncate">{product.name}</h3>
                    <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 font-medium leading-relaxed">{product.description}</p>
                    <div className="mt-3 text-blue-600 font-extrabold text-sm tracking-tight flex items-center gap-2">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.price)}
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.5 }}
                          whileInView={{ opacity: 1, scale: 1 }}
                          className="w-1.5 h-1.5 rounded-full bg-blue-100" 
                        />
                    </div>
                  </div>
                  <div className="relative shrink-0 overflow-hidden rounded-xl bg-slate-50 border border-slate-100 w-20 h-20">
                    <img 
                      src={product.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200'} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-115" 
                      alt={product.name} 
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.section>
        ))}
      </div>

      {/* Floating Action Bar / Order Tracking */}
      <AnimatePresence>
        {activeOrder && activeOrder.status !== 'DELIVERED' && activeOrder.status !== 'CANCELLED' && (
          <motion.div
            key={`track-${activeOrder.id}`}
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="fixed bottom-32 left-4 right-4 max-w-md mx-auto z-50 px-1"
          >
            <div className="bg-white border-2 border-green-500 p-4 rounded-[24px] shadow-2xl flex items-center gap-4">
               <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center">
                  <div className="w-6 h-6 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
               </div>
                <div className="flex-1">
                   <span className="block text-[10px] font-black uppercase text-green-600 tracking-widest">
                     {activeOrder.status === 'PENDING' ? 'Recebemos seu pedido!' : 'Status do Pedido'}
                   </span>
                   <div className="flex flex-col">
                     <span className="text-sm font-bold text-[#0F172A]">
                       {activeOrder.status === 'PENDING' ? 'Aguardando Restaurante' :
                        activeOrder.status === 'PREPARING' ? 'Na Cozinha' :
                        activeOrder.status === 'SHIPPED' ? (activeOrder.orderType === 'DELIVERY' ? 'Saiu para entrega' : 'Disponível para retirada') : 'Concluído'}
                     </span>
                     {activeOrder.orderType === 'PICKUP' && (activeOrder.status === 'PREPARING' || activeOrder.status === 'SHIPPED') && (
                        <div className="flex items-center gap-1 mt-1">
                           <MapPin className="w-3 h-3 text-slate-300" />
                           <span className="text-[10px] text-slate-400 font-bold truncate max-w-[200px]">
                              {tenant?.address || 'Rua do Sucesso, 123 - Centro'}
                           </span>
                        </div>
                     )}
                   </div>
                </div>
            </div>
          </motion.div>
        )}

        {cart.length > 0 && !isCheckoutOpen && (
          <motion.div
            key="cart-bar"
            initial={{ y: 100, opacity: 0, scale: 0.8 }}
            animate={{ 
              y: 0, 
              opacity: 1, 
              scale: 1,
              transition: { type: "spring", stiffness: 260, damping: 20 }
            }}
            exit={{ y: 100, opacity: 0, scale: 0.8 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="fixed bottom-8 left-4 right-4 max-w-md mx-auto z-40"
          >
            <button
              onClick={() => setIsCartOpen(true)}
              className="w-full bg-[#0F172A] text-white p-5 rounded-[32px] shadow-2xl flex items-center justify-between font-bold ring-8 ring-white group"
            >
              <div className="flex items-center gap-4">
                <div className="bg-blue-500 p-2.5 rounded-2xl shadow-lg ring-2 ring-blue-400/20 group-hover:rotate-6 transition-transform">
                  <ShoppingCart className="w-5 h-5 text-white" />
                  <AnimatePresence mode="popLayout">
                    <motion.div 
                      key={cart.length}
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[10px] font-black"
                    >
                      {cart.reduce((a, b) => a + b.quantity, 0)}
                    </motion.div>
                  </AnimatePresence>
                </div>
                <div className="text-left">
                  <span className="block text-[10px] uppercase tracking-widest text-slate-400 font-black">Finalizar Pedido</span>
                  <span className="text-sm">Abrir meu carrinho</span>
                </div>
              </div>
              <div className="text-right">
                <motion.span 
                  key={total}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xl font-black tracking-tight block"
                >
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}
                </motion.span>
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Product Details Modal (Premium App Feel) */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProduct(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ y: 500, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 500, opacity: 0 }}
              className="relative bg-white w-full max-w-lg rounded-t-[40px] sm:rounded-[40px] overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
            >
              <div className="relative h-64 sm:h-80 shrink-0">
                 <img src={selectedProduct.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800'} className="w-full h-full object-cover" alt="product" />
                 <button 
                  onClick={() => setSelectedProduct(null)}
                  className="absolute top-6 right-6 p-2 bg-black/20 backdrop-blur-md text-white rounded-full hover:bg-black/40 transition-colors"
                 >
                   <X className="w-6 h-6" />
                 </button>
              </div>

              <div className="p-8 overflow-y-auto space-y-6">
                <div>
                   <h2 className="text-3xl font-black text-[#0F172A] mb-2">{selectedProduct.name}</h2>
                   <p className="text-slate-500 text-sm leading-relaxed">{selectedProduct.description}</p>
                </div>

                <div className="flex items-center justify-between py-4 border-y border-slate-100">
                    <span className="text-2xl font-black text-blue-600">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedProduct.price)}
                    </span>
                    <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                       <button 
                        onClick={() => setProductQuantity(q => Math.max(1, q - 1))}
                        className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-400 hover:text-blue-600 transition-colors"
                       >
                         <Minus className="w-5 h-5" />
                       </button>
                       <span className="font-black text-lg w-6 text-center">{productQuantity}</span>
                       <button 
                        onClick={() => setProductQuantity(q => q + 1)}
                        className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-400 hover:text-blue-600 transition-colors"
                       >
                         <Plus className="w-5 h-5" />
                       </button>
                    </div>
                </div>

                <div className="space-y-3">
                   <div className="flex items-center gap-2 text-slate-400 font-bold uppercase text-[10px] tracking-widest px-1">
                      <MessageSquare className="w-3 h-3" />
                      Observações & Adicionais
                   </div>
                   <textarea
                     value={productNotes}
                     onChange={(e) => setProductNotes(e.target.value)}
                     className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all min-h-[100px]"
                     placeholder="Ex: sem cebola, ponto da carne mal passado, extra molho..."
                   />
                </div>
              </div>

              <div className="p-8 bg-slate-50/50 border-t border-slate-100">
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleAddToCart}
                  className="w-full bg-[#0F172A] text-white p-5 rounded-[24px] font-black flex items-center justify-between group shadow-xl shadow-slate-200"
                >
                  <span className="group-active:scale-95 transition-transform">Adicionar ao Carrinho</span>
                  <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(selectedProduct.price * productQuantity)}</span>
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Simplified Side Drawer for Cart */}
      <AnimatePresence>
        {isCartOpen && (
          <div className="fixed inset-0 z-[110]">
             <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              className="absolute top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 flex items-center gap-4">
                 <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <ChevronLeft className="w-6 h-6" />
                 </button>
                 <h2 className="text-2xl font-black text-[#0F172A]">Meu Pedido</h2>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                {cart.map((item, idx) => (
                  <div key={idx} className="flex gap-4 p-4 bg-slate-50 rounded-3xl border border-slate-100 relative group">
                    <img src={item.product.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200'} className="w-16 h-16 rounded-2xl object-cover" alt="item" />
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <h4 className="font-bold text-slate-800 text-sm">{item.product.name}</h4>
                        <button onClick={() => removeFromCart(idx)} className="text-slate-300 hover:text-red-500 p-1">
                           <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-blue-600 font-bold text-xs">
                           {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.product.price * item.quantity)}
                        </p>
                        <div className="flex items-center gap-3 bg-white px-2 py-1 rounded-xl shadow-sm border border-slate-100">
                           <button onClick={() => updateCartQuantity(idx, -1)} className="text-slate-400">
                             <Minus className="w-3 h-3" />
                           </button>
                           <span className="text-xs font-black w-4 text-center">{item.quantity}</span>
                           <button onClick={() => updateCartQuantity(idx, 1)} className="text-slate-400">
                             <Plus className="w-3 h-3" />
                           </button>
                        </div>
                      </div>
                      {item.notes && (
                        <p className="text-[10px] text-orange-400 mt-2 bg-orange-50/50 p-2 rounded-lg italic font-medium">
                           " {item.notes} "
                        </p>
                      )}
                    </div>
                  </div>
                ))}

                {cart.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-center opacity-30">
                     <ShoppingCart className="w-16 h-16 mb-4" />
                     <p className="font-bold uppercase tracking-widest text-xs">Seu carrinho está vazio</p>
                  </div>
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-8 border-t border-slate-100 space-y-4">
                  <div className="flex justify-between items-center text-slate-400 uppercase font-black text-[10px] tracking-widest">
                     <span>Subtotal</span>
                     <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[#0F172A] font-black text-2xl">
                     <span>Total</span>
                     <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}</span>
                  </div>
                  <button
                    onClick={() => { setIsCartOpen(false); setIsCheckoutOpen(true); }}
                    className="w-full bg-[#0F172A] text-white p-5 rounded-[24px] font-black text-lg shadow-xl shadow-blue-900/10 hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    Escolher Entrega e Pagamento
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Checkout Modal (Refined) */}
      <AnimatePresence>
        {isCheckoutOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
             <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
              onClick={() => setIsCheckoutOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-white w-full max-w-md rounded-[40px] p-8 sm:p-10 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto"
            >
              <h2 className="text-3xl font-black text-[#0F172A] mb-8 text-center">Finalizar Pedido</h2>
              
              <div className="space-y-6">
                {/* Order Type Toggle */}
                <div className="flex bg-slate-100 p-1 rounded-2xl">
                   <button 
                    onClick={() => setForm({ ...form, orderType: 'DELIVERY' })}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all ${form.orderType === 'DELIVERY' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                   >
                     <Truck className="w-4 h-4" /> Delivery
                   </button>
                   <button 
                    onClick={() => setForm({ ...form, orderType: 'PICKUP' })}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all ${form.orderType === 'PICKUP' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                   >
                     <Store className="w-4 h-4" /> Retirada
                   </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 px-1">Seus Dados</label>
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-600 transition-all font-medium"
                        placeholder="Nome"
                      />
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={e => setForm({ ...form, phone: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-600 transition-all font-medium"
                        placeholder="WhatsApp"
                      />
                    </div>
                  </div>

                  {form.orderType === 'DELIVERY' ? (
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 px-1">Endereço de Entrega</label>
                      <textarea
                        value={form.address}
                        onChange={e => setForm({ ...form, address: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-600 transition-all font-medium"
                        placeholder="Rua, número, bairro..."
                        rows={2}
                      />
                    </div>
                  ) : (
                    <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex items-start gap-3">
                       <MapPin className="w-5 h-5 text-blue-600 shrink-0" />
                       <div>
                          <span className="block text-[10px] font-black uppercase text-blue-400 tracking-widest mb-1">Endereço de Retirada</span>
                          <p className="text-xs font-bold text-blue-800">Rua do Sucesso, 123 - Centro, São Paulo</p>
                       </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 px-1">Forma de Pagamento</label>
                    <div className="grid grid-cols-2 gap-2">
                       {[
                         { id: 'PIX', label: 'PIX', icon: Send },
                         { id: 'CREDIT', label: 'Crédito', icon: CreditCard },
                         { id: 'DEBIT', label: 'Débito', icon: CreditCard },
                         { id: 'MEAL', label: 'Vale Refeição', icon: Wallet },
                         { id: 'CASH', label: 'Dinheiro', icon: Banknote },
                       ].map(method => (
                         <button
                          key={method.id}
                          onClick={() => setForm({ ...form, paymentMethod: method.id as any })}
                          className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all ${form.paymentMethod === method.id ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-500 border-slate-100 hover:border-blue-200'}`}
                         >
                           <method.icon className="w-4 h-4" /> {method.label}
                         </button>
                       ))}
                    </div>
                  </div>

                  {(form.paymentMethod === 'CREDIT' || form.paymentMethod === 'DEBIT' || form.paymentMethod === 'MEAL') && (
                    <div>
                      <select 
                        value={form.paymentDetail}
                        onChange={e => setForm({ ...form, paymentDetail: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm focus:outline-none focus:ring-4 focus:ring-blue-100 font-medium"
                      >
                         <option value="">Escolha a Bandeira</option>
                         <option value="Visa">Visa</option>
                         <option value="Mastercard">Mastercard</option>
                         <option value="Elo">Elo</option>
                         <option value="Alelo">Alelo (VR)</option>
                         <option value="Sodexo">Sodexo (VR)</option>
                         <option value="Ticket">Ticket (VR)</option>
                      </select>
                    </div>
                  )}

                  {form.paymentMethod === 'CASH' && (
                    <div>
                      <input
                        type="text"
                        value={form.paymentDetail}
                        onChange={e => setForm({ ...form, paymentDetail: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-600 transition-all font-medium"
                        placeholder="Troco para quanto? (Deixe em branco se não precisar)"
                      />
                    </div>
                  )}

                  <button
                    onClick={handleCheckout}
                    className="w-full bg-[#0F172A] text-white p-5 rounded-[24px] font-black flex items-center justify-between mt-6 shadow-xl shadow-blue-900/10 active:scale-95 transition-all group"
                  >
                    <span>Enviar Pedido</span>
                    <div className="flex items-center gap-2">
                       <span className="text-blue-400">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}</span>
                       <Send className="w-5 h-5 text-blue-400 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Full-Screen Success Overlay */}
      <AnimatePresence>
        {orderSent && (
          <motion.div
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed inset-0 z-[200] bg-white flex flex-col items-center justify-center text-center p-10"
          >
            <div className="w-32 h-32 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-8 shadow-inner">
               <Send className="w-14 h-14" />
            </div>
            <h2 className="text-4xl font-black text-[#0F172A] mb-4">Pedido Enviado!</h2>
            <p className="text-slate-400 text-lg max-w-xs font-medium leading-relaxed">
              Recebemos sua mensagem! Nossa equipe já está preparando sua delícia.
            </p>
            <div className="mt-12 space-y-4 w-full max-w-xs">
               <button
                  onClick={() => setOrderSent(false)}
                  className="w-full bg-[#0F172A] text-white p-5 rounded-[24px] font-black shadow-xl"
               >
                 Entendido!
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
