# Padrão de telas do MFC (front)

Referência extraída das telas já ajustadas:

| Tela | Arquivo | Serve de modelo para |
|---|---|---|
| Detalhes do MFCista | `views/MemberProfile.tsx` | páginas de **detalhe/leitura** (perfil, ficha) |
| Lançamentos | `views/DailyEntries.tsx` | páginas de **listagem + resumo** (KPIs, filtro, tabela, gráficos) |
| Minha equipe | `views/MyTeam.tsx` | páginas **com várias abas** e cards em grade |
| Equipes Base (lista + detalhe) | `views/Teams.tsx` + `views/TeamDetail.tsx` + `components/TeamFormModal.tsx` | **lista de cards** + detalhe com membros e resumo, URL por nome |
| Tesouraria (lista + equipe) | `views/Finance.tsx` + `components/FamilyPaymentModal.tsx` + `utils/billingUnits.ts` | telas **financeiras** com ação de receber (modal de confirmação de valor) |
| Encontro de Noivos (encontros, casais, ficha) | `views/EncontroNoivos.tsx` + `views/BridalCoupleDetail.tsx` + `components/BridalCoupleForm.tsx` | hierarquia **encontro → casais → ficha** com URL por nome e formulário em abas |
| Painel (Dashboard) | `views/Dashboard.tsx` | **painel** com abas para não amontoar (Visão geral / Aniversários / Financeiro) |
| Nucleação (lista + contato) | `views/Nucleacao.tsx` + `views/NucleationDetail.tsx` + `components/NucleationContactModal.tsx` | lista de contatos → página do contato (URL por nome) com histórico e registro de tentativa |
| Ajustes | `views/Settings.tsx` | tela com **abas na rota** (`/configuracoes/:aba`) e seções independentes |
| Usuários | `views/UserManagement.tsx` + `components/UserFormModal.tsx` | cadastro com modal (vincular MFCista ou cadastro direto), ativar/inativar acesso |
| Livro Caixa (livros → lançamentos) | `views/GeneralLedger.tsx` + `components/LedgerBookModal.tsx` + `components/LedgerEntryModal.tsx` + `utils/ledger.ts` | lista de livros → livro com abas Lançamentos / Balancete / Gráfico |
| Eventos (lista, evento, formulário, inscrição pública) | `views/Events.tsx` + `views/EventDetail.tsx` + `views/EventFormPage.tsx` + `views/EventPublicForm.tsx` + `components/Event*.tsx` + `utils/events.ts` | módulo completo: taxa ou não, metas, inscrições, itens, vendas, financeiro, gráficos |
| Relatórios | `views/Reports.tsx` | **painel de indicadores** (filtros de período, KPIs, abas Visão geral/Tabela) |
| Criar/Editar MFCista | `views/MemberFormPage.tsx` + `components/MemberForm.tsx` | **formulários** de cadastro (mesma tela cria e edita) |

Regra geral: **toda tela é montada só com os componentes de `components/ui`** (importados de `'../components/ui'`). Não criar HTML/Tailwind solto para o que já existe como componente. Visual: fundo branco, borda `slate-200`, cantos `rounded-lg`, **sem sombras fortes**, azul como cor de destaque, texto pequeno e denso (`text-xs` / `text-[13px]`).

---

## 1. Esqueleto de toda página

```tsx
<PageWrapper>
  <div className="space-y-4">          {/* espaçamento vertical padrão entre blocos */}
    <SectionTitle title="..." description="..." icon={X} action={...} />
    ...blocos...
  </div>
  {/* modais ficam FORA do space-y, no fim do PageWrapper */}
  <ConfirmModal ... />
</PageWrapper>
```

- `PageWrapper`: já cuida de padding responsivo (zero no mobile, `sm:px-4 lg:px-5 xl:px-6`) e do espaço do menu inferior no mobile. Nunca colocar padding próprio por fora.
- `space-y-4` entre blocos principais; `space-y-3` dentro de uma aba/seção; `gap-3` em grades de cards.
- Modais/ConfirmModal ficam como irmãos do `div.space-y-4`, nunca no meio do fluxo.

## 2. Cabeçalho da página

- **Páginas de listagem/gestão** → `SectionTitle` (ícone azul em quadradinho, título `text-base/lg font-semibold`, descrição `text-xs slate-500`).
  - `action`: botões `size="sm"` dentro de `<div className="flex flex-wrap gap-2">`. Ação destrutiva/secundária = `variant="outline"`, ação principal = padrão (primary), sempre com `iconLeft={<Icon size={14} />}`.
  - A descrição resume o contexto com `·`: `"Cidade / UF · 12 famílias · 40 membros"` (montar com `[...].filter(Boolean).join(' · ')`).
