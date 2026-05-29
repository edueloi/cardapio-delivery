import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, Eye, EyeOff, ArrowRight } from "lucide-react";
import { useAuth } from "../../lib/auth";
import LoadingScreen from "../../components/LoadingScreen";

const REAL_EMAIL = "edueloi.ee@gmail.com";

export default function AdminAccessPage() {
  const navigate = useNavigate();
  const { login, account } = useAuth();

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const redirectRef = useRef<string>("/superadmin");

  useEffect(() => {
    if ((account as any)?.isSuperAdmin) navigate("/superadmin", { replace: true });
  }, [account]);

  function handleLoadingComplete() {
    navigate(redirectRef.current, { replace: true });
  }

  useEffect(() => {
    if (showLoading) {
      const t = setTimeout(() => navigate(redirectRef.current, { replace: true }), 2400);
      return () => clearTimeout(t);
    }
  }, [showLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const payload = await login(REAL_EMAIL, password);
      if (!(payload.account as any).isSuperAdmin) {
        setError("Acesso negado.");
        setSubmitting(false);
        return;
      }
      setShowLoading(true);
    } catch {
      setError("Senha incorreta.");
      setSubmitting(false);
    }
  };

  return (
    <>
      {showLoading && (
        <LoadingScreen
          durationMs={1800}
          badgeText="Super Admin"
          statusText="Entrando"
          description="Autenticação de superadministrador concluída."
          onComplete={handleLoadingComplete}
        />
      )}

      <div className="min-h-screen bg-[#071020] flex items-center justify-center px-6">
        <div className="w-full max-w-sm">

          {/* Badge */}
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-[#C9A227]/10 border border-[#C9A227]/20 flex items-center justify-center">
              <ShieldCheck className="w-8 h-8 text-[#C9A227]" />
            </div>
          </div>

          <h1 className="text-2xl font-black text-white text-center mb-1">Acesso Administrativo</h1>
          <p className="text-white/30 text-sm text-center mb-8">Painel restrito — BoxSys</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Usuário — fixo, só visual */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-white/30">
                Usuário
              </label>
              <div className="w-full h-12 px-4 rounded-xl bg-white/5 border border-white/10 text-white/50 text-sm flex items-center select-none">
                Admin
              </div>
            </div>

            {/* Senha */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black uppercase tracking-[0.18em] text-white/30">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  autoFocus
                  autoComplete="current-password"
                  required
                  className="w-full h-12 px-4 pr-12 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-[#C9A227]/50 focus:ring-2 focus:ring-[#C9A227]/10 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Erro */}
            {error && (
              <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <p className="text-red-400 text-sm font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 mt-2 rounded-xl bg-[#C9A227] hover:bg-[#b8911f] active:scale-[0.98] text-[#071020] font-black text-sm tracking-wide shadow-lg shadow-[#C9A227]/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
            >
              {submitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Autenticando...
                </>
              ) : (
                <>
                  Entrar
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-[11px] text-white/15 mt-10">
            BoxSys · Acesso restrito
          </p>
        </div>
      </div>
    </>
  );
}
