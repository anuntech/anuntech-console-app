# Design do Console

A base visual, os componentes e os padrões de tela do Console. Toda tela nova ou refeita segue este documento. A identidade vem do repositório da marca (`anuntech-brand`: tokens, Geist, logotipo e guia em `guide/index.html`); aqui está como ela se aplica ao produto. Desde 21/10/2026: logotipo "do bruto ao produto" (círculo metade liso, metade pixel; "anun" em Geist e "tech" em Geist Pixel), interface com base preta, branca e cinza e o violeta da marca no botão principal, na seleção, em link, foco e na vinheta de carregamento.

## Como trabalhamos

1. **Design primeiro.** Cada assunto é refeito inteiro (lista, detalhe, criação, edição, estados), não tela por tela solta.
2. **shadcn como base.** Primitivos em `src/components/ui` (shadcn new-york sobre Radix e Base UI) e blocos do shadcn.io, adaptados à marca. Nenhum dado de demonstração dos blocos vai para produção.
3. **Padrões antes de exceções.** Se uma tela precisa de algo que o catálogo abaixo não tem, o novo padrão entra em `src/components/console` e passa a valer para todas.
4. **Movimento com propósito.** Resposta imediata ao toque, transições interrompíveis, respeito a movimento reduzido (referência: skill apple-design).
5. **Conferir claro e escuro, desktop e 320 px** antes de dar uma tela por pronta.

## Fundação

- **Tailwind CSS v4** com tokens em CSS. `src/app/globals.css` declara as cores da marca e o tema escuro; `src/app/shadcn.css` mapeia essas variáveis para os nomes do Tailwind (`bg-primary`, `text-muted-foreground`, `border-border`…).
- **Camadas:** `theme, base, legacy, components, utilities`. O CSS antigo vive em `@layer legacy`: fica acima do preflight (telas antigas não mudam) e abaixo das utilities (componentes shadcn saem como desenhados). CSS Modules só restam em `components/shell` (dock e vinheta da marca).
- **Margens:** `p`, `h1` e `h2` não têm margem própria (o CSS antigo dava 16, 8 e 12 px e isso vazava para as telas novas). Espaçamento sempre por classe (`mt-*`, `gap-*`).
- **Tema escuro** por `data-theme="dark"` no `<html>`, ou `data-theme="system"` seguindo o sistema. Nunca a classe `.dark`. A variante `dark:` do Tailwind já entende os dois.
- Preferências de tema e posição do dock ficam em cookie e são aplicadas no HTML inicial, sem piscar.

## Marca e tokens

Os tokens não são escritos aqui: `src/app/brand/` (`tokens.css`, `tailwind.css`, `fonts.css`) e `public/brand/fonts` e `public/brand/logo` vêm do repositório da marca por `npm run sync -- console` lá. Para mudar uma cor, mude a marca. `globals.css` guarda só apelidos que o CSS antigo ainda lê (`--settings-sidebar`, `--yellow`, `--radius`, `--shadow-popover`).

### Tipografia

- **Geist** (variável) em tudo e **Geist Mono** em código e identificadores, servidas de `public/brand/fonts` (licença OFL ao lado). Fallback: fontes do sistema.
- Texto base 14 px. Escala da marca como utilitários: `text-caption` 12, `text-label` 13, `text-body-sm` 14, `text-body` 16, `text-title-sm` 18, `text-title` 22, `text-title-lg` 28, `text-display-sm` 36, `text-display` 48 (cada um já traz entrelinha, peso e espaçamento).
- Título de página: `text-title-lg` (28 px, peso 500, tracking negativo). Títulos em peso 500, nunca 700.
- Números que se comparam (valores, datas em tabela) usam `tabular-nums`.
- Texto nunca abaixo de 12 px (`text-caption`) em rótulo ou etiqueta; 11 px só em código para copiar (Pix, linha digitável).
- `cn` vem de `@/lib/cn` (`src/lib/cn.ts`), onde a escala acima está registrada como tamanho de fonte; nunca do pacote `"cn"` direto. Sem isso, `cn("text-title text-foreground")` lia `text-title` como cor e o descartava. Não importe de `cn/config` nem crie outro `cn`.

### Cores

