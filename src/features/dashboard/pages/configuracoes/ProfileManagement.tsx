import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  AlertTriangle,
  AlertCircle,
  Banknote,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Clock3,
  CreditCard,
  FileText,
  FileDown,
  FlaskConical,
  Info,
  MapPin,
  Monitor,
  Package,
  PackageCheck,
  Plus,
  QrCode,
  Rocket,
  Ruler,
  Smartphone,
  Sparkles,
  Store,
  Ticket,
  Trash2,
  Truck,
  User,
  Utensils,
  Wallet,
  X,
} from "lucide-react";
import {
  Button,
  IconButton,
  ContentCard,
  FilterLineSegmented,
  Tabs,
  Input,
  PageWrapper,
  PanelCard,
  FormRow,
  Alert,
  Badge,
  EmptyState,
  Select,
  SectionTitle,
  Switch,
  Textarea,
  useToast,
} from "../../../../components";
import { apiJson } from "../../../../lib/api";
import {
  DeliveryConfig,
  DEFAULT_PRINTING_CONFIG,
  FiscalConfig,
  KmRange,
  PaymentConfig,
  PaymentMethodConfig,
  PrintingConfig,
  StoneConfig,
  CieloConfig,
  Tenant,
} from "../../../../types";
import {
  buildAddressString,
  CARD_BRANDS_LIST,
  CondominiumsCard,
  DAY_KEYS_UI,
  DAY_LABELS,
  DEFAULT_HOURS,
  DEFAULT_PAYMENTS,
  DesktopPrinterSettings,
  EMPTY_ADDR,
  ImageUploader,
  KitchenAccessRequestsCard,
  KitchenPasswordCard,
  KitchenStaffCard,
  KmRangeAdder,
  maskPhone,
  parseAddress,
  parseScheduleDays,
  TimeInput,
  type AddressForm,
  unmaskPhone,
  ZoneAdder,
  fmt,
} from "../_shared/ManagementShared";

// Campo livre de UF na Localização deixava o usuário digitar "São Paulo" e travar
// em "SÃ" (o onChange truncava pros 2 primeiros caracteres a cada tecla, sem
// limpar o campo antes) — um dropdown com os códigos oficiais elimina isso de vez.
const UF_OPTIONS = [
  { value: "AC", label: "AC — Acre" },
  { value: "AL", label: "AL — Alagoas" },
  { value: "AP", label: "AP — Amapá" },
  { value: "AM", label: "AM — Amazonas" },
  { value: "BA", label: "BA — Bahia" },
  { value: "CE", label: "CE — Ceará" },
  { value: "DF", label: "DF — Distrito Federal" },
  { value: "ES", label: "ES — Espírito Santo" },
  { value: "GO", label: "GO — Goiás" },
  { value: "MA", label: "MA — Maranhão" },
  { value: "MT", label: "MT — Mato Grosso" },
  { value: "MS", label: "MS — Mato Grosso do Sul" },
  { value: "MG", label: "MG — Minas Gerais" },
  { value: "PA", label: "PA — Pará" },
  { value: "PB", label: "PB — Paraíba" },
  { value: "PR", label: "PR — Paraná" },
  { value: "PE", label: "PE — Pernambuco" },
  { value: "PI", label: "PI — Piauí" },
  { value: "RJ", label: "RJ — Rio de Janeiro" },
  { value: "RN", label: "RN — Rio Grande do Norte" },
  { value: "RS", label: "RS — Rio Grande do Sul" },
  { value: "RO", label: "RO — Rondônia" },
  { value: "RR", label: "RR — Roraima" },
  { value: "SC", label: "SC — Santa Catarina" },
  { value: "SP", label: "SP — São Paulo" },
  { value: "SE", label: "SE — Sergipe" },
  { value: "TO", label: "TO — Tocantins" },
];

const SETTINGS_TABS = [
  { id: "general", label: "Loja", icon: Store },
  { id: "address", label: "Endereço", icon: MapPin },
  { id: "service", label: "Atendimento", icon: Info },
  { id: "orders", label: "Pedidos", icon: PackageCheck },
  { id: "pdv", label: "PDV e impressão", icon: Monitor },
  { id: "kitchen", label: "Cozinha e TV", icon: Utensils },
  {
    id: "hours",
    label: "Horários",
    icon: Clock3,
  },
  {
    id: "delivery",
    label: "Entrega",
    icon: Truck,
  },
  {
    id: "payments",
    label: "Pagamentos",
    icon: Wallet,
  },
  {
    id: "maquinhas",
    label: "Maquininhas",
    icon: Smartphone,
  },
  {
    id: "fiscal",
    label: "Fiscal",
    icon: FileText,
  },
] as const;

type SettingsTabId = typeof SETTINGS_TABS[number]["id"];
const STORE_TAB_IDS: readonly SettingsTabId[] = ["general", "address", "service", "orders", "pdv", "kitchen"];

const DELIVERY_MODES = [
  { id: "free", label: "Grátis", icon: CheckCircle2 },
  { id: "fixed", label: "Taxa Fixa", icon: CircleDollarSign },
  { id: "zones", label: "Por Bairro/CEP", icon: Truck },
  { id: "km", label: "Por Distância (KM)", icon: Ruler },
] as const;
type DeliveryModeId = typeof DELIVERY_MODES[number]["id"];

const MACHINE_TABS = [
  { id: "terminals", label: "Terminais", icon: Smartphone },
  { id: "fees", label: "Taxas", icon: CircleDollarSign },
] as const;
type MachineTabId = typeof MACHINE_TABS[number]["id"];

const FISCAL_TABS = [
  { id: "issuer", label: "Emitente", icon: Store },
  { id: "emission", label: "Emissão", icon: Rocket },
  { id: "credentials", label: "Credenciais", icon: FileText },
] as const;
type FiscalTabId = typeof FISCAL_TABS[number]["id"];

