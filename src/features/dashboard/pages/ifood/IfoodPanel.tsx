import React, { useState, useEffect } from "react";
import {
  Bike, Save, ExternalLink, ShieldCheck, AlertTriangle, Clock,
  ClipboardList, Wallet, Package, ArrowRight,
} from "lucide-react";
import type { Tenant, IfoodConfig } from "../../../../types";
import { apiJson, apiFetch } from "../../../../lib/api";
import { ContentCard, SectionTitle, useToast } from "../../../../components";
import type { DashboardTabId } from "../../types";

interface IfoodPanelProps {
  tenant: Tenant;
  onNavigate?: (tab: DashboardTabId) => void;
}

const STATUS_LABEL: Record<IfoodConfig["status"], { label: string; color: string }> = {
  NOT_CONNECTED:    { label: "Não conectado",        color: "bg-slate-100 text-slate-500" },
  PENDING_APPROVAL: { label: "Aguardando homologação", color: "bg-amber-100 text-amber-700" },
  CONNECTED:        { label: "Conectado",             color: "bg-green-100 text-green-700" },
  ERROR:            { label: "Erro de conexão",       color: "bg-red-100 text-red-700" },
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
    <div className="space-y-6">
      <SectionTitle
        title="Integração iFood"
        description="Conecte sua loja ao iFood para receber pedidos, sincronizar cardápio e financeiro."
        icon={Bike}
      />

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* Status da homologação */}
          <ContentCard>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-amber-500" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-black text-slate-800">Antes de começar: homologação no Portal do Parceiro</h3>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Para receber pedidos automaticamente, você precisa de um <strong>Client ID</strong> e <strong>Client Secret</strong>
                  {" "}gerados no Portal do Parceiro iFood — esse acesso é liberado pelo próprio iFood após aprovação.
                  Preencha os campos abaixo assim que os receber; até lá, a integração fica pronta mas inativa.
                </p>
                <a
                  href="https://portal.ifood.com.br/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold text-[#C9A227] hover:underline"
                >
                  Abrir Portal do Parceiro iFood <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </ContentCard>

          {/* Credenciais */}
          <ContentCard>
            <div className="flex items-center justify-between gap-4 mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[#C9A227]/10 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-6 h-6 text-[#C9A227]" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800">Credenciais da Merchant API</h3>
                  <p className="text-xs text-slate-400">Dados fornecidos pelo iFood após a homologação.</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black uppercase text-slate-400">Ativar integração</span>
                <button
                  onClick={() => setConfig({ ...config, enabled: !config.enabled })}
                  className={`w-12 h-6 rounded-full transition-all relative shrink-0 ${config.enabled ? "bg-green-500" : "bg-slate-200"}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${config.enabled ? "left-7" : "left-1"}`} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Merchant ID</label>
                <input
                  type="text"
                  value={config.merchantId || ""}
                  onChange={e => setConfig({ ...config, merchantId: e.target.value })}
                  placeholder="ID da loja no iFood"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-bold focus:border-[#C9A227] outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Client ID</label>
                <input
                  type="text"
                  value={config.clientId || ""}
                  onChange={e => setConfig({ ...config, clientId: e.target.value })}
                  placeholder="Client ID do Portal do Parceiro"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-bold focus:border-[#C9A227] outline-none transition-all"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Client Secret</label>
                <input
                  type="password"
                  value={clientSecretInput}
                  onChange={e => setClientSecretInput(e.target.value)}
                  placeholder={config.hasClientSecret ? "•••••••••••••••• (já configurado — preencha só para trocar)" : "Client Secret do Portal do Parceiro"}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-bold focus:border-[#C9A227] outline-none transition-all"
                />
              </div>
            </div>

            <div className="mt-8 flex items-center justify-between gap-4 bg-slate-50 rounded-xl p-4">
              <div>
                <p className="text-xs font-bold text-slate-700">Aceitar pedidos automaticamente</p>
                <p className="text-[11px] text-slate-400">Se desativado, cada pedido do iFood aparecerá para confirmação manual.</p>
              </div>
              <button
                onClick={() => setConfig({ ...config, autoAcceptOrders: !config.autoAcceptOrders })}
                className={`w-12 h-6 rounded-full transition-all relative shrink-0 ${config.autoAcceptOrders ? "bg-green-500" : "bg-slate-200"}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${config.autoAcceptOrders ? "left-7" : "left-1"}`} />
              </button>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
              <button
                disabled={saving || loading}
                onClick={handleSave}
                className="bg-[#0D1B3E] hover:bg-slate-800 text-white px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-3 transition-all disabled:opacity-50"
              >
                {saving ? "Salvando..." : (<><Save className="w-4 h-4" /> Salvar Configurações</>)}
              </button>
            </div>
          </ContentCard>
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="bg-gradient-to-br from-[#0D1B3E] to-slate-900 rounded-[2rem] p-6 text-white">
            <h4 className="text-sm font-black mb-4">O que a integração vai fazer</h4>
            <div className="space-y-4">
              {[
                { icon: ClipboardList, text: "Pedidos do iFood caem direto no painel, PDV e cozinha — sem digitar manual." },
                { icon: Package, text: "Cardápio e disponibilidade sincronizados automaticamente com o catálogo do iFood." },
                { icon: Wallet, text: "Repasses e taxas do iFood lançados no financeiro (Entradas e Saídas)." },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                    <item.icon className="w-4 h-4 text-[#C9A227]" />
                  </div>
                  <p className="text-xs text-white/70 leading-relaxed">{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          <ContentCard>
            <div className="flex items-center gap-3 mb-3">
              <Clock className="w-4 h-4 text-slate-400" />
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest">Enquanto isso</h4>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed mb-3">
              Você já pode lançar manualmente os repasses do iFood em <strong>Financeiro → Entradas e Saídas</strong>,
              usando a categoria "iFood" para separar do restante do fluxo de caixa.
            </p>
            {onNavigate && (
              <button onClick={() => onNavigate("entries")}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#C9A227] hover:underline">
                Ir para Entradas e Saídas <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </ContentCard>
        </div>
      </div>
    </div>
  );
}
