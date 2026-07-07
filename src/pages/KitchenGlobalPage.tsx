import { useState } from "react";
import { ChefHat, Lock, User, Store, Phone, ArrowLeft, CheckCircle2, Download } from "lucide-react";
import KitchenBoard from "./KitchenBoard";

const TOKEN_KEY = "kitchen_global_token";
const STAFF_KEY = "kitchen_global_staff";

function KitchenGlobalLoginScreen({
  onLoggedIn, onRequestAccess,
}: {
  onLoggedIn: (token: string, staffName: string | null) => void;
  onRequestAccess: () => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
    <div className="fixed inset-0 bg-gradient-to-br from-[#111318] via-[#0D1B3E] to-[#1a1030] flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 w-full max-w-sm space-y-6 shadow-2xl">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#C9A227] to-[#8f6f16] flex items-center justify-center mx-auto shadow-lg">
            <ChefHat className="w-8 h-8 text-black" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white uppercase tracking-widest">Cozinha BoxSys</h1>
            <p className="text-xs text-white/40 font-bold mt-1">Entre com seu usuário e senha</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-white/40 tracking-widest ml-1">Usuário</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                autoFocus
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ex: joao.pizzaria"
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
          disabled={loading || !username || !password}
          className="w-full bg-[#C9A227] hover:bg-[#E8B93A] disabled:opacity-40 text-black font-black py-3.5 rounded-2xl text-xs uppercase tracking-widest transition-all"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
        <button
          type="button"
          onClick={onRequestAccess}
          className="w-full text-center text-[11px] font-bold text-white/40 hover:text-white transition-colors underline underline-offset-4"
        >
          Ainda não tenho acesso — solicitar ao admin da loja
        </button>
        <a
          href="/downloads/BoxSys-Cozinha.apk"
          download
          className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all"
        >
          <Download className="w-3.5 h-3.5" />
          Baixar app para tablet/celular (Android)
        </a>
      </form>
    </div>
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
      <div className="fixed inset-0 bg-gradient-to-br from-[#111318] via-[#0D1B3E] to-[#1a1030] flex items-center justify-center p-6">
        <div className="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 w-full max-w-sm space-y-6 text-center shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white">Pedido enviado!</h1>
            <p className="text-xs text-white/50 font-bold mt-2 leading-relaxed">
              {sent.matchedStore
                ? <>Solicite ao admin de <strong>{sent.matchedStore}</strong> que aprove seu acesso em Configurações → Equipe da Cozinha.</>
                : "Não encontramos uma loja com esse nome automaticamente — avise o dono para conferir e aprovar manualmente."}
            </p>
          </div>
          <button onClick={onBack} className="w-full bg-[#C9A227] hover:bg-[#E8B93A] text-black font-black py-3.5 rounded-2xl text-xs uppercase tracking-widest transition-all">
            Voltar ao login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-[#111318] via-[#0D1B3E] to-[#1a1030] flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 w-full max-w-sm space-y-5 shadow-2xl">
        <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-[11px] font-bold text-white/40 hover:text-white transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar
        </button>
        <div className="text-center space-y-2">
          <h1 className="text-lg font-black text-white">Solicitar acesso</h1>
          <p className="text-xs text-white/40 font-bold">O admin da sua loja vai aprovar e definir sua senha</p>
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-white/40 tracking-widest ml-1">Seu nome</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input autoFocus type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: João"
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-white placeholder-white/20 focus:border-[#C9A227] outline-none text-sm font-bold" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-white/40 tracking-widest ml-1">Usuário desejado</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Ex: joao.pizzaria"
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-white placeholder-white/20 focus:border-[#C9A227] outline-none text-sm font-bold" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-white/40 tracking-widest ml-1">Nome da loja</label>
            <div className="relative">
              <Store className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input type="text" value={storeQuery} onChange={(e) => setStoreQuery(e.target.value)} placeholder="Ex: Pizzaria do Zé"
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-white placeholder-white/20 focus:border-[#C9A227] outline-none text-sm font-bold" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-white/40 tracking-widest ml-1">Contato (opcional)</label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input type="text" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="WhatsApp ou telefone"
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-white placeholder-white/20 focus:border-[#C9A227] outline-none text-sm font-bold" />
            </div>
          </div>
          {error && <p className="text-xs text-red-400 font-bold text-center">{error}</p>}
        </div>
        <button
          type="submit"
          disabled={loading || !name.trim() || !username.trim() || !storeQuery.trim()}
          className="w-full bg-[#C9A227] hover:bg-[#E8B93A] disabled:opacity-40 text-black font-black py-3.5 rounded-2xl text-xs uppercase tracking-widest transition-all"
        >
          {loading ? "Enviando..." : "Enviar pedido"}
        </button>
      </form>
    </div>
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
