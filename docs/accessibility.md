# Acessibilidade do Console

Revisão de 20/09/2026. Este documento descreve os padrões implementados, a cobertura examinada e as evidências disponíveis. A referência de projeto é WCAG 2.2, níveis A e AA, junto dos padrões de interação da WAI-ARIA APG. Não é uma certificação nem uma declaração de conformidade integral; verificações de código e HTTP não substituem uso com tecnologias assistivas.

## Escopo

O inventário contém **26 arquivos `page.tsx`**, incluindo o redirecionamento de `/` para `/painel`. A página compartilhada `not-found.tsx`, os dois limites de erro e o carregamento da área autenticada são estados adicionais. O [inventário do design system](./design-system.md#inventário-de-interfaces) relaciona cada rota.

| Grupo                     | Rotas                                                                                                                           | Estados e interações relevantes                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Entrada                   | `/`                                                                                                                             | Redirecionamento e destino autenticado                                                                 |
| Público e acesso          | `/entrar`, `/acesso-pendente`, `/cadastro/empresa/[token]`, `/pagar/[publicId]`                                                 | OTP, ausência de acesso, convite aberto/recebido/inválido, pagamento pendente/confirmado/indisponível  |
| Empresas e produtos       | `/empresas`, `/empresas/nova`, `/empresas/[id]`, `/empresas/convites`, `/empresas/convites/[id]`, `/produtos`, `/produtos/novo` | Listas e vazios, cadastro longo, consultas de CNPJ/CEP, acesso de pessoas, atualização de situação     |
| Atendimento               | `/chamados`, `/chamados/novo`, `/chamados/[id]`                                                                                 | Lista e vazio, abertura, conversa, anexos, encerramento                                                |
| Financeiro                | `/financeiro`, `/financeiro/nova`, `/financeiro/[id]`, `/financeiro/envios`                                                     | Busca, filtros, paginação, rascunho/agendada/emitida/paga/cancelada, edição curta, recorrência, avisos |
| Contratos                 | `/contratos`, `/contratos/novo`, `/contratos/[id]`                                                                              | Lista e vazio, formulário longo, publicação, retirada e download                                       |
| Navegação e administração | `/painel`, `/conta`, `/configuracoes`, `/configuracoes/notificacoes`                                                            | Menu móvel, resumos, WhatsApp da conta, integrações, histórico de avisos                               |

A autorização continua no servidor. A revisão de acessibilidade não altera destinatários, permissões, valores, vencimentos, emissão bancária ou regras de envio.

## Referências e critérios

Os critérios priorizados são estrutura e relações (1.3.1), finalidade de entradas (1.3.5), contraste (1.4.3 e 1.4.11), ampliação/reflow (1.4.4 e 1.4.10), teclado (2.1.1 e 2.1.2), salto de blocos, títulos, ordem e visibilidade do foco (2.4.1–2.4.3, 2.4.7 e 2.4.11), rótulos e prevenção/identificação de erros (3.3.1–3.3.4), autenticação acessível (3.3.8) e nome/papel/valor e mensagens de estado (4.1.2 e 4.1.3). A lista orienta implementação e revisão; não representa aprovação automática de cada critério. Fonte: [WCAG 2.2](https://www.w3.org/TR/WCAG22/).

Para janelas modais, o comportamento esperado inclui foco dentro da janela, navegação contida com Tab e Shift+Tab, fechamento com Escape quando não houver uma operação em andamento e retorno ao controle que abriu a janela. Confirmações exigem nome e descrição claros. Fontes: [Dialog modal — APG](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) e [Alert dialog — APG](https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/).

## Padrões implementados

### Navegação, estrutura e anúncios

- O layout raiz declara `lang="pt-BR"` e oferece “Ir para o conteúdo”, apontando para `#main-content`.
- Cada tela de conteúdo tem `main`, `h1` e título descritivo. Os metadados das rotas usam o modelo `%s | Anuntech Console`; títulos de detalhe não expõem dados pessoais.
- O anúncio de transições continua sendo o recurso nativo do Next.js. Ele usa primeiro `document.title`, depois `h1` e, como último recurso, o caminho. Não adicionar um segundo anunciador para a mesma navegação. A referência técnica instalada está em `node_modules/next/dist/docs/03-architecture/accessibility.md`.
- `h2` organiza seções; `h3` identifica subseções. `Empty` aceita `headingLevel={3}` quando já existe um título de seção `h2`.
- Ícones decorativos usam `aria-hidden`. Ações repetidas incluem o registro em seu nome acessível, preservando o texto visível da ação. `aria-current` marca a localização selecionada.

### Campos e feedback

- `Field`, em `src/components/field.tsx` e reexportado por `ui.tsx`, associa rótulo e controle por `htmlFor`/`id`. Une dicas e erros em `aria-describedby`, preservando associações fornecidas pelo chamador.
- Campos obrigatórios têm indicação visível e `required` nativo. Erros de validação permanecem junto do controle, com `aria-invalid`; a infraestrutura global direciona o foco ao primeiro campo inválido depois da atualização da descrição.
- Controles personalizados precisam encaminhar `id`, `aria-describedby` e `aria-invalid` ao controle real. Inputs monetários e de data mantêm os valores normalizados enviados ao servidor.
- `autocomplete` identifica e-mail, telefone, organização, endereço e código de uso único quando aplicável.
- `Notification` mantém resultados e erros relevantes visíveis. `ActionForm` mantém erros de servidor no formulário e apresenta o estado de envio; toast transitório não é a única forma de entender uma falha.
- Consultas de CNPJ/CEP anunciam andamento e resultado em uma região de estado associada ao campo. A consulta é auxiliar: a falha permite preenchimento manual. Cópia de link/código e falhas de download têm feedback no contexto.

### Formulários, modais e confirmações

`FormModal` serve para edições curtas, com uma decisão e poucos campos: editar rascunho da fatura, próximas cobranças e permissão de acesso. Usa os componentes `Dialog` do Base UI, adaptados em `src/components/ui/dialog.tsx`. O foco fica contido, o envio bloqueia fechamento e duplicidade, o erro permanece na janela e o sucesso fecha a janela e devolve foco ao acionador. A renderização sem JavaScript preserva um formulário em `details`.

Cadastros de empresa, criação de fatura, abertura de chamado e edição de contrato permanecem em página. Formulários com vários grupos, texto extenso, anexos ou necessidade de consultar contexto não devem ser transferidos para uma janela apenas para compactar a tela.

`ActionForm` aceita confirmação contextual para operações relevantes. A confirmação usa `AlertDialog`, descrição da consequência e foco inicial em “Cancelar”. Confirmar solicita a mesma ação de servidor; a janela não substitui validação ou autorização. Ações de emissão e comunicação não devem ser executadas para avaliar aparência.

### OTP e calendário

- O OTP usa um campo de seis dígitos, aceita colagem e `autocomplete="one-time-code"`. O destino e o código têm rótulos, dicas e erros associados.
- A interface dirige o foco para o código após a solicitação e para o campo correspondente quando a API rejeita a entrada. A contagem para reenvio continua visível, sem anunciar cada segundo.
- O calendário de vencimento usa Popover do Base UI e DayPicker, com título, instrução, foco no dia e retorno ao botão de abertura. Setas percorrem dias; Enter seleciona; Escape fecha. Digitação da data continua disponível e datas inválidas têm erro persistente.

### Tabelas, tamanho de texto, foco e contraste

- Tabelas têm `caption` e cabeçalhos com `scope="col"`. Regiões com rolagem horizontal recebem nome acessível e `tabIndex={0}` para permitir rolagem por teclado. O overflow pertence à tabela, não à página inteira.
- A tabela de faturas mantém busca nomeada, menu por registro e paginação. Menus usam Radix Dropdown Menu; não simular seus itens com elementos sem comportamento de teclado.
- Fontes usam `rem`; linhas têm altura flexível. Contadores, abas e paginação permitem crescimento/reflow. Valores e nomes extensos não devem ser cortados para caber em cartões.
- `--input: #7b8aa0` diferencia os limites de controles da superfície; `--border` continua reservado a divisores e superfícies. `--ring` identifica o foco, inclusive nas regiões roláveis. Itens destacados no menu têm contorno, além de mudança de fundo.
- Cores forçadas usam cores de sistema para foco e controles. A preferência por movimento reduzido é respeitada. Estados têm texto, não apenas cor.

## Evidências desta rodada

As verificações abaixo se referem à revisão de acessibilidade em ambiente local isolado, em 20/09/2026. Os resultados da revisão visual anterior, de 19/09, permanecem no documento do design system e não substituem esta rodada.

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
5. **Calendário e diálogos aninhados:** abra o calendário dentro e fora do modal, navegue entre meses e por setas, selecione com Enter e feche com Escape. Confira que cada fechamento devolve o foco ao controle esperado.
6. **Ampliação e reflow:** verifique texto a 200% e viewport equivalente a 320 CSS px, incluindo zoom de 400% em janela de 1280 px. Confira títulos, valores, mensagens, formulário longo e botões de diálogo. Tabelas podem rolar em seu próprio contêiner; o restante não deve exigir rolagem horizontal para leitura.
7. **Preferências visuais:** habilite cores forçadas/alto contraste e movimento reduzido. Confira limites de campos, foco, seleção, controles somente com ícones e ausência de informação dependente apenas de cor. Meça os pares reais de texto/fundo e controles/fundo, incluindo hover e erro.
8. **Estados de negócio:** com fixtures, examine rascunho, agendada, emitida, paga e cancelada; convite aberto/recebido/expirado/inválido; listas vazias; download com falha. Confira que a atualização silenciosa de pagamento não rouba foco nem repete anúncios sem mudança relevante.
9. **Depois da publicação:** confirme a versão publicada e repita navegação e inspeção nas rotas reais de forma somente leitura. Registre viewport, navegador, tecnologia assistiva, rota/estado, resultado e evidência. Não transformar validação local em alegação de validação de produção.

Para regressões de código, executar `npm run lint`, `npm test`, `npm run build` e `npm run test:integration` conforme a configuração isolada do projeto. Nenhum desses comandos, sozinho, cobre o roteiro manual acima.
