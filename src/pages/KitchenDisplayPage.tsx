import { useState } from "react";
import { useParams } from "react-router-dom";
import { ChefHat, Lock, User } from "lucide-react";
import KitchenBoard from "./KitchenBoard";

function kitchenTokenKey(slug: string) {
  return `kitchen_token_${slug}`;
}
function kitchenStaffKey(slug: string) {
  return `kitchen_staff_${slug}`;
}

function KitchenLoginScreen({ slug, onLoggedIn }: { slug: string; onLoggedIn: (token: string, staffName: string | null) => void }) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/kitchen/${slug}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || undefined, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Não foi possível entrar.");
      onLoggedIn(data.token, data.staffName ?? null);
    } catch (err: any) {
      setError(err?.message || "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0D1B3E] flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="bg-black/20 border border-white/10 rounded-[2rem] p-8 w-full max-w-sm space-y-6">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-[#C9A227] flex items-center justify-center mx-auto">
            <ChefHat className="w-8 h-8 text-black" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white uppercase tracking-widest">Painel de Cozinha</h1>
            <p className="text-xs text-white/40 font-bold mt-1">Digite seu nome e senha para entrar</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-white/40 tracking-widest ml-1">Seu nome</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                autoFocus
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: João"
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-11 pr-4 text-white placeholder-white/20 focus:border-[#C9A227] outline-none text-sm font-bold"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-white/40 tracking-widest ml-1">Senha</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-11 pr-4 text-white placeholder-white/20 focus:border-[#C9A227] outline-none text-center text-lg font-black tracking-widest"
              />
            </div>
          </div>
          {error && <p className="text-xs text-red-400 font-bold text-center">{error}</p>}
        </div>
        <button
          type="submit"
          disabled={loading || !password}
          className="w-full bg-[#C9A227] hover:bg-[#E8B93A] disabled:opacity-40 text-black font-black py-3.5 rounded-2xl text-xs uppercase tracking-widest transition-all"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
        <p className="text-[10px] text-white/25 text-center leading-relaxed">
          Sem usuário cadastrado? Deixe o nome em branco e use a senha geral da cozinha.
        </p>
      </form>
    </div>
  );
}

export default function KitchenDisplayPage() {
  const { slug } = useParams<{ slug: string }>();
  const [token, setToken] = useState<string | null>(() => (slug ? window.localStorage.getItem(kitchenTokenKey(slug)) : null));
  const [staffName, setStaffName] = useState<string | null>(() => (slug ? window.localStorage.getItem(kitchenStaffKey(slug)) : null));

  if (!slug) return null;

  const handleLoggedIn = (newToken: string, name: string | null) => {
    window.localStorage.setItem(kitchenTokenKey(slug), newToken);
    if (name) window.localStorage.setItem(kitchenStaffKey(slug), name);
    else window.localStorage.removeItem(kitchenStaffKey(slug));
    setToken(newToken);
    setStaffName(name);
  };

  const handleLogout = () => {
    fetch(`/api/kitchen/${slug}/logout`, { method: "POST", headers: { "X-Kitchen-Token": token || "" } }).catch(() => {});
    window.localStorage.removeItem(kitchenTokenKey(slug));
    window.localStorage.removeItem(kitchenStaffKey(slug));
    setToken(null);
    setStaffName(null);
  };

  if (!token) {
    return <KitchenLoginScreen slug={slug} onLoggedIn={handleLoggedIn} />;
  }

  return (
    <KitchenBoard
      apiBase={`/api/kitchen/${slug}`}
      token={token}
      staffName={staffName}
      onAuthExpired={handleLogout}
      onLogout={handleLogout}
    />
  );
}
