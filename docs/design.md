# Design do Console

A base visual, os componentes e os padrões de tela do Console. Toda tela nova ou refeita segue este documento. A identidade da marca vem do repositório `anuntech/design-system` (voz em `project/voz.md`, composição em `composicao.md`); aqui está como ela se aplica ao produto.

## Como trabalhamos

1. **Design primeiro.** Cada assunto é refeito inteiro (lista, detalhe, criação, edição, estados), não tela por tela solta.
2. **shadcn como base.** Primitivos em `src/components/ui` (shadcn new-york sobre Radix e Base UI) e blocos do shadcn.io, adaptados à marca. Nenhum dado de demonstração dos blocos vai para produção.
3. **Padrões antes de exceções.** Se uma tela precisa de algo que o catálogo abaixo não tem, o novo padrão entra em `src/components/console` e passa a valer para todas.
4. **Movimento com propósito.** Resposta imediata ao toque, transições interrompíveis, respeito a movimento reduzido (referência: skill apple-design).
5. **Conferir claro e escuro, desktop e 320 px** antes de dar uma tela por pronta.

## Fundação

- **Tailwind CSS v4** com tokens em CSS. `src/app/globals.css` declara as cores da marca e o tema escuro; `src/app/shadcn.css` mapeia essas variáveis para os nomes do Tailwind (`bg-primary`, `text-muted-foreground`, `border-border`…).
- **Camadas:** `theme, base, legacy, components, utilities`. O CSS antigo vive em `@layer legacy`: fica acima do preflight (telas antigas não mudam) e abaixo das utilities (componentes shadcn saem como desenhados). CSS Modules só restam em `components/shell` (dock e telas públicas antigas).
- **Tema escuro** por `data-theme="dark"` no `<html>`, ou `data-theme="system"` seguindo o sistema. Nunca a classe `.dark`. A variante `dark:` do Tailwind já entende os dois.
- Preferências de tema e posição do dock ficam em cookie e são aplicadas no HTML inicial, sem piscar.

## Marca e tokens

### Tipografia

- **Sofia** (400, 600, 700), servida de `public/brand`. Fallback: fontes do sistema.
- Texto base 14 px (`0.875rem`), entrelinha 1,55. Tamanhos em `rem` para respeitar o tamanho de texto do sistema.
- Título de página: `text-2xl font-semibold tracking-[-0.02em]`. Títulos grandes pedem tracking negativo; texto pequeno fica em 0.
- Números que se comparam (valores, datas em tabela) usam `tabular-nums`.

### Cores

| Token | Claro | Escuro | Uso |
| --- | --- | --- | --- |
| `--background` | `#f5f7fb` | `#101722` | Fundo da aplicação |
| `--foreground` | `#0d1d41` | `#e7edf7` | Texto principal (azul-marinho do logotipo) |
| `--card` | `#ffffff` | `#182231` | Superfícies |
| `--primary` | `#1a428a` | `#9ebfff` | Ação principal, links, foco de marca |
| `--secondary` | `#eef2f8` | `#222f42` | Fundos neutros (`muted` aponta aqui) |
| `--muted-foreground` | `#5d6c81` | `#acb9cc` | Texto de apoio |
| `--accent` | `#edf2fc` | `#243b5e` | Item selecionado, realce suave |
| `--border` | `#e0e6ef` | `#364458` | Divisores e bordas de superfície |
| `--field-background` / `--field-border` | `#f0f3f8` / `#d5dce7` | `#202c3d` / `#41516a` | Campos (`bg-field`, `border-input`) |
| `--ring` | `#557ac0` | `#a6c4ff` | Foco |
| `--yellow` | `#e1e666` | | Amarelo do logotipo, só em destaque |

Estados, sempre com texto além da cor: `success`, `warning` e `destructive`, cada um com `-soft` (fundo) e `-edge` (borda). Ex.: `bg-warning-soft border-warning-edge text-warning`.

