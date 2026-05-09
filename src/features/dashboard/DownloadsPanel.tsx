import { Download, Monitor, Globe, CheckCircle2, ArrowRight, Package2 } from "lucide-react";
import { PageWrapper, SectionTitle, ContentCard } from "../../components";

const VERSION = "1.0.0";

const downloads = [
  {
    id: "windows-installer",
    name: "MenuFlow PDV",
    subtitle: "Instalador Windows",
    description: "Versão completa com instalação automática, atalho na área de trabalho e atualizações.",
    icon: Monitor,
    badge: "Recomendado",
    badgeColor: "bg-[#C9A227] text-black",
    filename: `MenuFlow-PDV-Setup-${VERSION}.exe`,
    url: `/downloads/MenuFlow-PDV-Setup-${VERSION}.exe`,
    size: "~85 MB",
    os: "Windows 10/11 64-bit",
  },
  {
    id: "windows-portable",
    name: "MenuFlow PDV",
    subtitle: "Versão Portátil",
    description: "Execute sem instalar. Ideal para uso em pendrive ou computadores sem permissão de administrador.",
    icon: Package2,
    badge: "Sem instalação",
    badgeColor: "bg-slate-100 text-slate-600",
    filename: `PDV-Develoi-Portable.exe`,
    url: `/downloads/PDV-Develoi-Portable.exe`,
    size: "~85 MB",
    os: "Windows 10/11 64-bit",
  },
];

const features = [
  "PDV completo funcionando como app nativo",
  "Acesso rápido sem abrir o navegador",
  "Atalho na barra de tarefas e área de trabalho",
  "Impressão de cupom fiscal nativa",
  "Notificações do sistema para novos pedidos",
  "Funciona com qualquer resolução de monitor",
];

const steps = [
  { n: "1", title: "Baixe o instalador", desc: "Clique em Download e aguarde o arquivo .exe ser baixado." },
  { n: "2", title: "Execute o instalador", desc: "Dê duplo clique no arquivo baixado e siga as instruções na tela." },
  { n: "3", title: "Faça login", desc: "Na primeira execução, informe seu e-mail e senha do painel web." },
  { n: "4", title: "Pronto!", desc: "O PDV abre em tela cheia, pronto para usar." },
];

export default function DownloadsPanel() {
  return (
    <PageWrapper>
      <SectionTitle
        title="Downloads"
        description="Baixe o aplicativo desktop do MenuFlow PDV para Windows"
        icon={Download}
        className="mb-6"
      />

      {/* Download cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {downloads.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.id} className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col gap-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#0D1B3E] flex items-center justify-center shrink-0">
                    <Icon className="w-6 h-6 text-[#C9A227]" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 text-base leading-tight">{item.name}</h3>
                    <p className="text-xs text-slate-400 font-medium">{item.subtitle}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${item.badgeColor}`}>
                  {item.badge}
                </span>
              </div>

              <p className="text-sm text-slate-500 leading-relaxed">{item.description}</p>

              <div className="flex items-center gap-4 text-xs text-slate-400 font-medium">
                <span className="flex items-center gap-1.5">
                  <Monitor className="w-3.5 h-3.5" />
                  {item.os}
                </span>
                <span>{item.size}</span>
              </div>

              <a
                href={item.url}
                download={item.filename}
                className="mt-auto flex items-center justify-center gap-2 bg-[#0D1B3E] hover:bg-[#162548] text-white font-black text-sm uppercase tracking-widest py-3 px-6 rounded-xl transition-colors"
              >
                <Download className="w-4 h-4" />
                Download
              </a>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Features */}
        <ContentCard title="O que está incluído">
          <ul className="space-y-2.5">
            {features.map((f) => (
              <li key={f} className="flex items-center gap-3 text-sm text-slate-600">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </ContentCard>

        {/* How to install */}
        <ContentCard title="Como instalar">
          <ol className="space-y-4">
            {steps.map((s) => (
              <li key={s.n} className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-[#C9A227] text-black text-xs font-black flex items-center justify-center shrink-0">
                  {s.n}
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-800">{s.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </ContentCard>
      </div>

      {/* Login info */}
      <div className="mt-6 bg-[#0D1B3E]/5 border border-[#0D1B3E]/10 rounded-2xl p-5">
        <h4 className="text-sm font-black text-[#0D1B3E] mb-1 flex items-center gap-2">
          <Globe className="w-4 h-4" />
          Como fazer login no app
        </h4>
        <p className="text-sm text-slate-500 mb-3">
          O app desktop usa o mesmo e-mail e senha do painel web. Não é necessário nenhuma configuração extra.
        </p>
        <ol className="space-y-1.5 text-sm text-slate-600">
          <li className="flex items-center gap-2"><ArrowRight className="w-3.5 h-3.5 text-[#C9A227] shrink-0" /> Abra o aplicativo instalado</li>
          <li className="flex items-center gap-2"><ArrowRight className="w-3.5 h-3.5 text-[#C9A227] shrink-0" /> Digite o mesmo <strong>e-mail e senha</strong> que você usa no painel web</li>
          <li className="flex items-center gap-2"><ArrowRight className="w-3.5 h-3.5 text-[#C9A227] shrink-0" /> Clique em <strong>Entrar no PDV</strong> — o app abre direto no caixa</li>
        </ol>
      </div>
    </PageWrapper>
  );
}
