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
- O endereço completo é obrigatório para emitir cobrança. O servidor sempre usa o endereço salvo no cadastro.
- Preferência "Emitir nota fiscal automaticamente" por empresa, só a equipe altera. Hoje é apenas registrada; nenhuma nota é emitida.
- Arquivar tira a empresa da lista sem mexer em acessos, faturas, contratos ou chamados. Excluir de vez só é possível quando a empresa não tem nada que precise ser guardado (regras em `lib/deletion-rules.ts`).
- A equipe pode entrar como a empresa para ver o que o cliente vê.

### Membros

- Administradores da empresa adicionam, mudam o papel e removem pessoas da própria empresa. A equipe faz o mesmo em qualquer empresa; o dono cuida da equipe Anuntech.
- Adicionar uma pessoa envia um e-mail com o link de entrada. Ela aparece como convidada até o primeiro acesso.
- Ninguém remove nem rebaixa o próprio acesso, e ninguém remove o último administrador de uma empresa.

### Chamados

- Assunto, descrição, produto ou projeto opcional e até 5 anexos (PDF, PNG, JPEG ou WebP; 20 MB no total). Fotos são reduzidas antes do envio.
- Situações: aberto, em atendimento, aguardando cliente, resolvido e encerrado. Prioridade normal ou alta. Responsável da equipe.
- Quem abre recebe um recibo por e-mail e é avisado das movimentações. A operação Anuntech recebe avisos por e-mail e WhatsApp de toda movimentação (liga e desliga em Configurações → Notificações). A empresa pode escolher contatos para receber os avisos dela.

### Projetos, produtos e serviços

- Cada empresa tem vínculos do tipo produto, projeto ou serviço, com situação ativa, pausada ou concluída.
- Projetos têm quadro Kanban: backlog, a fazer, em andamento, revisão e concluído. Tarefas com prioridade, prazo, etiquetas, estimativa, responsáveis (membros da empresa e equipe), anexos e comentários (com anexos, edição e exclusão pelo autor).
- O catálogo da equipe define produtos e serviços com preço e periodicidade. Vincular um item a uma empresa cria o vínculo e, se for o caso, a cobrança.

### Financeiro

- A equipe cria cada cobrança manualmente: única ou recorrente (mensal ou anual), com cliente, produto, valor, vencimento e condições (desconto até o vencimento, multa e juros ao mês).
- Rascunho não vai ao banco. Publicar emite no Inter um boleto com Pix. Uma recorrência publicada emite cada período 5 dias antes do vencimento e mantém o dia de referência nos meses mais curtos.
- Vencimento no passado exige uma data futura para o boleto; a fatura fica registrada como vencida desde a data original.
- Cada cobrança emitida tem um link público `/pagar/<id>` com QR Code Pix, copia e cola e boleto em PDF. O link não mostra documento nem e-mail do cliente e pode ser desativado. Pago, a página troca sozinha para "Pagamento confirmado".
- Avisos por e-mail e WhatsApp: fatura disponível, vence hoje e lembretes de atraso nos dias 5, 10, 15, 20 e 25. Antes de cada aviso o Console consulta o Inter para não cobrar quem já pagou.
- Só o Inter confirma pagamento (situação `RECEBIDO`), por consulta manual ou pela conciliação a cada 5 minutos. O navegador nunca confirma pagamento.
- Editar uma cobrança emitida (valor, vencimento ou condições) cancela o boleto e o Pix atuais e emite novos; o link continua o mesmo.
- Financeiro → Envios mostra cada aviso: aceito pelo provedor, entregue, falhou ou incerto, com reenvio manual.
- A equipe pode excluir de vez um rascunho que nunca foi ao Inter e uma cobrança que o próprio Inter cancelou (cancelada, expirada ou com falha de emissão). Fatura paga ou com nota fiscal nunca é excluída, e a exclusão não deixa uma recorrência cobrar o mesmo período de novo. A atividade guarda o registro.

### Contratos

- Modelos com variáveis (`{{empresa}}`, `{{cnpj}}`, `{{valor}}`, `{{inicio}}`, `{{fim}}`…) preenchidas pelo cadastro.
- O contrato nasce rascunho, só a equipe vê. Enviar congela o texto numa versão com hash e avisa os administradores da empresa por e-mail.
- Assinatura eletrônica no próprio Console, com registro de quem assinou, quando e em qual versão. Com as duas partes assinadas, o PDF final é guardado.
- Voltar para rascunho mantém a versão enviada no histórico; o próximo envio é uma versão nova, assinada de novo.
- Aditivos a contratos assinados, vigência com início e fim, aviso 30 dias antes do fim e no vencimento.

### Orçamentos

- Propostas por fases, numeradas por ano, com PDF.
- Valor = horas máximas × taxa/hora, menos o desconto negociado (opcional, em reais, nunca maior que o valor das horas; no editor fica recolhido em "Adicionar desconto"). Entrada e saldo são calculados sobre o valor com desconto, e a proposta mostra o valor das horas e o desconto. Ao copiar um orçamento para outra empresa pelo assistente, o desconto não vai junto.
- Enviar congela a versão e avisa os administradores da empresa, que aceitam ou recusam no Console. Rascunho pode ser duplicado; proposta enviada pode voltar para edição ou ser retirada.

### Bookmarks

- Links e arquivos privados organizados em pastas pessoais. Uma pasta pode ser vista pela empresa inteira ou só por pessoas escolhidas.
- Busca, paginação (10, 25, 50 ou 100 por página) e visualização em lista ou grade. A escolha de visualização fica salva para a pessoa.

### Assistente

- Chat em todas as telas, aberto pelo botão do dock. Em telas largas fica ao lado do conteúdo.
- Responde e age com o acesso da pessoa: consulta empresas, faturas, chamados, projetos, contratos e orçamentos; abre chamados, cria tarefas, comenta, rascunha cobranças, contratos e orçamentos; preenche a tela atual.
- Antes de alterar qualquer dado, pergunta. Um "sim" direto aprova; respostas com condição passam por uma segunda leitura (Jev).
- A equipe escolhe o modelo, escreve instruções extras e sobe documentos de conhecimento em Configurações → Assistente.

### Notificações e rotinas da equipe

- Cada empresa define até 10 e-mails e 10 telefones por assunto (Financeiro e Chamados), com canais independentes. Esses contatos não ganham acesso ao Console.
- A equipe recebe todo dia um resumo da manhã (emissões e pagamentos das últimas 24 horas, recorrências pausadas, falhas de aviso, atrasos e contratos perto do fim) e alertas de falhas operacionais.

## Requisitos transversais

- Português do Brasil, valores em reais (R$ 31.900,00), datas dd/mm/aaaa e dia atual pelo horário de São Paulo.
- Autorização no servidor em toda operação; um registro de outra empresa aparece como "não encontrado".
- Nada de sucesso simulado: pagamento só com confirmação do Inter; nota fiscal só quando a integração existir.
- Idempotência em tudo que sai do Console: emissão bancária, e-mails e WhatsApp.
- Auditoria de toda alteração relevante.
- Acessibilidade WCAG 2.2 AA como referência (ver [design.md](design.md)).

## Fora do escopo agora

- Emissão de nota fiscal (Focus NFe está conectado, faltam os parâmetros fiscais).
- Cartão de crédito.
- Webhook do Inter (a conciliação é por consulta a cada 5 minutos).
- Relatórios (ainda sem especificação).
- Cadastro de empresa pelo próprio cliente por link (existiu e foi removido em 21/09/2026).
