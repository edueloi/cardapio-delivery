import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bot,
  Link2,
  MessageSquare,
  Power,
  QrCode,
  RefreshCw,
  Send,
  Smartphone,
  Unplug,
  History,
  Star,
  PackageX,
  Receipt,
  Settings,
} from "lucide-react";
import { Alert, Badge, Button, ContentCard, EmptyState, Input, Switch, Tabs, Textarea } from "../../../../components";
import { apiJson } from "../../../../lib/api";
import type { Tenant, WppBotConfig, WppInstance, WppSessionInfo, WppMessageLog, WppMessageKind } from "../../../../types";

const WPP_TABS = [
  { id: "connection", label: "Conexão", icon: Link2 },
  { id: "config", label: "Configuração", icon: Settings },
  { id: "test", label: "Teste manual", icon: Send },
  { id: "history", label: "Histórico", icon: History },
] as const;
type WppTab = (typeof WPP_TABS)[number]["id"];

interface WppResponse {
  instance: WppInstance | null;
  config: WppBotConfig | null;
  session: WppSessionInfo | null;
}

interface WppFormState {
  instanceName: string;
  welcomeMessage: string;
  botEnabled: boolean;
  autoReplyEnabled: boolean;
  sendOrderCreated: boolean;
  sendStatusUpdates: boolean;
  sendLoyaltyPoints: boolean;
  sendReceiptPdf: boolean;
  sendLowStockAlert: boolean;
  ownerAlertPhone: string;
  isPaused: boolean;
  startTime: string;
  endTime: string;
  preorderMessage: string;
}

const MESSAGE_KIND_LABELS: Record<WppMessageKind, { label: string; emoji: string }> = {
  ORDER_CREATED: { label: "Pedido recebido", emoji: "✅" },
  OWNER_ALERT: { label: "Alerta pro dono", emoji: "🔔" },
  STATUS_UPDATE: { label: "Status do pedido", emoji: "📦" },
  LOYALTY_POINTS: { label: "Pontos de fidelidade", emoji: "⭐" },
  LOW_STOCK: { label: "Estoque baixo", emoji: "⚠️" },
  PREORDER: { label: "Encomenda", emoji: "🗓️" },
  MANUAL_TEST: { label: "Teste manual", emoji: "🧪" },
  CONVERSATION: { label: "Conversa", emoji: "💬" },
  RECEIPT_PDF: { label: "Recibo em PDF", emoji: "🧾" },
};

const STATUS_LABELS: Record<string, string> = {
  not_configured: "Não configurado",
  disconnected: "Desconectado",
  connecting: "Conectando",
  qr_pending: "Aguardando QR Code",
  connected: "Conectado",
};

function getStatusLabel(status?: string | null) {
  return STATUS_LABELS[status || "not_configured"] || status || "Indefinido";
}

function getStatusTone(status?: string | null): "success" | "warning" | "danger" {
  if (status === "connected") return "success";
  if (status === "qr_pending" || status === "connecting") return "warning";
  return "danger";
}

function buildForm(tenant: Tenant, instance: WppInstance | null, config: WppBotConfig | null): WppFormState {
  return {
    instanceName: instance?.instanceName || `${tenant.name} Bot`,
    welcomeMessage: config?.welcomeMessage || "",
    botEnabled: config?.botEnabled || false,
    autoReplyEnabled: config?.autoReplyEnabled ?? true,
    sendOrderCreated: config?.sendOrderCreated ?? true,
    sendStatusUpdates: config?.sendStatusUpdates ?? true,
    sendLoyaltyPoints: config?.sendLoyaltyPoints ?? true,
    sendReceiptPdf: config?.sendReceiptPdf ?? true,
    sendLowStockAlert: config?.sendLowStockAlert ?? false,
    ownerAlertPhone: config?.ownerAlertPhone || "",
    isPaused: config?.isPaused || false,
    startTime: config?.startTime || "00:00",
    endTime: config?.endTime || "23:59",
    preorderMessage: config?.preorderMessage || "",
  };
}

