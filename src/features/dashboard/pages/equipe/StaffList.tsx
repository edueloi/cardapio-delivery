import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  KeyRound,
  Mail,
  Plus,
  Settings,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  ConfirmModal,
  EmptyState,
  FilterLine,
  FilterLineSearch,
  FilterLineSection,
  GridTable,
  IconButton,
  Input,
  Modal,
  ModalFooter,
  PageWrapper,
  SectionTitle,
  Select,
  StatCard,
  StatGrid,
  Tabs,
} from "../../../../components";
import type { Column } from "../../../../components";
import { apiJson } from "../../../../lib/api";
import { Tenant } from "../../../../types";

// ─── Permission tabs metadata for the editor ──────────────────────────────────
const PERM_TABS = [
  { id: "overview",    label: "Visão Geral",       group: "Operação" },
  { id: "pos",         label: "PDV — Caixa",       group: "Operação" },
  { id: "waiter",      label: "Garçom",            group: "Operação" },
  { id: "live-orders", label: "Painel de Pedidos", group: "Operação" },
  { id: "scheduled",   label: "Agendamentos",      group: "Operação" },
  { id: "kds",         label: "Monitor de Cozinha",group: "Operação" },
  { id: "tables",      label: "Mesas e QR Code",   group: "Operação" },
  { id: "history",     label: "Histórico",         group: "Operação" },
  { id: "menu",        label: "Cardápio",          group: "Catálogo" },
  { id: "inventory",   label: "Estoque",           group: "Catálogo" },
  { id: "production",  label: "Produção",          group: "Catálogo" },
  { id: "suppliers",   label: "Fornecedores",      group: "Catálogo" },
  { id: "finance",     label: "Fluxo de Caixa",    group: "Financeiro" },
  { id: "entries",     label: "Entradas e Saídas", group: "Financeiro" },
  { id: "reports",     label: "Relatórios",        group: "Financeiro" },
  { id: "nfce",        label: "Notas Fiscais",     group: "Financeiro" },
  { id: "customers",   label: "Clientes",      group: "Marketing" },
  { id: "loyalty",     label: "Fidelidade",        group: "Marketing" },
  { id: "promotions",  label: "Promoções",         group: "Marketing" },
  { id: "bundles",     label: "Combos",            group: "Marketing" },
  { id: "whatsapp",    label: "WhatsApp",          group: "Marketing" },
  { id: "display-panel", label: "Config. Painel TV", group: "Administração" },
  { id: "downloads",   label: "Downloads",         group: "Administração" },
  { id: "manual",      label: "Manual de Ajuda",   group: "Administração" },
] as const;

const PERM_GROUPS = ["Operação", "Catálogo", "Financeiro", "Marketing", "Administração"];

// ─── Presets de cargo — atalhos que já marcam o pacote de permissões certo ────
const ROLE_PRESETS = [
  { id: "waiter",    label: "Garçom",       tabs: ["waiter", "tables"] },
  { id: "cashier",   label: "Caixa / PDV",  tabs: ["pos", "tables", "live-orders", "history"] },
  { id: "kitchen",   label: "Cozinha",      tabs: ["kds", "live-orders"] },
  { id: "custom",    label: "Personalizado", tabs: null },
] as const;

// Abas internas dos modais de membro
const MEMBER_TABS = [
  { id: "dados", label: "Dados", icon: UserRound },
  { id: "permissoes", label: "Permissões", icon: KeyRound },
] as const;
type MemberTabId = (typeof MEMBER_TABS)[number]["id"];

const ROLE_OPTIONS = [
  { value: "ADMIN", label: "Admin" },
  { value: "STAFF", label: "Staff" },
];

const PRESET_OPTIONS = ROLE_PRESETS.map(p => ({ value: p.id, label: p.label }));

function matchRolePreset(permissions: string[] | null): string {
  if (permissions === null) return "custom";
  const sorted = [...permissions].sort().join(",");
  const found = ROLE_PRESETS.find(p => p.tabs && [...p.tabs].sort().join(",") === sorted);
  return found?.id ?? "custom";
}