O azul-marinho e o amarelo são as tintas do logotipo, as mesmas do `anuntech/design-system`. Sombras usam o azul-marinho com transparência. O tema escuro tem valores próprios e não segue essas duas tintas.

### Forma e profundidade

- Raios: `sm` 6, `md` 8, `lg` 12, `xl` 18, `2xl` 22 px. Cards usam `rounded-xl`.
- Sombras: `shadow-card` (superfícies) e `shadow-float` (popovers, dock, painéis flutuantes).
- Espaço entre blocos de uma página: 24 px (`gap-6`); dentro de formulários: 20 px (`gap-5`).

### Gráficos

- Série "recebido" `--chart-received` (`#2a78d6`) e "a receber" `--chart-open` (`#eb6834`), validadas para daltonismo e contraste nos dois temas.
- Um eixo só, marcas finas, legenda sempre que houver duas séries, tooltip ao passar o ponteiro, texto nunca na cor da série. Paleta nova passa pelo validador da skill dataviz antes de entrar.

## Componentes

### Primitivos (`src/components/ui`)

alert-dialog, badge, breadcrumb, button, calendar, card, checkbox, command, dialog, dropdown-menu, input, input-otp, label, native-select, popover, select, separator, sheet, sonner, switch, table, tabs, textarea, tooltip. Mais `energy-orb` (esfera animada do assistente) e `metal-prompt-bar`.

Instalados pelo CLI do shadcn (`components.json`, estilo new-york, ícones Lucide). Ajuste um primitivo só quando o ajuste vale para o Console inteiro.

### Padrões do Console (`src/components/console`)

| Componente | Para quê |
| --- | --- |
| `PageHeader`, `SectionTitle`, `EmptyState` | Cabeçalho de página (breadcrumb, título, descrição, ações), título de seção e estado vazio |
| `ListCard`, `FilterChip`, `LinkRow`, `PrimaryCell`, `CompanyCell`, `RowActions`, `ListPagination`, `TablePagination`, `SearchField` | A lista padrão: busca e filtros em cima, tabela, rodapé com paginação |
| `FormSheet`, `useRouteSheet` | Criar ou editar um registro num painel lateral, com abas opcionais |
| `ServerForm`, `SubmitButton`, `FormError`, `FormAlert`, `ConfirmDialog`, `ConfirmAction` | Formulário ligado a server action, envio, erro e confirmação |
| `FormField`, `FormSection` | Rótulo, controle e dica; agrupamento de campos |
| `Fact` | Par rótulo/valor dentro de `<dl>` nos cards de detalhe |
| `MoneyField`, `DateField`, `CompanyField`, `PeopleField`, `MultiSelect`, `TokenChip` | Campos especiais: reais, data civil com calendário, empresa com busca, pessoas, múltipla escolha |
| `AttachmentField`, `FileChip`, `FileRow`, `useStagedUploads`, `DownloadLink` | Anexos com envio em partes e download privado |
| `PersonAvatar`, `AvatarStack`, `CompanyMark` | Pessoas e empresas |
| `CopyButton`, `BackButton` | Copiar com confirmação; voltar com destino padrão |
| `StatusPage`, `ErrorView` | 404, erro inesperado e link inválido |

### Moldura (`src/components/shell`)

- **Dock** (`dock.tsx`): navegação principal, flutuante, com as áreas que a pessoa pode abrir, botão Criar, assistente e menu da conta. Posição escolhida em Aparência; no celular vira a barra de abas (`mobile-tab-bar.tsx`).
- **Assistente:** botão com a esfera de energia; o painel abre ao lado do conteúdo em telas a partir de 1024 px e como diálogo abaixo disso. A esfera só anima enquanto o assistente trabalha.
- `appearance-provider`, `notifications` (Toaster), `workspace-loading`, `support-trigger` (chat de suporte) e `brand`.

## Padrões de tela