- **Páginas de detalhe** → **não** usa `SectionTitle`. Usa:
  1. Barra superior: `Button variant="ghost" size="sm"` "← Voltar para X" à esquerda e `Button variant="outline" size="sm"` "Editar" à direita (`flex flex-wrap items-center justify-between gap-2`).
  2. `ContentCard padding="md"` com o **cabeçalho da entidade**: avatar/foto 56px (`h-14 w-14 rounded-lg border bg-blue-50 text-blue-700`, iniciais se não tiver foto) + nome `h1 text-base sm:text-lg font-semibold` + linha de contexto `text-xs slate-500` (`apelido · equipe · cidade / UF`) + `Badge dot` de status + metadados em `text-xs` (idade, tempo de casa) + ações rápidas (WhatsApp, Ligar) à direita, `outline`/`sm`, **desabilitadas com `title` explicando o motivo** quando faltam dados.

## 3. Abas (`Tabs`)

```tsx
const tabs = [{ id: 'pessoal', label: 'Perfil', icon: User }, ...] as const;
<Tabs<typeof tabs[number]['id']> items={tabs} value={activeTab} onChange={setActiveTab} label="Detalhes do MFCista">
  {activeTab === 'pessoal' && <div className="space-y-3">...</div>}
</Tabs>
```

- Definir `tabs` como constante **fora do componente** com `as const` e tipar o estado com `typeof tabs[number]['id']`.
- `label` é obrigatório (acessibilidade, vira `aria-label`).
- Um ícone lucide por aba, rótulo curto (1–2 palavras).
- **Passe o genérico** (`<Tabs<typeof tabs[number]['id']> …>`); sem ele o TypeScript infere `string` e acusa erro no `onChange={setActiveTab}`. O mesmo vale para `FilterLineSegmented` com estado `string` (`onChange={v => set(String(v))}`).
- `Switch` usa `onCheckedChange`, não `onChange` (com `onChange` o botão não faz nada).
- Renderizar por `activeTab === 'x' && ...`; dentro de cada aba, `space-y-3`.
- Ao trocar de registro (mudou o `id` da rota), resetar a aba (`setActiveTab('pessoal')`).

## 4. Detalhe de dados (modo leitura) — `PanelCard` + `DetailField`

```tsx
const fieldsClass = 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-6';

<PanelCard title="Dados pessoais">
  <dl className={fieldsClass}>
    <DetailField label="CPF" value={maskCPF(member.cpf || '')} />
    <DetailField label="Data de nascimento" value={dateLabel(member.dob)} />
  </dl>
</PanelCard>
```

- Um `PanelCard` por **assunto** (ex.: "Dados pessoais", "Contato e profissão"), com título curto. Várias seções na mesma aba ficam em `space-y-3`.
- Sempre `<dl>` com a grade acima + `DetailField`. O `DetailField` mostra **"Não informado"** em cinza quando o valor é vazio — por isso **não** é preciso `value || '-'`; passe `''`/`undefined`.
- Formatação sempre antes de passar: `maskCPF`, `maskPhone`, `maskCEP` (`utils/masks.ts`), e `dateLabel()` para `YYYY-MM-DD → DD/MM/AAAA`. Booleano nulo → `''`, senão `'Sim'/'Não'`.
- Campo condicional: `{member.pcd && <DetailField ... />}`; bloco condicional inteiro (ex.: Casamento) só aparece se houver dado (`hasMarriage`).
- Subtítulo dentro do card: `<h3 className="text-xs font-semibold text-slate-700 mt-4 mb-2">`.
- Lista curta dentro do card: `<ul className="divide-y divide-slate-100">` com `<li className="text-[13px] text-slate-700 py-2 break-words">`. Lista vazia: `<p className="text-xs text-slate-500 py-2">Nenhum … registrado.</p>`.
- Texto de orientação no fim do card: `text-xs text-slate-500 mt-4`.

## 5. Estados da tela (carregando / erro / vazio)

Todo carregamento de detalhe tem os **3 estados**, cada um dentro de `PageWrapper`:

```tsx
// carregando
<div role="status" className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
  <Loader2 size={18} className="animate-spin" />Carregando MFCista…
</div>

// erro ou não encontrado (mesma tela, texto diferente)
<ContentCard>
  <EmptyState icon={User}
    title={error ? 'Não foi possível carregar o cadastro' : 'MFCista não encontrado'}
    description={error ? 'Confira a conexão e tente novamente.' : 'O cadastro pode ter sido removido.'}
    action={<div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={voltar}>Voltar para MFCistas</Button>
      {error && <Button onClick={() => setRetry(v => v + 1)}>Tentar novamente</Button>}
    </div>} />
</ContentCard>
```

- **Distinguir erro de rede de "não existe"** e oferecer "Tentar novamente" (contador `retry` na dependência do `useEffect`).
- Carga com proteção contra corrida: `cancelled` + `requestId`, e `finally` só atualiza se ainda for a requisição atual. Recarregar ao voltar para a janela: `window.addEventListener('focus', load)` (remover no cleanup).
- Lista vazia: `EmptyState` com mensagem **diferente se há busca ativa** ("Ajuste a busca…") ou não ("Importe uma planilha para começar.").
- Em `GridTable` usar `isLoading` e `emptyMessage={<EmptyState .../>}`.

## 6. Listagem com resumo (padrão Lançamentos)

Ordem dos blocos: **SectionTitle → StatGrid → Tabs (Lista | Resumo)**.

1. **KPIs**: `StatGrid cols={3}` + `StatCard` (`title`, `value`, `icon`, `color`).
   - Cores com significado: `success` entradas/ok, `danger` saídas/pendências, `info` saldo/total; saldo negativo troca para `danger`.
   - Dinheiro formatado com `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`. Valor de saída mostrado em módulo (`Math.abs`) com cor/ícone de saída.
2. **Aba lista**: `space-y-3` →
   - `FilterLine` > `FilterLineSection grow` > `FilterLineSearch` (com `aria-label`), e outra `FilterLineSection` com contagem `text-xs text-slate-500` ("N registros") + botão ghost "Limpar busca" que só aparece se há busca.
   - `ContentCard padding="none"` > `GridTable` com `noDesktopCard` (o card já é o `ContentCard`), `keyExtractor`, `isLoading`, `columns`, `emptyMessage`, `pagination` via `usePagination(lista, 15)`.
3. **Aba resumo**: `grid grid-cols-1 lg:grid-cols-2 gap-4` com `PanelCard title description` > `div.h-64.min-w-0` > Recharts `ResponsiveContainer`. Eixos sem linha (`axisLine/tickLine false`), fonte 11, grade só horizontal `#e2e8f0`, barras `radius [3,3,0,0]`, negativo em vermelho `#ef4444` e positivo `#2563eb`.
4. **Busca**: filtrar com `normalizeDirectoryText` (`utils/memberDirectory.ts`) nos dois lados — ignora acento e caixa. Concatenar todos os campos pesquisáveis num texto só.

### Células de coluna (GridTable)
- Texto principal `text-xs text-slate-800` (`font-medium` se for o título) e linha secundária `text-[11px] text-slate-500 mt-0.5`.
- Data: `text-xs whitespace-nowrap` via `formatPaymentDate`.
- Categoria/conta: `<Badge>`.
- Dinheiro: `text-xs font-semibold tabular-nums whitespace-nowrap`, `text-emerald-700` positivo / `text-red-600` negativo.
- Texto longo: `max-w-sm break-words`.

## 6.1 Ações em lote / perigosas
- Importar arquivo: `<input type="file" className="hidden" aria-label=... />` acionado por botão; `loading` no botão enquanto importa; limpar o `event.target.value` no `finally`; `toast.success/error`.
- Apagar: **sempre `ConfirmModal`** com `variant="danger"`, título em pergunta ("Limpar lançamentos?"), mensagem dizendo que não dá para desfazer e `confirmLabel` específico ("Apagar lançamentos"). Botão que dispara fica `disabled` quando não há dados ou outra ação está rodando (`importing`/`clearing` se bloqueiam entre si).

## 7. Cards em grade (padrão Minha equipe)