export function WhatsAppOverviewCard({
  tenant,
  onOpenSettings,
}: {
  tenant: Tenant;
  onOpenSettings: () => void;
}) {
  const status = tenant.wppInstance?.status || "not_configured";
  const phone = tenant.wppInstance?.phone;
  const botEnabled = tenant.wppBotConfig?.botEnabled;

  return (
    <div className="rounded-lg bg-[#075E54] text-white p-4 relative overflow-hidden h-full group">
      <div className="relative z-10 flex h-full flex-col">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 sm:w-9 sm:h-9 bg-emerald-500 rounded-lg flex items-center justify-center ">
            <MessageSquare className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-semibold opacity-80">
            Inteligência WhatsApp
          </span>
        </div>

        <div className="space-y-4 flex-1">
          <div className="bg-emerald-900/40 p-4 rounded-lg border border-emerald-400/20 backdrop-blur-sm">
            <div className="text-[10px] text-emerald-300 font-semibold mb-1 opacity-70">Status da Sessão</div>
            <div className="text-sm font-semibold">{getStatusLabel(status)}</div>
            <div className="text-[11px] text-emerald-100/60 mt-2 font-medium">
              {phone ? `📱 ${phone}` : "Conecte seu número oficial para atendimento."}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-[11px] font-semibold">
            <div className="rounded-lg bg-white/10 p-3 border border-white/10 flex flex-col justify-center">
              <div className="opacity-50 mb-1">Status Bot</div>
              <div className="text-xs">{botEnabled ? "ATIVO" : "OFF"}</div>
            </div>
            <div className="rounded-lg bg-white/10 p-3 border border-white/10 flex flex-col justify-center">
              <div className="opacity-50 mb-1">Unidade</div>
              <div className="text-xs truncate">/{tenant.slug}</div>
            </div>
          </div>
        </div>

        <Button
          className="mt-4"
          fullWidth
          variant="outline"
          size="sm"
          iconLeft={<Bot className="w-4 h-4" />}
          onClick={onOpenSettings}
        >
          Configurar Atendimento
        </Button>
      </div>
      <div className="absolute -right-12 -bottom-12 text-emerald-400/10 text-[140px] font-semibold rotate-12 pointer-events-none group-hover:rotate-0 transition-transform duration-700">
        💬
      </div>
    </div>
  );
}