interface StaffMember {
  id: string;
  role: "OWNER" | "ADMIN" | "STAFF";
  name: string | null;
  permissions: string[] | null;
  createdAt: string;
  account: { id: string; email: string; name: string };
}

interface PendingInvite {
  id: string;
  email: string;
  role: "ADMIN" | "STAFF";
  name: string | null;
  permissions: string[] | null;
  createdAt: string;
  expiresAt: string;
}

type StaffRow =
  | { kind: "member"; id: string; member: StaffMember }
  | { kind: "invite"; id: string; invite: PendingInvite };

function PermissionsEditor({
  permissions,
  onChange,
}: {
  permissions: string[] | null;
  onChange: (next: string[] | null) => void;
}) {
  const isAll = permissions === null;
  const toggle = (id: string) => {
    if (isAll) {
      onChange(PERM_TABS.map(t => t.id).filter(t => t !== id));
    } else {
      const has = permissions.includes(id);
      const next = has ? permissions.filter(p => p !== id) : [...permissions, id];
      onChange(next);
    }
  };

  return (
    <div className="space-y-4">
      <div
        onClick={() => onChange(null)}
        className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all ${isAll ? "border-blue-600 bg-blue-50 text-blue-800" : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"}`}
      >
        <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${isAll ? "border-blue-600" : "border-slate-300"}`}>
          {isAll && <div className="h-2 w-2 rounded-full bg-blue-600" />}
        </div>
        <span className="text-xs font-medium">Acesso total (todas as telas)</span>
      </div>

      {PERM_GROUPS.map(group => (
        <div key={group}>
          <p className="mb-2 ml-1 text-[11px] font-medium text-slate-500">{group}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {PERM_TABS.filter(t => t.group === group).map(tab => {
              const enabled = isAll || permissions!.includes(tab.id);
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => toggle(tab.id)}
                  className={`flex items-center gap-2 rounded-lg border p-2.5 text-left transition-all ${
                    enabled
                      ? "border-blue-200 bg-white text-slate-800"
                      : "border-slate-100 bg-slate-50 text-slate-400 opacity-60"
                  }`}
                >
                  <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-all ${enabled ? "border-blue-600 bg-blue-600" : "border-slate-300"}`}>
                    {enabled && <CheckCircle2 className="h-3 w-3 text-white" />}
                  </div>
                  <span className="text-xs font-medium leading-tight">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Conteúdo (com abas internas) dos modais de adicionar/editar membro. */
function MemberFormTabs({
  tab,
  onTabChange,
  dados,
  role,
  onRoleChange,
  preset,
  onPresetChange,
  permissions,
  onPermissionsChange,
}: {
  tab: MemberTabId;
  onTabChange: (t: MemberTabId) => void;
  dados: React.ReactNode;
  role: "ADMIN" | "STAFF";
  onRoleChange: (r: "ADMIN" | "STAFF") => void;
  preset: string;
  onPresetChange: (id: string) => void;
  permissions: string[] | null;
  onPermissionsChange: (next: string[] | null) => void;
}) {
  return (
    <Tabs<MemberTabId> items={MEMBER_TABS} value={tab} onChange={onTabChange} label="Dados do membro">
      {tab === "dados" && (
        <div className="space-y-3">
          {dados}
          <div>
            <Select
              label="Função"
              value={role}
              onChange={e => onRoleChange(e.target.value as "ADMIN" | "STAFF")}
              options={ROLE_OPTIONS}
            />
            <p className="ml-1 mt-1.5 text-[11px] text-slate-500">
              {role === "ADMIN"
                ? "Admin tem acesso completo à loja, com as mesmas permissões operacionais do proprietário."
                : "Staff tem acesso limitado às telas selecionadas na aba Permissões."}
            </p>
          </div>
        </div>
      )}
      {tab === "permissoes" && (
        <div className="space-y-3">
          {role === "STAFF" ? (
            <>
              <div>
                <Select
                  label="Cargo (atalho de permissões)"
                  value={preset}
                  onChange={e => onPresetChange(e.target.value)}
                  options={PRESET_OPTIONS}
                />
                <p className="ml-1 mt-1.5 text-[11px] text-slate-500">Escolha um cargo para marcar automaticamente as telas certas, ou ajuste manualmente abaixo.</p>
              </div>
              <PermissionsEditor permissions={permissions} onChange={onPermissionsChange} />
            </>
          ) : (
            <Alert variant="info">Admin tem acesso completo à loja. As permissões por tela valem apenas para membros com função Staff.</Alert>
          )}
        </div>
      )}
    </Tabs>
  );
}

export function StaffList({ tenant }: { tenant: Tenant | null }) {
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteModal, setInviteModal] = useState(false);
  const [editingMember, setEditingMember] = useState<StaffMember | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<StaffMember | null>(null);
  const [cancelInviteConfirm, setCancelInviteConfirm] = useState<PendingInvite | null>(null);
  const [saving, setSaving] = useState(false);
  const [inviteSentMessage, setInviteSentMessage] = useState("");
  const [search, setSearch] = useState("");

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "STAFF">("STAFF");
  const [inviteName, setInviteName] = useState("");
  const [invitePerms, setInvitePerms] = useState<string[] | null>(null);
  const [invitePreset, setInvitePreset] = useState<string>("custom");
  const [inviteError, setInviteError] = useState("");
  const [inviteTab, setInviteTab] = useState<MemberTabId>("dados");

  // Edit form
  const [editRole, setEditRole] = useState<"ADMIN" | "STAFF">("STAFF");
  const [editName, setEditName] = useState("");
  const [editPerms, setEditPerms] = useState<string[] | null>(null);
  const [editPreset, setEditPreset] = useState<string>("custom");
  const [editTab, setEditTab] = useState<MemberTabId>("dados");

  const applyPreset = (presetId: string, setPerms: (p: string[] | null) => void, setPreset: (p: string) => void) => {
    setPreset(presetId);
    const preset = ROLE_PRESETS.find(p => p.id === presetId);
    if (preset?.tabs) setPerms([...preset.tabs]);
  };

  const fetchMembers = async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const data = await apiJson(`/api/owner/tenants/${tenant.id}/staff`) as { members: StaffMember[]; pendingInvites: PendingInvite[] };
      setMembers(data.members);
      setPendingInvites(data.pendingInvites);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchMembers(); }, [tenant?.id]);

  const handleInvite = async () => {
    if (!tenant || !inviteEmail.trim()) return;
    setSaving(true);
    setInviteError("");
    try {
      const data = await apiJson(`/api/owner/tenants/${tenant.id}/staff/invite`, {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole, name: inviteName || null, permissions: invitePerms }),
      }) as StaffMember & { pending?: boolean; message?: string };
      if (data.pending) {
        setInviteSentMessage(data.message || "Convite enviado por e-mail.");
        await fetchMembers();
      } else {
        setMembers(prev => [...prev, data as StaffMember]);
      }
      setInviteModal(false);
      setInviteEmail(""); setInviteName(""); setInviteRole("STAFF"); setInvitePerms(null); setInvitePreset("custom"); setInviteTab("dados");
    } catch (err: any) {
      setInviteError(err.message || "Erro ao adicionar membro.");
    } finally { setSaving(false); }
  };

  const handleCancelInvite = async () => {
    if (!tenant || !cancelInviteConfirm) return;
    try {
      await apiJson(`/api/owner/tenants/${tenant.id}/staff/invite/${cancelInviteConfirm.id}`, { method: "DELETE" });
      setPendingInvites(prev => prev.filter(i => i.id !== cancelInviteConfirm.id));
    } catch { /* ignore */ }
    finally { setCancelInviteConfirm(null); }
  };

  const handleUpdate = async () => {
    if (!tenant || !editingMember) return;
    setSaving(true);
    try {
      const data = await apiJson(`/api/owner/tenants/${tenant.id}/staff/${editingMember.id}`, {
        method: "PATCH",
        body: JSON.stringify({ role: editRole, name: editName || null, permissions: editPerms }),
      }) as StaffMember;
      setMembers(prev => prev.map(m => m.id === data.id ? data : m));
      setEditingMember(null);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!tenant || !deleteConfirm) return;
    try {
      await apiJson(`/api/owner/tenants/${tenant.id}/staff/${deleteConfirm.id}`, { method: "DELETE" });
      setMembers(prev => prev.filter(m => m.id !== deleteConfirm.id));
    } catch { /* ignore */ }
    finally { setDeleteConfirm(null); }
  };

  const openEdit = (m: StaffMember) => {
    setEditingMember(m);
    setEditRole(m.role as "ADMIN" | "STAFF");
    setEditName(m.name || "");
    setEditPerms(m.permissions);
    setEditPreset(matchRolePreset(m.permissions));
    setEditTab("dados");
  };

  const roleBadge = (role: string): "primary" | "warning" | "default" => role === "OWNER" ? "primary" : role === "ADMIN" ? "warning" : "default";
  const roleLabel = (role: string) => role === "OWNER" ? "Proprietário" : role === "ADMIN" ? "Admin" : "Staff";
  const permLabel = (perms: string[] | null) => perms === null ? "Acesso total" : perms.length === 0 ? "Sem acesso" : `${perms.length} tela${perms.length > 1 ? "s" : ""}`;

  const rows = useMemo<StaffRow[]>(() => {
    const q = search.trim().toLowerCase();
    const all: StaffRow[] = [
      ...members.map<StaffRow>(m => ({ kind: "member", id: m.id, member: m })),
      ...pendingInvites.map<StaffRow>(i => ({ kind: "invite", id: i.id, invite: i })),
    ];
    if (!q) return all;
    return all.filter(r => {
      const text = r.kind === "member"
        ? `${r.member.name ?? ""} ${r.member.account.name} ${r.member.account.email}`
        : `${r.invite.name ?? ""} ${r.invite.email}`;
      return text.toLowerCase().includes(q);
    });
  }, [members, pendingInvites, search]);

  const columns: Column<StaffRow>[] = [
    {
      header: "Membro",
      render: (r) => {
        const isInvite = r.kind === "invite";
        const display = r.kind === "member" ? (r.member.name || r.member.account.name) : (r.invite.name || r.invite.email);
        const email = r.kind === "member" ? r.member.account.email : r.invite.email;
        return (
          <div className="flex min-w-0 items-center gap-3">
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-medium ${isInvite ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>
              {(display || "?")[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-slate-800">{display}</p>
              <p className="truncate text-[11px] text-slate-500">{isInvite ? `Convite pendente — ${email}` : email}</p>
            </div>
          </div>
        );
      },
    },
    {
      header: "Função",
      render: (r) => {
        const role = r.kind === "member" ? r.member.role : r.invite.role;
        return <Badge color={roleBadge(role)}>{roleLabel(role)}</Badge>;
      },
    },
    {
      header: "Acesso",
      render: (r) => <Badge color="default">{permLabel(r.kind === "member" ? r.member.permissions : r.invite.permissions)}</Badge>,
    },
    {
      header: "Ações",
      className: "text-right",
      headerClassName: "text-right",
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          {r.kind === "member" && r.member.role !== "OWNER" && (
            <>
              <IconButton aria-label="Editar membro" variant="ghost" size="sm" onClick={() => openEdit(r.member)}>
                <Settings size={14} />
              </IconButton>
              <IconButton aria-label="Remover membro" variant="ghost" size="sm" onClick={() => setDeleteConfirm(r.member)}>
                <Trash2 size={14} />
              </IconButton>
            </>
          )}
          {r.kind === "invite" && (
            <IconButton aria-label="Cancelar convite" variant="ghost" size="sm" onClick={() => setCancelInviteConfirm(r.invite)}>
              <Trash2 size={14} />
            </IconButton>
          )}
        </div>
      ),
    },
  ];

  return (
    <PageWrapper>
      <div className="space-y-4">
        <SectionTitle
          title="Equipe"
          description="Gerencie membros e defina o que cada um pode acessar"
          icon={ClipboardList}
          action={
            <Button size="sm" onClick={() => { setInviteSentMessage(""); setInviteTab("dados"); setInviteModal(true); }} iconLeft={<Plus size={14} />}>
              Adicionar membro
            </Button>
          }
        />

        <StatGrid cols={3}>
          <StatCard title="Membros" value={members.length} icon={Users} color="info" />
          <StatCard title="Admins" value={members.filter(m => m.role === "ADMIN" || m.role === "OWNER").length} icon={KeyRound} color="success" />
          <StatCard title="Convites pendentes" value={pendingInvites.length} icon={Mail} color="warning" />
        </StatGrid>

        {inviteSentMessage && <Alert variant="success">{inviteSentMessage}</Alert>}

        {(members.length + pendingInvites.length) > 4 && (
          <FilterLine>
            <FilterLineSection grow>
              <FilterLineSearch aria-label="Buscar membros" value={search} onChange={setSearch} placeholder="Buscar por nome ou e-mail..." className="max-w-[280px]" />
            </FilterLineSection>
          </FilterLine>
        )}

        {!loading && members.length === 0 && pendingInvites.length === 0 ? (
          <EmptyState
            title="Nenhum membro ainda"
            description="Adicione colaboradores e defina exatamente o que cada um pode ver e fazer."
            icon={ClipboardList}
          />
        ) : (
          <GridTable
            data={rows}
            columns={columns}
            keyExtractor={(r) => r.id}
            isLoading={loading}
            emptyMessage="Nenhum membro encontrado."
          />
        )}
      </div>

      {/* Invite Modal */}
      <Modal
        isOpen={inviteModal}
        onClose={() => { setInviteModal(false); setInviteError(""); }}
        title="Adicionar membro"
        size="xl"
        mobileStyle="bottom-sheet"
        footer={
          <ModalFooter>
            <Button variant="outline" onClick={() => setInviteModal(false)}>Cancelar</Button>
            <Button variant="primary" onClick={handleInvite} loading={saving} disabled={!inviteEmail.trim()}>Adicionar</Button>
          </ModalFooter>
        }
      >
        <div className="space-y-3">
          {inviteError && <Alert variant="error">{inviteError}</Alert>}
          <MemberFormTabs
            tab={inviteTab}
            onTabChange={setInviteTab}
            role={inviteRole}
            onRoleChange={setInviteRole}
            preset={invitePreset}
            onPresetChange={(id) => applyPreset(id, setInvitePerms, setInvitePreset)}
            permissions={invitePerms}
            onPermissionsChange={(next) => { setInvitePerms(next); setInvitePreset(matchRolePreset(next)); }}
            dados={
              <>
                <Input label="E-mail do usuário" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="joao@email.com" type="email" />
                <Input label="Nome (opcional)" value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Ex: João — Caixa" />
              </>
            }
          />
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editingMember}
        onClose={() => setEditingMember(null)}
        title={`Editar — ${editingMember?.name || editingMember?.account.name}`}
        size="xl"
        mobileStyle="bottom-sheet"
        footer={
          <ModalFooter>
            <Button variant="outline" onClick={() => setEditingMember(null)}>Cancelar</Button>
            <Button variant="primary" onClick={handleUpdate} loading={saving}>Salvar</Button>
          </ModalFooter>
        }
      >
        <div>
          <MemberFormTabs
            tab={editTab}
            onTabChange={setEditTab}
            role={editRole}
            onRoleChange={setEditRole}
            preset={editPreset}
            onPresetChange={(id) => applyPreset(id, setEditPerms, setEditPreset)}
            permissions={editPerms}
            onPermissionsChange={(next) => { setEditPerms(next); setEditPreset(matchRolePreset(next)); }}
            dados={
              <Input label="Nome / apelido" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Ex: Maria — Atendimento" />
            }
          />
        </div>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Remover membro"
        message={<>Tem certeza que deseja remover <strong>{deleteConfirm?.name || deleteConfirm?.account.name}</strong> da equipe?</>}
        confirmLabel="Remover"
        variant="danger"
      />

      {/* Cancel Invite Confirm */}
      <ConfirmModal
        isOpen={!!cancelInviteConfirm}
        onClose={() => setCancelInviteConfirm(null)}
        onConfirm={handleCancelInvite}
        title="Cancelar convite"
        message={<>Tem certeza que deseja cancelar o convite para <strong>{cancelInviteConfirm?.name || cancelInviteConfirm?.email}</strong>?</>}
        confirmLabel="Cancelar convite"
        variant="danger"
      />
    </PageWrapper>
  );
}