- Grade: `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3` (membros: até `xl:grid-cols-5`).
- Card: `ContentCard padding="none"` com `group hover:border-blue-200 transition-all overflow-hidden flex flex-col h-full`; estado de alerta = `border-rose-100`.
- Estrutura: corpo `p-3` + **rodapé** `p-3 bg-slate-50/50 border-t border-slate-100` com a ação primária (`Button size="xs" className="flex-1"`) e `IconButton variant="ghost" size="xs"` com `aria-label`.
- Cabeçalho do card: ícone em quadradinho `w-7 h-7 rounded-md border` à esquerda (muda de cor por estado) e `Badge size="sm" dot` à direita (`danger` atrasado, `success` em dia, `default` sem cobrança).
- Barrinha de 12 meses: `grid grid-cols-12 gap-0.5`, cada mês `h-2.5 rounded-[3px]`; verde pago, âmbar atraso/parcial, vermelho em aberto, cinza futuro/sem cobrança, com `title` explicando.
- Card clicável para ir ao detalhe: `onClick={() => navigate('/mfcistas/' + id)}` + seta `ArrowRight` que anda no hover.
- Filtros acima: `FilterLine` com `FilterLineSearch` + `FilterLineSegmented` (opções com ícone `w-3.5 h-3.5`) e o botão de criar em `FilterLineSection align="right"`.

## 8. Modais

- Detalhe rápido: `Modal size="lg" position="center"`, conteúdo em `space-y-4` com `<section>` e `<h3 className="text-xs font-semibold text-slate-800 mb-2">`; separar seções com `border-t border-slate-100 pt-3`; listas com `divide-y divide-slate-100`.
- Rodapé: `ModalFooter align="between"` — "Fechar" (`ghost`/`sm`) à esquerda e ação principal (`primary`/`sm`, com ícone) à direita; desabilitar a principal se não houver o que lançar.
- Confirmações: `ConfirmModal`.
- Antes de salvar em lote, bloquear duplo clique com estado `isSaving` e **não repetir lançamentos já existentes**.

## 8.1 Formulário de criar/editar (padrão MFCista)

Arquivos: `views/MemberFormPage.tsx` (página/rota) + `components/MemberForm.tsx` (formulário). **A mesma tela serve para criar e editar**; a rota decide: `/mfcistas/novo` (sem `memberId`) e `/mfcistas/:memberId/editar` (`isEditing = !!memberId`).

**Divisão de responsabilidades**
- **Página** (`MemberFormPage`): carrega dados (equipes + o registro, se editando), aplica máscara nos dados iniciais, **tira a máscara antes de enviar**, chama `create`/`update`, navega e mostra o toast. Não conhece campos.
- **Formulário** (`MemberForm`): só estado e campos. Recebe `initialData`, `teams`, `isEditing`, `onSave`, `onCancel`. Não sabe de rota nem de API de membro.
- Para uma nova entidade (ex.: Evento, Equipe): criar `XFormPage` + `XForm` com o mesmo contrato.

**Esqueleto da página**
```tsx
<PageWrapper><div className="space-y-4">
  <Button variant="ghost" size="sm" ...>← Voltar para X</Button>   // hoje é <button> manual; usar Button ghost
  <SectionTitle title={isEditing ? 'Editar X' : 'Novo X'} description={isEditing ? 'Atualize…' : 'Preencha…'} icon={UserPlus} />
  <ContentCard padding="md"><XForm isEditing teams initialData onCancel onSave /></ContentCard>
</div></PageWrapper>
```
- Mesmo título/ícone/descrição alternando por `isEditing`.
- `Cancelar` volta com `navigate(-1)`; salvar edição vai para o **detalhe** (`/mfcistas/:id`), salvar criação vai para a **lista**.

**Carga e dados iniciais**
- `useState(isEditing)` para `loading`; registro não encontrado ou erro → `toast.error` + `navigate` para a lista.
- Máscara na ida (`maskCPF/maskPhone/maskCEP/maskRG` em `initialData`) e `unmask` na volta (`handleSave`). Os campos mascarados são: rg, cpf, zip, phone, emergencyPhone, spouseCpf.
- O form faz `useState({ ...blank, ...initialData })`: `blank` define **todos** os campos com padrão (cidade, UF, status etc.), e `initialData` sobrescreve na edição.
- Campo só aparece na edição quando faz sentido (`Status` só com `isEditing`; novo cadastro nasce `Aguardando`).

