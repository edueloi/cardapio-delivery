import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Eye, EyeOff, ArrowRight, ChevronRight } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { resolvePostAuthPath } from "./authRedirect";
import LoadingScreen from "../../components/LoadingScreen";

const FEATURES = [
  { icon: "🍽️", label: "Cardápio Digital" },
  { icon: "🖥️", label: "PDV Integrado" },
  { icon: "👨‍🍳", label: "Monitor de Cozinha" },
  { icon: "📦", label: "Estoque & Insumos" },
  { icon: "📊", label: "Relatórios" },
  { icon: "💬", label: "WhatsApp Bot" },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();

  const [email, setEmail] = useState(() => localStorage.getItem("boxsys_remember_email") ?? "");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(() => !!localStorage.getItem("boxsys_remember_email"));
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const redirectRef = useRef<string | null>(null);

  const next = searchParams.get("next") || "/painel";

  function handleLoadingComplete() {
    if (redirectRef.current) navigate(redirectRef.current, { replace: true });
  }

  useEffect(() => {
    if (showLoading && redirectRef.current) {
      const t = setTimeout(() => navigate(redirectRef.current!, { replace: true }), 2400);
      return () => clearTimeout(t);
    }
  }, [showLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const payload = await login(email.trim(), password);
      if (remember) {
        localStorage.setItem("boxsys_remember_email", email.trim());
      } else {
        localStorage.removeItem("boxsys_remember_email");
      }
      redirectRef.current = resolvePostAuthPath(next, payload.tenants);
      setShowLoading(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "E-mail ou senha incorretos.");
      setSubmitting(false);
    }
  };

  return (
    <>
      {showLoading && (
        <LoadingScreen
          durationMs={1800}
          badgeText="Acesso Liberado"
          statusText="Entrando"
          description="Suas permissões foram carregadas. Estamos abrindo o painel com segurança."
          onComplete={handleLoadingComplete}
        />
      )}

      <div className="min-h-screen flex flex-col lg:flex-row">

        {/* ── ESQUERDA — branding escuro ── */}
        <div className="hidden lg:flex flex-col w-[52%] shrink-0 bg-[#0A1628] relative overflow-hidden">
          {/* Glow decorativo */}
          <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-[#C9A227]/10 blur-[120px] pointer-events-none" />
          <div className="absolute -bottom-32 -right-32 w-[400px] h-[400px] rounded-full bg-blue-900/30 blur-[100px] pointer-events-none" />
          {/* Grid sutil */}
          <div className="absolute inset-0 opacity-[0.03] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:56px_56px]" />

          <div className="relative z-10 flex flex-col h-full px-14 py-14">
            {/* Logo — fundo branco pill para o png ficar legível */}
            <div className="self-start">
              <div className="bg-white rounded-2xl px-5 py-3 shadow-lg shadow-black/30">
                <img src="/images/menu-flow-continue.png" alt="BoxSys" className="h-10 object-contain" />
              </div>
            </div>

            {/* Headline central */}
            <div className="flex-1 flex flex-col justify-center gap-8 mt-10">
              <div className="space-y-4">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.3em] text-[#C9A227] bg-[#C9A227]/10 border border-[#C9A227]/20 rounded-full px-3 py-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#C9A227] animate-pulse" />
                  Painel Administrativo
                </span>
                <h1 className="text-[2.6rem] xl:text-[3.2rem] font-black text-white leading-[1.05] tracking-tight">
                  Seu negócio<br />
                  <span className="text-[#C9A227]">na palma</span><br />
                  <span className="text-white/50">da mão</span>
                </h1>
                <p className="text-white/35 text-sm leading-relaxed max-w-[300px]">
                  Cardápio digital, PDV, cozinha, estoque e relatórios — tudo em um só lugar.
                </p>
              </div>

              {/* Feature pills */}
              <div className="flex flex-wrap gap-2 max-w-[340px]">
                {FEATURES.map((f) => (
                  <div
                    key={f.label}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-colors"
                  >
                    <span className="text-sm">{f.icon}</span>
                    <span className="text-white/50 text-[11px] font-semibold">{f.label}</span>
                  </div>
                ))}
              </div>

              {/* Stat cards */}
              <div className="flex gap-4 max-w-[340px]">
                {[
                  { value: "100%", label: "Online" },
                  { value: "24/7", label: "Suporte" },
                  { value: "∞", label: "Pedidos" },
                ].map((s) => (
                  <div key={s.label} className="flex-1 bg-white/[0.04] border border-white/[0.07] rounded-2xl px-4 py-3 text-center">
                    <p className="text-[#C9A227] font-black text-lg">{s.value}</p>
                    <p className="text-white/30 text-[10px] font-medium mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-white/15 text-[11px]">© 2025 BoxSys · Sistema de Gestão para Restaurantes</p>
          </div>
        </div>

        {/* ── DIREITA — formulário branco ── */}
        <div className="flex-1 flex flex-col bg-white min-h-screen">

          {/* Header mobile */}
          <div className="lg:hidden flex items-center justify-between px-6 pt-8 pb-2">
            <div className="bg-[#0A1628] rounded-xl px-4 py-2">
              <img src="/images/menu-flow-continue.png" alt="BoxSys" className="h-8 object-contain brightness-0 invert" />
            </div>
          </div>

          {/* Formulário centralizado */}
          <div className="flex-1 flex items-center justify-center px-6 sm:px-10 py-10">
            <div className="w-full max-w-[400px]">

              {/* Topo do form */}
              <div className="mb-8 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#C9A227]">
                  Bem-vindo de volta
                </p>
                <h2 className="text-3xl font-black text-[#0A1628] tracking-tight leading-tight">
                  Faça seu login
                </h2>
                <p className="text-slate-400 text-sm">
                  Entre com suas credenciais para acessar o painel.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* E-mail */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-black uppercase tracking-[0.15em] text-slate-400">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seuemail@dominio.com"
                    autoComplete="email"
                    required
                    className="w-full h-12 px-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder:text-slate-300 text-sm focus:outline-none focus:border-[#C9A227] focus:bg-white focus:ring-2 focus:ring-[#C9A227]/15 transition-all"
                  />
                </div>

                {/* Senha */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-black uppercase tracking-[0.15em] text-slate-400">
                      Senha
                    </label>
                    <Link
                      to="/esqueci-senha"
                      className="text-[11px] text-[#C9A227] hover:text-[#b8911f] font-semibold transition-colors flex items-center gap-0.5"
                    >
                      Esqueci a senha <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Sua senha"
                      autoComplete="current-password"
                      required
                      className="w-full h-12 px-4 pr-11 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder:text-slate-300 text-sm focus:outline-none focus:border-[#C9A227] focus:bg-white focus:ring-2 focus:ring-[#C9A227]/15 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Erro */}
                {error && (
                  <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-50 border border-red-100">
                    <div className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                    <p className="text-red-500 text-sm font-medium">{error}</p>
                  </div>
                )}

                {/* Lembrar-me */}
                <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                  <div
                    className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition-all ${
                      remember
                        ? "bg-[#C9A227] border-[#C9A227]"
                        : "bg-white border-slate-200 group-hover:border-[#C9A227]/50"
                    }`}
                    onClick={() => setRemember((v) => !v)}
                  >
                    {remember && (
                      <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 fill-none stroke-white stroke-[1.8]">
                        <path d="M1 4l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span
                    className="text-xs text-slate-400 group-hover:text-slate-600 transition-colors font-medium"
                    onClick={() => setRemember((v) => !v)}
                  >
                    Lembrar meu e-mail
                  </span>
                </label>

                {/* Botão */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-12 mt-1 rounded-xl bg-[#0A1628] hover:bg-[#111f3a] active:scale-[0.98] text-white font-black text-sm tracking-wide shadow-lg shadow-[#0A1628]/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                >
                  {submitting ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                      Entrando...
                    </>
                  ) : (
                    <>
                      Entrar no Painel
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </button>
              </form>

              {/* Footer */}
              <p className="text-center text-[11px] text-slate-300 mt-10">
                © 2025 BoxSys · Sistema de Gestão para Restaurantes
              </p>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
