import React, { useState, useEffect } from "react";
import {
  Bike, Save, ExternalLink, ShieldCheck, AlertTriangle, Clock,
  ClipboardList, Wallet, Package, ArrowRight,
} from "lucide-react";
import type { Tenant, IfoodConfig } from "../../../../types";
import { apiJson, apiFetch } from "../../../../lib/api";
import { ContentCard, PageWrapper, SectionTitle, Button, Input, Switch, Badge, useToast } from "../../../../components";
import type { DashboardTabId } from "../../types";

interface IfoodPanelProps {
  tenant: Tenant;
  onNavigate?: (tab: DashboardTabId) => void;
}

const STATUS_LABEL: Record<IfoodConfig["status"], { label: string; color: "default" | "warning" | "success" | "danger" }> = {
  NOT_CONNECTED:    { label: "Não conectado",        color: "default" },
  PENDING_APPROVAL: { label: "Aguardando homologação", color: "warning" },
  CONNECTED:        { label: "Conectado",             color: "success" },
  ERROR:            { label: "Erro de conexão",       color: "danger" },
};

export default function IfoodPanel({ tenant, onNavigate }: IfoodPanelProps) {
  const toast = useToast();
  const [config, setConfig] = useState<IfoodConfig>({
    enabled: false,
    merchantId: null,
    clientId: null,
    autoAcceptOrders: false,
    status: "NOT_CONNECTED",
  });
  const [clientSecretInput, setClientSecretInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiJson<IfoodConfig | null>(`/api/admin/${tenant.id}/ifood/config`);
        if (data) setConfig(data);
      } catch (err) {
        console.error("Erro ao buscar configuração do iFood", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [tenant.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: any = {
        enabled: config.enabled,
        merchantId: config.merchantId,
        clientId: config.clientId,
        autoAcceptOrders: config.autoAcceptOrders,
      };
      if (clientSecretInput) body.clientSecret = clientSecretInput;

      const updated = await apiJson<IfoodConfig>(`/api/admin/${tenant.id}/ifood/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setConfig(updated);
      setClientSecretInput("");
      toast.success("Configuração do iFood salva!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar configuração.");
    } finally {
      setSaving(false);
    }
  };

  const statusInfo = STATUS_LABEL[config.status] || STATUS_LABEL.NOT_CONNECTED;

  return (
    <PageWrapper>
      <div className="space-y-4">
        <SectionTitle
          title="Integração iFood"
          description="Conecte sua loja ao iFood para receber pedidos, sincronizar cardápio e financeiro."
          icon={Bike}
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="min-w-0 space-y-4 lg:col-span-2">
            {/* Status da homologação */}
            <ContentCard>
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-medium text-slate-800">Antes de começar: homologação no Portal do Parceiro</h3>
                    <Badge color={statusInfo.color} dot>{statusInfo.label}</Badge>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">
                    Para receber pedidos automaticamente, você precisa de um <strong>Client ID</strong> e <strong>Client Secret</strong>
                    {" "}gerados no Portal do Parceiro iFood — esse acesso é liberado pelo próprio iFood após aprovação.
                    Preencha os campos abaixo assim que os receber; até lá, a integração fica pronta mas inativa.
                  </p>
                  <a
                    href="https://portal.ifood.com.br/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline"
                  >
                    Abrir Portal do Parceiro iFood <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </ContentCard>

            {/* Credenciais */}
            <ContentCard>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50">
                    <ShieldCheck className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-slate-800">Credenciais da Merchant API</h3>
                    <p className="text-[11px] text-slate-500">Dados fornecidos pelo iFood após a homologação.</p>
                  </div>
                </div>
                <Switch
                  checked={config.enabled}
                  onCheckedChange={(v) => setConfig({ ...config, enabled: v })}
                  label="Ativar integração"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Merchant ID"
                  type="text"
                  value={config.merchantId || ""}
                  onChange={e => setConfig({ ...config, merchantId: e.target.value })}
                  placeholder="ID da loja no iFood"
                />
                <Input
                  label="Client ID"
                  type="text"
                  value={config.clientId || ""}
                  onChange={e => setConfig({ ...config, clientId: e.target.value })}
                  placeholder="Client ID do Portal do Parceiro"
                />
                <Input
                  wrapperClassName="sm:col-span-2"
                  label="Client Secret"
                  type="password"
                  value={clientSecretInput}
                  onChange={e => setClientSecretInput(e.target.value)}
                  placeholder={config.hasClientSecret ? "•••••••••••••••• (já configurado — preencha só para trocar)" : "Client Secret do Portal do Parceiro"}
                />
              </div>

              <div className="mt-5 rounded-lg bg-slate-50 p-3">
                <Switch
                  checked={config.autoAcceptOrders}
                  onCheckedChange={(v) => setConfig({ ...config, autoAcceptOrders: v })}
                  label="Aceitar pedidos automaticamente"
                  description="Se desativado, cada pedido do iFood aparecerá para confirmação manual."
                />
              </div>

              <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
                <Button
                  disabled={saving || loading}
                  onClick={handleSave}
                  loading={saving}
                  iconLeft={<Save size={14} />}
                >
                  {saving ? "Salvando..." : "Salvar Configurações"}
                </Button>
              </div>
            </ContentCard>
          </div>

          <div className="min-w-0 space-y-4">
            <ContentCard>
              <h4 className="mb-3 text-sm font-medium text-slate-800">O que a integração vai fazer</h4>
              <div className="space-y-3">
                {[
                  { icon: ClipboardList, text: "Pedidos do iFood caem direto no painel, PDV e cozinha — sem digitar manual." },
                  { icon: Package, text: "Cardápio e disponibilidade sincronizados automaticamente com o catálogo do iFood." },
                  { icon: Wallet, text: "Repasses e taxas do iFood lançados no financeiro (Entradas e Saídas)." },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                      <item.icon className="h-3.5 w-3.5 text-blue-600" />
                    </div>
                    <p className="text-xs leading-relaxed text-slate-500">{item.text}</p>
                  </div>
                ))}
              </div>
            </ContentCard>

            <ContentCard>
              <div className="mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-400" />
                <h4 className="text-sm font-medium text-slate-800">Enquanto isso</h4>
              </div>
              <p className="mb-3 text-xs leading-relaxed text-slate-500">
                Você já pode lançar manualmente os repasses do iFood em <strong>Financeiro → Entradas e Saídas</strong>,
                usando a categoria "iFood" para separar do restante do fluxo de caixa.
              </p>
              {onNavigate && (
                <Button variant="outline" size="sm" onClick={() => onNavigate("entries")}
                  iconRight={<ArrowRight size={14} />}>
                  Ir para Entradas e Saídas
                </Button>
              )}
            </ContentCard>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
