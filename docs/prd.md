# PRD do Console

O que o Console é, para quem, o que já faz e o que ainda não faz. Este documento descreve o produto em produção em console.anuntech.com. Decisões antigas e o raciocínio de cada fase estão em [memory.md](memory.md); o que falta fazer, em [task.md](task.md).

## Visão

O Console é o portal onde a Anuntech atende os clientes de produtos e projetos e onde a equipe opera o dia a dia: cadastro de clientes, chamados, projetos, cobrança, contratos e orçamentos. O cliente entra para acompanhar o que contratou, falar com a equipe e pagar. A equipe entra para fazer tudo isso em nome de todos os clientes.

Objetivos:

1. Um único lugar para o cliente ver produtos, projetos, chamados, faturas e documentos da própria empresa.
2. Cobrança com boleto e Pix sem planilha: a equipe cria, o Inter emite, o Console avisa e confirma o pagamento.
3. Atendimento rastreável, com histórico, anexos e avisos por e-mail e WhatsApp.
4. Contratos e orçamentos enviados, assinados e respondidos dentro do Console, com versão e prova de cada envio.
5. Um assistente que lê e age com o mesmo acesso da pessoa.

## Pessoas e ambientes

Cada conta pertence a um ambiente só: a operação Anuntech ou uma empresa cliente.

| Pessoa | Ambiente | O que pode |
| --- | --- | --- |
| Dono do Console | Anuntech | Tudo, e é o único que concede ou retira administração da equipe |
| Equipe Anuntech | Anuntech | Todos os clientes e todas as áreas, catálogo, modelos, integrações e assistente |
| Administrador da empresa | Cliente | Tudo da própria empresa: financeiro, contratos, orçamentos, membros, dados e notificações |
| Membro da empresa | Cliente | Visão geral, chamados, projetos, produtos e bookmarks da própria empresa |

Entrar não dá acesso a nada: a equipe ou um administrador da empresa precisa adicionar a pessoa. Toda leitura e toda alteração é autorizada no servidor.

## Módulos

### Entrada e conta

- Entrada sem senha: código de 6 dígitos por e-mail ou WhatsApp já verificado, ou Google. Código vale 5 minutos, aceita 3 tentativas e só pode ser reenviado depois de 60 segundos (até 5 envios em 15 minutos por destino).
- Verificação em duas etapas opcional: quem entra por e-mail confirma no WhatsApp e vice-versa; no Google, a pessoa escolhe o canal.
- Minha conta: nome, e-mail principal (troca com código nos dois endereços), telefone (confirmado por WhatsApp), foto enviada ou avatar ilustrado (89 opções; toda conta nova recebe um aleatório).
- Segurança: últimas 20 sessões, com a atual destacada.
- Aparência: tema claro, escuro ou do sistema e posição do dock (embaixo, em cima, à esquerda, à direita). No celular o menu fica sempre embaixo.

### Painel

- Equipe: faturamento recebido e a receber por mês, pendências que precisam de atenção (cobranças em rascunho, falhas, atrasos), últimos chamados, últimas faturas e atividade recente.
- Cliente: faturas a pagar (com link de pagamento), pendências, projetos com progresso, produtos e serviços, últimos chamados e bookmarks.

### Empresas

- Cadastro com CPF ou CNPJ, razão social, e-mail financeiro, telefone e endereço de cobrança. CNPJ e CEP preenchem o resto sozinhos (CNPJ.ws e ViaCEP); tudo continua editável.
- O endereço completo é obrigatório para emitir cobrança. O servidor sempre usa o endereço salvo no cadastro. Uma regra só (`billing-readiness.ts`) diz o que falta, e o Console avisa antes da emissão: Próximas cobranças (com "Corrigir o cadastro"), resumo da manhã, painel da equipe, aceite do orçamento e envio do contrato. "Buscar na Receita" preenche só os campos de endereço vazios.
- O Administrador do cliente completa o endereço em Configurações → Dados da empresa (consulta só por CEP, 20 por hora); o passo aparece nos Primeiros passos dele enquanto faltar.
- Preferência "Emitir nota fiscal automaticamente" por empresa, só a equipe altera. Hoje é apenas registrada; nenhuma nota é emitida.
- Arquivar tira a empresa da lista sem mexer em acessos, faturas, contratos ou chamados. Excluir de vez só é possível quando a empresa não tem nada que precise ser guardado (regras em `lib/deletion-rules.ts`).
- A equipe pode entrar como a empresa para ver o que o cliente vê.

