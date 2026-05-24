import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Eye, EyeOff, Lock, Mail, ShieldCheck } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { resolvePostAuthPath } from "./authRedirect";
import LoadingScreen from "../../components/LoadingScreen";

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

  // Navigate only after the loading screen finishes its animation
  function handleLoadingComplete() {
    if (redirectRef.current) {
      navigate(redirectRef.current, { replace: true });
    }
  }

  useEffect(() => {
    if (showLoading && redirectRef.current) {
      // safety fallback — if onComplete never fires (e.g. unmount race), navigate anyway
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
      {/* Loading overlay — rendered at root level so route change doesn't kill it */}
      {showLoading && (
        <LoadingScreen
          durationMs={1800}
          badgeText="Acesso Liberado"
          statusText="Entrando"
          description="Suas permissões foram carregadas. Estamos abrindo o painel com segurança."
          onComplete={handleLoadingComplete}
        />
      )}

      <div className="min-h-screen flex bg-[#080F1E]">
        {/* ── Lado esquerdo — branding ── */}
        <div className="hidden lg:flex flex-col justify-between w-[46%] relative overflow-hidden px-14 py-12 shrink-0">
          {/* Background glow blobs */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(201,162,39,0.18),_transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(13,27,62,0.8),_transparent_60%)]" />
          {/* Grid overlay */}
          <div className="absolute inset-0 opacity-[0.04] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:48px_48px]" />

          {/* Logo */}
          <div className="relative z-10">
            <img src="/images/logo.png" alt="BoxSys" className="h-10 object-contain" />
          </div>

          {/* Center content */}
          <div className="relative z-10 flex flex-col gap-8">
            <div>
              <p className="text-[#C9A227] text-xs font-black uppercase tracking-[0.3em] mb-3">
                Painel Administrativo
              </p>
              <h1 className="text-4xl xl:text-5xl font-black text-white leading-[1.1] tracking-tight">
                Gerencie seu<br />
                <span className="text-[#C9A227]">negócio</span>{" "}
                <span className="text-white/60">com</span><br />
                inteligência
              </h1>
            </div>

            <p className="text-white/40 text-sm leading-relaxed max-w-xs">
              Cardápio digital, PDV, cozinha, estoque, relatórios e muito mais — tudo integrado em um único painel.
            </p>

            {/* Feature grid */}
            <div className="grid grid-cols-2 gap-3 max-w-xs">
              {[
                "Cardápio digital",
                "PDV integrado",
                "Monitor de cozinha",
                "Relatórios",
                "Estoque e insumos",
                "WhatsApp Bot",
              ].map((f) => (
                <div
                  key={f}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.07]"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#C9A227] shrink-0" />
                  <span className="text-white/50 text-[11px] font-medium">{f}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom tagline */}
          <div className="relative z-10">
            <p className="text-white/20 text-xs">© 2025 BoxSys · Sistema de Gestão para Restaurantes</p>
          </div>
        </div>

        {/* ── Divisor vertical ── */}
        <div className="hidden lg:block w-px bg-white/[0.05] my-0" />

        {/* ── Lado direito — formulário ── */}
        <div className="flex-1 flex items-center justify-center px-5 py-10 sm:px-10 min-h-screen">
          <div className="w-full max-w-[400px]">

            {/* Logo mobile */}
            <div className="lg:hidden flex flex-col items-center mb-10">
              <img src="/images/logo.png" alt="BoxSys" className="h-12 object-contain" />
              <p className="text-white/30 text-[11px] font-bold tracking-[0.25em] uppercase mt-3">
                Painel Administrativo
              </p>
            </div>

            {/* Header */}
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#C9A227]/10 border border-[#C9A227]/20 mb-5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#C9A227]" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#C9A227]">Acesso Seguro</span>
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">Bem-vindo de volta</h2>
              <p className="text-white/35 text-sm mt-1">Entre com suas credenciais para acessar o painel.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* E-mail */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-2">
                  E-mail
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seuemail@dominio.com"
                    autoComplete="email"
                    required
                    className="w-full h-12 pl-10 pr-4 rounded-xl bg-white/[0.06] border border-white/[0.10] text-white placeholder:text-white/25 text-sm focus:outline-none focus:border-[#C9A227]/60 focus:bg-white/[0.08] focus:ring-2 focus:ring-[#C9A227]/15 transition-all"
                  />
                </div>
              </div>

              {/* Senha */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                    Senha
                  </label>
                  <Link
                    to="/esqueci-senha"
                    className="text-[10px] text-white/30 hover:text-[#C9A227] transition-colors font-medium"
                  >
                    Esqueci minha senha
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25 pointer-events-none" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Sua senha"
                    autoComplete="current-password"
                    required
                    className="w-full h-12 pl-10 pr-11 rounded-xl bg-white/[0.06] border border-white/[0.10] text-white placeholder:text-white/25 text-sm focus:outline-none focus:border-[#C9A227]/60 focus:bg-white/[0.08] focus:ring-2 focus:ring-[#C9A227]/15 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Erro */}
              {error && (
                <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {/* Lembrar-me */}
              <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                <div
                  className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition-all ${
                    remember
                      ? "bg-[#C9A227] border-[#C9A227]"
                      : "bg-transparent border-white/20 group-hover:border-white/40"
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
                  className="text-xs text-white/40 group-hover:text-white/60 transition-colors"
                  onClick={() => setRemember((v) => !v)}
                >
                  Lembrar meu e-mail
                </span>
              </label>

              {/* Botão */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full h-12 mt-2 rounded-xl bg-[#C9A227] hover:bg-[#d4ab2b] active:scale-[0.98] text-white font-black text-sm tracking-wide shadow-lg shadow-[#C9A227]/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                  "Entrar no Painel"
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
