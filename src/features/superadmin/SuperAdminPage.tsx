import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck, Users, Link as LinkIcon, Plus, Trash2, Copy,
  Clock, CheckCircle2, XCircle, RefreshCw, LogOut, ChevronDown, ChevronUp,
} from "lucide-react";
import { useAuth } from "../../lib/auth";
import { apiFetch, apiJson } from "../../lib/api";
import { Button, Input, Modal, ModalFooter, EmptyState, StatCard, StatGrid } from "../../components";

interface Account {
  id: string;
  name: string;
  email: string;
  isSuperAdmin: boolean;
  createdAt: string;
  memberships: { role: string; tenant: { id: string; name: string; slug: string } }[];
}

interface Invite {
  id: string;
  token: string;
  note: string | null;
  usedAt: string | null;
  usedByEmail: string | null;
  expiresAt: string;
  createdAt: string;
  createdBy: { name: string; email: string };
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function inviteUrl(token: string) {
  return `${window.location.origin}/cadastro/${token}`;
}

function InviteStatusBadge({ invite }: { invite: Invite }) {
  if (invite.usedAt) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-green-100 text-green-700">
        <CheckCircle2 className="w-3 h-3" /> Usado
      </span>
    );
  }
  if (new Date() > new Date(invite.expiresAt)) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-700">
        <XCircle className="w-3 h-3" /> Expirado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
      <Clock className="w-3 h-3" /> Aguardando
    </span>
  );
}

