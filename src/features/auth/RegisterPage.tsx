import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, Lock, Mail, Store, User } from "lucide-react";
import { Button, Input } from "../../components";
import { useAuth } from "../../lib/auth";
import { getRequestedDashboardSlug, resolvePostAuthPath } from "./authRedirect";

type RegisterMode = "create" | "claim";

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

export default function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { register } = useAuth();
  const next = searchParams.get("next") || "/painel";
  const requestedSlug = getRequestedDashboardSlug(next);
  const [mode, setMode] = useState<RegisterMode>(requestedSlug ? "claim" : "create");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    establishmentName: "",
    establishmentSlug: "",
    claimSlug: requestedSlug || "",
  });
  const [error, setError] = useState("");
  const [slugError, setSlugError] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const slugCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (slugEdited) return;
    setForm((current) => ({ ...current, establishmentSlug: toSlug(form.establishmentName) }));
  }, [form.establishmentName, slugEdited]);

  function handleSlugChange(value: string) {
    const sanitized = toSlug(value);
    setSlugEdited(true);
    setForm((current) => ({ ...current, establishmentSlug: sanitized }));
    setSlugError("");

    if (slugCheckTimer.current) clearTimeout(slugCheckTimer.current);
    if (!sanitized) return;

    slugCheckTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tenants/check-slug/${encodeURIComponent(sanitized)}`);
        const data = await res.json();
        if (data.taken) setSlugError("Esse link já está em uso, escolha outro.");
      } catch {}
    }, 500);
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const payload = await register({
        name: form.name,
        email: form.email,
        password: form.password,
        establishmentName: mode === "create" ? form.establishmentName : undefined,
        establishmentSlug: mode === "create" ? form.establishmentSlug : undefined,
        claimSlug: mode === "claim" ? form.claimSlug : undefined,
      });

      navigate(resolvePostAuthPath(next, payload.tenants), { replace: true });
    } catch (err: any) {
      setError(err?.message || "Falha ao criar conta.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-[28px] shadow-xl p-8 md:p-10">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Cadastro do Sistema</h1>
          <p className="text-sm text-slate-500 mt-2">
            Crie seu acesso e gerencie os estabelecimentos com QR Code e bot próprio no WhatsApp.
          </p>
          {requestedSlug && (
            <p className="text-sm text-[#C9A227] font-bold mt-3">
              Você veio do estabelecimento <span className="font-black">/{requestedSlug}</span>. Se ele já existe, use a opção de vincular.
            </p>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mb-6">
          <button
            type="button"
            onClick={() => setMode("create")}
            className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
              mode === "create"
                ? "border-[#C9A227] bg-[#fdf8e8]"
                : "border-slate-200 bg-slate-50 hover:bg-slate-100"
            }`}
          >
            <div className="text-sm font-black text-slate-900">Criar novo estabelecimento</div>
            <div className="text-xs text-slate-500 mt-1">Ideal para começar um cardápio do zero.</div>
          </button>
          <button
            type="button"
            onClick={() => setMode("claim")}
            className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
              mode === "claim"
                ? "border-[#C9A227] bg-[#fdf8e8]"
                : "border-slate-200 bg-slate-50 hover:bg-slate-100"
            }`}
          >
            <div className="text-sm font-black text-slate-900">Vincular estabelecimento existente</div>
            <div className="text-xs text-slate-500 mt-1">Use o slug de um estabelecimento ainda sem dono.</div>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Input
              label="Seu nome"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              iconLeft={<User className="w-4 h-4" />}
              placeholder="Nome do dono"
            />
            <Input
              label="E-mail"
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              iconLeft={<Mail className="w-4 h-4" />}
              placeholder="seuemail@dominio.com"
            />
          </div>

          <Input
            label="Senha"
            type={showPassword ? "text" : "password"}
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            iconLeft={<Lock className="w-4 h-4" />}
            iconRight={
              <button type="button" onClick={() => setShowPassword((v) => !v)} className="text-zinc-400 hover:text-zinc-600">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
            placeholder="Crie uma senha"
          />

          {mode === "create" ? (
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label="Nome do estabelecimento"
                value={form.establishmentName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, establishmentName: event.target.value }))
                }
                iconLeft={<Store className="w-4 h-4" />}
                placeholder="Ex: Pastelaria do Edu"
              />
              <Input
                label="Slug do link"
                value={form.establishmentSlug}
                onChange={(event) => handleSlugChange(event.target.value)}
                placeholder="Ex: pastelaria-do-edu"
                error={slugError || (mode === "create" && error ? error : undefined)}
                hint={!slugError && form.establishmentSlug ? `localhost:3000/${form.establishmentSlug}` : undefined}
              />
            </div>
          ) : (
            <Input
              label="Slug do estabelecimento existente"
              value={form.claimSlug}
              onChange={(event) => setForm((current) => ({ ...current, claimSlug: event.target.value }))}
              placeholder="Ex: pastelaria-do-edu"
              error={error || undefined}
            />
          )}

          <Button type="submit" fullWidth loading={loading}>
            Criar acesso
          </Button>
        </form>

        <div className="mt-6 text-sm text-slate-500">
          Já tem conta?{" "}
          <Link to={`/login?next=${encodeURIComponent(next)}`} className="font-bold text-[#C9A227] hover:text-[#A8841C]">
            Entrar no sistema
          </Link>
        </div>
      </div>
    </div>
  );
}
