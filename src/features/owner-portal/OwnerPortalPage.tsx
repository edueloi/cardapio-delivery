import { useState } from "react";
import { Link } from "react-router-dom";
import { Bot, Link as LinkIcon, LogOut, Plus, Store } from "lucide-react";
import { Badge, Button, Input, PageWrapper, PanelCard, SectionTitle } from "../../components";
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
    <div className="min-h-screen bg-zinc-50">
      <PageWrapper>
        <div className="space-y-4">
          <SectionTitle
            title={account?.name || "Portal do Dono"}
            description="Portal do Dono — gerencie seus estabelecimentos, dashboards e a conexão de bot por QR Code."
            icon={Store}
            action={
              <Button variant="outline" size="sm" iconLeft={<LogOut className="w-3.5 h-3.5" />} onClick={() => logout()}>
                Sair
              </Button>
            }
          />

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr,0.9fr]">
            <PanelCard
              title="Seus Estabelecimentos"
              description="Cada estabelecimento possui painel e bot próprios."
              icon={Store}
              action={<Badge color="primary">{tenants.length} ativo(s)</Badge>}
            >
              <div className="grid gap-3">
                {tenants.map((membership: TenantMembership) => (
                  <div
                    key={membership.membershipId}
                    className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <h3 className="truncate text-sm font-medium text-slate-900">{membership.tenant.name}</h3>
                      <div className="text-xs text-slate-500">/{membership.tenant.slug}</div>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Badge>{membership.role}</Badge>
                        <Badge color="info">Bot: {membership.tenant.wppInstance?.status || "not_configured"}</Badge>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link to={`/dashboard/${membership.tenant.slug}`}>
                        <Button size="sm" iconLeft={<Bot className="w-3.5 h-3.5" />}>Abrir Painel</Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </PanelCard>

            <div className="space-y-4">
              <form onSubmit={handleCreate}>
                <PanelCard title="Novo Estabelecimento" description="Crie outro cardápio com bot separado." icon={Plus} contentClassName="space-y-3">
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
                </PanelCard>
              </form>

              <form onSubmit={handleClaim}>
                <PanelCard title="Vincular Existente" description="Assuma um estabelecimento antigo ainda sem dono." icon={LinkIcon} contentClassName="space-y-3">
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
                </PanelCard>
              </form>
            </div>
          </section>
        </div>
      </PageWrapper>
    </div>
  );
}
