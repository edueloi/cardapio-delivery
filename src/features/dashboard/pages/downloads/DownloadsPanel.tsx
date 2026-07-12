import { Download, Monitor, Globe, CheckCircle2, ArrowRight, Package2, Smartphone, Share, Plus, MoreHorizontal, Tv } from "lucide-react";
import { PageWrapper, SectionTitle, ContentCard } from "../../../../components";

const VERSION = "1.0.3";

const downloads = [
  {
    id: "windows-installer",
    name: "Box Sys PDV",
    subtitle: "Instalador Windows",
    description: "Versão completa com instalação automática, atalho na área de trabalho e atualizações.",
    icon: Monitor,
    badge: "Recomendado",
    badgeColor: "bg-[#C9A227] text-black",
    filename: `Box Sys-PDV-Setup-${VERSION}.exe`,
    url: `/downloads/Box Sys-PDV-Setup-${VERSION}.exe`,
    size: "~85 MB",
    os: "Windows 10/11 64-bit",
  },
  {
    id: "windows-portable",
    name: "Box Sys PDV",
    subtitle: "Versão Portátil",
    description: "Execute sem instalar. Ideal para uso em pendrive ou computadores sem permissão de administrador.",
    icon: Package2,
    badge: "Sem instalação",
    badgeColor: "bg-slate-100 text-slate-600",
    filename: `BoxSys-PDV-Portable.exe`,
    url: `/downloads/BoxSys-PDV-Portable.exe`,
    size: "~85 MB",
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

export default function DownloadsPanel() {
  return (
    <PageWrapper>
      <SectionTitle
        title="Downloads"
        description="Baixe o aplicativo desktop do Box Sys PDV para Windows"
        icon={Download}
        className="mb-6"
      />

      {/* ── App Celular (PWA) ── */}
      <div className="bg-gradient-to-br from-[#0D1B3E] to-[#1a2f5a] rounded-2xl p-6 mb-6 flex flex-col sm:flex-row items-center gap-6">
        <img
          src="/images/app_celular.png"
          alt="App Box Sys no celular"
          className="w-32 h-32 object-contain drop-shadow-2xl shrink-0"
        />
        <div className="flex-1 text-center sm:text-left">
          <div className="flex items-center gap-2 justify-center sm:justify-start mb-1">
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#C9A227] text-black">Grátis</span>
            <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-white/10 text-white">iOS & Android</span>
          </div>
          <h3 className="text-xl font-black text-white mb-1">Box Sys no Celular</h3>
          <p className="text-sm text-slate-300 mb-4 leading-relaxed">
            Adicione o painel à tela inicial do seu celular e use como um app nativo — sem baixar nada da loja.
          </p>
          <a
            href={window.location.origin + "/painel"}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#C9A227] hover:bg-[#b8911f] text-black font-black text-sm uppercase tracking-widest py-3 px-6 rounded-xl transition-colors"
          >
            <Smartphone className="w-4 h-4" />
            Abrir no Celular
          </a>
        </div>
      </div>

      {/* Instruções PWA por plataforma */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {/* iOS */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
              <Smartphone className="w-4 h-4 text-slate-600" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-800">iPhone / iPad</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Safari</p>
            </div>
          </div>
          <ol className="space-y-2.5">
            {[
              { icon: <Globe className="w-3.5 h-3.5 shrink-0 text-[#C9A227]" />, text: <>Abra o painel no <strong>Safari</strong></> },
              { icon: <Share className="w-3.5 h-3.5 shrink-0 text-[#C9A227]" />, text: <>Toque no ícone de <strong>Compartilhar</strong> (quadrado com seta)</> },
              { icon: <Plus className="w-3.5 h-3.5 shrink-0 text-[#C9A227]" />, text: <>Selecione <strong>"Adicionar à Tela Inicial"</strong></> },
              { icon: <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-green-500" />, text: <>Toque em <strong>Adicionar</strong> — pronto!</> },
            ].map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                {s.icon}
                <span>{s.text}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Android */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
              <Smartphone className="w-4 h-4 text-slate-600" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-800">Android</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">Chrome</p>
            </div>
          </div>
          <ol className="space-y-2.5">
            {[
              { icon: <Globe className="w-3.5 h-3.5 shrink-0 text-[#C9A227]" />, text: <>Abra o painel no <strong>Chrome</strong></> },
              { icon: <MoreHorizontal className="w-3.5 h-3.5 shrink-0 text-[#C9A227]" />, text: <>Toque nos <strong>3 pontos</strong> no canto superior direito</> },
              { icon: <Plus className="w-3.5 h-3.5 shrink-0 text-[#C9A227]" />, text: <>Selecione <strong>"Adicionar à tela inicial"</strong></> },
              { icon: <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-green-500" />, text: <>Confirme e o ícone aparece na tela!</> },
            ].map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                {s.icon}
                <span>{s.text}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Divisor */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">App Desktop Windows</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

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

      {/* Windows SmartScreen warning */}
      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-5">
        <h4 className="text-sm font-black text-amber-800 mb-1 flex items-center gap-2">
          ⚠️ Windows pode bloquear o arquivo ao instalar
        </h4>
        <p className="text-sm text-amber-700 mb-3">
          O Windows Defender SmartScreen pode exibir um aviso de segurança. Isso é normal para aplicativos sem certificado digital. Para instalar:
        </p>
        <ol className="space-y-1.5 text-sm text-amber-700">
          <li className="flex items-center gap-2"><ArrowRight className="w-3.5 h-3.5 shrink-0" /> Clique em <strong>"Mais informações"</strong> na tela de aviso</li>
          <li className="flex items-center gap-2"><ArrowRight className="w-3.5 h-3.5 shrink-0" /> Em seguida clique em <strong>"Executar assim mesmo"</strong></li>
          <li className="flex items-center gap-2"><ArrowRight className="w-3.5 h-3.5 shrink-0" /> A instalação prosseguirá normalmente</li>
        </ol>
      </div>

      {/* Login info */}
      <div className="mt-4 bg-[#0D1B3E]/5 border border-[#0D1B3E]/10 rounded-2xl p-5">
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

      {/* Divisor */}
      <div className="flex items-center gap-4 my-8">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Painel TV — Android TV / Fire Stick</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-[#0D1B3E] flex items-center justify-center shrink-0">
            <Tv className="w-6 h-6 text-[#C9A227]" />
          </div>
          <div>
            <h3 className="font-black text-slate-800 text-base leading-tight">Painel de Pedidos na TV</h3>
            <p className="text-sm text-slate-500 mt-1">
              App para Android TV e Fire TV Stick que mostra só o Painel de Pedidos em tela cheia — ideal pra deixar
              fixo na TV do balcão ou da cozinha. Uma vez vinculado, fica sempre conectado (mesmo desligando e
              ligando de novo), até você desvincular em Configurações → TVs.
            </p>
          </div>
        </div>

        <a
          href="/downloads/BoxSys-PainelTV.apk"
          download="BoxSys-PainelTV.apk"
          className="inline-flex items-center justify-center gap-2 bg-[#0D1B3E] hover:bg-[#162548] text-white font-black text-sm uppercase tracking-widest py-3 px-6 rounded-xl transition-colors mb-6"
        >
          <Download className="w-4 h-4" />
          Baixar APK do Painel TV
        </a>

        <ContentCard title="Como instalar na TV (Fire TV Stick)">
          <ol className="space-y-4">
            {[
              { n: "1", title: "Instale o app \"Downloader\"", desc: "Na Fire TV, abra a loja de apps da Amazon e instale o app gratuito \"Downloader\"." },
              { n: "2", title: "Digite a URL do APK", desc: <>Abra o Downloader e digite: <strong className="text-slate-800">boxsys.com.br/tv</strong> (URL curta, fácil de digitar no controle)</> },
              { n: "3", title: "Baixe e instale", desc: "O Downloader vai baixar e perguntar se pode instalar apps de fontes desconhecidas — permita e conclua a instalação." },
              { n: "4", title: "Abra o app", desc: "Ele vai mostrar um código de 6 dígitos na tela." },
              { n: "5", title: "Vincule no painel web", desc: "No computador ou celular, vá em Configurações → TVs, digite o código e pronto — a TV já fica autenticada e conectada permanentemente." },
            ].map((s) => (
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

        <p className="text-xs text-slate-400 mt-4">
          Em Android TV (não Fire Stick), o processo é o mesmo — o Downloader também está disponível na Google Play Store da TV.
          Depois de instalado, o app inicia sozinho toda vez que a TV é ligada, sem precisar abrir manualmente.
        </p>
      </div>
    </PageWrapper>
  );
}
