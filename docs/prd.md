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
| Membro da empresa | Cliente | Visão geral, chamados, projetos, produtos e bookmarks da própria empresa, sem valores nem vencimentos; o Administrador pode limitar a alguns produtos, serviços e projetos |

Entrar não dá acesso a nada: a equipe ou um administrador da empresa precisa adicionar a pessoa. Toda leitura e toda alteração é autorizada no servidor.

## Módulos

### Entrada e conta

- Entrada sem senha: código de 6 dígitos por e-mail ou WhatsApp já verificado, ou Google. Código vale 5 minutos, aceita 3 tentativas e só pode ser reenviado depois de 60 segundos (até 5 envios em 15 minutos por destino).
- Verificação em duas etapas opcional: quem entra por e-mail confirma no WhatsApp e vice-versa; no Google, a pessoa escolhe o canal.
- Depois de entrar, a pessoa vai para a Visão geral. Quem chegou pelo link de um app (`/entrar?volta=/abrir/<app>`, desde 14/10/2026) volta para o app, entre pelo código, pelo Google ou pela segunda etapa. O `volta` só aceita caminho de app do próprio Console (`/abrir/<app>` ou `/apps/<produto>`); qualquer outro valor é ignorado.
- Minha conta: nome, e-mail principal (troca com código nos dois endereços), telefone (confirmado por WhatsApp), foto enviada ou avatar ilustrado (89 opções; toda conta nova recebe um aleatório).
- Segurança: últimas 20 sessões, com a atual destacada.
- Aparência: tema claro, escuro ou do sistema e posição do dock (embaixo, em cima, à esquerda, à direita). No celular o menu fica sempre embaixo.

### Painel

- Equipe: faturamento recebido e a receber por mês, pendências que precisam de atenção (cobranças em rascunho, falhas, atrasos), últimos chamados, últimas faturas e atividade recente.
- Cliente: faturas a pagar (com link de pagamento), pendências, projetos com progresso, produtos e serviços, últimos chamados e bookmarks.

### Empresas

- Cadastro com CPF ou CNPJ, razão social, e-mail financeiro, telefone e endereço de cobrança. CNPJ e CEP preenchem o resto sozinhos (CNPJ.ws e ViaCEP); tudo continua editável.
- O endereço completo é obrigatório para emitir cobrança. O servidor sempre usa o endereço salvo no cadastro. Uma regra só (`billing-readiness.ts`) diz o que falta, e o Console avisa antes da emissão: Recorrências para corrigir, no Financeiro (com "Corrigir o cadastro"), resumo da manhã, painel da equipe, aceite do orçamento e envio do contrato. "Buscar na Receita" preenche só os campos de endereço vazios.
- O Administrador do cliente completa o endereço em Configurações → Dados da empresa (consulta só por CEP, 20 por hora); o passo aparece nos Primeiros passos dele enquanto faltar.
- Preferência "Emitir nota fiscal automaticamente" por empresa, só a equipe altera. Hoje é apenas registrada; nenhuma nota é emitida.
- Arquivar tira a empresa da lista. O diálogo mostra o que ainda está ativo (recorrências, vínculos, acessos, faturas em aberto, contratos em vigência, chamados abertos) e deixa marcar o que encerra junto: pausar as recorrências, concluir os vínculos, revogar os acessos (de todos, o último Administrador incluído). Só o que foi marcado acontece, e restaurar não desfaz; cancelar no Inter continua sendo pela fatura. O Arquivar do menu da lista abre esse mesmo diálogo na página da empresa. Excluir de vez só é possível quando a empresa não tem nada que precise ser guardado (regras em `lib/deletion-rules.ts`).
- Quando o cliente muda o próprio cadastro (razão social, documento, e-mail financeiro, telefone ou endereço), a equipe recebe um e-mail com o antes e o depois, e o aviso de que a próxima cobrança não sai se o cadastro ficou incompleto.
- Implantação (só a equipe, na página de um cliente ativo dos últimos 90 dias): o que falta para o cliente novo andar sozinho, calculado dos dados (cadastro para cobrar, Administrador convidado e já entrou, contatos de cobrança, vínculo, contrato assinado, condições conferidas, primeira cobrança). O painel e o resumo listam os clientes dos últimos 90 dias com passos faltando, os contatos para revisar (telefone fixo como WhatsApp, e-mail da Anuntech como contato do cliente, e-mail financeiro fora dos avisos, documento com dígito inválido, aviso de cobrança que não chegou em 30 dias) e os acessos para revisar (sem entrar há 90 dias, em empresa arquivada, ou da equipe).
- Configurações → Limpeza (só a equipe) lista os registros com cara de teste (nome com teste, QA, exemplo; e-mail @example ou .invalid; documento inválido), filhos antes da empresa. Cada um abre na própria página, onde Excluir segue as regras de sempre, ou sai da lista com "Não é teste".
- A equipe pode entrar como a empresa para ver o que o cliente vê.