**Dentro do formulário**
1. **Barra de progresso** do cadastro no topo (`bg-zinc-50 border rounded-lg p-3`): % = campos obrigatórios preenchidos / total (nome, CPF, telefone, nascimento, data MFC, cidade, UF).
2. **Abas por assunto**, iguais às do detalhe: Pessoal · Família · Contato · Endereço · Saúde. Estado em `useState<'pessoal' | ...>`.
3. Cada aba é `grid grid-cols-1 sm:grid-cols-2 gap-4`; campo largo usa `sm:col-span-2`; blocos de apoio em `rounded-lg border bg-blue-50/zinc-50 p-3`; separador interno `Divider className="sm:col-span-2"`.
4. **Helpers locais** `FormInput` (aceita `mask`, aplica ao digitar), `FormSelect` (options em `string[]`), `FormCheck` (Switch em caixa) e `set(field, value)` — evitam repetir markup. Datas com `DatePicker`, CEP com `CepInput` (autopreenche logradouro/bairro/cidade/UF sem apagar complemento digitado).
5. **Regras de negócio dentro do formulário**: ao trocar o vínculo para dependente (`Filho(a)` etc.), `paysMonthly`/`isPaymentInactive` são zerados; só Titular/Cônjuge têm "Mensalidade ativa". Mostrar um aviso explicando a regra em vez de esconder o campo sem dizer nada.
6. **Foto**: `input[type=file]` oculto com `aria-label`, valida tipo (JPG/PNG/WebP) e tamanho (5 MB) **antes**, mostra preview com `URL.createObjectURL` (revogar no cleanup), erro com `role="alert"`, "Trocar/Remover foto", e **só envia ao salvar** (`api.uploadMemberPhoto`).
7. **Rodapé**: `flex justify-end gap-3 pt-3 border-t` com `Cancelar` (ghost/sm) e `Salvar Alterações` (primary/sm, `loading={saving}`). Todos os campos e botões ficam `disabled` enquanto salva.

**Salvar (anti duplo clique)**
```tsx
const savingRef = useRef(false);            // trava síncrona (state sozinho deixa passar 2 cliques)
const save = async () => {
  if (savingRef.current) return;
  savingRef.current = true; setSaving(true);
  try { /* upload da foto */ await onSave({ ...form, photoUrl }); }
  catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível salvar. Tente novamente.'); }
  finally { savingRef.current = false; setSaving(false); }
};
```
- `onSave` devolve a Promise para o formulário saber quando liberar o botão.
- Na página, `toast.promise(api.x(...).then(navigate), { loading, success, error: e => e.message })` e `.catch(() => {})` no fim para não estourar erro não tratado (o toast já avisou).

**O que NÃO copiar do formulário**
- (Corrigido) `handleSave` enviava `movementRoles: []` sempre, o que apagava os cargos ao editar. Agora usa `data.movementRoles || []`, que preserva o valor carregado. Ao replicar, nunca sobrescrever campo que o formulário nem edita: o backend (`members.routes.js`) trata ausente como vazio, então é preciso reenviar o valor original.
- O carregando da página é só texto cinza `text-sm text-zinc-400`; usar o padrão da seção 5 (spinner + `role="status"`). Erro/não encontrado hoje joga o usuário para a lista com toast; no detalhe o padrão é `EmptyState` com "Tentar novamente".
- Voltar é `<button>` manual com `font-bold text-slate-400`; usar `Button variant="ghost" size="sm"`.
- Abas do formulário são botões manuais (`text-[10px] uppercase`, sem `role="tab"`); usar o componente `Tabs` (acessível, mesmo visual do detalhe).
- Toasts com emoji (✅ 🎉) e rótulo de botão "Salvar Alterações" também ao criar — preferir "Salvar" / "Cadastrar".
- Padrões fixos no `blank` (`Tatui`, `SP`, `Sudeste`, `Catolica`, `O+`) pré-selecionam respostas que o usuário pode esquecer de trocar; para outras telas, deixar vazio quando não for um padrão real.
- Campos obrigatórios só alimentam a barra de progresso; **não há validação** que impeça salvar sem nome/CPF. Em telas novas, validar e mostrar erro no campo antes de enviar.

## 8.2 URL com nome (slug) em vez de id

Usado em Equipes: `/equipes/equipe-sao-jose` em vez de `/equipes/t1`.

- `utils/teamSlug.ts`: `teamSlug(team, teams)`, `findTeamByParam(teams, param)` e `teamPath(team, teams)`. Nome repetido ganha a cidade no slug e, se ainda colidir, o id.
- Rota: `equipes/:teamSlug`. Toda navegação usa `navigate(teamPath(team, teams))`; nunca montar a URL com `team.id`.
- A tela de detalhe resolve a entidade pelo slug **ou pelo id** (links antigos continuam abrindo) e faz `navigate(path, { replace: true })` para a URL com nome. O mesmo vale depois de renomear.
- Para outra entidade, copiar o par `slugify`/`find…ByParam` e seguir a mesma ideia.
- Limitação: o slug vem do nome; se criarem outra equipe com o mesmo nome, o slug da primeira passa a incluir a cidade.

