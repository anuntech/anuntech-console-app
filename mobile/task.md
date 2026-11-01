# App nativo: paridade com o Console web (cliente)

Tudo o que um **cliente** (Administrador ou Membro de uma empresa) vê e faz no Console web, e o estado no app. As telas da equipe Anuntech (staff) ficam fora. Mapeado em 22/10/2026 a partir do código; o detalhe de cada item, com arquivo e linha, está nos mapas `paridade-a.md` (Início, chamados, ajuda, apps), `paridade-b.md` (financeiro, contratos, orçamentos, produtos, banco de horas) e `paridade-c.md` (projetos, bookmarks, conta, assistente) da sessão 261020-refined-falls.

Regras que valem para tudo:
- Cada operação nova: contrato em `src/lib/api/contract.ts`, procedimento com `guard()` primeiro, a mesma função de `src/lib/` que a web usa (extrair `xxxAs(actor, input)` da server action quando ela lê `FormData`), verificações em `scripts/api-smoke-*.mjs`, depois a tela.
- Financeiro, contratos e orçamentos são só do Administrador (área `finance`). Decidir pela empresa (assinar, aceitar, aprovar horas, contestar, aprovar estimativa, pedir alteração) passa por `answersForClient`: Administrador, nunca a equipe.
- Membro com "projetos selecionados" só vê os seus (`engagementWhere`/`canSeeEngagement`). Valores em R$ só para quem vê dinheiro (`canSeeMoney`).
- Cobranças continuam manuais: nada aqui ativa recorrência, envio ou emissão.

Legenda: ✅ feito · 🟡 parcial · ❌ falta · ⚪ não se aplica ao celular (motivo ao lado).

---

## Já no app (22/10)

Entrada por e-mail/WhatsApp com segunda etapa; Início (aguardando você, a pagar, chamados em aberto, atalhos); chamados (lista Em aberto/Todos, detalhe, responder em texto, abrir chamado); projetos (lista de ativos, quadro, aprovar ou devolver entrega); contratos (ler, assinar, PDF); orçamentos (ler, aceitar, recusar, PDF); bookmarks (lista, busca, abrir link, baixar arquivo); financeiro (lista, filtro, totais, Pix, boleto, PDF); assistente (conversa, lista, apagar, cartões de confirmação); conta (perfil, foto, ilustração, nome, e-mail, WhatsApp, duas etapas, sessões, empresa, membros, notificações, excluir conta); push com toque abrindo o registro; Face ID.

---

## Frente 1 — Anexos e chamados

- [x] **U1** Rota de envio de arquivos do app `POST /api/v1/anexos` (sessão do app, como `/api/v1/conta/foto`), gravando em `ticketUploads` e devolvendo `uploadId`; checagem `support` para chamado e `overview` para tarefa. A rota da web exige a origem do site.
- [x] **U2** Escolher arquivo no app: câmera, fotos e documentos (PDF), com os limites da web (5 por envio, 20 MB, PDF/PNG/JPEG/WebP).
- [x] **T1** Lista: busca por assunto (o servidor já aceita `search`).
- [x] **T2** Lista: todos os filtros de situação (Em aberto, Aguardando atendimento, Em atendimento, Aguardando você, Resolvidos, Encerrados, Todas).
- [x] **T3** "Aguardando você" do Início abre a lista já filtrada. A lista aceita `/chamados?status=waiting_customer`; o link no Início fica com a frente do Início.
- [x] **T4** Marca de prioridade Alta/Crítica na linha e no detalhe (`priority` no contrato).
- [x] **T5** Detalhe: impacto, "Aberto por" (nome e e-mail), aberto em, última atividade.
- [x] **T6** Detalhe: prazos (primeira resposta, meta de solução, prazo pausado) quando as condições da empresa estão publicadas.
- [x] **T7** Detalhe: estimativa de melhoria (ver; Membro lê "um Administrador aprova").
- [x] **T8** Aprovar ou recusar a estimativa de melhoria (Administrador; `decideEstimate` extraído para `lib/`).
- [x] **T9** Responder com anexos e enviar só anexo, sem texto.
- [x] **T10** Chamado encerrado: "Abrir novo chamado" já com a empresa.
- [x] **T11** Abrir chamado com anexos.
- [x] **T12** Abrir chamado: aviso de privacidade ("não escreva senhas nem dados reais").
- [x] **T13** Abrir chamado: "O que esperar" (data da primeira resposta e linha de fora do horário) e a orientação de ajuste, calculados no servidor (`tickets.preview`).
- [x] **T14** Abrir chamado: sugestões da Ajuda enquanto digita ("Talvez isto responda").
- [x] **T15** Abrir chamado: produto escondido para "App ou projeto novo"; único produto já marcado.
- [x] **T16** Abrir chamado por link com empresa, tipo e produto preenchidos (usado por "Pedir orçamento", serviço, chamado encerrado e "Não encontrou?").
- [x] **T17** Segunda etapa de entrada: "Reenviar código".
- ⚪ Ctrl/Cmd+Enter (sem teclado físico). Mudar situação, prioridade, responsável, reabrir, encerrar ou excluir: só a equipe, também na web.

