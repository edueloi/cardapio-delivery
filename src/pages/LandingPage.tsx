import React from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock3,
  LayoutDashboard,
  MessageCircle,
  QrCode,
  ShoppingBag,
  Sparkles,
  Zap,
  Menu as MenuIcon,
  X
} from 'lucide-react';
import { Link } from 'react-router-dom';

const LandingPage: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const features = [
    {
      icon: <QrCode className="w-6 h-6" />,
      title: 'Cardápio por QR Code',
      desc: 'O cliente acessa o cardápio direto pelo celular, sem espera e sem papel.'
    },
    {
      icon: <Bot className="w-6 h-6" />,
      title: 'Bot de atendimento',
      desc: 'Automatize respostas, pedidos e atendimento via WhatsApp.'
    },
    {
      icon: <LayoutDashboard className="w-6 h-6" />,
      title: 'Painel operacional',
      desc: 'Pedidos, caixa, estoque e operação em tempo real em um só lugar.'
    },
    {
      icon: <Clock3 className="w-6 h-6" />,
      title: 'Fila inteligente',
      desc: 'Organize pedidos em preparo, prontos e entregues com mais agilidade.'
    }
  ];

  const benefits = [
    'Cardápio digital moderno e atualizado em tempo real',
    'Pedidos por mesa, balcão, retirada e delivery',
    'Controle de estoque e financeiro integrado',
    'WhatsApp conectado para automatizar atendimento',
    'Painel TV para cozinha e retirada de pedidos',
    'Sistema em nuvem com acesso de qualquer lugar'
  ];

  return (
    <div className="min-h-screen bg-[#F4F6F8] text-[#001D3D] font-sans selection:bg-[#D49E00]/30 selection:text-[#001D3D] overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/10 bg-[#050B18]/88 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-11 h-11 rounded-2xl bg-white border border-white/10 flex items-center justify-center shadow-lg shadow-black/20 group-hover:border-[#D49E00]/50 transition-all">
              <img
                src="/images/favicon-menu-flow.png"
                alt="MenuFlow"
                className="w-8 h-8 object-contain"
              />
            </div>

            <div className="leading-none">
              <div className="text-2xl font-black tracking-tighter">
                <span className="text-white">Menu</span>
                <span className="text-[#D49E00]">Flow</span>
              </div>
              <div className="text-[9px] uppercase tracking-[0.32em] text-white/45 font-black mt-1">
                Cardápios & Bots
              </div>
            </div>
          </Link>

          <div className="hidden lg:flex items-center gap-8">
            <a href="#recursos" className="text-xs font-black uppercase tracking-[0.22em] text-white/60 hover:text-white transition-colors">
              Recursos
            </a>
            <a href="#operacao" className="text-xs font-black uppercase tracking-[0.22em] text-white/60 hover:text-white transition-colors">
              Operação
            </a>
            <a href="#vantagens" className="text-xs font-black uppercase tracking-[0.22em] text-white/60 hover:text-white transition-colors">
              Vantagens
            </a>
          </div>

          <div className="hidden sm:flex items-center gap-3">
            <Link
              to="/login"
              className="group bg-white text-[#001D3D] px-5 md:px-7 py-3 rounded-full text-xs font-black uppercase tracking-widest hover:bg-[#D49E00] transition-all flex items-center shadow-xl shadow-black/20"
            >
              Acesso dono
              <ChevronRight className="w-4 h-4 ml-1.5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="sm:hidden w-11 h-11 rounded-2xl bg-white/7 border border-white/10 flex items-center justify-center text-white"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-white/10 bg-[#050B18] px-4 py-5 space-y-3">
            <a href="#recursos" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-black uppercase tracking-widest text-white/70">
              Recursos
            </a>
            <a href="#operacao" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-black uppercase tracking-widest text-white/70">
              Operação
            </a>
            <a href="#vantagens" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-black uppercase tracking-widest text-white/70">
              Vantagens
            </a>
            <Link
              to="/login"
              className="mt-4 flex items-center justify-center bg-[#D49E00] text-[#001D3D] px-5 py-4 rounded-2xl text-sm font-black uppercase tracking-widest"
            >
              Acesso dono
            </Link>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative bg-[#050B18] text-white pt-28 sm:pt-32 lg:pt-36 pb-20 sm:pb-24 lg:pb-28 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(212,158,0,0.16),transparent_34%),radial-gradient(circle_at_85%_20%,rgba(0,76,150,0.35),transparent_38%),linear-gradient(135deg,#050B18_0%,#071326_55%,#02152A_100%)]" />
          <div className="absolute inset-0 opacity-[0.08] bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:72px_72px]" />
          <div className="absolute -bottom-32 left-0 right-0 h-64 bg-gradient-to-t from-[#050B18] to-transparent" />
        </div>

        <div className="relative max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[0.92fr_1.08fr] gap-12 lg:gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="text-center lg:text-left"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/7 border border-white/10 text-[#D49E00] mb-7 shadow-lg shadow-black/10 max-w-full">
              <Sparkles className="w-4 h-4 shrink-0" />
              <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.25em]">
                Tecnologia Develoi para restaurantes
              </span>
            </div>

            <h1 className="text-[46px] sm:text-6xl md:text-7xl xl:text-[88px] font-black tracking-[-0.075em] leading-[0.9]">
              Transforme seu
              <br className="hidden sm:block" />
              <span className="text-[#D49E00]"> cardápio </span>
              em uma máquina de vendas.
            </h1>

            <p className="mt-7 max-w-2xl mx-auto lg:mx-0 text-base sm:text-lg md:text-xl text-white/68 leading-relaxed">
              O MenuFlow une cardápio digital, bots inteligentes, painel de pedidos,
              controle de estoque e operação em tempo real para restaurantes, lanchonetes,
              pastelarias, hamburguerias e delivery.
            </p>

            <div className="mt-9 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link
                to="/login"
                className="group inline-flex items-center justify-center bg-[#D49E00] text-[#001D3D] px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl font-black text-sm sm:text-base hover:scale-[1.02] hover:shadow-2xl hover:shadow-[#D49E00]/25 transition-all whitespace-nowrap"
              >
                Modernizar agora
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>

              <a
                href="#recursos"
                className="inline-flex items-center justify-center px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl font-black text-sm sm:text-base border border-white/12 bg-white/5 hover:bg-white/10 transition-all whitespace-nowrap"
              >
                Ver recursos
              </a>
            </div>

            <div className="mt-11 grid grid-cols-3 gap-4 max-w-xl mx-auto lg:mx-0">
              {[
                ['100%', 'Digital'],
                ['Real-time', 'Sincronização'],
                ['Cloud', 'Acesso remoto']
              ].map(([number, label]) => (
                <div key={label} className="rounded-2xl bg-white/[0.04] border border-white/10 p-4">
                  <div className="text-xl md:text-2xl font-black text-white">{number}</div>
                  <div className="text-[9px] uppercase tracking-[0.16em] font-black text-white/40 mt-1">{label}</div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Mockup principal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.8 }}
            className="relative mx-auto w-full max-w-[680px]"
          >
            <div className="absolute -inset-8 bg-[#D49E00]/20 blur-[90px] rounded-full" />

            <div className="relative rounded-[28px] sm:rounded-[36px] p-2 sm:p-3 bg-white/10 border border-white/15 shadow-[0_40px_120px_rgba(0,0,0,0.45)] backdrop-blur-xl lg:rotate-1">
              <div className="rounded-[22px] sm:rounded-[28px] overflow-hidden bg-[#0B1424] border border-white/10 aspect-[16/10]">
                <img
                  src="/images/mockup-site-menuflow.png"
                  alt="Painel MenuFlow"
                  className="w-full h-full object-cover object-center"
                />
              </div>
            </div>

            <div className="absolute -left-2 sm:-left-6 top-8 sm:top-12 rounded-2xl sm:rounded-3xl bg-[#08152A]/95 border border-white/10 p-3 sm:p-4 shadow-2xl backdrop-blur-xl">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-[#D49E00] text-[#001D3D] flex items-center justify-center mb-2">
                <QrCode className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-white/80">
                QR Code
              </p>
            </div>

            <div className="absolute -right-2 sm:-right-6 bottom-8 sm:bottom-14 rounded-2xl sm:rounded-3xl bg-[#08152A]/95 border border-white/10 p-3 sm:p-4 shadow-2xl backdrop-blur-xl">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-green-500 text-white flex items-center justify-center mb-2">
                <MessageCircle className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <p className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-white/80">
                WhatsApp
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Recursos */}
      <section id="recursos" className="relative bg-[#F4F6F8] text-[#001D3D] px-4 sm:px-6 lg:px-8 py-20 sm:py-24">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <div className="text-[#D49E00] text-[11px] uppercase tracking-[0.35em] font-black mb-4">
              Recursos principais
            </div>
            <h2 className="text-4xl md:text-6xl font-black tracking-[-0.06em] leading-[0.95]">
              Tudo para sua operação fluir.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 26 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ delay: index * 0.06 }}
                whileHover={{ y: -8 }}
                className="group rounded-[30px] bg-white border border-[#001D3D]/6 p-7 shadow-[0_20px_60px_rgba(0,29,61,0.08)] hover:shadow-[0_24px_80px_rgba(0,29,61,0.14)] transition-all"
              >
                <div className="w-14 h-14 rounded-2xl bg-[#D49E00]/12 text-[#D49E00] border border-[#D49E00]/20 flex items-center justify-center mb-6 group-hover:bg-[#D49E00] group-hover:text-[#001D3D] transition-all">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-black tracking-tight mb-3">{feature.title}</h3>
                <p className="text-sm text-[#001D3D]/58 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Operação */}
      <section id="operacao" className="relative bg-[#F4F6F8] text-[#001D3D] py-20 sm:py-28 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute top-0 right-0 w-[760px] h-[760px] bg-[#D49E00]/10 blur-[120px] rounded-full translate-x-1/3 -translate-y-1/2" />

        <div className="relative max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[0.85fr_1.15fr] gap-16 items-center">
          <div>
            <div className="text-[#D49E00] text-[11px] uppercase tracking-[0.35em] font-black mb-5">
              Tecnologia com propósito
            </div>

            <h2 className="text-4xl md:text-6xl font-black tracking-[-0.06em] leading-[0.95] mb-7">
              Sua operação mais
              <br />
              <span className="text-[#D49E00]">inteligente.</span>
            </h2>

            <p className="text-lg text-[#001D3D]/60 leading-relaxed mb-9">
              Organize pedidos, reduza erros, acompanhe a cozinha e facilite a vida
              de quem atende, produz e gerencia o negócio.
            </p>

            <div className="space-y-5">
              {benefits.slice(0, 4).map((item) => (
                <div key={item} className="flex items-start gap-4">
                  <div className="w-7 h-7 rounded-full bg-[#D49E00]/12 border border-[#D49E00]/30 text-[#D49E00] flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="font-bold text-[#001D3D]/86">{item}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative pb-12">
            <div className="absolute -inset-8 bg-[#001D3D]/8 blur-[80px] rounded-full" />

            <div className="relative rounded-[32px] sm:rounded-[40px] bg-white p-3 sm:p-5 shadow-[0_36px_100px_rgba(0,29,61,0.18)] border border-[#001D3D]/5 overflow-hidden">
              <div className="absolute top-0 right-0 w-44 h-44 bg-[#D49E00]/10 rounded-full blur-3xl" />
              <div className="relative rounded-[24px] sm:rounded-[28px] overflow-hidden aspect-[16/10]">
                <img
                  src="/images/mockup-site-menuflow.png"
                  alt="MenuFlow Operação"
                  className="w-full h-full object-cover object-center"
                />
              </div>
            </div>

            <div className="absolute -bottom-2 sm:-bottom-6 left-4 right-4 sm:left-8 sm:right-8 rounded-[24px] sm:rounded-[28px] bg-[#001D3D] text-white p-4 sm:p-5 shadow-2xl border border-white/10">
              <div className="grid grid-cols-3 gap-3 sm:gap-4 text-center">
                <div>
                  <div className="text-[#D49E00] font-black text-2xl sm:text-3xl">1</div>
                  <div className="text-[8px] sm:text-[10px] uppercase tracking-widest text-white/45 font-black">Aguardando</div>
                </div>
                <div>
                  <div className="text-orange-400 font-black text-2xl sm:text-3xl">0</div>
                  <div className="text-[8px] sm:text-[10px] uppercase tracking-widest text-white/45 font-black">Em preparo</div>
                </div>
                <div>
                  <div className="text-green-400 font-black text-2xl sm:text-3xl">6</div>
                  <div className="text-[8px] sm:text-[10px] uppercase tracking-widest text-white/45 font-black">Entregues</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Vantagens */}
      <section id="vantagens" className="relative bg-[#F4F6F8] text-[#001D3D] py-20 sm:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="rounded-[32px] sm:rounded-[42px] bg-[#001D3D] text-white overflow-hidden shadow-[0_40px_120px_rgba(0,29,61,0.28)]">
            <div className="grid grid-cols-1 lg:grid-cols-2">
              <div className="p-7 sm:p-10 md:p-14">
                <div className="inline-flex items-center gap-2 bg-white/8 border border-white/10 rounded-full px-4 py-2 text-[#D49E00] mb-7">
                  <Zap className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-[0.22em]">
                    Automação e controle
                  </span>
                </div>

                <h2 className="text-4xl md:text-6xl font-black tracking-[-0.06em] leading-[0.95] mb-7">
                  Mais agilidade.
                  <br />
                  Mais controle.
                  <br />
                  <span className="text-[#D49E00]">Mais vendas.</span>
                </h2>

                <p className="text-white/62 text-lg leading-relaxed mb-9">
                  Um sistema pensado para pequenos e médios negócios que querem sair
                  do improviso e ter uma operação mais profissional.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {benefits.map((item) => (
                    <div key={item} className="flex gap-3 items-start rounded-2xl bg-white/[0.05] border border-white/10 p-4">
                      <CheckCircle2 className="w-5 h-5 text-[#D49E00] shrink-0 mt-0.5" />
                      <span className="text-sm text-white/78 font-medium leading-relaxed">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative min-h-[460px] sm:min-h-[520px] bg-[radial-gradient(circle_at_center,rgba(212,158,0,0.18),transparent_45%)] flex items-center justify-center p-5 sm:p-8">
                <div className="absolute inset-0 opacity-[0.08] bg-[linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] bg-[size:60px_60px]" />

                <div className="relative w-full max-w-md rounded-[28px] sm:rounded-[34px] bg-white/[0.08] border border-white/10 p-4 sm:p-5 backdrop-blur-xl shadow-2xl">
                  <div className="flex items-center justify-between mb-5 gap-4">
                    <div>
                      <div className="text-[10px] sm:text-xs uppercase tracking-[0.25em] text-white/40 font-black">Painel TV</div>
                      <div className="text-xl sm:text-2xl font-black mt-1">Pedidos ao vivo</div>
                    </div>
                    <div className="rounded-2xl bg-white/10 px-4 py-3 text-xl sm:text-2xl font-black">14:58</div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-3xl bg-orange-500/10 border border-orange-500/20 p-4 sm:p-5">
                      <div className="flex items-center gap-2 text-orange-400 font-black uppercase mb-5">
                        <Clock3 className="w-5 h-5" />
                        Em preparo
                      </div>

                      {['#521 X-Bacon', '#522 Pastel de Carne', '#523 Suco Natural'].map((order) => (
                        <div key={order} className="rounded-2xl bg-black/20 border border-white/8 p-3 mb-3">
                          <div className="font-black text-sm">{order}</div>
                          <div className="h-1.5 rounded-full bg-orange-400/80 mt-3 w-3/4" />
                        </div>
                      ))}
                    </div>

                    <div className="rounded-3xl bg-green-500/10 border border-green-500/20 p-4 sm:p-5">
                      <div className="flex items-center gap-2 text-green-400 font-black uppercase mb-5">
                        <CheckCircle2 className="w-5 h-5" />
                        Pronto
                      </div>

                      {['#519 Combo Completo', '#520 Batata Especial', '#518 Refrigerante'].map((order) => (
                        <div key={order} className="rounded-2xl bg-black/20 border border-white/8 p-3 mb-3">
                          <div className="font-black text-sm">{order}</div>
                          <div className="text-green-400 text-xs font-bold mt-2">Retire no balcão</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl bg-[#D49E00] text-[#001D3D] p-4 flex items-center gap-3 font-black">
                    <Bot className="w-6 h-6" />
                    Bot conectado e operação fluindo.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="relative bg-[#F4F6F8] text-[#001D3D] px-4 sm:px-6 lg:px-8 pb-20 sm:pb-24">
        <div className="max-w-5xl mx-auto text-center rounded-[32px] sm:rounded-[42px] bg-white border border-[#001D3D]/5 shadow-[0_30px_90px_rgba(0,29,61,0.12)] p-7 sm:p-10 md:p-16">
          <div className="mx-auto w-16 h-16 rounded-3xl bg-[#001D3D] text-[#D49E00] flex items-center justify-center mb-7">
            <ShoppingBag className="w-8 h-8" />
          </div>

          <h2 className="text-4xl md:text-6xl font-black tracking-[-0.06em] leading-[0.95] mb-6">
            Seu restaurante pronto para vender melhor.
          </h2>

          <p className="max-w-2xl mx-auto text-lg text-[#001D3D]/60 leading-relaxed mb-9">
            Comece com uma estrutura simples, moderna e profissional para atender melhor,
            organizar pedidos e ganhar mais tempo no dia a dia.
          </p>

          <Link
            to="/login"
            className="group inline-flex items-center justify-center bg-[#001D3D] text-white px-8 sm:px-10 py-3.5 sm:py-4 rounded-xl font-black text-sm sm:text-base hover:scale-[1.02] hover:shadow-2xl hover:shadow-[#001D3D]/25 transition-all whitespace-nowrap"
          >
            Acessar agora
            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Link>

          <div className="mt-14 pt-10 border-t border-[#001D3D]/8 flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
            <img src="/images/develoi.png" alt="Develoi" className="h-9 object-contain opacity-80" />
            <div className="text-[10px] uppercase tracking-[0.22em] font-black text-[#001D3D]/40">
              © 2026 MenuFlow | Cardápios & Bots by Develoi
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;