## 8.2.1 Mesma entidade em outra rota

A Tesouraria usa o mesmo slug em `/financeiro/:teamSlug` (`teamPath(team, teams, '/financeiro')`). Mês e ano ficam na query (`?mes=7&ano=2026`) para sobreviverem à navegação entre lista e equipe e poderem ser compartilhados; o botão Voltar preserva `search`.

## 8.2.2 Receber mensalidade (regras)

- **Unidade de cobrança** (`utils/billingUnits.ts`): família (titular + cônjuge pagam juntos) ou membro sem família. A tela mostra o valor da **unidade** (ex.: R$ 30,00) e, por contribuinte, a parte dele (R$ 15,00 cada no casal). Dependentes e isentos aparecem só como "Isentos: …", **sem botão de receber** (o backend também recusa com 422).
- **Modal único** `FamilyPaymentModal`, usado em Minha equipe e na Tesouraria: mostra contribuintes, grade de meses, o **valor que está sendo recebido**, em que mês entra no caixa e quais mensalidades ficam quitadas; o botão traz o valor ("Confirmar R$ 90,00").
- **Atraso**: o dinheiro entra no caixa do mês da **data do recebimento** (não pode ser futura). Meses anteriores ficam quitados como "Pago em atraso", mas **não** geram entrada no caixa deles. "Selecionar atrasadas" marca todos de uma vez.
- Lançamentos parciais (um falhou) mantêm o modal aberto e o que já foi gravado fica bloqueado para não duplicar.

## 8.2.3 Hierarquia com URL por nome (Encontro de Noivos)

- Rotas: `/encontro-noivos` (encontros), `/encontro-noivos/casais` (todos), `/encontro-noivos/encontro/:meetingSlug`, `/encontro-noivos/:coupleSlug`. A navegação entre níveis é por **URL** (não por estado), então o botão voltar do navegador e o link compartilhado funcionam.
- `utils/entitySlug.ts` é o slug genérico: recebe candidatos do menos ao mais específico (nome, nome + data) e desempata pelo id curto. `utils/bridalPaths.ts` aplica a encontros e casais.
- Como o nome vira URL, **editar o nome muda o endereço**: depois de salvar, atualize a lista usada para resolver o slug (a tela faz `navigate(..., { replace: true })` sozinha).
- Formulário longo com muitas seções: **passo a passo só na criação** e no formulário público; na **edição use abas livres** com o botão Salvar sempre visível (`layout="tabs"` em `BridalCoupleForm`).

## 8.2.4 Painel sem amontoar

- Máximo de 4 KPIs por linha (`StatGrid cols={4}`; 2 colunas no celular). O que não cabe vira **aba** (`Tabs`), não mais um card.
- Aviso do que exige ação hoje (ex.: aniversariantes) fica **acima das abas**, em um único card com botão.
- Distribuições simples (faixa etária, sexo) em barras CSS dentro de um `PanelCard`, sem gráfico pesado.
- **Mensagens prontas de WhatsApp** (`utils/birthdayMessages.ts` + `utils/whatsapp.ts`): grupo por idade (menor de 18 = jovem; 60+ = terceira idade) e depois por sexo (mulher/homem do MFC). O botão abre `wa.me` com o texto codificado e fica desabilitado, com `title` explicando, quando falta telefone.

## 8.2.5 Aba na URL (regra para toda tela com abas)

- **Toda aba deve estar na URL.** Use `useUrlTab(ids, padrão)` (`src/hooks/useUrlTab.ts`): lê/grava `?aba=<id>`, mantém os outros parâmetros (ex.: `?mes=7&ano=2026`), não mostra a aba padrão e ignora valor inválido. Assim o link abre na aba certa, o F5 não volta para a primeira e dá para compartilhar.
- Declare os ids em constante (`const tabIds = tabs.map(tab => tab.id)`) e use ids em português e sem acento (`familias`, `aniversarios`).
- **Não** chame `setActiveTab('primeira')` dentro de `useEffect` ao carregar: isso apaga a aba do link. Se precisar redirecionar para a URL com nome (slug), preserve `window.location.search`.
- Seções grandes e independentes (Ajustes) usam **segmento de rota**: `/configuracoes/acessos`, `/configuracoes/unidades`, `/configuracoes/financeiro`; a rota sem aba redireciona para a primeira e aba inválida também. Seleções dentro da aba também vão na URL (`?perfil=supervisor`, pelo nome).
- Formulário com abas livres (edição de ficha) segue a mesma regra; no passo a passo da criação o passo fica só em estado.

