import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Eye, EyeOff, Lock, Mail, Store, User, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Button, Input } from "../../components";
import { useAuth } from "../../lib/auth";

function toSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

type InviteStatus = "loading" | "valid" | "used" | "expired" | "invalid";

export default function InviteRegisterPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { login } = useAuth();

  const [inviteStatus, setInviteStatus] = useState<InviteStatus>("loading");
  const [inviteNote, setInviteNote] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    establishmentName: "",
    establishmentSlug: "",
  });
  const [slugEdited, setSlugEdited] = useState(false);
  const [slugError, setSlugError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) { setInviteStatus("invalid"); return; }
    fetch(`/api/auth/invite/${token}`)
      .then(r => {
        if (r.status === 404) return setInviteStatus("invalid");
        if (r.status === 410) return r.json().then((d: any) => {
          setInviteStatus(d.error?.includes("utilizado") ? "used" : "expired");
        });
        return r.json().then((d: any) => {
          setInviteStatus("valid");
          setInviteNote(d.note || null);
        });
      })
      .catch(() => setInviteStatus("invalid"));
  }, [token]);

  useEffect(() => {
    if (slugEdited) return;
    setForm(f => ({ ...f, establishmentSlug: toSlug(form.establishmentName) }));
  }, [form.establishmentName]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.name || !form.email || !form.password) {
      setError("Preencha todos os campos obrigatórios.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name: form.name,
          email: form.email,
          password: form.password,
          establishmentName: form.establishmentName || undefined,
          establishmentSlug: form.establishmentSlug || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Falha ao criar conta."); setLoading(false); return; }
      // Salva token e redireciona
      localStorage.setItem("auth_token", data.token);
      setSuccess(true);
      setTimeout(() => navigate("/painel"), 1500);
    } catch {
      setError("Erro de conexão. Tente novamente.");
    }
    setLoading(false);
  }

  // ── Telas de estado do convite ───────────────────────────────────────────

  if (inviteStatus === "loading") {
    return (
      <div className="min-h-screen bg-[#FDFDFD] flex items-center justify-center">
        <div className="text-slate-400 text-sm animate-pulse">Verificando convite...</div>
      </div>
    );
  }

  if (inviteStatus !== "valid") {
    const cfg = {
      used:    { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-50", border: "border-green-200", title: "Convite já utilizado", desc: "Este link de acesso já foi usado para criar uma conta. Cada convite é válido para uso único." },
      expired: { icon: Clock,        color: "text-amber-500", bg: "bg-amber-50",  border: "border-amber-200",  title: "Convite expirado",   desc: "O prazo deste link de acesso expirou. Solicite um novo convite ao administrador do sistema." },
      invalid: { icon: XCircle,      color: "text-red-500",   bg: "bg-red-50",    border: "border-red-200",    title: "Convite inválido",   desc: "Este link de acesso não é válido ou não existe. Verifique o link ou solicite um novo ao administrador." },
    }[inviteStatus];

    return (
      <div className="min-h-screen bg-[#FDFDFD] flex items-center justify-center px-4">
        <div className={`w-full max-w-md ${cfg.bg} border ${cfg.border} rounded-3xl p-10 text-center space-y-4`}>
          <cfg.icon className={`w-12 h-12 mx-auto ${cfg.color}`} />
          <h1 className="text-xl font-black text-slate-900">{cfg.title}</h1>
          <p className="text-sm text-slate-600 leading-relaxed">{cfg.desc}</p>
          <Button variant="ghost" onClick={() => navigate("/login")} className="mt-2">
            Ir para o login
          </Button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#FDFDFD] flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-green-50 border border-green-200 rounded-3xl p-10 text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 mx-auto text-green-500" />
          <h1 className="text-xl font-black text-slate-900">Conta criada!</h1>
          <p className="text-sm text-slate-600">Redirecionando para o painel...</p>
        </div>
      </div>
    );
  }

  // ── Formulário de cadastro ────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex items-center justify-center px-4 py-10 relative overflow-hidden">
      <div className="hidden md:block absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#001D3D]/5 rounded-full blur-3xl" />
      <div className="hidden md:block absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] bg-[#D49E00]/5 rounded-full blur-3xl" />

      <div className="w-full max-w-lg bg-white md:border md:border-slate-100 md:rounded-[32px] md:shadow-2xl md:shadow-slate-200/50 p-6 md:p-10 relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-16 h-16 mb-3 drop-shadow-md">
            <img src="/images/favicon-menu-flow.png" alt="Box Sys" className="w-full h-full object-contain" />
          </div>
          <div className="flex justify-center items-center text-3xl font-black tracking-tighter">
            <span className="text-[#001D3D]">Box</span>
            <span className="text-[#D49E00]"> Sys</span>
          </div>
          <p className="text-slate-400 text-xs font-bold tracking-[0.2em] uppercase mt-1">Criar conta</p>
        </div>

        {/* Banner do convite */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-6 flex items-start gap-3">
          <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-black text-amber-800">Convite válido</p>
            {inviteNote && <p className="text-xs text-amber-700 mt-0.5">{inviteNote}</p>}
            <p className="text-[10px] text-amber-600 mt-0.5">Este link é de uso único e expirará após o cadastro.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              label="Seu nome *"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              iconLeft={<User className="w-4 h-4" />}
              placeholder="Nome completo"
            />
            <Input
              label="E-mail *"
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              iconLeft={<Mail className="w-4 h-4" />}
              placeholder="seuemail@dominio.com"
            />
          </div>

          <Input
            label="Senha *"
            type={showPassword ? "text" : "password"}
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            iconLeft={<Lock className="w-4 h-4" />}
            iconRight={
              <button type="button" onClick={() => setShowPassword(v => !v)} className="text-zinc-400 hover:text-zinc-600">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
            placeholder="Crie uma senha forte"
            hint="Mínimo de 6 caracteres"
          />

          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">
              Estabelecimento (opcional)
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label="Nome do estabelecimento"
                value={form.establishmentName}
                onChange={e => setForm(f => ({ ...f, establishmentName: e.target.value }))}
                iconLeft={<Store className="w-4 h-4" />}
                placeholder="Ex: Pastelaria do Edu"
                hint="Deixe em branco para criar depois"
              />
              <Input
                label="Slug do link"
                value={form.establishmentSlug}
                onChange={e => {
                  setSlugEdited(true);
                  setForm(f => ({ ...f, establishmentSlug: toSlug(e.target.value) }));
                }}
                placeholder="pastelaria-do-edu"
                error={slugError || undefined}
                hint={!slugError && form.establishmentSlug ? `/${form.establishmentSlug}` : undefined}
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-700 font-medium">
              {error}
            </div>
          )}

          <Button
            type="submit"
            fullWidth
            loading={loading}
            className="bg-[#001D3D] hover:bg-[#002D5D] text-white h-14 rounded-2xl font-bold text-base transition-all active:scale-[0.98] shadow-lg shadow-[#001D3D]/20"
          >
            Criar minha conta
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          Já tem conta?{" "}
          <button onClick={() => navigate("/login")} className="font-bold text-[#D49E00] hover:text-[#B38600] transition-colors">
            Entrar no sistema
          </button>
        </p>
      </div>
    </div>
  );
}