## Frente 2 — Financeiro (Administrador)

- [x] **F1** Cartões de total com contagem e o cartão "Pagas"; contagem no título.
- [x] **F2** Período: Todo, Este mês, Mês passado, Próximos 30 dias, Este ano.
- [x] **F3** Busca por descrição e empresa.
- [x] **F4** Dias de atraso na linha e no detalhe.
- [x] **F5** Marca de recorrência (mensal/anual) na linha e no detalhe.
- [x] **F6** Copiar e compartilhar o link de pagamento.
- [x] **F7** Próximas cobranças (valor, vencimento, "Boleto e Pix chegam até…").
- [x] **F8** Detalhe: vencimento do boleto quando difere ("Boleto e Pix válidos até…").
- [x] **F9** Detalhe: pagador com CPF/CNPJ.
- [x] **F10** Detalhe: próxima cobrança da recorrência ou o período já emitido.
- [x] **F11** Detalhe: condições (desconto até o vencimento, multa e juros).
- [x] **F12** Detalhe: nota fiscal (emitida com link, em andamento, ainda não solicitada).
- [x] **F13** Detalhe: "O Inter ainda está preparando o boleto e o Pix" quando faltam.
- [x] **F14** Detalhe: atualizar sozinho enquanto em aberto (consulta periódica, ao voltar ao app e puxar para atualizar), com aviso de "Pagamento confirmado".
- [x] **F15** Boleto PDF pela sessão (`/api/boletos/<id>`) quando o link público estiver desligado.
- [x] **F16** Detalhe: "Criada em" e "Última consulta ao banco".
- ⚪ Recibo e cartão: não existem no produto. QR Code do Pix: serve para pagar de outro aparelho; no celular, copiar e colar.

## Frente 3 — Contratos e orçamentos (Administrador)

