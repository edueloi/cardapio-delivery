import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Eye, EyeOff, ArrowRight } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { resolvePostAuthPath } from "./authRedirect";
import LoadingScreen from "../../components/LoadingScreen";

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();

  const [email, setEmail]       = useState(() => localStorage.getItem("boxsys_remember_email") ?? "");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(() => !!localStorage.getItem("boxsys_remember_email"));
  const [error, setError]       = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showLoading, setShowLoading]   = useState(false);
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
      if (remember) localStorage.setItem("boxsys_remember_email", email.trim());
      else          localStorage.removeItem("boxsys_remember_email");
      redirectRef.current = resolvePostAuthPath(next, payload.tenants, (payload.account as any).isSuperAdmin);
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

      <div className="h-screen flex flex-col lg:flex-row overflow-hidden">

        {/* ══ ESQUERDA — branding ══ */}
        <div className="hidden lg:flex flex-col w-[55%] shrink-0 bg-[#071020] relative overflow-hidden">
          {/* glows */}
          <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-[#C9A227]/[0.08] blur-[140px] pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-blue-950/60 blur-[100px] pointer-events-none" />

          <div className="relative z-10 flex flex-col h-full px-16 py-10">
            {/* Logo solta, com glow sutil atrás — sem container branco */}
            <div className="self-start relative shrink-0">
              <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full scale-90" />
              <img src="/images/menu-flow-continue.png" alt="BoxSys" className="relative h-16 2xl:h-20 object-contain" />
            </div>

            {/* Headline */}
            <div className="flex-1 flex flex-col justify-center gap-8 min-h-0">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-[#C9A227] bg-[#C9A227]/10 border border-[#C9A227]/20 rounded-full px-3.5 py-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#C9A227] animate-pulse" />
                  Painel Administrativo
                </div>
                <h1 className="text-[2.3rem] 2xl:text-[3rem] font-black text-white leading-[1.05] tracking-tight">
                  Seu negócio<br />
                  <span className="text-[#C9A227]">na palma</span><br />
                  <span className="text-white/40">da mão</span>
                </h1>
                <p className="text-white/30 text-sm leading-relaxed max-w-[300px]">
                  Cardápio digital, PDV, cozinha, estoque e relatórios — tudo integrado em um só lugar.
                </p>
              </div>

              {/* Stats */}
              <div className="flex gap-3 max-w-[360px]">
                {[
                  { value: "100%", label: "Online" },
                  { value: "24/7", label: "Suporte" },
                  { value: "∞", label: "Pedidos" },
                ].map((s) => (
                  <div key={s.label} className="flex-1 bg-white/[0.04] border border-white/[0.07] rounded-2xl px-4 py-3 text-center">
                    <p className="text-[#C9A227] font-black text-xl">{s.value}</p>
                    <p className="text-white/25 text-[10px] font-medium mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-white/15 text-[11px] shrink-0">© 2026 BoxSys · Sistema de Gestão para Restaurantes</p>
          </div>
        </div>

        {/* ══ DIREITA — formulário branco ══ */}
        <div className="flex-1 flex flex-col bg-white h-screen overflow-y-auto lg:overflow-hidden">

          {/* Header mobile */}
          <div className="lg:hidden flex items-center justify-center pt-8 pb-2 shrink-0 bg-[#071020]">
            <div className="relative py-4">
              <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full scale-90" />
              <img src="/images/menu-flow-continue.png" alt="BoxSys" className="relative h-14 object-contain" />
            </div>
          </div>

          {/* Form */}
          <div className="flex-1 flex items-center justify-center px-6 sm:px-12 py-6 lg:py-10 min-h-0">
            <div className="w-full max-w-[420px]">

              <div className="mb-6 lg:mb-9">
                <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[#C9A227] mb-2">
                  Bem-vindo de volta
                </p>
                <h2 className="text-[1.75rem] lg:text-[2rem] font-black text-[#071020] tracking-tight leading-tight">
                  Faça seu login
                </h2>
                <p className="text-slate-400 text-sm mt-1.5">
                  Entre com suas credenciais para acessar o painel.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* E-mail */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seuemail@dominio.com"
                    autoComplete="email"
                    required
                    className="w-full h-13 px-4 py-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder:text-slate-300 text-sm focus:outline-none focus:border-[#C9A227] focus:bg-white focus:ring-2 focus:ring-[#C9A227]/15 transition-all"
                  />
                </div>

                {/* Senha */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                      Senha
                    </label>
                    <Link
                      to="/esqueci-senha"
                      className="text-[11px] text-[#C9A227] hover:text-[#b8911f] font-semibold transition-colors"
                    >
                      Esqueci a senha →
                    </Link>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      required
                      className="w-full h-13 px-4 py-3.5 pr-12 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder:text-slate-300 text-sm focus:outline-none focus:border-[#C9A227] focus:bg-white focus:ring-2 focus:ring-[#C9A227]/15 transition-all"
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

                {/* Manter conectado */}
                <button
                  type="button"
                  onClick={() => setRemember((v) => !v)}
                  className="flex items-center gap-3 w-full group"
                >
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${
                    remember ? "bg-[#C9A227] border-[#C9A227]" : "bg-white border-slate-200 group-hover:border-[#C9A227]/50"
                  }`}>
                    {remember && (
                      <svg viewBox="0 0 10 8" className="w-3 h-3 fill-none stroke-white stroke-[2]">
                        <path d="M1 4l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm text-slate-400 group-hover:text-slate-600 transition-colors font-medium">
                    Manter conectado
                  </span>
                </button>

                {/* Botão */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 mt-1 rounded-xl bg-[#071020] hover:bg-[#0f1f3d] active:scale-[0.98] text-white font-black text-sm tracking-wide shadow-lg shadow-[#071020]/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
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

              <p className="text-center text-[11px] text-slate-300 mt-6 lg:mt-10">
                © 2026 BoxSys · Sistema de Gestão para Restaurantes
              </p>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
