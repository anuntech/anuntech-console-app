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

- [ ] **F1** Cartões de total com contagem e o cartão "Pagas"; contagem no título.
- [ ] **F2** Período: Todo, Este mês, Mês passado, Próximos 30 dias, Este ano.
- [ ] **F3** Busca por descrição e empresa.
- [ ] **F4** Dias de atraso na linha e no detalhe.
- [ ] **F5** Marca de recorrência (mensal/anual) na linha e no detalhe.
- [ ] **F6** Copiar e compartilhar o link de pagamento.
- [ ] **F7** Próximas cobranças (valor, vencimento, "Boleto e Pix chegam até…").
- [ ] **F8** Detalhe: vencimento do boleto quando difere ("Boleto e Pix válidos até…").
- [ ] **F9** Detalhe: pagador com CPF/CNPJ.
- [ ] **F10** Detalhe: próxima cobrança da recorrência ou o período já emitido.
- [ ] **F11** Detalhe: condições (desconto até o vencimento, multa e juros).
- [ ] **F12** Detalhe: nota fiscal (emitida com link, em andamento, ainda não solicitada).
- [ ] **F13** Detalhe: "O Inter ainda está preparando o boleto e o Pix" quando faltam.
- [ ] **F14** Detalhe: atualizar sozinho enquanto em aberto (consulta periódica, ao voltar ao app e puxar para atualizar), com aviso de "Pagamento confirmado".
- [ ] **F15** Boleto PDF pela sessão (`/api/boletos/<id>`) quando o link público estiver desligado.
- [ ] **F16** Detalhe: "Criada em" e "Última consulta ao banco".
- ⚪ Recibo e cartão: não existem no produto. QR Code do Pix: serve para pagar de outro aparelho; no celular, copiar e colar.

## Frente 3 — Contratos e orçamentos (Administrador)

- [ ] **K1** Contratos: filtro de situação (Aguardando assinatura, Em revisão, Assinados) e busca.
- [ ] **K2** Linha: "Falta a sua assinatura" / "Falta a da Anuntech", vigência ("Vence em N dias"), "Aditivo de <contrato>".
- [ ] **K3** **Pedir alteração por cláusula**: escrever (comentário e texto proposto), editar, descartar e enviar a rodada à Anuntech.
- [ ] **K4** Pedidos em revisão e histórico de revisões com a resposta da Anuntech (Aceito/Recusado, aplicado).
- [ ] **K5** Aviso ao assinar com pedidos não enviados.
- [ ] **K6** Mudanças desde a versão anterior (marcadas no texto).
- [ ] **K7** Versões anteriores com o PDF de cada uma.
- [ ] **K8** Aditivos do contrato e link para o contrato original.
- [ ] **K9** Vigência com estado (começa, vence, vencido) e o texto do aditivo.
- [ ] **K10** "Enviado em", modelo e próximos passos depois de assinado.
- [ ] **Q1** Orçamentos: filtro de situação (Aguardando resposta, Aceitos, Recusados, Expirados) e busca.
- [ ] **Q2** **Pedir orçamento** na lista (abre chamado "App ou projeto novo" já escolhido).
- [ ] **Q3** Detalhe: tecnologias, valor da hora, desconto negociado, semanas por fase, tarefas com descrição.
- [ ] **Q4** Detalhe: "faltam N dias", "Enviado em", e-mail de quem respondeu.
- [ ] **Q5** Versões anteriores com PDF.
- [ ] **Q6** Próximos passos depois de aceito (contrato, entrada, acessos).

## Frente 4 — Projetos

- [ ] **P1** Lista: filtro de situação (Ativos, Pausados, Concluídos, Todas) — hoje pausados e concluídos não aparecem — e busca.
- [ ] **P2** Cartão: prioridade, etiquetas, estimativa, anexos, atraso e o selo "Pedido do cliente".
- [ ] **P3** Busca e filtros do quadro (pessoa, etiqueta, prioridade).
- [ ] **P4** **Detalhe da tarefa**: descrição completa, criador, atualizada há, prioridade, responsáveis, prazo, estimativa, etiquetas, coluna.
- [ ] **P5** Comentários: ler, escrever (com arquivos), editar e apagar os próprios.
- [ ] **P6** Anexos da tarefa: ver, baixar, anexar e remover (quem anexou ou o criador).
- [ ] **P7** **Criar pedido** (o cliente cria no Backlog como "pedido").
- [ ] **P8** Editar tarefa e mudar a coluna, com as regras do cliente (não conclui, não põe em Revisão, não tira de Revisão nem de Concluído).
- [ ] **P9** Excluir tarefa (quem criou).
- [ ] **P10** Atividade do projeto.
- [ ] **P11** "Sobre este projeto" com o texto de como o quadro funciona.
- ⚪ Arrastar cartões entre colunas: no celular, a coluna muda no detalhe da tarefa.

## Frente 5 — Bookmarks

