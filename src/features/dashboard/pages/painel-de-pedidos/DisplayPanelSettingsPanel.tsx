import React, { useEffect, useState } from "react";
import { Monitor, Image as ImageIcon, Volume2, Mic, Palette, Play, Trash2, GripVertical, ListChecks, LayoutGrid, Tv } from "lucide-react";
import { PageWrapper, SectionTitle, PanelCard, FormRow, Tabs, Button, IconButton, Input, Select, Switch, useToast } from "../../../../components";
import { ImageUploader, TvDevicesCard } from "../_shared/ManagementShared";
import { apiFetch, apiJson } from "../../../../lib/api";
import { playSoundFile, READY_SOUND_OPTIONS } from "../../../../lib/notificationSound";
import { announceOrderReady, listAvailableVoices, DEFAULT_VOICE_TEXT } from "../../../../lib/voiceAnnouncement";
import type { Tenant, DisplayPanelConfig, DisplayPanelImage } from "../../../../types";

const DEFAULT_DISPLAY_PANEL: DisplayPanelConfig = {
  showDelivery: false,
  showPickup: true,
  showDineIn: true,
  voiceAnnouncement: true,
  theme: "dark",
  preparingColor: "#f97316",
  readyColor: "#22c55e",
  showLogo: true,
  readySoundFile: "/alerts/som_painel_cozinha.mp3",
  voiceName: null,
  voiceText: DEFAULT_VOICE_TEXT,
  carouselEnabled: true,
  carouselIntervalSeconds: 8,
  minimalMode: false,
  ticketCardSize: "normal",
  ticketCardSizePx: null,
  cardStyle: "floating",
  artesanalCreamColor: null,
  artesanalBrownColor: null,
  artesanalShowQrFooter: true,
};

// Cores padrão do estilo Artesanal — usadas pra popular o seletor de cor (que precisa
// de um valor sempre, mesmo quando o dono nunca customizou) e pro botão "Restaurar padrão".
const ARTESANAL_DEFAULT_CREAM = "#F7F0E4";
const ARTESANAL_DEFAULT_BROWN = "#3E2415";

const CARD_STYLE_OPTIONS: { value: NonNullable<DisplayPanelConfig["cardStyle"]>; label: string; description: string }[] = [
  { value: "floating", label: "Flutuante (padrão)", description: "Cards com sombra suave e cantos arredondados, estilo app de delivery moderno." },
  { value: "ticket", label: "Ticket / Comanda", description: "Borda pontilhada tipo fichinha impressa, tipografia monoespaçada." },
  { value: "scoreboard", label: "Placar luminoso", description: "Fundo bem escuro com números em efeito neon/glow, estilo placar de drive-thru." },
  { value: "fastfood", label: "Fast-food", description: "Linhas compactas com faixa colorida na lateral, denso como painel de lanchonete." },
  { value: "grid", label: "Grade de senhas", description: "Só os números em grade compacta, vários por linha — igual painel físico de lanchonete/drive-thru." },
  { value: "artesanal", label: "Artesanal", description: "Colunas bicolor com nome e senha juntos (ex: \"Felipe 007\"), fonte arredondada e QR Code do cardápio no rodapé — estilo padaria/lanchonete artesanal." },
];

const TABS = [
  { id: "pedidos", label: "Pedidos exibidos", icon: ListChecks },
  { id: "aparencia", label: "Aparência", icon: Palette },
  { id: "som", label: "Som e voz", icon: Volume2 },
  { id: "propaganda", label: "Propaganda", icon: ImageIcon },
  { id: "dispositivos", label: "Dispositivos TV", icon: Tv },
] as const;
type TabId = (typeof TABS)[number]["id"];

interface DisplayPanelSettingsPanelProps {
  slug: string;
  tenant: Tenant;
  /** Recarrega o tenant após salvar — sem isso, a tela continuava mostrando a config
      antiga até um F5 manual, mesmo o salvamento já tendo persistido no banco. */
  refresh?: () => void;
}

