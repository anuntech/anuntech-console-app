# Design system do Console

Revisão de 19/09/2026. Este documento registra a base visual, as referências e o inventário de interfaces do Console. A validação visual e funcional fica registrada separadamente; a existência de um componente não significa que seu fluxo já foi verificado no navegador.

## Direção visual

O Console mantém a identidade Anuntech: tipografia Sofia, azul institucional e azul-marinho para texto. O plano de fundo claro separa a área de trabalho das superfícies brancas. Bordas discretas, sombras suaves e espaços regulares organizam páginas com muita informação sem transformar toda informação em destaque.

A ação principal de cada tela aparece no cabeçalho ou ao final do formulário. Ações secundárias usam botão neutro; ações destrutivas usam contorno e texto semântico. Estados financeiros sempre têm rótulo escrito, além da cor. Ícones Lucide têm o mesmo tratamento e são decorativos quando o texto já explica a ação.

O objetivo é manter uma linguagem única entre a navegação administrativa, as áreas dos clientes, o acesso e as páginas públicas. A apresentação não muda permissões, datas, valores, fluxos bancários, contratos ou regras de envio. Os textos usam “o Console” de forma consistente, inclusive no aviso de chamado e no metadado do PDF.

## Fundação e tokens

A fonte única dos tokens é `src/app/globals.css`. Novas telas devem usar tokens semânticos em vez de repetir valores de marca. Os aliases anteriores continuam disponíveis para compatibilidade durante a evolução dos componentes.

| Uso                        | Token                                                       | Valor de referência |
| -------------------------- | ----------------------------------------------------------- | ------------------- |
| Fundo da aplicação         | `--background`                                              | `#f5f7fb`           |
| Texto principal            | `--foreground`                                              | `#011e41`           |
| Superfície                 | `--card`                                                    | `#ffffff`           |
| Ação principal             | `--primary`                                                 | `#1a428a`           |
| Texto sobre ação principal | `--primary-foreground`                                      | `#ffffff`           |
| Fundo secundário           | `--secondary`                                               | `#eef2f8`           |
| Texto de apoio             | `--muted-foreground`                                        | `#5d6c81`           |
| Destaque selecionado       | `--accent`                                                  | `#edf2fc`           |
| Bordas                     | `--border`                                                  | `#e0e6ef`           |
| Borda de entrada           | `--input`                                                   | `#ccd6e4`           |
| Foco                       | `--ring`                                                    | `#557ac0`           |
| Confirmação                | `--success`, `--success-bg`, `--success-border`             | Verde semântico     |
| Atenção/pendência          | `--warning`, `--warning-bg`, `--warning-border`             | Âmbar semântico     |
| Falha/ação destrutiva      | `--destructive`, `--destructive-bg`, `--destructive-border` | Vermelho semântico  |

- Sofia regular, semibold e bold são servidas localmente em `public/brand`. Arial e sans-serif são fallback.
- Escala de espaços: 4, 8, 12, 16, 20, 24 e 32 px, disponível em `--space-*`.
- Raios: `--radius-sm` 6 px, `--radius-md` 8 px, `--radius-lg` 12 px, `--radius-xl` 18 px.
- Sombra de superfície: `--shadow-sm`; menus e popovers: `--shadow-popover`.
- Valores e datas usam algarismos tabulares quando a comparação entre linhas importa.
- A tipografia do conteúdo parte de 14 px. Texto de apoio é menor e deve continuar legível; não usar cinza de placeholder para conteúdo relevante.

## Componentes e responsabilidades