## 8.2.6 Estado de ciclo de vida (encontro encerrado)

- Quando algo "acontece e acaba" (encontro, campanha), mostre **Em andamento / Encerrado** e deixe fechar de duas formas: **manual** (botão Encerrar/Reabrir com confirmação) e **automática** por prazo (`utils/meetingStatus.ts`, `CLOSE_AFTER_DAYS = 7` depois da data). O estado derivado fica no front; o manual é o campo `isActive`.
- Listas mostram só o que está em andamento por padrão, com filtro **Encerrados** e **Todos**. Encerrado não aceita novos vínculos (botão "Novo casal" desabilitado e fora das opções do formulário), mas continua consultável.
- **Cuidado ao editar**: o `PUT` do backend deve manter o `isActive` quando o campo não vem (antes ele reabria o encontro a cada edição).

## 8.2.7 Eventos (como o módulo funciona)

- **Com taxa ou sem taxa.** `hasFee` + `ticketValue`. Sem taxa não há cobrança, venda de ingresso nem meta em R$ (o backend recusa `POST /event-sales` com 422). Meta de participantes e vagas valem para os dois.
- **Interno ou externo.** Interno: só membros, as equipes inscrevem. Externo: gera link público `/eventos/inscricao/:token` (sem login), com prazo, vagas e telefone único por evento.
- **Fases** (`eventStatus`): em breve → acontecendo → realizado (7 dias para acertar contas) → **encerrado** (sozinho 7 dias depois do fim, ou à mão). Encerrado só consulta: o backend recusa inscrição, pagamento, entrada, gasto e venda (422). Cancelado é outra coisa e mantém os dados.
- **Escopo por equipe** (`scopedTeamId`): coordenação geral vê e inscreve tudo; coordenador de equipe, vice, tesoureiro e usuário só mexem na própria equipe.
- **Dinheiro:** entradas = inscrições pagas + vendas + casais do Encontro de Noivos + entradas avulsas; gastos = previstos (cadastrados no formulário) + "a mais" (lançados depois). Resultado = entradas − gastos.
- **Encontro de Noivos ligado:** todo encontro cria um evento (`bridal_meeting_id`), que acompanha nome/data/local do encontro; casais contam como 2 pessoas e o pagamento deles entra nas entradas. O evento ligado não pode ser excluído por fora do encontro.
- Itens para levar têm listas prontas (café, almoço, lanche, material) e o botão "Eu levo".
- Telas novas **precisam do backend atualizado**. A tela detecta o servidor antigo (eventos sem `stats`) e avisa para reiniciar, em vez de mostrar "erro de conexão".

## 8.3 Conferir o formato da API antes de montar gráficos

A tela de Relatórios lia `value`, `color` e `name`, que o backend (`dashboard.routes.js`) nunca enviou, então os gráficos ficavam vazios/0%. Antes de montar uma tela, abra a rota do backend e tipe a resposta (ver `interface Summary` em `Reports.tsx`). Não inventar dados no front (a linha de "meta" era `valor + 5`, e os gráficos de faixa etária/aniversário do detalhe de equipe eram números fixos).

## 9. Tokens visuais (copiar à risca)

| Uso | Classe |
|---|---|
| Título de página | `text-base sm:text-lg font-semibold text-slate-900` |
| Título de card | `text-sm font-bold text-slate-900` (PanelCard) |
| Subtítulo de seção | `text-xs font-semibold text-slate-700/800` |
| Texto de dado | `text-[13px] text-slate-800` |
| Texto auxiliar | `text-xs text-slate-500` |
| Rótulo pequeno | `text-[11px] text-slate-500` |
| Vazio / não informado | `text-slate-400` |
| Divisor | `border-slate-100` (interno) / `border-slate-200` (contorno de card) |
| Raio | `rounded-lg` (cards, botões, avatar); `rounded-md` ícones pequenos |
| Padding de card | `p-3` (md) |
| Botões | `size="sm"` em cabeçalhos/barras, `size="xs"` dentro de cards; ícone 14px (`size={14}`) |
| Status | `Badge`: `success` ativo/ok, `warning` aguardando/pendente, `danger` atraso, `default` neutro, `info` informativo |