### Membros

- Administradores da empresa adicionam, mudam o papel e removem pessoas da própria empresa. A equipe faz o mesmo em qualquer empresa; o dono cuida da equipe Anuntech.
- Adicionar uma pessoa envia um e-mail com o link de entrada. Ela aparece como convidada até o primeiro acesso.
- Ninguém remove nem rebaixa o próprio acesso, e ninguém remove o último administrador de uma empresa.

### Chamados

- O cliente escolhe o tipo (Parou ou deu erro, Dúvida, Ajuste ou algo novo, Acesso, App ou projeto novo) e, para erro, o impacto. Depois assunto, descrição, produto ou projeto quando a empresa tem mais de um e até 5 anexos (PDF, PNG, JPEG ou WebP; 20 MB no total). O formulário mostra o que esperar: o horário para todos e o prazo de primeira resposta só onde a empresa tem condições publicadas.
- Situações: aberto, em atendimento, aguardando cliente (o cliente lê "Aguardando você"), resolvido e encerrado. Prioridade Normal, Alta ou Crítica, sempre definida pela equipe; o Console só sugere pelo impacto. Responsável da equipe. Pedidos que chegam por WhatsApp, telefone ou chat a equipe registra num chamado, com o canal de origem.
- A descrição aceita ditado: o botão Falar grava até 2 minutos, transcreve e põe o texto no campo para a pessoa revisar. Nada é enviado sozinho.
- Aguardando cliente exige dizer o que falta; o cliente vê no chamado e no e-mail. A resposta do cliente devolve o chamado à equipe (e reabre um resolvido).
- Condições de atendimento: a equipe copia de cada contrato os prazos e regras (primeira resposta e meta por nível, pausa enquanto espera o cliente, prazos do cliente, banco de horas, garantia, suspensão), com a cláusula de cada valor, a partir da ficha de cada modelo. Só condições conferidas valem; o cliente as vê a partir da data de publicação, a equipe antes. Cada chamado guarda as condições do momento em que foi aberto. Sem condições, nenhum prazo aparece.
- Dias úteis: segunda a sexta, menos feriados nacionais, Sexta-feira Santa e os feriados da sede (Configurações → Dados da empresa). 1 dia útil = 9 horas úteis (9h às 18h, Brasília).
- Banco de horas (quando o contrato tem): a equipe registra horas por chamado; além do banco só com aprovação de um Administrador da empresa (defeito crítico pode ir antes); aviso aos 80% no Console e por e-mail quando a equipe clica; relatório do mês enviado por clique e contestável no Console. Melhoria pequena sai do banco depois que o Administrador aprova a estimativa; acima do limite, orçamento.
- Quem abre recebe um recibo por e-mail e é avisado das movimentações. A operação Anuntech recebe avisos por e-mail e WhatsApp de toda movimentação (liga e desliga em Configurações → Notificações). A empresa pode escolher contatos para receber os avisos dela.

### Como trabalhamos

- Página /como-trabalhamos (menu da conta e folha Mais): quando abrir chamado, prazos e como o tempo conta, o que ajuda a equipe, projetos e como contratar algo novo. Para o cliente, mostra "Seus prazos" e "O que o seu contrato pede" das condições publicadas. Nenhum número fica escrito no texto: os prazos vêm das condições.
- Primeiros passos na Visão geral do cliente (Administrador: revisar acessos, escolher quem recebe avisos, ler o guia; Membro: completar nome e WhatsApp, ler o guia). Sai quando termina ou é ocultado.
- Pedir orçamento abre um chamado do tipo "App ou projeto novo" (fora do relógio de suporte). Depois do aceite e da assinatura, o cliente vê os próximos passos.

### Projetos, produtos e serviços

