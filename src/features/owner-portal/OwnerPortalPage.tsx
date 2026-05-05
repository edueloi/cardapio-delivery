import { useState } from "react";
import { Link } from "react-router-dom";
import { Bot, Link as LinkIcon, LogOut, Plus, Store } from "lucide-react";
import { Button, Input } from "../../components";
import { apiJson } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type { Tenant, TenantMembership } from "../../types";

export default function OwnerPortalPage() {
  const { account, tenants, refresh, logout } = useAuth();
  const [createForm, setCreateForm] = useState({ name: "", slug: "" });
  const [claimSlug, setClaimSlug] = useState("");
  const [busy, setBusy] = useState<null | "create" | "claim">(null);
  const [error, setError] = useState("");

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy("create");
    setError("");

    try {
      await apiJson<Tenant>("/api/owner/tenants", {
        method: "POST",
        body: JSON.stringify(createForm),
      });
      setCreateForm({ name: "", slug: "" });
      await refresh();
    } catch (err: any) {
      setError(err?.message || "Falha ao criar estabelecimento.");
    } finally {
      setBusy(null);
    }
  };

  const handleClaim = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy("claim");
    setError("");

    try {
      await apiJson<Tenant>("/api/owner/tenants/claim", {
        method: "POST",
        body: JSON.stringify({ slug: claimSlug }),
      });
      setClaimSlug("");
      await refresh();
    } catch (err: any) {
      setError(err?.message || "Falha ao vincular estabelecimento.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="bg-white border border-slate-200 rounded-[28px] p-6 md:p-8 shadow-sm flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-400 mb-3">
              Portal do Dono
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">{account?.name}</h1>
            <p className="text-sm text-slate-500 mt-2">
              Gerencie seus estabelecimentos, dashboards e a conexão de bot por QR Code.
            </p>
          </div>
          <Button variant="outline" iconLeft={<LogOut className="w-4 h-4" />} onClick={() => logout()}>
            Sair
          </Button>
        </header>

        <section className="grid xl:grid-cols-[1.4fr,0.9fr] gap-6">
          <div className="bg-white border border-slate-200 rounded-[28px] p-6 md:p-8 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-black text-slate-900">Seus Estabelecimentos</h2>
                <p className="text-sm text-slate-500 mt-1">Cada estabelecimento possui painel e bot próprios.</p>
              </div>
              <div className="text-xs font-black uppercase text-slate-400 tracking-[0.2em]">
                {tenants.length} ativo(s)
              </div>
            </div>

            <div className="grid gap-4">
              {tenants.map((membership: TenantMembership) => (
                <div
                  key={membership.membershipId}
                  className="rounded-[24px] border border-slate-200 bg-slate-50 p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Store className="w-4 h-4 text-[#2a74ac]" />
                      <h3 className="text-lg font-black text-slate-900">{membership.tenant.name}</h3>
                    </div>
                    <div className="text-sm text-slate-500">/{membership.tenant.slug}</div>
                    <div className="flex items-center gap-3 pt-1">
                      <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                        {membership.role}
                      </span>
                      <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                        Bot: {membership.tenant.wppInstance?.status || "not_configured"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Link to={`/dashboard/${membership.tenant.slug}`}>
                      <Button iconLeft={<Bot className="w-4 h-4" />}>Abrir Painel</Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-[28px] p-6 shadow-sm space-y-4">
              <div>
                <h2 className="text-lg font-black text-slate-900">Novo Estabelecimento</h2>
                <p className="text-sm text-slate-500 mt-1">Crie outro cardápio com bot separado.</p>
              </div>
              <Input
                label="Nome"
                value={createForm.name}
                onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Nome do estabelecimento"
              />
              <Input
                label="Slug"
                value={createForm.slug}
                onChange={(event) => setCreateForm((current) => ({ ...current, slug: event.target.value }))}
                placeholder="slug-do-estabelecimento"
                hint="Será usado no link do cardápio."
              />
              <Button
                type="submit"
                fullWidth
                loading={busy === "create"}
                iconLeft={<Plus className="w-4 h-4" />}
              >
                Criar estabelecimento
              </Button>
            </form>

            <form onSubmit={handleClaim} className="bg-white border border-slate-200 rounded-[28px] p-6 shadow-sm space-y-4">
              <div>
                <h2 className="text-lg font-black text-slate-900">Vincular Existente</h2>
                <p className="text-sm text-slate-500 mt-1">Assuma um estabelecimento antigo ainda sem dono.</p>
              </div>
              <Input
                label="Slug existente"
                value={claimSlug}
                onChange={(event) => setClaimSlug(event.target.value)}
                placeholder="slug-do-estabelecimento"
                iconLeft={<LinkIcon className="w-4 h-4" />}
                error={error || undefined}
              />
              <Button type="submit" fullWidth loading={busy === "claim"} variant="outline">
                Vincular estabelecimento
              </Button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