export default function DisplayPanelSettingsPanel({ slug, tenant, refresh }: DisplayPanelSettingsPanelProps) {
  const toast = useToast();
  const [config, setConfig] = useState<DisplayPanelConfig>(() => {
    try {
      return tenant.displayPanelConfig
        ? { ...DEFAULT_DISPLAY_PANEL, ...JSON.parse(tenant.displayPanelConfig) }
        : DEFAULT_DISPLAY_PANEL;
    } catch {
      return DEFAULT_DISPLAY_PANEL;
    }
  });
  const [tab, setTab] = useState<TabId>("pedidos");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [images, setImages] = useState<DisplayPanelImage[]>([]);
  const [imagesLoading, setImagesLoading] = useState(true);

  useEffect(() => {
    try {
      setConfig(
        tenant.displayPanelConfig
          ? { ...DEFAULT_DISPLAY_PANEL, ...JSON.parse(tenant.displayPanelConfig) }
          : DEFAULT_DISPLAY_PANEL
      );
    } catch {
      setConfig(DEFAULT_DISPLAY_PANEL);
    }
  }, [tenant.displayPanelConfig]);

  // Vozes do navegador carregam de forma assíncrona — o evento onvoiceschanged dispara
  // quando a lista fica pronta (comportamento padrão da Web Speech API).
  useEffect(() => {
    const load = () => setVoices(listAvailableVoices());
    load();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = load;
    }
  }, []);

  const fetchImages = () => {
    setImagesLoading(true);
    apiJson<DisplayPanelImage[]>(`/api/tenants/${slug}/display-panel/images`)
      .then((data) => setImages(Array.isArray(data) ? data : []))
      .catch(() => setImages([]))
      .finally(() => setImagesLoading(false));
  };

  useEffect(() => { fetchImages(); }, [slug]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await apiJson(`/api/owner/tenants/${tenant.id}`, {
        method: "PATCH",
        body: JSON.stringify({ displayPanelConfig: JSON.stringify(config) }),
      });
      refresh?.();
      setSaved(true);
      toast.success("Configurações do Painel TV salvas com sucesso!");
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      toast.error(err?.message || "Falha ao salvar configurações do Painel TV.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddImage = async (url: string) => {
    if (!url) return;
    const created = await apiJson<DisplayPanelImage>(`/api/tenants/${slug}/display-panel/images`, {
      method: "POST",
      body: JSON.stringify({ imageUrl: url }),
    });
    setImages((prev) => [...prev, created]);
  };

  const handleToggleImage = async (image: DisplayPanelImage) => {
    const updated = await apiJson<DisplayPanelImage>(`/api/tenants/${slug}/display-panel/images/${image.id}`, {
      method: "PATCH",
      body: JSON.stringify({ active: !image.active }),
    });
    setImages((prev) => prev.map((i) => (i.id === image.id ? updated : i)));
  };

  const handleRemoveImage = async (image: DisplayPanelImage) => {
    if (!window.confirm("Remover esta imagem do carrossel?")) return;
    await apiFetch(`/api/tenants/${slug}/display-panel/images/${image.id}`, { method: "DELETE" });
    setImages((prev) => prev.filter((i) => i.id !== image.id));
  };

  const previewSound = () => playSoundFile(config.readySoundFile || DEFAULT_DISPLAY_PANEL.readySoundFile!);
  const previewVoice = () => announceOrderReady(42, { voiceName: config.voiceName, text: config.voiceText, customerName: "Felipe" });

  const cardStyle = config.cardStyle ?? "floating";
  const preparingColor = config.preparingColor ?? "#f97316";
  const readyColor = config.readyColor ?? "#22c55e";

  const toggleRow = (label: string, desc: string, control: React.ReactNode) => (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-700">{label}</p>
        <p className="text-[11px] text-slate-500">{desc}</p>
      </div>
      {control}
    </div>
  );

  const colorField = (label: string, value: string, onChange: (v: string) => void) => (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-slate-600">{label}</label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded-lg border border-slate-200"
        />
        <span className="font-mono text-xs text-slate-500">{value}</span>
      </div>
    </div>
  );

  return (
    <PageWrapper>
      <div className="space-y-4">
        <SectionTitle
          title="Config. Painel de Pedidos"
          description="Aparência, sons, voz e propaganda da tela pública que fica exposta pro cliente (TV/Fire Stick/monitor)"
          icon={Monitor}
        />

        <div>
          <Tabs items={TABS} value={tab} onChange={(v: TabId) => setTab(v)} label="Configurações do Painel TV">
            {tab === "pedidos" && (
              <PanelCard
                title="Pedidos Exibidos"
                description="Escolha quais tipos de pedido aparecem no painel. Delivery fica desativado por padrão, já que é entregue no endereço do cliente, não retirado no local."
                icon={ListChecks}
              >
                <div className="space-y-2">
                  {([
                    { key: "showDineIn" as const, label: "Mesa / Salão", desc: "Pedidos feitos nas mesas do estabelecimento." },
                    { key: "showPickup" as const, label: "Retirada no Balcão", desc: "Cliente busca o pedido presencialmente." },
                    { key: "showDelivery" as const, label: "Delivery", desc: "Pedido é entregue no endereço do cliente." },
                  ]).map((opt) => (
                    <div key={opt.key}>
                      {toggleRow(
                        opt.label,
                        opt.desc,
                        <Switch checked={config[opt.key]} onCheckedChange={(v) => setConfig({ ...config, [opt.key]: v })} />,
                      )}
                    </div>
                  ))}
                </div>
              </PanelCard>
            )}

            {tab === "aparencia" && (
              <div className="space-y-4">
                <PanelCard title="Tema e Cores" description="Tema de fundo e cores de destaque de cada coluna do painel." icon={Palette}>
                  <div className="space-y-3">
                    <FormRow cols={2}>
                      <Select
                        label="Tema"
                        value={config.theme ?? "dark"}
                        onChange={(e) => setConfig({ ...config, theme: e.target.value as "dark" | "light" })}
                        options={[
                          { value: "dark", label: "Escuro (padrão)" },
                          { value: "light", label: "Claro" },
                        ]}
                      />
                      {toggleRow(
                        "Mostrar logo",
                        "Exibe o logo do estabelecimento no cabeçalho.",
                        <Switch checked={config.showLogo !== false} onCheckedChange={(v) => setConfig({ ...config, showLogo: v })} />,
                      )}
                    </FormRow>
                    <FormRow cols={2}>
                      {colorField("Cor — Em Preparo", preparingColor, (v) => setConfig({ ...config, preparingColor: v }))}
                      {colorField("Cor — Pronto", readyColor, (v) => setConfig({ ...config, readyColor: v }))}
                    </FormRow>
                  </div>
                </PanelCard>

                <PanelCard
                  title="Layout"
                  description="Estilo visual do cartão de senha, tamanho da senha exibida e opção de tela minimalista, sem cabeçalho nem rodapé."
                  icon={LayoutGrid}
                >
                  <div className="space-y-4">
                    <div>
                      <p className="mb-2 text-xs font-medium text-slate-600">Estilo do cartão</p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {CARD_STYLE_OPTIONS.map((opt) => {
                          const active = cardStyle === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setConfig({ ...config, cardStyle: opt.value })}
                              className={`rounded-lg border p-3 text-left transition-colors ${
                                active ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-slate-50 hover:border-slate-300"
                              }`}
                            >
                              <p className={`text-xs font-semibold ${active ? "text-blue-700" : "text-slate-700"}`}>{opt.label}</p>
                              <p className="mt-0.5 text-[11px] text-slate-500">{opt.description}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <FormRow cols={2}>
                      <Select
                        label="Tamanho da senha"
                        value={config.ticketCardSize ?? "normal"}
                        onChange={(e) => setConfig({ ...config, ticketCardSize: e.target.value as DisplayPanelConfig["ticketCardSize"] })}
                        options={[
                          { value: "normal", label: "Normal" },
                          { value: "large", label: "Grande" },
                          { value: "xlarge", label: "Extra grande" },
                        ]}
                      />
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-slate-600">Tamanho personalizado (px)</label>
                        <Input
                          type="number"
                          min={0}
                          placeholder="Ex: 80"
                          value={config.ticketCardSizePx ?? ""}
                          onChange={(e) => setConfig({ ...config, ticketCardSizePx: e.target.value ? Number(e.target.value) : null })}
                        />
                        <p className="mt-1 text-[11px] text-slate-500">Preenchido, sobrepõe o tamanho acima.</p>
                      </div>
                    </FormRow>

                    {toggleRow(
                      "Modo minimalista",
                      "Esconde cabeçalho, rodapé, nome do cliente e a etiqueta \"Pronto\" — mostra só o número da senha, bem grande, ocupando a tela inteira.",
                      <Switch
                        checked={config.minimalMode === true}
                        onCheckedChange={(v) =>
                          setConfig({ ...config, minimalMode: v, ticketCardSize: v ? "xlarge" : config.ticketCardSize })
                        }
                      />,
                    )}
                  </div>
                </PanelCard>

                {cardStyle === "artesanal" && (
                  <PanelCard title="Cores do estilo Artesanal" icon={Palette}>
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-end gap-4">
                        {colorField("Cor clara (coluna Preparando)", config.artesanalCreamColor || ARTESANAL_DEFAULT_CREAM, (v) =>
                          setConfig({ ...config, artesanalCreamColor: v }),
                        )}
                        {colorField("Cor escura (coluna Prontos)", config.artesanalBrownColor || ARTESANAL_DEFAULT_BROWN, (v) =>
                          setConfig({ ...config, artesanalBrownColor: v }),
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setConfig({ ...config, artesanalCreamColor: null, artesanalBrownColor: null })}
                        >
                          Restaurar cor padrão
                        </Button>
                      </div>
                      {toggleRow(
                        "Mostrar QR Code do cardápio no rodapé",
                        "\"Acesse nosso cardápio digital\" com o QR Code do balcão.",
                        <Switch
                          checked={config.artesanalShowQrFooter !== false}
                          onCheckedChange={(v) => setConfig({ ...config, artesanalShowQrFooter: v })}
                        />,
                      )}
                    </div>
                  </PanelCard>
                )}
              </div>
            )}

            {tab === "som" && (
              <PanelCard title="Som e Voz" description="Som e fala usados quando uma senha é chamada (pedido fica pronto)." icon={Volume2}>
                <div className="space-y-3">
                  {toggleRow(
                    "Anúncio por voz",
                    "Fala em voz alta quando o pedido fica pronto. Desligue se preferir só o som.",
                    <Switch
                      checked={config.voiceAnnouncement !== false}
                      onCheckedChange={(v) => setConfig({ ...config, voiceAnnouncement: v })}
                    />,
                  )}

                  <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_auto]">
                    <Select
                      label="Som de chamada"
                      value={config.readySoundFile ?? DEFAULT_DISPLAY_PANEL.readySoundFile}
                      onChange={(e) => setConfig({ ...config, readySoundFile: e.target.value })}
                      options={READY_SOUND_OPTIONS.map((s) => ({ value: s.file, label: s.label }))}
                    />
                    <Button type="button" variant="outline" size="md" iconLeft={<Play className="w-3.5 h-3.5" />} onClick={previewSound}>
                      Ouvir
                    </Button>
                  </div>

                  {config.voiceAnnouncement !== false && (
                    <>
                      <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_auto]">
                        <Select
                          label="Voz"
                          value={config.voiceName ?? ""}
                          onChange={(e) => setConfig({ ...config, voiceName: e.target.value || null })}
                          placeholder="Automática (recomendado)"
                          options={voices.map((v) => ({ value: v.name, label: `${v.name} (${v.lang})` }))}
                        />
                        <Button type="button" variant="outline" size="md" iconLeft={<Mic className="w-3.5 h-3.5" />} onClick={previewVoice}>
                          Ouvir
                        </Button>
                      </div>
                      {voices.length === 0 && (
                        <p className="text-[11px] text-amber-700">
                          Nenhuma voz em português encontrada neste navegador/dispositivo — a fala pode usar uma voz em outro idioma.
                        </p>
                      )}

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-600">Texto falado</label>
                        <Input
                          type="text"
                          value={config.voiceText ?? DEFAULT_VOICE_TEXT}
                          onChange={(e) => setConfig({ ...config, voiceText: e.target.value })}
                          placeholder={DEFAULT_VOICE_TEXT}
                        />
                        <p className="text-[11px] text-slate-500">
                          Use <code className="rounded bg-slate-100 px-1">{"{numero}"}</code> onde a senha deve ser falada
                          e <code className="rounded bg-slate-100 px-1">{"{nome}"}</code> onde o nome do cliente deve ser
                          falado (some sozinho da frase se o pedido não tiver nome cadastrado).
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </PanelCard>
            )}

            {tab === "propaganda" && (
              <PanelCard
                title="Propaganda (Carrossel de Imagens)"
                description="Imagens (recomendado PNG sem fundo) exibidas numa faixa ao lado das colunas de pedidos, alternando automaticamente. Se não houver nenhuma imagem ativa, as colunas de pedidos ocupam a tela inteira."
                icon={ImageIcon}
              >
                <div className="space-y-3">
                  {toggleRow(
                    "Exibir carrossel",
                    "Desligue pra sempre usar a tela inteira só com os pedidos.",
                    <Switch
                      checked={config.carouselEnabled !== false}
                      onCheckedChange={(v) => setConfig({ ...config, carouselEnabled: v })}
                    />,
                  )}

                  {config.carouselEnabled !== false && (
                    <>
                      <FormRow cols={2}>
                        <Select
                          label="Cada imagem fica visível por"
                          value={String(config.carouselIntervalSeconds ?? 8)}
                          onChange={(e) => setConfig({ ...config, carouselIntervalSeconds: Number(e.target.value) })}
                          options={[4, 6, 8, 10, 15, 20, 30].map((s) => ({ value: s, label: `${s} segundos` }))}
                        />
                      </FormRow>

                      <ImageUploader
                        label="Adicionar imagem ao carrossel"
                        value=""
                        onChange={handleAddImage}
                        description="PNG com fundo transparente funciona melhor. A imagem entra ativa no carrossel automaticamente."
                      />

                      {!imagesLoading && images.length === 0 && (
                        <p className="py-4 text-center text-xs text-slate-500">Nenhuma imagem cadastrada ainda.</p>
                      )}

                      {images.length > 0 && (
                        <div className="space-y-2">
                          {images.map((image) => (
                            <div key={image.id} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                              <GripVertical className="h-4 w-4 shrink-0 text-slate-300" />
                              <img src={image.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-lg bg-slate-100 object-contain" />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-medium text-slate-600">{image.imageUrl.split("/").pop()}</p>
                                <p className="text-[11px] text-slate-500">{image.active ? "Ativa no carrossel" : "Desativada"}</p>
                              </div>
                              <Switch checked={image.active} onCheckedChange={() => handleToggleImage(image)} />
                              <IconButton variant="danger" size="sm" aria-label="Remover imagem" onClick={() => handleRemoveImage(image)}>
                                <Trash2 className="h-4 w-4" />
                              </IconButton>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </PanelCard>
            )}

            {tab === "dispositivos" && tenant?.slug && <TvDevicesCard slug={tenant.slug} />}
          </Tabs>

        </div>

        <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 backdrop-blur">
          <p className="mr-auto text-[11px] text-slate-500">As alterações só valem para o painel depois de salvar.</p>
          <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
            {saved ? "Salvo!" : "Salvar Alterações"}
          </Button>
        </div>
      </div>
    </PageWrapper>
  );
}
