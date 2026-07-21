import { useEffect, useState } from "react";
import { Monitor, Image as ImageIcon, Volume2, Mic, Palette, Play, Trash2, GripVertical } from "lucide-react";
import { PageWrapper, SectionTitle, ContentCard, Button, Select, Switch } from "../../../../components";
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
  cardStyle: "floating",
};

const CARD_STYLE_OPTIONS: { value: NonNullable<DisplayPanelConfig["cardStyle"]>; label: string; description: string }[] = [
  { value: "floating", label: "Flutuante (padrão)", description: "Cards com sombra suave e cantos arredondados, estilo app de delivery moderno." },
  { value: "ticket", label: "Ticket / Comanda", description: "Borda pontilhada tipo fichinha impressa, tipografia monoespaçada." },
  { value: "scoreboard", label: "Placar luminoso", description: "Fundo bem escuro com números em efeito neon/glow, estilo placar de drive-thru." },
  { value: "fastfood", label: "Fast-food", description: "Linhas compactas com faixa colorida na lateral, denso como painel de lanchonete." },
  { value: "grid", label: "Grade de senhas", description: "Só os números em grade compacta, vários por linha — igual painel físico de lanchonete/drive-thru." },
];

interface DisplayPanelSettingsPanelProps {
  slug: string;
  tenant: Tenant;
}