| Token | Claro | Escuro | Uso |
| --- | --- | --- | --- |
| `--background` / `--card` | `#ffffff` / `#ffffff` | `#0d0d0d` / `#171717` | Fundo plano e superfícies |
| `--foreground` | `#0d0d0d` | `#ececec` | Texto principal |
| `--primary` | `#6e56ff` | `#6e56ff` | Ação principal: botão pílula violeta com texto branco |
| `--secondary` | `#f3f3f3` | `#212121` | Fundos neutros e hover |
| `--accent` | `#f3f0ff` | `#1c1640` | Item selecionado (dock, menus, listas), com texto `--accent-foreground` violeta |
| `--muted-foreground` | `#6b6b6b` | `#a3a3a3` | Texto de apoio |
| `--border` | `#e5e5e5` | `#2b2b2b` | Divisores e bordas de superfície |
| `--field-border` | `#d4d4d4` | `#383838` | Borda dos campos (`border-input`) |
| `--ring` / `--link` | `#5b43f0` | `#a99bff` | Foco e link, no violeta da marca |
| `--brand` | `#6e56ff` | `#6e56ff` | Violeta do logotipo: símbolo, ícone, capas |

Estados, sempre com texto além da cor: `success`, `warning` e `destructive`, cada um com `-soft` (fundo) e `-edge` (borda). Ex.: `bg-warning-soft border-warning-edge text-warning`. Situações que esperam a equipe são neutras (ponto preto, ou azul quando alguém está trabalhando). Ícones de indicador só ganham cor quando pedem atenção. `npm run check` na marca confere todos os pares pela fórmula WCAG.

### Forma e profundidade

- Raios: `xs` 4, `sm` 6, `md` 8, `lg` 12, `xl` 16, `2xl` 24 px e `pill`. Botões, abas, etiquetas e o dock em pílula; campos `rounded-lg`; cards `rounded-xl`; diálogos `rounded-2xl`.
- Sem sombra em superfície: profundidade por borda de 1 px. `shadow-float` só no que flutua (menus, popovers, diálogos, dock); `shadow-halo` no campo do assistente.
- Espaço entre blocos de uma página: 24 px (`gap-6`); dentro de formulários: 20 px (`gap-5`).
- Card de apoio (a coluna lateral de um detalhe): `<Card variant="quiet">`, sem borda e com fundo suave, para o card principal mandar.
- Sobreposições de diálogo e painel: `bg-overlay` (token `--overlay`) com um desfoque de 2 px atrás.

### Ilustrações

As ilustrações da marca (metade lisa, metade pixel) vêm de `components/ui/brand-art.tsx` (`BrandArt`), desenhadas com a mesma geometria do repositório da marca (`scripts/art.mjs`), mas pintadas com os tokens: sem fundo próprio, cinzas que escurecem no tema escuro e o violeta igual nos dois. Os arquivos em `public/brand/art/` ficam só como referência (têm fundo branco ou creme e não servem no escuro).

| Arte | Onde |
| --- | --- |
| `chamados` (tíquete) | Lista de chamados vazia, conversa sem mensagens, tela de erro (`ErrorView`) |
| `faturas` (documento) | Faturas, envios, orçamentos e contratos vazios |
| `projetos` (pasta) | Projetos, jornadas, bookmarks, produtos e empresas vazios (a marca não tem arte de empresa) |
| `busca` (lupa) | Qualquer lista com busca ou filtro sem resultado, e o 404 |
| `esfera` | Painel lateral do acesso (entrar, verificar acesso, acesso pendente) |
| `planilha` (planilha vira sistema) | Topo da Ajuda |
| `blocos` | Topo de Como trabalhamos e o aviso de primeiro uso do painel (sem nenhuma empresa) |

- A arte é sempre decorativa (`aria-hidden`); o texto ao lado diz o que falta e o que fazer.
- Textura e luz só junto da arte, nunca atrás de dados: `pixel-field` (a grade de pixels do logotipo, apagando-se) e `brand-glow` (luz violeta suave, mais forte no escuro). No máximo três lugares no app: acesso, Ajuda e telas de erro.
- O padrão `padrao.svg` (84 KB) não entra no app; a textura é o `pixel-field`, em CSS.
- Dentro de um card, o vazio pequeno continua com o ícone (`EmptyState icon`, num quadrado cinza neutro, como o de `StatusPage`); o painel (Visão geral) não ganha arte, exceto o aviso de primeiro uso (`blocos`).
- Formulário não ganha arte ao lado: a tela é da tarefa.