- Cada empresa tem vínculos do tipo produto, projeto ou serviço, com situação ativa, pausada ou concluída.
- Projetos têm quadro Kanban: backlog, a fazer, em andamento, revisão e concluído. Tarefa criada pelo cliente entra no Backlog como pedido até a equipe aceitar; só a equipe conclui; em Revisão, um Administrador da empresa aprova ou aponta um problema, com o prazo de teste do contrato quando houver. "Sobre este projeto" mostra o objetivo e as regras do quadro. Tarefas com prioridade, prazo, etiquetas, estimativa, responsáveis (membros da empresa e equipe), anexos e comentários (com anexos, edição e exclusão pelo autor).
- O catálogo da equipe define produtos e serviços com preço e periodicidade. Vincular um item a uma empresa cria o vínculo e, se for o caso, a cobrança.

### Financeiro

- A equipe cria cada cobrança manualmente: única ou recorrente (mensal ou anual), com cliente, produto, valor, vencimento e condições (desconto até o vencimento, multa e juros ao mês).
- Rascunho não vai ao banco. Publicar emite no Inter um boleto com Pix. Uma recorrência publicada emite cada período 5 dias antes do vencimento e mantém o dia de referência nos meses mais curtos.
- Recorrência mensal: assim que o Inter confirma o pagamento de um período, o próximo já é emitido (no máximo 45 dias antes do vencimento), para o cliente poder pagar quando quiser. O aviso "Nova fatura" continua saindo 5 dias antes do vencimento, às 8h. Quem tem fatura em aberto nessa recorrência, as anuais, as pausadas e as de produto ou serviço que não está ativo seguem o calendário de 5 dias. A opção pode ser desligada por recorrência em "Editar próximas cobranças", que também não aceita um vencimento dentro de um período já emitido.
- Próximas cobranças: o Financeiro e a Visão geral mostram o próximo vencimento de cada recorrência antes de a fatura existir, com valor e o dia em que boleto e Pix saem. A equipe vê também as recorrências pausadas e o motivo.
- "Cancelar no Inter" (só a equipe) cancela uma cobrança emitida e em aberto, por exemplo a próxima de um cliente que encerrou o serviço. Não tem volta; os avisos dela param e a recorrência fica pausada até alguém retomar.
- Vencimento no passado exige uma data futura para o boleto; a fatura fica registrada como vencida desde a data original.
- Cada cobrança emitida tem um link público `/pagar/<id>` com QR Code Pix, copia e cola e boleto em PDF. O link não mostra documento nem e-mail do cliente e pode ser desativado. Pago, a página troca sozinha para "Pagamento confirmado".
- Avisos por e-mail e WhatsApp: fatura disponível, vence hoje e lembretes de atraso nos dias 5, 10, 15, 20 e 25. Antes de cada aviso o Console consulta o Inter para não cobrar quem já pagou.
- Só o Inter confirma pagamento (situação `RECEBIDO`), por consulta manual ou pela conciliação a cada 5 minutos. O navegador nunca confirma pagamento.
- Editar uma cobrança emitida (valor, vencimento ou condições) cancela o boleto e o Pix atuais e emite novos; o link continua o mesmo.
- Financeiro → Envios mostra cada aviso: aceito pelo provedor, entregue, falhou ou incerto, com reenvio manual.
- Dívida expirada: quando o Inter encerra por prazo (`EXPIRADO`) uma cobrança que ninguém pagou nem cancelou, ela aparece para a equipe como "Expirada sem pagamento" (filtro próprio no Financeiro, resumo e painel), não como cancelada. Na fatura, "Cobrar de novo" abre uma cobrança avulsa com o mesmo valor e uma nova data para o boleto (o vencimento original continua registrado), e "Encerrar a dívida" pede o motivo. Cada dívida é decidida uma vez só. Sete dias antes de o Inter encerrar uma cobrança em aberto, o resumo avisa.
- Pausar ou concluir um projeto, produto ou serviço pergunta se a recorrência dele também pausa (marcado por padrão), para não cobrar quem saiu. O resumo lista as cobranças em aberto de vínculos encerrados ou contratos vencidos sem renovação.
- A equipe pode excluir de vez um rascunho que nunca foi ao Inter e uma cobrança que o próprio Inter cancelou (cancelada, expirada ou com falha de emissão). Fatura paga ou com nota fiscal nunca é excluída, e a exclusão não deixa uma recorrência cobrar o mesmo período de novo. A atividade guarda o registro.