export default function DisplayPanelSettingsPanel({ slug, tenant }: DisplayPanelSettingsPanelProps) {
  const [config, setConfig] = useState<DisplayPanelConfig>(() => {
    try {
      return tenant.displayPanelConfig
        ? { ...DEFAULT_DISPLAY_PANEL, ...JSON.parse(tenant.displayPanelConfig) }
        : DEFAULT_DISPLAY_PANEL;
    } catch {
      return DEFAULT_DISPLAY_PANEL;
    }
  });
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
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
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
  const previewVoice = () => announceOrderReady(42, { voiceName: config.voiceName, text: config.voiceText });

  return (
    <PageWrapper>
      <SectionTitle
        title="Config. Painel de Pedidos"
        description="Aparência, sons, voz e propaganda da tela pública que fica exposta pro cliente (TV/Fire Stick/monitor)"
        icon={Monitor}
        action={
          <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
            {saved ? "Salvo!" : "Salvar Alterações"}
          </Button>
        }
        className="mb-6"
      />

      <div className="space-y-6">
        {/* Tipos de pedido exibidos */}
        <ContentCard padding="lg">
          <div className="flex items-center gap-3 mb-1">
            <Monitor className="w-4 h-4 text-slate-400" />
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Pedidos Exibidos</p>
          </div>
          <p className="text-[10px] text-slate-400 mb-6">
            Escolha quais tipos de pedido aparecem no painel. Delivery fica desativado por padrão, já que é entregue
            no endereço do cliente, não retirado no local.
          </p>
          <div className="space-y-3">
            {([
              { key: "showDineIn" as const, label: "Mesa / Salão", desc: "Pedidos feitos nas mesas do estabelecimento." },
              { key: "showPickup" as const, label: "Retirada no Balcão", desc: "Cliente busca o pedido presencialmente." },
              { key: "showDelivery" as const, label: "Delivery", desc: "Pedido é entregue no endereço do cliente." },
            ]).map((opt) => (
              <div key={opt.key} className="flex items-center justify-between gap-4 bg-slate-50 border border-slate-100 rounded-2xl p-4">
                <div>
                  <p className="text-xs font-black text-slate-700">{opt.label}</p>
                  <p className="text-[11px] text-slate-400">{opt.desc}</p>
                </div>
                <Switch checked={config[opt.key]} onCheckedChange={(v) => setConfig({ ...config, [opt.key]: v })} />
              </div>
            ))}
          </div>
        </ContentCard>

        {/* Aparência: tema e cores */}
        <ContentCard padding="lg">
          <div className="flex items-center gap-3 mb-1">
            <Palette className="w-4 h-4 text-slate-400" />
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Aparência</p>
          </div>
          <p className="text-[10px] text-slate-400 mb-6">
            Tema de fundo e cores de destaque de cada coluna do painel.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Select
              label="Tema"
              value={config.theme ?? "dark"}
              onChange={(e) => setConfig({ ...config, theme: e.target.value as "dark" | "light" })}
              options={[
                { value: "dark", label: "Escuro (padrão)" },
                { value: "light", label: "Claro" },
              ]}
            />
            <div className="flex items-center justify-between gap-4 bg-slate-50 border border-slate-100 rounded-2xl px-4">
              <div>
                <p className="text-xs font-black text-slate-700">Mostrar logo</p>
                <p className="text-[11px] text-slate-400">Exibe o logo do estabelecimento no cabeçalho.</p>
              </div>
              <Switch checked={config.showLogo !== false} onCheckedChange={(v) => setConfig({ ...config, showLogo: v })} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6">
            <div className="space-y-1.5">
              <label className="ds-label">Cor — Em Preparo</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={config.preparingColor ?? "#f97316"}
                  onChange={(e) => setConfig({ ...config, preparingColor: e.target.value })}
                  className="w-12 h-10 rounded-lg border border-slate-200 cursor-pointer"
                />
                <span className="text-xs font-mono text-slate-500">{config.preparingColor ?? "#f97316"}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="ds-label">Cor — Pronto</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={config.readyColor ?? "#22c55e"}
                  onChange={(e) => setConfig({ ...config, readyColor: e.target.value })}
                  className="w-12 h-10 rounded-lg border border-slate-200 cursor-pointer"
                />
                <span className="text-xs font-mono text-slate-500">{config.readyColor ?? "#22c55e"}</span>
              </div>
            </div>
          </div>
        </ContentCard>

        {/* Layout */}
        <ContentCard padding="lg">
          <div className="flex items-center gap-3 mb-1">
            <Monitor className="w-4 h-4 text-slate-400" />
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Layout</p>
          </div>
          <p className="text-[10px] text-slate-400 mb-6">
            Estilo visual do cartão de senha, tamanho da senha exibida e opção de tela minimalista, sem cabeçalho
            nem rodapé.
          </p>

          <div className="mb-6">
            <p className="ds-label mb-2">Estilo do cartão</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CARD_STYLE_OPTIONS.map((opt) => {
                const active = (config.cardStyle ?? "floating") === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setConfig({ ...config, cardStyle: opt.value })}
                    className={`text-left rounded-2xl border p-4 transition-colors ${
                      active ? "border-orange-400 bg-orange-50" : "border-slate-100 bg-slate-50 hover:border-slate-200"
                    }`}
                  >
                    <p className={`text-xs font-black ${active ? "text-orange-600" : "text-slate-700"}`}>{opt.label}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{opt.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="max-w-xs mb-6">
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
          </div>

          <div className="flex items-center justify-between gap-4 bg-slate-50 border border-slate-100 rounded-2xl p-4">
            <div>
              <p className="text-xs font-black text-slate-700">Modo minimalista</p>
              <p className="text-[11px] text-slate-400">
                Esconde cabeçalho, rodapé, nome do cliente e a etiqueta "Pronto" — mostra só o número da senha,
                bem grande, ocupando a tela inteira.
              </p>
            </div>
            <Switch
              checked={config.minimalMode === true}
              onCheckedChange={(v) =>
                setConfig({ ...config, minimalMode: v, ticketCardSize: v ? "xlarge" : config.ticketCardSize })
              }
            />
          </div>
        </ContentCard>

        {/* Som e voz */}
        <ContentCard padding="lg">
          <div className="flex items-center gap-3 mb-1">
            <Volume2 className="w-4 h-4 text-slate-400" />
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Som e Voz</p>
          </div>
          <p className="text-[10px] text-slate-400 mb-6">
            Som e fala usados quando uma senha é chamada (pedido fica pronto).
          </p>

          <div className="flex items-center justify-between gap-4 bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-4">
            <div>
              <p className="text-xs font-black text-slate-700">Anúncio por voz</p>
              <p className="text-[11px] text-slate-400">Fala em voz alta quando o pedido fica pronto. Desligue se preferir só o som.</p>
            </div>
            <Switch
              checked={config.voiceAnnouncement !== false}
              onCheckedChange={(v) => setConfig({ ...config, voiceAnnouncement: v })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end mb-4">
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
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end mb-4">
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
                <p className="text-[10px] text-amber-500 -mt-2 mb-4">
                  Nenhuma voz em português encontrada neste navegador/dispositivo — a fala pode usar uma voz em outro idioma.
                </p>
              )}

              <div className="space-y-1.5">
                <label className="ds-label">Texto falado</label>
                <input
                  type="text"
                  value={config.voiceText ?? DEFAULT_VOICE_TEXT}
                  onChange={(e) => setConfig({ ...config, voiceText: e.target.value })}
                  placeholder={DEFAULT_VOICE_TEXT}
                  className="ds-input w-full"
                />
                <p className="text-[10px] text-slate-400">
                  Use <code className="bg-slate-100 px-1 rounded">{"{numero}"}</code> onde a senha deve ser falada.
                </p>
              </div>
            </>
          )}
        </ContentCard>

        {/* Carrossel de propaganda */}
        <ContentCard padding="lg">
          <div className="flex items-center gap-3 mb-1">
            <ImageIcon className="w-4 h-4 text-slate-400" />
            <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Propaganda (Carrossel de Imagens)</p>
          </div>
          <p className="text-[10px] text-slate-400 mb-6">
            Imagens (recomendado PNG sem fundo) exibidas numa faixa ao lado das colunas de pedidos, alternando
            automaticamente. Se não houver nenhuma imagem ativa, as colunas de pedidos ocupam a tela inteira.
          </p>

          <div className="flex items-center justify-between gap-4 bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-6">
            <div>
              <p className="text-xs font-black text-slate-700">Exibir carrossel</p>
              <p className="text-[11px] text-slate-400">Desligue pra sempre usar a tela inteira só com os pedidos.</p>
            </div>
            <Switch
              checked={config.carouselEnabled !== false}
              onCheckedChange={(v) => setConfig({ ...config, carouselEnabled: v })}
            />
          </div>

          {config.carouselEnabled !== false && (
            <>
              <div className="max-w-xs mb-6">
                <Select
                  label="Cada imagem fica visível por"
                  value={String(config.carouselIntervalSeconds ?? 8)}
                  onChange={(e) => setConfig({ ...config, carouselIntervalSeconds: Number(e.target.value) })}
                  options={[4, 6, 8, 10, 15, 20, 30].map((s) => ({ value: s, label: `${s} segundos` }))}
                />
              </div>

              <ImageUploader
                label="Adicionar imagem ao carrossel"
                value=""
                onChange={handleAddImage}
                description="PNG com fundo transparente funciona melhor. A imagem entra ativa no carrossel automaticamente."
              />

              {!imagesLoading && images.length === 0 && (
                <p className="text-xs text-slate-300 text-center py-6">Nenhuma imagem cadastrada ainda.</p>
              )}

              {images.length > 0 && (
                <div className="space-y-2 mt-6">
                  {images.map((image) => (
                    <div key={image.id} className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                      <GripVertical className="w-4 h-4 text-slate-300 shrink-0" />
                      <img src={image.imageUrl} alt="" className="w-12 h-12 object-contain rounded-lg bg-slate-100 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-600 truncate">{image.imageUrl.split("/").pop()}</p>
                        <p className="text-[10px] text-slate-400">{image.active ? "Ativa no carrossel" : "Desativada"}</p>
                      </div>
                      <Switch checked={image.active} onCheckedChange={() => handleToggleImage(image)} />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(image)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 transition-colors shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </ContentCard>

        {tenant?.slug && <TvDevicesCard slug={tenant.slug} />}
      </div>
    </PageWrapper>
  );
}
