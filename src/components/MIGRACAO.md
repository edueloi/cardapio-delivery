# Guia de migração de telas para o padrão de UI

Referência visual e de composição: **PADRAO-TELAS.md** (telas MFCistas / Livro Caixa do mfc-system) e **theme.ts / styles.css** nesta pasta.

## Tokens (já aplicados por scripts/padronizar-ui.mjs)
Sem `uppercase`/`tracking-*`; sem `font-black/bold` (use `font-medium`/`font-semibold`); fontes mínimas 10–11px; `rounded-lg` (nunca xl/2xl/3xl); sem sombras fortes.
Escala: títulos de página `text-base sm:text-lg font-medium`; texto corrente `text-xs`/`text-[13px]`; secundário `text-[11px] text-slate-500`; label de campo 12px `font-medium text-slate-600`.
Alturas: Button md=32px, sm=32px, lg=36px, Input md=34px.

## O que trocar por componente (import de '@/src/components/ui')
- Cabeçalho de página → `SectionTitle` (ou `PageHeader` legado) dentro de `PageWrapper` + `div.space-y-4`.
- `<button>` com cara de botão → `Button` (variant primary/outline/ghost/danger/success, size xs/sm/md/lg, `iconLeft`/`iconRight`, `loading`). Botão só de ícone → `IconButton` com `aria-label`. Botões de cartão/tile/linha clicável/chips customizados podem continuar `<button>` mas com os tokens da escala.
- `<input>` / `<textarea>` / `<select>` de formulário → `Input` (label, error, hint, iconLeft, addonLeft), `Textarea`, `Select`. Checkbox/radio nativos: manter, só alinhar tamanho (`h-4 w-4 accent-blue-600`). Inputs de busca em filtros → `FilterLineSearch`.
- Modais/overlays próprios → `Modal` (`open`/`isOpen`, `size`, `footer`, `ModalFooter`) e `ConfirmModal`/`ConfirmDialog` para confirmações.
- Abas feitas à mão → `Tabs` (`items`, `value`, `onChange`, `label`) com constante `as const` fora do componente.
- Cards de KPI → `StatGrid` + `StatCard` (ou `StatsGrid`); seções → `PanelCard`/`ContentCard`; pares label/valor → `DetailField`; badges de status → `Badge`; avisos → `Alert`; vazio → `EmptyState`; toggle → `Switch`.
- Filtros → `FilterLine*`; tabelas simples com paginação → `GridTable` (+ `usePagination`) SOMENTE quando a troca for direta; tabelas complexas (colunas editáveis, drag, expansão, totais) ficam, mas com `text-xs`, cabeçalho `bg-zinc-50 text-[11px] font-medium text-slate-500`, linhas `py-2`.
- Responsividade: nada de largura fixa sem `max-w`; grids `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3`; ações em `flex flex-wrap gap-2`; tabelas largas em `overflow-x-auto` ou cartões no mobile.

## Regras de segurança
- NÃO alterar lógica, estado, handlers, chamadas de API, rotas, textos de negócio, atributos `data-tour`, `id`, `ref`, `key`, `aria-*` existentes.
- Ao trocar elemento por componente mantenha `onClick/onChange/disabled/type/title/form`. `Input` aplica `className` no `<input>`; classes de largura do wrapper vão em `wrapperClassName`. `Switch` aceita `onChange(checked)`.
- Não editar `src/components/ui/*` nem `src/index.css` (outro agente cuida); se faltar algo no ui, adapte na tela.
- Fora de escopo: `views/Store/**`, `views/Auth/**`, `onboarding/**`, `PDVStandalone.tsx` (vitrine/login/tour).
- Não rodar git commit/stash/checkout. Não instalar pacotes.