- [ ] **B1** Chip "Sem pasta", paginação além de 100, tamanho e data dos arquivos, quem vê cada pasta.
- [ ] **B2** Novo link (empresa, pasta, título, endereço) e novo arquivo (enviar do celular).
- [ ] **B3** Editar, mover para outra pasta e excluir (quem salvou ou o dono da pasta).
- [ ] **B4** Nova pasta, renomear, compartilhar (empresa toda ou pessoas escolhidas) e excluir (o dono).
- [ ] **B5** Lousa: ver em tela cheia com zoom.
- ⚪ Desenhar na lousa (editor Excalidraw para tela grande e mouse): no celular só ver; "Abrir no Console" para editar.

## Frente 6 — Início, produtos, banco de horas e apps

- [ ] **H1** "Precisa de atenção": orçamentos para responder, contratos para assinar, estimativas para aprovar, entregas para revisar, produto suspenso.
- [ ] **H2** Projetos (até 4, com progresso), Produtos e serviços (até 5) e Bookmarks (até 5) no Início.
- [ ] **H3** "Nada a pagar" com a próxima cobrança.
- [ ] **H4** Esconder e mostrar valores (olho), guardado no aparelho.
- [ ] **S1** **Produtos e serviços**: lista (filtro de situação, busca), situação, preço e vencimento (Administrador).
- [ ] **S2** Detalhe do serviço (o que fazemos, o que precisamos de você, resultados, prazos), cobrança (Administrador) e "Abrir chamado" já com o serviço.
- [ ] **S3** Aviso de produto suspenso com "Pagar agora" e "Falar com a equipe".
- [ ] **S4** Abrir o app de um produto (CMS e outros) com o passe do Console, no navegador do app; telas de bloqueio com o motivo.
- [ ] **S5** Banco de horas: uso do mês, lançamentos recentes, horas extras aprovadas, relatório mensal.
- [ ] **S6** Aprovar horas além do banco (Administrador).
- [ ] **S7** Contestar o relatório mensal (Administrador).
- ⚪ Contratar direto pelo catálogo: não existe na web (o catálogo é da equipe). Hoje contratar é pedir orçamento → aceitar → assinar, que o app passa a fazer inteiro (Q2, K3). Abrir o catálogo ao cliente é decisão de produto à parte.

## Frente 7 — Ajuda, Como trabalhamos e primeiros passos

- [x] **A1** **Ajuda**: busca, vídeos, assuntos, perguntas frequentes. (`help.home`, `help.search`; tela `/ajuda` sobre as abas, aberta pela Conta)
- [x] **A2** Ler artigo (seções, passos, notas, perguntas, links internos que abrem a tela do app), aviso ao Membro em artigo de Administrador, relacionados. (`help.get`; `/ajuda/[slug]`, aberta de qualquer aba por `openHelp`)
- 🟡 **A3** Vídeos tutoriais com capítulos e transcrição. Falta o player dentro do app: sem `expo-video`, o vídeo abre no navegador do app (cada capítulo e cada linha da transcrição abrem no segundo certo); capítulos e transcrição aparecem como texto.
- [x] **A4** "Não encontrou?": perguntar ao assistente, abrir chamado (Dúvida), falar com a equipe (WhatsApp). (O assistente abre sem a pergunta preenchida: a tela não aceita esse parâmetro.)
- [x] **A5** **Como trabalhamos**: o guia, os prazos e o que o contrato pede de cada empresa; marcar como lido. (`guide.get`, `guide.markRead`; `/como-trabalhamos`, pela Conta e pela Ajuda)
- [x] **A6** Primeiros passos no Início (Administrador e Membro têm passos diferentes) e "Ocultar". (`guide.firstSteps`, `guide.markStep`; `components/first-steps-card.tsx` pronto, o integrador põe no Início)
- 🟡 **A7** Links de ajuda nas telas ("Como pagar", "Como assinar e pedir alteração", "Como funciona o aceite", "Como contamos o tempo"). As rotas existem (`/ajuda/[slug]`, `/como-trabalhamos`); os links entram pelas outras frentes com `openHelp(slug)`.

## Frente 8 — Conta, notificações e assistente

- [ ] **C1** Aparência: Claro, Escuro ou Sistema.
- [ ] **C2** Notificações: histórico de envios (Administrador).
- [ ] **C3** Assistente: sugestões conforme o papel (o Membro não vê "faturas").
- [ ] **C4** Assistente: atalhos fixos sob a caixa (Abrir chamado, Ajuda).
- [ ] **C5** Assistente e chamados: ditado por voz com a mesma transcrição da web (`/api/v1/transcricao`).
- [ ] **C6** "Falar com alguém da Anuntech": WhatsApp da equipe em vez de só "Abrir chamado".
- ⚪ Preencher ou clicar na tela pelo assistente (depende da página web), tempo e tokens por resposta, posição do dock, lista ou grade.

---

## Publicação

1. Servidor no `main` (migrações, se houver, pela rota temporária).
2. As telas que só usam JavaScript vão por atualização automática (OTA) na 1.1.0.
3. O que traz módulo nativo novo (documentos, gravação de voz) vai numa versão 1.2.0 para a App Store.