export default function SuperAdminPage() {
  const navigate = useNavigate();
  const { account, logout } = useAuth();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"accounts" | "invites">("invites");

  // modal novo convite
  const [showNewInvite, setShowNewInvite] = useState(false);
  const [inviteNote, setInviteNote] = useState("");
  const [inviteHours, setInviteHours] = useState("48");
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [newInviteUrl, setNewInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // modal confirmar delete
  const [deleteAccountId, setDeleteAccountId] = useState<string | null>(null);
  const [deleteInviteId, setDeleteInviteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // expandir detalhes da conta
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null);

  const isSuperAdmin = (account as any)?.isSuperAdmin;

  useEffect(() => {
    if (!account) return;
    if (!isSuperAdmin) { navigate("/painel"); return; }
    load();
  }, [account]);

  async function load() {
    setLoading(true);
    try {
      const [accRes, invRes] = await Promise.all([
        apiFetch("/api/superadmin/accounts"),
        apiFetch("/api/superadmin/invites"),
      ]);
      const [accData, invData] = await Promise.all([accRes.json(), invRes.json()]);
      setAccounts(accData);
      setInvites(invData);
    } catch {}
    setLoading(false);
  }

  async function handleCreateInvite() {
    setCreatingInvite(true);
    try {
      const invite = await apiJson<Invite>("/api/superadmin/invites", {
        method: "POST",
        body: JSON.stringify({ note: inviteNote.trim() || null, expiresInHours: Number(inviteHours) || 48 }),
      });
      setNewInviteUrl(inviteUrl(invite.token));
      setInvites(prev => [{ ...invite, createdBy: { name: account!.name, email: (account as any).email } }, ...prev]);
      setInviteNote("");
      setInviteHours("48");
    } catch {}
    setCreatingInvite(false);
  }

  async function handleDeleteAccount() {
    if (!deleteAccountId) return;
    setDeleting(true);
    try {
      await apiJson(`/api/superadmin/accounts/${deleteAccountId}`, { method: "DELETE" });
      setAccounts(prev => prev.filter(a => a.id !== deleteAccountId));
    } catch {}
    setDeleting(false);
    setDeleteAccountId(null);
  }

  async function handleRevokeInvite() {
    if (!deleteInviteId) return;
    setDeleting(true);
    try {
      await apiJson(`/api/superadmin/invites/${deleteInviteId}`, { method: "DELETE" });
      setInvites(prev => prev.filter(i => i.id !== deleteInviteId));
    } catch {}
    setDeleting(false);
    setDeleteInviteId(null);
  }

  function copyLink(url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const pendingInvites = invites.filter(i => !i.usedAt && new Date() <= new Date(i.expiresAt));
  const usedInvites = invites.filter(i => !!i.usedAt);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400 text-sm animate-pulse">Carregando painel...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-black text-white">Super Admin</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest">MenuFlow</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={load}
              className="p-2 text-slate-500 hover:text-slate-300 transition-colors"
              title="Atualizar"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => { logout(); navigate("/login"); }}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-red-400 transition-colors"
            >
              <LogOut className="w-4 h-4" /> Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Contas", value: accounts.length, icon: Users, color: "text-blue-400", bg: "bg-blue-500/10" },
            { label: "Convites ativos", value: pendingInvites.length, icon: Clock, color: "text-amber-400", bg: "bg-amber-500/10" },
            { label: "Convites usados", value: usedInvites.length, icon: CheckCircle2, color: "text-green-400", bg: "bg-green-500/10" },
            { label: "Estabelecimentos", value: accounts.reduce((a, c) => a + c.memberships.length, 0), icon: LinkIcon, color: "text-purple-400", bg: "bg-purple-500/10" },
          ].map(s => (
            <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center shrink-0`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <div>
                <p className="text-2xl font-black text-white leading-none">{s.value}</p>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-2xl p-1 w-fit">
          {(["invites", "accounts"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                tab === t ? "bg-amber-500 text-slate-950" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {t === "invites" ? "Convites" : "Contas"}
            </button>
          ))}
        </div>

        {/* ── CONVITES ── */}
        {tab === "invites" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-300 uppercase tracking-widest">Links de Convite</h2>
              <Button
                size="sm"
                onClick={() => { setShowNewInvite(true); setNewInviteUrl(null); }}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black"
              >
                <Plus className="w-4 h-4 mr-1" /> Gerar convite
              </Button>
            </div>

            {invites.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center">
                <p className="text-slate-500 text-sm">Nenhum convite gerado ainda.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {invites.map(invite => {
                  const url = inviteUrl(invite.token);
                  const used = !!invite.usedAt;
                  const expired = !used && new Date() > new Date(invite.expiresAt);
                  const active = !used && !expired;

                  return (
                    <div
                      key={invite.id}
                      className={`bg-slate-900 border rounded-2xl p-4 transition-all ${
                        active ? "border-amber-500/30" : "border-slate-800 opacity-60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <InviteStatusBadge invite={invite} />
                            {invite.note && (
                              <span className="text-xs text-slate-400 font-medium">{invite.note}</span>
                            )}
                          </div>

                          {active && (
                            <div className="flex items-center gap-2 mt-2">
                              <code className="text-[11px] text-amber-400 bg-slate-800 px-2 py-1 rounded-lg truncate max-w-xs font-mono">
                                {url}
                              </code>
                              <button
                                onClick={() => copyLink(url)}
                                className="p-1.5 text-slate-500 hover:text-amber-400 transition-colors shrink-0"
                                title="Copiar link"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                          <div className="flex items-center gap-3 text-[10px] text-slate-600 flex-wrap mt-1">
                            <span>Criado {fmtDate(invite.createdAt)}</span>
                            <span>Expira {fmtDate(invite.expiresAt)}</span>
                            {invite.usedByEmail && <span>Usado por <span className="text-slate-400">{invite.usedByEmail}</span></span>}
                          </div>
                        </div>

                        {!used && (
                          <button
                            onClick={() => setDeleteInviteId(invite.id)}
                            className="p-2 text-slate-600 hover:text-red-400 transition-colors shrink-0"
                            title="Revogar convite"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── CONTAS ── */}
        {tab === "accounts" && (
          <div className="space-y-4">
            <h2 className="text-sm font-black text-slate-300 uppercase tracking-widest">Contas Cadastradas</h2>

            {accounts.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center">
                <p className="text-slate-500 text-sm">Nenhuma conta encontrada.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {accounts.map(acc => {
                  const isMe = acc.id === (account as any)?.id;
                  const expanded = expandedAccount === acc.id;
                  return (
                    <div key={acc.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                      <div className="flex items-center gap-4 p-4">
                        <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 text-sm font-black text-slate-400">
                          {acc.name[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-black text-white">{acc.name}</p>
                            {acc.isSuperAdmin && (
                              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                Super Admin
                              </span>
                            )}
                            {isMe && (
                              <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-blue-500/20 text-blue-400">
                                Você
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500">{acc.email}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-slate-600">{acc.memberships.length} tenant{acc.memberships.length !== 1 ? "s" : ""}</span>
                          <button
                            onClick={() => setExpandedAccount(expanded ? null : acc.id)}
                            className="p-1.5 text-slate-600 hover:text-slate-300 transition-colors"
                          >
                            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                          {!isMe && !acc.isSuperAdmin && (
                            <button
                              onClick={() => setDeleteAccountId(acc.id)}
                              className="p-1.5 text-slate-600 hover:text-red-400 transition-colors"
                              title="Remover conta"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {expanded && acc.memberships.length > 0 && (
                        <div className="border-t border-slate-800 px-4 pb-4 pt-3 space-y-1.5">
                          {acc.memberships.map(m => (
                            <div key={m.tenant.id} className="flex items-center justify-between text-xs">
                              <span className="text-slate-400 font-bold">{m.tenant.name}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-600 font-mono">/{m.tenant.slug}</span>
                                <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-500">
                                  {m.role}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal: Gerar convite */}
      <Modal
        isOpen={showNewInvite}
        onClose={() => { setShowNewInvite(false); setNewInviteUrl(null); }}
        title="Gerar link de convite"
      >
        <p className="text-sm text-slate-500 -mt-2 mb-4">O link pode ser usado <strong>uma única vez</strong> para criar uma conta no sistema.</p>
        {newInviteUrl ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center space-y-3">
              <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto" />
              <p className="text-sm font-black text-green-800">Convite gerado com sucesso!</p>
              <code className="text-xs text-green-700 break-all font-mono">{newInviteUrl}</code>
            </div>
            <Button
              fullWidth
              onClick={() => copyLink(newInviteUrl)}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black"
            >
              <Copy className="w-4 h-4 mr-2" />
              {copied ? "Copiado!" : "Copiar link"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              label="Observação (opcional)"
              value={inviteNote}
              onChange={e => setInviteNote(e.target.value)}
              placeholder="Ex: Para João da Pizzaria Central"
              hint="Ajuda a identificar para quem foi gerado"
            />
            <div>
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider block mb-1.5">
                Validade do link
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "1h", value: "1" },
                  { label: "24h", value: "24" },
                  { label: "48h", value: "48" },
                  { label: "7 dias", value: "168" },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setInviteHours(opt.value)}
                    className={`py-2 rounded-xl text-xs font-black border transition-all ${
                      inviteHours === opt.value
                        ? "bg-amber-500 border-amber-500 text-white"
                        : "border-slate-200 text-slate-600 hover:border-amber-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {!newInviteUrl && (
          <ModalFooter>
            <Button variant="ghost" onClick={() => setShowNewInvite(false)}>Cancelar</Button>
            <Button
              loading={creatingInvite}
              onClick={handleCreateInvite}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black"
            >
              Gerar link
            </Button>
          </ModalFooter>
        )}
      </Modal>

      {/* Modal: Confirmar remover conta */}
      <Modal
        isOpen={!!deleteAccountId}
        onClose={() => setDeleteAccountId(null)}
        title="Remover conta"
      >
        <p className="text-sm text-slate-500 -mt-2 mb-4">Esta ação é irreversível. A conta e todos os dados associados serão removidos.</p>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setDeleteAccountId(null)}>Cancelar</Button>
          <Button variant="danger" loading={deleting} onClick={handleDeleteAccount}>
            Remover conta
          </Button>
        </ModalFooter>
      </Modal>

      {/* Modal: Confirmar revogar convite */}
      <Modal
        isOpen={!!deleteInviteId}
        onClose={() => setDeleteInviteId(null)}
        title="Revogar convite"
      >
        <p className="text-sm text-slate-500 -mt-2 mb-4">O link será invalidado e não poderá mais ser usado para criar conta.</p>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setDeleteInviteId(null)}>Cancelar</Button>
          <Button variant="danger" loading={deleting} onClick={handleRevokeInvite}>
            Revogar convite
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