### Membros

- Administradores da empresa adicionam, mudam o papel e removem pessoas da própria empresa. A equipe faz o mesmo em qualquer empresa; o dono cuida da equipe Anuntech.
- Adicionar uma pessoa envia um e-mail com o link de entrada. Ela aparece como convidada até o primeiro acesso. O Console confere a entrega do convite (entregue, não chegou); "Reenviar convite", no menu da pessoa, vale uma vez por semana. Convites sem primeiro acesso há 3 dias entram no painel e no resumo da equipe.
- A cada 6 meses, o passo "Revise quem tem acesso" volta para o Administrador do cliente, mesmo com os Primeiros passos ocultos.
- Ninguém remove nem rebaixa o próprio acesso, e ninguém remove o último administrador de uma empresa.
- "O que esta pessoa vê" (no convite, em Editar permissão e no menu da pessoa, para Membros; o Administrador em Configurações → Membros e a equipe na página da empresa): Tudo da empresa (o padrão, inclusive o que entrar depois) ou Só o que eu escolher, marcando produtos, serviços e projetos. Com escolha, a pessoa só vê esses itens em Produtos, apps abertos no Console (`/apps`, `/abrir`), Projetos (quadro, tarefas, anexos e responsáveis), Visão geral, formulário de chamado, Como trabalhamos, banco de horas e assistente; chamados sobre os outros itens somem, menos os que ela abriu, e chamados sem produto continuam visíveis. Nada marcado mostra nada, nunca tudo. Item novo só aparece quando o Administrador marca. Salvar o papel sem mexer na escolha a mantém; remover o acesso a apaga. A lista mostra "Vê: Tudo da empresa" ou "Vê: 3 itens".

### Chamados

- O cliente escolhe o tipo (Parou ou deu erro, Dúvida, Ajuste ou algo novo, Acesso, App ou projeto novo) e, para erro, o impacto. Depois assunto, descrição, produto ou projeto quando a empresa tem mais de um e até 5 anexos (PDF, PNG, JPEG ou WebP; 20 MB no total). O formulário mostra o que esperar: o horário para todos e o prazo de primeira resposta só onde a empresa tem condições publicadas.
- Situações: aberto, em atendimento, aguardando cliente (o cliente lê "Aguardando você"), resolvido e encerrado. Prioridade Normal, Alta ou Crítica, sempre definida pela equipe; o Console só sugere pelo impacto. Depois da abertura, o Jev lê o assunto e a descrição: quando o texto parece mais grave do que o marcado (uma "Dúvida" que diz que o sistema parou), só a equipe vê no chamado a prioridade sugerida, com um clique para aplicar ou manter a atual, e um "Parou tudo" provável manda e-mail à equipe na hora. Responsável da equipe: o chamado nasce com o responsável habitual quando há um (quem da equipe o registrou, ou quem atendeu o último chamado daquele cliente ou daquele produto e ainda está na equipe). Pedidos que chegam por WhatsApp, telefone ou chat a equipe registra num chamado, com o canal de origem.
- A descrição aceita ditado: o botão Falar grava até 2 minutos, transcreve e põe o texto no campo para a pessoa revisar. Nada é enviado sozinho.
- Aguardando cliente exige dizer o que falta; o cliente vê no chamado e no e-mail. A resposta do cliente devolve o chamado à equipe (e reabre um resolvido). Parado além dos dias que as condições dão ao cliente (5 sem condições), o chamado entra no resumo e no painel, e a equipe pode "Lembrar o cliente" (uma vez por dia; vai para quem abriu, enquanto ainda tem acesso à empresa e não é da equipe, e para os contatos de Chamados da empresa) ou "Resolver por falta de resposta" (mensagem padrão no chamado e no aviso; a resposta do cliente reabre).
- Primeira resposta: 60 minutos antes do prazo e quando ele estoura, o responsável (ou a equipe toda, sem responsável) recebe um e-mail, uma vez por prazo. Só uma resposta escrita no chamado para o relógio.
- "Sugerir resposta" (só a equipe) escreve um rascunho a partir da conversa e das condições da empresa, na voz da Anuntech, sem prometer prazo ou valor fora delas. O texto vai para a caixa de resposta; a pessoa edita e envia.
- Condições de atendimento: a equipe copia de cada contrato os prazos e regras (primeira resposta e meta por nível, pausa enquanto espera o cliente, prazos do cliente, banco de horas, garantia, suspensão), com a cláusula de cada valor, a partir da ficha de cada modelo. Só condições conferidas valem; o cliente as vê a partir da data de publicação, a equipe antes. Cada chamado guarda as condições do momento em que foi aberto. Sem condições, nenhum prazo aparece.
- Dias úteis: segunda a sexta, menos feriados nacionais, Sexta-feira Santa e os feriados da sede (Configurações → Dados da empresa). 1 dia útil = 9 horas úteis (9h às 18h, Brasília).
- Banco de horas (quando o contrato tem): a equipe registra horas por chamado; além do banco só com aprovação de um Administrador da empresa (defeito crítico pode ir antes); aviso aos 80% no Console e por e-mail quando a equipe clica, uma vez por mês (o card mostra quando saiu); relatório do mês enviado por clique e contestável no Console. Avisos e relatórios pendentes entram no resumo e no painel. Melhoria pequena sai do banco depois que o Administrador aprova a estimativa; acima do limite, orçamento; estimativa sem resposta há mais de 5 dias aparece para a equipe.
- O valor da hora excedente fica nas condições. Fechado o mês, enviado o relatório e passado o prazo de contestação sem contestação, o card do banco, o resumo e o painel mostram o excedente (horas × valor) com o atalho que abre a cobrança preenchida, uma vez por mês. Só conta o relatório final, enviado depois do fim do mês e das últimas horas registradas; os 3 últimos meses fechados entram nas listas, e o card oferece o envio e a cobrança de cada um. O excedente usa o banco e o valor do relatório que o cliente recebeu, não as condições de hoje.
- A equipe registra horas também pelo assistente (registrar_horas), por texto ou ditado, com as mesmas regras do formulário. Chamados terminados sem horas em empresas com banco aparecem no resumo e no painel por 7 dias, e no chamado até alguém registrar ou marcar "Não houve horas neste chamado".
- Quem abre recebe um recibo por e-mail e é avisado das movimentações. A operação Anuntech recebe avisos por e-mail e WhatsApp de toda movimentação (liga e desliga em Configurações → Notificações). A empresa pode escolher contatos para receber os avisos dela.

