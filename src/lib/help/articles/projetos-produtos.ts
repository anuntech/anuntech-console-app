import type { HelpArticle } from "../help-model";

export const projetosProdutosArticles: HelpArticle[] = [
  {
    slug: "quadro-do-projeto",
    category: "projetos",
    title: "O quadro do projeto",
    summary: "Como ler as colunas, os cartões e os filtros do quadro em que a equipe mostra o andamento de cada projeto.",
    audience: "todos",
    keywords: [
      "projeto",
      "quadro",
      "kanban",
      "tarefas",
      "colunas",
      "backlog",
      "andamento",
      "progresso",
      "acompanhar projeto",
      "status do projeto",
      "cronograma",
      "revisao",
      "concluido",
    ],
    sections: [
      {
        title: "O que é",
        blocks: [
          {
            kind: "p",
            text: "Cada projeto contratado com a Anuntech tem um quadro de tarefas. A equipe organiza o trabalho em cartões, e cada cartão anda pelas colunas conforme o trabalho avança. No quadro você acompanha o que está sendo feito, pede tarefas, comenta e, se for Administrador, aprova as entregas.",
          },
          {
            kind: "p",
            text: "O projeto aparece em Projetos quando a equipe inicia o trabalho, normalmente depois do orçamento aceito. Quando ele nasce de um orçamento, o quadro já começa com tudo em \"A fazer\": os cartões \"Acessos\" e \"Reunião de início\", com a etiqueta \"Início\", e um cartão para cada tarefa do orçamento, com a fase como etiqueta.",
          },
        ],
      },
      {
        title: "Quem vê",
        blocks: [
          {
            kind: "p",
            text: "O Administrador vê todos os projetos da empresa. O Membro também vê todos, a não ser que um Administrador tenha escolhido \"Só o que eu escolher\" para ele: nesse caso, ele vê só os projetos marcados. Veja [Escolher o que cada Membro vê](/ajuda/o-que-cada-membro-ve).",
          },
        ],
      },
      {
        title: "Onde fica",
        blocks: [
          {
            kind: "list",
            items: [
              "No computador: \"Projetos\", no menu do Console.",
              "No celular: o Membro tem \"Projetos\" na barra de baixo. O Administrador encontra em \"Mais\", na seção \"Mais áreas\".",
              "Na [Visão geral](/painel): o indicador \"Projetos ativos\" e o quadro \"Projetos\", com o link \"Ver todos\".",
            ],
          },
        ],
      },
      {
        title: "Abrir um projeto",
        blocks: [
          {
            kind: "steps",
            items: [
              "Abra \"Projetos\". A lista começa em \"Grade\". Para ver em linhas, escolha \"Lista\"; o Console lembra a escolha neste navegador.",
              "Para achar um projeto, digite o nome em \"Buscar por nome\".",
              "A lista mostra os projetos \"Ativos\". Para ver os outros, troque o filtro por \"Pausados\", \"Concluídos\" ou \"Todas as situações\".",
              "Clique no projeto para abrir o quadro. O caminho \"Projetos\" e o nome do projeto ficam no topo; um projeto pausado ou concluído mostra a situação ao lado do nome.",
            ],
          },
          {
            kind: "p",
            text: "Na lista, cada projeto mostra a situação, quando o quadro mudou pela última vez e o progresso, como \"5/12\": tarefas concluídas sobre o total. Um projeto ainda sem cartões mostra \"Sem tarefas\".",
          },
        ],
      },
      {
        title: "As colunas",
        blocks: [
          {
            kind: "pairs",
            items: [
              { term: "Backlog", text: "O que ainda não entrou no trabalho. Toda tarefa criada por alguém da sua empresa começa aqui, com o selo \"Pedido do cliente\", até a equipe confirmar se ela faz parte do combinado." },
              { term: "A fazer", text: "O que faz parte do trabalho e ainda não começou." },
              { term: "Em andamento", text: "O que a equipe está fazendo agora." },
              { term: "Revisão", text: "Entregas prontas para testar. Só a equipe coloca uma tarefa aqui, e um Administrador da sua empresa aprova ou aponta um problema." },
              { term: "Concluído", text: "Tarefas terminadas. Só a equipe conclui uma tarefa, ou ela chega aqui quando um Administrador aprova a entrega. Uma tarefa concluída só sai daqui pela equipe." },
            ],
          },
          {
            kind: "p",
            text: "No topo de cada coluna aparecem quantas tarefas ela tem e a soma das estimativas, em horas.",
          },
        ],
      },
      {
        title: "O que cada cartão mostra",
        blocks: [
          {
            kind: "list",
            items: [
              "O título da tarefa.",
              "\"Pedido do cliente\", quando a tarefa foi pedida pela sua empresa e a equipe ainda não a levou para o trabalho.",
              "Até 3 etiquetas. As outras aparecem como \"+1\", \"+2\" e assim por diante.",
              "A prioridade, quando não é Normal.",
              "O prazo, em vermelho quando já venceu e em amarelo quando vence hoje.",
              "A estimativa, o número de anexos e de comentários e a foto de cada responsável.",
              "Na coluna \"Revisão\": \"Teste até\", com dia e hora, quando o contrato da sua empresa tem prazo de teste. O Administrador vê também o botão \"Revisar\" e, quando não há prazo de teste, \"Pronta para testar\".",
            ],
          },
          {
            kind: "p",
            text: "Clique no cartão para ver os detalhes e os comentários. Veja [Comentários, anexos e responsáveis nas tarefas](/ajuda/comentarios-e-anexos).",
          },
        ],
      },
      {
        title: "Buscar e filtrar tarefas",
        blocks: [
          {
            kind: "pairs",
            items: [
              { term: "Buscar tarefas", text: "Procura no título, na descrição, nas etiquetas e no nome dos responsáveis, sem se importar com acentos. Com mais de uma palavra, a tarefa precisa ter todas." },
              { term: "Pessoas", text: "Mostra as tarefas de quem você escolher. \"Sem responsável\" mostra as que ainda não têm ninguém." },
              { term: "Etiquetas", text: "Aparece quando alguma tarefa do quadro tem etiqueta." },
              { term: "Prioridade", text: "Baixa, Normal, Alta ou Urgente." },
              { term: "Limpar", text: "Tira todos os filtros de uma vez." },
            ],
          },
          {
            kind: "p",
            text: "Dentro de um filtro vale qualquer uma das opções marcadas. Entre filtros diferentes, a tarefa precisa atender a todos. Uma coluna sem resultado mostra \"Nada com esses filtros\".",
          },
        ],
      },
      {
        title: "Mover cartões",
        blocks: [
          {
            kind: "p",
            text: "Você pode arrastar cartões entre \"Backlog\", \"A fazer\" e \"Em andamento\", com o mouse ou com o dedo. Pelo teclado, use Tab até o ícone de arrastar no canto do cartão (\"Mover\"), pressione Espaço para pegar, use as setas e pressione Espaço de novo para soltar; Esc cancela. Outra forma: abra a tarefa, troque \"Coluna\" e clique em \"Salvar\". O cartão vai para o fim da nova coluna.",
          },
          {
            kind: "list",
            items: [
              "Só a equipe coloca uma tarefa em \"Revisão\" ou em \"Concluído\". Uma entrega também vai para \"Concluído\" quando um Administrador da sua empresa a aprova.",
              "Uma tarefa em Revisão sai de lá pelo botão \"Revisar\", que só o Administrador da empresa tem.",
              "Uma tarefa em \"Concluído\" fica lá. Ao abri-la, \"Coluna\" mostra só \"Concluído\", e se você tentar arrastar o cartão aparece \"Esta tarefa está concluída. Para reabrir, comente na tarefa ou abra um chamado.\" Comentar não avisa a equipe na hora: se for urgente, use o chamado.",
              "Um pedido da sua empresa fica no Backlog até a equipe levá-lo para outra coluna.",
              "Se o Console não conseguir mover, o cartão volta para onde estava e a mensagem explica o motivo.",
              "No celular, deslizar o dedo sobre um cartão já começa a arrastá-lo. Para passar de uma coluna para outra sem mover nada, deslize fora dos cartões, como no título das colunas.",
            ],
          },
        ],
      },
      {
        title: "Sobre este projeto",
        blocks: [
          {
            kind: "p",
            text: "O botão com o ícone de informação, ao lado de \"Nova tarefa\", abre \"Sobre este projeto\": o objetivo do projeto, escrito pela equipe, e as regras do quadro, com o link para [Como trabalhamos](/como-trabalhamos). Enquanto a equipe não escreve o objetivo, aparece \"A equipe ainda não escreveu o objetivo deste projeto.\"",
          },
        ],
      },
      {
        title: "Atividade do projeto",
        blocks: [
          {
            kind: "p",
            text: "O botão com o ícone de relógio, ao lado de \"Sobre este projeto\", abre a \"Atividade\": tudo o que aconteceu no quadro, do mais recente para o mais antigo, separado por dia. Cada linha diz quem fez (a equipe aparece com \"(Anuntech)\"), o quê e a hora: tarefa criada, movida de uma coluna para outra, entrega aprovada ou devolvida com um problema, comentário, anexo removido, tarefa editada ou excluída.",
          },
          {
            kind: "list",
            items: [
              "Os botões \"Movimentos\", \"Revisões\", \"Comentários\" e \"Edições\" mostram só esse tipo de atividade; \"Tudo\" volta à lista completa.",
              "Clique no nome da tarefa para abri-la. Uma tarefa excluída aparece com \"(excluída)\" e não abre.",
              "A lista mostra as 200 atividades mais recentes. Quem vê o projeto vê a atividade dele.",
            ],
          },
        ],
      },
      {
        title: "Quando usar um chamado",
        blocks: [
          {
            kind: "note",
            tone: "attention",
            text: "Erro em algo que já está em uso vai para um [chamado](/chamados/novo), não para o quadro. O chamado é o canal oficial com a equipe e é nele que contam os prazos de atendimento. Mexer no quadro não avisa ninguém na hora.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Uma tarefa mudou de coluna e não sei quem mexeu. Onde vejo?",
        a: "Na \"Atividade\" do projeto, pelo botão com o ícone de relógio no topo do quadro. Ela mostra quem moveu, aprovou ou devolveu cada tarefa, e quando. Use \"Movimentos\" ou \"Revisões\" para filtrar.",
      },
      {
        q: "Não encontro um projeto que sei que a empresa tem. Por quê?",
        a: "Confira primeiro o filtro: a lista abre em \"Ativos\". Escolha \"Pausados\", \"Concluídos\" ou \"Todas as situações\". Se você é Membro, um Administrador pode ter escolhido \"Só o que eu escolher\" para você em Membros; nesse caso, você vê só os projetos marcados, e um projeto novo só aparece quando ele marcar. Fale com um Administrador da sua empresa.",
      },
      {
        q: "O projeto já apareceu. O trabalho já começou?",
        a: "Não necessariamente. A equipe pode criar o projeto logo depois do orçamento aceito. O trabalho começa na reunião de início, depois do contrato assinado, da entrada paga e dos acessos liberados. Os cartões \"Acessos\" e \"Reunião de início\" mostram esse começo.",
      },
      {
        q: "Posso mover as tarefas no quadro?",
        a: "Em parte. Você arrasta cartões entre \"Backlog\", \"A fazer\" e \"Em andamento\", menos um pedido da sua empresa que ainda está no Backlog. Só a equipe coloca uma tarefa em \"Revisão\" ou em \"Concluído\". Uma tarefa em Revisão sai de lá pelo botão \"Revisar\", que só o Administrador tem. Uma tarefa concluída não sai de \"Concluído\": para reabrir, comente na tarefa ou abra um chamado.",
      },
      {
        q: "O que quer dizer \"Pedido do cliente\" num cartão?",
        a: "Que a tarefa foi criada por alguém da sua empresa e a equipe ainda não confirmou se ela faz parte do combinado. Quando a equipe leva o cartão para outra coluna, o selo sai. Veja [Pedir uma tarefa no projeto](/ajuda/pedir-uma-tarefa).",
      },
      {
        q: "A equipe é avisada quando eu mexo no quadro?",
        a: "Não. Criar um pedido, comentar ou mover um cartão não manda e-mail para ninguém. A equipe vê ao abrir o quadro. A exceção é \"Encontrei um problema\" numa entrega em Revisão: aí a equipe recebe um e-mail na hora. Para algo urgente, abra um chamado.",
      },
      {
        q: "Como vejo o quadro no celular?",
        a: "Abra o projeto e deslize para os lados fora dos cartões, como no título das colunas, para ver as outras colunas. Deslizar sobre um cartão começa a arrastá-lo. Cada coluna rola sozinha, de cima para baixo.",
      },
    ],
    actions: [{ label: "Ir para Projetos", href: "/projetos" }],
    related: ["pedir-uma-tarefa", "aprovar-entregas", "comentarios-e-anexos", "o-que-cada-membro-ve"],
    updatedAt: "2026-10-21",
  },
  {
    slug: "pedir-uma-tarefa",
    category: "projetos",
    title: "Pedir uma tarefa no projeto",
    summary: "Como criar um pedido no quadro do projeto e o que acontece até a equipe confirmar se ele faz parte do combinado.",
    audience: "todos",
    keywords: [
      "nova tarefa",
      "pedir tarefa",
      "criar tarefa",
      "pedido do cliente",
      "pedido",
      "solicitar",
      "solicitacao",
      "demanda",
      "backlog",
      "escopo",
      "adicionar tarefa",
      "excluir tarefa",
    ],
    sections: [
      {
        title: "O que é",
        blocks: [
          {
            kind: "p",
            text: "Qualquer pessoa da sua empresa que vê o projeto pode criar uma tarefa no quadro. Para a Anuntech, essa tarefa é um pedido: ela entra no Backlog com o selo \"Pedido do cliente\" e a equipe confirma se ela faz parte do que foi contratado.",
          },
        ],
      },
      {
        title: "Quem pode",
        blocks: [
          {
            kind: "p",
            text: "O Administrador e o Membro, nos projetos que cada um vê. O pedido segue as mesmas regras para os dois.",
          },
        ],
      },
      {
        title: "Como pedir",
        blocks: [
          {
            kind: "steps",
            items: [
              "Abra o projeto em \"Projetos\".",
              "Clique em \"Nova tarefa\" ou no \"+\" no topo de qualquer coluna. O pedido entra no Backlog de qualquer jeito.",
              "Em \"Título\", diga o que precisa ser feito. Em \"Descrição\", conte o contexto, o que precisa estar pronto e os links úteis.",
              "Se quiser, preencha \"Prioridade\", \"Responsáveis\", \"Prazo\", \"Estimativa (horas)\", \"Etiquetas\" e \"Anexos\".",
              "Clique em \"Criar tarefa\". Aparece \"Pedido criado no Backlog. A equipe confirma se ele faz parte do combinado.\"",
            ],
          },
          {
            kind: "p",
            text: "Você também pode pedir ao [assistente](/ajuda/assistente) que crie a tarefa. O pedido feito por ele segue as mesmas regras e também entra no Backlog.",
          },
        ],
      },
      {
        title: "Os campos",
        blocks: [
          {
            kind: "pairs",
            items: [
              { term: "Título", text: "Obrigatório, até 200 caracteres." },
              { term: "Descrição", text: "Até 5.000 caracteres." },
              { term: "Prioridade", text: "\"Baixa\", \"Normal\" (o padrão), \"Alta\" ou \"Urgente\". É a prioridade da tarefa no quadro, diferente da prioridade de um chamado." },
              { term: "Responsáveis", text: "Até 10 pessoas, entre a equipe da Anuntech e as pessoas da sua empresa que veem o projeto." },
              { term: "Prazo", text: "Uma data no calendário. Vazio fica \"Sem prazo\"." },
              { term: "Estimativa (horas)", text: "Em horas, como 2 ou 1,5. 1,5 quer dizer 1h30." },
              { term: "Etiquetas", text: "Digite e pressione Enter ou vírgula. Até 8 etiquetas, com até 24 caracteres cada. As que já existem no quadro aparecem como sugestão." },
              { term: "Anexos", text: "PDF, PNG, JPEG ou WebP, até 5 arquivos por vez e 20 MB no total." },
            ],
          },
          {
            kind: "note",
            tone: "attention",
            text: "Não escreva senhas nem dados reais dos seus clientes na tarefa ou nos anexos. Se a equipe precisar de um acesso, ela combina com você um jeito seguro.",
          },
        ],
      },
      {
        title: "O que acontece depois",
        blocks: [
          {
            kind: "list",
            items: [
              "O cartão fica no Backlog com o selo \"Pedido do cliente\". Você não consegue tirá-lo de lá: se tentar, aparece \"Este pedido fica no Backlog até a equipe confirmar se ele faz parte do combinado.\"",
              "Enquanto isso, você pode abrir o cartão, ajustar o título, a descrição e os outros campos e clicar em \"Salvar\".",
              "A equipe confere se o pedido faz parte do combinado. Quando ela leva o cartão para outra coluna, o selo sai e a tarefa entra no trabalho.",
              "Criar um pedido não manda e-mail para a equipe. Ela vê o pedido no quadro, e os pedidos que ficam parados no Backlog entram no acompanhamento diário dela.",
              "O Console não manda aviso quando a equipe leva o pedido para o trabalho nem quando o exclui. Acompanhe pelo quadro. Se um pedido sumiu e você não sabe por quê, pergunte por chamado.",
            ],
          },
        ],
      },
      {
        title: "Quando abrir um chamado em vez de pedir no quadro",
        blocks: [
          {
            kind: "pairs",
            items: [
              { term: "Algo parou ou deu erro", text: "Se o problema é em algo que já está em uso, abra um chamado do tipo \"Parou ou deu erro\". O chamado é o canal com prazos de atendimento." },
              { term: "Pedido novo ou mudança no combinado", text: "Abra um chamado do tipo \"Ajuste ou algo novo\". A equipe avalia se entra no que você já tem ou se precisa de orçamento. Veja [Qual tipo de chamado escolher](/ajuda/tipos-de-chamado)." },
              { term: "Um app ou projeto novo", text: "Abra um chamado do tipo \"App ou projeto novo\". A equipe conversa com você e prepara um orçamento. Veja [Pedir um orçamento](/ajuda/pedir-um-orcamento)." },
              { term: "Algo urgente", text: "Use o chamado. O pedido no quadro não avisa ninguém na hora." },
            ],
          },
        ],
      },
      {
        title: "Desistir de um pedido",
        blocks: [
          {
            kind: "steps",
            items: [
              "Abra a tarefa que você criou.",
              "Clique em \"Excluir\", no rodapé, à esquerda.",
              "Confirme em \"Excluir tarefa?\". Aparece \"Tarefa excluída.\"",
            ],
          },
          {
            kind: "note",
            tone: "attention",
            text: "A tarefa sai do quadro com os anexos e os comentários, e isso não pode ser desfeito. Só quem criou a tarefa, ou a equipe, pode excluí-la.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Criei uma tarefa e ela ficou no Backlog. Por quê?",
        a: "Toda tarefa criada por alguém da sua empresa entra no Backlog como pedido, com o selo \"Pedido do cliente\". A equipe confere se ela faz parte do que foi contratado e, quando aceita, leva o cartão para \"A fazer\" ou \"Em andamento\". Até lá, você não consegue tirá-lo do Backlog.",
      },
      {
        q: "Criei pelo \"+\" de outra coluna, mas o pedido foi para o Backlog. Está certo?",
        a: "Sim. Para quem é da sua empresa, toda tarefa nova entra no Backlog, de onde quer que seja criada.",
      },
      {
        q: "A equipe fica sabendo na hora quando eu crio um pedido?",
        a: "Não. Criar um pedido não manda e-mail para ninguém. A equipe vê ao abrir o quadro, e os pedidos que ficam parados no Backlog entram no acompanhamento diário dela. Se for urgente, ou se algo parou de funcionar, abra um chamado.",
      },
      {
        q: "O meu pedido muda o que foi contratado. O que faço?",
        a: "Abra um chamado do tipo \"Ajuste ou algo novo\" e conte o que precisa. A equipe avalia se o pedido entra no que você já tem ou se precisa de orçamento.",
      },
      {
        q: "Posso excluir um pedido que criei?",
        a: "Sim. Abra a tarefa, clique em \"Excluir\" e confirme. Ela sai do quadro com os anexos e os comentários, e isso não pode ser desfeito. Tarefas criadas por outras pessoas você não exclui.",
      },
    ],
    actions: [
      { label: "Ir para Projetos", href: "/projetos" },
      { label: "Abrir chamado", href: "/chamados/novo" },
    ],
    related: ["quadro-do-projeto", "tipos-de-chamado", "comentarios-e-anexos", "pedir-um-orcamento"],
    updatedAt: "2026-10-14",
  },
  {
    slug: "aprovar-entregas",
    category: "projetos",
    title: "Revisar e aprovar entregas",
    summary: "Como o Administrador testa uma entrega em Revisão e aprova ou aponta um problema, e o que o Membro faz nesse caso.",
    audience: "administrador",
    keywords: [
      "aprovar entrega",
      "revisar",
      "revisao",
      "aceite",
      "aceitar entrega",
      "homologar",
      "homologacao",
      "testar",
      "teste ate",
      "encontrei um problema",
      "reprovar",
      "validar entrega",
      "entrega",
    ],
    sections: [
      {
        title: "O que é",
        blocks: [
          {
            kind: "p",
            text: "Quando uma tarefa fica pronta para teste, a equipe a coloca na coluna \"Revisão\" do quadro. Quem responde pela empresa testa e confirma se ela está como combinado: aprova, e a tarefa vai para \"Concluído\", ou aponta um problema, e ela volta para a equipe.",
          },
          {
            kind: "p",
            text: "O aceite fica com o Administrador porque ele responde pela empresa, como nos orçamentos e nos contratos.",
          },
        ],
      },
      {
        title: "Quem pode",
        blocks: [
          {
            kind: "p",
            text: "Só o Administrador da empresa aprova ou aponta um problema. O Membro vê o cartão em Revisão e o \"Teste até\", mas não tem o botão \"Revisar\". Se você é Membro e testou uma entrega, conte o que viu nos comentários da tarefa e avise um Administrador da sua empresa.",
          },
        ],
      },
      {
        title: "Como você fica sabendo",
        blocks: [
          {
            kind: "list",
            items: [
              "Na [Visão geral](/painel), em \"Precisa de atenção\", aparece \"Entregas para você revisar\", com o número de entregas. Com entregas num projeto só, o item abre o quadro dele. Com entregas em mais de um, abre a lista de Projetos.",
              "Por e-mail, por volta das 9h: o Console junta o que entrou em Revisão desde o último aviso e manda \"Uma entrega para revisar\" (ou o número de entregas), com o projeto, a tarefa, o prazo de teste quando houver e o link do quadro. Cada entrega é avisada uma vez.",
              "Toda segunda-feira, o resumo \"Sua semana com a Anuntech\" diz quantas entregas estão em Revisão esperando o seu teste, quando há alguma. Uma semana sem movimento não gera resumo.",
            ],
          },
          {
            kind: "p",
            text: "Esses avisos vão só para os Administradores da empresa. O Membro não recebe aviso de projeto.",
          },
        ],
      },
      {
        title: "Como revisar",
        blocks: [
          {
            kind: "steps",
            items: [
              "Abra o quadro do projeto pela Visão geral, pelo e-mail ou em \"Projetos\".",
              "Na coluna \"Revisão\", o cartão mostra \"Teste até\" com o dia e a hora, quando o contrato tem prazo de teste, ou \"Pronta para testar\". Clique em \"Revisar\".",
              "Teste a entrega. A janela \"Revisar entrega\" lembra: se estiver como combinado, aprove; se não, conte o que falta e ela volta para a equipe.",
              "Se estiver certo, clique em \"Aprovar\". A tarefa vai para \"Concluído\" e aparece \"Entrega aprovada.\"",
              "Se algo não funcionou, clique em \"Encontrei um problema\", escreva o que você testou e o que não funcionou e clique em \"Enviar para a equipe\". Aparece \"Problema enviado à equipe.\" Antes de enviar, \"Voltar\" leva de novo às duas opções sem mandar nada.",
            ],
          },
          {
            kind: "note",
            tone: "attention",
            text: "Aprovar leva a tarefa para \"Concluído\" e fica registrado com o seu nome e a data. Teste antes de aprovar.",
          },
        ],
      },
      {
        title: "O que fica registrado",
        blocks: [
          {
            kind: "pairs",
            items: [
              { term: "Aprovar", text: "O cartão vai para \"Concluído\" e o Console guarda quem aprovou e quando." },
              { term: "Encontrei um problema", text: "O que você escreveu entra como comentário na tarefa, começando por \"Encontrei um problema:\". O cartão volta para \"Em andamento\" e a equipe recebe um e-mail na hora. O texto é obrigatório e vai até 5.000 caracteres." },
            ],
          },
          {
            kind: "p",
            text: "Uma entrega em Revisão não sai de lá pelo arrasto. Se você tentar, aparece \"Esta entrega está em Revisão: use Revisar para aprovar ou apontar um problema.\" Depois de aprovada, a tarefa fica em \"Concluído\": ninguém da sua empresa a tira de lá, nem pelo arrasto nem por \"Coluna\", que mostra só \"Concluído\". Se tentar, aparece \"Esta tarefa está concluída. Para reabrir, comente na tarefa ou abra um chamado.\"",
          },
        ],
      },
      {
        title: "Prazo para testar",
        blocks: [
          {
            kind: "p",
            text: "O prazo para testar vem do contrato da sua empresa. Quando as condições de atendimento têm esse prazo, ele conta em dias úteis (segunda a sexta, das 9h às 18h, horário de Brasília, menos feriados) a partir do momento em que a entrega entrou em Revisão, e o cartão mostra \"Teste até\". O prazo da sua empresa aparece em [Como trabalhamos](/como-trabalhamos), em \"O que o seu contrato pede\".",
          },
          {
            kind: "note",
            tone: "attention",
            text: "Alguns contratos preveem aceite tácito: sem resposta no prazo, ou se a entrega já estiver em uso, ela conta como aceita. Quando é o caso da sua empresa, Como trabalhamos diz isso. O Console não aprova sozinho: o cartão continua em Revisão e a equipe acompanha.",
          },
        ],
      },
      {
        title: "Cópia dos anexos em Arquivos",
        blocks: [
          {
            kind: "p",
            text: "Quando uma tarefa vai para Revisão ou Concluída, o Console copia os anexos dela para [Arquivos](/bookmarks), na pasta “Entregas”, dentro de uma pasta com o nome do projeto. A cópia aparece em alguns minutos, só para quem vê o projeto, e não ocupa o espaço da empresa. As pastas são do Console, então ninguém as apaga, move ou compartilha. Veja [Arquivos](/ajuda/bookmarks).",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Sou Membro. Posso aprovar uma entrega?",
        a: "Não. Só o Administrador da empresa aprova ou aponta um problema. Você vê o cartão em Revisão e pode comentar na tarefa o que testou. Avise um Administrador da sua empresa para ele responder pelo \"Revisar\".",
      },
      {
        q: "O que acontece quando eu aponto um problema?",
        a: "O que você escreveu entra como comentário na tarefa, começando por \"Encontrei um problema:\". O cartão volta para \"Em andamento\" e a equipe recebe um e-mail na hora. Para enviar, descreva o que você testou e o que não funcionou.",
      },
      {
        q: "Até quando tenho para testar? E se eu não testar?",
        a: "Depende do contrato da sua empresa. Quando as condições de atendimento têm prazo de teste, o cartão mostra \"Teste até\", contado em dias úteis a partir da entrada em Revisão. Os contratos com aceite tácito dizem, em Como trabalhamos, que a entrega sem resposta no prazo, ou já em uso, conta como aceita. O Console não aprova sozinho: o cartão continua em Revisão e a equipe acompanha.",
      },
      {
        q: "Por que o cartão não mostra \"Teste até\"?",
        a: "Porque o contrato da sua empresa não tem prazo de teste publicado no Console, ou porque o contrato é com pessoa física, caso em que o Console não mostra esse prazo. Nesses casos, o Administrador vê \"Pronta para testar\".",
      },
      {
        q: "As entregas estão em projetos diferentes. Como acho cada uma?",
        a: "Com entregas em mais de um projeto, \"Entregas para você revisar\" abre a lista de Projetos. Abra cada projeto e veja a coluna \"Revisão\". O e-mail diário traz o link do quadro de cada entrega.",
      },
      {
        q: "Aprovei e depois encontrei um erro. E agora?",
        a: "Abra um chamado do tipo \"Parou ou deu erro\" e conte o que aconteceu. A tarefa continua em \"Concluído\": só a equipe a reabre. Defeitos no que foi entregue são corrigidos sem custo durante a garantia prevista no contrato da sua empresa.",
      },
    ],
    actions: [
      { label: "Ir para a Visão geral", href: "/painel" },
      { label: "Ir para Projetos", href: "/projetos" },
    ],
    related: ["quadro-do-projeto", "como-trabalhamos", "membro-ou-administrador", "comentarios-e-anexos"],
    updatedAt: "2026-10-27",
  },
  {
    slug: "comentarios-e-anexos",
    category: "projetos",
    title: "Comentários, anexos e responsáveis nas tarefas",
    summary: "Como conversar com a equipe dentro de uma tarefa, enviar arquivos e escolher quem cuida dela.",
    audience: "todos",
    keywords: [
      "comentario",
      "comentar",
      "anexo",
      "anexar arquivo",
      "arquivo",
      "print",
      "responsavel",
      "atribuir",
      "etiqueta",
      "prazo da tarefa",
      "editar tarefa",
      "excluir comentario",
      "pdf",
      "imagem",
    ],
    sections: [
      {
        title: "O que é",
        blocks: [
          {
            kind: "p",
            text: "Cada tarefa do quadro tem duas abas: \"Detalhes\", com os campos da tarefa e os anexos, e \"Comentários\", com a conversa sobre ela. O que for combinado sobre a tarefa fica registrado ali.",
          },
        ],
      },
      {
        title: "Quem pode",
        blocks: [
          {
            kind: "p",
            text: "O Administrador e o Membro que veem o projeto comentam, anexam arquivos, escolhem responsáveis e ajustam os campos das tarefas. Cada pessoa edita e exclui só os próprios comentários.",
          },
        ],
      },
      {
        title: "Comentar",
        blocks: [
          {
            kind: "steps",
            items: [
              "Abra o projeto e clique no cartão da tarefa.",
              "Clique na aba \"Comentários\", que mostra quantos comentários a tarefa tem. Os mais antigos ficam em cima e os novos embaixo.",
              "Escreva em \"Escreva um comentário…\". Se quiser, clique em \"Anexar\" para juntar arquivos.",
              "Clique em \"Comentar\" ou use ⌘/Ctrl + Enter. O comentário aparece no fim da conversa.",
            ],
          },
          {
            kind: "p",
            text: "Um comentário pode ter só texto, só arquivos ou os dois, com até 5.000 caracteres. Os seus aparecem como \"Você\".",
          },
        ],
      },
      {
        title: "Quem fica sabendo",
        blocks: [
          {
            kind: "note",
            tone: "attention",
            text: "Comentar não manda e-mail nem aviso para a equipe ou para a sua empresa. A equipe lê quando abre o quadro. Se a resposta for urgente, ou se algo parou de funcionar, [abra um chamado](/chamados/novo). A exceção é \"Encontrei um problema\" numa entrega em Revisão: aí a equipe recebe um e-mail na hora.",
          },
        ],
      },
      {
        title: "Corrigir ou apagar um comentário",
        blocks: [
          {
            kind: "steps",
            items: [
              "Passe o mouse sobre o seu comentário. No celular, os botões já aparecem.",
              "Para corrigir, clique no lápis (\"Editar comentário\"), ajuste o texto e clique em \"Salvar\" ou use ⌘/Ctrl + Enter. Esc cancela. O comentário passa a mostrar \"· editado\".",
              "Para apagar, clique na lixeira (\"Excluir comentário\") e confirme em \"Excluir comentário?\".",
            ],
          },
          {
            kind: "note",
            tone: "attention",
            text: "Excluir um comentário tira o texto e os arquivos dele da tarefa para todo mundo. Isso não pode ser desfeito.",
          },
          {
            kind: "p",
            text: "Você não altera nem apaga o comentário de outra pessoa. A equipe da Anuntech pode apagar comentários, mas não reescreve o de ninguém.",
          },
        ],
      },
      {
        title: "Anexos na tarefa",
        blocks: [
          {
            kind: "steps",
            items: [
              "Abra a tarefa, ou \"Nova tarefa\" para um pedido novo.",
              "Em \"Anexos\", arraste os arquivos para a área ou clique para escolher.",
              "Clique em \"Salvar\" (ou \"Criar tarefa\"). Os arquivos só entram quando você salva.",
              "Para tirar um arquivo, clique no \"x\" dele. Ele fica riscado, com \"Desfazer\", e só sai quando você clica em \"Salvar\". \"Cancelar\" fecha sem mudar nada.",
              "Para baixar um arquivo, clique no nome dele.",
            ],
          },
          {
            kind: "list",
            items: [
              "Tipos aceitos: PDF, PNG, JPEG ou WebP.",
              "Até 5 arquivos por vez, com 20 MB no total.",
              "Até 20 anexos na própria tarefa. Os arquivos dos comentários não entram nessa conta.",
              "Tira um anexo quem o enviou, quem criou a tarefa ou a equipe.",
              "Só quem vê o projeto baixa os arquivos. Por segurança, o arquivo sempre baixa para o seu computador, sem abrir no navegador.",
            ],
          },
          {
            kind: "note",
            tone: "attention",
            text: "Não envie senhas nem dados reais dos seus clientes em anexos ou comentários. Se a equipe precisar de um acesso, ela combina com você um jeito seguro.",
          },
        ],
      },
      {
        title: "Responsáveis e outros detalhes",
        blocks: [
          {
            kind: "steps",
            items: [
              "Abra a tarefa, na aba \"Detalhes\". O topo mostra quem criou a tarefa e quando ela mudou pela última vez.",
              "Em \"Responsáveis\", escolha pessoas da sua empresa que veem o projeto ou da equipe Anuntech.",
              "Se precisar, ajuste \"Prioridade\", \"Prazo\", \"Estimativa (horas)\" e \"Etiquetas\".",
              "Clique em \"Salvar\". Aparece \"Tarefa atualizada.\"",
            ],
          },
          {
            kind: "list",
            items: [
              "Até 10 responsáveis por tarefa. Quem não vê o projeto não aparece na lista; se aparecer \"Uma das pessoas escolhidas não participa deste projeto.\", escolha outra pessoa.",
              "Ser responsável por uma tarefa não gera e-mail.",
              "Etiquetas: até 8 por tarefa, com até 24 caracteres cada. A mesma etiqueta tem sempre a mesma cor.",
              "Você pode ajustar os campos de qualquer tarefa do projeto, inclusive as criadas pela equipe. A mudança fica registrada, mas não avisa ninguém.",
            ],
          },
        ],
      },
    ],
    faq: [
      {
        q: "A equipe fica sabendo quando eu comento?",
        a: "Não na hora. Comentar não manda e-mail para ninguém; a equipe lê ao abrir o quadro. Se for urgente, abra um chamado. A exceção é \"Encontrei um problema\" numa entrega em Revisão, que manda um e-mail para a equipe na hora.",
      },
      {
        q: "Quais arquivos posso anexar numa tarefa?",
        a: "PDF, PNG, JPEG ou WebP: até 5 arquivos por vez, com 20 MB no total, e até 20 anexos na própria tarefa. Os arquivos dos comentários não entram na conta dos 20.",
      },
      {
        q: "Por que o arquivo baixa em vez de abrir no navegador?",
        a: "Por segurança, todo arquivo do Console sai como download, para nenhum conteúdo rodar dentro do Console. Abra o arquivo baixado no seu computador.",
      },
      {
        q: "Quem posso colocar como responsável?",
        a: "Até 10 pessoas, entre a equipe da Anuntech e as pessoas da sua empresa que veem aquele projeto. Quem não vê o projeto não aparece na lista. Ser responsável não gera e-mail.",
      },
      {
        q: "Posso editar ou apagar o comentário de outra pessoa?",
        a: "Não. Você edita e apaga só os seus comentários, pelo lápis e pela lixeira.",
      },
      {
        q: "Tirei um anexo por engano. Dá para voltar?",
        a: "Enquanto você não salvou, sim: clique em \"Desfazer\" no arquivo riscado ou em \"Cancelar\". Depois de salvar, o arquivo sai da tarefa; envie de novo se precisar.",
      },
      {
        q: "Posso excluir uma tarefa?",
        a: "Só se foi você que a criou. Abra a tarefa, clique em \"Excluir\" e confirme. Ela sai do quadro com os anexos e os comentários, e isso não pode ser desfeito.",
      },
    ],
    actions: [{ label: "Ir para Projetos", href: "/projetos" }],
    related: ["quadro-do-projeto", "pedir-uma-tarefa", "aprovar-entregas", "abrir-um-chamado"],
    updatedAt: "2026-10-14",
  },
  {
    slug: "produtos-e-servicos",
    category: "produtos",
    title: "Seus produtos e serviços",
    summary: "Onde ver e abrir o que a sua empresa tem com a Anuntech, e o que cada pessoa vê ali.",
    audience: "todos",
    keywords: [
      "produtos",
      "servicos",
      "produtos e servicos",
      "sistema",
      "app",
      "aplicativo",
      "abrir sistema",
      "link",
      "valor",
      "mensalidade",
      "vencimento",
      "contratado",
      "plano",
      "link em breve",
    ],
    sections: [
      {
        title: "O que é",
        blocks: [
          {
            kind: "p",
            text: "\"Produtos e serviços\" reúne o que a sua empresa contratou com a Anuntech. A página funciona como um lançador: o clique abre direto cada item. Um serviço abre a página dele no Console. Um produto abre o próprio endereço numa nova aba, ou abre dentro do Console quando é um app feito para rodar aqui.",
          },
        ],
      },
      {
        title: "Onde fica",
        blocks: [
          {
            kind: "list",
            items: [
              "No computador: \"Produtos e serviços\", no menu do Console.",
              "No celular: \"Produtos\", na barra de baixo.",
              "Na [Visão geral](/painel): o indicador \"Produtos e serviços\" e o quadro de mesmo nome, com até 5 itens ativos.",
            ],
          },
        ],
      },
      {
        title: "Quem vê o quê",
        blocks: [
          {
            kind: "list",
            items: [
              "Administrador: todos os itens da empresa e, na visualização \"Lista\", o valor e o próximo vencimento de cada um.",
              "Membro: todos os itens, sem valores nem vencimentos. Se um Administrador escolheu \"Só o que eu escolher\" para ele, só os itens marcados. Veja [Escolher o que cada Membro vê](/ajuda/o-que-cada-membro-ve).",
              "Alguns apps abrem só para o Administrador. Veja [Apps que abrem dentro do Console](/ajuda/apps-no-console).",
            ],
          },
        ],
      },
      {
        title: "Abrir um item",
        blocks: [
          {
            kind: "steps",
            items: [
              "Abra \"Produtos e serviços\".",
              "Encontre o item. Embaixo do nome aparece a descrição dele ou, sem descrição, \"Serviço da Anuntech\", o endereço do produto ou \"Produto da Anuntech\".",
              "Veja no canto do item o que o clique faz e clique para abrir.",
            ],
          },
          {
            kind: "pairs",
            items: [
              { term: "Ver detalhes", text: "Um serviço. Abre a página dele no Console. No celular aparece só a seta." },
              { term: "Abrir, com a seta ›", text: "Um app que roda dentro do Console. Abre na mesma aba." },
              { term: "Abrir, com a seta ↗", text: "Um produto com endereço próprio. Abre numa nova aba." },
              { term: "Link em breve", text: "Um produto que ainda não tem endereço cadastrado e, por isso, não abre." },
            ],
          },
        ],
      },
      {
        title: "Buscar, filtrar e ver em lista",
        blocks: [
          {
            kind: "list",
            items: [
              "A página abre em \"Grade\", com os ícones e sem valores. Em \"Lista\", os itens aparecem em linhas, com a situação de cada um. O Console lembra a escolha neste navegador.",
              "A busca (\"Buscar por nome\") e o filtro de situação aparecem quando há mais de 8 itens ativos ou algum item pausado ou concluído.",
              "O filtro começa em \"Ativos\". Escolha \"Pausados\", \"Concluídos\" ou \"Todas as situações\" para ver os outros.",
              "Um item pausado ou concluído mostra a situação no próprio cartão.",
            ],
          },
        ],
      },
      {
        title: "Valores e vencimentos",
        blocks: [
          {
            kind: "p",
            text: "Só o Administrador da empresa vê valores e vencimentos. Na Grade não aparece valor, nem para ele. Para ver, o Administrador escolhe \"Lista\" e confere as colunas \"Valor\" (por mês ou por ano) e \"Próximo vencimento\", que aparecem em telas médias ou maiores, ou abre a página do serviço, no quadro \"Cobrança\".",
          },
          {
            kind: "p",
            text: "O próximo vencimento é o da fatura em aberto que ainda vai vencer ou, se não houver, o da próxima cobrança da recorrência. Recorrência pausada ou cancelada não mostra vencimento. Veja [Próximas cobranças e recorrências](/ajuda/recorrencias).",
          },
        ],
      },
      {
        title: "A página de um serviço",
        blocks: [
          {
            kind: "steps",
            items: [
              "Clique num serviço (\"Ver detalhes\").",
              "No topo, veja a situação, a empresa e a descrição. Para falar sobre o serviço, clique em \"Abrir chamado\", também no topo. O formulário não marca o serviço sozinho: se a sua empresa tem mais de um item, escolha o serviço em \"Sobre o quê\".",
              "Leia as seções que a equipe preencheu: \"O que fazemos\", \"O que precisamos de você\", \"Resultados esperados\" e \"Prazos\". Só aparecem as preenchidas.",
              "Administrador: no quadro \"Cobrança\", veja o \"Valor\" e o \"Próximo vencimento\", ou \"Sem cobrança vinculada.\"",
            ],
          },
          {
            kind: "p",
            text: "As seções vêm do catálogo da Anuntech e são as mesmas para todas as empresas que têm o serviço. Sem nenhuma seção preenchida, a página diz \"Os detalhes deste serviço serão publicados em breve.\" Os prazos do contrato da sua empresa ficam em [Como trabalhamos](/como-trabalhamos).",
          },
        ],
      },
      {
        title: "Contratar algo novo",
        blocks: [
          {
            kind: "p",
            text: "Quem adiciona produtos e serviços à lista é a equipe da Anuntech. Para contratar algo novo, [peça um orçamento](/ajuda/pedir-um-orcamento).",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Não encontro um produto que sei que a empresa tem. Por quê?",
        a: "Confira o filtro: a página abre em \"Ativos\". Escolha \"Pausados\", \"Concluídos\" ou \"Todas as situações\". Se você é Membro, um Administrador pode ter escolhido \"Só o que eu escolher\" para você em Membros; nesse caso, você só vê os itens marcados, e um item novo só aparece quando ele marcar. Fale com um Administrador da sua empresa.",
      },
      {
        q: "Por que não vejo valores nem vencimentos?",
        a: "Valores e vencimentos são só para o Administrador da empresa. Mesmo ele não vê valores na Grade: para ver, ele troca para \"Lista\" (colunas \"Valor\" e \"Próximo vencimento\", em telas maiores) ou abre a página do serviço, no quadro \"Cobrança\". O Membro não recebe esses dados.",
      },
      {
        q: "O que quer dizer \"Link em breve\"?",
        a: "Que o produto ainda não tem endereço cadastrado pela equipe e, por isso, ainda não abre. Na visualização \"Lista\", o mesmo item aparece como \"Sem link cadastrado\". Quando a Anuntech cadastrar o link, o item passa a mostrar \"Abrir\".",
      },
      {
        q: "Cliquei num produto e ele abriu numa nova aba. Está certo?",
        a: "Sim. Um produto com endereço próprio abre numa nova aba. Só os apps feitos para rodar dentro do Console abrem na mesma aba.",
      },
      {
        q: "A página do serviço diz que os detalhes serão publicados em breve. O que faço?",
        a: "A equipe ainda não preencheu as seções desse serviço. Se precisar de uma informação agora, clique em \"Abrir chamado\" na própria página.",
      },
      {
        q: "Como adiciono um produto ou serviço?",
        a: "Só a equipe da Anuntech adiciona itens à lista. Para contratar algo novo, peça um orçamento.",
      },
    ],
    actions: [{ label: "Ir para Produtos e serviços", href: "/produtos" }],
    related: ["apps-no-console", "o-que-cada-membro-ve", "recorrencias", "pedir-um-orcamento"],
    updatedAt: "2026-10-14",
  },
  {
    slug: "apps-no-console",
    category: "produtos",
    title: "Apps que abrem dentro do Console",
    summary: "Como abrir os apps da sua empresa que só funcionam dentro do Console, quem pode abrir cada um e o que fazer quando um app não abre.",
    audience: "todos",
    keywords: [
      "app",
      "aplicativo",
      "sistema",
      "abrir app",
      "app nao abre",
      "recarregar",
      "app travou",
      "tela branca",
      "link do app",
      "endereco do app",
      "liberado",
      "acesso ao app",
      "painel administrativo",
    ],
    sections: [
      {
        title: "O que é",
        blocks: [
          {
            kind: "p",
            text: "Alguns apps que a Anuntech faz para a sua empresa só funcionam dentro do Console. Eles aparecem em [Produtos e serviços](/produtos) com \"Abrir\" e uma seta para o lado e abrem na mesma aba, ocupando a área de conteúdo.",
          },
          {
            kind: "p",
            text: "É o Console que decide quem abre cada app, pela sua conta e pelo seu papel na empresa. Por isso, fora do Console, o app não abre sozinho.",
          },
        ],
      },
      {
        title: "Quem pode abrir",
        blocks: [
          {
            kind: "list",
            items: [
              "Administrador da empresa: todos os apps da empresa.",
              "Membro: só os apps liberados para Membros. Num app só de Administrador, aparece \"Só o Administrador da empresa abre este app\".",
              "Membro com \"Só o que eu escolher\": só os apps dos produtos que um Administrador marcou para ele.",
              "Em qualquer caso, o produto precisa estar ativo. Pausado ou concluído, o app não abre pelo Console.",
            ],
          },
        ],
      },
      {
        title: "Como abrir",
        blocks: [
          {
            kind: "steps",
            items: [
              "Em \"Produtos e serviços\", ou no quadro de mesmo nome na Visão geral, clique no app.",
              "O app abre na mesma aba. Enquanto carrega, aparece \"Abrindo\" e o nome do produto.",
              "Use a barra de cima: a seta volta para Produtos e serviços, e ao lado ficam o nome do produto e a empresa.",
              "Se o app travar, ficar em branco ou a sessão dele acabar, clique em \"Recarregar\". No celular, o botão mostra só o ícone.",
              "Se aparecer um erro, clique em \"Tentar de novo\" ou em \"Ver produtos e serviços\".",
            ],
          },
          {
            kind: "p",
            text: "Cada vez que você abre o app ou clica em \"Recarregar\", o Console confere de novo o seu acesso e gera uma liberação nova, válida por 2 minutos e só para aquele app. Cada abertura fica registrada no Console.",
          },
        ],
      },
      {
        title: "Abrir pelo endereço do app",
        blocks: [
          {
            kind: "p",
            text: "Se você digitar o endereço do app no navegador ou abrir um link salvo, o app leva você para o Console.",
          },
          {
            kind: "steps",
            items: [
              "Se você ainda não entrou, entre com o código ou com o Google. Depois disso, o Console volta para o app.",
              "Se você tem um único produto com aquele app, ele abre direto.",
              "Se tem mais de um produto com esse app, o Console abre Produtos e serviços já buscando pelo nome do app, para você escolher.",
              "Se nenhum produto ativo que você vê na sua empresa usa aquele app, aparece \"Este app não está liberado para você\", com o e-mail da conta em que você entrou e o botão \"Ver produtos e serviços\".",
            ],
          },
          {
            kind: "note",
            tone: "info",
            text: "O app sempre abre na tela inicial dele. Depois de abrir, navegue até a tela que você queria.",
          },
        ],
      },
      {
        title: "Quando o app não abre",
        blocks: [
          {
            kind: "pairs",
            items: [
              { term: "Só o Administrador da empresa abre este app", text: "O app é só para Administradores. Peça a um Administrador da sua empresa se você precisar usar." },
              { term: "O nome do produto, seguido de \"está pausado\" ou \"está concluído\"", text: "Enquanto o produto não estiver ativo, o app não abre pelo Console. Fale com a Anuntech para retomar." },
              { term: "Este app ainda não foi liberado para a sua empresa", text: "A Anuntech precisa ligar os dados da sua empresa ao app antes do primeiro acesso. Clique em \"Abrir chamado\" se precisar dele agora." },
              { term: "Este produto abre fora do Console", text: "O endereço cadastrado não é de um app do Console. Clique em \"Abrir produto\" para abrir numa nova aba." },
              { term: "Este app não está liberado para você", text: "Nenhum produto ativo da sua empresa usa esse app, entre os que você vê. Confira se entrou com o e-mail certo ou fale com o Administrador da sua empresa." },
              { term: "Este app não foi encontrado", text: "O produto pode ter sido removido ou não estar mais entre os que você vê. Clique em \"Ver produtos e serviços\" e confira a lista." },
              { term: "Não deu para falar com o Console", text: "Confira a conexão com a internet e clique em \"Tentar de novo\"." },
              { term: "O Console não conseguiu abrir o app agora", text: "Tente de novo em alguns minutos. Se continuar, abra um chamado." },
            ],
          },
          {
            kind: "note",
            tone: "attention",
            text: "Cada acesso ao Console é pessoal, e cada abertura de app fica ligada a quem entrou. Não use a conta de um colega para abrir um app: se outra pessoa precisa dele, um Administrador a convida em Membros. Veja [Convidar, reenviar convite e remover acesso](/ajuda/convidar-pessoas).",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Apareceu \"Só o Administrador da empresa abre este app\". O que faço?",
        a: "Alguns apps só abrem para o Administrador da empresa. Se você precisa usar esse app, peça a um Administrador da sua empresa.",
      },
      {
        q: "Abri o endereço do app direto no navegador e fui parar no Console. Está certo?",
        a: "Sim. Esses apps só funcionam dentro do Console. Se você não tinha entrado, entre e o Console volta para o app. Se você tem mais de um produto com esse app, o Console abre Produtos e serviços já buscando pelo nome, para você escolher.",
      },
      {
        q: "O app parou ou ficou em branco. Como resolvo?",
        a: "Clique em \"Recarregar\", na barra de cima do app. Cada abertura gera uma liberação nova para o app. Se aparecer um erro, use \"Tentar de novo\". Se continuar, abra um chamado.",
      },
      {
        q: "Apareceu \"Este app não está liberado para você\". Por quê?",
        a: "Nenhum produto ativo da sua empresa usa esse app, entre os que você vê. Confira o e-mail mostrado na mensagem: talvez você tenha entrado com outra conta. Se o e-mail estiver certo, fale com o Administrador da sua empresa ou com a Anuntech.",
      }
    ],
    actions: [{ label: "Ir para Produtos e serviços", href: "/produtos" }],
    related: ["produtos-e-servicos", "o-que-cada-membro-ve", "membro-ou-administrador", "entrar"],
    updatedAt: "2026-10-14",
  },
];