- [x] **K1** Contratos: filtro de situação (Aguardando assinatura, Em revisão, Assinados) e busca.
- [x] **K2** Linha: "Falta a sua assinatura" / "Falta a da Anuntech", vigência ("Vence em N dias"), "Aditivo de <contrato>".
- [x] **K3** **Pedir alteração por cláusula**: escrever (comentário e texto proposto), editar, descartar e enviar a rodada à Anuntech.
- [x] **K4** Pedidos em revisão e histórico de revisões com a resposta da Anuntech (Aceito/Recusado, aplicado).
- [x] **K5** Aviso ao assinar com pedidos não enviados.
- [x] **K6** Mudanças desde a versão anterior (marcadas no texto).
- [x] **K7** Versões anteriores com o PDF de cada uma.
- [x] **K8** Aditivos do contrato e link para o contrato original.
- [x] **K9** Vigência com estado (começa, vence, vencido) e o texto do aditivo.
- [x] **K10** "Enviado em", modelo e próximos passos depois de assinado (com Como trabalhamos).
- [x] **Q1** Orçamentos: filtro de situação (Aguardando resposta, Aceitos, Recusados, Expirados) e busca.
- [x] **Q2** **Pedir orçamento** na lista (abre chamado "App ou projeto novo" já escolhido).
- [x] **Q3** Detalhe: tecnologias, valor da hora, desconto negociado, semanas por fase, tarefas com descrição.
- [x] **Q4** Detalhe: "faltam N dias", "Enviado em", e-mail de quem respondeu.
- [x] **Q5** Versões anteriores com PDF.
- [x] **Q6** Próximos passos depois de aceito (contrato, entrada, acessos).

## Frente 4 — Projetos

- [x] **P1** Lista: filtro de situação (Ativos, Pausados, Concluídos, Todas) — hoje pausados e concluídos não aparecem — e busca.
- [x] **P2** Cartão: prioridade, etiquetas, estimativa, anexos, atraso e o selo "Pedido do cliente".
- [x] **P3** Busca e filtros do quadro (pessoa, etiqueta, prioridade).
- [x] **P4** **Detalhe da tarefa**: descrição completa, criador, atualizada há, prioridade, responsáveis, prazo, estimativa, etiquetas, coluna.
- [x] **P5** Comentários: ler, escrever (com arquivos), editar e apagar os próprios.
- [x] **P6** Anexos da tarefa: ver, baixar, anexar e remover (quem anexou ou o criador).
- [x] **P7** **Criar pedido** (o cliente cria no Backlog como "pedido").
- [x] **P8** Editar tarefa e mudar a coluna, com as regras do cliente (não conclui, não põe em Revisão, não tira de Revisão nem de Concluído).
- [x] **P9** Excluir tarefa (quem criou).
- [x] **P10** Atividade do projeto.
- [x] **P11** "Sobre este projeto" com o texto de como o quadro funciona.
- ⚪ Arrastar cartões entre colunas: no celular, a coluna muda no detalhe da tarefa.

## Frente 5 — Bookmarks

- [x] **B1** Chip "Sem pasta", paginação além de 100, tamanho e data dos arquivos, quem vê cada pasta.
- [x] **B2** Novo link (empresa, pasta, título, endereço), nova lousa e novo arquivo enviado do celular (foto, ou qualquer arquivo de até 1 MB a partir da 1.2.0).
- [x] **B3** Editar, mover para outra pasta e excluir (quem salvou ou o dono da pasta).
- [x] **B4** Nova pasta, renomear, compartilhar (empresa toda ou pessoas escolhidas) e excluir (o dono).
- [x] **B5** Lousa: ver em tela cheia com zoom.
- [x] **B6** Arquivos como na web (27/10/2026, OTA): subpastas (navegar, criar dentro, mover pasta), lixeira (restaurar, excluir de vez), etiquetas (filtro e escolha em Editar), filtro de tipo, ordem e "Só os meus", trecho da busca no conteúdo, versões (baixar, restaurar, enviar nova pelo R2), atividade, "Copiar para…", links externos e pedido de arquivos (criar, copiar ou enviar o endereço, desligar), "Quem vê pode" (só ver e baixar), pastas do Console (contratos e entregas) protegidas, textos "Arquivos" em vez de "bookmarks".
- ⚪ No app, a seleção de vários e o .zip de pasta ficam só na web (o celular baixa um arquivo por vez).
- ⚪ Desenhar na lousa (editor Excalidraw para tela grande e mouse): no celular só ver; "Abrir no Console" para editar.

## Frente 6 — Início, produtos, banco de horas e apps