### Ajuda

- Página /ajuda (menu da conta e folha Mais, no lugar de "Como trabalhamos"; sem botão próprio no dock): um artigo para cada coisa que o cliente faz no Console, com o que é, quem pode (o que só o Administrador faz fica marcado; o Membro lê tudo para entender o processo), onde fica, o passo a passo com os nomes da tela, as regras e as perguntas frequentes. Busca sem acento, com sinônimos ("boleto" acha o pagamento). Tutoriais em vídeo com os passos como capítulos, velocidade e o texto da narração; os vídeos só mostram dados fictícios.
- Como a ajuda chega a quem precisa: no formulário de chamado, "Talvez isto responda" mostra até 3 artigos pelo assunto e pela descrição (abrem por cima, sem perder o que foi escrito, e nunca impedem o envio); o assistente procura na ajuda (buscar_ajuda) e responde com os passos e o link do artigo; links curtos nas telas (Como pagar, Como funciona o aceite, Como assinar, Membro ou Administrador, Quando cada aviso chega); "Ajuda" nos atalhos do assistente.
- Prazos nunca ficam escritos na ajuda: o artigo leva a Como trabalhamos, que mostra os do contrato da empresa.

### Como trabalhamos

- Página /como-trabalhamos (na Ajuda e nos links de chamado, projeto e contrato): quando abrir chamado, prazos e como o tempo conta, o que ajuda a equipe, projetos e como contratar algo novo. Para o cliente, mostra "Seus prazos" e "O que o seu contrato pede" das condições publicadas. Nenhum número fica escrito no texto: os prazos vêm das condições.
- Primeiros passos na Visão geral do cliente (Administrador: revisar acessos, escolher quem recebe avisos, ler o guia; Membro: completar nome e WhatsApp, ler o guia). Sai quando termina ou é ocultado.
- Pedir orçamento abre um chamado do tipo "App ou projeto novo" (fora do relógio de suporte). Depois do aceite e da assinatura, o cliente vê os próximos passos.

### Projetos, produtos e serviços

- Cada empresa tem vínculos do tipo produto, projeto ou serviço, com situação ativa, pausada ou concluída.
- Produtos e serviços, para o cliente: um lançador com o ícone do item, o nome, uma linha e o que o clique faz (Abrir ↗ para produto com link, Ver detalhes para serviço, Link em breve sem link), sem valor e sem menu; a situação aparece só quando não está ativo. No celular viram linhas. Lista curta sem nada pausado não mostra busca nem filtro. Valor e próximo vencimento só para a equipe e para o Administrador da empresa (na Lista e na página do serviço); um Membro não recebe esses dados nem nos dados da página.
- Projetos têm quadro Kanban: backlog, a fazer, em andamento, revisão e concluído. Tarefa criada pelo cliente entra no Backlog como pedido até a equipe aceitar; só a equipe conclui e só a equipe reabre uma tarefa concluída (tirar de Concluído apagaria quem aprovou e quando); em Revisão, um Administrador da empresa aprova ou aponta um problema, com o prazo de teste do contrato quando houver. "Sobre este projeto" mostra o objetivo e as regras do quadro. Tarefas com prioridade, prazo, etiquetas, estimativa, responsáveis (membros da empresa e equipe), anexos e comentários (com anexos, edição e exclusão pelo autor).
- O catálogo da equipe define produtos e serviços com preço e periodicidade. Vincular um item a uma empresa cria o vínculo e, se for o caso, a cobrança.
- Cada item do catálogo tem um ícone, que aparece para todos os clientes do item: galeria da Anuntech (o logo oficial do Synova e ícones gerados no Higgsfield), imagem enviada (PNG, JPEG ou WebP, convertida para 256 px) ou Gerar com IA (4 opções a partir do nome e da descrição; as não escolhidas são descartadas). Item novo sem ícone recebe um da galeria pelo nome. Sem item do catálogo, o vínculo mostra as iniciais.

