import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  ExternalLink,
  Eye,
  EyeOff,
  ImagePlus,
  LogOut,
  ShieldCheck,
  Store,
  UserRound,
} from "lucide-react";
import { Button } from "./Button";
import { DatePicker } from "./DatePicker";
import { Input, Textarea } from "./Input";
import { Modal } from "./Modal";
import { useToast } from "./Toast";
import { apiJson } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Account } from "../types";

interface DashboardAccountMenuProps {
  isOpen: boolean;
  onClose: () => void;
  tenantName: string;
  tenantLogoUrl?: string | null;
  slug: string;
  onSelectTab: (tab: string) => void;
}

type MenuView = "menu" | "profile" | "manual";
type UsernameStatus = "idle" | "checking" | "available" | "taken" | "locked" | "invalid";

interface ProfileFormState {
  name: string;
  email: string;
  username: string;
  phone: string;
  address: string;
  birthDate: string | null;
  avatarUrl: string;
}

const AVATAR_MAX_SIZE_MB = 5;

function normalizeUsername(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "");
}

function maskPhone(value: string): string {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function profileFromAccount(account: Account | null): ProfileFormState {
  return {
    name: account?.name ?? "",
    email: account?.email ?? "",
    username: account?.username ?? "",
    phone: account?.phone ?? "",
    address: account?.address ?? "",
    birthDate: account?.birthDate ?? null,
    avatarUrl: account?.avatarUrl ?? "",
  };
}

export default function DashboardAccountMenu({
  isOpen,
  onClose,
  tenantName,
  tenantLogoUrl,
  slug,
  onSelectTab,
}: DashboardAccountMenuProps) {
  const toast = useToast();
  const { account, refresh, logout } = useAuth();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const usernameTimerRef = useRef<number | null>(null);

  const [view, setView] = useState<MenuView>("menu");
  const [profileForm, setProfileForm] = useState<ProfileFormState>(() => profileFromAccount(account));
  const [profileLoading, setProfileLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [usernameHint, setUsernameHint] = useState("Defina um usuário único para entrar no sistema.");
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });

  const tenantInitial = tenantName?.[0]?.toUpperCase() || "L";
  const usernameLocked = !!account?.username;
  const publicMenuUrl = useMemo(() => `/${slug}`, [slug]);

  useEffect(() => {
    if (!isOpen) {
      setView("menu");
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      return;
    }

    setProfileForm(profileFromAccount(account));
    if (account?.username) {
      setUsernameStatus("locked");
      setUsernameHint("Seu usuário de login já foi definido e não pode mais ser alterado.");
    } else {
      setUsernameStatus("idle");
      setUsernameHint("Defina um usuário único para entrar no sistema.");
    }
  }, [account, isOpen]);

  useEffect(() => {
    if (view !== "profile" || usernameLocked) return;

    const username = normalizeUsername(profileForm.username);
    if (!username) {
      setUsernameStatus("idle");
      setUsernameHint("Defina um usuário único para entrar no sistema.");
      return;
    }

    if (username.length < 3) {
      setUsernameStatus("invalid");
      setUsernameHint("Use pelo menos 3 caracteres.");
      return;
    }

    setUsernameStatus("checking");
    setUsernameHint("Verificando disponibilidade...");

    if (usernameTimerRef.current) {
      window.clearTimeout(usernameTimerRef.current);
    }

    usernameTimerRef.current = window.setTimeout(async () => {
      try {
        const data = await apiJson<{ available: boolean; normalized: string }>(
          `/api/auth/check-username/${encodeURIComponent(username)}`
        );
        setUsernameStatus(data.available ? "available" : "taken");
        setUsernameHint(
          data.available
            ? "Usuário disponível. Depois de salvar, ele fica bloqueado para edição."
            : "Este usuário já está em uso."
        );
      } catch (error) {
        setUsernameStatus("invalid");
        setUsernameHint(error instanceof Error ? error.message : "Não foi possível validar o usuário.");
      }
    }, 450);

    return () => {
      if (usernameTimerRef.current) {
        window.clearTimeout(usernameTimerRef.current);
      }
    };
  }, [profileForm.username, usernameLocked, view]);

  async function loadProfile() {
    setProfileLoading(true);
    try {
      const data = await apiJson<{ account: Account }>("/api/auth/profile");
      setProfileForm(profileFromAccount(data.account));
      if (data.account.username) {
        setUsernameStatus("locked");
        setUsernameHint("Seu usuário de login já foi definido e não pode mais ser alterado.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao carregar perfil.");
    } finally {
      setProfileLoading(false);
    }
  }

  function openProfile() {
    setView("profile");
    setProfileForm(profileFromAccount(account));
    void loadProfile();
  }

  async function handleAvatarSelected(file?: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem JPG, PNG ou WEBP.");
      return;
    }
    if (file.size > AVATAR_MAX_SIZE_MB * 1024 * 1024) {
      toast.error(`A foto deve ter no máximo ${AVATAR_MAX_SIZE_MB} MB.`);
      return;
    }

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const data = await apiJson<{ url: string }>("/api/upload", {
        method: "POST",
        body: formData,
      });
      setProfileForm((current) => ({ ...current, avatarUrl: data.url }));
      toast.success("Foto carregada. Clique em salvar para concluir.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao enviar a foto.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSaveProfile() {
    if (!profileForm.name.trim()) {
      toast.error("Informe seu nome.");
      return;
    }

    if (!usernameLocked) {
      const username = normalizeUsername(profileForm.username);
      if (username && username.length < 3) {
        toast.error("O usuário deve ter pelo menos 3 caracteres.");
        return;
      }
      if (username && usernameStatus === "taken") {
        toast.error("Escolha outro usuário de login.");
        return;
      }
    }

    setSavingProfile(true);
    try {
      await apiJson("/api/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({
          name: profileForm.name.trim(),
          username: normalizeUsername(profileForm.username),
          phone: profileForm.phone,
          address: profileForm.address,
          avatarUrl: profileForm.avatarUrl,
          birthDate: profileForm.birthDate,
        }),
      });
      await refresh();
      await loadProfile();
      toast.success("Perfil atualizado com sucesso.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar perfil.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword() {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast.error("Preencha a senha atual, a nova senha e a confirmação.");
      return;
    }

    setSavingPassword(true);
    try {
      await apiJson("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify(passwordForm),
      });
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      toast.success("Senha alterada com sucesso.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao alterar a senha.");
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleLogout() {
    onClose();
    await logout();
  }

  function renderMenuView() {
    return (
      <div className="space-y-4">
        <div className="relative overflow-hidden rounded-[28px] bg-[#0A1628] p-5 text-white sm:p-6">
          <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-[#C9A227]/10 blur-3xl" />
          <div className="relative flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/10">
              {tenantLogoUrl ? (
                <img src={tenantLogoUrl} alt={tenantName} className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl font-black text-[#C9A227]">{tenantInitial}</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">Estabelecimento ativo</p>
              <h3 className="truncate text-xl font-black">{tenantName}</h3>
              <p className="mt-1 truncate text-xs text-white/55">/{slug}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={openProfile}
            className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-[#C9A227]/40 hover:bg-[#fdf8e8]/40"
          >
            <UserRound className="mb-3 h-5 w-5 text-[#0A1628]" />
            <p className="text-sm font-black text-slate-900">Meu perfil</p>
            <p className="mt-1 text-xs text-slate-500">Foto, telefone, endereço, data, usuário de login e senha.</p>
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectTab("manual");
              onClose();
            }}
            className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-[#C9A227]/40 hover:bg-[#fdf8e8]/40"
          >
            <BookOpen className="mb-3 h-5 w-5 text-[#0A1628]" />
            <p className="text-sm font-black text-slate-900">Manual de Ajuda</p>
            <p className="mt-1 text-xs text-slate-500">Veja o passo a passo detalhado de como operar o sistema.</p>
          </button>

          <button
            type="button"
            onClick={() => window.open(publicMenuUrl, "_blank", "noopener,noreferrer")}
            className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-[#C9A227]/40 hover:bg-[#fdf8e8]/40"
          >
            <ExternalLink className="mb-3 h-5 w-5 text-[#0A1628]" />
            <p className="text-sm font-black text-slate-900">Ver cardápio público</p>
            <p className="mt-1 text-xs text-slate-500">Abra a vitrine do estabelecimento em uma nova aba.</p>
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Conta conectada</p>
              <p className="truncate text-sm font-black text-slate-900">{account?.name || "Conta Box Sys"}</p>
              <p className="truncate text-xs text-slate-500">{account?.email || "Sem e-mail"}</p>
            </div>
            <Button variant="danger" size="sm" iconLeft={<LogOut className="h-3.5 w-3.5" />} onClick={() => void handleLogout()}>
              Sair
            </Button>
          </div>
        </div>
      </div>
    );
  }

  function renderProfileView() {
    return (
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => setView("menu")}
          className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 transition-colors hover:text-slate-700"
        >
          Voltar
        </button>

        <div className="rounded-[28px] border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[22px] border border-slate-200 bg-slate-50">
              {profileForm.avatarUrl ? (
                <img src={profileForm.avatarUrl} alt={profileForm.name || "Perfil"} className="h-full w-full object-cover" />
              ) : (
                <UserRound className="h-10 w-10 text-slate-300" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Foto do perfil</p>
              <h3 className="mt-1 text-lg font-black text-slate-900">{profileForm.name || "Sua conta"}</h3>
              <p className="mt-1 text-xs text-slate-500">JPG, PNG ou WEBP de até {AVATAR_MAX_SIZE_MB} MB.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  loading={uploadingAvatar}
                  iconLeft={<ImagePlus className="h-3.5 w-3.5" />}
                  onClick={() => fileRef.current?.click()}
                >
                  {profileForm.avatarUrl ? "Trocar foto" : "Enviar foto"}
                </Button>
                {profileForm.avatarUrl && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setProfileForm((current) => ({ ...current, avatarUrl: "" }))}
                  >
                    Remover
                  </Button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(event) => void handleAvatarSelected(event.target.files?.[0])}
                />
              </div>
            </div>
          </div>
        </div>

        {profileLoading ? (
          <div className="flex items-center justify-center rounded-3xl border border-slate-200 bg-white py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#C9A227] border-t-transparent" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Nome"
                value={profileForm.name}
                onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Seu nome"
              />
              <Input
                label="E-mail"
                value={profileForm.email}
                disabled
                hint="O e-mail de cadastro não pode ser alterado."
              />
              <Input
                label="Usuário de login"
                value={profileForm.username}
                disabled={usernameLocked}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    username: normalizeUsername(event.target.value),
                  }))
                }
                placeholder="seuusuario"
                hint={usernameHint}
                status={
                  usernameStatus === "available"
                    ? "success"
                    : usernameStatus === "taken" || usernameStatus === "invalid"
                    ? "error"
                    : "default"
                }
                hintClassName={
                  usernameStatus === "available"
                    ? "text-emerald-600 font-bold"
                    : usernameStatus === "taken" || usernameStatus === "invalid"
                    ? "text-red-500 font-bold"
                    : "text-zinc-400"
                }
                wrapperClassName="sm:col-span-2"
              />
              <Input
                label="Telefone"
                value={profileForm.phone}
                onChange={(event) =>
                  setProfileForm((current) => ({
                    ...current,
                    phone: maskPhone(event.target.value),
                  }))
                }
                placeholder="(11) 99999-9999"
              />
              <DatePicker
                label="Data de nascimento"
                value={profileForm.birthDate}
                onChange={(value) => setProfileForm((current) => ({ ...current, birthDate: value }))}
              />
            </div>

            <Textarea
              label="Endereço"
              value={profileForm.address}
              onChange={(event) => setProfileForm((current) => ({ ...current, address: event.target.value }))}
              placeholder="Rua, número, bairro, cidade"
              maxLength={250}
            />

            <div className="rounded-[28px] border border-slate-200 bg-white p-4 sm:p-5">
              <div className="mb-4">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Segurança</p>
                <h3 className="mt-1 text-base font-black text-slate-900">Trocar senha</h3>
                <p className="mt-1 text-xs text-slate-500">Confirme a senha atual e defina uma nova senha de acesso.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Input
                  label="Senha atual"
                  type={showPassword.currentPassword ? "text" : "password"}
                  value={passwordForm.currentPassword}
                  onChange={(event) =>
                    setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))
                  }
                  placeholder="Digite a atual"
                  iconRight={
                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword((current) => ({
                          ...current,
                          currentPassword: !current.currentPassword,
                        }))
                      }
                      className="pointer-events-auto text-zinc-400 hover:text-zinc-700"
                    >
                      {showPassword.currentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                />
                <Input
                  label="Nova senha"
                  type={showPassword.newPassword ? "text" : "password"}
                  value={passwordForm.newPassword}
                  onChange={(event) =>
                    setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))
                  }
                  placeholder="Mínimo 6 caracteres"
                  iconRight={
                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword((current) => ({
                          ...current,
                          newPassword: !current.newPassword,
                        }))
                      }
                      className="pointer-events-auto text-zinc-400 hover:text-zinc-700"
                    >
                      {showPassword.newPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                />
                <Input
                  label="Confirmar nova senha"
                  type={showPassword.confirmPassword ? "text" : "password"}
                  value={passwordForm.confirmPassword}
                  onChange={(event) =>
                    setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))
                  }
                  placeholder="Repita a senha"
                  iconRight={
                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword((current) => ({
                          ...current,
                          confirmPassword: !current.confirmPassword,
                        }))
                      }
                      className="pointer-events-auto text-zinc-400 hover:text-zinc-700"
                    >
                      {showPassword.confirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  }
                />
              </div>

              <div className="mt-4 flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  loading={savingPassword}
                  onClick={() => void handleChangePassword()}
                >
                  Salvar nova senha
                </Button>
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="button" variant="primary" size="lg" loading={savingProfile} onClick={() => void handleSaveProfile()}>
                Salvar perfil
              </Button>
            </div>
          </>
        )}
      </div>
    );
  }

  function renderManualView() {
    const quickLinks = [
      {
        title: "Pedidos em tempo real",
        description: "Acompanhe pendentes, preparo e prontos sem recarregar a página.",
        tab: "live-orders",
      },
      {
        title: "Cardápio",
        description: "Cadastre produtos, categorias, preços e disponibilidade.",
        tab: "menu",
      },
      {
        title: "Estoque",
        description: "Ajuste entradas, saídas e acompanhe os insumos da operação.",
        tab: "inventory",
      },
      {
        title: "Relatórios",
        description: "Confira resultados, histórico e dados para tomada de decisão.",
        tab: "reports",
      },
    ];

    return (
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => setView("menu")}
          className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400 transition-colors hover:text-slate-700"
        >
          Voltar
        </button>

        <div className="rounded-[28px] bg-[#0A1628] p-5 text-white sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[#C9A227]">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">Manual rápido</p>
              <h3 className="mt-1 text-lg font-black">Atalhos principais do sistema</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/70">
                Use os acessos abaixo para ir direto ao fluxo que mais se repete no dia a dia da operação.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {quickLinks.map((item) => (
            <button
              key={item.tab}
              type="button"
              onClick={() => {
                onSelectTab(item.tab);
                onClose();
              }}
              className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-[#C9A227]/40 hover:bg-[#fdf8e8]/40"
            >
              <p className="text-sm font-black text-slate-900">{item.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{item.description}</p>
            </button>
          ))}
        </div>


      </div>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        view === "menu"
          ? "Painel da Conta"
          : view === "profile"
            ? "Meu Perfil"
            : "Manual Rápido"
      }
      size={view === "profile" ? "xl" : "lg"}
      mobileStyle="bottom-sheet"
    >
      {view === "menu" && renderMenuView()}
      {view === "profile" && renderProfileView()}
      {view === "manual" && renderManualView()}
    </Modal>
  );
}