export function WhatsAppManagementPanel({
  tenant,
  onUpdated,
}: {
  tenant: Tenant;
  onUpdated?: () => Promise<void>;
}) {
  const [instance, setInstance] = useState<WppInstance | null>(tenant.wppInstance || null);
  const [config, setConfig] = useState<WppBotConfig | null>(tenant.wppBotConfig || null);
  const [session, setSession] = useState<WppSessionInfo | null>(null);
  const [form, setForm] = useState<WppFormState>(() =>
    buildForm(tenant, tenant.wppInstance || null, tenant.wppBotConfig || null),
  );
  const [testPhone, setTestPhone] = useState(tenant.whatsapp || "");
  const [testMessage, setTestMessage] = useState(
    `Olá! Esta é uma mensagem de teste do bot de ${tenant.name}.`,
  );
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<"" | "refresh" | "connect" | "disconnect" | "save" | "test">("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [logs, setLogs] = useState<WppMessageLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [tab, setTab] = useState<WppTab>("connection");

  const loadLogs = async () => {
    setLogsLoading(true);
    try {
      const data = await apiJson<WppMessageLog[]>(`/api/owner/tenants/${tenant.id}/wpp/logs`);
      setLogs(data);
    } catch { /* histórico é secundário — falha silenciosa */ }
    finally { setLogsLoading(false); }
  };

  useEffect(() => {
    void loadLogs();
  }, [tenant.id]);

  const status = session?.status || instance?.status || "not_configured";
  const qrCode = session?.qrDataUrl || session?.qrCode || instance?.qrCode || null;
  const canPoll = useMemo(
    () => status === "connecting" || status === "qr_pending",
    [status],
  );

  const applyPayload = (payload: WppResponse) => {
    setInstance(payload.instance);
    setConfig(payload.config);
    setSession(payload.session);
    setForm(buildForm(tenant, payload.instance, payload.config));
  };

  const loadData = async (mode: "" | "refresh" = "") => {
    if (mode) setBusyAction(mode);
    if (!mode) setLoading(true);
    setError("");

    try {
      const payload = await apiJson<WppResponse>(`/api/owner/tenants/${tenant.id}/wpp`);
      applyPayload(payload);
    } catch (err: any) {
      setError(err?.message || "Não foi possível carregar a conexão do WhatsApp.");
    } finally {
      if (mode) setBusyAction("");
      if (!mode) setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [tenant.id]);

  useEffect(() => {
    if (!canPoll) return undefined;

    const interval = window.setInterval(() => {
      void loadData("refresh");
    }, 4000);

    return () => window.clearInterval(interval);
  }, [canPoll, tenant.id]);

  const runAction = async (
    action: "connect" | "disconnect" | "save" | "test",
    callback: () => Promise<void>,
  ) => {
    setBusyAction(action);
    setError("");
    setSuccess("");

    try {
      await callback();
    } catch (err: any) {
      setError(err?.message || "Não foi possível concluir a ação.");
    } finally {
      setBusyAction("");
    }
  };

  const connect = async () => {
    await runAction("connect", async () => {
      const payload = await apiJson<{ status: string; phone?: string | null; qrCode?: string | null }>(
        `/api/owner/tenants/${tenant.id}/wpp/connect`,
        { method: "POST" },
      );

      setSession({
        tenantId: tenant.id,
        status: payload.status,
        phone: payload.phone || null,
        qrCode: payload.qrCode || null,
        qrDataUrl: payload.qrCode || null,
      });

      await loadData();
      await onUpdated?.();
      setSuccess("Conexão iniciada. Leia o QR Code no WhatsApp do estabelecimento.");
    });
  };

  const disconnect = async () => {
    await runAction("disconnect", async () => {
      await apiJson<{ success: boolean }>(`/api/owner/tenants/${tenant.id}/wpp/disconnect`, {
        method: "POST",
      });
      await loadData();
      await onUpdated?.();
      setSuccess("Sessão desconectada. Você pode conectar outro número quando quiser.");
    });
  };

  const saveConfig = async () => {
    await runAction("save", async () => {
      const payload = await apiJson<WppResponse>(`/api/owner/tenants/${tenant.id}/wpp/config`, {
        method: "PATCH",
        body: JSON.stringify({
          instanceName: form.instanceName.trim(),
          welcomeMessage: form.welcomeMessage.trim(),
          botEnabled: form.botEnabled,
          autoReplyEnabled: form.autoReplyEnabled,
          sendOrderCreated: form.sendOrderCreated,
          sendStatusUpdates: form.sendStatusUpdates,
          sendLoyaltyPoints: form.sendLoyaltyPoints,
          sendReceiptPdf: form.sendReceiptPdf,
          sendLowStockAlert: form.sendLowStockAlert,
          ownerAlertPhone: form.ownerAlertPhone.trim() || null,
          isPaused: form.isPaused,
          startTime: form.startTime,
          endTime: form.endTime,
          preorderMessage: form.preorderMessage.trim() || null,
        }),
      });

      applyPayload(payload);
      await onUpdated?.();
      setSuccess("Configuração salva com sucesso.");
    });
  };

  const sendTest = async () => {
    await runAction("test", async () => {
      await apiJson<{ success: boolean }>(`/api/owner/tenants/${tenant.id}/wpp/test`, {
        method: "POST",
        body: JSON.stringify({
          phone: testPhone,
          message: testMessage,
        }),
      });
      setSuccess("Mensagem de teste enviada.");
      void loadLogs();
    });
  };

  if (loading) {
    return (
      <ContentCard className="p-8">
        <div className="flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </ContentCard>
    );
  }

  return (
    <div className="space-y-3">
      {(error || success) && (
        <Alert variant={error ? "error" : "success"}>{error || success}</Alert>
      )}
      <Tabs<WppTab> items={WPP_TABS} value={tab} onChange={setTab} label="WhatsApp">
      {tab === "connection" && (
      <div className="space-y-3">
        <ContentCard>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
            <div>
              <div className="text-[11px] text-slate-500 mb-1">
                Sessão Baileys
              </div>
              <h3 className="text-sm font-medium text-slate-900">
                {instance?.instanceName || `${tenant.name} Bot`}
              </h3>
            </div>
            <Badge color={getStatusTone(status)}>{getStatusLabel(status)}</Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
              <div className="flex items-center gap-2 text-slate-500 mb-2">
                <Smartphone className="w-4 h-4" />
                <span className="text-[11px] font-semibold">Número</span>
              </div>
              <div className="text-[13px] font-medium text-slate-900">
                {session?.phone || instance?.phone || "Aguardando conexão"}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
              <div className="flex items-center gap-2 text-slate-500 mb-2">
                <Link2 className="w-4 h-4" />
                <span className="text-[11px] font-semibold">Cardápio</span>
              </div>
              <div className="text-[13px] font-medium text-slate-900 truncate">/{tenant.slug}</div>
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 flex flex-col items-center text-center">
            {qrCode ? (
              <>
                <img
                  src={qrCode}
                  alt={`QR Code do WhatsApp de ${tenant.name}`}
                  className="w-full max-w-[260px] rounded-lg border border-slate-200 bg-white p-3"
                />
                <p className="text-xs font-medium text-slate-700 mt-4">
                  Abra o WhatsApp do estabelecimento e leia este QR Code.
                </p>
              </>
            ) : (
              <>
                <div className="w-20 h-20 rounded-lg bg-white border border-slate-200 flex items-center justify-center mb-4">
                  <QrCode className="w-9 h-9 text-slate-300" />
                </div>
                <p className="text-xs font-medium text-slate-700">
                  O QR Code aparece aqui quando você iniciar a conexão.
                </p>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
            {status !== "connected" && (
              <Button
                fullWidth
                size="sm"
                loading={busyAction === "connect"}
                iconLeft={<Power className="w-4 h-4" />}
                onClick={connect}
              >
                Conectar
              </Button>
            )}
            <Button
              fullWidth
              size="sm"
              variant="outline"
              loading={busyAction === "refresh"}
              iconLeft={<RefreshCw className="w-4 h-4" />}
              onClick={() => void loadData("refresh")}
            >
              Atualizar
            </Button>
            <Button
              fullWidth
              size="sm"
              variant="danger"
              loading={busyAction === "disconnect"}
              iconLeft={<Unplug className="w-4 h-4" />}
              onClick={disconnect}
            >
              Desconectar
            </Button>
          </div>
        </ContentCard>
      </div>
      )}

      {tab === "config" && (
      <div className="space-y-3">
        <ContentCard>
          <div className="mb-4">
            <div className="text-[11px] text-slate-500 mb-1">
              Configuração do Bot
            </div>
              <h3 className="text-sm font-medium text-slate-900">
                Atendimento por estabelecimento
              </h3>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <Input
              label="Nome da conexão"
              value={form.instanceName}
              onChange={(event) =>
                setForm((current) => ({ ...current, instanceName: event.target.value }))
              }
              placeholder={`${tenant.name} Bot`}
            />
            <Input
              label="WhatsApp público (cardápio)"
              value={tenant.whatsapp || ""}
              disabled
              placeholder="Ainda não informado"
              hint="Número exibido pro cliente no cardápio. Edite em Configurações → dados do estabelecimento."
            />
          </div>

          <Input
            label="Telefone para alertas internos"
            value={form.ownerAlertPhone}
            onChange={(event) => setForm((current) => ({ ...current, ownerAlertPhone: event.target.value }))}
            placeholder={tenant.whatsapp || "5511999999999"}
            hint="Quem recebe os avisos de novo pedido e estoque baixo. Deixe em branco para usar o WhatsApp público acima."
            wrapperClassName="mt-4"
          />

{/* Mensagem automática ocultada por enquanto conforme solicitado */}
          {/* <Textarea
            label="Mensagem automática"
            value={form.welcomeMessage}
            onChange={(event) =>
              setForm((current) => ({ ...current, welcomeMessage: event.target.value }))
            }
            rows={5}
            placeholder={`Olá! Aqui é o assistente de ${tenant.name}.`}
            hint="Usada quando o cliente manda mensagem como 'oi', 'menu' ou 'cardápio'."
            wrapperClassName="mt-4"
          /> */}

          <div className="grid md:grid-cols-2 gap-3 mt-4">
            <ToggleCard
              label="Bot ativo"
              description="Permite respostas automáticas no WhatsApp."
              checked={form.botEnabled}
              onCheckedChange={(checked) =>
                setForm((current) => ({ ...current, botEnabled: checked }))
              }
            />
            <ToggleCard
              label="Autoatendimento"
              description="Responde com o link do cardápio e mensagem inicial."
              checked={form.autoReplyEnabled}
              onCheckedChange={(checked) =>
                setForm((current) => ({ ...current, autoReplyEnabled: checked }))
              }
            />
            <ToggleCard
              label="Aviso de novo pedido"
              description="Envia confirmação do pedido para o cliente."
              checked={form.sendOrderCreated}
              onCheckedChange={(checked) =>
                setForm((current) => ({ ...current, sendOrderCreated: checked }))
              }
            />
            <ToggleCard
              label="Atualização de status"
              description="Dispara mudanças como preparo, envio e entrega."
              checked={form.sendStatusUpdates}
              onCheckedChange={(checked) =>
                setForm((current) => ({ ...current, sendStatusUpdates: checked }))
              }
            />
            <ToggleCard
              label="Pontos de fidelidade"
              description="Avisa o cliente quantos pontos ganhou a cada compra."
              icon={<Star className="w-4 h-4 text-amber-500" />}
              checked={form.sendLoyaltyPoints}
              onCheckedChange={(checked) =>
                setForm((current) => ({ ...current, sendLoyaltyPoints: checked }))
              }
            />
            <ToggleCard
              label="Recibo em PDF"
              description="Envia o recibo da venda em PDF quando o pedido é entregue."
              icon={<Receipt className="w-4 h-4 text-emerald-500" />}
              checked={form.sendReceiptPdf}
              onCheckedChange={(checked) =>
                setForm((current) => ({ ...current, sendReceiptPdf: checked }))
              }
            />
            <ToggleCard
              label="Estoque baixo"
              description="Avisa o dono quando um item atinge o estoque mínimo."
              icon={<PackageX className="w-4 h-4 text-red-500" />}
              checked={form.sendLowStockAlert}
              onCheckedChange={(checked) =>
                setForm((current) => ({ ...current, sendLowStockAlert: checked }))
              }
            />
            <ToggleCard
              label="Pausar Bot"
              description="Mantém conectado, mas desativa temporariamente todas as automações."
              checked={form.isPaused}
              onCheckedChange={(checked) =>
                setForm((current) => ({ ...current, isPaused: checked }))
              }
            />
          </div>

          <div className="mt-6 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex items-center gap-2 mb-4">
              <RefreshCw className="w-4 h-4 text-blue-600" />
              <span className="text-[11px] font-medium text-slate-600">Horário de Funcionamento do Bot</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Início"
                type="time"
                value={form.startTime}
                onChange={(e) => setForm(f => ({ ...f, startTime: e.target.value }))}
              />
              <Input
                label="Término"
                type="time"
                value={form.endTime}
                onChange={(e) => setForm(f => ({ ...f, endTime: e.target.value }))}
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-3">
              * O bot só responderá automaticamente e enviará notificações dentro deste intervalo.
            </p>
          </div>

          <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm">📦</span>
              <span className="text-[11px] font-semibold text-slate-600">Mensagem para Encomendas</span>
            </div>
            <p className="text-[11px] text-slate-500 mb-2">Mensagem enviada ao cliente quando o pedido é uma encomenda (com data agendada). Deixe em branco para usar o texto padrão.</p>
            <p className="text-[11px] text-slate-400 mb-2 font-mono">Variáveis: {"{nome}"} {"{data}"} {"{hora}"} {"{total}"}</p>
            <Textarea
              value={form.preorderMessage}
              onChange={e => setForm(f => ({ ...f, preorderMessage: e.target.value }))}
              placeholder={`Ex: Olá, {nome}! Sua encomenda foi recebida 📦\nEntrega prevista para {data} às {hora}.\nTotal: {total}`}
              rows={4}
            />
          </div>

          <div className="mt-4">
            <Button
              size="sm"
              loading={busyAction === "save"}
              iconLeft={<Bot className="w-4 h-4" />}
              onClick={saveConfig}
            >
              Salvar configuração
            </Button>
          </div>
        </ContentCard>

      </div>
      )}

      {tab === "test" && (
      <div className="space-y-3">
        <ContentCard>
          <div className="mb-4">
            <div className="text-[11px] text-slate-500 mb-1">
              Teste Manual
            </div>
              <h3 className="text-sm font-medium text-slate-900">
                Validar envio da sessão
              </h3>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <Input
              label="Telefone de destino"
              value={testPhone}
              onChange={(event) => setTestPhone(event.target.value)}
              placeholder="5511999999999"
              hint="Use DDI e DDD. Ex.: 5511999999999"
            />
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 flex items-center">
              <div>
                <div className="text-[11px] text-slate-500 mb-1">
                  Situação atual
                </div>
                <div className="text-[13px] font-medium text-slate-900">{getStatusLabel(status)}</div>
              </div>
            </div>
          </div>

          <Textarea
            label="Mensagem de teste"
            value={testMessage}
            onChange={(event) => setTestMessage(event.target.value)}
            rows={4}
            wrapperClassName="mt-4"
          />

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              loading={busyAction === "test"}
              iconLeft={<Send className="w-4 h-4" />}
              onClick={sendTest}
            >
              Enviar teste
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setTestMessage(`Olá! Esta é uma mensagem de teste do bot de ${tenant.name}.`)}
            >
              Restaurar texto
            </Button>
          </div>
        </ContentCard>

      </div>
      )}

      {tab === "history" && (
        <MessageHistoryCard logs={logs} loading={logsLoading} onRefresh={() => void loadLogs()} />
      )}
      </Tabs>
    </div>
  );
}

function ToggleCard({
  label,
  description,
  checked,
  onCheckedChange,
  icon,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 flex items-start justify-between gap-3">
      <div>
        <div className="text-[13px] font-medium text-slate-900 flex items-center gap-1.5">
          {icon}
          {label}
        </div>
        <div className="text-[11px] text-slate-500 mt-1">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function formatLogTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function MessageHistoryCard({ logs, loading, onRefresh }: { logs: WppMessageLog[]; loading: boolean; onRefresh: () => void }) {
  return (
    <ContentCard>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[11px] text-slate-500 mb-1">
            Histórico
          </div>
          <h3 className="text-sm font-medium text-slate-900">
            Mensagens enviadas
          </h3>
        </div>
        <Button variant="outline" size="sm" loading={loading} iconLeft={<RefreshCw size={14} />} onClick={onRefresh}>
          Atualizar
        </Button>
      </div>

      {logs.length === 0 ? (
        <EmptyState icon={History} title="Nenhuma mensagem enviada ainda." />

      ) : (
        <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
          {logs.map((log) => {
            const meta = MESSAGE_KIND_LABELS[log.kind] || { label: log.kind, emoji: "💬" };
            return (
              <div key={log.id} className="flex items-start gap-3 py-3">
                <span className="text-lg shrink-0">{meta.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-slate-800">{meta.label}</span>
                    <span className="text-[11px] text-slate-400">→ {log.toPhone}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{log.preview}</p>
                </div>
                <span className="text-[11px] text-slate-500 shrink-0 whitespace-nowrap">{formatLogTime(log.sentAt)}</span>
              </div>
            );
          })}
        </div>
      )}
    </ContentCard>
  );
}