function SettingRow({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-slate-800">{title}</p>
        {description && <p className="mt-0.5 text-[11px] text-slate-500">{description}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-3">{children}</div>
    </div>
  );
}

export function ProfileManagement({ tenant, refresh }: { tenant: Tenant | null, refresh: () => void }) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTabId>("general");
  const [form, setForm] = useState({
    name: tenant?.name || "",
    description: tenant?.description || "",
    logoUrl: tenant?.logoUrl || "",
    whatsapp: maskPhone(tenant?.whatsapp) || "",
    isOpen: tenant?.isOpen ?? true,
    isDeliveryOpen: tenant?.isDeliveryOpen ?? true,
    counterTicketMode: (tenant?.counterTicketMode ?? "TICKET") as "TICKET" | "NAME",
    orderMode: (tenant?.orderMode ?? "DELIVERY_ONLY") as "DELIVERY_ONLY" | "PREORDER_ONLY" | "BOTH",
    scheduleMode: tenant?.scheduleMode ?? false,
    scheduleType: (tenant?.scheduleType ?? "CLIENT_CHOOSES") as "CLIENT_CHOOSES" | "OWNER_DEFINES",
    scheduleNotes: tenant?.scheduleNotes || "",
    waiterNotifyOnReady: tenant?.waiterNotifyOnReady ?? true,
    requireCashRegister: tenant?.requireCashRegister ?? true,
    receiptPaperWidth: (tenant?.receiptPaperWidth ?? 80) as 58 | 80,
  });
  const [scheduleDays, setScheduleDays] = useState<any[]>(() => parseScheduleDays(tenant?.scheduleDays));
  const [addr, setAddr] = useState<AddressForm>(() => parseAddress(tenant?.address) ?? { ...EMPTY_ADDR });
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState("");
  const [hours, setHours] = useState<Record<string, { enabled: boolean; open: string; close: string; breakEnabled?: boolean; breakStart?: string; breakEnd?: string }>>(() => {
    try { return tenant?.businessHours ? JSON.parse(tenant.businessHours) : DEFAULT_HOURS; } catch { return DEFAULT_HOURS; }
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [machineTab, setMachineTab] = useState<MachineTabId>("terminals");
  const [fiscalTab, setFiscalTab] = useState<FiscalTabId>("issuer");

  const parseDeliveryConfig = (raw?: string | null): DeliveryConfig => {
    try { return raw ? JSON.parse(raw) : { mode: "free" }; } catch { return { mode: "free" }; }
  };

  const [delivery, setDelivery] = useState<DeliveryConfig>(() => parseDeliveryConfig(tenant?.deliveryConfig));

  const [payments, setPayments] = useState<PaymentConfig>(() => {
    try { return tenant?.paymentMethods ? JSON.parse(tenant.paymentMethods) : DEFAULT_PAYMENTS; } catch { return DEFAULT_PAYMENTS; }
  });

  const DEFAULT_STONE: StoneConfig = { enabled: false, secretKey: "", stonecode: "" };
  const [stone, setStone] = useState<StoneConfig>(() => {
    try { return tenant?.stoneConfig ? JSON.parse(tenant.stoneConfig) : DEFAULT_STONE; } catch { return DEFAULT_STONE; }
  });

  const DEFAULT_CIELO: CieloConfig = { enabled: false, merchantId: "" };
  const [cielo, setCielo] = useState<CieloConfig>(() => {
    try { return tenant?.cieloConfig ? JSON.parse(tenant.cieloConfig) : DEFAULT_CIELO; } catch { return DEFAULT_CIELO; }
  });

  const DEFAULT_FISCAL: FiscalConfig = {
    enabled: false, ambiente: "homologacao", cnpj: "", ie: "", crt: "1",
    serie: 1, proximoNumero: 1, autoEmitNfce: false, autoPrintDanfe: false, uf: "SP", cMun: "3550308", xMun: "São Paulo",
  };
  // Migração transparente: configs salvas antes da separação de CSC por ambiente tinham
  // só "csc"/"cscId" (implicitamente do ambiente configurado na época) — copia esse valor
  // legado pro par do ambiente que estava configurado, sem apagar o legado. Extraída como
  // função (em vez de só no inicializador do useState) porque precisa rodar TODA VEZ que
  // "fiscal" é resincronizado a partir de "tenant" (no useEffect abaixo) — antes só rodava
  // na primeira montagem, então um reload de tenant (ex: logo após salvar) sobrescrevia os
  // campos novos com "undefined" de volta, aparentando "sumir" o CSC de homologação na tela
  // (o valor legado no banco nunca foi apagado, só a exibição ficava errada).
  function migrarFiscal(parsed: FiscalConfig): FiscalConfig {
    if (parsed.csc && !parsed.cscHomologacao && !parsed.cscProducao) {
      const key = parsed.ambiente === "producao" ? "cscProducao" : "cscHomologacao";
      const keyId = parsed.ambiente === "producao" ? "cscIdProducao" : "cscIdHomologacao";
      return { ...parsed, autoEmitNfce: parsed.autoEmitNfce ?? false, autoPrintDanfe: parsed.autoPrintDanfe ?? false, [key]: parsed.csc, [keyId]: parsed.cscId };
    }
    return { ...parsed, autoEmitNfce: parsed.autoEmitNfce ?? false, autoPrintDanfe: parsed.autoPrintDanfe ?? false };
  }
  const [fiscal, setFiscal] = useState<FiscalConfig>(() => {
    try { return migrarFiscal(tenant?.fiscalConfig ? JSON.parse(tenant.fiscalConfig) : DEFAULT_FISCAL); }
    catch { return DEFAULT_FISCAL; }
  });

  const [printing, setPrinting] = useState<PrintingConfig>(() => {
    try { return tenant?.printingConfig ? { ...DEFAULT_PRINTING_CONFIG, ...JSON.parse(tenant.printingConfig) } : DEFAULT_PRINTING_CONFIG; }
    catch { return DEFAULT_PRINTING_CONFIG; }
  });

  useEffect(() => {
    if (tenant) {
      setForm({ name: tenant.name || "", description: tenant.description || "", logoUrl: tenant.logoUrl || "", whatsapp: maskPhone(tenant.whatsapp) || "", isOpen: tenant.isOpen ?? true, isDeliveryOpen: tenant.isDeliveryOpen ?? true, counterTicketMode: (tenant.counterTicketMode ?? "TICKET") as "TICKET" | "NAME", orderMode: (tenant.orderMode ?? "DELIVERY_ONLY") as "DELIVERY_ONLY" | "PREORDER_ONLY" | "BOTH", scheduleMode: tenant.scheduleMode ?? false, scheduleType: (tenant.scheduleType ?? "CLIENT_CHOOSES") as "CLIENT_CHOOSES" | "OWNER_DEFINES", scheduleNotes: tenant.scheduleNotes || "", waiterNotifyOnReady: tenant.waiterNotifyOnReady ?? true, requireCashRegister: tenant.requireCashRegister ?? true, receiptPaperWidth: (tenant.receiptPaperWidth ?? 80) as 58 | 80 });
      setScheduleDays(parseScheduleDays(tenant.scheduleDays));
      try { setPrinting(tenant.printingConfig ? { ...DEFAULT_PRINTING_CONFIG, ...JSON.parse(tenant.printingConfig) } : DEFAULT_PRINTING_CONFIG); } catch { setPrinting(DEFAULT_PRINTING_CONFIG); }
      setAddr(parseAddress(tenant.address) ?? { ...EMPTY_ADDR });
      try { setHours(tenant.businessHours ? JSON.parse(tenant.businessHours) : DEFAULT_HOURS); } catch { setHours(DEFAULT_HOURS); }
      setDelivery(parseDeliveryConfig(tenant.deliveryConfig));
      try { setPayments(tenant.paymentMethods ? JSON.parse(tenant.paymentMethods) : DEFAULT_PAYMENTS); } catch { setPayments(DEFAULT_PAYMENTS); }
      try { setStone(tenant.stoneConfig ? JSON.parse(tenant.stoneConfig) : DEFAULT_STONE); } catch { setStone(DEFAULT_STONE); }
      try { setCielo(tenant.cieloConfig ? JSON.parse(tenant.cieloConfig) : DEFAULT_CIELO); } catch { setCielo(DEFAULT_CIELO); }
      try { setFiscal(migrarFiscal(tenant.fiscalConfig ? JSON.parse(tenant.fiscalConfig) : DEFAULT_FISCAL)); } catch { setFiscal(DEFAULT_FISCAL); }
    }
  }, [tenant]);

  // Alterações não salvas: compara o estado atual com o último estado vindo do tenant.
  const currentSnapshot = JSON.stringify({ form, scheduleDays, addr, hours, delivery, payments, stone, cielo, fiscal, printing });
  const [baseline, setBaseline] = useState<string | null>(null);
  const [syncVersion, setSyncVersion] = useState(0);
  const baselineVersionRef = React.useRef(-1);
  useEffect(() => { setSyncVersion(v => v + 1); }, [tenant]);
  useEffect(() => {
    if (baselineVersionRef.current !== syncVersion) {
      baselineVersionRef.current = syncVersion;
      setBaseline(currentSnapshot);
    }
  }, [currentSnapshot, syncVersion]);
  const dirty = baseline !== null && currentSnapshot !== baseline;

  const fetchCep = async (cep: string) => {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepLoading(true);
    setCepError("");
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (data.erro) { setCepError("CEP não encontrado."); return; }
      setAddr(a => ({ ...a, cep: digits, street: data.logradouro || a.street, neighborhood: data.bairro || a.neighborhood, city: data.localidade || a.city, state: data.uf || a.state, country: "Brasil" }));
    } catch { setCepError("Erro ao buscar CEP."); }
    finally { setCepLoading(false); }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await apiJson(`/api/owner/tenants/${tenant?.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...form,
          whatsapp: unmaskPhone(form.whatsapp),
          address: JSON.stringify(addr),
          businessHours: JSON.stringify(hours),
          deliveryConfig: JSON.stringify(delivery),
          paymentMethods: JSON.stringify(payments),
          stoneConfig: JSON.stringify(stone),
          cieloConfig: JSON.stringify(cielo),
          fiscalConfig: JSON.stringify(fiscal),
          printingConfig: JSON.stringify(printing),
          scheduleDays: JSON.stringify(scheduleDays),
        })
      });
      await refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  const setDay = (day: string, field: string, value: any) =>
    setHours(h => ({ ...h, [day]: { ...h[day], [field]: value } }));

  const setA = (field: keyof AddressForm, value: string) => setAddr(a => ({ ...a, [field]: value }));

  return (
    <PageWrapper>
      <div className="space-y-4">
      <SectionTitle
        title="Configurações"
        description="Dados da loja, funcionamento e integrações de pagamento"
        icon={Store}
      />

      <Tabs<SettingsTabId> items={SETTINGS_TABS} value={activeTab} onChange={setActiveTab} label="Configurações da loja">
      <form id="settings-content" onSubmit={handleUpdate} className="space-y-4">
        {STORE_TAB_IDS.includes(activeTab) && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <>
              {(activeTab === "general" || activeTab === "address") && (
                <div className="space-y-4">
                  {activeTab === "general" && (
                  <PanelCard title="Identidade da loja" description="Nome, logo e contato exibidos no cardápio digital." icon={Store}>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <ImageUploader label="Logo / Imagem da Unidade" value={form.logoUrl} onChange={(val) => setForm({...form, logoUrl: val})} description="Aparecerá no topo do cardápio digital." />
                      <div className="space-y-3 md:col-span-2">
                        <FormRow cols={2}>
                          <Input label="Nome do estabelecimento" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Ex: Pastel do Edu" />
                          <Input label="WhatsApp de contato" value={form.whatsapp} onChange={e => setForm({...form, whatsapp: maskPhone(e.target.value)})} placeholder="(00) 00000-0000" hint="Digite apenas o DDD + Número" />
                        </FormRow>
                        <Input label="Slogan / Descrição curta" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Ex: Os melhores pastéis da cidade" />
                      </div>
                    </div>
                  </PanelCard>
                  )}

                  {activeTab === "address" && (
                  <PanelCard title="Endereço" description="Localização da loja. Digite o CEP para preencher automaticamente." icon={MapPin}>
                    <div className="space-y-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <Input
                          label="CEP"
                          value={addr.cep}
                          onChange={e => { setA("cep", e.target.value); setCepError(""); }}
                          onBlur={e => fetchCep(e.target.value)}
                          placeholder="00000-000"
                          wrapperClassName="w-full sm:w-44"
                          error={cepError || undefined}
                        />
                        <Button type="button" variant="outline" size="sm" loading={cepLoading}
                          onClick={() => fetchCep(addr.cep)} className="w-full sm:w-auto mb-0.5">
                          Buscar CEP
                        </Button>
                      </div>

                      <FormRow cols={3}>
                        <Input label="Logradouro" value={addr.street} onChange={e => setA("street", e.target.value)} placeholder="Rua, Av, Travessa..." wrapperClassName="xl:col-span-2" />
                        <Input label="Número" value={addr.number} onChange={e => setA("number", e.target.value)} placeholder="123" />
                        <Input label="Complemento" value={addr.complement} onChange={e => setA("complement", e.target.value)} placeholder="Apto, Sala, Bloco..." />
                        <Input label="Bairro" value={addr.neighborhood} onChange={e => setA("neighborhood", e.target.value)} placeholder="Bairro" />
                        <Input label="Cidade" value={addr.city} onChange={e => setA("city", e.target.value)} placeholder="Cidade" />
                        <Select
                          label="Estado (UF)"
                          value={addr.state}
                          onChange={e => setA("state", e.target.value)}
                          options={UF_OPTIONS}
                          placeholder="Selecione..."
                        />
                        <Input label="País" value={addr.country} onChange={e => setA("country", e.target.value)} placeholder="Brasil" />
                      </FormRow>

                      {(addr.street || addr.city) && (
                        <div className="flex items-start gap-2 text-[11px] text-slate-500">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          {buildAddressString(addr)}
                        </div>
                      )}
                    </div>
                  </PanelCard>
                  )}
                </div>
              )}

              {(activeTab === "service" || activeTab === "orders") && (
                <div className="space-y-4">
                  {activeTab === "service" && (
                  <PanelCard title="Atendimento e balcão" description="Disponibilidade da loja e atendimento presencial." icon={Info}>
                    <div className="divide-y divide-slate-100">
                      <SettingRow title="Loja Aberta" description="Forçar fechamento imediato do cardápio digital.">
                        <span className={`text-[11px] font-semibold ${form.isOpen ? 'text-emerald-600' : 'text-red-500'}`}>
                          {form.isOpen ? 'Aberta' : 'Fechada'}
                        </span>
                        <Switch checked={form.isOpen} onCheckedChange={v => setForm(f => ({ ...f, isOpen: v }))} />
                      </SettingRow>
                      <SettingRow title="Delivery" description="Desligado, a entrega some do cardápio e o cliente só retira no balcão. Mesa e Balcão seguem normais.">
                        <span className={`text-[11px] font-semibold ${form.isDeliveryOpen ? 'text-emerald-600' : 'text-red-500'}`}>
                          {form.isDeliveryOpen ? 'Ativo' : 'Pausado'}
                        </span>
                        <Switch checked={form.isDeliveryOpen} onCheckedChange={v => setForm(f => ({ ...f, isDeliveryOpen: v }))} />
                      </SettingRow>
                      <SettingRow title="Avisar garçom quando a comanda ficar pronta" description="Notifica o garçom em qualquer tela quando a cozinha marcar a comanda como pronta.">
                        <Switch checked={form.waiterNotifyOnReady} onCheckedChange={v => setForm(f => ({ ...f, waiterNotifyOnReady: v }))} />
                      </SettingRow>
                      <div className="space-y-2 py-3">
                        <div>
                          <p className="text-[13px] font-medium text-slate-800">Senha do Balcão</p>
                          <p className="mt-0.5 text-[11px] text-slate-500">Como identificar um pedido de balcão sem mesa.</p>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {([
                            { value: "TICKET", label: "Senha sequencial", desc: "Cada pedido de balcão recebe um número (Senha 01, 02...) — ideal quando o cliente aguarda ser chamado.", icon: Ticket },
                            { value: "NAME",   label: "Nome do cliente",  desc: "Sem número de senha — identifica pelo nome (se não digitar nada, o pedido fica só com o ID curto).", icon: User },
                          ] as const).map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setForm(f => ({ ...f, counterTicketMode: opt.value }))}
                              className={`text-left p-3 rounded-lg border transition-all ${form.counterTicketMode === opt.value ? "border-blue-600 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
                            >
                              <opt.icon className={`w-4 h-4 mb-2 ${form.counterTicketMode === opt.value ? "text-blue-700" : "text-slate-400"}`} strokeWidth={2} />
                              <p className={`text-xs font-semibold ${form.counterTicketMode === opt.value ? "text-blue-700" : "text-slate-700"}`}>{opt.label}</p>
                              <p className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </PanelCard>
                  )}

                  {activeTab === "orders" && (
                  <PanelCard title="Pedidos e agendamento" description="Delivery, encomendas e dias de entrega." icon={Truck}>
                    <div className="space-y-3">
                      <div>
                        <p className="text-[13px] font-medium text-slate-800">Modo de operação</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">Define como os clientes podem fazer pedidos no cardápio digital.</p>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {([
                          { value: "DELIVERY_ONLY",  label: "Só Delivery",          desc: "Entregas imediatas — cliente recebe no mesmo dia", icon: Truck },
                          { value: "PREORDER_ONLY",  label: "Só Encomenda",         desc: "Você define os dias de entrega (ex: só sábados). Cliente pede e você entrega na próxima data disponível", icon: PackageCheck },
                          { value: "BOTH",           label: "Delivery + Encomenda", desc: "Aceita tanto entregas imediatas quanto encomendas com data definida por você", icon: Sparkles },
                        ] as const).map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setForm(f => ({
                              ...f,
                              orderMode: opt.value,
                              scheduleMode: opt.value !== "DELIVERY_ONLY",
                            }))}
                            className={`text-left p-3 rounded-lg border transition-all ${form.orderMode === opt.value ? "border-blue-600 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
                          >
                            <opt.icon className={`w-4 h-4 mb-1.5 ${form.orderMode === opt.value ? "text-blue-700" : "text-slate-400"}`} strokeWidth={2} />
                            <p className={`text-xs font-semibold ${form.orderMode === opt.value ? "text-blue-700" : "text-slate-700"}`}>{opt.label}</p>
                            <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">{opt.desc}</p>
                          </button>
                        ))}
                      </div>

                      {form.orderMode !== "DELIVERY_ONLY" && (
                        <div className="space-y-3 border-t border-slate-100 pt-3">
                          <p className="text-[13px] font-medium text-slate-800">Quando o estabelecimento entrega?</p>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {([
                              { value: "CLIENT_CHOOSES", label: "Cliente informa a data", desc: "O cliente digita a data desejada — você decide se aceita ou não" },
                              { value: "OWNER_DEFINES",  label: "Você define os dias (recomendado)", desc: "Configure os dias e horários fixos de entrega. O cliente vê apenas as datas disponíveis" },
                            ] as const).map(opt => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setForm(f => ({ ...f, scheduleType: opt.value }))}
                                className={`text-left p-3 rounded-lg border transition-all ${form.scheduleType === opt.value ? "border-blue-600 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
                              >
                                <p className={`text-xs font-semibold ${form.scheduleType === opt.value ? "text-blue-700" : "text-slate-600"}`}>{opt.label}</p>
                                <p className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</p>
                              </button>
                            ))}
                          </div>

                          {form.scheduleType === "OWNER_DEFINES" && (
                            <div>
                              <p className="mb-1 text-[13px] font-medium text-slate-800">Dias e turnos de entrega</p>
                              <div className="divide-y divide-slate-100">
                                {scheduleDays.map((day: any, idx: number) => (
                                  <div key={day.weekday} className="flex flex-wrap items-center gap-3 py-2.5">
                                    <Switch
                                      checked={day.enabled}
                                      onCheckedChange={v => setScheduleDays(days => days.map((d, i) => i === idx ? { ...d, enabled: v } : d))}
                                    />
                                    <span className={`text-xs font-semibold w-16 shrink-0 ${day.enabled ? "text-slate-800" : "text-slate-400"}`}>{day.label}</span>
                                    {day.enabled && (
                                      <div className="flex flex-wrap gap-1.5 flex-1">
                                        {day.times.map((t: string, ti: number) => (
                                          <div key={ti} className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-lg px-2 py-0.5">
                                            <TimeInput
                                              value={t}
                                              onChange={v => setScheduleDays(days => days.map((d, i) => i === idx ? { ...d, times: d.times.map((tt: string, tii: number) => tii === ti ? v : tt) } : d))}
                                            />
                                            {day.times.length > 1 && (
                                              <IconButton size="xs" variant="ghost" aria-label="Remover horário" onClick={() => setScheduleDays(days => days.map((d, i) => i === idx ? { ...d, times: d.times.filter((_: string, tii: number) => tii !== ti) } : d))}>
                                                <X size={12} />
                                              </IconButton>
                                            )}
                                          </div>
                                        ))}
                                        <Button
                                          size="xs"
                                          variant="outline"
                                          iconLeft={<Plus size={12} />}
                                          onClick={() => setScheduleDays(days => days.map((d, i) => i === idx ? { ...d, times: [...d.times, "12:00"] } : d))}
                                        >
                                          horário
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <Textarea
                            label="Mensagem para o cliente (opcional)"
                            value={form.scheduleNotes}
                            onChange={e => setForm(f => ({ ...f, scheduleNotes: e.target.value }))}
                            placeholder="Ex: Encomendas entregues toda semana aos sábados a partir das 10h. Pedido mínimo 48h antes."
                            rows={2}
                          />
                        </div>
                      )}
                    </div>
                  </PanelCard>
                  )}
                </div>
              )}

              {activeTab === "pdv" && (
                <div className="space-y-4">
                  <PanelCard title="Caixa e impressão" description="Regras do caixa, da impressora térmica e das vias dos comprovantes." icon={Monitor}>
                    <div className="divide-y divide-slate-100">
                      <SettingRow title="Exigir abertura/fechamento de caixa no PDV" description="Desligado, o PDV vende sem abrir caixa (sem fundo, sangria/suprimento ou fechamento).">
                        <Switch checked={form.requireCashRegister} onCheckedChange={v => setForm(f => ({ ...f, requireCashRegister: v }))} />
                      </SettingRow>
                      <SettingRow title="Largura da impressora térmica" description="Formato do recibo do PDV (imprimir ou PDF) para caber na bobina.">
                        <FilterLineSegmented
                          value={String(form.receiptPaperWidth)}
                          onChange={v => setForm(f => ({ ...f, receiptPaperWidth: (Number(v) === 58 ? 58 : 80) as 58 | 80 }))}
                          options={[
                            { value: "80", label: "80mm" },
                            { value: "58", label: "58mm" },
                          ]}
                          size="sm"
                        />
                      </SettingRow>
                      <SettingRow title="Imprimir automaticamente ao criar pedido" description="Imprime sozinho na térmica do app desktop (PDV, comanda via QR Code, delivery).">
                        <Switch checked={printing.autoPrintOnOrderCreate} onCheckedChange={v => setPrinting(p => ({ ...p, autoPrintOnOrderCreate: v }))} />
                      </SettingRow>
                      {printing.autoPrintOnOrderCreate && (
                        <SettingRow title="2ª via para o estabelecimento" description='Imprime também uma via marcada "VIA DO ESTABELECIMENTO" em todos os pedidos automáticos.'>
                          <Switch checked={printing.autoPrintEstablishmentCopy} onCheckedChange={v => setPrinting(p => ({ ...p, autoPrintEstablishmentCopy: v }))} />
                        </SettingRow>
                      )}
                      <SettingRow title="Imprimir resumo ao fechar caixa" description="Imprime o resumo do turno (totais por pagamento, pedidos, sangrias/suprimentos).">
                        <Switch checked={printing.autoPrintCashClosingReport} onCheckedChange={v => setPrinting(p => ({ ...p, autoPrintCashClosingReport: v }))} />
                      </SettingRow>
                    </div>
                  </PanelCard>

                  <PanelCard title="Impressora do app desktop" description="Impressora térmica usada pelo aplicativo no computador do caixa." icon={Monitor}>
                    <DesktopPrinterSettings />
                  </PanelCard>
                </div>
              )}

              {activeTab === "kitchen" && (
                <div className="space-y-4">
                  <PanelCard title="Painel de Pedidos (TV)" description="Tipos de pedido, tema, cores, sons, voz, propaganda e pareamento de TVs." icon={Monitor}>
                    <p className="text-[11px] text-slate-500">
                      Ficam em uma página própria: menu lateral → <strong className="text-slate-700">Config. Painel TV</strong>.
                    </p>
                  </PanelCard>

                  {tenant?.id && <KitchenPasswordCard tenantId={tenant.id} />}
                  {tenant?.id && <KitchenAccessRequestsCard tenantId={tenant.id} onApproved={() => {}} />}
                  {tenant?.id && <KitchenStaffCard tenantId={tenant.id} />}
                </div>
              )}
            </>
          </motion.div>
        )}

        {activeTab === "hours" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <PanelCard title="Horários de funcionamento" description="Ative os dias em que a loja abre e defina abertura, fechamento e intervalo." icon={Clock3}>
              <div className="divide-y divide-slate-100">
                {DAY_KEYS_UI.map(day => {
                  const d = hours[day] ?? { enabled: false, open: "08:00", close: "22:00", breakEnabled: false, breakStart: "12:00", breakEnd: "13:00" };
                  return (
                    <div key={day} className="py-2.5">
                      <div className="flex flex-wrap items-center gap-3">
                        <Switch checked={d.enabled} onCheckedChange={v => setDay(day, "enabled", v)} />
                        <span className={`text-xs font-semibold w-[72px] shrink-0 ${d.enabled ? "text-slate-800" : "text-slate-400"}`}>
                          {DAY_LABELS[day]}
                        </span>
                        {d.enabled ? (
                          <>
                            <div className="flex items-end gap-2 flex-1">
                              <TimeInput label="Abertura" value={d.open} onChange={v => setDay(day, "open", v)} />
                              <span className="text-slate-300 font-semibold text-sm pb-2 select-none">–</span>
                              <TimeInput label="Fechamento" value={d.close} onChange={v => setDay(day, "close", v)} />
                            </div>
                            <Button
                              size="sm"
                              variant={d.breakEnabled ? "secondary" : "outline"}
                              onClick={() => setDay(day, "breakEnabled", !d.breakEnabled)}
                              iconLeft={d.breakEnabled ? <Clock size={14} /> : <Plus size={14} />}
                            >
                              <span className="hidden sm:inline">{d.breakEnabled ? "Pausa" : "Intervalo"}</span>
                            </Button>
                          </>
                        ) : (
                          <span className="ml-auto text-[11px] text-slate-400">Fechado</span>
                        )}
                      </div>
                      {d.enabled && d.breakEnabled && (
                        <div className="mt-2 flex items-end gap-2 sm:pl-[104px]">
                          <TimeInput label="Início do intervalo" value={d.breakStart ?? "12:00"} onChange={v => setDay(day, "breakStart", v)} />
                          <span className="text-slate-300 font-semibold text-sm pb-2 select-none">–</span>
                          <TimeInput label="Fim do intervalo" value={d.breakEnd ?? "13:00"} onChange={v => setDay(day, "breakEnd", v)} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </PanelCard>
          </motion.div>
        )}

        {activeTab === "delivery" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <PanelCard title="Regras de entrega" description="Escolha como a taxa de entrega é cobrada." icon={Truck}>
              <Tabs<DeliveryModeId>
                items={DELIVERY_MODES}
                value={delivery.mode as DeliveryModeId}
                onChange={m => setDelivery(d => ({ ...d, mode: m }))}
                label="Modo de cobrança da entrega"
              >
                {delivery.mode === "free" && (
                  <p className="text-[11px] text-slate-500">Entrega sem custo para o cliente.</p>
                )}

                {delivery.mode === "fixed" && (
                  <FormRow cols={3}>
                    <Input
                      label="Valor único de entrega (R$)"
                      type="number" min="0" step="0.50"
                      value={delivery.fixedFee ?? ""}
                      onChange={e => setDelivery(d => ({ ...d, fixedFee: parseFloat(e.target.value) || 0 }))}
                      placeholder="0,00"
                    />
                  </FormRow>
                )}

                {delivery.mode === "zones" && (
                  <div className="space-y-3">
                    <FormRow cols={3}>
                      <Input
                        label="Cobrança fallback (R$)"
                        type="number" min="0" step="0.50"
                        value={delivery.defaultFee ?? ""}
                        onChange={e => setDelivery(d => ({ ...d, defaultFee: parseFloat(e.target.value) || 0 }))}
                        placeholder="0,00"
                        hint="Para locais não cadastrados"
                      />
                    </FormRow>

                    <div className="space-y-2 border-t border-slate-100 pt-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[13px] font-medium text-slate-800">Zonas de entrega</p>
                        <span className="text-[11px] text-slate-500">{delivery.zones?.length || 0} zonas</span>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {delivery.zones?.map((zone, idx) => (
                          <div key={zone.id} className="flex items-center justify-between gap-3 py-2.5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                                <Truck className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-[13px] font-medium text-slate-800">{zone.label}</p>
                                <p className="text-[11px] text-slate-500">CEP: {zone.ceps.join(", ")}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-semibold text-blue-700">{zone.fee === 0 ? "Grátis" : fmt(zone.fee)}</span>
                              <IconButton
                                size="sm"
                                variant="ghost"
                                aria-label="Remover zona"
                                onClick={() => setDelivery(d => ({ ...d, zones: d.zones?.filter((_, i) => i !== idx) }))}
                              >
                                <Trash2 size={14} />
                              </IconButton>
                            </div>
                          </div>
                        ))}
                      </div>
                      <ZoneAdder onAdd={z => setDelivery(d => ({ ...d, zones: [...(d.zones || []), z] }))} />
                    </div>
                  </div>
                )}

                {delivery.mode === "km" && (
                  <div className="space-y-3">
                    <FormRow cols={3}>
                      <Input
                        label="CEP de origem (seu estabelecimento)"
                        type="text"
                        inputMode="numeric"
                        maxLength={9}
                        value={delivery.originCep
                          ? delivery.originCep.replace(/^(\d{5})(\d{1,3})$/, "$1-$2")
                          : ""}
                        onChange={e => {
                          const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
                          setDelivery(d => ({ ...d, originCep: digits }));
                        }}
                        placeholder="00000-000"
                        hint="O cálculo de distância parte deste CEP até o CEP do cliente."
                      />
                    </FormRow>

                    <div className="space-y-2 border-t border-slate-100 pt-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[13px] font-medium text-slate-800">Faixas de distância</p>
                        <span className="text-[11px] text-slate-500">{delivery.kmRanges?.length || 0} faixas</span>
                      </div>

                      <div className="divide-y divide-slate-100">
                        {[...(delivery.kmRanges || [])].sort((a, b) => a.upToKm - b.upToKm).map((range, idx, arr) => {
                          const from = idx === 0 ? 0 : arr[idx - 1].upToKm;
                          return (
                            <div key={range.id} className="flex items-center justify-between gap-3 py-2.5">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                                  <Ruler className="w-4 h-4" />
                                </div>
                                <div>
                                  <p className="text-[13px] font-medium text-slate-800">
                                    {from === 0 ? `Até ${range.upToKm} km` : `De ${from} km até ${range.upToKm} km`}
                                  </p>
                                  <p className="text-[11px] text-slate-500">Faixa {idx + 1}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-semibold text-blue-700">{range.fee === 0 ? "Grátis" : fmt(range.fee)}</span>
                                <IconButton
                                  size="sm"
                                  variant="ghost"
                                  aria-label="Remover faixa"
                                  onClick={() => setDelivery(d => ({ ...d, kmRanges: d.kmRanges?.filter(r => r.id !== range.id) }))}
                                >
                                  <Trash2 size={14} />
                                </IconButton>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <KmRangeAdder onAdd={r => setDelivery(d => ({ ...d, kmRanges: [...(d.kmRanges || []), r] }))} />
                    </div>

                    <div className="divide-y divide-slate-100 border-t border-slate-100">
                      <SettingRow title="Aceitar pedidos além da última faixa" description="Cobra a taxa abaixo para distâncias maiores que a última faixa.">
                        <Switch
                          checked={delivery.kmAllowBeyond ?? true}
                          onCheckedChange={v => setDelivery(d => ({ ...d, kmAllowBeyond: v }))}
                        />
                      </SettingRow>
                    </div>
                    {(delivery.kmAllowBeyond ?? true) && (
                      <FormRow cols={3}>
                        <Input
                          label="Taxa além da última faixa (R$)"
                          type="number" min="0" step="0.50"
                          value={delivery.kmDefaultFee ?? ""}
                          onChange={e => setDelivery(d => ({ ...d, kmDefaultFee: parseFloat(e.target.value) || 0 }))}
                          placeholder="0,00"
                          hint="0 = grátis"
                        />
                      </FormRow>
                    )}
                  </div>
                )}
              </Tabs>
            </PanelCard>
          </motion.div>
        )}

        {activeTab === "payments" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <PanelCard title="Meios de pagamento" description="Ative as formas de pagamento aceitas e as bandeiras de cada uma." icon={Wallet}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {[
                  { id: "pix", label: "PIX Dinâmico", icon: QrCode, desc: "Aprovação instantânea" },
                  { id: "credit", label: "Cartão de Crédito", icon: CreditCard, desc: "Visa, Master, Elo..." },
                  { id: "debit", label: "Cartão de Débito", icon: CreditCard, desc: "Pagamento à vista" },
                  { id: "meal", label: "Vale Refeição (VR)", icon: Utensils, desc: "Sodexo, Alelo, VR" },
                  { id: "food", label: "Vale Alimentação (VA)", icon: Package, desc: "Ticket, Alelo" },
                ].map((method) => {
                  const methodConfig = payments[method.id as keyof PaymentConfig] as PaymentMethodConfig;
                  const isEnabled = methodConfig?.enabled;
                  const acceptedBrands = methodConfig?.acceptedBrands || [];
                  const allBrands = [...CARD_BRANDS_LIST.map(b => b.label), ...(payments.customBrands || [])];

                  return (
                    <div
                      key={method.id}
                      className={`p-3 rounded-lg border transition-all space-y-3 ${
                        isEnabled ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isEnabled ? 'bg-blue-50 text-blue-700' : 'bg-slate-200 text-slate-400'
                          }`}>
                            <method.icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium text-slate-800 truncate">{method.label}</p>
                            <p className="text-[11px] text-slate-500 truncate">{method.desc}</p>
                          </div>
                        </div>
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={v => setPayments({
                            ...payments,
                            [method.id]: { ...(methodConfig || { label: method.label }), enabled: v }
                          })}
                        />
                      </div>

                      {isEnabled && (
                        <div className="pt-3 border-t border-slate-100 space-y-2">
                          <p className="text-[11px] font-medium text-slate-500">Bandeiras aceitas</p>
                          <div className="flex flex-wrap gap-1.5">
                            {allBrands.map(brand => {
                              const isSelected = acceptedBrands.includes(brand);
                              return (
                                <button
                                  key={brand}
                                  type="button"
                                  onClick={() => {
                                    const next = isSelected
                                      ? acceptedBrands.filter(b => b !== brand)
                                      : [...acceptedBrands, brand];
                                    setPayments({
                                      ...payments,
                                      [method.id]: { ...methodConfig, acceptedBrands: next }
                                    });
                                  }}
                                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                                    isSelected
                                      ? 'bg-blue-600 border-blue-600 text-white'
                                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                                  }`}
                                >
                                  {brand}
                                </button>
                              );
                            })}
                          </div>

                          <div className="flex gap-2">
                            <Input
                              type="text"
                              wrapperClassName="flex-1"
                              placeholder="Nova bandeira... (Enter)"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const val = e.currentTarget.value.trim();
                                  if (val) {
                                    const custom = payments.customBrands || [];
                                    if (!custom.includes(val)) {
                                      setPayments({
                                        ...payments,
                                        customBrands: [...custom, val],
                                        [method.id]: { ...methodConfig, acceptedBrands: [...acceptedBrands, val] }
                                      });
                                    } else if (!acceptedBrands.includes(val)) {
                                      setPayments({
                                        ...payments,
                                        [method.id]: { ...methodConfig, acceptedBrands: [...acceptedBrands, val] }
                                      });
                                    }
                                    e.currentTarget.value = "";
                                  }
                                }
                              }}
                            />
                            <div className="p-2 text-slate-300">
                              <Plus className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                <div
                  key="cash"
                  className={`p-3 rounded-lg border transition-all space-y-3 ${
                    payments.cash?.enabled ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        payments.cash?.enabled ? 'bg-blue-50 text-blue-700' : 'bg-slate-200 text-slate-400'
                      }`}>
                        <Banknote className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-slate-800 truncate">Dinheiro no Local</p>
                        <p className="text-[11px] text-slate-500 truncate">Pagamento na entrega ou balcão</p>
                      </div>
                    </div>
                    <Switch
                      checked={payments.cash?.enabled}
                      onCheckedChange={v => setPayments({
                        ...payments,
                        cash: { ...(payments.cash || { label: "Dinheiro", allowChange: true }), enabled: v }
                      })}
                    />
                  </div>
                  {payments.cash?.enabled && (
                    <label className="flex items-center gap-3 pt-3 border-t border-slate-100 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={payments.cash?.allowChange !== false}
                        onChange={e => setPayments({
                          ...payments,
                          cash: { ...payments.cash!, allowChange: e.target.checked }
                        })}
                        className="w-4 h-4 rounded accent-blue-600"
                      />
                      <span className="text-xs font-medium text-slate-600">Perguntar sobre troco no checkout</span>
                    </label>
                  )}
                </div>
              </div>
            </PanelCard>
          </motion.div>
        )}

        {activeTab === "maquinhas" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <Tabs<MachineTabId> items={MACHINE_TABS} value={machineTab} onChange={setMachineTab} label="Seções das maquininhas">
              {machineTab === "terminals" && (
                <div className="space-y-4">
                  {!stone.enabled && !cielo.enabled && (
                    <EmptyState
                      icon={Smartphone}
                      title="Nenhuma maquininha ativada"
                      description="Ative uma integração para receber pagamentos no cartão direto pelo PDV."
                      action={
                        <Button size="sm" iconLeft={<Plus size={14} />} onClick={() => setStone({ ...stone, enabled: true })}>
                          Adicionar maquininha
                        </Button>
                      }
                    />
                  )}

                  {/* Stone / Pagar.me */}
                  <PanelCard
                    title="Stone / Pagar.me"
                    description="Maquininha física via API Pagar.me"
                    icon={Smartphone}
                    action={
                      <div className="flex items-center gap-2">
                        <Badge size="sm" dot color={!stone.enabled ? "default" : stone.secretKey ? "success" : "warning"}>
                          {!stone.enabled ? "Desativada" : stone.secretKey ? "Configurada" : "Não configurada"}
                        </Badge>
                        <Switch checked={stone.enabled} onCheckedChange={v => setStone({ ...stone, enabled: v })} />
                      </div>
                    }
                  >
                    {stone.enabled ? (
                      <div className="space-y-3">
                        <Alert variant="warning" title="Como configurar">
                          <ol className="list-decimal ml-3 space-y-1">
                            <li>Acesse o <strong>Partner Hub da Stone</strong> ou painel do Pagar.me.</li>
                            <li>Copie sua <strong>Secret Key</strong> (sk_live_... ou sk_test_...).</li>
                            <li>O <strong>Stonecode</strong> é o código do estabelecimento que vincula ao terminal físico.</li>
                            <li>Salve as configurações — a maquininha aparecerá como opção no PDV.</li>
                          </ol>
                        </Alert>

                        <FormRow cols={2}>
                          <Input
                            label="Secret Key (Pagar.me)"
                            value={stone.secretKey}
                            onChange={e => setStone({ ...stone, secretKey: e.target.value })}
                            placeholder="sk_live_xxxxxxxxxxxx"
                            type="password"
                          />
                          <Input
                            label="Stonecode (código do estabelecimento)"
                            value={stone.stonecode}
                            onChange={e => setStone({ ...stone, stonecode: e.target.value })}
                            placeholder="Ex: 123456789"
                          />
                        </FormRow>

                        <p className="text-[11px] text-slate-500">
                          Fluxo: no PDV, selecione "Maquininha" e o tipo (crédito, débito ou PIX). O sistema envia a cobrança ao terminal físico, o cliente paga e o sistema confirma.
                        </p>

                        {stone.secretKey && (
                          <Alert variant="success">Credenciais configuradas — salve para ativar.</Alert>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500">Maquininha desativada. Ative para configurar a integração com a Stone.</p>
                    )}
                  </PanelCard>

                  {/* Cielo LIO Smart */}
                  <PanelCard
                    title="Cielo LIO Smart"
                    description="Maquininha física via Cielo Order Manager (integração remota)"
                    icon={Smartphone}
                    action={
                      <div className="flex items-center gap-2">
                        <Badge size="sm" dot color={!cielo.enabled ? "default" : cielo.merchantId ? "success" : "warning"}>
                          {!cielo.enabled ? "Desativada" : cielo.merchantId ? "Configurada" : "Não configurada"}
                        </Badge>
                        <Switch checked={cielo.enabled} onCheckedChange={v => setCielo({ ...cielo, enabled: v })} />
                      </div>
                    }
                  >
                    {cielo.enabled ? (
                      <div className="space-y-3">
                        <Alert variant="warning" title="Só funciona com terminais Cielo Smart">
                          DX8000, L300 (V3/V4) ou L400 — as maquininhas com tela grande tipo tablet. A maquininha simples de botões não tem essa API.
                        </Alert>

                        <Alert variant="info" title="Como pegar o código do estabelecimento na maquininha do cliente">
                          <ol className="list-decimal ml-3 space-y-0.5">
                            <li>Na tela principal da maquininha, toque em <strong>Configurações</strong></li>
                            <li>Role até o final e entre em <strong>Sistema</strong></li>
                            <li>Toque em <strong>"Sobre a máquina"</strong></li>
                            <li>O código do estabelecimento aparece ali — é esse número que vai no campo abaixo</li>
                          </ol>
                        </Alert>

                        <Alert variant="info" title="Credencial por cliente">
                          Cada cliente precisa da própria credencial aprovada na Cielo (Portal de Desenvolvedores &gt; credenciais de produção): informe Client ID, Access Token e Merchant ID do estabelecimento. Se deixar em branco, usa a credencial padrão do sistema.
                        </Alert>

                        <FormRow cols={3}>
                          <Input
                            label="Client ID"
                            value={cielo.clientId || ""}
                            onChange={e => setCielo({ ...cielo, clientId: e.target.value })}
                            placeholder="Client ID do estabelecimento"
                            autoComplete="off"
                          />
                          <Input
                            label="Access Token"
                            type="password"
                            value={cielo.accessToken || ""}
                            onChange={e => setCielo({ ...cielo, accessToken: e.target.value })}
                            placeholder={cielo.accessTokenSet ? "Token já salvo — preencha só para trocar" : "Access Token do estabelecimento"}
                            autoComplete="new-password"
                          />
                          <Input
                            label="Merchant ID"
                            value={cielo.merchantId}
                            onChange={e => setCielo({ ...cielo, merchantId: e.target.value })}
                            placeholder="Configurações > Sistema > Sobre a máquina"
                          />
                        </FormRow>

                        <p className="text-[11px] text-slate-500">
                          Fluxo: no PDV, selecione "Maquininha Cielo" e o tipo (crédito, débito ou PIX). O pedido vai para a nuvem da Cielo, o terminal exibe ao cliente e a confirmação chega por webhook.
                        </p>

                        {cielo.merchantId && (
                          <Alert variant="success">Código do estabelecimento configurado — salve para ativar.</Alert>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500">Maquininha desativada. Ative para configurar a integração com a Cielo.</p>
                    )}
                  </PanelCard>

                  {/* Futuras integrações */}
                  <PanelCard title="Outras maquininhas" description="Integrações previstas" icon={CreditCard}>
                    <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 xl:grid-cols-3">
                      {["Rede", "Getnet", "PagBank", "Mercado Pago", "SumUp"].map(name => (
                        <div key={name} className="flex items-center justify-between gap-3 border-b border-slate-100 py-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <CreditCard size={14} className="shrink-0 text-slate-400" />
                            <span className="truncate text-xs font-medium text-slate-600">{name}</span>
                          </div>
                          <Badge size="sm">Em breve</Badge>
                        </div>
                      ))}
                    </div>
                  </PanelCard>
                </div>
              )}

              {machineTab === "fees" && (
                <div className="space-y-4">
                  {/* Taxas da Maquininha */}
                  <PanelCard title="Taxas da maquininha" description="Percentual cobrado pela adquirente por bandeira. Alimenta o custo no financeiro e, se ativado, o acréscimo no PDV." icon={CircleDollarSign}>
                    <div className="space-y-4">
                      <Alert variant="info" title="Repasse da taxa ao cliente">
                        Com "Repassar taxa ao cliente" ativado em um meio de pagamento, o percentual configurado é somado ao total no PDV. Desativado, a taxa fica como custo da loja e só aparece no financeiro.
                      </Alert>

                      {/* PIX — taxa única do provedor, sem bandeira/parcela */}
                      {payments.pix?.enabled && (
                        <div className="space-y-2">
                          <SettingRow title="Pix" description="Taxa única do provedor, sem bandeira/parcela.">
                            <span className="text-[11px] text-slate-500">Repassar taxa ao cliente</span>
                            <Switch
                              checked={!!payments.pix.passFeeToCustomer}
                              onCheckedChange={(v) => setPayments({ ...payments, pix: { ...payments.pix!, passFeeToCustomer: v } })}
                            />
                          </SettingRow>
                          <Input
                            size="sm"
                            label="Taxa do provedor"
                            addonRight="%"
                            type="text"
                            inputMode="decimal"
                            wrapperClassName="w-32"
                            className="text-center"
                            value={payments.pix.brandFees?.["PIX"]?.installmentFees?.["1"] ?? ""}
                            onChange={(e) => {
                              const pct = parseFloat(e.target.value.replace(",", ".")) || 0;
                              setPayments({
                                ...payments,
                                pix: { ...payments.pix!, brandFees: { PIX: { installmentFees: { "1": pct } } } },
                              });
                            }}
                            placeholder="0,0"
                          />
                        </div>
                      )}

                      {(["credit", "debit"] as const).map((methodKey) => {
                        const methodConfig = payments[methodKey] as PaymentMethodConfig | undefined;
                        if (!methodConfig?.enabled) return null;
                        const brands = methodConfig.acceptedBrands?.length ? methodConfig.acceptedBrands : [];
                        const installmentsRange = methodKey === "credit" ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] : [1];
                        const brandFees = methodConfig.brandFees || {};

                        const updateFee = (brand: string, installment: number, value: string) => {
                          const pct = parseFloat(value.replace(",", ".")) || 0;
                          const current = brandFees[brand]?.installmentFees || {};
                          setPayments({
                            ...payments,
                            [methodKey]: {
                              ...methodConfig,
                              brandFees: {
                                ...brandFees,
                                [brand]: { installmentFees: { ...current, [String(installment)]: pct } },
                              },
                            },
                          });
                        };

                        const addBrand = (name: string) => {
                          const trimmed = name.trim();
                          if (!trimmed || brands.includes(trimmed)) return;
                          setPayments({
                            ...payments,
                            [methodKey]: { ...methodConfig, acceptedBrands: [...brands, trimmed] },
                          });
                        };

                        const removeBrand = (name: string) => {
                          const { [name]: _removed, ...restFees } = brandFees;
                          setPayments({
                            ...payments,
                            [methodKey]: {
                              ...methodConfig,
                              acceptedBrands: brands.filter((b) => b !== name),
                              brandFees: restFees,
                            },
                          });
                        };

                        // Taxa média: média dos percentuais preenchidos (> 0) de todas as bandeiras/parcelas.
                        const filled = brands.flatMap((b) =>
                          installmentsRange.map((n) => Number(brandFees[b]?.installmentFees?.[String(n)] ?? 0)).filter((v) => v > 0)
                        );
                        const avgFee = filled.length ? filled.reduce((a, b) => a + b, 0) / filled.length : 0;

                        return (
                          <div key={methodKey} className="space-y-3 border-t border-slate-100 pt-3 first:border-0 first:pt-0">
                            <SettingRow
                              title={methodKey === "credit" ? "Cartão de Crédito" : "Cartão de Débito"}
                              description={filled.length ? `Taxa média: ${avgFee.toFixed(2).replace(".", ",")}% (${filled.length} ${filled.length === 1 ? "taxa preenchida" : "taxas preenchidas"})` : "Nenhuma taxa preenchida"}
                            >
                              <span className="text-[11px] text-slate-500">Repassar taxa ao cliente</span>
                              <Switch
                                checked={!!methodConfig.passFeeToCustomer}
                                onCheckedChange={(v) => setPayments({
                                  ...payments,
                                  [methodKey]: { ...methodConfig, passFeeToCustomer: v },
                                })}
                              />
                            </SettingRow>

                            {brands.length > 0 && (
                              <div className="max-h-[440px] overflow-auto rounded-lg border border-slate-200">
                                <table className="w-full border-collapse text-xs">
                                  <thead className="sticky top-0 z-10 bg-zinc-50 text-[11px] font-medium text-slate-500">
                                    <tr>
                                      <th className="sticky left-0 z-10 whitespace-nowrap bg-zinc-50 px-3 py-2 text-left font-medium">
                                        {methodKey === "credit" ? "Parcelas" : "Modalidade"}
                                      </th>
                                      {brands.map((brand) => (
                                        <th key={brand} className="whitespace-nowrap px-2 py-1 text-center font-medium">
                                          <span className="inline-flex items-center gap-1">
                                            <span className="font-semibold text-slate-700">{brand}</span>
                                            <IconButton
                                              size="xs"
                                              variant="ghost"
                                              aria-label="Remover bandeira"
                                              onClick={() => removeBrand(brand)}
                                              title="Remover bandeira"
                                            >
                                              <X size={14} />
                                            </IconButton>
                                          </span>
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {installmentsRange.map((n) => (
                                      <tr key={n}>
                                        <td className="sticky left-0 whitespace-nowrap bg-white px-3 py-1.5 font-medium text-slate-700">
                                          {methodKey === "credit" ? (n === 1 ? "Crédito à vista" : `${n}x`) : "Débito"}
                                        </td>
                                        {brands.map((brand) => (
                                          <td key={brand} className="px-2 py-1.5">
                                            <Input
                                              size="sm"
                                              aria-label={`${brand} ${methodKey === "credit" ? `${n}x` : "débito"} (%)`}
                                              type="text"
                                              inputMode="decimal"
                                              addonRight="%"
                                              wrapperClassName="mx-auto w-24"
                                              value={brandFees[brand]?.installmentFees?.[String(n)] ?? ""}
                                              onChange={(e) => updateFee(brand, n, e.target.value)}
                                              placeholder="0,0"
                                              className="text-center"
                                            />
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            {/* Adicionar nova bandeira */}
                            <div className="flex gap-2">
                              <Input
                                type="text"
                                wrapperClassName="flex-1 min-w-0 sm:max-w-sm"
                                placeholder="Adicionar bandeira (ex: Cabal, Banricompras...)"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    addBrand(e.currentTarget.value);
                                    e.currentTarget.value = "";
                                  }
                                }}
                              />
                              <IconButton
                                variant="primary"
                                aria-label="Adicionar bandeira"
                                onClick={(e) => {
                                  const input = (e.currentTarget.previousSibling as HTMLElement).querySelector("input") as HTMLInputElement;
                                  addBrand(input.value);
                                  input.value = "";
                                }}
                              >
                                <Plus size={14} />
                              </IconButton>
                            </div>

                            {brands.length === 0 && (
                              <p className="text-[11px] text-slate-500">Nenhuma bandeira cadastrada ainda — adicione acima ou na aba "Pagamentos".</p>
                            )}
                          </div>
                        );
                      })}

                      {!payments.pix?.enabled && !payments.credit?.enabled && !payments.debit?.enabled && (
                        <EmptyState
                          icon={CreditCard}
                          title="Nenhum meio de pagamento habilitado"
                          description='Ative Pix, Crédito ou Débito na aba "Pagamentos" para configurar as taxas.'
                        />
                      )}
                    </div>
                  </PanelCard>

                  {/* Taxa de Serviço */}
                  <PanelCard
                    title="Taxa de serviço"
                    description="Percentual sobre o subtotal dos itens (ex: 10% em mesas). Vem pré-marcada no PDV, mas o operador pode desmarcar ou ajustar."
                    icon={CircleDollarSign}
                    action={
                      <label className="flex items-center gap-2 cursor-pointer">
                        <span className="text-[11px] text-slate-500">Ativar</span>
                        <Switch
                          checked={!!payments.serviceCharge?.enabled}
                          onCheckedChange={(v) => setPayments({
                            ...payments,
                            serviceCharge: { enabled: v, percent: payments.serviceCharge?.percent ?? 10 },
                          })}
                        />
                      </label>
                    }
                  >
                    {payments.serviceCharge?.enabled ? (
                      <FormRow cols={3}>
                        <Input
                          label="Percentual (%)"
                          type="text"
                          inputMode="decimal"
                          value={payments.serviceCharge?.percent ?? ""}
                          onChange={(e) => {
                            const pct = parseFloat(e.target.value.replace(",", ".")) || 0;
                            setPayments({
                              ...payments,
                              serviceCharge: { enabled: true, percent: pct },
                            });
                          }}
                          placeholder="10"
                        />
                      </FormRow>
                    ) : (
                      <p className="text-[11px] text-slate-500">Taxa de serviço desativada.</p>
                    )}
                  </PanelCard>
                </div>
              )}
            </Tabs>
          </motion.div>
        )}

        {/* ── ABA FISCAL ─────────────────────────────────────────────────── */}
        {activeTab === "fiscal" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <PanelCard
              title="Módulo Fiscal — NFC-e"
              description="Nota Fiscal do Consumidor Eletrônica (Modelo 65)"
              icon={FileText}
              action={
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <Switch checked={fiscal.enabled} onCheckedChange={v => setFiscal(f => ({ ...f, enabled: v }))} />
                  <span className="text-xs font-medium text-slate-600">{fiscal.enabled ? "Ativo" : "Inativo"}</span>
                </label>
              }
            >
              <p className="text-[11px] text-slate-500">
                {fiscal.enabled
                  ? "Configure o emitente, a emissão automática e as credenciais nas seções abaixo."
                  : "Módulo fiscal inativo. Ative para configurar a emissão de NFC-e."}
              </p>
            </PanelCard>

            {fiscal.enabled && (
              <Tabs<FiscalTabId> items={FISCAL_TABS} value={fiscalTab} onChange={setFiscalTab} label="Seções do módulo fiscal">
                {fiscalTab === "issuer" && (
                  <div className="space-y-4">
                    <PanelCard title="Ambiente SEFAZ" description="Homologação é só para testes, sem valor fiscal." icon={FlaskConical}>
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {(["homologacao", "producao"] as const).map(env => (
                            <Button key={env}
                              fullWidth
                              variant={fiscal.ambiente === env ? "primary" : "outline"}
                              onClick={() => setFiscal(f => ({ ...f, ambiente: env }))}
                              iconLeft={env === "homologacao" ? <FlaskConical size={14} /> : <Rocket size={14} />}
                            >
                              {env === "homologacao" ? "Homologação (teste)" : "Produção"}
                            </Button>
                          ))}
                        </div>
                        {fiscal.ambiente === "homologacao" && (
                          <Alert variant="warning">
                            Em homologação as notas <strong>não têm valor fiscal</strong>. Use para testar a integração com a SEFAZ antes de ir para produção.
                          </Alert>
                        )}
                      </div>
                    </PanelCard>

                    <PanelCard title="Dados do emitente" description="CNPJ, regime tributário e município da loja." icon={Store}>
                      <FormRow cols={3}>
                        <Input label="CNPJ" type="text" maxLength={18} value={fiscal.cnpj} onChange={e => setFiscal(f => ({ ...f, cnpj: e.target.value }))} placeholder="00.000.000/0000-00" />
                        <Input label="Inscrição Estadual (IE)" type="text" value={fiscal.ie} onChange={e => setFiscal(f => ({ ...f, ie: e.target.value }))} placeholder="000.000.000.000" />
                        <Select
                          label="Regime Tributário (CRT)"
                          value={fiscal.crt}
                          onChange={e => setFiscal(f => ({ ...f, crt: e.target.value as any }))}
                          options={[
                            { value: "1", label: "1 — Simples Nacional" },
                            { value: "2", label: "2 — Simples Nacional (excesso sublimite)" },
                            { value: "3", label: "3 — Regime Normal" },
                          ]}
                        />
                        <Select
                          label="UF"
                          value={fiscal.uf}
                          onChange={e => setFiscal(f => ({ ...f, uf: e.target.value }))}
                          options={["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"].map(uf => ({ value: uf, label: uf }))}
                        />
                        <Input label="Código IBGE do Município" type="text" value={fiscal.cMun} onChange={e => setFiscal(f => ({ ...f, cMun: e.target.value }))} placeholder="Ex: 3550308 (São Paulo)" />
                        <Input label="Nome do Município" type="text" value={fiscal.xMun} onChange={e => setFiscal(f => ({ ...f, xMun: e.target.value }))} placeholder="Ex: São Paulo" />
                      </FormRow>
                    </PanelCard>

                    <PanelCard title="Numeração NFC-e" description="Série e próximo número a ser emitido." icon={FileText}>
                      <FormRow cols={3}>
                        <Input label="Série" type="number" min={1} max={999} value={fiscal.serie} onChange={e => setFiscal(f => ({ ...f, serie: parseInt(e.target.value) || 1 }))} />
                        <Input label="Próximo Número" type="number" min={1} value={fiscal.proximoNumero} onChange={e => setFiscal(f => ({ ...f, proximoNumero: parseInt(e.target.value) || 1 }))} />
                      </FormRow>
                    </PanelCard>
                  </div>
                )}

                {fiscalTab === "emission" && (
                  <PanelCard title="Emissão automática" description="O que acontece sozinho ao concluir uma venda no PDV." icon={Rocket}>
                    <div className="divide-y divide-slate-100">
                      <SettingRow title="Emitir NFC-e automaticamente no PDV" description="Ao concluir a venda, envia a NFC-e na hora à SEFAZ. Use só depois de conferir certificado, CSC e dados fiscais dos produtos.">
                        <Switch checked={fiscal.autoEmitNfce === true} onCheckedChange={value => setFiscal(current => ({ ...current, autoEmitNfce: value, ...(!value ? { autoPrintDanfe: false } : {}) }))} />
                      </SettingRow>
                      <SettingRow title="Imprimir DANFE NFC-e automaticamente" description="Após a autorização, imprime o DANFE na impressora do PDV. O cupom comercial automático não será impresso nessa venda.">
                        <Switch checked={fiscal.autoPrintDanfe === true} disabled={!fiscal.autoEmitNfce} onCheckedChange={value => setFiscal(current => ({ ...current, autoPrintDanfe: value }))} />
                      </SettingRow>
                    </div>
                    {fiscal.ambiente === "homologacao" && (
                      <Alert variant="warning" className="mt-3">Em homologação, a emissão automática gera somente notas de teste, sem valor fiscal.</Alert>
                    )}
                  </PanelCard>
                )}

                {fiscalTab === "credentials" && (
                  <div className="space-y-4">
                    {/* CSC — o credenciamento e o CSC são registros SEPARADOS por ambiente na
                        SEFAZ (o de homologação não vale em produção, e vice-versa), então
                        cada ambiente tem seu próprio par de campos aqui — trocar o Ambiente
                        acima não apaga o CSC do outro, o sistema já escolhe o par certo
                        automaticamente na hora de emitir (ver getCsc/getCscId em fiscal.ts). */}
                    <PanelCard title="CSC — Código de Segurança do Contribuinte" description="Cadastrado no portal da SEFAZ do seu estado, um para cada ambiente." icon={FileText}>
                      <div className="space-y-3">
                        <p className="text-[11px] text-slate-500">
                          Para SP: <span className="font-semibold text-slate-700">nfce.fazenda.sp.gov.br</span>, menu "Gerenciar Cód Segurança". Homologação e produção têm portais e códigos separados — gere um CSC em cada ambiente antes de emitir notas nele.
                        </p>
                        <div>
                          <p className="mb-2 text-[11px] font-medium text-amber-700">Ambiente de Homologação</p>
                          <FormRow cols={2}>
                            <Input label="ID do CSC" type="text" value={fiscal.cscIdHomologacao ?? ""} onChange={e => setFiscal(f => ({ ...f, cscIdHomologacao: e.target.value }))} placeholder="Ex: 1" />
                            <Input label="Token CSC" type="password" value={fiscal.cscHomologacao ?? ""} onChange={e => setFiscal(f => ({ ...f, cscHomologacao: e.target.value }))} placeholder="Token UUID da SEFAZ" />
                          </FormRow>
                        </div>
                        <div>
                          <p className="mb-2 text-[11px] font-medium text-emerald-700">Ambiente de Produção</p>
                          <FormRow cols={2}>
                            <Input label="ID do CSC" type="text" value={fiscal.cscIdProducao ?? ""} onChange={e => setFiscal(f => ({ ...f, cscIdProducao: e.target.value }))} placeholder="Ex: 1" />
                            <Input label="Token CSC" type="password" value={fiscal.cscProducao ?? ""} onChange={e => setFiscal(f => ({ ...f, cscProducao: e.target.value }))} placeholder="Token UUID da SEFAZ" />
                          </FormRow>
                        </div>
                      </div>
                    </PanelCard>

                    <PanelCard title="Certificado Digital A1 (.pfx)" description="Certificado emitido pela AC, usado para assinar as notas." icon={FileDown}>
                      <div className="space-y-3">
                        {fiscal.certBase64 ? (
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                              <CheckCircle2 className="w-4 h-4" />
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-semibold text-slate-700">Certificado carregado</p>
                              <p className="text-[11px] text-slate-500">Remova para substituir por outro</p>
                            </div>
                            <Button size="xs" variant="danger" onClick={() => setFiscal(f => ({ ...f, certBase64: undefined, certPassword: undefined }))}>
                              Remover
                            </Button>
                          </div>
                        ) : (
                          <label className="flex items-center gap-3 cursor-pointer group">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-slate-200 text-slate-400 flex items-center justify-center transition-all">
                              <FileDown className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-slate-700">Selecionar arquivo .pfx</p>
                              <p className="text-[11px] text-slate-500">Certificado A1 emitido pela AC</p>
                            </div>
                            <input type="file" accept=".pfx,.p12" className="hidden"
                              onChange={e => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = ev => {
                                  const b64 = (ev.target?.result as string).split(",")[1];
                                  setFiscal(f => ({ ...f, certBase64: b64 }));
                                };
                                reader.readAsDataURL(file);
                              }}
                            />
                          </label>
                        )}
                        <FormRow cols={2}>
                          <Input label="Senha do Certificado" type="password" value={fiscal.certPassword ?? ""} onChange={e => setFiscal(f => ({ ...f, certPassword: e.target.value }))} placeholder="Senha do arquivo .pfx" />
                        </FormRow>
                      </div>
                    </PanelCard>
                  </div>
                )}
              </Tabs>
            )}
          </motion.div>
        )}

        {/* Barra de salvar única e fixa */}
        <div className="sticky bottom-3 z-30">
          <div className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white/95 p-2.5 backdrop-blur">
            <div className="flex min-w-0 items-center gap-2 pl-2">
              {saved ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
              ) : saving ? (
                <Clock className="w-4 h-4 shrink-0 text-slate-400 animate-pulse" />
              ) : dirty ? (
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-slate-300" />
              )}
              <p className="truncate text-xs font-medium text-slate-700">
                {saved ? "Tudo salvo" : saving ? "Salvando..." : dirty ? "Alterações não salvas" : "Nenhuma alteração"}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => refresh()} disabled={!dirty || saving}>
                Descartar
              </Button>
              <Button type="submit" variant="primary" size="sm" loading={saving} disabled={!dirty && !saved} iconLeft={<CheckCircle2 size={14} />}>
                {saved ? "Salvo com Sucesso" : "Salvar Alterações"}
              </Button>
            </div>
          </div>
        </div>
      </form>
      </Tabs>

      <CondominiumsCard tenant={tenant} />
      </div>
    </PageWrapper>
  );
}