### Apps dentro do Console

- O CMS do Espaço Absolut, o CMS da MulheresFM, o Roteiro Digital e a Base Pendente só abrem dentro do Console (desde 13/10/2026). O Workspace deixa de dar acesso a eles. As partes públicas dos sites (tudo fora de `/admin`) continuam abertas como antes.
- Um produto cujo endereço é um desses apps abre na mesma aba, em `/apps/<produto>`: o app ocupa a área de conteúdo, com uma barra mínima (voltar, nome do produto, empresa e Recarregar). Os outros produtos continuam abrindo o próprio link em nova aba.
- Quem abre: a equipe Anuntech, sempre; o Administrador da empresa, todos os apps; o Membro, só o Roteiro Digital e a Base Pendente. Produto pausado ou concluído não abre. A Base Pendente só abre para a empresa cujos dados já estão nela (hoje, a Alvitek). Quem não pode vê o motivo na própria página; produto de outra empresa responde como inexistente.
- Cada abertura (e cada Recarregar) gera um passe de 2 minutos só para aquele app, com a pessoa, a empresa e o papel, e fica na auditoria (`app.opened`). O app troca o passe por uma sessão própria de 8 horas e não roda fora do Console.
- Quem abre o endereço de um app direto na barra é levado ao Console, em `/abrir/<app>` (desde 14/10/2026). Sem sessão, entra e volta para o app. Com sessão, o Console procura entre os produtos ativos das empresas da pessoa os que apontam para aquele app: um só abre em `/apps/<produto>`, onde o papel é conferido como sempre; mais de um leva a Produtos, buscando pelo nome do app; nenhum mostra "Este app não está liberado para você", com o e-mail da conta e o caminho para Produtos. Um app fora da lista responde 404. O link sempre abre a entrada do app, não a página exata que a pessoa digitou.
- O Workspace foi encerrado (14/10/2026) e o endereço workspace.anuntech.com passa a levar ao Console, na página equivalente: o link de um app (a Base Pendente e o CMS da MulheresFM) vai para `/abrir/<app>`, os outros apps para Produtos, suporte para Chamados (abrir chamado para o formulário novo), atalhos para Bookmarks, as telas de entrada e convite para `/entrar` e todo o resto (admin, painel, notas, arquivos, API) para o Painel. O redirecionamento é temporário e nada do endereço antigo além do caminho é aproveitado (a query, com um `?token=` antigo, fica para trás).

### Financeiro

