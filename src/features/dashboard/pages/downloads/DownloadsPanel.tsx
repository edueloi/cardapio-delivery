import { useState } from "react";
import { Download, Monitor, Globe, CheckCircle2, ArrowRight, Package2, Smartphone, Share, Plus, MoreHorizontal, Tv } from "lucide-react";
import { PageWrapper, SectionTitle, ContentCard, Tabs, Badge, Alert } from "../../../../components";

// Baixa direto da Release mais recente no GitHub (link estável — o nome do arquivo não
// leva a versão, então "latest/download/<nome>" sempre aponta pro build mais novo, sem
// precisar editar esta tela a cada atualização do app). A Release é publicada
// automaticamente pelo workflow .github/workflows/build-pdv-desktop.yml.
const GITHUB_RELEASES_BASE = "https://github.com/edueloi/cardapio-delivery/releases/latest/download";

const DOWNLOAD_TABS = [
  { id: "mobile", label: "Celular", icon: Smartphone },
  { id: "desktop", label: "Desktop Windows", icon: Monitor },
  { id: "tv", label: "Painel TV", icon: Tv },
] as const;
type DownloadTab = (typeof DOWNLOAD_TABS)[number]["id"];

const linkButton =
  "inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-blue-600 bg-blue-600 px-3 text-xs font-medium text-white transition-colors hover:bg-blue-700";

const downloads = [
  {
    id: "windows-installer",
    name: "Menu BoxSys PDV",
    subtitle: "Instalador Windows",
    description: "Versão completa com instalação automática, atalho na área de trabalho e atualizações.",
    icon: Monitor,
    badge: "Recomendado",
    badgeColor: "primary" as const,
    filename: `Box-Sys-PDV-Setup.exe`,
    url: `${GITHUB_RELEASES_BASE}/Box-Sys-PDV-Setup.exe`,
    size: "~150 MB",
    os: "Windows 10/11 64-bit",
  },
  {
    id: "windows-portable",
    name: "Menu BoxSys PDV",
    subtitle: "Versão Portátil",
    description: "Execute sem instalar. Ideal para uso em pendrive ou computadores sem permissão de administrador.",
    icon: Package2,
    badge: "Sem instalação",
    badgeColor: "default" as const,
    filename: `BoxSys-PDV-Portable.exe`,
    url: `${GITHUB_RELEASES_BASE}/BoxSys-PDV-Portable.exe`,
    size: "~150 MB",
    os: "Windows 10/11 64-bit",
  },
];

const features = [
  "PDV completo funcionando como app nativo, em tela cheia (modo caixa)",
  "Acesso rápido sem abrir o navegador",
  "Impressão do recibo direto na impressora térmica, sem diálogo do Windows",
  "Atalho na barra de tarefas e área de trabalho",
  "Notificações do sistema para novos pedidos",
];

const steps = [
  { n: "1", title: "Baixe o instalador", desc: "Clique em Download e aguarde o arquivo .exe ser baixado." },
  { n: "2", title: "Execute o instalador", desc: "Dê duplo clique no arquivo baixado e siga as instruções na tela." },
  { n: "3", title: "Faça login", desc: "Na primeira execução, informe seu e-mail e senha do painel web." },
  { n: "4", title: "Configure a impressora", desc: "Aperte F9 dentro do app para escolher a impressora térmica instalada no Windows e testar." },
  { n: "5", title: "Pronto!", desc: "O PDV abre em tela cheia (Ctrl+Shift+Q para fechar o app)." },
];