- [x] **H1** "Precisa de atenção": orçamentos para responder, contratos para assinar, estimativas para aprovar, entregas para revisar, produto suspenso.
- [x] **H2** Projetos (até 4, com progresso), Produtos e serviços (até 5) e Bookmarks (até 5) no Início.
- [x] **H3** "Nada a pagar" com a próxima cobrança.
- [x] **H4** Esconder e mostrar valores (olho), guardado no aparelho.
- [x] **S1** **Produtos e serviços**: lista (filtro de situação, busca), situação, preço e vencimento (Administrador).
- [x] **S2** Detalhe do serviço (o que fazemos, o que precisamos de você, resultados, prazos), cobrança (Administrador) e "Abrir chamado" já com o serviço.
- [x] **S3** Aviso de produto suspenso com "Pagar agora" e "Falar com a equipe".
- [x] **S4** Abrir o app de um produto (CMS e outros) com o passe do Console, no navegador do app; telas de bloqueio com o motivo.
- [x] **S5** Banco de horas: uso do mês, lançamentos recentes, horas extras aprovadas, relatório mensal.
- [x] **S6** Aprovar horas além do banco (Administrador).
- [x] **S7** Contestar o relatório mensal (Administrador).
- ⚪ Contratar direto pelo catálogo: não existe na web (o catálogo é da equipe). Hoje contratar é pedir orçamento → aceitar → assinar, que o app passa a fazer inteiro (Q2, K3). Abrir o catálogo ao cliente é decisão de produto à parte.

## Frente 7 — Ajuda, Como trabalhamos e primeiros passos

- [x] **A1** **Ajuda**: busca, vídeos, assuntos, perguntas frequentes. (`help.home`, `help.search`; tela `/ajuda` sobre as abas, aberta pela Conta)
- [x] **A2** Ler artigo (seções, passos, notas, perguntas, links internos que abrem a tela do app), aviso ao Membro em artigo de Administrador, relacionados. (`help.get`; `/ajuda/[slug]`, aberta de qualquer aba por `openHelp`)
- [x] **A3** Vídeos tutoriais com capítulos e transcrição: tocam no app a partir da 1.2.0 (capítulos e transcrição levam ao segundo certo); antes, abrem no navegador do app.
- [x] **A4** "Não encontrou?": perguntar ao assistente, abrir chamado (Dúvida), falar com a equipe (WhatsApp). (O assistente abre sem a pergunta preenchida: a tela não aceita esse parâmetro.)
- [x] **A5** **Como trabalhamos**: o guia, os prazos e o que o contrato pede de cada empresa; marcar como lido. (`guide.get`, `guide.markRead`; `/como-trabalhamos`, pela Conta e pela Ajuda)
- [x] **A6** Primeiros passos no Início (Administrador e Membro têm passos diferentes) e "Ocultar". (`guide.firstSteps`, `guide.markStep`; `components/first-steps-card.tsx` pronto, o integrador põe no Início)
- [x] **A7** Links de ajuda nas telas ("Como pagar", "Como assinar e pedir alteração", "Como funciona o aceite", "Como contamos o tempo", "Como funciona o quadro").

## Frente 8 — Conta, notificações e assistente

- [x] **C1** Aparência: Claro, Escuro ou Sistema.
- [x] **C2** Notificações: histórico de envios (Administrador).
- [x] **C3** Assistente: sugestões conforme o papel (o Membro não vê "faturas").
- ⚪ Assistente: pixels que acendem sob o cursor (web, 23/10). Efeito de mouse; no celular não há cursor.
- [x] **C4** Assistente: atalhos fixos sob a caixa (Abrir chamado, Ajuda).
- [x] **C5** Assistente e chamados: ditado por voz com a mesma transcrição da web (`/api/v1/transcricao`).
- [x] **C6** "Falar com alguém da Anuntech": WhatsApp da equipe em vez de só "Abrir chamado".
- ⚪ Preencher ou clicar na tela pelo assistente (depende da página web), tempo e tokens por resposta, posição do dock, lista ou grade.