- A equipe cria cada cobrança manualmente: única ou recorrente (mensal ou anual), com cliente, produto, valor, vencimento e condições (desconto até o vencimento, multa e juros ao mês).
- Rascunho não vai ao banco. Publicar emite no Inter um boleto com Pix. Uma recorrência publicada emite cada período 5 dias antes do vencimento e mantém o dia de referência nos meses mais curtos.
- Recorrência mensal: assim que o Inter confirma o pagamento de um período, o próximo já é emitido (no máximo 45 dias antes do vencimento), para o cliente poder pagar quando quiser. O aviso "Nova fatura" continua saindo 5 dias antes do vencimento, às 8h. Quem tem fatura em aberto nessa recorrência, as anuais, as pausadas e as de produto ou serviço que não está ativo seguem o calendário de 5 dias. A opção pode ser desligada por recorrência em "Editar próximas cobranças", que também não aceita um vencimento dentro de um período já emitido.
- Próximas cobranças: o Financeiro e a Visão geral mostram ao cliente o próximo vencimento de cada recorrência antes de a fatura existir, com valor e o dia em que boleto e Pix saem. No Financeiro, a equipe vê só "Recorrências para corrigir" (pausadas ou com a emissão que vai falhar, com o motivo), e nada quando todas saem sozinhas.
- "Cancelar no Inter" (só a equipe) cancela uma cobrança emitida e em aberto, por exemplo a próxima de um cliente que encerrou o serviço. Não tem volta; os avisos dela param e a recorrência fica pausada até alguém retomar.
- Vencimento no passado exige uma data futura para o boleto; a fatura fica registrada como vencida desde a data original.
- Cada cobrança emitida tem um link público `/pagar/<id>` com QR Code Pix, copia e cola e boleto em PDF. O link não mostra documento nem e-mail do cliente e pode ser desativado. Pago, a página troca sozinha para "Pagamento confirmado". Fechada, ela diz o motivo certo: "Boleto e Pix vencidos" (o Inter encerrou sem pagamento e o valor continua em aberto), "Cobrança substituída" (a equipe cobrou de novo) ou "Fatura cancelada" com "Não é necessário pagar" só quando a equipe cancelou ou encerrou a dívida (`lib/billing/invoice-debt.ts`, a mesma regra da página da fatura da equipe).
- Avisos por e-mail e WhatsApp: fatura disponível, vence hoje e lembretes de atraso nos dias 5, 10, 15, 20 e 25. Antes de cada aviso o Console consulta o Inter para não cobrar quem já pagou.
- Só o Inter confirma pagamento (situação `RECEBIDO`), por consulta manual ou pela conciliação a cada 5 minutos. O navegador nunca confirma pagamento.
- Editar uma cobrança emitida (valor, vencimento ou condições) cancela o boleto e o Pix atuais e emite novos; o link continua o mesmo.
- Financeiro → Envios mostra cada aviso: aceito pelo provedor, entregue, falhou ou incerto, com reenvio manual.
- Dívida expirada: quando o Inter encerra por prazo (`EXPIRADO`) uma cobrança que ninguém pagou nem cancelou, ela aparece para a equipe como "Expirada sem pagamento" (filtro próprio no Financeiro, resumo e painel), não como cancelada. Na fatura, "Cobrar de novo" abre uma cobrança avulsa com o mesmo valor e uma nova data para o boleto (o vencimento original continua registrado), e "Encerrar a dívida" pede o motivo. Cada dívida é decidida uma vez só. Sete dias antes de o Inter encerrar uma cobrança em aberto, o resumo avisa.
- Pausar ou concluir um projeto, produto ou serviço pergunta se a recorrência dele também pausa (marcado por padrão), para não cobrar quem saiu. O resumo lista as cobranças em aberto de vínculos encerrados ou contratos vencidos sem renovação.
- Financeiro → Atrasos (só a equipe): os clientes com boleto vencido (passada a data para pagar, que numa cobrança feita de novo é posterior ao vencimento), do mais atrasado, clientes arquivados incluídos, com o total, os dias, o último aviso entregue, o que as condições publicadas dizem sobre suspensão (e se já passou do prazo), o último contato e um texto pronto para adaptar e mandar, que repete a frase de suspensão das condições e nada além dela. "Registrar contato" guarda quem falou, o que foi combinado e a data prometida; até ela, a empresa fica em "Aguardando a data combinada" e sai do resumo e do painel. Depois do 25º dia, quando os lembretes automáticos param, os sem data combinada entram no resumo e no painel. A mesma página lista as faturas marcadas como recebidas no Inter (fora do boleto, para confirmar na fatura, sem texto de cobrança) e avisa quantas expiraram no Inter sem pagamento.
- Quando o Inter mostra uma cobrança como marcada como recebida (fora do boleto e do Pix), a fatura pede à equipe "Confirmar recebimento" com o motivo; só então conta como paga e os lembretes param.
- Emissão sem resposta do banco: "Localizar no Inter" procura a cobrança pela referência da fatura nos dias da emissão e a liga depois das conferências de sempre; a rotina de 5 minutos tenta sozinha uma vez por hora, por 7 dias depois do pedido. Não encontrar não prova que o Inter não tem a cobrança: confira no Internet Banking antes de cobrar de novo. Nada é emitido de novo.
- Retomar uma recorrência pausada depois do vencimento mostra os vencimentos que passaram e pede a escolha: criar um rascunho avulso para cada um (vencimento original e nova data para pagar) ou seguir só do próximo.
- No 1º dia útil, a equipe recebe o fechamento do mês anterior: recebido e em aberto por vencimento, recorrências ativas por mês, dívidas expiradas, clientes novos e arquivados, contratos e orçamentos, chamados.
- Notas fiscais a emitir: as faturas pagas nos últimos 60 dias (pela data do pagamento) de clientes com nota automática entram no resumo e no painel até a emissão pela Focus ser ligada. Emitida a nota por fora, a equipe registra o número ou o link na fatura ("Registrar nota emitida") e ela sai da lista; o histórico diz que foi registrada pela equipe.
- Reajuste anual: no aniversário do contrato (em até 30 dias, ou passado há até 60 sem reajuste, com um ano de vigência desde a primeira assinatura, prorrogações incluídas), o resumo, o painel e a página do contrato ("Preparar reajuste") mostram o IPCA dos últimos 12 meses (Banco Central) e o novo valor, pelo que a recorrência cobra (ou o preço do item, sem recorrência), com o aditivo de reajuste em rascunho. O aditivo não muda a vigência. Preparado, o aniversário sai das listas (volta se o aditivo for cancelado). A cláusula espera o advogado; a recorrência muda só quando a equipe editar as próximas cobranças.
- A equipe pode excluir de vez um rascunho que nunca foi ao Inter e uma cobrança que o próprio Inter cancelou (cancelada, expirada ou com falha de emissão). Fatura paga ou com nota fiscal nunca é excluída, e a exclusão não deixa uma recorrência cobrar o mesmo período de novo. A atividade guarda o registro.