| Componente/padrão    | Localização                               | Responsabilidade                                            |
| -------------------- | ----------------------------------------- | ----------------------------------------------------------- |
| Navegação            | `src/components/sidebar.tsx`              | Grupos, item ativo, usuário e navegação móvel               |
| Sheet                | `src/components/ui/sheet.tsx`             | Menu móvel baseado em Dialog do Base UI                     |
| Card                 | `src/components/ui/card.tsx`              | Superfície com cabeçalho, título, descrição e conteúdo      |
| Heading              | `src/components/ui.tsx`                   | Título da página, contexto e ação principal                 |
| Empty                | `src/components/ui.tsx`                   | Estado vazio com explicação e ação opcional                 |
| Badge                | `src/components/ui.tsx`                   | Rótulo de situação com indicador visual                     |
| Field / Back         | `src/components/ui.tsx`                   | Campos rotulados e retorno à área anterior                  |
| ActionForm           | `src/components/action-form.tsx`          | Ações de servidor, estado de envio e feedback               |
| Sonner               | `src/components/ui/sonner.tsx`            | Feedback transitório de ações                               |
| Tabela de faturas    | `src/components/crud-invoice-manager.tsx` | Busca, filtros com contagens, paginação e menu por fatura   |
| Campo monetário/data | `src/components/invoice-inputs.tsx`       | BRL, datas brasileiras, calendário e valores normalizados   |
| Tipo de cobrança     | `src/components/billing-type-input.tsx`   | Frequência única/recorrente sem alterar a regra financeira  |
| Meios de pagamento   | `src/components/payment-code.tsx`         | Apresentação e cópia de código na página pública            |
| CSS por domínio      | `*.module.css`                            | Composição específica sem vazar estilos para outras páginas |

`panel`, `card`, `section-heading`, `form-section`, `form-grid`, `form-actions`, `stack`, `table-wrap` e as classes de controles compartilham a base global. CSS Modules cobre composições específicas, como detalhes financeiros, cadastro de empresas, acesso e pagamento público.

### Integração com shadcn.io

O MCP shadcn.io foi usado para pesquisar itens, consultar metadados e obter fontes selecionadas. As fontes foram adaptadas ao projeto. Não foi adicionado Tailwind: o Console já usa CSS global e CSS Modules; a semântica dos componentes e os tokens foram mantidos sem introduzir uma segunda camada de estilização.

Referências públicas, sem tokens de registry:

- [Sheet](https://www.shadcn.io/ui/sheet): fonte adaptada para o menu móvel, usando `@base-ui/react/dialog`.
- [Card](https://www.shadcn.io/ui/card): composição de superfície, cabeçalho e conteúdo.
- [Empty](https://www.shadcn.io/ui/empty): referência para estados vazios.
- [Badge](https://www.shadcn.io/ui/badge): referência para rótulos de situação.
- [Sonner](https://www.shadcn.io/ui/sonner): integração existente de notificações, preservada na revisão.
- [CRUD Invoice Manager](https://www.shadcn.io/blocks/crud-invoice-manager): fonte consultada e adaptada na tabela de faturas, com dados reais e paginação no servidor.
- [CRUD Data Table](https://www.shadcn.io/blocks/crud-data-table): referência registrada na implementação existente da tabela.
- [Billing Invoice List](https://www.shadcn.io/blocks/billing-invoice-list): metadados consultados como referência de organização de faturas.
- [Billing Upcoming Invoice Preview](https://www.shadcn.io/blocks/billing-upcoming-invoice-preview): metadados consultados como referência para resumo de cobrança.

Nenhum dado demonstrativo dos blocos de registry é usado em produção. As fontes de referência não concedem novas operações, permissões ou comportamentos de cobrança.

## Regras de composição

1. Cada tela tem um `h1` e um contexto curto. Usar `h2` para grupos relevantes, sem simular títulos apenas com peso de fonte.
2. Formulários longos são agrupados por decisão: cliente, dados, cobrança, permissões. Dicas ficam próximas do campo e não substituem o rótulo.
3. Cartões de resumo usam valores reais e explicitam o universo. As contagens da lista financeira acompanham a busca; as de envios descrevem os 200 registros mais recentes.
4. Tabelas preservam cabeçalhos e alinhamento de valores. Em telas pequenas, o conteúdo rola dentro de `table-wrap`; a página não deve ganhar rolagem horizontal.
5. Menus de ações ficam próximos do item. A operação mais frequente também permanece acessível pelo título/link da linha.
6. Em detalhes, o conteúdo principal precede as informações de apoio. Layouts de duas colunas viram uma coluna quando não houver espaço.
7. Chamadas destrutivas não competem visualmente com a ação de continuar. Condições de negócio e confirmações existentes continuam no servidor.
8. O pagamento público mantém apenas as informações necessárias para o cliente pagar. A atualização automática permanece silenciosa; não introduzir indicador permanente de carregamento.

## Tabelas prioritárias

A revisão prioriza listas operacionais em que a comparação entre registros é frequente. Cabeçalho, densidade de linhas, estados, links e ações usam os mesmos padrões. Busca e filtros aparecem somente onde já existem no produto; esta revisão não adiciona busca, filtro ou ordenação interativa a todas as tabelas.

| Tela                | Informação prioritária                                           | Controles e limites existentes                                                                                       |
| ------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Empresas            | Nome e acesso ao cadastro, documento e e-mail financeiro         | Abas Ativos/Arquivados e link para cadastros recebidos; sem busca nesta tela                                         |
| Links de cadastro   | Identificação, situação e validade                               | Revisar cadastro ou ver detalhes; geração de novo link em seção própria                                              |
| Chamados            | Assunto, empresa, situação, prioridade alta e última atualização | Acesso à conversa; até 200 chamados mais recentemente atualizados; sem filtro de chamados                            |
| Faturas             | Produto, cliente, valor, situação e vencimento                   | Busca por cliente/descrição, abas por situação, paginação no servidor e menu contextual; contagens respeitam a busca |
| Envios de cobranças | Cliente/fatura, canal, tipo de aviso e resultado de entrega      | Até 200 avisos mais recentes; erros mantidos junto do resultado; sem filtro adicional                                |
| Contratos           | Título, cliente, publicação/versão e atualização                 | Acesso ao detalhe; até 200 contratos mais recentes; cliente vê somente publicações autorizadas                       |
| Avisos de chamados  | Movimentação, canal/destinatário, situação e data                | Até 100 avisos mais recentes; ação existente para conferir pendências; sem filtro adicional                          |

Produtos e projetos continuam em cartões, adequados à descrição e à atualização de situação de cada vínculo. No painel, resumos e listas de atividade apresentam apenas os registros autorizados. No mobile, a rolagem horizontal fica dentro da tabela e preserva as relações entre cabeçalhos e células.

## Acessibilidade e interação

- Links navegam e botões executam ações. Controles somente com ícone precisam de nome acessível.
- `aria-current` identifica a página/filtro atual; estados também têm texto visível.
- O menu móvel usa o Dialog do Base UI, preservando foco, fechamento com Escape, portal e semântica de diálogo. Não substituir por um elemento posicionado sem gerenciamento de foco.
- O menu de cada fatura usa Radix Dropdown Menu, preservando navegação por teclado e semântica de itens.
- Rótulos de campos continuam associados às entradas. Inputs monetários e de data mantêm os campos normalizados esperados pelo servidor.
- Foco visível, preferência por movimento reduzido e contraste reforçado têm estilos globais.
- A estrutura tem atalho para o conteúdo principal. Estados de erro e vazios descrevem o próximo passo.
- Mensagens de envio e publicação não são acionadas por renderização, navegação ou inspeção visual.

## Inventário de interfaces

Foram encontrados **26 arquivos `page.tsx`**. A rota `/` é um redirecionamento; a tela compartilhada de página não encontrada completa a 27ª superfície abaixo. Erro e carregamento são estados adicionais, não rotas inventadas.

| #   | Rota/superfície                         | Contexto                      | Padrões principais                           |
| --- | --------------------------------------- | ----------------------------- | -------------------------------------------- |
| 1   | `/`                                     | Entrada/redirecionamento      | Encaminha para `/painel`                     |
| 2   | `/entrar`                               | Público                       | Identidade, autenticação e OTP               |
| 3   | `/acesso-pendente`                      | Usuário sem acesso concedido  | Explicação e próximos passos                 |
| 4   | `/cadastro/empresa/[token]`             | Público por link              | Formulário agrupado e situação do convite    |
| 5   | `/pagar/[publicId]`                     | Público por link              | Resumo, Pix/boleto e confirmação automática  |
| 6   | `/painel`                               | Área autenticada              | Visão geral e acessos por contexto           |
| 7   | `/conta`                                | Conta autenticada             | Dados pessoais e preferências                |
| 8   | `/empresas`                             | Gestão de clientes            | Lista, situação e ações                      |
| 9   | `/empresas/nova`                        | Administração                 | Cadastro agrupado                            |
| 10  | `/empresas/[id]`                        | Empresa autorizada            | Identidade, dados, vínculos e permissões     |
| 11  | `/empresas/convites`                    | Administração                 | Convites e cadastros recebidos               |
| 12  | `/empresas/convites/[id]`               | Administração                 | Revisão de cadastro e link                   |
| 13  | `/produtos`                             | Produtos/projetos autorizados | Lista de vínculos e estados                  |
| 14  | `/produtos/novo`                        | Administração                 | Formulário de produto/projeto                |
| 15  | `/chamados`                             | Atendimento autorizado        | Lista, situação e prioridade                 |
| 16  | `/chamados/novo`                        | Atendimento autorizado        | Abertura de chamado                          |
| 17  | `/chamados/[id]`                        | Chamado autorizado            | Conversa, anexos e ações                     |
| 18  | `/financeiro`                           | Financeiro autorizado         | Resumo, busca, abas e tabela paginada        |
| 19  | `/financeiro/nova`                      | Administração                 | Cliente, produto e condições                 |
| 20  | `/financeiro/[id]`                      | Fatura autorizada             | Resumo, pagamento, avisos e recorrência      |
| 21  | `/financeiro/envios`                    | Administração                 | Contagens e histórico por canal              |
| 22  | `/contratos`                            | Contratos autorizados         | Lista e situação                             |
| 23  | `/contratos/novo`                       | Administração                 | Rascunho de contrato                         |
| 24  | `/contratos/[id]`                       | Contrato autorizado           | Conteúdo, versão, publicação e PDF           |
| 25  | `/configuracoes`                        | Administração                 | Organização de configurações                 |
| 26  | `/configuracoes/notificacoes`           | Administração                 | Preferências/entrega de avisos internos      |
| 27  | Página não encontrada (`not-found.tsx`) | Compartilhado                 | Estado vazio e retorno; sem pathname próprio |

Estados adicionais: `src/app/error.tsx`, `src/app/(secure)/error.tsx` e `src/app/(secure)/loading.tsx`. A autorização exata continua definida em `src/lib/access.ts` e em cada rota/ação, não nesta tabela.

## Validação desta revisão

Validação local concluída; publicação e conferência de produção são registradas na wiki do Console:

- [x] Pesquisa e consulta de componentes pelo MCP shadcn.io.
- [x] Typecheck consolidado aprovado.
- [x] Lint e build de produção aprovados.
- [x] 24 de 24 testes unitários aprovados.
- [x] Integração com 185 verificações HTTP aprovada em ambiente isolado.
- [x] Auditoria HTTP adicional de 54 cenários de administração, perfis autorizados e páginas públicas aprovada.
- [x] Labels de submit, nomes de campos e ações financeiras preservados no diff.
- [x] Inspeção visual desktop de todas as áreas: login, painel, empresas/convites, produtos, chamados, contratos, financeiro/envios, conta, configurações e páginas públicas.
- [x] 46 combinações de rota/estado e viewport inspecionadas em 1280, 1024 e 390 px, sem overflow horizontal da página. Tabelas largas mantêm rolagem própria.

As verificações HTTP e a inspeção visual são evidências distintas. A auditoria de rotas não substitui a revisão de layout, teclado e interação; nenhum destes itens confirma o deploy.

Interações e estados verificados no navegador com fixtures descartáveis e integrações simuladas:

- [x] Menu móvel abre com foco contido e fecha com Escape, devolvendo foco ao botão de abertura.
- [x] Menu de fatura, busca, filtro, paginação e resultado vazio.
- [x] Seleção de recorrência, calendário móvel e escolha de data por teclado.
- [x] Formulário incompleto indica o campo obrigatório e direciona o foco, sem criar registro.
- [x] Rascunho, agendada, emitida, paga e cancelada; Pix/boleto e estados públicos de pagamento.
- [x] Cadastro público aberto, recebido e link inválido; acesso pendente e página 404.
- [x] Fatura de teste passou de emitida para paga no banco isolado; a aba mudou sozinha para “Pagamento confirmado” e removeu os meios de pagamento, sem reload manual ou indicador de carregamento.
- [x] Revisão independente dos controles de formulário não encontrou alteração funcional nos 123 controles/actions auditados. Contraste do texto de apoio e do foco global corrigido.

A suíte de integração usa provedores simulados; não comprova nova entrega real de mensagens ou transação bancária. A revisão não gerou cobranças nem enviou mensagens para clientes. Erro e carregamento foram revisados no código e build; não foram provocadas falhas artificiais em produção.

O resultado do CI e a identificação do deploy estão na seção “Revisão completa do design system” da wiki `Console/05 - Estado da implementação.md`.