### Movimento

Uma curva (`--anu-motion-ease`, `ease-brand`) e três tempos: rápido 120 ms (`--anu-motion-fast`), base 200 ms e lento 320 ms. Todo `transition-*` do Tailwind já sai na curva e no tempo rápido (`shadcn.css`). Só `transform` e `opacity` se movem (`filter` raramente); movimento reduzido mostra tudo parado, no lugar final.

| Utilitário ou componente | Para quê |
| --- | --- |
| `reveal` (+ `[--i:N]`) | Chegada: sobe 6 px e aparece em 200 ms; `--i` atrasa 40 ms por passo. O `PageHeader` já usa. Passos com `--i` só em telas raras (acesso, pagamento, vazios, Ajuda) |
| `reveal-fade` | Só aparece, sem subir: para o que é medido (`ListCard fill`, o quadro) e para o corpo de detalhes e formulários, sem atraso (lista → detalhe acontece dezenas de vezes por dia). O `ListCard` já usa, 40 ms depois do cabeçalho |
| `stagger` | Os filhos de um bloco que monta uma vez chegam um após o outro (25 ms, até 175 ms). O `CardGrid` faz isso sozinho no primeiro carregamento |
| `press` | Cartão ou bloco inteiro clicável: encolhe para 0,985 ao apertar, sem encolher quando o aperto é no "…" de dentro. O `GridCard` já usa |
| `LinkPending` | Dentro de um `Link prefetch={false}`: um filete violeta cresce sob o link se a página demora mais de 120 ms (`PrimaryCell` e `GridCard` já usam) |
| `AnimatedValue` | Um número que muda na tela entra deslizando; no carregamento fica parado. Nunca conta de 0 até o valor |
| `BrandArt` | Na chegada, a metade lisa aparece e as colunas de pixels se encaixam da esquerda para a direita, uma vez |

- Nada se move na navegação comum: barra de abas, linhas de tabela, números financeiros, paleta de comandos e atalhos de teclado. A exceção é o ícone do dock no computador (`shell/dock-icons.tsx`, biblioteca `motion`): o mesmo desenho do Lucide toca uma animação curta uma vez quando o mouse ou o teclado chega nele, no estilo do lucide-animated, e nunca com movimento reduzido. A troca de página em si não anima. Sem brilho passando, sem levantar cartão no hover, sem animação em loop na arte.
- Conversa (chamado e assistente): só o que chega com a tela aberta entra subindo; o que já estava ao carregar, ao reabrir o painel do assistente ou ao abrir uma conversa do histórico fica parado. Campo preenchido pelo assistente: um contorno violeta que se fecha sobre o campo em 600 ms (`assistant-filled`).
- Gráfico do painel: as barras crescem em 200 ms, 25 ms entre meses, até 175 ms.
- Única curva com rebote: o selo de pagamento confirmado ao vivo em `/pagar` (`PaymentArrival`, `cubic-bezier(0.34,1.36,0.64,1)`), porque é o único momento de celebração. Nenhum outro lugar usa.
- Painéis laterais entram em 320 ms e saem em 200 ms; diálogos entram em 200 ms e saem em 150 ms. A aba ativa (`Tabs`) tem um indicador que desliza entre as abas (só `transform`; a largura muda de uma vez).
- Nas rotas pesadas, `BrandLoadingHold` marca `data-brand-hold` e as chegadas esperam a vinheta sumir.
- Cada animação com atraso se cancela sozinha com movimento reduzido (o reset global encurta a duração, mas não o atraso).

### Gráficos

- Série "recebido" `--chart-received` (violeta da marca, `#6E56FF`; `#8B78FF` no escuro) e "a receber" `--chart-open` (`#eb6834`; `#d95926` no escuro), vindas dos tokens da marca e validadas para daltonismo e contraste nos dois temas.
- Um eixo só, marcas finas, legenda sempre que houver duas séries, tooltip ao passar o ponteiro, texto nunca na cor da série. Paleta nova passa pelo validador da skill dataviz antes de entrar.

## Componentes

### Primitivos (`src/components/ui`)