### Contratos

- Modelos com variáveis (`{{empresa}}`, `{{cnpj}}`, `{{valor}}`, `{{inicio}}`, `{{fim}}`…) preenchidas pelo cadastro.
- O contrato nasce rascunho, só a equipe vê. Enviar congela o texto numa versão com hash e avisa os administradores da empresa por e-mail.
- Campos do contrato: no rascunho, cada `{{campo}}` que sobrou no texto aparece no topo, com o trecho onde está, uma sugestão quando o Console já sabe o valor (cadastro da empresa, produto vinculado, último orçamento aceito ou, sem ele, o último enviado, quem responde por cada lado). Enviar para assinatura recusa um texto salvo que ainda tenha algum `{{campo}}` e as ações Aplicar (o valor entra em todo lugar onde o campo aparece), Aplicar e salvar, Ver no texto e Remover do texto.
- Assinatura eletrônica no próprio Console, com registro de quem assinou, quando e em qual versão. Com as duas partes assinadas, o PDF final é guardado.
- Voltar para rascunho mantém a versão enviada no histórico, com as assinaturas que ela recebeu; o próximo envio é uma versão nova, assinada de novo pelas duas partes. Cada parte assina uma vez por versão (desde 16/10/2026; antes, quem tinha assinado uma versão não conseguia assinar a seguinte). Depois que a empresa assina uma versão, ela não abre rodada de revisão nela: a mudança vem por chamado e aditivo.
- **Rodadas de revisão:** enquanto o contrato espera assinatura, os administradores da empresa podem pedir alterações cláusula por cláusula, com o motivo e, se quiserem, o texto proposto. Os pedidos ficam guardados até o cliente enviar a rodada; aí o contrato vai para "Em revisão", a assinatura dessa versão é bloqueada e a equipe recebe um e-mail. A equipe aceita ou recusa cada pedido (recusar exige resposta); aceitar um texto proposto o aplica sozinho no rascunho quando a cláusula ainda está como o cliente leu. A próxima versão só sai com todos os pedidos respondidos; o cliente recebe um e-mail, vê o que mudou marcado na margem e a resposta a cada pedido, e assina ou abre outra rodada. Tudo fica no histórico, por versão.
- Aditivos a contratos assinados, vigência com início e fim, aviso 30 dias antes do fim e no vencimento. O aviso, o resumo da manhã e o contrato trazem "Preparar prorrogação": um aditivo com a nova vigência (do dia seguinte ao fim, pelo mesmo tempo) e a cláusula de prorrogação, em rascunho.
- Quando o cliente assina primeiro, a equipe recebe um e-mail e o painel mostra "Falta a assinatura da Anuntech".
- No contrato assinado, a equipe vê o orçamento de origem e prepara, a partir dele, a cobrança recorrente do item (valor, ciclo e dia de vencimento do contrato), as condições de atendimento em rascunho pela ficha do modelo (só valem depois de conferidas) e a prorrogação. Cada um é preparado uma vez; cancelar o rascunho da cobrança libera de novo.
- Enviar contrato ou orçamento para uma empresa sem Administrador pede o e-mail de quem vai assinar ou responder (sugere o e-mail financeiro). A pessoa recebe acesso como Administrador logo depois do envio, para o aviso chegar a ela; se a liberação falhar, o envio vale e a mensagem diz o motivo. Em branco, o envio sai sem avisar ninguém. O painel e o resumo listam os clientes sem Administrador que têm contrato, orçamento ou cobrança em aberto.

### Orçamentos

- Propostas por fases, numeradas por ano, com PDF.
- Valor = horas máximas × taxa/hora, menos o desconto negociado (opcional, em reais, nunca maior que o valor das horas; no editor fica recolhido em "Adicionar desconto"). Entrada e saldo são calculados sobre o valor com desconto, e a proposta mostra o valor das horas e o desconto. Ao copiar um orçamento para outra empresa pelo assistente, o desconto não vai junto.
- Enviar congela a versão e avisa os administradores da empresa, que aceitam ou recusam no Console. Rascunho pode ser duplicado; proposta enviada pode voltar para edição ou ser retirada.
- No rascunho com resumo e sem fases, "Sugerir fases pelo resumo" propõe fases, horas, semanas e tarefas (pelo modelo do assistente). Elas entram só no editor; a equipe ajusta e salva.
- "Criar orçamento deste pedido" no chamado leva o pedido junto: o orçamento fica ligado ao chamado e a descrição vira o resumo. No orçamento, "Responder no chamado" abre o chamado com uma resposta pronta para cada momento (enviado, aceito, recusado), que a equipe revisa e envia.
- Orçamento aceito: "Próximos passos" com o contrato (o modelo de desenvolvimento, quando ativo, já com escopo, entregáveis, stack, prazo e valores do orçamento), o projeto (um cartão por tarefa em A fazer, com o código e a fase como etiqueta, depois de Acessos e Reunião de início, até 300 cartões, com confirmação) e as cobranças da entrada e do saldo em rascunho. Cada passo é feito uma vez e mostra o que já existe.