## Lacunas (mapa de 23/10)

Segunda comparação, feita no código da web e do app depois da paridade e das mudanças da web de 22/10. Só o que o Administrador ou o Membro veem. Detalhes com arquivo e linha: `lacunas-a.md`, `lacunas-b.md` e `lacunas-c.md` na pasta da sessão 261020-refined-falls.
Legenda: ❌ falta · 🟡 parcial · ⚠️ diferente · 🐞 defeito. **OTA** = vai por atualização automática; **loja** = pede versão nova; **servidor** = só o Console.

### 1. Links que levam ao lugar errado (o cliente sente primeiro)

- [x] **L1** ⚠️ E-mails de contrato, orçamento, projeto e produto abrem o navegador mesmo com o app instalado (só `/painel`, `/chamados` e `/financeiro` são links do app). Somar `/contratos`, `/orcamentos`, `/projetos` e `/produtos` em `APP_LINK_PATHS` (servidor, vale no iPhone na hora) e em `linkPaths` do Android (loja).
- [x] **L2** 🐞 E-mails do banco de horas (alerta de 80% e relatório do mês) mandam para `/painel`, que o app não tem: provável tela "não encontrada". `+native-intent` levando `/painel` ao Início. OTA.
- [x] **L3** ⚠️ Links da Ajuda e do assistente: Produtos, um app, Aparência, Minha conta, Membros, artigos e Como trabalhamos abrem o site (sem sessão, pede login) embora o app tenha as telas; `?tipo=`, `?status=` e `?company=` se perdem ("Pedir orçamento" abre sem o tipo); `/projetos/novo` vira um quadro "não encontrado". Um mapa só para os dois (`help-routes.ts` e `assistente/index.tsx`). OTA.
- [x] **L4** ⚠️ O que ainda abre o Console no navegador (desenhar a lousa) cai no login com segunda etapa. Ponte de sessão de uso único, como o passe dos apps, ou ao menos avisar antes de abrir. Servidor + OTA.

### 2. Privacidade e Android

- [x] **L5** ⚠️ Bookmarks: o ícone de cada link vem do DuckDuckGo, que fica sabendo dos domínios que a empresa salva. A web usa a inicial "sem chamar ninguém". Igualar à web. OTA.
- [x] **L6** 🐞 Android: os ícones de aparelho em Segurança (iPhone, iPad, notebook, computador) aparecem como círculo. Somar `smartphone`, `tablet`, `laptop` e `desktop_windows` ao mapa. OTA.
- [ ] **L7** Conferir num Android de verdade se o teclado cobre o botão salvar nos formulários (tarefa, bookmark, pasta, comentário).

### 3. Falta no app

