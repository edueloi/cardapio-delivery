import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { Button, Input } from "../../components";
import LoadingScreen from "../../components/LoadingScreen";
import { useAuth } from "../../lib/auth";
import { resolvePostAuthPath } from "./authRedirect";

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);

  const next = searchParams.get("next") || "/painel";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const payload = await login(email, password);
      setRedirectPath(resolvePostAuthPath(next, payload.tenants));
    } catch (err: any) {
      setError(err?.message || "Falha ao entrar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row relative overflow-hidden bg-[#0D1B3E]">
      {redirectPath && (
        <LoadingScreen
          durationMs={1800}
          badgeText="Acesso Liberado"
          statusText="Entrando"
          description="Suas permissões foram carregadas. Estamos abrindo o painel com segurança."
          onComplete={() => navigate(redirectPath, { replace: true })}
        />
      )}

      {/* Lado esquerdo — branding */}
      <div className="hidden md:flex flex-col justify-center items-center w-[48%] relative px-16 shrink-0">
        {/* Blobs decorativos */}
        <div className="absolute top-[-15%] left-[-15%] w-[55%] h-[55%] bg-[#C9A227]/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[45%] h-[45%] bg-white/4 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-[40%] left-[60%] w-[30%] h-[30%] bg-[#C9A227]/5 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center text-center gap-10">
          {/* Logo principal sem container quadrado */}
          <img
            src="/images/menuflow-logo.png"
            alt="MenuFlow"
            className="w-56 object-contain drop-shadow-2xl"
          />

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 text-white/20">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-[10px] tracking-[0.3em] uppercase font-medium">Painel Administrativo</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>
            <p className="text-white/30 text-sm leading-relaxed max-w-[240px]">
              Gerencie seu cardápio, pedidos e operação em um só lugar.
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-2 max-w-[260px]">
            {["Cardápio digital", "PDV", "Produção", "Relatórios"].map((f) => (
              <span
                key={f}
                className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/40 text-[11px] font-medium"
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Divider vertical */}
      <div className="hidden md:block w-px bg-white/[0.06] self-stretch my-12" />

      {/* Lado direito — formulário */}
      <div className="flex-1 flex items-center justify-center min-h-screen md:min-h-0 px-5 py-10 md:px-16">
        <div className="w-full max-w-sm md:max-w-[380px]">

          {/* Logo mobile */}
          <div className="flex flex-col items-center mb-10 md:hidden">
            <img
              src="/images/menuflow-logo.png"
              alt="MenuFlow"
              className="h-16 object-contain drop-shadow-xl"
            />
            <p className="text-white/30 text-[11px] font-semibold tracking-[0.2em] uppercase mt-4">
              Acesso Administrativo
            </p>
          </div>

          {/* Título desktop */}
          <div className="hidden md:block mb-8">
            <h1 className="text-2xl font-bold text-white tracking-tight">Bem-vindo de volta</h1>
            <p className="text-white/40 text-sm mt-1.5">Entre com suas credenciais para acessar o painel.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-2">
                E-mail
              </label>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                iconLeft={<Mail className="w-4 h-4" />}
                placeholder="seuemail@dominio.com"
                className="rounded-xl h-12"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-white/40 mb-2">
                Senha
              </label>
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                iconLeft={<Lock className="w-4 h-4" />}
                iconRight={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="text-white/30 hover:text-white/60 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
                placeholder="Sua senha"
                error={error || undefined}
                className="rounded-xl h-12"
              />
            </div>

            <div className="pt-1">
              <Button
                type="submit"
                fullWidth
                loading={loading}
                className="bg-[#C9A227] hover:bg-[#b8911f] text-white h-12 rounded-xl font-bold text-sm tracking-wide transition-all active:scale-[0.98] shadow-lg shadow-[#C9A227]/25"
              >
                Entrar no Painel
              </Button>
            </div>

            <div className="text-center pt-1">
              <Link
                to="/esqueci-senha"
                className="text-xs text-white/30 hover:text-[#C9A227] transition-colors"
              >
                Esqueci minha senha
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