### Jornadas (só a equipe)

- Uma jornada por projeto de cliente, do primeiro contato à hospedagem, em `/jornadas` (no dock e em "Nova jornada"). Ela começa por uma empresa, por um contato que ainda não é cliente, por um pedido "App ou projeto novo" (no menu do chamado) ou por um orçamento (no menu do orçamento); cada pedido e cada orçamento tem no máximo uma jornada, e o menu mostra "Ver jornada do projeto" quando ela existe. Um orçamento cancelado conta como nenhum: a jornada pode criar outro.
- Seis etapas, com o passo-padrão de cada uma: contato e descoberta (cadastro, reunião e briefing, quem decide, cadastro pronto para cobrar, Administrador), proposta (fases e tarefas, orçamento completo, enviado, aceito), contratação e início (contrato enviado e assinado, entrada paga, projeto no quadro, acessos, reunião de início, condições), setup técnico em paralelo (prompt de início do projeto, GitHub, Vercel, Neon, variáveis, design system e aprovação, domínio, Cloudflare, e-mail do domínio, monitoramento, privacidade), construção e validação (quadro concluído, apresentação, revisão do retorno do cliente) e entrega (reunião, aceite, saldo, endereço de produção, produto e recorrência de hospedagem, passagem de contas, treinamento, garantia, suporte, projeto concluído).
- O que o Console já sabe se marca sozinho: empresa, cadastro para cobrar, Administrador (convidado e já entrou), briefing salvo, orçamento (tarefas, completo, enviado, aceito ou recusado), contrato (rascunho, enviado, assinado pelo cliente, assinado), entrada e saldo (rascunho, emitida, paga só com a confirmação do Inter), projeto e o andamento do quadro (cartões "Acessos" e "Reunião de início"), condições conferidas, hospedagem e a recorrência dela. Esses passos só aceitam "Não se aplica" à mão (o briefing nem isso: ele se marca ao ser salvo). Acessos, reunião de início, endereço de produção e quem decide contam pelo dado quando ele existe (cartões do quadro, endereço do projeto, briefing) e, senão, a equipe marca à mão. Os de fora do Console (reuniões, GitHub, Vercel, Neon, domínio, Cloudflare, aceite) a equipe marca com link, valor, data, anotação e responsável. Link só https, sem usuário, senha ou chave no endereço; anotação, briefing ou motivo que parecem senha, chave ou endereço com senha são recusados.
- Cada passo mostra o que o dado diz, por que espera outro passo, e o botão que leva ao formulário certo do Console já preenchido (cadastro de empresa que volta para a jornada vinculado, orçamento criado com o briefing como resumo, contrato e cobranças do orçamento aceito, criação do projeto com confirmação). Nada é emitido, enviado ou cobrado pela jornada. "Agora" aponta o próximo passo do fluxo principal; o setup técnico corre em paralelo. Domínio, Vercel e Neon avisam quando a entrada ainda não foi paga, e criar o projeto avisa quando o contrato ainda não foi assinado: aviso, nunca bloqueio.
- IA em todos os passos, sempre como rascunho que a equipe confere: organizar as notas (escritas, ditadas ou uma transcrição colada) em briefing sem inventar (o que não foi dito vira pergunta em aberto); o prompt de início do projeto para o agente de código (estrutura, pastas, stack, AGENTS.md e docs, variáveis só com nomes, setup no GitHub, Vercel, Neon e Cloudflare, primeiras tarefas), a partir do documento "Padrão de projeto Anuntech" do assistente quando existir; a direção visual com paleta, fontes e o contraste calculado pelo Console; pautas das reuniões de briefing, início, apresentação e entrega; o retorno do cliente separado em ajuste, novo pedido e dúvida; como fazer qualquer passo neste projeto; e "O que está faltando?", que sugere passos para acrescentar. O texto pode ser copiado, levado para a anotação ou guardado na jornada. As chamadas pedem ao provedor que não use os dados para treinar, e e-mails, telefones, documentos, senhas e chaves saem do texto antes de ir.
- Passos acrescentados pela equipe valem só para aquela jornada. Situações: em andamento, pausada, concluída e perdida (com o motivo). Excluir a jornada não mexe na empresa, no orçamento, no contrato nem no projeto; excluir a empresa leva as jornadas dela. Jornada ativa sem mudança há mais de 5 dias aparece no painel como parada.