- [x] **L8** ❌ **Atividade** em Minha conta: o calendário do último ano (web, commit 69b5b83). Procedimento `profile.activity` com `guard({ self: true })` sobre `accountActivity` + cartão em grade. Servidor + OTA.
- [x] **L9** ⚠️ Nome da empresa como se lê (sem número do MEI, sem LTDA, sem caixa alta) em chamados, Conta, Início, Financeiro, Projetos, Contratos e Orçamentos: `companyDisplayName` no servidor (mesmo campo, só muda o texto). E só mostrar a empresa a quem tem mais de uma (detalhe do chamado, quadro do projeto, cabeçalho de contrato e orçamento, "respondido por"). Servidor + OTA.
- [x] **L10** ⚠️ Início: "Orçamentos para responder" e "Contratos para assinar" abrem a lista em "Todas"; a web abre em "Aguardando". OTA.
- [x] **L11** 🟡 Financeiro: período "Personalizado" (de/até). `period: "custom"` + `from`/`to` opcionais em `finance.list`. Servidor + OTA.
- [x] **L12** ❌ Filtro por empresa (quem tem várias): Financeiro, Chamados (o assistente manda `?company=`) e atalhos "Só desta empresa" em Produtos. Campos opcionais na API + chips. Servidor + OTA.
- [x] **L13** 🟡 Orçamento: o documento completo da proposta (resumo por fase com horas, subtotal, quadro "Xh × R$/h com desconto", rodapé "preparada pela Anuntech… válida até", CNPJ). Entrada e Saldo também com 0% de entrada, como na web. "Limpar filtros" limpa a busca em orçamentos e contratos. "Atualizado há…" na lista. OTA (CNPJ: campo novo opcional).
- [x] **L14** ⚠️ Contrato: texto proposto como diferença palavra a palavra (riscado/inserido); partes "Cliente" e "Anuntech" em vez de "Contratante" e "Contratada". OTA.
- [x] **L15** Projetos: "Pedir orçamento" na lista vazia de ativos (❌); etiquetas com cor (⚠️); reordenar dentro da coluna com "Mover para cima / para baixo / para o topo" (🟡, `afterId` opcional em `projects.moveTask`). Servidor + OTA.
- [x] **L16** Lousa: salvar ou compartilhar a imagem (🟡); criar lousa termina num visualizador vazio (⚠️, voltar à lista com "Desenhe no Console"); o Início e Bookmarks abrem a lousa de jeitos diferentes (⚠️, unificar no visualizador); miniatura na lista (🟡). OTA.
- [x] **L17** Chamados: aviso "A equipe precisa de você" sempre que está Aguardando você (⚠️); "Aberto por" na lista (🟡); cartão com todos os anexos (🟡); foto de quem escreveu e separador por dia (⚠️); ver imagem e PDF dentro do app em vez da folha de compartilhar (⚠️; imagem por OTA, Quick Look pede loja). OTA. Feito: imagens abrem num visualizador em tela cheia no app (chamados, tarefas e bookmarks, com Compartilhar); PDF segue na folha de compartilhar, que já mostra a prévia no iOS (ver PDF dentro do app pede módulo nativo: Quick Look ou WebView, versão de loja).
- [x] **L18** Assistente: mensagem até 20.000 caracteres, como na web (hoje 4.000). OTA.
- [x] **L19** Notificações: link "Quando cada aviso chega" no cartão Financeiro. OTA.
- [x] **L20** 🐞 Bookmarks: "Trocar" sempre abre a galeria, mesmo se o arquivo veio de documentos ou da câmera; editar e mover só funcionam com a lista carregada (hoje não aparece, porque só se chega pela lista). OTA.

### 4. Decisões (a web mudou e o celular pode preferir outro jeito)

- **D1** Início: a web lista os 5 últimos chamados em qualquer situação; o app, só os abertos. Recomendação: manter os abertos (o Início do celular é "o que pede atenção").
- **D2** Assistente: a web tirou as sugestões fixas e mostra perguntas só enquanto a pessoa digita (c9da909). Recomendação: manter as sugestões fixas no celular, onde digitar custa mais.
- **D3** Início: a web mostra Projetos, Produtos e Bookmarks mesmo vazios, com explicação; o app esconde. Recomendação: manter escondido; os atalhos já levam às telas.
- **D4** Ilustrações da marca nos estados vazios (a web usa; o app usa ícones). Opcional, visual.

### 5. Não faz sentido no celular (sem ação)

Arrastar cartões, lista ou grade, paginação numerada e tamanho de página, editor de desenho da lousa, posição do dock e animação no hover, assistente que lê ou preenche a página, tempo e tokens por resposta, atalhos de teclado, QR Code do Pix (no celular é copiar e colar), página `/pagar` dentro do app, menus "…" das linhas (o detalhe já tem as ações), apps num quadro embutido (o navegador do app com o passe faz o mesmo), widget de chat (no app é o WhatsApp, C6). As mudanças da web de 22/10 sobre reenviar cobrança, avisos e e-mails, editar proposta e jornada são da equipe.