Evitar: sombras (`shadow-md`), `tracking-wide`, caixa alta forçada, `text-[9px]/[10px]`, gradientes, emojis em textos de interface.

## 10. Acessibilidade e mobile (já embutidos no padrão, manter)

- `aria-label` em busca, input de arquivo, `IconButton`, `Tabs` (`label`) e imagens (`alt="Foto de {nome}"`).
- `role="status"` no carregando.
- Botões desabilitados explicam o motivo em `title`.
- `break-words` / `min-w-0` / `truncate` em todo texto que pode ser longo; contêineres de gráfico com `min-w-0`.
- Mobile: `StatGrid` vira 2 colunas, `FilterLineItem` ocupa 100% abaixo de `sm`, `Tabs` rola na horizontal, `GridTable` vira lista de cards (usar `renderMobileItem` quando o automático não ficar bom).
- Datas nunca por `new Date('YYYY-MM-DD')` direto (fuso): usar `T12:00:00` ou os helpers (`dateLabel`, `formatPaymentDate`, `localDateToday`).

## 11. Checklist para replicar em outra tela

1. Definir se é **detalhe** (voltar + cabeçalho de entidade + abas de `PanelCard`), **listagem** (`SectionTitle` + `StatGrid` + `FilterLine` + `GridTable`) ou **formulário** (página + componente de form, seção 8.1).
2. `PageWrapper > div.space-y-4`, modais no fim.
3. Só componentes de `components/ui`; nada de tabela/card manual se `GridTable`/`ContentCard`/`PanelCard` resolvem.
4. Implementar loading, erro (com tentar de novo), vazio (com variação por busca).
5. Dados formatados antes de exibir (máscaras, datas, moeda); vazios deixados para o `DetailField`.
6. Busca com `normalizeDirectoryText`, paginação com `usePagination`.
7. Ação destrutiva com `ConfirmModal`; ações assíncronas com `loading`/`disabled` e `toast`.
8. Conferir mobile (390px) e `npx tsc --noEmit`.

---

## Tela que mostra sucesso sem gravar (aconteceu no Livro Caixa)

O Livro Caixa antigo tinha balancete com valores fixos (R$ 7.100 e R$ 850 por conta, todo mês), "evolução mensal" com porcentagens fixas e um botão "Processar Lançamentos" que só exibia "sucesso" sem chamar a API. Regras para não repetir:
- **Todo número na tela vem de dado real.** Sem valor de exemplo no código (`[42, 58, 51…]`, `monthlyRevenueValue = 7100`).
- **Todo toast de sucesso vem depois da resposta da API**, nunca antes. Teste olhando o banco ou recarregando a página.
- Lançamento pertence a um livro (`entity_id`); a data precisa estar no exercício do livro. Livro com lançamentos não pode ser excluído, e lançamento errado se corrige excluindo e lançando de novo.

## Telas de configuração: não deixar controle que não faz nada

Na revisão de Ajustes foram removidos controles que só gravavam no navegador e não afetavam o sistema (modo manutenção, notificações por e-mail, dia de vencimento, tolerância, percentual de repasse, pagamento parcial, geração automática, cor da marca) e um quadro com dados falsos do ambiente (versão, "PostgreSQL Cloud"). Regra: todo campo de configuração precisa ter efeito real no backend; o que ainda não existe fica fora da tela, não desabilitado com texto bonito.

## Pontos da Minha equipe que ainda NÃO seguem o padrão (não copiar)

`MyTeam.tsx` é a mais antiga das três; ao replicar, usar a versão limpa acima:

- Tabelas de **Mensalidades** e **Extrato** são `<table>` manuais (com `text-[11px] font-semibold tracking-normal` repetido) em vez de `GridTable`.
- Textos de interface com emoji nos `toast` ("❤️", "💰") e `text-[10px]`; o padrão novo não usa.
- `PanelCard` das metas tem `div.p-3` extra dentro (padding duplicado) e `rounded-xl`; o padrão é `rounded-lg` e sem wrapper.
- Lista de membros usa só a inicial (`m.name[0]`); o detalhe do MFCista já usa foto (`photoSrc`) com fallback de iniciais — preferir isso.
- `loadData` engole erros (`catch(() => set([]))`), então falha de rede aparece como "lista vazia"; o padrão correto é ter estado de erro com "Tentar novamente" (ver seção 5).
- Os filtros de busca da aba Famílias/Membros e da Mensalidades não têm `aria-label` nem usam `normalizeDirectoryText`.