- **Lista:** `PageHeader` com a ação principal à direita, depois `ListCard`. Filtros e página ficam na URL; mudar filtro volta à página 1. Paginação sempre no servidor.
- **Lista ou grade:** onde os itens se reconhecem pelo título e pelo ícone (Bookmarks), um seletor Lista/Grade fica à direita da busca. A grade usa cartões com o título cobrindo o cartão inteiro e o menu "…" por cima; o rodapé de paginação é o mesmo. A escolha fica num cookie e é lida no servidor, sem piscar a outra visualização.
- **Detalhe:** breadcrumb, título com situação (`Badge`), ações no cabeçalho; conteúdo principal à esquerda e cards de apoio à direita, uma coluna quando não houver espaço. Dados em `Fact`.
- **Criar e editar:** `FormSheet` à direita. A partir de uma lista, a URL de criação abre o painel sobre a tela (rota interceptada em `@ticket`); acessada direto, vira página. Enquanto envia, o painel não fecha e o botão não repete.
- **Confirmar:** `ConfirmDialog` só para o que é destrutivo ou sai do Console (emitir, enviar, excluir). Diz a consequência e começa em Cancelar.
- **Feedback:** sucesso em toast; erro fica no formulário, com foco no campo. Nada de spinner permanente: a página pública de pagamento atualiza em silêncio.
- **Vazio:** explica quando algo vai aparecer ou oferece a ação; não repete o título.
- **Erro e 404:** `StatusPage`. Dentro do app, embutido na área de conteúdo (o dock continua); fora, tela inteira com a marca. Registro de outra empresa responde igual a registro inexistente.
- **Carregando:** `loading.tsx` por seção com o esqueleto da própria lista.

## Escrita

Segue o manual de voz da Anuntech, níveis 0 e 1 para produto: útil, curto e ligado ao que a pessoa está fazendo.

- Cada texto diz o que acontece, com qual registro e o que a pessoa pode fazer.
- Erros dizem o que não deu certo e o próximo passo, sem "Ops" e sem culpar a pessoa. Evite "Dados inválidos" quando dá para dizer qual dado.
- Sem travessão para ligar frases (use ponto, vírgula ou dois-pontos), sem exclamação, sem contraste encenado ("não é X, é Y"). Travessão só em dado: célula vazia, intervalo, título gerado, texto jurídico.
- "O Console" (ou "o Console da Anuntech"), sempre no masculino. "Anuntech Console" só no título da aba. Cobrança periódica é "recorrência"; "assinatura" é só a de contrato.
- E-mails automáticos começam pelo fato ("A fatura de … vence hoje."), terminam na ação e assinam "Anuntech".
- Texto jurídico (modelos de contrato, cláusulas, declarações de assinatura) não passa por revisão de estilo; precisa de revisão humana.
- O assistente recebe as mesmas regras no prompt ("Como escrever").

## Acessibilidade

Referência WCAG 2.2 AA e padrões da WAI-ARIA APG.

- Um `h1` por tela, `main#main-content` com atalho "Ir para o conteúdo", títulos de aba no formato `%s | Anuntech Console`.
- Todo campo tem rótulo associado; dicas e erros por `aria-describedby`; foco no primeiro campo inválido.
- Botão só com ícone tem nome acessível. Ícone decorativo tem `aria-hidden`.
- Diálogos e painéis prendem o foco, fecham com Escape (exceto durante envio) e devolvem o foco a quem abriu.
- Situação nunca só por cor. Foco sempre visível. Movimento reduzido e cores forçadas respeitados.
- Tabelas largas rolam no próprio contêiner; a página não ganha rolagem horizontal em 320 px.
- Alvos de toque de pelo menos 44 px no dock e na barra do celular.

## Referências

- shadcn.io (blocos e componentes, via MCP `shadcnio`) e ui.shadcn.com.
- `anuntech/design-system`: voz, composição, logotipo e ilustrações. Os avatares vêm de lá; a origem de cada arquivo está em `docs/avatar-sources.json`.
- `/dev/preview` em desenvolvimento mostra os componentes com dados fictícios.
