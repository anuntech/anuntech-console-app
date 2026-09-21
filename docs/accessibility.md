# Acessibilidade do Console

Revisão de 20/09/2026. Este documento descreve os padrões implementados, a cobertura examinada e as evidências disponíveis. A referência de projeto é WCAG 2.2, níveis A e AA, junto dos padrões de interação da WAI-ARIA APG. Não é uma certificação nem uma declaração de conformidade integral; verificações de código e HTTP não substituem uso com tecnologias assistivas.

## Escopo

O inventário atual contém **28 rotas de página**, incluindo o redirecionamento de `/` para `/painel`, e quatro entradas interceptadas das preferências, totalizando 32 arquivos `page.tsx`. A página compartilhada `not-found.tsx`, os dois limites de erro e o carregamento da área autenticada são estados adicionais. O [inventário do design system](./design-system.md#inventário-de-interfaces) relaciona as interfaces; a verificação em duas etapas e Membros ampliam o inventário inicial de 26 rotas.

| Grupo                     | Rotas                                                                                                                           | Estados e interações relevantes                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Entrada                   | `/`                                                                                                                             | Redirecionamento e destino autenticado                                                                 |
| Público e acesso          | `/entrar`, `/verificar-acesso`, `/acesso-pendente`, `/cadastro/empresa/[token]`, `/pagar/[publicId]`                            | OTP, segunda etapa, ausência de acesso, convite aberto/recebido/inválido, pagamento pendente/confirmado/indisponível |
| Empresas e produtos       | `/empresas`, `/empresas/nova`, `/empresas/[id]`, `/empresas/convites`, `/empresas/convites/[id]`, `/produtos`, `/produtos/novo` | Listas e vazios, cadastro longo, consultas de CNPJ/CEP, acesso de pessoas, atualização de situação     |
| Atendimento               | `/chamados`, `/chamados/novo`, `/chamados/[id]`                                                                                 | Lista e vazio, abertura, conversa, anexos, encerramento                                                |
| Financeiro                | `/financeiro`, `/financeiro/nova`, `/financeiro/[id]`, `/financeiro/envios`                                                     | Busca, filtros, paginação, rascunho/agendada/emitida/paga/cancelada, edição curta, recorrência, avisos |
| Contratos                 | `/contratos`, `/contratos/novo`, `/contratos/[id]`                                                                              | Lista e vazio, formulário longo, publicação, retirada e download                                       |
| Navegação e administração | `/painel`, `/conta`, `/configuracoes`, `/configuracoes/membros`, `/configuracoes/notificacoes`                                  | Dock, resumos, perfil e contatos, membros por permissão, integrações, histórico de avisos              |

A autorização continua no servidor. A revisão de acessibilidade não altera destinatários, permissões, valores, vencimentos, emissão bancária ou regras de envio.

## Referências e critérios

Os critérios priorizados são estrutura e relações (1.3.1), finalidade de entradas (1.3.5), contraste (1.4.3 e 1.4.11), ampliação/reflow (1.4.4 e 1.4.10), teclado (2.1.1 e 2.1.2), salto de blocos, títulos, ordem e visibilidade do foco (2.4.1–2.4.3, 2.4.7 e 2.4.11), rótulos e prevenção/identificação de erros (3.3.1–3.3.4), autenticação acessível (3.3.8) e nome/papel/valor e mensagens de estado (4.1.2 e 4.1.3). A lista orienta implementação e revisão; não representa aprovação automática de cada critério. Fonte: [WCAG 2.2](https://www.w3.org/TR/WCAG22/).

Para janelas modais, o comportamento esperado inclui foco dentro da janela, navegação contida com Tab e Shift+Tab, fechamento com Escape quando não houver uma operação em andamento e retorno ao controle que abriu a janela. Confirmações exigem nome e descrição claros. Fontes: [Dialog modal — APG](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) e [Alert dialog — APG](https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/).

## Padrões implementados

### Navegação, estrutura e anúncios

- O layout raiz declara `lang="pt-BR"` e oferece “Ir para o conteúdo”, apontando para `#main-content`.
- Cada tela de conteúdo tem `main`, `h1` e título descritivo. Os metadados das rotas usam o modelo `%s | Anuntech Console`; títulos de detalhe não expõem dados pessoais.
- O anúncio de transições continua sendo o recurso nativo do Next.js. Ele usa primeiro `document.title`, depois `h1` e, como último recurso, o caminho. O provider de preferências sincroniza o título da seção ativa antes desse anúncio porque a página preservada pode vencer a composição de metadados das rotas paralelas. Não adicionar um segundo anunciador para a mesma navegação. A referência técnica instalada está em `node_modules/next/dist/docs/03-architecture/accessibility.md`.
- `h2` organiza seções; `h3` identifica subseções. `Empty` aceita `headingLevel={3}` quando já existe um título de seção `h2`.
- Ícones decorativos usam `aria-hidden`. Ações repetidas incluem o registro em seu nome acessível, preservando o texto visível da ação. `aria-current` marca a localização selecionada.

### Campos e feedback

- `Field`, em `src/components/field.tsx` e reexportado por `ui.tsx`, associa rótulo e controle por `htmlFor`/`id`. Une dicas e erros em `aria-describedby`, preservando associações fornecidas pelo chamador.
- Campos obrigatórios têm indicação visível e `required` nativo. Erros de validação permanecem junto do controle, com `aria-invalid`; a infraestrutura global direciona o foco ao primeiro campo inválido depois da atualização da descrição.
- Controles personalizados precisam encaminhar `id`, `aria-describedby` e `aria-invalid` ao controle real. Inputs monetários e de data mantêm os valores normalizados enviados ao servidor.
- `autocomplete` identifica e-mail, telefone, organização, endereço e código de uso único quando aplicável.
- `Notification` mantém resultados e erros relevantes visíveis. `ActionForm` mantém erros de servidor no formulário e apresenta o estado de envio; toast transitório não é a única forma de entender uma falha.
- Consultas de CNPJ/CEP anunciam andamento e resultado em uma região de estado associada ao campo. A consulta é auxiliar: a falha permite preenchimento manual. Cópia de link/código e falhas de download têm feedback no contexto.
- Nome, e-mail principal e telefone da conta são campos de edição direta, com Salvar e Cancelar quando alterados. Erros permanecem no formulário e a validação local move o foco ao primeiro campo inválido. A troca de e-mail abre uma confirmação com dois códigos; a confirmação de telefone permanece junto do campo, preservando o número salvo até o sucesso.
- O avatar é um botão com nome acessível e foco visível. A câmera aparece em hover/foco e permanece indicada em dispositivos de toque; a ativação abre o seletor de arquivos nativo. A ação separada de remover foto mantém feedback no contexto.

### Formulários, modais e confirmações

`FormModal` serve para edições curtas, com uma decisão e poucos campos: editar rascunho da fatura, próximas cobranças e permissão de acesso. Usa os componentes `Dialog` do Base UI, adaptados em `src/components/ui/dialog.tsx`. O foco fica contido, o envio bloqueia fechamento e duplicidade, o erro permanece na janela e o sucesso fecha a janela e devolve foco ao acionador. A renderização sem JavaScript preserva um formulário em `details`.

Cadastros de empresa, criação de fatura, abertura de chamado e edição de contrato permanecem em página. Formulários com vários grupos, texto extenso, anexos ou necessidade de consultar contexto não devem ser transferidos para uma janela apenas para compactar a tela.

`ActionForm` aceita confirmação contextual para operações relevantes. A confirmação usa `AlertDialog`, descrição da consequência e foco inicial em “Cancelar”. Confirmar solicita a mesma ação de servidor; a janela não substitui validação ou autorização. Ações de emissão e comunicação não devem ser executadas para avaliar aparência.

### OTP, datas e seleções

- O OTP usa um campo de seis dígitos, aceita colagem e `autocomplete="one-time-code"`. O destino e o código têm rótulos, dicas e erros associados.
- A interface dirige o foco para o código após a solicitação e para o campo correspondente quando a API rejeita a entrada. A contagem para reenvio continua visível, sem anunciar cada segundo.
- Vencimentos usam `<input type="date">` e seleções usam `<select>` nativo. O navegador oferece o calendário, as opções e a navegação por teclado conforme o sistema operacional. `Field` mantém rótulo, indicação de obrigatório e erros associados; o servidor valida a data civil ISO sem conversão de fuso.
- O dock permanece centralizado na parte inferior para todos os perfis, com links de ícones em uma linha. Cada link tem nome acessível, tooltip ao foco/hover e estado ativo em texto assistivo/indicador visual. Tab percorre as áreas; em telas estreitas o grupo de rotas rola, mantendo Ajustes visível. O diálogo devolve foco a Ajustes ao fechar. Minha conta e as configurações usam um Dialog com links laterais, título e descrição; permissões são verificadas novamente no servidor.

### Tabelas, tamanho de texto, foco e contraste

- Tabelas têm `caption` e cabeçalhos com `scope="col"`. Regiões com rolagem horizontal recebem nome acessível e `tabIndex={0}` para permitir rolagem por teclado. O overflow pertence à tabela, não à página inteira.
- A tabela de faturas mantém busca nomeada, menu por registro e paginação. Menus usam Radix Dropdown Menu; não simular seus itens com elementos sem comportamento de teclado.
- Fontes usam `rem`; linhas têm altura flexível. Contadores, abas e paginação permitem crescimento/reflow. Valores e nomes extensos não devem ser cortados para caber em cartões.
- `--input: #7b8aa0` diferencia os limites de controles da superfície; `--border` continua reservado a divisores e superfícies. `--ring` identifica o foco, inclusive nas regiões roláveis. Itens destacados no menu têm contorno, além de mudança de fundo.
- Cores forçadas usam cores de sistema para foco e controles. A preferência por movimento reduzido é respeitada. Estados têm texto, não apenas cor.

## Evidências desta rodada

As verificações abaixo se referem à revisão inicial de acessibilidade em ambiente local isolado, em 20/09/2026, anterior à troca pelo calendário nativo e pelo menu flutuante. Os itens históricos sobre DayPicker e navegação móvel não validam seus substitutos. Os resultados da revisão visual anterior, de 19/09, permanecem no documento do design system e não substituem esta rodada.

| Verificação         | Resultado registrado                                                          | Limite da evidência                                              |
| ------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Lint e build        | Aprovados                                                                     | Não exercitam interação com tecnologia assistiva                 |
| Testes unitários    | 24 de 24 aprovados                                                            | Validam os casos cobertos pela suíte                             |
| Auditoria HTTP/HTML | 54 cenários; 51 renderizações normais sem achados nos critérios inspecionados | Inspeção estrutural, não auditoria automatizada completa de WCAG |
| Integração isolada  | 23 verificações OTP e 185 verificações HTTP aprovadas                         | Provedores simulados; não comprova entrega ou transação real     |

A auditoria de HTML verificou idioma, título, `main`, `h1`, IDs duplicados e alvos de `label`, `aria-labelledby` e `aria-describedby`. Nas 51 renderizações normais, não encontrou desvios dessas verificações. Os outros três cenários cobriram um redirecionamento, um 404 e um `not-found` transmitido com HTTP 200. Não houve erro de renderização no relatório. Um HTTP 200 isolado não significa página válida nem comprova acessibilidade.

Interações de teclado já verificadas manualmente nesta rodada:

- [x] Atalho “Ir para o conteúdo” alcança o conteúdo principal.
- [x] Modal “Editar rascunho” da fatura: Tab/Shift+Tab contidos, Escape fecha e foco retorna ao acionador.
- [x] Envio com campo obrigatório vazio: foco no campo inválido e erro associado pela descrição acessível.
- [x] Calendário: setas alteram o dia e Enter seleciona a data.
- [x] Salvamento bem-sucedido de edição em dado isolado: janela fecha e foco retorna ao acionador.
- [x] Confirmação: foco inicial em Cancelar, Tab contido e Escape fecha.

Verificações adicionais realizadas no navegador Chromium do Codex:

- [x] Erro retornado pelo servidor permanece no modal com foco no alerta; dados preenchidos são preservados.
- [x] Consulta simulada de CEP preenche o endereço e remove `aria-invalid` e erros antigos dos campos corrigidos.
- [x] Login por OTP direciona foco ao código; erro de e-mail é associado ao campo e desaparece ao trocar para WhatsApp.
- [x] Navegação móvel fecha por Escape e retorna ao disparador; tabela de faturas recebe foco e rola por teclado.
- [x] 16 páginas/estados inspecionados a 320 CSS px, sem rolagem horizontal da página após corrigir o containing block dos textos exclusivos de leitor de tela nas tabelas.
- [x] Modal e calendário a 200% do tamanho de texto, em 320 CSS px: rolagem vertical interna, controles alcançáveis pelo teclado, dias sem sobreposição e dia inicialmente focado completamente visível após posicionamento.
- [x] Emulação de cores forçadas e movimento reduzido no modal: contornos e foco preservados; animação reduzida.
- [x] Fatura fictícia mudou de emitida para paga na mesma aba, sem reload manual; a região de estado anunciou a confirmação, sem spinner ou toast.

A inspeção de contraste dos textos sobre fundos sólidos nas páginas amostradas não encontrou pares abaixo do critério aplicável. Ela não substitui análise de todas as combinações de estado, transparência e imagens. Não foi executada uma sessão completa com VoiceOver/NVDA nem uma matriz de navegadores; não há alegação de certificação. O teste de reflow usou viewport de 320 CSS px e ampliação de texto por estilo temporário; não é um teste de zoom do navegador em todas as rotas. Os ajustes temporários de QA foram removidos.

## Roteiro para a próxima verificação manual

Use banco descartável, provedores simulados e perfis de administração e cliente com permissões distintas. Abra também as páginas públicas sem sessão. Nunca solicite um código, publique cobrança ou envie aviso a um contato real durante QA.

1. **Estrutura e leitor de tela:** com VoiceOver/Safari e, quando disponível, NVDA/Firefox ou Chrome, percorra landmarks e títulos. Confirme o título anunciado nas transições, a finalidade de links repetidos e a ausência de anúncios duplicados. Verifique os estados vazio, erro e carregamento.
2. **Navegação por teclado:** use somente Tab, Shift+Tab, setas, Enter, Espaço e Escape. Percorra menu móvel, menus de faturas e tabelas roláveis. Confirme foco visível e não encoberto. Na saída de cada diálogo, confira o retorno ao acionador.
3. **Formulários e falhas:** envie valores vazios e inválidos; provoque falha simulada de consulta/servidor. Confira rótulo, indicação de obrigatório, dica, erro, foco e preservação do que foi digitado. Teste também correção posterior do erro e envio em andamento.
4. **OTP em provedor simulado:** solicite e cole código, teste código incorreto/expirado, reenvio, mudança do destino e alternância entre e-mail/WhatsApp. Confirme a leitura do erro e que a contagem não produz anúncio a cada segundo.
5. **Controles nativos e preferências:** teste datas e seleções pelo teclado no navegador alvo, data obrigatória vazia e salvamento sem deslocamento de dia. Abra preferências sobre uma lista, troque as seções laterais e feche. Repita por URL direta, reload, Voltar/Avançar e com confirmação aninhada. Confira foco e preservação da tela de origem.
6. **Ampliação e reflow:** verifique texto a 200% e viewport equivalente a 320 CSS px, incluindo zoom de 400% em janela de 1280 px. Confira títulos, valores, mensagens, formulário longo e botões de diálogo. Tabelas podem rolar em seu próprio contêiner; o restante não deve exigir rolagem horizontal para leitura.
7. **Preferências visuais:** habilite cores forçadas/alto contraste e movimento reduzido. Confira limites de campos, foco, seleção, controles somente com ícones e ausência de informação dependente apenas de cor. Meça os pares reais de texto/fundo e controles/fundo, incluindo hover e erro.
8. **Estados de negócio:** com fixtures, examine rascunho, agendada, emitida, paga e cancelada; convite aberto/recebido/expirado/inválido; listas vazias; download com falha. Confira que a atualização silenciosa de pagamento não rouba foco nem repete anúncios sem mudança relevante.
9. **Depois da publicação:** confirme a versão publicada e repita navegação e inspeção nas rotas reais de forma somente leitura. Registre viewport, navegador, tecnologia assistiva, rota/estado, resultado e evidência. Não transformar validação local em alegação de validação de produção.

Para regressões de código, executar `npm run lint`, `npm test`, `npm run build` e `npm run test:integration` conforme a configuração isolada do projeto. Nenhum desses comandos, sozinho, cobre o roteiro manual acima.

## Navegação flutuante e preferências — segunda rodada de 20/09/2026

Datas e seleções passam a ser controles nativos em todo o Console. O menu flutuante substitui a sidebar permanente. Minha conta, Integrações e Avisos de chamados compartilham um modal com navegação lateral e mantêm as mesmas verificações de autorização no servidor.

Validação em Chromium, com banco descartável e provedores simulados:

- 24 testes unitários, lint e build aprovados; integração com 23 verificações OTP e 185 verificações HTTP.
- Auditoria HTTP de 66 cenários com resultados esperados: 57 páginas normais, 7 bloqueios por permissão, redirecionamento de acesso anônimo e 404 público. O 404 também foi verificado com sessão administrativa.
- HTML e código confirmam os menus dos quatro perfis e controles de data/select nativos, com rótulos e aparência do navegador.
- Data obrigatória vazia recebe erro persistente e foco; salvar uma data fictícia no modal de rascunho preserva o dia, fecha a janela e devolve o foco.
- Menu aberto pelo teclado contém Tab/Shift+Tab, fecha por Escape e devolve foco. Em 320 px e texto a 200%, os itens continuam alcançáveis com rolagem interna.
- Preferências testadas em 320 px, texto a 200%, viewport baixo de 320×400 e cores forçadas. Os links se reorganizam, a navegação e o conteúdo rolam separadamente e o foco do item atual tem contorno distinguível.
- Histórico validado: abrir preferências, alternar as três seções, abrir um chamado pelo aviso, voltar ao modal e fechar preserva a página de fundo, seu título e o foco correto. URL direta/reload mostra uma única janela e fecha para o painel. Voltar/Avançar e abertura sobre `/financeiro?page=2` preservam a paginação.
- Confirmação aninhada de desvincular WhatsApp inicia em Cancelar; Escape retorna ao acionador dentro de Minha conta, e o próximo Escape fecha as preferências. Nenhum vínculo real foi alterado.

A inspeção de HTML confirma conteúdo renderizado no servidor, mas não equivale a suporte completo sem JavaScript: o streaming de conteúdo autenticado sob o loading do Next ainda depende da execução de scripts. A alternativa de menu em noscript foi verificada; não foi declarada navegação completa sem JavaScript nem certificação WCAG. Os testes de texto ampliado usam estilo temporário, sem substituir uma matriz de zoom/navegadores/leitores de tela.

## Dock e ajustes por categoria — terceira rodada de 20/09/2026

O dock horizontal substitui o menu expansível da segunda rodada. Cada ícone é um link com nome acessível, tooltip, foco visível e indicador da página atual. Em 320 px, a faixa de atalhos rola e Ajustes continua visível; alvos de 44 × 48 px. Removidos o breadcrumb superior e a legenda redundante de Visão geral no painel. Os controles de data e seleção continuam nativos.

Minha conta ganhou perfil central e cartões de Informações pessoais e Acesso e segurança. Integrações são agrupadas em Dados e acesso, Comunicação e Financeiro e fiscal. Avisos separam Destinatários, Entrega e Histórico. A navegação lateral inclui a conta e as categorias permitidas; Sair permanece dentro dos Ajustes.

Verificação em Chromium com dados fictícios: três categorias inspecionadas em desktop e tela estreita; navegação e conteúdo com rolagem independente em 320 px, texto a 200% e altura de 400 px. Sem overflow horizontal da página. Tab e Shift+Tab permanecem no modal, confirmação aninhada inicia em Cancelar e Escape devolve foco ao acionador. Fechamento dos Ajustes e Voltar/Avançar retornam ao dock e à página de origem. Cores forçadas e movimento reduzido emulados; nomes dos ícones e contorno de foco preservados.

Lint, build, TypeScript e 24 testes unitários aprovados. Ajustado o acompanhamento dos metadados para impedir título de seção obsoleto ao fechar. Após o ajuste, entrada direta, troca de categorias, Voltar/Avançar e retorno a `/financeiro?page=2` preservaram título, foco e destino.

Auditoria adicional de 24 casos HTTP/HTML aprovada, incluindo os quatro perfis, categorias permitidas/bloqueadas, login e 404. Revisão independente dos subagentes sobre permissões, semântica, histórico e foco. Nenhum envio ou registro real alterado. Os limites sobre leitores de tela, zoom real e certificação das rodadas anteriores continuam aplicáveis.


### Ajuste de composição do dock — 20/09/2026

Dock centralizado no topo para equilibrar o cabeçalho. A reserva superior passou de 70 para 64 px na ausência de safe area; deslocamento e reserva consideram a área segura do dispositivo. A faixa transparente de posicionamento permite cliques no conteúdo, enquanto o dock mantém interação normal. A prévia foi inspecionada em 1280 px e 320 px: dock de 296 px em tela de 320 px, título abaixo do dock, sem overflow da página. Abertura por teclado, Escape e retorno de foco aos Ajustes preservados.

## Perfil, contatos, segurança e membros — 20/09/2026

Minha conta inclui foto privada, edição de nome, contatos verificados e verificação em duas etapas opcional, mantendo o acesso sem senha. Membros separa administração da Anuntech de permissões por empresa. Foram mantidos os modais compartilhados e selects nativos.

QA em Chromium, com banco descartável e provedores simulados:

- Edição de nome salva, fecha o diálogo e devolve o foco ao acionador. Erro de sessão antiga na alteração de contato permanece visível e recebe foco.
- Após novo login, inclusão de e-mail com códigos distintos para origem e destino conclui, atualiza a lista, fecha o diálogo e devolve o foco a Adicionar e-mail.
- Upload de PNG sintético exibe a imagem WebP de 512 × 512. Remoção restaura as iniciais e transfere o foco ao botão Adicionar foto. Feedback de envio, sucesso e erro permanece em contexto.
- Ativação de duas etapas exige códigos de e-mail e WhatsApp em sequência; o estado passa a Ativada, o foco chega ao título da seção e alterações de contatos ficam indisponíveis com explicação.
- Conta e formulário de acesso de cliente conferidos em 320 × 720 CSS px, sem overflow horizontal da página. Selects de empresa e permissão continuam nativos. Escape fecha o formulário de membro e devolve o foco ao acionador.
- Endpoint de foto rejeita sessão ausente, origem externa e SVG; upload, leitura privada, remoção e resposta 404 posterior verificados. Storage real testado separadamente com imagem sintética: acesso autenticado com bytes iguais, acesso anônimo negado e objeto removido.

Os testes de mensagens usam transportes simulados e não comprovam entrega de OTP a destinatários reais. Não foi realizada sessão completa com VoiceOver/NVDA nem uma nova matriz de navegadores ou zoom; permanecem os limites das rodadas anteriores.

## Edição direta da conta e gestão de membros por cliente — 20/09/2026

Esta rodada substitui a edição de nome por modal descrita acima: Nome, E-mail e Telefone agora são editados no próprio campo. A confirmação dos dois códigos do e-mail continua em diálogo; o código de telefone aparece no formulário. O avatar abre o seletor de arquivos ao ser ativado por ponteiro ou teclado, com câmera visível no hover/foco e indicador persistente em dispositivos de toque. O intervalo de reenvio de telefone é explicado também quando a pessoa cancela e começa outra edição.

Membros aparece nos Ajustes do cliente com permissão Administrador do cliente. Tanto a consulta quanto as ações ficam restritas às empresas que ele administra, sem dados da equipe Anuntech. Atendimento e Financeiro não recebem essa opção. A interface explica a proteção do próprio acesso; o servidor bloqueia autorrevogação, autorrebaixamento e remoção ou rebaixamento do último administrador. Aliases pertencem à mesma identidade. Combinações legadas de Atendimento e Financeiro exigem escolha explícita ao editar, sem promoção automática a administrador.

QA confirmado no Chromium, com banco descartável e provedores simulados:

- Nome salvo diretamente no campo.
- Telefone substituído somente após confirmação do código.
- E-mail principal alterado após os dois códigos; consulta ao banco isolado confirmou encerramento de todas as sessões e preservação do alias anterior.
- Campos inválidos de Nome, código do telefone e código de origem do e-mail receberam foco.
- Cliente administrador viu somente a empresa da fixture Aurora, sem equipe Anuntech ou dados da empresa B.
- Tela em 320 CSS px sem overflow horizontal.
- Foco no avatar revelou a câmera; sua ativação abriu o seletor de arquivos.

O CI final desta rodada ainda não está registrado. Os resultados acima não ampliam a evidência para entrega real de mensagens, leitores de tela ou navegadores não exercitados.


## Dock inferior e fechamento à direita — 20/09/2026

Dock com alvos de 44 px, nomes acessíveis, rotas filtradas por permissão e painel Criar operável por teclado. Painel usa Popover do Base UI, com fechamento por Escape/clique externo e animação desativada quando há preferência por movimento reduzido. Conteúdo reserva espaço inferior e scroll-padding para o dock. Preferências mantêm título de seção e close de 44 px no canto superior direito, fora das regiões roláveis. O rótulo visual Ajustes foi removido, preservando o nome acessível Fechar ajustes.