function StepList({ items }: { items: { n: string; title: string; desc: React.ReactNode }[] }) {
  return (
    <ol className="space-y-3">
      {items.map((s) => (
        <li key={s.n} className="flex items-start gap-3">
          <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-[11px] font-medium flex items-center justify-center shrink-0">
            {s.n}
          </span>
          <div>
            <p className="text-xs font-medium text-slate-800">{s.title}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{s.desc}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function DownloadsPanel() {
  const [tab, setTab] = useState<DownloadTab>("mobile");

  return (
    <PageWrapper>
      <div className="space-y-4">
        <SectionTitle
          title="Downloads"
          description="Baixe o aplicativo desktop do Menu BoxSys PDV para Windows"
          icon={Download}
        />

        <Tabs<DownloadTab> items={DOWNLOAD_TABS} value={tab} onChange={setTab} label="Downloads">
          {tab === "mobile" && (
            <div className="space-y-4">
              {/* ── App Celular (PWA) ── */}
              <ContentCard>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <img
                    src="/system/menu-boxsys-icon-v1.png"
                    alt="Menu BoxSys no celular"
                    className="w-24 h-24 object-contain shrink-0"
                  />
                  <div className="flex-1 text-center sm:text-left">
                    <div className="flex items-center gap-2 justify-center sm:justify-start mb-1">
                      <Badge color="success" size="sm">Grátis</Badge>
                      <Badge color="default" size="sm">iOS & Android</Badge>
                    </div>
                    <h3 className="text-sm font-medium text-slate-800 mb-1">Menu BoxSys no Celular</h3>
                    <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                      Adicione o painel à tela inicial do seu celular e use como um app nativo — sem baixar nada da loja.
                    </p>
                    <a
                      href={window.location.origin + "/painel"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={linkButton}
                    >
                      <Smartphone size={14} />
                      Abrir no Celular
                    </a>
                  </div>
                </div>
              </ContentCard>

              {/* Instruções PWA por plataforma */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ContentCard>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                      <Smartphone className="w-4 h-4 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">iPhone / iPad</p>
                      <p className="text-[11px] text-slate-500">Safari</p>
                    </div>
                  </div>
                  <ol className="space-y-2.5">
                    {[
                      { icon: <Globe className="w-3.5 h-3.5 shrink-0 text-blue-600" />, text: <>Abra o painel no <strong>Safari</strong></> },
                      { icon: <Share className="w-3.5 h-3.5 shrink-0 text-blue-600" />, text: <>Toque no ícone de <strong>Compartilhar</strong> (quadrado com seta)</> },
                      { icon: <Plus className="w-3.5 h-3.5 shrink-0 text-blue-600" />, text: <>Selecione <strong>"Adicionar à Tela Inicial"</strong></> },
                      { icon: <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-green-500" />, text: <>Toque em <strong>Adicionar</strong> — pronto!</> },
                    ].map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                        {s.icon}
                        <span>{s.text}</span>
                      </li>
                    ))}
                  </ol>
                </ContentCard>

                <ContentCard>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                      <Smartphone className="w-4 h-4 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">Android</p>
                      <p className="text-[11px] text-slate-500">Chrome</p>
                    </div>
                  </div>
                  <ol className="space-y-2.5">
                    {[
                      { icon: <Globe className="w-3.5 h-3.5 shrink-0 text-blue-600" />, text: <>Abra o painel no <strong>Chrome</strong></> },
                      { icon: <MoreHorizontal className="w-3.5 h-3.5 shrink-0 text-blue-600" />, text: <>Toque nos <strong>3 pontos</strong> no canto superior direito</> },
                      { icon: <Plus className="w-3.5 h-3.5 shrink-0 text-blue-600" />, text: <>Selecione <strong>"Adicionar à tela inicial"</strong></> },
                      { icon: <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-green-500" />, text: <>Confirme e o ícone aparece na tela!</> },
                    ].map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                        {s.icon}
                        <span>{s.text}</span>
                      </li>
                    ))}
                  </ol>
                </ContentCard>
              </div>
            </div>
          )}

          {tab === "desktop" && (
            <div className="space-y-4">
              {/* Download cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {downloads.map((item) => {
                  const Icon = item.icon;
                  return (
                    <ContentCard key={item.id} className="flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg border border-blue-100 bg-blue-50 flex items-center justify-center shrink-0">
                            <Icon className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-medium text-slate-800 text-sm leading-tight">{item.name}</h3>
                            <p className="text-[11px] text-slate-500">{item.subtitle}</p>
                          </div>
                        </div>
                        <Badge color={item.badgeColor} size="sm">{item.badge}</Badge>
                      </div>

                      <p className="text-xs text-slate-500 leading-relaxed">{item.description}</p>

                      <div className="flex items-center gap-4 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1.5">
                          <Monitor className="w-3.5 h-3.5" />
                          {item.os}
                        </span>
                        <span>{item.size}</span>
                      </div>

                      <a href={item.url} download={item.filename} className={`${linkButton} mt-auto w-full`}>
                        <Download size={14} />
                        Download
                      </a>
                    </ContentCard>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <ContentCard title="O que está incluído">
                  <ul className="space-y-2">
                    {features.map((f) => (
                      <li key={f} className="flex items-center gap-3 text-xs text-slate-600">
                        <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </ContentCard>

                <ContentCard title="Como instalar">
                  <StepList items={steps} />
                </ContentCard>
              </div>

              {/* Windows SmartScreen warning */}
              <Alert variant="warning" title="Windows pode bloquear o arquivo ao instalar">
                <p>
                  O Windows Defender SmartScreen pode exibir um aviso de segurança. Isso é normal para aplicativos sem certificado digital. Para instalar:
                </p>
                <ol className="mt-2 space-y-1.5">
                  <li className="flex items-center gap-2"><ArrowRight className="w-3.5 h-3.5 shrink-0" /> Clique em <strong>"Mais informações"</strong> na tela de aviso</li>
                  <li className="flex items-center gap-2"><ArrowRight className="w-3.5 h-3.5 shrink-0" /> Em seguida clique em <strong>"Executar assim mesmo"</strong></li>
                  <li className="flex items-center gap-2"><ArrowRight className="w-3.5 h-3.5 shrink-0" /> A instalação prosseguirá normalmente</li>
                </ol>
              </Alert>

              {/* Login info */}
              <Alert variant="info" title="Como fazer login no app">
                <p>
                  O app desktop usa o mesmo e-mail e senha do painel web. Não é necessário nenhuma configuração extra.
                </p>
                <ol className="mt-2 space-y-1.5">
                  <li className="flex items-center gap-2"><ArrowRight className="w-3.5 h-3.5 shrink-0" /> Abra o aplicativo instalado</li>
                  <li className="flex items-center gap-2"><ArrowRight className="w-3.5 h-3.5 shrink-0" /> Digite o mesmo <strong>e-mail e senha</strong> que você usa no painel web</li>
                  <li className="flex items-center gap-2"><ArrowRight className="w-3.5 h-3.5 shrink-0" /> Clique em <strong>Entrar no PDV</strong> — o app abre direto no caixa</li>
                </ol>
              </Alert>
            </div>
          )}

          {tab === "tv" && (
            <div className="space-y-4">
              <ContentCard>
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg border border-blue-100 bg-blue-50 flex items-center justify-center shrink-0">
                    <Tv className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-slate-800 text-sm leading-tight">Painel de Pedidos na TV</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      App para Android TV e Fire TV Stick que mostra só o Painel de Pedidos em tela cheia — ideal pra deixar
                      fixo na TV do balcão ou da cozinha. Uma vez vinculado, fica sempre conectado (mesmo desligando e
                      ligando de novo), até você desvincular em Configurações → TVs.
                    </p>
                  </div>
                </div>

                <a
                  href="/downloads/BoxSys-PainelTV.apk"
                  download="BoxSys-PainelTV.apk"
                  className={linkButton}
                >
                  <Download size={14} />
                  Baixar APK do Painel TV
                </a>
              </ContentCard>

              <ContentCard title="Como instalar na TV (Fire TV Stick)">
                <StepList
                  items={[
                    { n: "1", title: "Instale o app \"Downloader\"", desc: "Na Fire TV, abra a loja de apps da Amazon e instale o app gratuito \"Downloader\"." },
                    { n: "2", title: "Digite a URL do APK", desc: <>Abra o Downloader e digite: <strong className="text-slate-800">boxsys.com.br/tv</strong> (URL curta, fácil de digitar no controle)</> },
                    { n: "3", title: "Baixe e instale", desc: "O Downloader vai baixar e perguntar se pode instalar apps de fontes desconhecidas — permita e conclua a instalação." },
                    { n: "4", title: "Abra o app", desc: "Ele vai mostrar um código de 6 dígitos na tela." },
                    { n: "5", title: "Vincule no painel web", desc: "No computador ou celular, vá em Configurações → TVs, digite o código e pronto — a TV já fica autenticada e conectada permanentemente." },
                  ]}
                />
                <p className="text-[11px] text-slate-500 mt-4">
                  Em Android TV (não Fire Stick), o processo é o mesmo — o Downloader também está disponível na Google Play Store da TV.
                  Depois de instalado, o app inicia sozinho toda vez que a TV é ligada, sem precisar abrir manualmente.
                </p>
              </ContentCard>
            </div>
          )}
        </Tabs>
      </div>
    </PageWrapper>
  );
}
