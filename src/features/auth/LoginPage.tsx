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
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-[28px] shadow-xl p-8 md:p-10">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-[#0D1B3E] text-[#C9A227] flex items-center justify-center">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-widest text-[#C9A227] leading-none mb-1">Cardápio Develoi</div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Acesso do Dono</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="E-mail"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            iconLeft={<Mail className="w-4 h-4" />}
            placeholder="seuemail@dominio.com"
          />
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
          />

          <Button type="submit" fullWidth loading={loading}>
            Entrar
          </Button>
        </form>

        <div className="mt-6 text-sm text-slate-500">
          Ainda não tem conta?{" "}
          <Link to={`/cadastro?next=${encodeURIComponent(next)}`} className="font-bold text-[#C9A227] hover:text-[#A8841C]">
            Criar acesso
          </Link>
        </div>
      </div>
    </div>
  );
}
