import { useState } from "react";
import { ChefHat, Lock, User, Store, Phone, CheckCircle2, Download, Eye, EyeOff } from "lucide-react";
import KitchenBoard from "./KitchenBoard";
import { Alert, Button, IconButton, Input, Tabs } from "../components";

const TOKEN_KEY = "kitchen_global_token";
const STAFF_KEY = "kitchen_global_staff";

const AUTH_TABS = [
  { id: "login", label: "Entrar", icon: Lock },
  { id: "request-access", label: "Solicitar acesso", icon: User },
] as const;
type AuthTab = (typeof AUTH_TABS)[number]["id"];

function AuthShell({
  tab, onTabChange, title, subtitle, children,
}: {
  tab: AuthTab;
  onTabChange: (t: AuthTab) => void;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-y-auto bg-slate-50 p-4">
      <div className="my-auto w-full max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-blue-100 bg-blue-50">
            <ChefHat className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-base font-medium text-slate-900 sm:text-lg">{title}</h1>
            <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
          </div>
        </div>
        <Tabs items={AUTH_TABS} value={tab} onChange={onTabChange} label="Acesso à cozinha">
          <div className="pt-4">{children}</div>
        </Tabs>
      </div>
    </div>
  );
}

function KitchenGlobalLoginScreen({
  onLoggedIn, onRequestAccess,
}: {
  onLoggedIn: (token: string, staffName: string | null) => void;
  onRequestAccess: () => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/kitchen/global/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
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
    <AuthShell
      tab="login"
      onTabChange={(t) => { if (t === "request-access") onRequestAccess(); }}
      title="Cozinha BoxSys"
      subtitle="Entre com seu usuário e senha"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-3">
          <Input
            label="Usuário"
            autoFocus
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Ex: joao.pizzaria"
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
        <Button type="submit" size="lg" fullWidth loading={loading} disabled={!username || !password}>
          Entrar
        </Button>
        <p className="text-center text-[11px] leading-relaxed text-slate-500">
          Ainda não tenho acesso — use a aba Solicitar acesso para pedir ao admin da loja.
        </p>
        <a
          href="/downloads/BoxSys-Cozinha.apk"
          download
          className="flex h-8 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-blue-500"
        >
          <Download size={14} />
          Baixar app para tablet/celular (Android)
        </a>
      </form>
    </AuthShell>
  );
}

function KitchenAccessRequestScreen({ onBack }: { onBack: () => void }) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [storeQuery, setStoreQuery] = useState("");
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState<{ matchedStore: string | null } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !username.trim() || !storeQuery.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/kitchen/global/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), username: username.trim(), storeQuery: storeQuery.trim(), contact: contact.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Não foi possível enviar o pedido.");
      setSent({ matchedStore: data.matchedStore ?? null });
    } catch (err: any) {
      setError(err?.message || "Não foi possível enviar o pedido.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="fixed inset-0 flex items-center justify-center overflow-y-auto bg-slate-50 p-4">
        <div className="my-auto w-full max-w-sm space-y-5 rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-base font-medium text-slate-900 sm:text-lg">Pedido enviado!</h1>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {sent.matchedStore
                ? <>Solicite ao admin de <strong>{sent.matchedStore}</strong> que aprove seu acesso em Configurações → Equipe da Cozinha.</>
                : "Não encontramos uma loja com esse nome automaticamente — avise o dono para conferir e aprovar manualmente."}
            </p>
          </div>
          <Button type="button" size="lg" fullWidth onClick={onBack}>
            Voltar ao login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <AuthShell
      tab="request-access"
      onTabChange={(t) => { if (t === "login") onBack(); }}
      title="Solicitar acesso"
      subtitle="O admin da sua loja vai aprovar e definir sua senha"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-3">
          <Input label="Seu nome" autoFocus type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: João" iconLeft={<User size={14} />} size="lg" />
          <Input label="Usuário desejado" type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Ex: joao.pizzaria" iconLeft={<User size={14} />} size="lg" />
          <Input label="Nome da loja" type="text" value={storeQuery} onChange={(e) => setStoreQuery(e.target.value)} placeholder="Ex: Pizzaria do Zé" iconLeft={<Store size={14} />} size="lg" />
          <Input label="Contato (opcional)" type="text" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="WhatsApp ou telefone" iconLeft={<Phone size={14} />} size="lg" />
          {error && <Alert variant="error">{error}</Alert>}
        </div>
        <Button type="submit" size="lg" fullWidth loading={loading} disabled={!name.trim() || !username.trim() || !storeQuery.trim()}>
          Enviar pedido
        </Button>
      </form>
    </AuthShell>
  );
}

export default function KitchenGlobalPage() {
  const [token, setToken] = useState<string | null>(() => window.localStorage.getItem(TOKEN_KEY));
  const [staffName, setStaffName] = useState<string | null>(() => window.localStorage.getItem(STAFF_KEY));
  const [screen, setScreen] = useState<"login" | "request-access">("login");

  const handleLoggedIn = (newToken: string, name: string | null) => {
    window.localStorage.setItem(TOKEN_KEY, newToken);
    if (name) window.localStorage.setItem(STAFF_KEY, name);
    else window.localStorage.removeItem(STAFF_KEY);
    setToken(newToken);
    setStaffName(name);
  };

  const handleLogout = () => {
    fetch("/api/kitchen/global/logout", { method: "POST", headers: { "X-Kitchen-Token": token || "" } }).catch(() => {});
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(STAFF_KEY);
    setToken(null);
    setStaffName(null);
  };

  if (!token) {
    if (screen === "request-access") {
      return <KitchenAccessRequestScreen onBack={() => setScreen("login")} />;
    }
    return <KitchenGlobalLoginScreen onLoggedIn={handleLoggedIn} onRequestAccess={() => setScreen("request-access")} />;
  }

  return (
    <KitchenBoard
      apiBase="/api/kitchen/global"
      token={token}
      staffName={staffName}
      onAuthExpired={handleLogout}
      onLogout={handleLogout}
    />
  );
}
