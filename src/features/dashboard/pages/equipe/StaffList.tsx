import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Plus,
  Settings,
  Trash2,
} from "lucide-react";
import {
  Button,
  ConfirmModal,
  ContentCard,
  EmptyState,
  Input,
  Modal,
  ModalFooter,
  PageWrapper,
  SectionTitle,
} from "../../../../components";
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
  { id: "customers",   label: "Clientes CRM",      group: "Marketing" },
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
        className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${isAll ? "bg-[#0D1B3E] border-[#0D1B3E] text-white" : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300"}`}
      >
        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${isAll ? "border-white bg-white" : "border-slate-300"}`}>
          {isAll && <div className="w-2.5 h-2.5 rounded-full bg-[#0D1B3E]" />}
        </div>
        <span className="text-[11px] font-black uppercase tracking-widest">Acesso total (todas as telas)</span>
      </div>

      {PERM_GROUPS.map(group => (
        <div key={group}>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">{group}</p>
          <div className="grid grid-cols-2 gap-2">
            {PERM_TABS.filter(t => t.group === group).map(tab => {
              const enabled = isAll || permissions!.includes(tab.id);
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => toggle(tab.id)}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all ${
                    enabled
                      ? "bg-white border-[#C9A227]/40 shadow-sm text-slate-800"
                      : "bg-slate-50 border-slate-100 text-slate-400 opacity-60"
                  }`}
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all ${enabled ? "bg-[#C9A227] border-[#C9A227]" : "border-slate-300"}`}>
                    {enabled && <CheckCircle2 className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-[10px] font-black leading-tight">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
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

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "STAFF">("STAFF");
  const [inviteName, setInviteName] = useState("");
  const [invitePerms, setInvitePerms] = useState<string[] | null>(null);
  const [invitePreset, setInvitePreset] = useState<string>("custom");
  const [inviteError, setInviteError] = useState("");

  // Edit form
  const [editRole, setEditRole] = useState<"ADMIN" | "STAFF">("STAFF");
  const [editName, setEditName] = useState("");
  const [editPerms, setEditPerms] = useState<string[] | null>(null);
  const [editPreset, setEditPreset] = useState<string>("custom");

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
      setInviteEmail(""); setInviteName(""); setInviteRole("STAFF"); setInvitePerms(null); setInvitePreset("custom");
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
  };

  const roleColor = (role: string) => role === "OWNER" ? "bg-[#0D1B3E] text-white" : role === "ADMIN" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600";
  const roleLabel = (role: string) => role === "OWNER" ? "Proprietário" : role === "ADMIN" ? "Admin" : "Staff";
  const permLabel = (perms: string[] | null) => perms === null ? "Acesso total" : perms.length === 0 ? "Sem acesso" : `${perms.length} tela${perms.length > 1 ? "s" : ""}`;

  return (
    <PageWrapper>
      <div className="flex items-center justify-between mb-6">
        <SectionTitle title="Equipe" description="Gerencie membros e defina o que cada um pode acessar" icon={ClipboardList} />
        <Button variant="primary" onClick={() => { setInviteSentMessage(""); setInviteModal(true); }} iconLeft={<Plus className="w-4 h-4" />}>
          Adicionar membro
        </Button>
      </div>

      {inviteSentMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-2xl px-4 py-3 text-xs font-bold flex items-center gap-2 mb-4">
          <CheckCircle2 className="w-4 h-4 shrink-0" />{inviteSentMessage}
        </div>
      )}

      <ContentCard padding="none" className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-16">
            <div className="w-8 h-8 border-4 border-[#C9A227] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : members.length === 0 && pendingInvites.length === 0 ? (
          <EmptyState
            title="Nenhum membro ainda"
            description="Adicione colaboradores e defina exatamente o que cada um pode ver e fazer."
            icon={ClipboardList}
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-4 p-5 hover:bg-slate-50/60 transition-colors">
                <div className="w-11 h-11 rounded-2xl bg-[#C9A227]/10 text-[#C9A227] flex items-center justify-center font-black text-sm shrink-0">
                  {(m.name || m.account.name || "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-slate-800 text-sm truncate">{m.name || m.account.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{m.account.email}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${roleColor(m.role)}`}>{roleLabel(m.role)}</span>
                  <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500">{permLabel(m.permissions)}</span>
                </div>
                {m.role !== "OWNER" && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEdit(m)} className="p-2 rounded-xl text-slate-400 hover:text-[#0D1B3E] hover:bg-slate-100 transition-colors">
                      <Settings className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteConfirm(m)} className="p-2 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
            {pendingInvites.map(i => (
              <div key={i.id} className="flex items-center gap-4 p-5 hover:bg-slate-50/60 transition-colors bg-amber-50/30">
                <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center font-black text-sm shrink-0">
                  {(i.name || i.email || "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-slate-800 text-sm truncate">{i.name || i.email}</p>
                  <p className="text-[10px] text-amber-600 truncate font-bold">Convite pendente — {i.email}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${roleColor(i.role)}`}>{roleLabel(i.role)}</span>
                  <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500">{permLabel(i.permissions)}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => setCancelInviteConfirm(i)} className="p-2 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ContentCard>

      {/* Invite Modal */}
      <Modal
        isOpen={inviteModal}
        onClose={() => { setInviteModal(false); setInviteError(""); }}
        title="Adicionar membro"
        size="md"
        mobileStyle="bottom-sheet"
        footer={
          <ModalFooter>
            <Button variant="outline" onClick={() => setInviteModal(false)}>Cancelar</Button>
            <Button variant="primary" onClick={handleInvite} loading={saving} disabled={!inviteEmail.trim()}>Adicionar</Button>
          </ModalFooter>
        }
      >
        <div className="p-4 sm:p-5 space-y-5">
          {inviteError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />{inviteError}
            </div>
          )}
          <Input label="E-mail do usuário" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="joao@email.com" type="email" />
          <Input label="Nome (opcional)" value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Ex: João — Caixa" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Função</p>
            <div className="grid grid-cols-2 gap-2">
              {(["ADMIN", "STAFF"] as const).map(r => (
                <button key={r} type="button" onClick={() => setInviteRole(r)}
                  className={`py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${inviteRole === r ? "bg-[#0D1B3E] border-[#0D1B3E] text-white" : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                  {r === "ADMIN" ? "Admin" : "Staff"}
                </button>
              ))}
            </div>
            <p className="text-[9px] text-slate-400 mt-2 ml-1">{inviteRole === "ADMIN" ? "Admin pode fazer tudo que o proprietário definir, exceto configurações e equipe." : "Staff tem acesso limitado às telas selecionadas."}</p>
          </div>
          {inviteRole === "STAFF" && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Cargo (atalho de permissões)</p>
              <div className="grid grid-cols-2 gap-2">
                {ROLE_PRESETS.map(p => (
                  <button key={p.id} type="button" onClick={() => applyPreset(p.id, setInvitePerms, setInvitePreset)}
                    className={`py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${invitePreset === p.id ? "bg-[#C9A227] border-[#C9A227] text-white" : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                    {p.label}
                  </button>
                ))}
              </div>
              <p className="text-[9px] text-slate-400 mt-2 ml-1">Escolha um cargo para marcar automaticamente as telas certas, ou ajuste manualmente abaixo.</p>
            </div>
          )}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Permissões de acesso</p>
            <PermissionsEditor permissions={invitePerms} onChange={(next) => { setInvitePerms(next); setInvitePreset(matchRolePreset(next)); }} />
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editingMember}
        onClose={() => setEditingMember(null)}
        title={`Editar — ${editingMember?.name || editingMember?.account.name}`}
        size="md"
        mobileStyle="bottom-sheet"
        footer={
          <ModalFooter>
            <Button variant="outline" onClick={() => setEditingMember(null)}>Cancelar</Button>
            <Button variant="primary" onClick={handleUpdate} loading={saving}>Salvar</Button>
          </ModalFooter>
        }
      >
        <div className="p-4 sm:p-5 space-y-5">
          <Input label="Nome / apelido" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Ex: Maria — Atendimento" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Função</p>
            <div className="grid grid-cols-2 gap-2">
              {(["ADMIN", "STAFF"] as const).map(r => (
                <button key={r} type="button" onClick={() => setEditRole(r)}
                  className={`py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${editRole === r ? "bg-[#0D1B3E] border-[#0D1B3E] text-white" : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                  {r === "ADMIN" ? "Admin" : "Staff"}
                </button>
              ))}
            </div>
          </div>
          {editRole === "STAFF" && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Cargo (atalho de permissões)</p>
              <div className="grid grid-cols-2 gap-2">
                {ROLE_PRESETS.map(p => (
                  <button key={p.id} type="button" onClick={() => applyPreset(p.id, setEditPerms, setEditPreset)}
                    className={`py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${editPreset === p.id ? "bg-[#C9A227] border-[#C9A227] text-white" : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300"}`}>
                    {p.label}
                  </button>
                ))}
              </div>
              <p className="text-[9px] text-slate-400 mt-2 ml-1">Escolha um cargo para marcar automaticamente as telas certas, ou ajuste manualmente abaixo.</p>
            </div>
          )}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Permissões de acesso</p>
            <PermissionsEditor permissions={editPerms} onChange={(next) => { setEditPerms(next); setEditPreset(matchRolePreset(next)); }} />
          </div>
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