### Conferido sem lacuna

Chamados (lista, filtros, abrir completo, responder, estimativa), Financeiro (lista, detalhe, NF, Pix, PDF), assinatura e pedido de alteração de contrato, aceite e versões de orçamento (inclusive a versão nova depois de respondido, 988b65a), Produtos, banco de horas, Ajuda, Como trabalhamos, primeiros passos, Conta (perfil, contatos, segurança, empresa, membros, notificações com vários e-mails e telefones), quadro e tarefas, Bookmarks e pastas. Todos os 77 procedimentos que o app chama existem, e todas as rotas e artigos citados também. O orçamento que fechava o app com a atualização de 22/10 de manhã (tarefas viraram título + descrição) já está corrigido na atualização de paridade.

## Arquivos (26/10)

A web transformou Bookmarks em Arquivos, com arquivos de até 100 GB no R2 (0357a8c). No app:

- [x] **A1** Nome "Arquivos" no título da tela, no Início (bloco e atalho), no estado vazio e nos botões do assistente e de "não encontrado". Rotas e ids continuam `/bookmarks`.
- [x] **A2** Envio de arquivos grandes direto para o R2, com as regras da web: `files.startUpload`, `files.signParts`, `files.finishUpload` e `files.cancelUpload` chamam o mesmo núcleo das rotas `/api/arquivos/envios` (`lib/drive/uploads.ts`); `bookmarks.create` aceita `kind: "file"` com `uploadId` (usado uma vez só). O app lê o arquivo do disco em partes de 16 MB (`FileHandle`), manda cada parte com `expo/fetch`, tenta cada parte até 3 vezes e conclui com os ETags. Vários arquivos de uma vez ("Enviar arquivos" na lista ou o formulário Novo), dois por vez, com progresso, cancelar e "Enviar de novo". Arquivos (quando o build tem o seletor de documentos), fotos e vídeos da galeria e foto da câmera. Sem R2 configurado, o app segue com o envio antigo de até 1 MB.
- [x] **A3** "Espaço usado" por empresa na lista (`spaces` e `largeFiles` opcionais em `bookmarks.list`, mesma visibilidade da web), com barra e "N de 5,0 GB", vermelha acima de 90%.
- [x] **A4** Download: `bookmarks.download` devolve o endereço assinado de 5 minutos depois da mesma checagem de `/api/bookmarks/[id]` (ou null para arquivo antigo no banco). Até 50 MB abre no app como antes; acima disso o app mostra o tamanho e oferece "Abrir no navegador" ou "Baixar".
- [x] **A5** Testes: `scripts/api-smoke-arquivos-app.mjs` (com o R2 local de `scripts/r2-mock.mjs`) e `tests/mobile-upload-plan.test.ts`.
- ⚪ Gravar vídeo pela câmera dentro do app: o texto de permissão do microfone fala só de ditado, e mudá-lo pede versão nova nas lojas. Vídeos vêm da galeria.
- ⚪ Envio em segundo plano: se o app sai da tela o envio pode parar; o app avisa e a pessoa toca em "Enviar de novo" (o envio abandonado expira no Console). Envio em segundo plano de verdade pede módulo nativo.


## Arquivos (27/10)

A web passou a mostrar cada arquivo no cartão e ganhou o que um drive tem (f2bda19) e o medidor de armazenamento (8affb0a). No app:

- [x] **C1** Miniatura de cada foto na linha da lista e no Início: `bookmarks.list`, `bookmarks.get` e `overview.get` trazem `thumbUrl` (endereço assinado de 5 minutos para a WebP pequena, `lib/drive/thumb-url.ts`, a mesma busca da rota `/api/bookmarks/<id>/miniatura`); sem miniatura, o ícone do tipo (PDF, planilha, vídeo…), como a web. O app não usa a rota com o cookie porque ela redireciona para o R2 e o celular mandaria a sessão junto.
- [x] **C2** Estrela de cada pessoa: `bookmarks.star` (`starBookmarkAs`, o mesmo núcleo do menu da web) no menu da linha, no visualizador e no cabeçalho dele; chips "Recentes" e "Com estrela · N" ao lado das pastas (`folder: "estrela" | "recentes"`, `starredCount`).
- [x] **C3** Visualizador de arquivo (`/bookmarks/<id>/ver`): todo arquivo abre nele, com a foto (toque para tela cheia com zoom), o vídeo tocando no app (builds com o player), o começo do texto de um documento ou o tipo grande; setas e deslizar para o arquivo anterior/próximo da lista ("2 de 14"); "Detalhes" como a web (tipo, tamanho, pasta, empresa, etiqueta, adicionado por, datas); "Baixar", estrela, "Copiar link", "Renomear", "Editar" e "Compartilhar por link".
- [x] **C4** "Renomear" (só o título, por `bookmarks.update`, como o diálogo da web) e "Copiar link" (`<Console>/bookmarks?abrir=<id>`, só abre para quem já tem acesso) no menu de cada item; o menu agora aparece para todos (estrela e link), com as ações de edição só para quem pode. No Android o menu virou uma folha com todas as ações. `console-paths.ts` leva `/bookmarks?abrir=<id>` ao visualizador, então o link abre no app quando chega por dentro dele (assistente, Ajuda, links do app).
- [x] **C5** "Armazenamento" no lugar de "Espaço usado": barra dividida em fotos e vídeos, documentos e outros (tons do violeta), preenchida até o limite da empresa com a porcentagem e o que sobra, vermelha acima de 90%; o espaço da Anuntech, sem limite, mostra só a divisão; o nome do espaço só quando há mais de um (`parts` opcional em `spaces`).
- [x] **C6** Testes: `scripts/api-smoke-arquivos-cards.mjs` (estrela por pessoa, outra empresa 404, Membro fora da pasta, "Recentes" só do próprio e por 30 dias, renomear, divisão do espaço, miniatura assinada) e `tests/mobile-bookmark-text.test.ts`, `tests/mobile-upload-plan.test.ts` (tipos iguais aos da web, setas, detalhes, medidor).
- ⚪ Link copiado aberto fora do app (e-mail, WhatsApp): `/bookmarks` não está nos links do app (`APP_LINK_PATHS`); incluir pede o filtro de links do Android em `app.config.ts`, que é nativo (versão nova nas lojas). Até lá abre no navegador, no Console.
- ⚪ Primeiro quadro do vídeo e página do documento na linha da lista: a linha tem 32 pontos e tirar o quadro pede um player por linha; a lista mostra o ícone do tipo e o visualizador mostra o vídeo e a página.
- ⚪ Grade de cartões, botões que aparecem ao passar o mouse e setas do teclado (← →): no celular é a lista, o menu da linha e o deslizar no visualizador.

---

## E-mail (31/10)

A gestão das caixas de e-mail (`/email`: caixas, senhas, apelidos, redirecionamentos, aparelhos e DNS) fica só na web nesta fase: é da equipe da Anuntech, e o app é do cliente. Quando o Administrador da empresa passar a gerenciar o próprio domínio (fase 2, `docs/task.md`), entram no app a lista de caixas, a troca de senha com a senha mostrada uma vez e o perfil para iPhone (que o próprio iPhone instala), pela API `/api/v1` com `guard()`. Ler e enviar e-mail continuam nos aplicativos de e-mail do celular.

## Publicação

1. Servidor no `main` (migrações, se houver, pela rota temporária).
2. As telas que só usam JavaScript vão por atualização automática (OTA) na 1.1.0.
3. O que traz módulo nativo novo (documentos, gravação de voz) vai numa versão 1.2.0 para a App Store.
