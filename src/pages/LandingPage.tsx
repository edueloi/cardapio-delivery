import React from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock3,
  LayoutDashboard,
  MessageCircle,
  QrCode,
  ShoppingBag,
  Sparkles,
  Zap,
  Menu as MenuIcon,
  X,
  TrendingUp,
  Utensils,
  BarChart3,
  Shield,
  ChevronDown,
  Phone,
  Mail,
  MapPin,
  Package,
  CreditCard,
  Globe,
  Layers,
  Play,
  ChevronRight,
  Wallet,
  Users,
  Store,
  Wifi,
  Lock,
  Headphones,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const LandingPage: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState(0);

  const navLinks = [
    { href: '#solucoes', label: 'Soluções' },
    { href: '#recursos', label: 'Recursos' },
    { href: '#operacao', label: 'Como Funciona' },
    { href: '#contato', label: 'Contato' },
  ];

  const solutions = [
    {
      icon: <Utensils className="w-5 h-5" />,
      title: 'FoodService',
      subtitle: 'Restaurantes e Delivery',
      desc: 'Gestão para operação diária ou por agenda. Venda em tempo real, aceite pedidos programados e configure cardápios para finais de semana, datas especiais e janelas específicas.',
      features: ['Pedidos em tempo real', 'Agendamento por data e horário', 'Cardápio por dia da semana', 'Robô informa quando você atende'],
      accent: 'text-orange-600',
      bg: 'bg-orange-50',
      border: 'border-orange-100',
      btnBg: 'bg-orange-500 hover:bg-orange-600',
    },
    {
      icon: <Store className="w-5 h-5" />,
      title: 'PDV Frente de Loja',
      subtitle: 'Lojas de Varejo',
      desc: 'PDV com controle de caixa, estoque, comandas e gestão de operadores para varejo físico.',
      features: ['Caixa com abertura e fechamento', 'Controle de estoque', 'Gestão de operadores', 'Relatórios detalhados'],
      accent: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-100',
      btnBg: 'bg-blue-600 hover:bg-blue-700',
    },
    {
      icon: <Globe className="w-5 h-5" />,
      title: 'eCommerce Express',
      subtitle: 'Lojas Virtuais',
      desc: 'Loja online com link de pedido, catálogo digital e integração com Google ADS e Meta ADS.',
      features: ['Link de pedido personalizado', 'Catálogo digital', 'Google ADS e Meta ADS', 'Pagamentos integrados'],
      accent: 'text-violet-600',
      bg: 'bg-violet-50',
      border: 'border-violet-100',
      btnBg: 'bg-violet-600 hover:bg-violet-700',
    },
    {
      icon: <Layers className="w-5 h-5" />,
      title: 'Sistema de Gestão Web',
      subtitle: 'Para PMEs',
      desc: 'Solução web para pequenas e médias empresas com gestão financeira, estoque e CRM.',
      features: ['Gestão financeira', 'CRM de clientes', 'Controle de estoque', 'Relatórios e indicadores'],
      accent: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-100',
      btnBg: 'bg-emerald-600 hover:bg-emerald-700',
    },
  ];

  const features = [
    { icon: <QrCode className="w-5 h-5" />, title: 'Cardápio por QR Code', desc: 'Cliente acessa pelo celular, sem papel, sem espera. Atualização em tempo real.', color: 'bg-blue-50 text-blue-600 border-blue-100' },
    { icon: <Bot className="w-5 h-5" />, title: 'Robô do WhatsApp', desc: 'Atendimento automático 24h. Receba pedidos e responda clientes sem esforço.', color: 'bg-green-50 text-green-600 border-green-100' },
    { icon: <Clock3 className="w-5 h-5" />, title: 'Agendamento Inteligente', desc: 'Ideal para quem vende por encomenda ou só trabalha em dias específicos, como sexta, sábado e domingo.', color: 'bg-amber-50 text-amber-600 border-amber-100' },
    { icon: <Sparkles className="w-5 h-5" />, title: 'Cardápio Programado', desc: 'Suba pratos, combos e promoções automaticamente em datas e dias da semana definidos por você.', color: 'bg-yellow-50 text-yellow-600 border-yellow-100' },
    { icon: <LayoutDashboard className="w-5 h-5" />, title: 'Painel Operacional', desc: 'Pedidos, caixa, estoque e produção em tempo real em um só painel.', color: 'bg-amber-50 text-amber-600 border-amber-100' },
    { icon: <Clock3 className="w-5 h-5" />, title: 'Monitor de Cozinha', desc: 'Fila inteligente com status em preparo, pronto e entregue para sua equipe.', color: 'bg-orange-50 text-orange-600 border-orange-100' },
    { icon: <BarChart3 className="w-5 h-5" />, title: 'Relatórios e Financeiro', desc: 'Fluxo de caixa, relatórios de vendas e controle de desempenho.', color: 'bg-violet-50 text-violet-600 border-violet-100' },
    { icon: <Utensils className="w-5 h-5" />, title: 'PDV Completo', desc: 'Caixa com abertura, fechamento, sangria e controle de operadores.', color: 'bg-red-50 text-red-500 border-red-100' },
    { icon: <Package className="w-5 h-5" />, title: 'Controle de Estoque', desc: 'Controle de insumos e alertas automáticos de reposição.', color: 'bg-teal-50 text-teal-600 border-teal-100' },
    { icon: <Layers className="w-5 h-5" />, title: 'Produção com Custo Real', desc: 'O sistema calcula custo por grama, ml e unidade, gera a produção e desconta os insumos automaticamente.', color: 'bg-cyan-50 text-cyan-700 border-cyan-100' },
    { icon: <CreditCard className="w-5 h-5" />, title: 'Ofertas e Promoções', desc: 'Cupons de desconto, clube de fidelidade e promoções automáticas.', color: 'bg-pink-50 text-pink-600 border-pink-100' },
    { icon: <Wallet className="w-5 h-5" />, title: 'Controle Financeiro', desc: 'Contas a pagar e receber, fluxo de caixa e relatórios simplificados.', color: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
    { icon: <Users className="w-5 h-5" />, title: 'Mesas e Comandas', desc: 'App para garçom e QR Code na mesa. Pedidos da mesa direto para a cozinha.', color: 'bg-amber-50 text-amber-600 border-amber-100' },
    { icon: <Globe className="w-5 h-5" />, title: 'Integração com iFood', desc: 'Receba pedidos do iFood direto no sistema, sem digitar nada manualmente.', color: 'bg-rose-50 text-rose-500 border-rose-100' },
    { icon: <Lock className="w-5 h-5" />, title: 'Documentos Fiscais', desc: 'Emissão de NF-e, NFC-e e SAT em conformidade com a legislação.', color: 'bg-slate-50 text-slate-500 border-slate-200' },
  ];

  const diferenciais = [
    { icon: <Zap className="w-5 h-5" />, title: 'Implantação rápida', desc: 'Seu sistema funcionando em horas, não semanas. Sem complicação técnica.' },
    { icon: <Headphones className="w-5 h-5" />, title: 'Suporte especializado', desc: 'Time dedicado para te ajudar sempre que precisar. Suporte via chat e telefone.' },
    { icon: <Wifi className="w-5 h-5" />, title: 'Funciona offline', desc: 'Sem internet temporariamente? O sistema continua operando normalmente.' },
    { icon: <Shield className="w-5 h-5" />, title: 'Dados seguros', desc: 'Backup automático na nuvem. Seus dados sempre protegidos e acessíveis.' },
  ];

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans overflow-x-hidden selection:bg-amber-100">

      {/* ── NAVBAR ── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/95 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-4">

          <Link to="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center p-1.5 shadow-[0_10px_24px_-16px_rgba(15,23,42,0.35)] transition-all group-hover:border-amber-200">
              <img src="/images/logo.png" alt="BoxSys" className="w-full h-full object-contain" />
            </div>
            <span className="text-[15px] font-bold tracking-tight text-gray-900">
              Box<span className="text-amber-500">Sys</span>
            </span>
          </Link>

          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map(({ href, label }) => (
              <a key={href} href={href} className="px-4 py-2 rounded-lg text-[13px] font-medium text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-all">
                {label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link to="/login" className="hidden sm:flex items-center gap-2 text-[12px] font-semibold text-gray-500 hover:text-gray-900 transition-colors px-3 py-2">
              Entrar
            </Link>
            <a href="#contato" className="hidden sm:flex items-center gap-1.5 border border-gray-200 hover:border-gray-300 text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg text-[12px] font-semibold transition-all">
              Solicitar Demo
            </a>
            <Link to="/login" className="flex items-center gap-1.5 bg-gray-900 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-[12px] font-bold transition-all shadow-sm active:scale-95">
              Começar
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden w-9 h-9 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-900 transition-colors"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <MenuIcon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-100 bg-white px-5 py-5 space-y-1">
            {navLinks.map(({ href, label }) => (
              <a key={href} href={href} onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 px-3 py-3 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors">
                {label}
              </a>
            ))}
            <a href="#contato" onClick={() => setMobileMenuOpen(false)} className="mt-3 flex items-center justify-center gap-2 border border-gray-200 text-gray-700 px-5 py-3.5 rounded-xl text-sm font-semibold">
              Solicitar Demonstração
            </a>
            <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="mt-2 flex items-center justify-center gap-2 bg-gray-900 text-white px-5 py-3.5 rounded-xl text-sm font-bold">
              Acessar o Painel
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section className="relative pt-28 pb-0 sm:pt-36 px-5 sm:px-8 overflow-hidden bg-gradient-to-b from-gray-50 to-white">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.08),transparent_60%)]" />
          <div className="absolute inset-0 opacity-[0.025] bg-[linear-gradient(to_right,#1f2937_1px,transparent_1px),linear-gradient(to_bottom,#1f2937_1px,transparent_1px)] bg-[size:64px_64px]" />
        </div>

        <div className="relative max-w-5xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65 }}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 border border-amber-200 text-amber-600 mb-7">
              <Sparkles className="w-3.5 h-3.5" />
              <span className="text-[11px] font-bold uppercase tracking-[0.18em]">Gestão para FoodService e eCommerce</span>
            </div>

            <h1 className="text-5xl sm:text-6xl md:text-[70px] lg:text-[80px] font-black tracking-[-0.03em] leading-[1.02] mb-6 text-gray-900">
              Impulsione suas vendas<br />
              com uma solução{' '}
              <span className="relative inline-block text-amber-500">
                definitiva.
                <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 300 8" fill="none">
                  <path d="M2 5 Q75 1 150 5 Q225 9 298 4" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
                </svg>
              </span>
            </h1>

            <p className="text-base sm:text-lg md:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed mb-10">
              Cardápio digital, PDV, WhatsApp, agendamento e produção inteligente em uma plataforma só.
              Funciona para quem opera todos os dias ou apenas em finais de semana, datas especiais e pedidos sob encomenda.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-14">
              <a href="#contato" className="group inline-flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-700 text-white px-8 py-4 rounded-xl font-bold text-sm transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]">
                Solicitar Apresentação
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>
              <a href="#solucoes" className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-semibold text-sm text-gray-500 hover:text-gray-900 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all">
                Ver soluções
                <ChevronDown className="w-4 h-4" />
              </a>
            </div>

            <div className="flex flex-wrap justify-center gap-6 sm:gap-12 mb-16">
              {[
                { value: '100%', label: 'Digital e em nuvem' },
                { value: 'Real-time', label: 'Pedidos ao vivo' },
                { value: 'Multi-canal', label: 'Mesa, delivery e balcão' },
                { value: 'Sob agenda', label: 'Dias e horários programados' },
              ].map(({ value, label }) => (
                <div key={label} className="text-center">
                  <div className="text-2xl sm:text-3xl font-black text-gray-900">{value}</div>
                  <div className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mt-0.5">{label}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Dashboard mockup */}
        <motion.div initial={{ opacity: 0, y: 48 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.85 }} className="relative max-w-5xl mx-auto">
          <div className="relative rounded-2xl border border-gray-200 overflow-hidden shadow-[0_40px_120px_rgba(0,0,0,0.1)] bg-white">
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-gray-100 bg-gray-50">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
              <div className="flex-1 mx-4 h-5 rounded-md bg-white border border-gray-200 flex items-center px-3">
                <span className="text-[9px] text-gray-400 font-mono">boxsys.com.br/painel</span>
              </div>
            </div>
            <img src="/images/mockup-site-menuflow.png" alt="Painel BoxSys" className="w-full object-cover object-top aspect-[16/8]" />
          </div>

          <div className="absolute -left-4 sm:-left-8 top-14 rounded-2xl bg-white border border-gray-200 p-3 sm:p-4 shadow-xl">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
                <MessageCircle className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">WhatsApp</div>
                <div className="text-xs font-bold text-gray-900">Bot Ativo</div>
              </div>
            </div>
          </div>

          <div className="absolute -right-4 sm:-right-8 bottom-14 rounded-2xl bg-white border border-gray-200 p-3 sm:p-4 shadow-xl">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">Vendas hoje</div>
                <div className="text-xs font-bold text-gray-900">R$ 3.240</div>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="h-16 bg-gradient-to-b from-transparent to-white pointer-events-none" />
      </section>

      {/* ── SEGMENTOS ── */}
      <div className="border-y border-gray-100 bg-gray-50 py-5 px-5">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-5 sm:gap-10 text-gray-400">
          {[
            { icon: <Utensils className="w-3.5 h-3.5" />, label: 'Restaurante' },
            { icon: <ShoppingBag className="w-3.5 h-3.5" />, label: 'Hamburgeria' },
            { icon: <Store className="w-3.5 h-3.5" />, label: 'Lanchonete' },
            { icon: <Package className="w-3.5 h-3.5" />, label: 'Delivery' },
            { icon: <Clock3 className="w-3.5 h-3.5" />, label: 'Encomendas' },
            { icon: <Globe className="w-3.5 h-3.5" />, label: 'Dark Kitchen' },
            { icon: <Layers className="w-3.5 h-3.5" />, label: 'Operação por agenda' },
          ].map(({ icon, label }) => (
            <div key={label} className="flex items-center gap-2">
              {icon}
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em]">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── SOLUÇÕES ── */}
      <section id="solucoes" className="py-24 sm:py-32 px-5 sm:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 border border-gray-200 text-gray-500 mb-4">
              <Layers className="w-3 h-3" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Nossas Soluções</span>
            </div>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-[-0.03em] leading-tight mb-4 text-gray-900">
              Uma plataforma para<br />
              <span className="text-gray-400">cada tipo de negócio.</span>
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto text-base sm:text-lg">
              Escolha a solução ideal para o seu segmento, inclusive para operações sob encomenda, cardápios de fim de semana e produção programada.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2 mb-10">
            {solutions.map((s, i) => (
              <button
                key={s.title}
                onClick={() => setActiveTab(i)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                  activeTab === i
                    ? 'bg-gray-900 text-white shadow-md'
                    : 'bg-gray-100 text-gray-500 hover:text-gray-900 hover:bg-gray-200 border border-gray-200'
                }`}
              >
                <span className={activeTab === i ? 'text-white' : s.accent}>{s.icon}</span>
                {s.title}
              </button>
            ))}
          </div>

          {solutions.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: activeTab === i ? 1 : 0, y: activeTab === i ? 0 : 12 }}
              transition={{ duration: 0.3 }}
              className={activeTab === i ? 'block' : 'hidden'}
            >
              <div className={`rounded-3xl ${s.bg} border ${s.border} p-8 sm:p-12 grid grid-cols-1 lg:grid-cols-2 gap-10 items-center`}>
                <div>
                  <div className={`inline-flex items-center gap-2 ${s.accent} mb-4`}>
                    {s.icon}
                    <span className="text-xs font-bold uppercase tracking-widest">{s.subtitle}</span>
                  </div>
                  <h3 className="text-3xl sm:text-4xl font-black tracking-tight mb-4 text-gray-900">{s.title}</h3>
                  <p className="text-gray-500 text-base leading-relaxed mb-8">{s.desc}</p>
                  <a href="#contato" className={`inline-flex items-center gap-2 ${s.btnBg} text-white px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]`}>
                    Solicitar apresentação
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {s.features.map((f) => (
                    <div key={f} className="flex items-center gap-3 rounded-xl bg-white border border-white shadow-sm p-4">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${s.accent}`}>
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-semibold text-gray-700">{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── RECURSOS ── */}
      <section id="recursos" className="py-24 sm:py-32 px-5 sm:px-8 bg-gray-50 border-y border-gray-100">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-500 mb-4">
              <Zap className="w-3 h-3" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Todos os recursos em um só lugar</span>
            </div>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-[-0.03em] leading-tight mb-4 text-gray-900">
              Uma plataforma.<br />
              <span className="text-gray-400">Tudo que você precisa.</span>
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto text-base">
              Do pedido imediato ao agendamento da semana, da cozinha ao custo de produção — tudo conectado e funcionando junto.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04 }}
                className="rounded-2xl bg-white border border-gray-100 p-5 hover:border-gray-200 hover:shadow-md transition-all"
              >
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-4 ${f.color}`}>
                  {f.icon}
                </div>
                <h3 className="text-sm font-bold text-gray-900 mb-1.5">{f.title}</h3>
                <p className="text-xs text-gray-400 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMO FUNCIONA ── */}
      <section id="operacao" className="py-24 sm:py-32 px-5 sm:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-600 mb-6">
              <Shield className="w-3 h-3" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Controle total da operação</span>
            </div>

            <h2 className="text-4xl sm:text-5xl font-black tracking-[-0.03em] leading-tight mb-6 text-gray-900">
              Do pedido ao prato,<br />
              <span className="text-amber-500">sem perder nada.</span>
            </h2>

            <p className="text-base text-gray-500 leading-relaxed mb-8">
              Cada pedido entra no sistema, respeita sua agenda de funcionamento, segue para a produção
              e chega ao financeiro com tudo registrado. Ideal para operação diária, produção sob encomenda e vendas de fim de semana.
            </p>

            <div className="space-y-3 mb-10">
              {[
                'Pedidos por mesa, balcão, retirada e delivery',
                'Cardápio aberto apenas nos dias e horários programados',
                'WhatsApp e cardápio orientam o cliente sobre sua agenda de atendimento',
                'Pratos e promoções entram sozinhos em dias específicos, como toda quarta-feira',
                'Monitor de cozinha com status em tempo real',
                'PDV com abertura e fechamento de caixa',
                'Produção calcula custo real por grama, ml e unidade',
                'Receitas vinculadas ao cardápio baixam os insumos automaticamente',
                'Fluxo de caixa e relatórios de vendas',
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-3 h-3 text-amber-500" />
                  </div>
                  <span className="text-sm text-gray-600 font-medium">{item}</span>
                </div>
              ))}
            </div>

            <a href="#contato" className="group inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-700 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-md hover:shadow-lg">
              Quero uma demonstração
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
          </motion.div>

          {/* Kitchen monitor mockup — dark panel é intencional aqui, simula monitor de cozinha */}
          <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.1 }} className="relative">
            <div className="absolute -inset-4 bg-amber-400/5 blur-3xl rounded-3xl" />
            <div className="relative rounded-2xl bg-gray-900 border border-gray-800 overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs font-bold text-white/70">Monitor de Cozinha — Ao Vivo</span>
                </div>
                <span className="text-xs font-mono text-white/30">14:32</span>
              </div>
              <div className="grid grid-cols-2 gap-px bg-white/[0.04]">
                <div className="bg-gray-900 p-4">
                  <div className="flex items-center gap-2 text-orange-400 text-xs font-bold uppercase tracking-wider mb-4">
                    <Clock3 className="w-3.5 h-3.5" />Em Preparo
                  </div>
                  {[{ id: '#521', item: 'X-Bacon duplo', time: '8min' }, { id: '#522', item: 'Pastel de Carne', time: '5min' }, { id: '#523', item: 'Suco Natural', time: '3min' }].map((o) => (
                    <div key={o.id} className="mb-2 rounded-xl bg-white/[0.04] border border-white/[0.07] p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-black text-orange-400">{o.id}</span>
                        <span className="text-[9px] text-white/30">{o.time}</span>
                      </div>
                      <span className="text-xs font-semibold text-white/80">{o.item}</span>
                      <div className="mt-2 h-1 rounded-full bg-white/[0.06] overflow-hidden">
                        <div className="h-full bg-orange-400/70 rounded-full w-2/3" />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bg-gray-900 p-4">
                  <div className="flex items-center gap-2 text-green-400 text-xs font-bold uppercase tracking-wider mb-4">
                    <CheckCircle2 className="w-3.5 h-3.5" />Prontos
                  </div>
                  {[{ id: '#519', item: 'Combo Completo' }, { id: '#520', item: 'Batata Especial' }, { id: '#518', item: 'Refrigerante' }].map((o) => (
                    <div key={o.id} className="mb-2 rounded-xl bg-green-500/5 border border-green-500/15 p-3">
                      <span className="text-[10px] font-black text-green-400 block mb-1">{o.id}</span>
                      <span className="text-xs font-semibold text-white/80">{o.item}</span>
                      <div className="mt-1.5 text-[9px] text-green-400/70 font-semibold">Retire no balcão</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 divide-x divide-white/[0.06] border-t border-white/[0.07]">
                {[{ val: '3', label: 'Aguardando', color: 'text-amber-400' }, { val: '3', label: 'Em preparo', color: 'text-orange-400' }, { val: '12', label: 'Entregues', color: 'text-green-400' }].map(({ val, label, color }) => (
                  <div key={label} className="py-3 text-center">
                    <div className={`text-lg font-black ${color}`}>{val}</div>
                    <div className="text-[9px] uppercase tracking-wider text-white/25 font-semibold">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── DIFERENCIAIS ── */}
      <section className="py-20 sm:py-24 px-5 sm:px-8 bg-[linear-gradient(180deg,#fffdf8_0%,#ffffff_100%)] border-y border-amber-100/60">
        <div className="max-w-7xl mx-auto">
          <div className="rounded-[2rem] border border-amber-100 bg-white shadow-[0_30px_80px_-45px_rgba(15,23,42,0.25)] overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-0">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="p-8 sm:p-10 lg:p-12"
              >
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-600 mb-6">
                  <Layers className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Produção Inteligente</span>
                </div>

                <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-[-0.03em] leading-tight text-gray-900 mb-5">
                  Você sabe quanto custa,<br />
                  <span className="text-amber-500">de verdade, o seu produto?</span>
                </h2>

                <p className="text-base sm:text-lg text-gray-500 leading-relaxed mb-8 max-w-2xl">
                  Seja uma pizza, um lanche, um prato, um doce ou qualquer outro item do seu cardápio,
                  a BoxSys calcula cada grama usada na receita. Assim você sabe o custo real do produto,
                  ajusta preço com segurança e evita vender sem margem.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                  {[
                    'Cálculo exato por grama, ml e unidade',
                    'Receitas com custo real atualizado pelos insumos',
                    'Produção vinculada ao cardápio e ao estoque',
                    'Baixa automática do que foi realmente consumido',
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3 rounded-2xl bg-gray-50 border border-gray-100 px-4 py-3">
                      <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-100 text-amber-500 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-semibold text-gray-700">{item}</span>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl bg-[#0B2343] px-5 py-4 text-white">
                  <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-white/55 mb-2">
                    Exemplo prático
                  </div>
                  <p className="text-sm sm:text-base leading-relaxed text-white/85">
                    Aqui usamos uma pizza só como exemplo. O mesmo cálculo vale para qualquer receita:
                    o sistema entende os ingredientes, calcula o custo real, gera a produção e baixa o
                    estoque com precisão.
                  </p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="relative bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.16),transparent_38%),linear-gradient(180deg,#fffaf0_0%,#ffffff_100%)] p-8 sm:p-10 lg:p-12 border-t lg:border-t-0 lg:border-l border-amber-100/70"
              >
                <div className="absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,rgba(251,191,36,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(251,191,36,0.12)_1px,transparent_1px)] [background-size:58px_58px]" />

                <div className="relative space-y-4">
                  <div className="rounded-3xl bg-white border border-amber-100 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-gray-400">Exemplo de Custo</div>
                        <div className="text-xl font-black text-gray-900 mt-1">Pizza Calabresa Grande 35cm</div>
                      </div>
                      <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-100 text-amber-500 flex items-center justify-center">
                        <Package className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="space-y-3">
                      {[
                        ['Farinha 300g', 'R$ 1,74'],
                        ['Água + fermento + sal + azeite', 'R$ 0,96'],
                        ['Molho artesanal 120g', 'R$ 1,08'],
                        ['Mussarela 180g', 'R$ 7,92'],
                        ['Calabresa 130g + cebola 30g', 'R$ 4,08'],
                        ['Azeitona, orégano e embalagem', 'R$ 1,20'],
                      ].map(([label, value]) => (
                        <div key={label} className="flex items-center justify-between rounded-2xl bg-gray-50 border border-gray-100 px-4 py-3">
                          <span className="text-sm font-semibold text-gray-600">{label}</span>
                          <span className="text-sm font-black text-gray-900">{value}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 rounded-2xl bg-[#0B2343] px-4 py-4 text-white flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/55">Custo real do produto</div>
                        <div className="text-2xl font-black mt-1">R$ 16,98</div>
                      </div>
                      <TrendingUp className="w-6 h-6 text-amber-400" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-white border border-gray-100 p-4">
                      <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-gray-400 mb-2">Produção</div>
                      <div className="text-sm font-semibold text-gray-800 leading-relaxed">
                        Gere a produção da pizza, massa ou recheio com base na sua receita.
                      </div>
                    </div>
                    <div className="rounded-2xl bg-white border border-gray-100 p-4">
                      <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-gray-400 mb-2">Estoque</div>
                      <div className="text-sm font-semibold text-gray-800 leading-relaxed">
                        O sistema baixa exatamente o que foi usado para manter sua margem protegida.
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 sm:py-32 px-5 sm:px-8 bg-gray-50 border-y border-gray-100">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-black tracking-[-0.03em] mb-4 text-gray-900">
              Por que usar a <span className="text-amber-500">BoxSys?</span>
            </h2>
            <p className="text-gray-400 max-w-md mx-auto text-base">
              Tecnologia desenvolvida para o dia a dia de quem trabalha com alimentação e varejo.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {diferenciais.map((d, i) => (
              <motion.div
                key={d.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="rounded-2xl bg-white border border-gray-100 p-6 hover:border-gray-200 hover:shadow-md transition-all"
              >
                <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 text-amber-500 flex items-center justify-center mb-5">
                  {d.icon}
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-2">{d.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{d.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TICKET MÉDIO / PROMOÇÕES ── */}
      <section className="py-24 sm:py-32 px-5 sm:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-600 mb-6">
              <TrendingUp className="w-3 h-3" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Agenda, campanhas e automações</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-black tracking-[-0.03em] leading-tight mb-6 text-gray-900">
              Faça seu cardápio vender<br />
              <span className="text-amber-500">na hora certa.</span>
            </h2>
            <p className="text-base text-gray-500 leading-relaxed mb-8">
              Programe campanhas, combos e pratos para subir automaticamente no melhor momento.
              Se você vende só aos finais de semana ou trabalha com pratos do dia, o sistema organiza isso para você.
            </p>
            <div className="space-y-4">
              {[
                { icon: <Zap className="w-4 h-4" />, title: 'Promoções por dia e horário', desc: 'Ative campanhas automaticamente em datas, horários e dias específicos da semana.' },
                { icon: <ShoppingBag className="w-4 h-4" />, title: 'Pratos e combos programados', desc: 'Publique menus especiais, pratos do dia e combos só quando fizer sentido para sua operação.' },
                { icon: <BarChart3 className="w-4 h-4" />, title: 'Relatórios de campanha e agenda', desc: 'Veja o impacto das promoções e do cardápio programado nas vendas em tempo real.' },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-4 rounded-xl bg-gray-50 border border-gray-100 p-4">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-100 text-amber-500 flex items-center justify-center shrink-0 mt-0.5">
                    {item.icon}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900 mb-1">{item.title}</div>
                    <div className="text-xs text-gray-400 leading-relaxed">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }} className="grid grid-cols-1 gap-3">
            {[ 
              { label: 'Integração com Google ADS e Meta ADS', icon: <Globe className="w-4 h-4" />, color: 'text-blue-500 bg-blue-50' },
              { label: 'Clube de fidelidade e cashback', icon: <CreditCard className="w-4 h-4" />, color: 'text-amber-500 bg-amber-50' },
              { label: 'Cupons de desconto personalizados', icon: <Zap className="w-4 h-4" />, color: 'text-violet-500 bg-violet-50' },
              { label: 'Link para pedido compartilhável', icon: <MessageCircle className="w-4 h-4" />, color: 'text-green-600 bg-green-50' },
              { label: 'Ativação automática de produtos e promoções', icon: <BarChart3 className="w-4 h-4" />, color: 'text-orange-500 bg-orange-50' },
              { label: 'Cardápio especial para finais de semana e datas sazonais', icon: <Clock3 className="w-4 h-4" />, color: 'text-sky-600 bg-sky-50' },
              { label: 'Controle de custos por ingrediente e receita', icon: <Layers className="w-4 h-4" />, color: 'text-cyan-700 bg-cyan-50' },
              { label: 'Relatórios detalhados de campanhas', icon: <TrendingUp className="w-4 h-4" />, color: 'text-pink-500 bg-pink-50' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 rounded-xl bg-white border border-gray-100 px-4 py-3.5 hover:bg-gray-50 hover:border-gray-200 transition-all">
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.color}`}>{item.icon}</span>
                <span className="text-sm font-semibold text-gray-700">{item.label}</span>
                <ChevronRight className="w-4 h-4 text-gray-300 ml-auto" />
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── CONTATO / DEMO ── */}
      <section id="contato" className="py-24 sm:py-32 px-5 sm:px-8 bg-gray-50 border-t border-gray-100">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-600 mb-6">
                <Play className="w-3 h-3" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Agende uma apresentação</span>
              </div>
              <h2 className="text-4xl sm:text-5xl font-black tracking-[-0.03em] leading-tight mb-5 text-gray-900">
                Transforme sua<br />
                <span className="text-amber-500">operação agora.</span>
              </h2>
              <p className="text-base text-gray-500 leading-relaxed mb-10">
                Solicite uma demonstração gratuita e veja como a BoxSys pode
                modernizar sua operação diária ou sob agenda, com cardápio programado, automações e produção inteligente.
              </p>
              <div className="space-y-4">
                {[
                  { icon: <Phone className="w-4 h-4" />, text: '(15) 99702-6791' },
                  { icon: <Mail className="w-4 h-4" />, text: 'contato@boxsys.com.br' },
                  { icon: <MapPin className="w-4 h-4" />, text: 'Atendimento em todo Brasil' },
                ].map(({ icon, text }) => (
                  <div key={text} className="flex items-center gap-3 text-gray-500 text-sm">
                    <div className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center shrink-0 text-gray-400">{icon}</div>
                    {text}
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 }} className="rounded-2xl bg-white border border-gray-200 p-7 sm:p-8 shadow-sm">
              <h3 className="text-lg font-black text-gray-900 mb-6">Solicite uma demonstração gratuita</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Nome</label>
                    <input type="text" placeholder="Seu nome" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/10 transition-all" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Telefone</label>
                    <input type="tel" placeholder="(00) 00000-0000" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/10 transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">E-mail</label>
                  <input type="email" placeholder="seu@email.com.br" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/10 transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Nome do estabelecimento</label>
                  <input type="text" placeholder="Ex: Hamburgueria do João" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-300 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/10 transition-all" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Segmento</label>
                  <select className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm text-gray-600 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/10 transition-all appearance-none">
                    <option value="">Selecione seu segmento</option>
                    <option value="restaurante">Restaurante</option>
                    <option value="hamburgeria">Hamburgeria</option>
                    <option value="lanchonete">Lanchonete</option>
                    <option value="delivery">Delivery / Dark Kitchen</option>
                    <option value="agenda">Encomendas / Operação por agenda</option>
                    <option value="varejo">Varejo</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
                <button className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-700 text-white px-6 py-3.5 rounded-xl font-bold text-sm transition-all shadow-md hover:shadow-lg hover:scale-[1.01] active:scale-[0.99]">
                  Agendar demonstração gratuita
                  <ArrowRight className="w-4 h-4" />
                </button>
                <p className="text-center text-[10px] text-gray-300">Sem compromisso. Nossa equipe entrará em contato em até 24h.</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="py-16 sm:py-20 px-5 sm:px-8 bg-gray-900">
        <div className="max-w-4xl mx-auto text-center">
          <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center p-2 mx-auto mb-7 shadow-xl">
            <img src="/images/logo.png" alt="BoxSys" className="w-full h-full object-contain" />
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-[-0.03em] leading-tight mb-5 text-white">
            Pronto para modernizar<br />seu negócio?
          </h2>
          <p className="text-base text-white/50 max-w-xl mx-auto mb-9 leading-relaxed">
            Agende uma demonstração gratuita e conheça tudo que a BoxSys oferece
            para facilitar sua operação e aumentar suas vendas.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href="#contato" className="group inline-flex items-center justify-center gap-2 bg-amber-400 hover:bg-amber-300 text-gray-900 px-10 py-4 rounded-xl font-black text-sm tracking-wide transition-all shadow-xl hover:scale-[1.02] active:scale-[0.98]">
              Solicitar apresentação
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
            <Link to="/login" className="inline-flex items-center justify-center gap-2 px-10 py-4 rounded-xl font-bold text-sm text-white/60 hover:text-white border border-white/15 hover:border-white/30 hover:bg-white/5 transition-all">
              Já tenho conta — Entrar
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-gray-900 border-t border-white/[0.06] py-14 px-5 sm:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center p-1.5">
                  <img src="/images/logo.png" alt="BoxSys" className="w-full h-full object-contain" />
                </div>
                <span className="text-base font-bold text-white/80">Box<span className="text-amber-400">Sys</span></span>
              </div>
              <p className="text-xs text-white/30 leading-relaxed mb-5">
                Plataforma de gestão para restaurantes, delivery, encomendas e operações por agenda. Tecnologia para vender melhor e produzir com controle real.
              </p>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[10px] text-white/25 font-medium">Sistema Online</span>
              </div>
            </div>

            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-4">Soluções</div>
              <ul className="space-y-2.5">
                {['FoodService', 'PDV Frente de Loja', 'eCommerce Express', 'Sistema de Gestão Web'].map((item) => (
                  <li key={item}><a href="#solucoes" className="text-xs text-white/40 hover:text-white/70 transition-colors font-medium">{item}</a></li>
                ))}
              </ul>
            </div>

            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-4">Recursos</div>
              <ul className="space-y-2.5">
                {['Cardápio QR Code', 'Bot de WhatsApp', 'Agendamento inteligente', 'Produção com custo real', 'Monitor de Cozinha', 'Controle de Estoque'].map((item) => (
                  <li key={item}><a href="#recursos" className="text-xs text-white/40 hover:text-white/70 transition-colors font-medium">{item}</a></li>
                ))}
              </ul>
            </div>

            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-4">Contato</div>
              <ul className="space-y-2.5">
                {[
                  { icon: <Phone className="w-3.5 h-3.5 shrink-0" />, text: '(15) 99702-6791' },
                  { icon: <Mail className="w-3.5 h-3.5 shrink-0" />, text: 'contato@boxsys.com.br' },
                  { icon: <MapPin className="w-3.5 h-3.5 shrink-0" />, text: 'Atendimento em todo Brasil' },
                ].map(({ icon, text }) => (
                  <li key={text} className="flex items-center gap-2 text-xs text-white/40">{icon}{text}</li>
                ))}
              </ul>
              <div className="mt-5">
                <a href="#contato" className="inline-flex items-center gap-1.5 bg-amber-400/10 border border-amber-400/20 text-amber-400 px-4 py-2 rounded-lg text-[11px] font-bold hover:bg-amber-400/20 transition-all">
                  Fale Conosco
                  <ArrowRight className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-[11px] text-white/20 font-medium">© 2026 BoxSys — Todos os direitos reservados</span>
            <div className="flex items-center gap-5">
              <a href="#" className="text-[11px] text-white/25 hover:text-white/50 transition-colors">Privacidade</a>
              <a href="#" className="text-[11px] text-white/25 hover:text-white/50 transition-colors">Termos de Uso</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