accordion (perguntas frequentes), alert-dialog, badge, breadcrumb, button, calendar, card (com `variant="quiet"` para cards de apoio), checkbox, command, dialog, dropdown-menu, input, input-otp, label, native-select, popover, select, separator, sheet, sonner, switch, table, tabs (com indicador que desliza), textarea, tooltip. Mais `brand-art` (as ilustrações da marca, ver [Ilustrações](#ilustrações)), `brand-mark` (o símbolo da marca desenhado peça por peça, para animar; as formas vêm da marca em `brand-mark-shape.ts`), `ai-orb` (o assistente, sobre o `brand-mark`; os estados e as frases ficam em `ai-orb-states.ts`) e `metal-prompt-bar` (com `dictation`, mostra o microfone).

Instalados pelo CLI do shadcn (`components.json`, estilo new-york, ícones Lucide). Ajuste um primitivo só quando o ajuste vale para o Console inteiro.

### Padrões do Console (`src/components/console`)

| Componente | Para quê |
| --- | --- |
| `PageHeader`, `SectionTitle`, `EmptyState` | Cabeçalho de página (breadcrumb só com os pais: um último item sem `href` é a própria página e não é desenhado; título; `meta`, até três fatos curtos sob o título, sem os vazios; descrição; ações; `actionsInline` mantém ações só de ícone, como o "…", ao lado do título no celular), título de seção e estado vazio (`art` com a ilustração da área; `icon` para o vazio pequeno dentro de um card) |
| `ListCard`, `FilterChip`, `LinkRow`, `PrimaryCell`, `CompanyCell`, `RowActions`, `ListPagination`, `TablePagination`, `SearchField` | A lista padrão: busca, filtros e ações da página em cima, tabela, rodapé com paginação; com `fill`, termina logo acima do dock |
| `CardGrid`, `GridCard`, `CardTile`, `ViewToggle`, `useListLayout` | A mesma lista em cartões, e o seletor Lista/Grade que lembra a escolha |
| `PixelProgress` | Progresso em passos como a metade em pixels do logotipo: um quadrado por passo, violeta quando feito (implantação, jornada) |
| `LinkPending`, `AnimatedValue` (`motion.tsx`) | Retorno de link esperando o servidor e número que muda na tela (ver [Movimento](#movimento)) |
| `useFillViewport` | Altura que leva um elemento até 12 px acima do dock (ou da borda da janela), medida no lugar; usada pelo `ListCard` e pelo quadro de tarefas |
| `FormSheet`, `useRouteSheet` | Criar ou editar um registro num painel lateral, com abas opcionais |
| `ServerForm`, `SubmitButton`, `FormError`, `FormAlert`, `ConfirmDialog`, `ConfirmAction` | Formulário ligado a server action, envio, erro e confirmação |
| `FormField`, `FormSection` | Rótulo, controle e dica; agrupamento de campos |
| `Fact` | Par rótulo/valor dentro de `<dl>` nos cards de detalhe; valor vazio (`null`, `undefined`, `false`, `""`) não desenha nada |
| `Disclosure` | "Ver detalhes": o que a pessoa raramente precisa (hash, ids, datas de registro, dados do provedor) num `<details>` nativo, sem movimento |
| `MoneyField`, `DateField`, `CompanyField`, `PeopleField`, `MultiSelect`, `TokenChip` | Campos especiais: reais, data civil com calendário, empresa com busca, pessoas, múltipla escolha |
| `AttachmentField`, `FileChip`, `FileRow`, `useStagedUploads`, `DownloadLink` | Anexos com envio em partes e download privado |
| `ContractFieldsPanel` (contratos) | Campos `{{...}}` de um rascunho no topo da página: trecho, sugestão, aplicar e salvar sem descer até o texto |
| `DictationButton`, `useDictation` | Ditado num campo de texto: Falar, Parar e Cancelar, tempo de gravação e o texto entra onde estava o cursor, sem enviar nada |
| `PersonAvatar`, `AvatarStack`, `CompanyMark` | Pessoas e empresas. Nome de empresa na tela: `companyDisplayName(name, document)` (`lib/companies/display-name.ts`); as iniciais ignoram números e "de", "da" |
| `ProductIcon` | O rosto de um produto ou serviço: o ícone do item do catálogo num quadrado de cantos 22% (fundo branco também no escuro) ou as iniciais num dos tons das etiquetas de projeto (violeta suave, cinza ou contorno), sempre o mesmo para o mesmo nome. Decorativo; o nome ao lado diz o que é |
| `CopyButton`, `BackButton` | Copiar com confirmação; voltar com destino padrão |
| `HelpLink` | Link curto para o artigo da Ajuda sobre o que está na tela ("Como pagar"), no fluxo do texto; a ajuda não tem botão próprio |
| `StatusPage`, `ErrorView` | 404, erro inesperado e link inválido; com `art`, a ilustração sobre a grade de pixels |

### Moldura (`src/components/shell`)

- **Dock** (`dock.tsx`): navegação principal, flutuante, com as áreas que a pessoa pode abrir, botão Criar, assistente e menu da conta. Posição escolhida em Aparência; no celular vira a barra de abas (`mobile-tab-bar.tsx`). Vidro de verdade (72 % do card, desfoque 20 px, filete claro no alto), encolhe ao apertar, dicas instantâneas depois da primeira e, embaixo, a página se apaga suavemente onde passa sob o dock. Na barra do celular, a aba ativa ganha uma pílula atrás do ícone. Transparência reduzida e contraste alto deixam os dois opacos.
- **Assistente:** botão com o símbolo da marca (`ai-orb`); o painel abre ao lado do conteúdo em telas a partir de 1024 px e como diálogo abaixo disso. O símbolo fica parado em repouso (digitar não conta como atividade) e anima só enquanto o assistente trabalha: pensando, consultando o Console e lendo o que encontrou fazem a luz girar pelos pixels; escrevendo a resposta acende os pixels um a um, como texto sendo digitado, com o cursor na cor do texto; ouvindo o microfone passa uma onda pelas colunas. Os resultados têm cor própria e o texto ao lado diz o que houve: terminou é o símbolo violeta parado, erro o símbolo vermelho parado, cartão esperando confirmação a onda em âmbar, que para depois de 5 s. Erro e terminou ficam até a pessoa ver o painel e somem 4 s depois; o âmbar fica até o cartão ser decidido ou vencer (15 min). A resposta aparece enquanto é escrita, e as etiquetas do que ele consultou entram conforme as ferramentas rodam; o painel segue o texto até a pessoa rolar para cima. Se a resposta não termina, o texto parcial sai e fica só o aviso em vermelho. O botão descreve o estado para leitor de tela (`aria-describedby`); no celular, a linha "Perguntar ao assistente" mostra o estado embaixo do nome. A cor vem dos tokens (`--primary`, `--warning`, `--destructive`); na linha azul do celular, `--primary-foreground`. Movimento reduzido mostra o logotipo parado.
- `appearance-provider`, `notifications` (Toaster), `workspace-loading`, `support-trigger` (chat de suporte) e `brand`.

## Padrões de tela

- **Um fato, um lugar:** cada informação aparece uma vez, onde ajuda a decidir ou agir. O nome do registro só no título; a situação num `Badge` (no `meta` do detalhe ou na coluna da lista), nunca também como Fact, texto ou ícone; a empresa dona do registro uma vez, no `meta`, como link; número, valor e recorrência num lugar só. Quando a página mostra o próprio documento (proposta, texto do contrato), o que está nele não se repete fora.
- **Nome de empresa:** o banco guarda só a razão social (`name`). Toda consulta que leva o nome à tela leva junto `companies.document` (`companyDocument` nas linhas, `document` nos filtros), para o MEI ser reconhecido. Títulos, listas, links e frases usam o nome de tela (`companyDisplayName`: sem a raiz do CNPJ do MEI, sem LTDA/ME/EPP/EIRELI/S.A., sem a caixa alta do registro: "46.301.732 ALINE DE SOUZA BEZERRA" vira "Aline de Souza Bezerra"). Razão social completa e CNPJ ficam onde a lei ou o documento pede: card Cadastro, contrato, orçamento, PDF, dados do tomador da fatura, e-mail de cobrança. Na sessão do cliente a empresa dele não é nomeada (ele é a empresa), salvo quando tem acesso a mais de uma. Lista dentro de uma empresa (filtrada por ela ou na sessão do cliente) não tem coluna Empresa.
- **Situação e etiquetas:** no máximo uma etiqueta de situação e uma de atenção por linha ou cartão. O estado normal do que costuma estar ativo (empresa ativa, produto ativo, membro que já entrou, prioridade Normal) não ganha etiqueta; só a exceção aparece. Lista filtrada por uma situação não a repete nas linhas. Documentos (fatura, orçamento, contrato, chamado) sempre mostram a situação.
- **Vazios dentro de um detalhe:** o campo sem valor some (nada de "—" ou "Não informado"). Se a falta bloqueia algo, vira aviso no lugar com o link que corrige. Em tabela, "—" só em coluna quase sempre preenchida.
- **Detalhes sob demanda:** dados técnicos e de registro (hash, ids, modelo usado, "Criada em", quem abriu) ficam em `Disclosure`; listas longas dentro de um card mostram 5 e "Ver todos (n)"; ação secundária vai para o "…". Nunca esconda o que a pessoa precisa para agir (valor, vencimento, Pix, assinar, aceitar, aviso de bloqueio).
- **Lista:** cabeçalho só com título e contagem (sem descrição), depois `ListCard fill` com busca, filtros e as ações da página na mesma linha, ações à direita. O card termina 12 px acima do dock e as linhas rolam dentro dele, sob os nomes das colunas; a página não rola. Lista curta não estica o card. Em telas muito baixas o card fica com 280 px e a página rola, sem esconder o fim atrás do dock. No celular os botões de ação ficam só com o ícone (o nome continua para leitores de tela) e métricas vão em duas colunas. Filtros e página ficam na URL; mudar filtro volta à página 1. Paginação sempre no servidor. O rodapé de paginação só aparece quando há mais de 10 itens (o menor tamanho de página): abaixo disso a contagem ao lado do título já diz o total.
- **Quadro:** mesma lógica do projeto: título e situação numa linha, filtros com "Nova tarefa" e "…" na linha seguinte, colunas até 12 px acima do dock.
- **Lista ou grade:** Bookmarks, Projetos, Contratos, Produtos, Empresas e Jornadas têm o seletor Lista/Grade (`ViewToggle`, no `layout` do `ListCard`), junto das ações à direita. Abrem em grade; a escolha fica num cookie por área (`lib/list-layout.ts`) e é lida no servidor, sem piscar a outra visualização. Cada cartão (`GridCard`) tem ícone ou iniciais, título que cobre o cartão inteiro, o mesmo menu "…" da linha e um rodapé com a situação e uma data; o rodapé de paginação é o mesmo da lista. Produtos, no cliente, é um lançador: ícone grande, nome, uma linha e a dica do clique ("Abrir ↗", "Ver detalhes"), sem menu e sem valor, situação só quando não está ativo; no celular os cartões viram linhas divididas (`CardGrid` aceita `className`).
- **Ajuda:** `/ajuda` (busca, vídeos, assuntos, perguntas frequentes) e `/ajuda/<artigo>` (vídeo, seções com passos numerados, observações, perguntas frequentes, "Ir para" a tela, relacionados). Um artigo aberto no meio de um formulário vem numa Sheet por cima (`HelpArticleSheet`), com os links em nova aba, porque o formulário não guarda rascunho. O vídeo usa a capa da própria página (título e duração), não um quadro do vídeo.
- **Guiar sem prometer:** textos de orientação vivem no ponto de uso (formulário de chamado, chamado aguardando, quadro, orçamento aceito, contrato assinado) e em Como trabalhamos. Número de prazo nunca fica escrito em componente ou texto: vem das condições da empresa (`lib/service-terms`). Sem condições, só o horário.
- **Visão geral:** widgets em `Card` compacto (`gap-4 py-5`), só com título e "Ver todos" (nome acessível "Ver todos: chamados", começando pelo texto visível); sem frase de descrição. No cliente não há cartões de números acima dos widgets: cada widget é o único lugar do que lista (a fatura vencida fica em "A pagar", com a etiqueta "Vencida"; o banco de horas avisa no próprio card). "Precisa de atenção" mostra só o que nenhum widget já mostra; na equipe, até 5 itens e "Ver todos (n)", com "Tudo em dia" quando vazio; no cliente, some quando vazio. Widget sem nada a dizer sai e os outros fecham o espaço.
- **App do cliente:** em `/apps/[id]`, uma barra mínima (voltar para Produtos, nome do produto, empresa e Recarregar, só o ícone no celular) e o app num iframe que desce até 12 px acima do dock. Enquanto o passe chega, "Abrindo …" no lugar do app; falhou, o motivo com Tentar de novo. Quem não pode abrir vê `StatusPage` com o motivo.
- **Detalhe:** breadcrumb com os pais (nunca o próprio registro), título, `meta` com situação (`Badge`), empresa e um fato-chave, ações no cabeçalho (só o "…" no celular: `actionsInline`); conteúdo principal à esquerda e cards de apoio à direita, uma coluna quando não houver espaço; a coluna lateral some quando não tem nada. Dados em `Fact`. Um `h1` só: o documento mostrado na página (proposta) usa `h2`. O registro do documento enviado (data de envio, versão, hash, e-mail e IP de quem respondeu) fica no "Ver detalhes" do card "Resposta" (orçamento) ou "Assinaturas" (contrato), que só aparece depois do envio.
- **Criar e editar:** `FormSheet` à direita. A partir de uma lista, a URL de criação abre o painel sobre a tela (rota interceptada em `@ticket`); acessada direto, vira página. Enquanto envia, o painel não fecha e o botão não repete.
- **Confirmar:** `ConfirmDialog` só para o que é destrutivo ou sai do Console (emitir, enviar, excluir). Diz a consequência e começa em Cancelar. Uma escolha que acompanha a confirmação ("Pausar também a cobrança recorrente") entra por `extra`, ligada ao formulário pelo atributo `form`.
- **Próximos passos preparados:** depois de um marco (orçamento aceito, contrato assinado), um cartão lista cada passo com o que já existe (ícone de concluído e o nome) ou o atalho que abre o formulário preenchido. Nada é criado sem clique; o que o cliente passa a ver (projeto) pede confirmação com a prévia.
- **Avisar antes de falhar:** quando o Console sabe que uma ação futura vai falhar (emissão sem endereço), o aviso aparece no lugar em que a pessoa já está, com o link que corrige ("Corrigir o cadastro"), em vez de esperar o erro.
- **Feedback:** sucesso em toast; erro fica no formulário, com foco no campo. Nada de spinner permanente: a página pública de pagamento atualiza em silêncio.
- **Vazio:** explica quando algo vai aparecer ou oferece a ação; não repete o título. Vazio de página leva a ilustração da área (`EmptyState art`); "nada encontrado" com busca ou filtro leva `busca` e "Limpar filtros". A lista vazia esconde o rodapé de paginação e o seletor Lista/Grade (`ListCard empty`); o botão do vazio tem o mesmo nome do botão da barra.
- **Erro e 404:** `StatusPage`. Dentro do app, embutido na área de conteúdo (o dock continua); fora, tela inteira com a marca. Registro de outra empresa responde igual a registro inexistente.
- **Carregando:** `loading.tsx` por seção com o esqueleto da própria lista (`shell/workspace-loading.tsx`: título, contagem e um card com barra e linhas), que só aparece depois de 150 ms; resposta rápida não pisca esqueleto.
- **Vinheta da marca:** `BrandLoading` (`components/shell/brand-loading`) só em dois momentos: tela cheia no fundo do tema ao confirmar o acesso (login e segunda etapa) e dentro da página nas rotas pesadas (painel, financeiro, jornadas), no fundo do Console, centralizada na área visível acima do dock. Os dois usam o `brand-mark` em violeta: no acesso confirmado, o símbolo e o nome se montam (os pixels chegam e se encaixam, a metade lisa se forma); nas rotas pesadas, uma onda de luz passa pelas colunas de pixels. O `layout.tsx` das rotas pesadas (`BrandLoadingHold`) segura a vinheta por no mínimo 1,2 s quando ela chegou a aparecer. No tema escuro, o símbolo claro; com movimento reduzido, parado. Nunca na navegação comum.
- **PDFs (orçamento e contrato):** `lib/pdf-brand.ts` dá a marca: logotipo preto no topo com um filete, Geist (sem ligaduras, para o texto copiado sair igual), cinzas da marca, situação do documento em violeta, blocos em cinza claro com raio 10 e o total em preto. O hash vai em Geist Mono.
- **Atividade (Minha conta):** `ui/activity-heatmap.tsx` (Activity Heatmap de kuratlielia, 21st.dev, adaptado aos tokens e ao pt-BR) mostra um quadrado por dia dos últimos 12 meses, mais escuro nos dias com mais interações. Conta o que já está gravado (`lib/account/activity.ts`): ações no registro de auditoria, mensagens em chamados e perguntas ao assistente. Só a própria pessoa vê.
- **E-mail com visual (fatura):** fundo `#f6f6f6`, cartão branco com borda e raio 16, logotipo horizontal em PNG (`/brand/logo/lockup-preto.png`), rótulo em violeta, título peso 500, botão em pílula violeta e link `#5b43f0`. Fonte Geist com Arial de reserva. Os demais e-mails são texto puro.

## Escrita

Segue o manual de voz da Anuntech, níveis 0 e 1 para produto: útil, curto e ligado ao que a pessoa está fazendo.

- Cada texto diz o que acontece, com qual registro e o que a pessoa pode fazer.
- Corte antes de explicar: subtítulo de card só com regra ou consequência ("Sem login: quem tem o endereço vê a fatura e paga."); se reformula o título ("Conversa" e "Mensagens e arquivos trocados neste chamado."), sai. Rótulo nomeia o campo, não repete o valor.
- Botão é verbo + objeto ("Cadastrar endereço", "Liberar acesso"). Aviso começa pelo fato ("Falta o endereço de cobrança.") e termina na consequência ou na ação.
- Nome de empresa em frase vem no nome de tela, nunca em caixa alta; caixa alta só onde é o registro oficial.
- Erros dizem o que não deu certo e o próximo passo, sem "Ops" e sem culpar a pessoa. Evite "Dados inválidos" quando dá para dizer qual dado.
- Sem travessão para ligar frases (use ponto, vírgula ou dois-pontos), sem exclamação, sem contraste encenado ("não é X, é Y"). Travessão só em dado: célula vazia, intervalo, título gerado, texto jurídico.
- "O Console" (ou "o Console da Anuntech"), sempre no masculino. "Anuntech Console" só no título da aba. Cobrança periódica é "recorrência"; "assinatura" é só a de contrato.
- E-mails automáticos começam pelo fato ("A fatura de … vence hoje."), terminam na ação e assinam "Anuntech".
- Texto jurídico (modelos de contrato, cláusulas, declarações de assinatura) não passa por revisão de estilo; precisa de revisão humana.
- O assistente recebe as mesmas regras no prompt ("Como escrever").
- Ditado: o botão diz a ação ("Falar", "Parar", "Transcrevendo…"); durante a gravação aparece "O áudio vai para um serviço de transcrição e não fica guardado."; no fim, "Texto inserido. Revise antes de enviar.".

## Acessibilidade

Referência WCAG 2.2 AA e padrões da WAI-ARIA APG.

- Um `h1` por tela, `main#main-content` com atalho "Ir para o conteúdo", títulos de aba no formato `%s | Anuntech Console`.
- Todo campo tem rótulo associado; dicas e erros por `aria-describedby`; foco no primeiro campo inválido.
- Botão só com ícone tem nome acessível. Ícone decorativo tem `aria-hidden`.
- Diálogos e painéis prendem o foco, fecham com Escape (exceto durante envio) e devolvem o foco a quem abriu.
- Situação nunca só por cor. Foco sempre visível. Movimento reduzido e cores forçadas respeitados.
- Ditado: o nome do botão muda com a fase (sem `aria-pressed`), uma região `aria-live` por campo anuncia cada mudança uma vez, o cronômetro fica fora dela, Escape cancela a gravação e o ponto vermelho só pulsa com movimento liberado.
- Tabelas largas rolam no próprio contêiner; a página não ganha rolagem horizontal em 320 px.
- Alvos de toque de pelo menos 44 px no dock e na barra do celular.

## Referências

- shadcn.io (blocos e componentes, via MCP `shadcnio`) e ui.shadcn.com.
- `anuntech-brand`: tokens, fontes, logotipo e o guia da marca. Avatares: a origem de cada arquivo está em `docs/avatar-sources.json`.
- Telas com dados fictícios para revisar o visual: `node --env-file-if-exists=.env.local scripts/design-fixtures.mjs` cria o banco local `console_design` (só no Postgres desta máquina), com ids estáveis entre execuções (`.design-ids.json`), a sessão da equipe em `.design-session` e a de uma Administradora de cliente em `.design-session-client`; `scripts/app-shots.mjs` da marca fotografa em claro, escuro e celular.
- `/dev/preview` em desenvolvimento mostra os componentes com dados fictícios.