### Bookmarks

- Links, arquivos e lousas privados organizados em pastas pessoais. Uma pasta pode ser vista pela empresa inteira ou só por pessoas escolhidas.
- Lousa: um quadro para desenhar e anotar (Excalidraw) que abre em tela cheia dentro do Console. Nasce em branco, salva sozinha a cada traço e mostra uma miniatura no card. Quem vê o bookmark abre a lousa; só quem a criou, o dono da pasta ou a equipe desenha nela (os outros veem em modo leitura). Limite de 3 MB por lousa, contadas as imagens coladas.
- Busca, paginação (10, 25, 50 ou 100 por página) e visualização em lista ou grade. A escolha de visualização fica salva para a pessoa.

### Assistente

- Chat em todas as telas, aberto pelo botão do dock. Em telas largas fica ao lado do conteúdo.
- Responde e age com o acesso da pessoa: consulta empresas, faturas, chamados, projetos, contratos e orçamentos; abre chamados, cria tarefas, comenta, rascunha cobranças, contratos e orçamentos; preenche a tela atual.
- Nunca altera dado sozinho: cada alteração vira um cartão no painel, com os dados, e só acontece quando a pessoa toca em Confirmar. Um cartão vale para uma chamada, por 15 minutos, e some ao recarregar. Um "sim" na conversa não executa nada. Preencher a tela sem enviar acontece direto; enviar pede cartão.
- Lê texto escrito por outras pessoas (chamados, comentários, tarefas, bookmarks) como dado, nunca como instrução. Depois de ler esse texto, ou numa tela de registro, as consultas da resposta ficam na empresa do registro aberto, e até preencher ou clicar pede cartão, que avisa a origem.
- Clica só nos botões que a tela libera (os "Novo…" das listas), um por resposta. Nunca aceita nem recusa orçamento, nunca assina contrato, não aprova nem contesta horas, não publica nem concilia cobrança, não envia ao cliente e não confirma exclusões: esses formulários ficam fora do que ele lê, preenche e clica na tela (`data-assistant-ignore`, como o microfone). Bookmarks pelo assistente seguem a mesma regra da página (pasta só de pessoas escolhidas fica fora para os demais).
- Até 60 mensagens por hora por pessoa e 12 consultas ou cartões por resposta. Por dia: 400 mil tokens por pessoa e, somando as pessoas de cada empresa, 1 milhão de tokens e 300 mensagens; quem tem várias empresas gasta de todas. A equipe tem só o limite por pessoa (2 milhões de tokens). Os limites voltam à meia-noite de Brasília. Só usa provedores de IA que não guardam os dados (sem modelos gratuitos).
- Microfone no campo de mensagem: a pessoa fala, o texto aparece no campo e ela envia quando quiser. Depois de enviado, vale como mensagem digitada (o Jev lê a intenção).
- A equipe escolhe o modelo, escreve instruções extras e sobe documentos de conhecimento em Configurações → Assistente.

### Automações

- Configurações → Automações (só a equipe) lista os avisos que saem sozinhos para os clientes e a triagem do Jev, cada item com um interruptor, ligado por padrão (pedido do Kauan em 08/10/2026). Desligar vale a partir da próxima rotina. Cobranças e avisos de chamados seguem as Notificações de cada empresa. Para não lembrar coisas antigas de uma vez, os lembretes olham só o recente: contratos enviados há 7 a 14 dias, entregas que entraram em Revisão nos últimos 3 dias e chamados cuja metade do prazo passou há até 5 dias.
- Avisos ao cliente, aos Administradores de cada empresa, cada um uma vez: aviso de 80% do banco de horas (assim que passa da linha, só com condições já publicadas); relatório do banco do mês anterior (a partir do 2º dia útil, para quem teve horas); lembrete 3 dias antes da validade de um orçamento sem resposta (uma vez por versão); lembrete de contrato sem a assinatura do cliente 7 dias depois do envio (uma vez por versão); contrato assinado pelas duas partes com o link do PDF final e os próximos passos; uma vez por dia, as entregas que entraram em Revisão, com o prazo de teste quando há; lembrete do que falta num chamado esperando o cliente, na metade dos dias das condições (3 dias úteis sem condições), para quem abriu o chamado e os contatos de Chamados da empresa, nunca no mesmo dia de um lembrete da equipe; e, às segundas, um resumo da semana por empresa (chamados, o que espera o cliente, entregas em Revisão, banco de horas e próxima fatura), só quando houve movimento.
- Para a equipe: a triagem do Jev nos chamados novos também tem interruptor.
- A Visão geral do cliente mostra "Entregas para você revisar". Quando o cliente aponta um problema numa entrega, a equipe recebe um e-mail e o painel lista "Problemas apontados em entregas".

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
