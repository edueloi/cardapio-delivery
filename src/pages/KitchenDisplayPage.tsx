import { useState } from "react";
import { useParams } from "react-router-dom";
import { ChefHat, Lock, User, Eye, EyeOff } from "lucide-react";
import KitchenBoard from "./KitchenBoard";
import { Alert, Button, IconButton, Input } from "../components";

function kitchenTokenKey(slug: string) {
  return `kitchen_token_${slug}`;
}
function kitchenStaffKey(slug: string) {
  return `kitchen_staff_${slug}`;
}

function KitchenLoginScreen({ slug, onLoggedIn }: { slug: string; onLoggedIn: (token: string, staffName: string | null) => void }) {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="fixed inset-0 flex items-center justify-center bg-slate-50 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-blue-100 bg-blue-50">
            <ChefHat className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-base font-medium text-slate-900 sm:text-lg">Painel de Cozinha</h1>
            <p className="mt-0.5 text-xs text-slate-500">Digite seu nome e senha para entrar</p>
          </div>
        </div>

        <div className="space-y-3">
          <Input
            label="Seu nome"
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: João"
            iconLeft={<User size={14} />}
            size="lg"
          />
          <Input
            label="Senha"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••"
            iconLeft={<Lock size={14} />}
            iconRight={
              <IconButton
                type="button"
                variant="ghost"
                size="xs"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                onClick={() => setShowPassword((v) => !v)}
                className="border-transparent"
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </IconButton>
            }
            size="lg"
          />
          {error && <Alert variant="error">{error}</Alert>}
        </div>

        <Button type="submit" size="lg" fullWidth loading={loading} disabled={!password}>
          Entrar
        </Button>
        <p className="text-center text-[11px] leading-relaxed text-slate-500">
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