### Contratos

- Modelos com variáveis (`{{empresa}}`, `{{cnpj}}`, `{{valor}}`, `{{inicio}}`, `{{fim}}`…) preenchidas pelo cadastro.
- O contrato nasce rascunho, só a equipe vê. Enviar congela o texto numa versão com hash e avisa os administradores da empresa por e-mail.
- Campos do contrato: no rascunho, cada `{{campo}}` que sobrou no texto aparece no topo, com o trecho onde está, uma sugestão quando o Console já sabe o valor (cadastro da empresa, produto vinculado, último orçamento aceito ou, sem ele, o último enviado, quem responde por cada lado). Enviar para assinatura recusa um texto salvo que ainda tenha algum `{{campo}}` e as ações Aplicar (o valor entra em todo lugar onde o campo aparece), Aplicar e salvar, Ver no texto e Remover do texto.
- Assinatura eletrônica no próprio Console, com registro de quem assinou, quando e em qual versão. Com as duas partes assinadas, o PDF final é guardado.
- Voltar para rascunho mantém a versão enviada no histórico; o próximo envio é uma versão nova, assinada de novo.
- **Rodadas de revisão:** enquanto o contrato espera assinatura, os administradores da empresa podem pedir alterações cláusula por cláusula, com o motivo e, se quiserem, o texto proposto. Os pedidos ficam guardados até o cliente enviar a rodada; aí o contrato vai para "Em revisão", a assinatura dessa versão é bloqueada e a equipe recebe um e-mail. A equipe aceita ou recusa cada pedido (recusar exige resposta); aceitar um texto proposto o aplica sozinho no rascunho quando a cláusula ainda está como o cliente leu. A próxima versão só sai com todos os pedidos respondidos; o cliente recebe um e-mail, vê o que mudou marcado na margem e a resposta a cada pedido, e assina ou abre outra rodada. Tudo fica no histórico, por versão.
- Aditivos a contratos assinados, vigência com início e fim, aviso 30 dias antes do fim e no vencimento. O aviso, o resumo da manhã e o contrato trazem "Preparar prorrogação": um aditivo com a nova vigência (do dia seguinte ao fim, pelo mesmo tempo) e a cláusula de prorrogação, em rascunho.
- Quando o cliente assina primeiro, a equipe recebe um e-mail e o painel mostra "Falta a assinatura da Anuntech".
- No contrato assinado, a equipe vê o orçamento de origem e prepara, a partir dele, a cobrança recorrente do item (valor, ciclo e dia de vencimento do contrato), as condições de atendimento em rascunho pela ficha do modelo (só valem depois de conferidas) e a prorrogação. Cada um é preparado uma vez; cancelar o rascunho da cobrança libera de novo.
- Enviar contrato ou orçamento para uma empresa sem Administrador pede o e-mail de quem vai assinar ou responder (sugere o e-mail financeiro). A pessoa recebe acesso como Administrador antes do envio; em branco, o envio sai sem avisar ninguém. O painel e o resumo listam os clientes sem Administrador que têm contrato, orçamento ou cobrança em aberto.

### Orçamentos

- Propostas por fases, numeradas por ano, com PDF.
- Valor = horas máximas × taxa/hora, menos o desconto negociado (opcional, em reais, nunca maior que o valor das horas; no editor fica recolhido em "Adicionar desconto"). Entrada e saldo são calculados sobre o valor com desconto, e a proposta mostra o valor das horas e o desconto. Ao copiar um orçamento para outra empresa pelo assistente, o desconto não vai junto.
- Enviar congela a versão e avisa os administradores da empresa, que aceitam ou recusam no Console. Rascunho pode ser duplicado; proposta enviada pode voltar para edição ou ser retirada.
- "Criar orçamento deste pedido" no chamado leva o pedido junto: o orçamento fica ligado ao chamado e a descrição vira o resumo. No orçamento, "Responder no chamado" abre o chamado com uma resposta pronta para cada momento (enviado, aceito, recusado), que a equipe revisa e envia.
- Orçamento aceito: "Próximos passos" com o contrato (o modelo de desenvolvimento, quando ativo, já com escopo, entregáveis, stack, prazo e valores do orçamento), o projeto (um cartão por tarefa em A fazer, com o código e a fase como etiqueta, depois de Acessos e Reunião de início, até 300 cartões, com confirmação) e as cobranças da entrada e do saldo em rascunho. Cada passo é feito uma vez e mostra o que já existe.

