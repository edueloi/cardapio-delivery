import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Lock, Mail, Store } from "lucide-react";
import { Button, Input } from "../../components";
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

  const next = searchParams.get("next") || "/painel";

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const payload = await login(email, password);
      navigate(resolvePostAuthPath(next, payload.tenants), { replace: true });
    } catch (err: any) {
      setError(err?.message || "Falha ao entrar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex items-center justify-center relative overflow-hidden">
      {/* Elementos Decorativos de Fundo (Apenas Desktop) */}
      <div className="hidden md:block absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#001D3D]/5 rounded-full blur-3xl" />
      <div className="hidden md:block absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] bg-[#D49E00]/5 rounded-full blur-3xl" />

      <div className="w-full max-w-md min-h-screen md:min-h-fit flex flex-col relative z-10">
        <div className="flex-1 bg-white md:bg-white/80 md:backdrop-blur-xl md:border md:border-slate-100 md:rounded-[32px] md:shadow-2xl md:shadow-slate-200/50 p-6 md:p-10 flex flex-col justify-center">
          <div className="flex flex-col items-center mb-10 text-center">
            <div className="w-20 h-20 mb-4 drop-shadow-md">
              <img 
                src="/src/images/favicon-menu-flow.png" 
                alt="MenuFlow Logo" 
                className="w-full h-full object-contain"
              />
            </div>
            
            <div className="space-y-1">
              <div className="flex justify-center items-center text-4xl md:text-3xl font-black tracking-tighter">
                <span className="text-[#001D3D]">Menu</span>
                <span className="text-[#D49E00]">Flow</span>
              </div>
              <p className="text-slate-400 text-xs font-bold tracking-[0.2em] uppercase">Acesso Administrativo</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="E-mail"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              iconLeft={<Mail className="w-4 h-4" />}
              placeholder="seuemail@dominio.com"
              className="rounded-2xl h-14"
            />
            <div className="relative">
              <Input
                label="Senha"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                iconLeft={<Lock className="w-4 h-4" />}
                iconRight={
                  <button type="button" onClick={() => setShowPassword((v) => !v)} className="text-zinc-400 hover:text-zinc-600">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
                placeholder="Sua senha"
                error={error || undefined}
                className="rounded-2xl h-14"
              />
            </div>

            <Button 
              type="submit" 
              fullWidth 
              loading={loading}
              className="bg-[#001D3D] hover:bg-[#002D5D] text-white h-14 rounded-2xl font-bold text-lg transition-all active:scale-[0.98] shadow-lg shadow-[#001D3D]/20"
            >
              Entrar no Painel
            </Button>
          </form>

          <div className="mt-8 text-center">
            <div className="text-sm text-slate-400 mb-2">Ainda não tem conta?</div>
            <Link 
              to={`/cadastro?next=${encodeURIComponent(next)}`} 
              className="inline-block font-bold text-[#D49E00] hover:text-[#B38600] transition-colors"
            >
              Criar meu acesso agora
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
