import React, { useState } from "react";
import { 
  BookOpen, ChevronRight, ChevronLeft, HelpCircle, Search,
  LayoutDashboard, Receipt, Clock, ClipboardList, 
  History, Utensils, Package, BarChart3, 
  MessageSquare, UserCog, Settings, Heart, Star, 
  Layers, Wallet, ArrowLeftRight, Monitor, ChefHat, PlayCircle, Truck, Check, X, Download, Users, CheckCircle2, Bell, HelpCircle as HelpIcon
} from "lucide-react";
import { type MyMembership, canAccess } from "../../types";

interface Props {
  membership: MyMembership | null;
}

interface ManualSection {
  id: string;
  title: string;
  tab?: any; // TabId
  icon: React.ComponentType<any>;
  keywords: string[];
  content: React.ReactNode;
}

export default function ManualPanel({ membership }: Props) {
  const [activeSectionId, setActiveSectionId] = useState<string>("primeiros-passos");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [mobileActive, setMobileActive] = useState<boolean>(false);

  const sections: ManualSection[] = [
    {
      id: "primeiros-passos",
      title: "Primeiros Passos",
      icon: PlayCircle,
      keywords: ["inicio", "comecar", "primeiro", "bem vindo", "passos"],
      content: (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-[#0D1B3E]/10 to-amber-500/5 p-6 rounded-3xl border border-amber-500/10">
            <h4 className="text-base font-black text-[#0A1628] mb-2">Bem-vindo ao Manual Operacional Box Sys!</h4>
            <p className="text-slate-600 text-sm leading-relaxed">
              Este é o guia completo e detalhado passo a passo de todas as funções do seu painel administrativo. 
              Utilize o menu à esquerda ou a barra de buscas para navegar pelas seções operacionais autorizadas para o seu perfil.
            </p>
          </div>

          <div className="space-y-4">
            <h5 className="text-xs font-black uppercase tracking-widest text-slate-400">Visão Geral da Operação</h5>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
                <span className="absolute right-3 top-3 text-4xl font-black text-slate-100/50">1</span>
                <h6 className="font-bold text-sm text-slate-800 mb-1 relative z-10">Lançamento de Vendas</h6>
                <p className="text-xs text-slate-500 relative z-10 leading-relaxed">
                  Os pedidos são realizados pelo cliente via Cardápio Web/WhatsApp, lançados na mesa pelo Garçom ou registrados diretamente no caixa (PDV).
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
                <span className="absolute right-3 top-3 text-4xl font-black text-slate-100/50">2</span>
                <h6 className="font-bold text-sm text-slate-800 mb-1 relative z-10">Fila de Produção</h6>
                <p className="text-xs text-slate-500 relative z-10 leading-relaxed">
                  A cozinha monitora os pratos através da aba de Produção ou KDS, alterando o status para pronto e acionando o garçom ou motoboy.
                </p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
                <span className="absolute right-3 top-3 text-4xl font-black text-slate-100/50">3</span>
                <h6 className="font-bold text-sm text-slate-800 mb-1 relative z-10">Fechamento & Financeiro</h6>
                <p className="text-xs text-slate-500 relative z-10 leading-relaxed">
                  O operador encerra o turno declarando os valores em caixa, enquanto o sistema realiza a auditoria do lucro real.
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "visao-geral",
      title: "Visão Geral",
      tab: "overview",
      icon: LayoutDashboard,
      keywords: ["faturamento", "grafico", "dashboard", "metricas", "vendas"],
      content: (
        <div className="space-y-6">
          <p className="text-slate-600 text-sm leading-relaxed">
            A tela de **Visão Geral** centraliza os dados operacionais e de faturamento do dia de hoje. Ela fornece um panorama instantâneo sobre a saúde comercial do negócio.
          </p>

          <div className="space-y-4">
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-3">
              <h5 className="font-bold text-xs uppercase tracking-widest text-[#0A1628] mb-2">Painel de Indicadores</h5>
              <div className="space-y-3 text-xs text-slate-500 leading-relaxed">
                <p>
                  <strong>1. Faturamento do Dia:</strong> Exibe a soma de todas as vendas aprovadas do dia corrente. Não inclui pedidos cancelados ou pendentes de aprovação.
                </p>
                <p>
                  <strong>2. Ticket Médio:</strong> Representa o valor médio gasto por cliente por pedido. Calculado pela divisão do faturamento total pelo número de vendas fechadas.
                </p>
                <p>
                  <strong>3. Desempenho em Tempo Real:</strong> Gráficos que mostram as vendas por hora, ajudando a identificar a curva de pico de pedidos para planejamento de turnos.
                </p>
              </div>
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4 space-y-3">
              <h6 className="text-xs font-black text-slate-800 uppercase tracking-widest text-amber-600">Guia de Boas Práticas (Indicadores)</h6>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200/50 text-xs text-slate-600 space-y-1">
                  <span className="font-bold flex items-center gap-1 text-emerald-800">
                    <Check className="w-4 h-4" /> Correto (O que fazer)
                  </span>
                  <p className="leading-relaxed">
                    Acompanhar o **Ticket Médio** semanalmente para medir a eficácia de estratégias de combos, adicionais e bebidas sugeridas aos clientes.
                  </p>
                </div>
                <div className="bg-red-50/50 p-4 rounded-xl border border-red-200/50 text-xs text-slate-600 space-y-1">
                  <span className="font-bold flex items-center gap-1 text-red-800">
                    <X className="w-4 h-4" /> Incorreto (O que evitar)
                  </span>
                  <p className="leading-relaxed">
                    Tratar o Faturamento Bruto Diário como lucro livre. Esse valor não deduz custos de matéria-prima (CMV), comissões ou despesas operacionais da loja.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "pdv",
      title: "PDV — Frente de Caixa",
      tab: "pos",
      icon: Receipt,
      keywords: ["caixa", "vender", "balcao", "lancar", "pagamento", "troco", "f2", "splitter", "dividir", "mesa", "comanda", "fidelidade", "cliente", "bandeira", "cozinha", "delivery", "abrir", "fechar", "remover", "variacoes", "observacoes"],
      content: (
        <div className="space-y-6">
          <p className="text-slate-600 text-sm leading-relaxed font-semibold">
            O módulo **PDV (Caixa)** é a principal ferramenta de operação interna. Aqui você realiza abertura e fechamento de caixa, gerencia comandas e lança produtos com complementos e observações.
          </p>

          <div className="space-y-6">
            
            {/* 1. Abertura e Fechamento de Caixa */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
              <h5 className="font-black text-xs text-[#0A1628] uppercase tracking-wider mb-2 flex items-center gap-2">
                <Wallet className="w-4.5 h-4.5 text-amber-500" /> Abertura e Fechamento de Turno (Caixa)
              </h5>
              <div className="space-y-2 text-xs text-slate-500 leading-relaxed">
                <p>
                  <strong>Como Abrir o Caixa:</strong> No início do dia ou do turno do operador, o sistema exigirá a abertura do caixa. Digite o valor exato disponível fisicamente na gaveta como fundo de troco (ex: R$ 100,00) e clique em **"Abrir Caixa"**.
                </p>
                <p>
                  <strong>Como Fechar o Caixa:</strong> No fim do expediente, clique em **"Fechar Caixa"**. O sistema exibirá a tela de fechamento às cegas (onde o operador deve digitar o total em dinheiro, débito, crédito e Pix contados fisicamente). Ao confirmar, o sistema cruzará os dados e apontará divergências.
                </p>
              </div>
            </div>

            {/* 2. Lançamento, Variações e Observações */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
              <h5 className="font-black text-xs text-[#0A1628] uppercase tracking-wider mb-2 flex items-center gap-2">
                <Utensils className="w-4.5 h-4.5 text-amber-500" /> Lançar Itens, Variações e Observações
              </h5>
              <div className="space-y-2 text-xs text-slate-500 leading-relaxed">
                <p>
                  <strong>Adicionar Produtos:</strong> Digite o nome no campo de busca ou use o atalho `F2` para focar na digitação de código de barras ou busca rápida. Clique sobre o produto para incluí-lo.
                </p>
                <p>
                  <strong>Variações e Complementos:</strong> Se o produto possuir opções (ex: tamanho Grande/Broto ou Adicional de Bacon), o sistema abrirá um painel pop-up automático para você selecionar os modificadores desejados.
                </p>
                <p>
                  <strong>Adicionar Observações:</strong> No painel do produto no carrinho, você pode clicar no campo de observação e digitar notas específicas para a cozinha (ex: "Bem passado", "Sem cebola", "Molho à parte").
                </p>
                <p>
                  <strong>Remover ou Alterar Quantidade:</strong> Para diminuir a quantidade ou deletar um produto do carrinho, utilize os botões `+` e `-` localizados ao lado do item ou clique na lixeira vermelha para excluí-lo por completo antes de avançar.
                </p>
              </div>
            </div>

            {/* 3. Comandas e Mesas */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
              <h5 className="font-black text-xs text-[#0A1628] uppercase tracking-wider mb-2 flex items-center gap-2">
                <ClipboardList className="w-4.5 h-4.5 text-amber-500" /> Gerenciamento de Mesas e Comandas no PDV
              </h5>
              <div className="space-y-2 text-xs text-slate-500 leading-relaxed">
                <p>
                  <strong>Vincular Pedido:</strong> No topo da venda do PDV, altere a modalidade para "Mesa" ou "Comanda" e informe o número correspondente.
                </p>
                <p>
                  <strong>Consultar e Atualizar Contas Abertas:</strong> Para adicionar novos itens, clique na aba de comandas ativas, selecione o número da mesa, adicione os produtos desejados no catálogo e clique em **"Atualizar Consumo"**. O sistema imprimirá a via de produção correspondente para os novos itens.
                </p>
              </div>
            </div>

            {/* 4. Lançar Pagamento e Dividir por Grupo/Cartão */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
              <h5 className="font-black text-xs text-[#0A1628] uppercase tracking-wider mb-2 flex items-center gap-2">
                <Layers className="w-4.5 h-4.5 text-amber-500" /> Dividir Pagamentos (Splitter de Contas)
              </h5>
              <div className="space-y-2 text-xs text-slate-500 leading-relaxed">
                <p>
                  <strong>Como Dividir a Conta:</strong> Na tela de fechamento e pagamento, você pode fracionar o pagamento da mesa entre várias pessoas:
                </p>
                <ul className="list-disc list-inside pl-2 space-y-1">
                  <li>Digite o valor parcial a ser pago (ex: R$ 35,00).</li>
                  <li>Selecione a forma de pagamento desse valor (ex: Pix).</li>
                  <li>Clique em confirmar pagamento parcial. O sistema abaterá o valor e mostrará o saldo restante na hora.</li>
                  <li>Repita a operação para os cartões de crédito/débito informando a bandeira correspondente de cada um até que o saldo restante seja zerado.</li>
                </ul>
              </div>
            </div>

            {/* Exemplos de Correto vs Incorreto */}
            <div className="mt-4 border-t border-slate-100 pt-4 space-y-3">
              <h6 className="text-xs font-black text-slate-800 uppercase tracking-widest text-amber-600">Guia de Boas Práticas (Operação de Caixa)</h6>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200/50 text-xs text-slate-600 space-y-1">
                  <span className="font-bold flex items-center gap-1 text-emerald-800">
                    <Check className="w-4 h-4" /> Correto (O que fazer)
                  </span>
                  <p className="leading-relaxed">
                    Lançar exatamente o valor parcial pago por cada cliente na hora de dividir contas, vinculando a forma de pagamento real (Pix, Débito Visa, etc.) de forma individualizada.
                  </p>
                </div>
                <div className="bg-red-50/50 p-4 rounded-xl border border-red-200/50 text-xs text-slate-600 space-y-1">
                  <span className="font-bold flex items-center gap-1 text-red-800">
                    <X className="w-4 h-4" /> Incorreto (O que evitar)
                  </span>
                  <p className="leading-relaxed">
                    Lançar o fechamento de uma conta dividida em grupo como se uma única pessoa tivesse pago tudo em dinheiro e tentar controlar os Pix/Cartões dos outros em papéis de rascunho por fora.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "waiter",
      title: "Garçom",
      tab: "waiter",
      icon: UserCog,
      keywords: ["atendimento", "mesa", "comanda", "celular", "tablet", "pedir"],
      content: (
        <div className="space-y-4">
          <p className="text-slate-600 text-sm leading-relaxed">
            O módulo <strong>Garçom</strong> foi otimizado para celulares e tablets. Ele permite o lançamento ágil diretamente na mesa do cliente.
          </p>
          
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-widest text-[#0A1628]">Fluxo de Atendimento:</h4>
            <ol className="list-decimal list-inside text-xs text-slate-500 space-y-2 leading-relaxed">
              <li>O garçom seleciona a mesa ou comanda aberta, ou cria uma nova inserindo o número correspondente.</li>
              <li>Busca os produtos por nome ou categoria, seleciona as opções obrigatórias (ex: refrigerante de lata ou 600ml).</li>
              <li>Adiciona observações específicas para cada prato e clica em <strong>"Enviar Pedido"</strong> para disparar as comandas de impressão na cozinha.</li>
            </ol>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-4 space-y-3">
            <h6 className="text-xs font-black text-slate-800 uppercase tracking-widest text-amber-600">Guia de Boas Práticas (Garçom)</h6>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200/50 text-xs text-slate-600 space-y-1">
                <span className="font-bold flex items-center gap-1 text-emerald-800">
                  <Check className="w-4 h-4" /> Correto (O que fazer)
                </span>
                <p className="leading-relaxed">
                  Lançar todos os refrigerantes e águas diretamente na comanda digital do cliente no ato da entrega na mesa, garantindo que o consumo acumulado esteja 100% atualizado.
                </p>
              </div>
              <div className="bg-red-50/50 p-4 rounded-xl border border-red-200/50 text-xs text-slate-600 space-y-1">
                <span className="font-bold flex items-center gap-1 text-red-800">
                  <X className="w-4 h-4" /> Incorreto (O que evitar)
                </span>
                <p className="leading-relaxed">
                  Entregar bebidas ou petiscos rápidos para o cliente e deixar para lançar tudo apenas na hora do fechamento da conta física. Isso causa perda de controle de estoque e esquecimento de lançamentos.
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "live-orders",
      title: "Painel de Pedidos (Kanban de Produção)",
      tab: "live-orders",
      icon: Clock,
      keywords: ["preparo", "cozinha", "kds", "live", "pedidos", "atrasado", "drag", "drop", "arrastar", "soltar", "alerta", "espera", "tempo", "caixa"],
      content: (
        <div className="space-y-6">
          <p className="text-slate-600 text-sm leading-relaxed">
            O **Painel de Pedidos** é o painel de controle KDS (Kanban) em tempo real que monitora todas as comandas ativas do estabelecimento, permitindo gerenciar o fluxo de produção de forma interativa e automatizada.
          </p>

          <div className="space-y-6">
            
            {/* 1. Colunas e Fluxo Kanban com Arraste */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
              <h5 className="font-black text-xs text-[#0A1628] uppercase tracking-wider mb-2 flex items-center gap-2">
                <Layers className="w-4.5 h-4.5 text-amber-500" /> Colunas Kanban e Movimentação por Arraste (Drag & Drop)
              </h5>
              <div className="text-xs text-slate-500 space-y-2 leading-relaxed">
                <p>
                  O painel organiza as vendas em três colunas lógicas de produção:
                </p>
                <ul className="list-disc list-inside pl-2 space-y-1">
                  <li><strong>Pendentes (Aguardando):</strong> Pedidos recém-criados que aguardam aprovação manual do atendente (ex: pedidos online).</li>
                  <li><strong>Em Preparo:</strong> Pedidos ativos que já estão sendo confeccionados na cozinha ou bar.</li>
                  <li><strong>Prontos / Retire:</strong> Itens finalizados que já estão prontos para consumo na mesa, retirada no balcão ou despacho por motoboy.</li>
                </ul>
                <p className="pt-2">
                  <strong>Arraste e Soltar:</strong> Você pode clicar com o mouse (ou manter pressionado no celular/tablet) sobre a área superior do card de um pedido e **arrastá-lo diretamente** para a próxima coluna. O sistema atualiza instantaneamente o status do pedido no banco de dados e notifica o cliente.
                </p>
              </div>
            </div>

            {/* 2. Botões de Ação Rápida */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
              <h5 className="font-black text-xs text-[#0A1628] uppercase tracking-wider mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-4.5 h-4.5 text-amber-500" /> Botões de Ações e Transição de Status
              </h5>
              <div className="text-xs text-slate-500 space-y-2 leading-relaxed">
                <p>
                  Caso não queira arrastar, você pode utilizar os botões de ação rápida localizados no rodapé de cada card para avançar o status:
                </p>
                <ul className="list-disc list-inside pl-2 space-y-1">
                  <li><strong>Aceitar Pedido:</strong> No status Pendente, aprova o pedido e o envia para a cozinha na coluna "Em Preparo".</li>
                  <li><strong>Despachar / Marcar Pronto:</strong> Na coluna "Em Preparo", atualiza a comanda enviando-a para a coluna "Prontos".</li>
                  <li><strong>Confirmar Entrega / Entregar:</strong> Na coluna "Prontos", remove o pedido do painel de produção ativa. Pedidos de consumo local vão para o status de "Ag. Caixa" (Aguardando Pagamento).</li>
                </ul>
              </div>
            </div>

            {/* 3. Indicadores de Tempo e Alerta de Atraso */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
              <h5 className="font-black text-xs text-[#0A1628] uppercase tracking-wider mb-2 flex items-center gap-2">
                <Clock className="w-4.5 h-4.5 text-amber-500" /> Monitoramento de Tempo e Alerta de Atrasos Críticos
              </h5>
              <div className="text-xs text-slate-500 space-y-2 leading-relaxed">
                <p>
                  <strong>Tempo de Espera:</strong> Cada card possui um contador laranja que mostra em minutos há quanto tempo aquele pedido foi aberto (ex: *"14 min"*).
                </p>
                <p>
                  <strong>Alerta de Atraso (Borda Vermelha):</strong> Se o preparo de um pedido ultrapassar o limite crítico de **30 minutos** sem ser finalizado, o card ganha automaticamente uma **borda vermelha destacada e um anel vibrante**, sinalizando ao operador que o pedido está atrasado e deve ter prioridade máxima de saída.
                </p>
              </div>
            </div>

            {/* 4. Alerta de Pedido Retido no Caixa */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
              <h5 className="font-black text-xs text-[#0A1628] uppercase tracking-wider mb-2 flex items-center gap-2">
                <Bell className="w-4.5 h-4.5 text-amber-500" /> Lembrete Automático "Já foi entregue?" (Aguardando Caixa)
              </h5>
              <div className="text-xs text-slate-500 space-y-2 leading-relaxed">
                <p>
                  O sistema gerencia de forma inteligente a entrega física dos produtos. Se um pedido concluído na cozinha for marcado para consumo local ou retirada, ele vai para o status de "Aguardando Caixa".
                </p>
                <p>
                  <strong>Pop-up de Alerta (5 minutos):</strong> Caso o pedido permaneça em "Ag. Caixa" por **mais de 5 minutos**, o painel disparará automaticamente um alerta sonoro e visual na tela perguntando: *"Já foi entregue?"*. O operador pode simplesmente clicar em *"Já foi entregue"* para dar baixa definitiva do pedido no sistema, evitando gargalos de visualização.
                </p>
              </div>
            </div>

            {/* Exemplos de Correto vs Incorreto */}
            <div className="mt-4 border-t border-slate-100 pt-4 space-y-3">
              <h6 className="text-xs font-black text-slate-800 uppercase tracking-widest text-amber-600">Guia de Boas Práticas (Painel de Pedidos)</h6>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200/50 text-xs text-slate-600 space-y-1">
                  <span className="font-bold flex items-center gap-1 text-emerald-800">
                    <Check className="w-4 h-4" /> Correto (O que fazer)
                  </span>
                  <p className="leading-relaxed">
                    Aproveitar o recurso de arrastar e soltar (Drag & Drop) com o mouse ou toques na tela para gerenciar as colunas de produção de forma rápida e dinâmica no balcão.
                  </p>
                </div>
                <div className="bg-red-50/50 p-4 rounded-xl border border-red-200/50 text-xs text-slate-600 space-y-1">
                  <span className="font-bold flex items-center gap-1 text-red-800">
                    <X className="w-4 h-4" /> Incorreto (O que evitar)
                  </span>
                  <p className="leading-relaxed">
                    Ignorar os alertas vermelhos de pedidos com mais de 30 minutos na tela, fazendo com que o cliente do salão ou delivery receba comida fria por falta de prioridade visual.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "scheduled",
      title: "Agendamentos",
      tab: "scheduled",
      icon: Clock,
      keywords: ["agendamento", "futuro", "data", "hora", "reserva"],
      content: (
        <div className="space-y-4">
          <p className="text-slate-600 text-sm leading-relaxed">
            Painel para monitoramento de pedidos agendados para entrega ou retirada futura. Ideal para controle de encomendas de eventos ou reservas programadas.
          </p>

          <div className="mt-4 border-t border-slate-100 pt-4 space-y-3">
            <h6 className="text-xs font-black text-slate-800 uppercase tracking-widest text-amber-600">Guia de Boas Práticas (Agendamentos)</h6>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200/50 text-xs text-slate-600 space-y-1">
                <span className="font-bold flex items-center gap-1 text-emerald-800">
                  <Check className="w-4 h-4" /> Correto (O que fazer)
                </span>
                <p className="leading-relaxed">
                  Conferir os pedidos agendados ao abrir a loja e garantir a preparação antecipada de ingredientes especiais necessários.
                </p>
              </div>
              <div className="bg-red-50/50 p-4 rounded-xl border border-red-200/50 text-xs text-slate-600 space-y-1">
                <span className="font-bold flex items-center gap-1 text-red-800">
                  <X className="w-4 h-4" /> Incorreto (O que evitar)
                </span>
                <p className="leading-relaxed">
                  Deixar de monitorar a aba e ser pego de surpresa no meio do pico por um pedido de alta quantidade agendado para retirada em horário específico.
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "tables",
      title: "Mesas, QR Codes e Senha Sequencial",
      tab: "tables",
      icon: ClipboardList,
      keywords: ["mesas", "qrcode", "impressao", "salao", "layout", "senha", "sequencial", "qr fixo", "balcao", "retirada"],
      content: (
        <div className="space-y-6">
          <p className="text-slate-600 text-sm leading-relaxed font-semibold">
            O sistema disponibiliza duas modalidades de atendimento baseadas em QR Code: as **Mesas Individuais** e o **Cardápio de QR Code Fixo (com Senha)**. Conheça para que servem e quando utilizar cada uma.
          </p>

          <div className="space-y-6">
            
            {/* 1. Mesas com QR Code Individual */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
              <h5 className="font-black text-xs text-[#0A1628] uppercase tracking-wider mb-2 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-[#C9A227]" /> Mesas com QR Code Individual (Salão Tradicional)
              </h5>
              <div className="text-xs text-slate-500 space-y-2 leading-relaxed">
                <p>
                  <strong>Para que serve e quando usar:</strong> Indicado para estabelecimentos que possuem salão físico com mesas fixas e atendimento de garçom ou consumo local prolongado (ex: pizzarias, churrascarias, restaurantes à la carte).
                </p>
                <p>
                  <strong>Exemplo de uso:</strong> O cliente entra no restaurante e senta na **Mesa 04**. Ele escaneia o QR Code fixado no acrílico da Mesa 04 com o próprio celular, abre o cardápio e faz o pedido de uma porção. O sistema recebe a comanda na cozinha identificando automaticamente: *"Preparo para a Mesa 04"*. O cliente pode continuar adicionando itens (bebidas, sobremesas) e tudo é acumulado na conta daquela mesa até o encerramento.
                </p>
              </div>
            </div>

            {/* 2. QR Code Fixo Geral com Senha Sequencial */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
              <h5 className="font-black text-xs text-[#0A1628] uppercase tracking-wider mb-2 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#C9A227]" /> QR Code Fixo Geral (Balcão, Retirada ou Eventos)
              </h5>
              <div className="text-xs text-slate-500 space-y-2 leading-relaxed">
                <p>
                  <strong>Para que serve e quando usar:</strong> Indicado para fluxo rápido, praças de alimentação, quiosques, food trucks, ou balcão de retirada (ex: pegue-e-pague, cafeterias de balcão).
                </p>
                <p>
                  <strong>Como funciona (Senha Sequencial):</strong> Neste modelo, o estabelecimento imprime um **único QR Code geral** (chamado QR Fixo) e o exibe em um banner na parede, totem ou em frente ao caixa. Qualquer usuário que chegue ao local pode escanear o QR Code Fixo, montar o seu pedido e fechar a compra. 
                </p>
                <p>
                  Ao finalizar, o sistema não vincula o pedido a uma mesa física de salão, mas gera automaticamente uma **senha sequencial numérica de retirada** (ex: *"Senha 042"*). O pedido vai para a produção e o cliente aguarda o número ser chamado/exibido na tela de entrega para retirar seu produto no balcão.
                </p>
              </div>
            </div>

            {/* Exemplos de Correto vs Incorreto */}
            <div className="mt-4 border-t border-slate-100 pt-4 space-y-3">
              <h6 className="text-xs font-black text-slate-800 uppercase tracking-widest text-[#C9A227]">Guia de Boas Práticas (QR Codes & Mesas)</h6>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200/50 text-xs text-slate-600 space-y-1">
                  <span className="font-bold flex items-center gap-1 text-emerald-800">
                    <Check className="w-4 h-4" /> Correto (O que fazer)
                  </span>
                  <p className="leading-relaxed">
                    Utilizar o **QR Code Fixo** com **Senha Sequencial** em eventos ou balcão de atendimento rápido para reduzir filas de atendimento físico e agilizar a entrega de fichas numéricas.
                  </p>
                  <p className="leading-relaxed">
                    Imprimir e fixar os QR Codes de **Mesa Individual** no tampo de cada mesa do salão para que o cliente realize o autoatendimento e libere o garçom para focar apenas em servir os pratos.
                  </p>
                </div>
                <div className="bg-red-50/50 p-4 rounded-xl border border-red-200/50 text-xs text-slate-600 space-y-1">
                  <span className="font-bold flex items-center gap-1 text-red-800">
                    <X className="w-4 h-4" /> Incorreto (O que evitar)
                  </span>
                  <p className="leading-relaxed">
                    Usar os QR Codes de **Mesas Individuais** em uma praça de alimentação onde os clientes pegam a comida no balcão, gerando desorganização e obrigando os garçons a procurarem mesas aleatórias para entregar pratos.
                  </p>
                  <p className="leading-relaxed">
                    Colar o mesmo QR Code de Mesa em locais diferentes, confundindo o salão e fazendo o sistema misturar as comandas de pessoas sentadas em lugares distintos.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "history",
      title: "Histórico",
      tab: "history",
      icon: History,
      keywords: ["historico", "cancelados", "entregues", "buscar", "cupom", "imprimir"],
      content: (
        <div className="space-y-4">
          <p className="text-slate-600 text-sm leading-relaxed">
            O **Histórico** armazena todas as transações finalizadas do estabelecimento, sendo o banco de dados oficial de auditoria de cupons emitidos.
          </p>

          <div className="mt-4 border-t border-slate-100 pt-4 space-y-3">
            <h6 className="text-xs font-black text-slate-800 uppercase tracking-widest text-amber-600">Guia de Boas Práticas (Histórico)</h6>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200/50 text-xs text-slate-600 space-y-1">
                <span className="font-bold flex items-center gap-1 text-emerald-800">
                  <Check className="w-4 h-4" /> Correto (O que fazer)
                </span>
                <p className="leading-relaxed">
                  Utilizar a barra de buscas por CPF ou Número do Pedido no histórico para localizar a via e efetuar a reimpressão rápida do cupom em caso de perda física.
                </p>
              </div>
              <div className="bg-red-50/50 p-4 rounded-xl border border-red-200/50 text-xs text-slate-600 space-y-1">
                <span className="font-bold flex items-center gap-1 text-red-800">
                  <X className="w-4 h-4" /> Incorreto (O que evitar)
                </span>
                <p className="leading-relaxed">
                  Tentar excluir ou adulterar transações anteriores do histórico sob a premissa de fechar pendências financeiras externas. Isso quebra a consistência do sistema.
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "menu",
      title: "Gestão do Cardápio Inteligente",
      tab: "menu",
      icon: Utensils,
      keywords: ["cardapio", "preço", "adicionais", "bebida", "categoria", "pausar", "complemento", "modificador", "tamanho", "pizza", "sabores", "arrastar", "soltar", "duplicar", "exclusivo pdv", "kds", "cozinha", "estoque", "disponibilidade"],
      content: (
        <div className="space-y-6">
          <p className="text-slate-600 text-sm leading-relaxed">
            O **Cardápio Inteligente** permite organizar e configurar seus produtos de maneira otimizada tanto para a venda digital quanto interna. Abaixo, entenda detalhadamente cada recurso disponível na listagem e no modal de edição.
          </p>

          <div className="space-y-6">
            
            {/* 1. Categorias e Organização (Arrastar e Soltar) */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
              <h5 className="font-black text-xs text-[#0A1628] uppercase tracking-wider mb-2 flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-500" /> Criar Categorias e Reordenação (Grip)
              </h5>
              <div className="text-xs text-slate-500 space-y-2 leading-relaxed">
                <p>
                  <strong>Criar Categoria:</strong> Clique em **"+ Nova Categoria"** no canto superior direito para cadastrar uma nova seção (ex: "Massas", "Bebidas").
                </p>
                <p>
                  <strong>Reordenação por Arraste e Soltar:</strong> 
                  Tanto as categorias quanto os itens individuais possuem puxadores de arraste (ícone de duas colunas verticais de pontos à esquerda de cada item). 
                  Você pode **arrastar e soltar** categorias inteiras para alterar a ordem visual das seções no site, bem como arrastar itens individuais para mudar sua ordem dentro de uma categoria ou **mover produtos entre diferentes categorias** de forma direta.
                </p>
              </div>
            </div>

            {/* 2. Modal de Edição de Produto: Parâmetros */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
              <h5 className="font-black text-xs text-[#0A1628] uppercase tracking-wider mb-2 flex items-center gap-2">
                <Settings className="w-4 h-4 text-amber-500" /> Parâmetros de Edição do Produto
              </h5>
              <div className="text-xs text-slate-500 space-y-2 leading-relaxed">
                <p>
                  Ao abrir o modal **"EDITAR PRODUTO"** clicando na engrenagem de configurações de qualquer prato/bebida, você tem acesso às seguintes opções:
                </p>
                <ul className="list-disc list-inside pl-2 space-y-1.5">
                  <li><strong>Nome do Produto, Preço Base e Descrição:</strong> Definição básica do item cadastrado.</li>
                  <li><strong>Foto do Produto:</strong> Upload direto de imagem. Dica: prefira fotos quadradas (500x500px, máx. 5MB) para encaixar perfeitamente no site.</li>
                  <li><strong>Vincular ao Estoque (Opcional):</strong> Dropdown para selecionar um item do estoque. Vincular um produto a um insumo do estoque faz com que cada venda desse item cause baixa automática nas quantidades do ingrediente correspondente.</li>
                  <li><strong>Produto Ativo no Cardápio:</strong> Chave liga/desliga geral. Se desativado, o produto desaparece imediatamente do site dos clientes, mas permanece disponível no painel.</li>
                  <li><strong>Exclusivo PDV:</strong> Chave liga/desliga. Se ativado, o produto **só aparecerá no Caixa/PDV interno** e ficará invisível no cardápio de delivery online dos clientes. Útil para promoções de balcão ou insumos locais.</li>
                  <li><strong>Vai para a Cozinha:</strong> Chave liga/desliga. Quando ativado, os pedidos deste item são direcionados para a fila de preparo da cozinha (KDS) ou impressora térmica. Bebidas prontas e embalagens devem ficar desativadas por padrão.</li>
                  <li><strong>Disponibilidade Automática:</strong> Chave para programar datas e horários específicos em que o produto deve aparecer ou desaparecer automaticamente do cardápio online, sem necessidade de alteração manual (ex: promoções de final de semana ou pratos de almoço).</li>
                </ul>
              </div>
            </div>

            {/* 3. Ações Avançadas de Catálogo */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
              <h5 className="font-black text-xs text-[#0A1628] uppercase tracking-wider mb-2 flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-amber-500" /> Ações Rápidas de Criação e Duplicação
              </h5>
              <div className="text-xs text-slate-500 space-y-2 leading-relaxed">
                <p>
                  No rodapé do modal de edição, você dispõe de duas ferramentas importantes:
                </p>
                <p>
                  <strong>Duplicar no Catálogo:</strong> Copia todas as configurações (preço, adicionais, fotos) deste produto para um novo cadastro. Útil para itens semelhantes (ex: criar Coca-cola Zero duplicando a Coca-cola normal e mudando apenas o nome).
                </p>
                <p>
                  <strong>Criar no Estoque:</strong> Cria automaticamente uma entrada correspondente a este produto no painel de controle de estoque com apenas um clique.
                </p>
              </div>
            </div>

            {/* Exemplos de Correto vs Incorreto */}
            <div className="mt-4 border-t border-slate-100 pt-4 space-y-3">
              <h6 className="text-xs font-black text-slate-800 uppercase tracking-widest text-amber-600">Guia de Boas Práticas (Cardápio)</h6>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200/50 text-xs text-slate-600 space-y-1">
                  <span className="font-bold flex items-center gap-1 text-emerald-800">
                    <Check className="w-4 h-4" /> Correto (O que fazer)
                  </span>
                  <p className="leading-relaxed">
                    Ativar o campo **"Exclusivo PDV"** para combos ou refrigerantes específicos vendidos exclusivamente no salão físico para evitar que clientes online tentem fazer pedidos de delivery.
                  </p>
                  <p className="leading-relaxed">
                    Manter o switch **"Vai para a cozinha"** desligado para refrigerantes em lata e bebidas prontas industriais, evitando lotar a fila KDS de pratos de preparo com itens que necessitam apenas de retirada do freezer.
                  </p>
                </div>
                <div className="bg-red-50/50 p-4 rounded-xl border border-red-200/50 text-xs text-slate-600 space-y-1">
                  <span className="font-bold flex items-center gap-1 text-red-800">
                    <X className="w-4 h-4" /> Incorreto (O que evitar)
                  </span>
                  <p className="leading-relaxed">
                    Deixar o switch **"Vai para a cozinha"** ligado para todos os produtos (inclusive copos de gelo ou latas), o que gera cupons extras desnecessários e desorganiza os cozinheiros.
                  </p>
                  <p className="leading-relaxed">
                    Não utilizar a ferramenta **"Duplicar no Catálogo"** e cadastrar manualmente cada variação de hambúrguer do zero, desperdiçando tempo de configuração de adicionais e fotos.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "inventory",
      title: "Estoque",
      tab: "inventory",
      icon: Package,
      keywords: ["estoque", "insumo", "entrada", "saida", "quantidade", "baixa", "ficha", "tecnica", "receita"],
      content: (
        <div className="space-y-6">
          <p className="text-slate-600 text-sm leading-relaxed">
            Gerenciamento de matérias-primas e ficha técnica das receitas do estabelecimento para controle rigoroso de insumos.
          </p>

          <div className="space-y-4">
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 text-xs text-slate-500 space-y-2">
              <p><strong>Cadastro de Insumos:</strong> Defina os ingredientes (Kg, g, Litro) e os custos médios.</p>
              <p><strong>Ficha Técnica de Produtos:</strong> Configure o consumo exato de insumos para cada prato para que a baixa automática ocorra a cada faturamento no PDV.</p>
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4 space-y-3">
              <h6 className="text-xs font-black text-slate-800 uppercase tracking-widest text-amber-600">Guia de Boas Práticas (Estoque)</h6>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200/50 text-xs text-slate-600 space-y-1">
                  <span className="font-bold flex items-center gap-1 text-emerald-800">
                    <Check className="w-4 h-4" /> Correto (O que fazer)
                  </span>
                  <p className="leading-relaxed">
                    Registrar perdas manuais no sistema (ex: descarte de insumos vencidos) para que o balanço geral reflita fielmente o estoque real.
                  </p>
                </div>
                <div className="bg-red-50/50 p-4 rounded-xl border border-red-200/50 text-xs text-slate-600 space-y-1">
                  <span className="font-bold flex items-center gap-1 text-red-800">
                    <X className="w-4 h-4" /> Incorreto (O que evitar)
                  </span>
                  <p className="leading-relaxed">
                    Estimar quantidades aproximadas ou ignorar a ficha técnica, gerando disparidades constantes entre o estoque do sistema e o estoque físico real.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "production",
      title: "Produção",
      tab: "production",
      icon: ChefHat,
      keywords: ["produção", "cozinha", "pedidos", "preparo", "bar"],
      content: (
        <div className="space-y-4">
          <p className="text-slate-600 text-sm leading-relaxed">
            Painel KDS de produção interna, otimizado para exibição em telas de setor (cozinha, chapa, bar). Ele mostra a fila de itens aguardando preparo por ordem de entrada.
          </p>

          <div className="mt-4 border-t border-slate-100 pt-4 space-y-3">
            <h6 className="text-xs font-black text-slate-800 uppercase tracking-widest text-amber-600">Guia de Boas Práticas (Produção)</h6>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200/50 text-xs text-slate-600 space-y-1">
                <span className="font-bold flex items-center gap-1 text-emerald-800">
                  <Check className="w-4 h-4" /> Correto (O que fazer)
                </span>
                <p className="leading-relaxed">
                  Marcar a via como "Pronta" no painel da cozinha assim que o prato for montado, notificando automaticamente o garçom no salão.
                </p>
              </div>
              <div className="bg-red-50/50 p-4 rounded-xl border border-red-200/50 text-xs text-slate-600 space-y-1">
                <span className="font-bold flex items-center gap-1 text-red-800">
                  <X className="w-4 h-4" /> Incorreto (O que evitar)
                </span>
                <p className="leading-relaxed">
                  Deixar de atualizar o KDS, forçando a equipe do salão a gritar ou ir até a cozinha para saber se os pratos já estão prontos.
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "suppliers",
      title: "Fornecedores",
      tab: "suppliers",
      icon: Truck,
      keywords: ["fornecedor", "compras", "insumos", "distribuidores"],
      content: (
        <div className="space-y-4">
          <p className="text-slate-600 text-sm leading-relaxed">
            Área de cadastro de fornecedores e distribuidores parceiros, simplificando os processos de reposição de matérias-primas críticas.
          </p>

          <div className="mt-4 border-t border-slate-100 pt-4 space-y-3">
            <h6 className="text-xs font-black text-slate-800 uppercase tracking-widest text-amber-600">Guia de Boas Práticas (Fornecedores)</h6>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200/50 text-xs text-slate-600 space-y-1">
                <span className="font-bold flex items-center gap-1 text-emerald-800">
                  <Check className="w-4 h-4" /> Correto (O que fazer)
                </span>
                <p className="leading-relaxed">
                  Cadastrar dados de contato dos fornecedores no sistema para facilitar cotações rápidas em momentos de baixa crítica de estoque.
                </p>
              </div>
              <div className="bg-red-50/50 p-4 rounded-xl border border-red-200/50 text-xs text-slate-600 space-y-1">
                <span className="font-bold flex items-center gap-1 text-red-800">
                  <X className="w-4 h-4" /> Incorreto (O que evitar)
                </span>
                <p className="leading-relaxed">
                  Comprar mercadorias e lançar notas fiscais sem associar o fornecedor no sistema, inviabilizando análises de histórico de custos.
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "finance",
      title: "Fluxo de Caixa",
      tab: "finance",
      icon: Wallet,
      keywords: ["caixa", "financeiro", "despesa", "receita", "fechamento", "sangria", "suprimento", "conferencia", "lucro", "balanco"],
      content: (
        <div className="space-y-6">
          <p className="text-slate-600 text-sm leading-relaxed font-semibold">
            O **Fluxo de Caixa** registra todas as transações financeiras operacionais ocorridas na gaveta de troco durante os turnos de caixa.
          </p>

          <div className="space-y-4">
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 text-xs text-slate-500 space-y-3">
              <h5 className="font-bold text-[#0A1628]">Operações Disponíveis no Turno:</h5>
              <p><strong>Abertura de Caixa:</strong> Registro do fundo de troco em dinheiro inicial inserido para abertura de turno.</p>
              <p><strong>Suprimento Extra:</strong> Registro de inserções extras de dinheiro físico na gaveta para recomposição de troco no decorrer do dia.</p>
              <p><strong>Sangria de Caixa:</strong> Retirada física de dinheiro acumulado da gaveta (por segurança) ou para pagamento de despesas rápidas na rua.</p>
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4 space-y-3">
              <h6 className="text-xs font-black text-slate-800 uppercase tracking-widest text-amber-600">Guia de Boas Práticas (Fluxo de Caixa)</h6>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200/50 text-xs text-slate-600 space-y-1">
                  <span className="font-bold flex items-center gap-1 text-emerald-800">
                    <Check className="w-4 h-4" /> Correto (O que fazer)
                  </span>
                  <p className="leading-relaxed">
                    Declarar o valor físico de moedas e cédulas contadas manualmente na gaveta ao fechar o caixa no final do turno (fechamento cego).
                  </p>
                </div>
                <div className="bg-red-50/50 p-4 rounded-xl border border-red-200/50 text-xs text-slate-600 space-y-1">
                  <span className="font-bold flex items-center gap-1 text-red-800">
                    <X className="w-4 h-4" /> Incorreto (O que evitar)
                  </span>
                  <p className="leading-relaxed">
                    Olhar os relatórios de fechamento sugeridos e simplesmente digitar o valor "esperado" para fechar o caixa sem contar o dinheiro físico real.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "entries",
      title: "Entradas e Saídas",
      tab: "entries",
      icon: ArrowLeftRight,
      keywords: ["saidas", "entradas", "despesa", "retirada", "receita", "pagamento"],
      content: (
        <div className="space-y-4">
          <p className="text-slate-600 text-sm leading-relaxed">
            Painel administrativo para lançamentos não-operacionais. Serve para registrar despesas do negócio (ex: aluguel, energia, salários, folha de motoboy) ou outras receitas avulsas.
          </p>

          <div className="mt-4 border-t border-slate-100 pt-4 space-y-3">
            <h6 className="text-xs font-black text-slate-800 uppercase tracking-widest text-amber-600">Guia de Boas Práticas (Lançamentos Gerais)</h6>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200/50 text-xs text-slate-600 space-y-1">
                <span className="font-bold flex items-center gap-1 text-emerald-800">
                  <Check className="w-4 h-4" /> Correto (O que fazer)
                </span>
                <p className="leading-relaxed">
                  Lançar até pequenas retiradas da gaveta física (ex: R$ 5,00 para compra de água) indicando a despesa correspondente para fechar o caixa corretamente.
                </p>
              </div>
              <div className="bg-red-50/50 p-4 rounded-xl border border-red-200/50 text-xs text-slate-600 space-y-1">
                <span className="font-bold flex items-center gap-1 text-red-800">
                  <X className="w-4 h-4" /> Incorreto (O que evitar)
                </span>
                <p className="leading-relaxed">
                  Retirar dinheiro do caixa físico para fazer compras rápidas de insumos sem registrar a movimentação correspondente no painel de Entradas e Saídas.
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "reports",
      title: "Relatórios",
      tab: "reports",
      icon: BarChart3,
      keywords: ["relatórios", "lucro", "balanço", "exportar", "dados"],
      content: (
        <div className="space-y-4">
          <p className="text-slate-600 text-sm leading-relaxed">
            Área com inteligência analítica que cruza faturamento, volume de pedidos, custos de entrega e comissões para gerar a margem de lucratividade da loja.
          </p>

          <div className="mt-4 border-t border-slate-100 pt-4 space-y-3">
            <h6 className="text-xs font-black text-slate-800 uppercase tracking-widest text-amber-600">Guia de Boas Práticas (Relatórios)</h6>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200/50 text-xs text-slate-600 space-y-1">
                <span className="font-bold flex items-center gap-1 text-emerald-800">
                  <Check className="w-4 h-4" /> Correto (O que fazer)
                </span>
                <p className="leading-relaxed">
                  Exportar e analisar os relatórios mensais para avaliar quais produtos possuem as piores margens e readequar a ficha técnica ou preços.
                </p>
              </div>
              <div className="bg-red-50/50 p-4 rounded-xl border border-red-200/50 text-xs text-slate-600 space-y-1">
                <span className="font-bold flex items-center gap-1 text-red-800">
                  <X className="w-4 h-4" /> Incorreto (O que evitar)
                </span>
                <p className="leading-relaxed">
                  Definir preços de cardápio com base na concorrência sem analisar os relatórios de CMV e de faturamento gerados na sua própria plataforma.
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "customers",
      title: "Clientes — CRM",
      tab: "customers",
      icon: Users,
      keywords: ["clientes", "crm", "fidelizar", "contato", "busca"],
      content: (
        <div className="space-y-4">
          <p className="text-slate-600 text-sm leading-relaxed">
            Base de dados unificada de todos os clientes cadastrados no sistema. É útil para marketing direto e consultas de históricos individuais.
          </p>

          <div className="mt-4 border-t border-slate-100 pt-4 space-y-3">
            <h6 className="text-xs font-black text-slate-800 uppercase tracking-widest text-amber-600">Guia de Boas Práticas (CRM)</h6>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200/50 text-xs text-slate-600 space-y-1">
                <span className="font-bold flex items-center gap-1 text-emerald-800">
                  <Check className="w-4 h-4" /> Correto (O que fazer)
                </span>
                <p className="leading-relaxed">
                  Identificar no CRM clientes VIPs (com alta frequência de pedidos) ou inativos para criar ações e ofertas de fidelização personalizadas.
                </p>
              </div>
              <div className="bg-red-50/50 p-4 rounded-xl border border-red-200/50 text-xs text-slate-600 space-y-1">
                <span className="font-bold flex items-center gap-1 text-red-800">
                  <X className="w-4 h-4" /> Incorreto (O que evitar)
                </span>
                <p className="leading-relaxed">
                  Não cadastrar os telefones dos clientes e perder a base histórica, impossibilitando fazer remarketing posterior de forma automatizada.
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "loyalty",
      title: "Fidelidade",
      tab: "loyalty",
      icon: Heart,
      keywords: ["fidelidade", "pontos", "cashback", "premios", "regras"],
      content: (
        <div className="space-y-4">
          <p className="text-slate-600 text-sm leading-relaxed">
            Configure e ative regras de cashback ou pontos a cada compra, estimulando a recorrência de pedidos.
          </p>

          <div className="mt-4 border-t border-slate-100 pt-4 space-y-3">
            <h6 className="text-xs font-black text-slate-800 uppercase tracking-widest text-amber-600">Guia de Boas Práticas (Fidelidade)</h6>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200/50 text-xs text-slate-600 space-y-1">
                <span className="font-bold flex items-center gap-1 text-emerald-800">
                  <Check className="w-4 h-4" /> Correto (O que fazer)
                </span>
                <p className="leading-relaxed">
                  Definir uma meta clara e alcançável (Ex: 1 ponto a cada R$ 10,00 gasto) e disponibilizar prêmios que interessem o seu público.
                </p>
              </div>
              <div className="bg-red-50/50 p-4 rounded-xl border border-red-200/50 text-xs text-slate-600 space-y-1">
                <span className="font-bold flex items-center gap-1 text-red-800">
                  <X className="w-4 h-4" /> Incorreto (O que evitar)
                </span>
                <p className="leading-relaxed">
                  Mudar o regulamento da campanha de fidelidade frequentemente sem avisar os clientes, provocando insatisfação e perda de confiança.
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "promotions",
      title: "Promoções",
      tab: "promotions",
      icon: Star,
      keywords: ["promocao", "banner", "campanha", "carrossel", "desconto", "agenda", "marketing", "cupom", "cashback"],
      content: (
        <div className="space-y-6">
          <p className="text-slate-600 text-sm leading-relaxed">
            Destaque seus produtos com banners no topo do site e preços promocionais agendados.
          </p>

          <div className="space-y-4">
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 text-xs text-slate-500 space-y-2">
              <p><strong>Upload de Banners:</strong> Faça o upload de banners com imagens horizontais limpas e atrativas (tamanho ideal 1200x500px).</p>
              <p><strong>Agendamento:</strong> Programe a data/hora de vigência. A promoção entra e sai do ar automaticamente.</p>
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4 space-y-3">
              <h6 className="text-xs font-black text-slate-800 uppercase tracking-widest text-amber-600">Guia de Boas Práticas (Promoções)</h6>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200/50 text-xs text-slate-600 space-y-1">
                  <span className="font-bold flex items-center gap-1 text-emerald-800">
                    <Check className="w-4 h-4" /> Correto (O que fazer)
                  </span>
                  <p className="leading-relaxed">
                    Programar a data/hora exata das promoções (ex: início sexta às 18h e fim às 23:59h) usando fotos de pratos focados e sem textos poluídos por cima.
                  </p>
                </div>
                <div className="bg-red-50/50 p-4 rounded-xl border border-red-200/50 text-xs text-slate-600 space-y-1">
                  <span className="font-bold flex items-center gap-1 text-red-800">
                    <X className="w-4 h-4" /> Incorreto (O que evitar)
                  </span>
                  <p className="leading-relaxed">
                    Deixar a promoção ativa sem data de término e esquecer de pausá-la, vendendo produtos com margem de prejuízo fora da campanha.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "bundles",
      title: "Combos",
      tab: "bundles",
      icon: Layers,
      keywords: ["combos", "promocional", "kits", "agrupar", "bebida"],
      content: (
        <div className="space-y-4">
          <p className="text-slate-600 text-sm leading-relaxed">
            Monte ofertas casadas (Ex: Hambúrguer + Batata + Bebida) com preços especiais, facilitando o aumento do ticket médio no cardápio online.
          </p>

          <div className="mt-4 border-t border-slate-100 pt-4 space-y-3">
            <h6 className="text-xs font-black text-slate-800 uppercase tracking-widest text-amber-600">Guia de Boas Práticas (Combos)</h6>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200/50 text-xs text-slate-600 space-y-1">
                <span className="font-bold flex items-center gap-1 text-emerald-800">
                  <Check className="w-4 h-4" /> Correto (O que fazer)
                </span>
                <p className="leading-relaxed">
                  Configurar opções obrigatórias para o cliente selecionar as variações do combo (ex: escolha do sabor do refrigerante).
                </p>
              </div>
              <div className="bg-red-50/50 p-4 rounded-xl border border-red-200/50 text-xs text-slate-600 space-y-1">
                <span className="font-bold flex items-center gap-1 text-red-800">
                  <X className="w-4 h-4" /> Incorreto (O que evitar)
                </span>
                <p className="leading-relaxed">
                  Criar combos sem as seleções opcionais bem detalhadas, forçando o atendente a ligar para o cliente para perguntar os sabores escolhidos.
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "whatsapp",
      title: "WhatsApp",
      tab: "whatsapp",
      icon: MessageSquare,
      keywords: ["whatsapp", "bot", "robo", "qr code", "mensagens", "atendimento"],
      content: (
        <div className="space-y-4">
          <p className="text-slate-600 text-sm leading-relaxed">
            Conecte o número do seu restaurante via QR Code para ativar o atendente virtual (bot) e disparar notificações automáticas de status de pedidos diretamente para os clientes.
          </p>

          <div className="mt-4 border-t border-slate-100 pt-4 space-y-3">
            <h6 className="text-xs font-black text-slate-800 uppercase tracking-widest text-amber-600">Guia de Boas Práticas (WhatsApp)</h6>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200/50 text-xs text-slate-600 space-y-1">
                <span className="font-bold flex items-center gap-1 text-emerald-800">
                  <Check className="w-4 h-4" /> Correto (O que fazer)
                </span>
                <p className="leading-relaxed">
                  Utilizar um chip/número exclusivo para o estabelecimento e manter o celular sempre ligado e conectado à internet para evitar desconexões do robô.
                </p>
              </div>
              <div className="bg-red-50/50 p-4 rounded-xl border border-red-200/50 text-xs text-slate-600 space-y-1">
                <span className="font-bold flex items-center gap-1 text-red-800">
                  <X className="w-4 h-4" /> Incorreto (O que evitar)
                </span>
                <p className="leading-relaxed">
                  Conectar o número pessoal que tem tráfego de conversas avulsas, ou desligar o aparelho constantemente. Isso causa lentidão e queda no envio de status de pedidos dos clientes.
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "profile",
      title: "Configurações da Unidade",
      tab: "profile",
      icon: Settings,
      keywords: ["configuracoes", "loja", "taxa", "entrega", "abrir", "fechar", "funcionamento", "frete", "bairro", "raio", "tempo", "fiscal", "pagamentos", "maquinhas", "horarios", "intervalo"],
      content: (
        <div className="space-y-6">
          <p className="text-slate-600 text-sm leading-relaxed">
            O painel de **Configurações da Unidade** centraliza as regras de negócio, dados fiscais, tarifas de frete e integrações de pagamento do seu estabelecimento. As configurações são divididas em 6 abas principais.
          </p>

          <div className="space-y-6">
            
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
              <h5 className="font-black text-xs text-[#0A1628] uppercase tracking-wider mb-2 flex items-center gap-2">
                <Settings className="w-4 h-4 text-[#C9A227]" /> 1. Aba Loja (Identificação, Localização e Regras do PDV)
              </h5>
              <div className="text-xs text-slate-500 space-y-2 leading-relaxed">
                <p><strong>Identificação Básica:</strong> Altere a logo, o slogan de cabeçalho e o número de WhatsApp de atendimento do restaurante.</p>
                <p><strong>Localização com CEP dinâmico:</strong> Cadastre o endereço físico da loja. Ao digitar o CEP e clicar em **"Buscar CEP"**, os campos de rua, bairro e cidade são preenchidos automaticamente via integração ViaCEP.</p>
                <p><strong>Switches de Operação (Toggles):</strong></p>
                <ul className="list-disc list-inside pl-2 space-y-1">
                  <li><strong>Status da Loja:</strong> Força o fechamento imediato do cardápio digital do cliente, independentemente do horário comercial programado.</li>
                  <li><strong>Status Delivery:</strong> Desliga as opções de entrega em domicílio do site (o cliente só poderá pedir via Retirada no Balcão).</li>
                  <li><strong>Abertura/Fechamento Obrigatório:</strong> Se ativo, obriga o caixa do PDV a declarar fundo de troco na abertura e conferir gaveta no fechamento. Se inativo, a venda fica livre sem turnos.</li>
                  <li><strong>Largura de Bobina:</strong> Define o layout térmico padrão (80mm ou 58mm) para impressão física de cupons.</li>
                </ul>
                <p><strong>Acesso Direto à Cozinha (cozinha.boxsys.com.br):</strong> Espaço para cadastrar usuários individuais para o pessoal da chapa/cozinha e gerenciar pedidos de acesso de novos tablets à rede local.</p>
              </div>
            </div>

            {/* 2. Aba Horários */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
              <h5 className="font-black text-xs text-[#0A1628] uppercase tracking-wider mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#C9A227]" /> 2. Aba Horários (Grade Semanal e Intervalos)
              </h5>
              <div className="text-xs text-slate-500 space-y-2 leading-relaxed">
                <p>Ajuste os dias de funcionamento ativo da loja na internet.</p>
                <p><strong>Horários de Turno e Pausas:</strong> Defina o horário de abertura e o fechamento do estabelecimento para cada dia. É possível ativar a opção **"Intervalo / Pausa"** para configurar um intervalo de descanso (ex: fechado das 14h às 18h), fazendo com que o cardápio digital bloqueie pedidos online nesse intervalo automaticamente.</p>
              </div>
            </div>

            {/* 3. Aba Entrega */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
              <h5 className="font-black text-xs text-[#0A1628] uppercase tracking-wider mb-2 flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#C9A227]" /> 3. Aba Entrega (Configurações de Frete)
              </h5>
              <div className="text-xs text-slate-500 space-y-2 leading-relaxed">
                <p>Escolha o método de cobrança de frete para entregas em domicílio:</p>
                <ul className="list-disc list-inside pl-2 space-y-1">
                  <li><strong>Frete Grátis:</strong> Sem cobrança de taxa de entrega para nenhuma região.</li>
                  <li><strong>Taxa Fixa:</strong> Cobra um valor único independente do endereço do cliente (ex: R$ 7,00 fixos).</li>
                  <li><strong>Zonas por CEP (Bairros):</strong> Cadastre zonas específicas (ex: "Centro", "Zona Sul") inserindo os CEPs atendidos e definindo taxas individualizadas por área.</li>
                  <li><strong>Cálculo por KM:</strong> Digite o CEP de origem da loja e configure faixas de distância (ex: até 3 Km = R$ 5,00; de 3 a 7 Km = R$ 10,00). O sistema calcula a distância real via rota de GPS e cobra a taxa correspondente. Você pode ligar a chave para bloquear ou aceitar pedidos que estejam além da última faixa de Km configurada.</li>
                </ul>
              </div>
            </div>

            {/* 4. Aba Pagamentos */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
              <h5 className="font-black text-xs text-[#0A1628] uppercase tracking-wider mb-2 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-[#C9A227]" /> 4. Aba Pagamentos (Meios e Bandeiras)
              </h5>
              <div className="text-xs text-slate-500 space-y-2 leading-relaxed">
                <p>Configure quais opções de pagamento estarão disponíveis na finalização da venda (Pix Dinâmico, Cartão de Crédito/Débito, Vales Refeição Sodexo/Alelo/VR, Vale Alimentação ou Dinheiro no Local).</p>
                <p><strong>Customização de Bandeiras:</strong> Para cada modalidade de cartão cadastrada, você pode clicar e selecionar as bandeiras aceitas (Visa, Master, Elo) ou digitar novas bandeiras personalizadas direto no campo de texto e clicar em `+ Adicionar`.</p>
              </div>
            </div>

            {/* 5 e 6. Aba Maquinhas e Fiscal */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
              <h5 className="font-black text-xs text-[#0A1628] uppercase tracking-wider mb-2 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#C9A227]" /> 5 e 6. Abas Maquinhas (Integração TEF) e Fiscal (NFC-e)
              </h5>
              <div className="text-xs text-slate-500 space-y-2 leading-relaxed">
                <p><strong>Maquinhas:</strong> Integração direta com terminais Stone (TEF) informando as credenciais secretas do estabelecimento para captura automática de pagamentos físicos no PDV.</p>
                <p><strong>Fiscal:</strong> Configure as regras de faturamento e emissão de cupom fiscal de venda ao consumidor (NFC-e). Digite o CNPJ, Inscrição Estadual (IE), Regime Tributário (CRT), Série de Emissão e ambiente de teste/produção.</p>
              </div>
            </div>

            {/* Exemplos de Correto vs Incorreto */}
            <div className="mt-4 border-t border-slate-100 pt-4 space-y-3">
              <h6 className="text-xs font-black text-slate-800 uppercase tracking-widest text-[#C9A227]">Guia de Boas Práticas (Configurações Gerais)</h6>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200/50 text-xs text-slate-600 space-y-1">
                  <span className="font-bold flex items-center gap-1 text-emerald-800">
                    <Check className="w-4 h-4" /> Correto (O que fazer)
                  </span>
                  <p className="leading-relaxed">
                    Utilizar a aba **"Horários"** com programações de **"Intervalo / Pausa"** automáticos se sua loja fecha à tarde para descanso da equipe, evitando que pedidos online entrem sem preparo.
                  </p>
                  <p className="leading-relaxed">
                    Manter o CEP de origem da loja rigorosamente correto ao utilizar a cobrança de frete por **KM**, garantindo precisão nas rotas do motoboy.
                  </p>
                </div>
                <div className="bg-red-50/50 p-4 rounded-xl border border-red-200/50 text-xs text-slate-600 space-y-1">
                  <span className="font-bold flex items-center gap-1 text-red-800">
                    <X className="w-4 h-4" /> Incorreto (O que evitar)
                  </span>
                  <p className="leading-relaxed">
                    Habilitar bandeiras de vale-refeição ou convênios na aba **"Pagamentos"** se sua loja não possui contrato ativo ou maquininhas habilitadas para essas redes.
                  </p>
                  <p className="leading-relaxed">
                    Desativar a obrigatoriedade do caixa do PDV na aba Loja se você possui operadores terceirizados no caixa, pois isso remove o controle de auditoria de sangrias e suprimentos.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "staff",
      title: "Equipe",
      tab: "staff",
      icon: ClipboardList,
      keywords: ["equipe", "funcionarios", "garcom", "caixa", "permissao", "operador"],
      content: (
        <div className="space-y-4">
          <p className="text-slate-600 text-sm leading-relaxed">
            Painel de administração para cadastrar gerentes, caixas e garçons, configurando níveis de acesso para proteger dados sigilosos da empresa.
          </p>

          <div className="mt-4 border-t border-slate-100 pt-4 space-y-3">
            <h6 className="text-xs font-black text-slate-800 uppercase tracking-widest text-amber-600">Guia de Boas Práticas (Equipe)</h6>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200/50 text-xs text-slate-600 space-y-1">
                <span className="font-bold flex items-center gap-1 text-emerald-800">
                  <Check className="w-4 h-4" /> Correto (O que fazer)
                </span>
                <p className="leading-relaxed">
                  Cadastrar contas individuais exclusivas para cada garçom ou operador de caixa para fins de auditoria no caso de quebras de caixa ou lançamentos incorretos.
                </p>
              </div>
              <div className="bg-red-50/50 p-4 rounded-xl border border-red-200/50 text-xs text-slate-600 space-y-1">
                <span className="font-bold flex items-center gap-1 text-red-800">
                  <X className="w-4 h-4" /> Incorreto (O que evitar)
                </span>
                <p className="leading-relaxed">
                  Compartilhar uma única senha geral de gerente com toda a equipe do salão, comprometendo o controle de exclusão de itens e de fechamento de caixa.
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "downloads",
      title: "Downloads",
      tab: "downloads",
      icon: Download,
      keywords: ["impressao", "desktop", "aplicativo", "baixar", "imprimir"],
      content: (
        <div className="space-y-4">
          <p className="text-slate-600 text-sm leading-relaxed">
            Espaço para baixar o aplicativo nativo do Box Sys para desktop, que conecta as impressoras térmicas locais diretamente com os lançamentos de vendas da plataforma.
          </p>

          <div className="mt-4 border-t border-slate-100 pt-4 space-y-3">
            <h6 className="text-xs font-black text-slate-800 uppercase tracking-widest text-amber-600">Guia de Boas Práticas (Impressão)</h6>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200/50 text-xs text-slate-600 space-y-1">
                <span className="font-bold flex items-center gap-1 text-emerald-800">
                  <Check className="w-4 h-4" /> Correto (O que fazer)
                </span>
                <p className="leading-relaxed">
                  Instalar o aplicativo utilitário oficial de impressão no computador ligado ao caixa físico para que as vias térmicas saiam automaticamente.
                </p>
              </div>
              <div className="bg-red-50/50 p-4 rounded-xl border border-red-200/50 text-xs text-slate-600 space-y-1">
                <span className="font-bold flex items-center gap-1 text-red-800">
                  <X className="w-4 h-4" /> Incorreto (O que evitar)
                </span>
                <p className="leading-relaxed">
                  Imprimir cupons no formato do navegador direto sem o aplicativo de impressão ativo, o que causará cupons desformatados ou pulando papel.
                </p>
              </div>
            </div>
          </div>
        </div>
      )
    }
  ];

  // 1. Filter sections that are allowed for the current member
  const allowedSections = sections.filter(sec => {
    if (!sec.tab) return true; // Always visible (like "Primeiros Passos")
    return canAccess(membership, sec.tab);
  });

  // 2. Filter sections based on search query
  const filteredSections = allowedSections.filter(sec => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      sec.title.toLowerCase().includes(query) ||
      sec.keywords.some(kw => kw.includes(query))
    );
  });

  const activeSection = filteredSections.find(s => s.id === activeSectionId) || filteredSections[0];

  return (
    <div className="bg-white rounded-[28px] border border-slate-200/80 shadow-sm overflow-hidden min-h-[75vh] flex flex-col md:flex-row animate-fade-in">
      
      {/* Sidebar de tópicos */}
      <div className={`w-full md:w-80 border-r border-slate-100 bg-slate-50/50 p-5 flex flex-col shrink-0 ${mobileActive ? 'hidden md:flex' : 'flex'}`}>
        
        {/* Search */}
        <div className="relative mb-5">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              // reset active view if not in the new filtered list
              const matches = allowedSections.filter(sec => {
                const query = e.target.value.toLowerCase();
                return sec.title.toLowerCase().includes(query) || sec.keywords.some(kw => kw.includes(query));
              });
              if (matches.length > 0 && !matches.some(m => m.id === activeSectionId)) {
                setActiveSectionId(matches[0].id);
              }
            }}
            placeholder="Pesquisar manual..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-semibold focus:outline-none focus:border-amber-400 transition-all text-slate-700"
          />
        </div>

        {/* List */}
        <div className="space-y-1 overflow-y-auto flex-1 max-h-[50vh] md:max-h-[58vh] pr-1 custom-scrollbar">
          {filteredSections.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              Nenhum tópico encontrado.
            </div>
          ) : (
            filteredSections.map(sec => {
              const Icon = sec.icon;
              const isActive = activeSection?.id === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => {
                    setActiveSectionId(sec.id);
                    setMobileActive(true);
                  }}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all text-left group ${
                    isActive 
                      ? "bg-[#0D1B3E] text-white shadow-md shadow-[#0D1B3E]/10" 
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isActive ? "bg-white/10 text-[#C9A227]" : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-black tracking-wide leading-tight">{sec.title}</span>
                  </div>
                  <ChevronRight className={`w-3.5 h-3.5 opacity-60 transition-transform ${isActive ? "translate-x-0.5 text-[#C9A227]" : "group-hover:translate-x-0.5"}`} />
                </button>
              );
            })
          )}
        </div>

        {/* Suporte Info */}
        <div className="mt-6 pt-5 border-t border-slate-100 bg-white/40 p-4 rounded-2xl border">
          <div className="flex items-start gap-2.5">
            <HelpIcon className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h6 className="text-xs font-black text-slate-800">Precisa de ajuda extra?</h6>
              <p className="text-[10px] text-slate-500 leading-relaxed mt-0.5">
                Contate o proprietário do estabelecimento ou acione o suporte técnico do Box Sys.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo do Manual */}
      <div className={`flex-1 p-6 md:p-8 flex flex-col justify-between ${mobileActive ? 'flex' : 'hidden md:flex'}`}>
        {activeSection ? (
          <div className="space-y-6 flex-1 flex flex-col min-h-0">
            
            {/* Botão voltar no mobile */}
            <button
              onClick={() => setMobileActive(false)}
              className="md:hidden text-xs font-black uppercase text-slate-400 flex items-center gap-1 hover:text-slate-700 transition-colors mb-4 shrink-0"
            >
              <ChevronLeft className="w-4 h-4" /> Voltar para os tópicos
            </button>

            <div className="flex items-center gap-3 pb-4 border-b border-slate-100 shrink-0">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-[#C9A227] flex items-center justify-center">
                {React.createElement(activeSection.icon, { className: "w-5 h-5" })}
              </div>
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none">Manual de Operação</span>
                <h3 className="text-lg font-black text-slate-800 mt-0.5 leading-none">{activeSection.title}</h3>
              </div>
            </div>

            <div className="text-slate-600 flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
              {activeSection.content}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2">
            <BookOpen className="w-12 h-12 text-slate-200" />
            <p className="text-xs">Selecione um tópico para visualizar.</p>
          </div>
        )}
      </div>

    </div>
  );
}