### Bookmarks

- Links e arquivos privados organizados em pastas pessoais. Uma pasta pode ser vista pela empresa inteira ou só por pessoas escolhidas.
- Busca, paginação (10, 25, 50 ou 100 por página) e visualização em lista ou grade. A escolha de visualização fica salva para a pessoa.

### Assistente

- Chat em todas as telas, aberto pelo botão do dock. Em telas largas fica ao lado do conteúdo.
- Responde e age com o acesso da pessoa: consulta empresas, faturas, chamados, projetos, contratos e orçamentos; abre chamados, cria tarefas, comenta, rascunha cobranças, contratos e orçamentos; preenche a tela atual.
- Antes de alterar qualquer dado, pergunta. Um "sim" direto aprova; respostas com condição passam por uma segunda leitura (Jev).
- Microfone no campo de mensagem: a pessoa fala, o texto aparece no campo e ela envia quando quiser. Depois de enviado, vale como mensagem digitada (o Jev lê a intenção).
- A equipe escolhe o modelo, escreve instruções extras e sobe documentos de conhecimento em Configurações → Assistente.

### Notificações e rotinas da equipe

- Cada empresa define até 10 e-mails e 10 telefones por assunto (Financeiro e Chamados), com canais independentes. Esses contatos não ganham acesso ao Console.
- A equipe recebe todo dia um resumo da manhã (emissões e pagamentos das últimas 24 horas, recorrências pausadas, emissões que vão falhar pelo cadastro, dívidas expiradas, cobranças que o Inter encerra em até 7 dias, cobranças de quem saiu, falhas de aviso, atrasos, contratos perto do fim, rotinas paradas, alertas que não chegam e o certificado do Inter perto de vencer) e alertas de falhas operacionais. O painel da equipe mostra os mesmos pontos em "Precisa de atenção".
- Seguimento comercial e de projetos, no resumo e no painel: contratos que esperam a Anuntech, orçamentos sem resposta perto de vencer (3 dias), expirados há até 30 dias ou sem validade há mais de 14, aceitos há mais de 3 dias sem contrato, contratos sem assinatura do cliente há mais de 7 dias, pedidos do cliente no Backlog há mais de 2 dias, entregas em Revisão com o prazo de teste das condições vencido e clientes sem Administrador. Só lista e leva ao item; nada vai ao cliente. Os limites ficam em `lib/commercial/follow-up.ts`.

## Requisitos transversais

- Português do Brasil, valores em reais (R$ 31.900,00), datas dd/mm/aaaa e dia atual pelo horário de São Paulo.
- Autorização no servidor em toda operação; um registro de outra empresa aparece como "não encontrado".
- Nada de sucesso simulado: pagamento só com confirmação do Inter; nota fiscal só quando a integração existir.
- Idempotência em tudo que sai do Console: emissão bancária, e-mails e WhatsApp.
- Auditoria de toda alteração relevante.
- Voz: o áudio do ditado vai para transcrição no OpenRouter, só com provedores de retenção zero, e não é guardado em lugar nenhum. Fica no Console apenas o texto que a pessoa envia. Limites: 2 minutos por gravação e 30 transcrições por pessoa por hora.
- Acessibilidade WCAG 2.2 AA como referência (ver [design.md](design.md)).

## Fora do escopo agora

- Emissão de nota fiscal (Focus NFe está conectado, faltam os parâmetros fiscais).
- Cartão de crédito.
- Webhook do Inter (a conciliação é por consulta a cada 5 minutos).
- Relatórios (ainda sem especificação).
- Cadastro de empresa pelo próprio cliente por link (existiu e foi removido em 21/09/2026).
