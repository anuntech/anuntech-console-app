import type { HelpArticle } from "../help-model";

export const condicoesPessoasArticles: HelpArticle[] = [
  {
    slug: "como-trabalhamos",
    category: "condicoes",
    title: "Prazos do seu contrato (Como trabalhamos)",
    summary: "Onde ver o que o contrato da sua empresa promete e pede, e como a Anuntech conta o tempo de cada prazo.",
    audience: "todos",
    keywords: [
      "prazos",
      "prazo do contrato",
      "como trabalhamos",
      "seus prazos",
      "o que o seu contrato pede",
      "sla",
      "dias uteis",
      "horario de atendimento",
      "primeira resposta",
      "meta de solucao",
      "feriado",
      "condicoes de atendimento",
      "regras do contrato",
    ],
    sections: [
      {
        title: "O que é",
        blocks: [
          {
            kind: "p",
            text: "Como trabalhamos é a página que explica como a Anuntech atende a sua empresa: quando abrir um chamado, como contamos o tempo, o que ajuda a equipe, como andam os projetos e como contratar algo novo. Esse texto é o mesmo para todos os clientes e não traz prazos.",
          },
          {
            kind: "p",
            text: 'Os prazos do seu contrato aparecem em dois quadros dentro da página: "Seus prazos", com o que a Anuntech promete, e "O que o seu contrato pede", com o que cabe à sua empresa. A equipe copia cada valor do contrato assinado e confere com o texto antes de publicar, então a página só mostra o que a sua empresa assinou.',
          },
        ],
      },
      {
        title: "Onde fica",
        blocks: [
          {
            kind: "list",
            items: [
              'Nesta central de Ajuda, no botão "Abrir Como trabalhamos" deste artigo. A [Ajuda](/ajuda) abre pelo menu da conta (a sua foto, no fim do menu do Console) e, no celular, em "Mais".',
              'Nos Primeiros passos da Visão geral, no passo "Leia como trabalhamos com vocês".',
              'No link "Como contamos o tempo", no quadro "Prazos" de um chamado que tem prazo.',
              'No link "Como trabalhamos", em "Sobre este projeto", na página do projeto.',
              'Para Administradores, em "Próximos passos", na página de um contrato assinado.',
            ],
          },
          {
            kind: "p",
            text: "Administradores e Membros abrem a página e veem os mesmos quadros. Condições próprias de um produto, serviço ou projeto só aparecem para quem vê esse item.",
          },
        ],
      },
      {
        title: "Como ler os seus prazos",
        blocks: [
          {
            kind: "steps",
            items: [
              "Abra [Como trabalhamos](/como-trabalhamos).",
              'Pelo índice (à esquerda no computador, em botões no topo no celular), vá a "Prazos e como contamos o tempo".',
              'Leia o quadro "Seus prazos". Conforme o contrato, ele mostra a primeira resposta e a meta de cada prioridade, a garantia, se o prazo para enquanto a equipe espera você, o atendimento fora do horário e o banco de horas.',
              'Vá a "O que ajuda a equipe" e leia o quadro "O que o seu contrato pede": em quanto tempo responder à equipe, testar as entregas e contestar o relatório de horas, e o pagamento em dia.',
              "Se a sua empresa tem condições próprias para um produto, serviço ou projeto, elas aparecem num bloco com o nome dele.",
            ],
          },
        ],
      },
      {
        title: "O que cada quadro pode mostrar",
        blocks: [
          {
            kind: "pairs",
            items: [
              {
                term: "Seus prazos",
                text: "A primeira resposta de cada prioridade (Crítica, Alta e Normal), com a meta de solução quando o contrato tem. Ou uma primeira resposta única e, quando o contrato prevê, a primeira resposta com o serviço todo fora do ar. Também pode trazer a garantia da entrega até uma data, a pausa do prazo enquanto a equipe espera você, a regra de atendimento fora do horário, as horas do banco por mês e a garantia de cada melhoria.",
              },
              {
                term: "O que o seu contrato pede",
                text: "Em quantos dias úteis responder aos pedidos da equipe, testar cada entrega e contestar o relatório de horas, e com quantos dias de atraso o serviço pode ser suspenso. Quando o contrato tem aceite tácito, o quadro avisa que a entrega sem resposta no prazo, ou já em uso, conta como aceita. Quando o contrato tem desenvolvimento e banco de horas, avisa também que uma falha causada por mudança feita sem avisar a Anuntech é tratada como melhoria e usa o banco.",
              },
            ],
          },
          {
            kind: "note",
            tone: "info",
            text: 'Os quadros mostram só as regras que valem para a sua empresa, sem o número da cláusula. O quadro "O que o seu contrato pede" não aparece quando o contrato não pede nada da sua empresa.',
          },
        ],
      },
      {
        title: "Quando os quadros aparecem",
        blocks: [
          {
            kind: "p",
            text: "Os quadros aparecem depois que a equipe cadastra as condições a partir do contrato assinado e confere cada valor com o texto. Se ela marcou uma data de publicação, eles aparecem a partir dessa data. Antes disso, nenhum prazo aparece no Console e vale o horário de atendimento: dias úteis, das 9h às 18h, horário de Brasília.",
          },
          {
            kind: "p",
            text: "Cada chamado guarda as condições que valiam quando foi aberto. Se o contrato mudar, os chamados já abertos seguem as regras de antes e os novos seguem as novas.",
          },
        ],
      },
      {
        title: "Como contamos o tempo",
        blocks: [
          {
            kind: "list",
            items: [
              "Dias úteis: segunda a sexta, menos os feriados nacionais, a Sexta-feira Santa e os feriados da cidade da sede da Anuntech.",
              "Horário: das 9h às 18h, horário de Brasília. Um dia útil tem 9 horas úteis.",
              "Um chamado aberto fora do horário começa a contar no próximo início de expediente: às 9h do próximo dia útil, ou às 9h do mesmo dia quando foi aberto antes das 9h num dia útil.",
              "A primeira resposta é um compromisso. A solução, quando o contrato prevê, tem uma meta, porque depende do problema, dos acessos e de respostas suas e de outros fornecedores.",
              'Um chamado em "Ajuste ou algo novo" tem só o prazo da primeira resposta, porque a equipe avalia o pedido antes. Um chamado em "App ou projeto novo" não tem prazo: a equipe marca uma conversa e prepara um orçamento.',
            ],
          },
          {
            kind: "p",
            text: "Como cada prazo aparece dentro do chamado está em [Prazos de atendimento e como contamos o tempo](/ajuda/prazos-de-atendimento).",
          },
        ],
      },
      {
        title: "O que fica registrado",
        blocks: [
          {
            kind: "p",
            text: "Abrir Como trabalhamos marca como feito o passo de leitura dos Primeiros passos, na Visão geral. A leitura não vale como aceite de nenhuma regra: as regras são as do contrato assinado.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Por que não aparece nenhum prazo para a minha empresa?",
        a: "Os prazos só aparecem depois que a equipe cadastra as condições do contrato assinado e confere cada valor, e a partir da data de publicação, quando ela marca uma. Até lá, vale o horário de atendimento: dias úteis, das 9h às 18h, horário de Brasília. Se o contrato já foi assinado e nada aparece, pergunte à equipe por chamado.",
      },
      {
        q: "Onde vejo o prazo de um chamado específico?",
        a: 'Na página do chamado, no quadro "Prazos": a data da primeira resposta e, quando o contrato tem, a meta de solução. Antes de enviar, o quadro "O que esperar" do formulário já mostra a data da primeira resposta. Os dois só aparecem quando o chamado tem prazo. Veja [Prazos de atendimento](/ajuda/prazos-de-atendimento).',
      },
      {
        q: "Abri um chamado à noite ou no fim de semana. Quando o prazo começa?",
        a: "No próximo início de expediente: às 9h do próximo dia útil. Se você abriu antes das 9h num dia útil, ele começa às 9h do mesmo dia.",
      },
      {
        q: "O prazo da Anuntech para enquanto a equipe espera uma resposta minha?",
        a: 'Só quando o contrato prevê. Nesse caso, "Seus prazos" diz que o prazo para enquanto a equipe espera uma resposta, um acesso ou um teste seu, e o chamado mostra desde quando o prazo está pausado. Ele volta a contar quando você responde no chamado.',
      },
      {
        q: "Um Membro vê os mesmos prazos que o Administrador?",
        a: "Sim. A única diferença é que condições próprias de um produto, serviço ou projeto só aparecem para quem vê esse item.",
      },
      {
        q: "Abrir Como trabalhamos vale como aceite das regras?",
        a: "Não. A página só marca como feito o passo de leitura dos Primeiros passos. As regras que valem são as do contrato assinado.",
      },
      {
        q: "O contrato mudou. Os chamados abertos mudam de prazo?",
        a: "Não. Cada chamado guarda as condições de quando foi aberto. As regras novas valem para os chamados abertos depois da mudança.",
      },
    ],
    actions: [{ label: "Abrir Como trabalhamos", href: "/como-trabalhamos" }],
    related: ["prazos-de-atendimento", "banco-de-horas", "situacoes-do-chamado", "tipos-de-chamado"],
    updatedAt: "2026-10-14",
  },
  {
    slug: "banco-de-horas",
    category: "condicoes",
    title: "Banco de horas",
    summary: "Quanto do banco de horas do mês já foi usado, em quê, e quem decide quando ele chega ao limite.",
    audience: "todos",
    keywords: [
      "banco de horas",
      "horas",
      "horas usadas",
      "saldo de horas",
      "pacote de horas",
      "horas do mes",
      "horas contratadas",
      "consumo de horas",
      "aviso do banco",
      "banco acabando",
      "garantia",
      "defeito critico",
      "lancamento de horas",
    ],
    sections: [
      {
        title: "O que é",
        blocks: [
          {
            kind: "p",
            text: "Quando o contrato da sua empresa inclui um banco de horas, ele traz um número de horas por mês. A equipe lança cada hora trabalhada com a data, o que foi feito e, quando há, o chamado. O Console soma o mês e mostra o uso na Visão geral.",
          },
          {
            kind: "p",
            text: 'As horas do seu plano estão em [Como trabalhamos](/como-trabalhamos), no quadro "Seus prazos".',
          },
        ],
      },
      {
        title: "Quem vê e quem decide",
        blocks: [
          {
            kind: "pairs",
            items: [
              {
                term: "Administrador",
                text: "Vê o card, recebe por e-mail o aviso do banco e o relatório do mês, aprova horas além do banco e estimativas de melhoria e contesta o relatório.",
              },
              {
                term: "Membro",
                text: "Vê o card e o aviso na Visão geral. Não recebe os e-mails do banco e não aprova nem contesta: para isso, fala com um Administrador da empresa.",
              },
            ],
          },
          {
            kind: "p",
            text: "Um Membro que vê só alguns produtos, serviços e projetos vê o total do mês, mas só os lançamentos dos itens que ele vê e os que não são de nenhum item. [Escolher o que cada Membro vê](/ajuda/o-que-cada-membro-ve).",
          },
        ],
      },
      {
        title: "Onde ver o uso",
        blocks: [
          {
            kind: "steps",
            items: [
              "Abra a [Visão geral](/painel).",
              'No card "Banco de horas", no alto da página, veja o mês com as horas usadas e as incluídas, a barra e o percentual usado.',
              "Abaixo, veja os últimos lançamentos: a data, o que foi feito, o chamado (ou quem fez) e as horas.",
              'Se o relatório do mês já foi enviado, a linha "Relatório de" mostra quando ele saiu e, quando o contrato tem prazo para contestar, até quando pode ser contestado.',
            ],
          },
          {
            kind: "note",
            tone: "info",
            text: "O card só aparece quando o contrato da empresa tem banco de horas e as condições já foram publicadas para você. Sem isso, a Visão geral não mostra o card.",
          },
        ],
      },
      {
        title: "O que conta no banco",
        blocks: [
          {
            kind: "list",
            items: [
              'Contam as horas lançadas no banco e as de correção de defeito crítico, marcadas com "defeito crítico".',
              'Não contam as horas de garantia, marcadas com "garantia, fora do banco".',
              "O mês é o mês do dia trabalhado, no horário de Brasília.",
              "Horas que sobram não passam para o mês seguinte.",
              "O card mostra os 5 lançamentos mais recentes do mês. A lista completa vai no relatório que os Administradores recebem por e-mail.",
              "A página do chamado não mostra as horas lançadas. Ela mostra só a estimativa de uma melhoria, quando a equipe manda uma.",
            ],
          },
        ],
      },
      {
        title: "Quando o banco chega ao aviso",
        blocks: [
          {
            kind: "p",
            text: "O contrato define um percentual de aviso. Quando o uso do mês chega a ele:",
          },
          {
            kind: "list",
            items: [
              "a barra muda de cor, e fica vermelha quando o banco chega a 100%;",
              'a Visão geral mostra o item "Banco de horas em N%" em "Precisa de atenção", para Administradores e Membros;',
              'os Administradores recebem o e-mail "Banco de horas em N%", uma vez por mês, no e-mail de acesso deles;',
              'o card passa a mostrar aos Administradores o botão "Aprovar horas além do banco".',
            ],
          },
          {
            kind: "note",
            tone: "attention",
            text: "Fora a correção de um defeito crítico, nada passa do banco sem a aprovação de um Administrador da empresa. Veja [Horas além do banco](/ajuda/horas-alem-do-banco).",
          },
        ],
      },
      {
        title: "Melhorias e o banco",
        blocks: [
          {
            kind: "p",
            text: 'Um pedido em "Ajuste ou algo novo" pode virar uma melhoria que sai do banco. A equipe manda uma estimativa no chamado, e as horas só saem do banco depois que um Administrador aprova. Acima do limite do contrato, o pedido vira orçamento. [Melhorias com estimativa de horas](/ajuda/estimativas-de-melhoria).',
          },
          {
            kind: "p",
            text: "Quando o contrato prevê, uma falha causada por mudança feita sem avisar a Anuntech é tratada como melhoria e usa o banco de horas.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "O que conta no banco de horas?",
        a: 'As horas lançadas no banco e as de correção de defeito crítico. As horas de garantia, marcadas com "garantia, fora do banco", não contam.',
      },
      {
        q: "As horas que sobram passam para o mês seguinte?",
        a: "Não. Cada mês começa com as horas do plano, e o que sobrou do mês anterior não acumula.",
      },
      {
        q: "Por que não vejo o card do banco de horas?",
        a: "O card só aparece quando o contrato da empresa tem banco de horas e a equipe já publicou as condições dele. Se a sua empresa contratou um banco e o card não aparece, pergunte à equipe por chamado.",
      },
      {
        q: "Onde vejo todas as horas lançadas no mês?",
        a: "O card da Visão geral mostra os 5 lançamentos mais recentes. A lista completa vai no relatório mensal, que os Administradores recebem por e-mail. [Relatório mensal de horas](/ajuda/relatorio-de-horas).",
      },
      {
        q: "Quem recebe o aviso quando o banco está acabando?",
        a: 'Os Administradores da empresa, por e-mail, uma vez por mês. Os Membros veem o aviso em "Precisa de atenção", na Visão geral. Os contatos de Notificações não recebem esse aviso.',
      },
      {
        q: "Sou Membro. Posso aprovar horas além do banco?",
        a: "Não. Só um Administrador da empresa aprova horas além do banco e estimativas de melhoria. Se a equipe precisar continuar, peça a um Administrador.",
      },
      {
        q: "Quanto custa a hora além do banco?",
        a: "É o valor por hora previsto no contrato. O card do banco não mostra esse valor. Confira no contrato assinado.",
      },
    ],
    actions: [{ label: "Ir para a Visão geral", href: "/painel" }],
    related: ["horas-alem-do-banco", "relatorio-de-horas", "estimativas-de-melhoria", "como-trabalhamos"],
    updatedAt: "2026-10-14",
  },
  {
    slug: "relatorio-de-horas",
    category: "condicoes",
    title: "Relatório mensal de horas e contestação",
    summary: "O relatório do banco de horas que os Administradores recebem todo mês e como contestar o que não confere.",
    audience: "administrador",
    keywords: [
      "relatorio de horas",
      "relatório",
      "contestar",
      "contestacao",
      "relatorio mensal",
      "horas lancadas",
      "discordo das horas",
      "horas erradas",
      "conferir horas",
      "prazo de contestacao",
      "banco de horas",
    ],
    sections: [
      {
        title: "O que é",
        blocks: [
          {
            kind: "p",
            text: "Todo mês com horas lançadas, os Administradores recebem por e-mail o relatório do banco de horas do mês anterior. Ele traz as horas usadas e as incluídas, as horas além do banco aprovadas, quando houver, e cada lançamento com a data, as horas, o que foi feito e o chamado. É a lista completa: o card da Visão geral mostra só os últimos lançamentos.",
          },
          {
            kind: "p",
            text: "Com ele, a sua empresa confere o que foi lançado antes de qualquer cobrança de horas além do banco. Quando o contrato prevê um prazo para contestar, o relatório sem contestação nesse prazo conta como aprovado.",
          },
        ],
      },
      {
        title: "Quem recebe e quem contesta",
        blocks: [
          {
            kind: "list",
            items: [
              "O e-mail vai para os Administradores da empresa, no e-mail de acesso deles. Os contatos de Notificações não recebem.",
              'Só um Administrador contesta. Um Membro vê a linha do relatório no card, sem o botão "Contestar". Se ele achar algo errado, fala com um Administrador.',
            ],
          },
        ],
      },
      {
        title: "Quando o relatório chega",
        blocks: [
          {
            kind: "list",
            items: [
              "O relatório do mês anterior sai sozinho a partir do segundo dia útil do mês, quando a equipe ainda não o enviou.",
              "Mês sem horas lançadas não gera relatório.",
              'O assunto do e-mail é "Banco de horas de", seguido do mês, do ano e do nome da empresa.',
              "A equipe também pode mandar um relatório parcial durante o mês ou reenviar o relatório. Quando ela reenvia, o prazo para contestar recomeça a contar do novo envio.",
            ],
          },
        ],
      },
      {
        title: "Como contestar",
        blocks: [
          {
            kind: "steps",
            items: [
              "Abra a [Visão geral](/painel).",
              'No card "Banco de horas", encontre a linha "Relatório de" do mês, com a data de envio.',
              'Clique em "Contestar", no fim da linha.',
              'No campo "O que não confere.", escreva o que está errado: o dia, o lançamento e o motivo.',
              'Clique em "Contestar relatório". A mensagem "Contestação enviada. A equipe responde por chamado." confirma.',
            ],
          },
          {
            kind: "p",
            text: 'Depois da contestação, a linha do relatório do mês anterior sai do card. A de um relatório do mês corrente passa a mostrar "Contestado em" com a data.',
          },
          {
            kind: "note",
            tone: "attention",
            text: 'Fora do prazo, o Console não aceita a contestação e mostra "O prazo para contestar este relatório terminou em" com a data. Nesse caso, fale com a equipe por chamado.',
          },
        ],
      },
      {
        title: "Regras da contestação",
        blocks: [
          {
            kind: "list",
            items: [
              'O prazo para contestar é o do contrato, em dias úteis contados do envio. Ele está em "O que o seu contrato pede", em [Como trabalhamos](/como-trabalhamos), e no próprio e-mail. O card mostra "Pode ser contestado até" com a data.',
              'Terminado o prazo sem contestação, o relatório conta como aprovado e o botão "Contestar" some. A linha do mês anterior sai do card, e a de um relatório do mês corrente passa a dizer "Aprovado: o prazo de contestação terminou."',
              "O texto precisa de pelo menos 5 caracteres e vai até 2.000.",
              'Cada relatório aceita uma contestação. Uma segunda tentativa mostra "Este relatório já foi contestado."',
              "A equipe recebe a contestação na hora e responde por chamado.",
              "O relatório do mês anterior continua no card enquanto ainda pode ser contestado.",
              "As horas além do banco de um mês só seguem para cobrança depois que o prazo de contestação termina sem contestação.",
            ],
          },
        ],
      },
    ],
    faq: [
      {
        q: "Não recebi o relatório de horas. Por quê?",
        a: 'O relatório vai só para os Administradores, no e-mail de acesso, e só sai para meses com horas lançadas. Se você é Administrador e o mês teve horas, veja no card "Banco de horas" da Visão geral se aparece a linha "Relatório de" com a data de envio. Se não aparecer, pergunte à equipe por chamado.',
      },
      {
        q: "Até quando posso contestar?",
        a: 'Até o fim do prazo do contrato, contado em dias úteis desde o envio. O card mostra "Pode ser contestado até" com a data, e o e-mail do relatório diz quantos dias úteis o contrato dá.',
      },
      {
        q: "O que acontece se eu não contestar?",
        a: 'Quando o contrato prevê prazo para contestar, o relatório conta como aprovado no fim do prazo, e o botão "Contestar" some do card.',
      },
      {
        q: "Posso contestar duas vezes o mesmo relatório?",
        a: "Não. Cada relatório aceita uma contestação. Escreva tudo o que não confere de uma vez. Se surgir algo depois, fale com a equipe no chamado da contestação.",
      },
      {
        q: "Por que o prazo para contestar mudou?",
        a: "Quando a equipe reenvia o relatório, por exemplo o final depois de um parcial, o prazo recomeça a contar do novo envio.",
      },
      {
        q: "Sou Membro e vi um lançamento errado. O que faço?",
        a: "Avise um Administrador da sua empresa. Só ele contesta o relatório pelo Console.",
      },
    ],
    actions: [{ label: "Ir para a Visão geral", href: "/painel" }],
    related: ["banco-de-horas", "horas-alem-do-banco", "como-trabalhamos"],
    updatedAt: "2026-10-14",
  },
  {
    slug: "horas-alem-do-banco",
    category: "condicoes",
    title: "Horas além do banco",
    summary: "Como um Administrador autoriza a equipe a passar do banco de horas no mês e como o excedente é cobrado.",
    audience: "administrador",
    keywords: [
      "horas extras",
      "hora extra",
      "horas alem do banco",
      "excedente",
      "passar do banco",
      "aprovar horas",
      "autorizar horas",
      "banco estourado",
      "acabou o banco",
      "cobranca de horas",
      "valor da hora",
    ],
    sections: [
      {
        title: "O que é",
        blocks: [
          {
            kind: "p",
            text: "Quando o banco de horas do mês chega ao limite, a equipe só continua com a aprovação de um Administrador da empresa. A exceção é a correção de um defeito crítico, que pode passar do banco sem aprovação. O Administrador diz até quantas horas além do banco a equipe pode usar no mês, e o que passar do banco é cobrado pelo valor por hora do contrato.",
          },
          {
            kind: "p",
            text: "É o que o contrato prevê: fora um defeito crítico, a equipe não passa do banco sem a decisão da sua empresa.",
          },
        ],
      },
      {
        title: "Quem pode",
        blocks: [
          {
            kind: "p",
            text: "Só um Administrador da empresa aprova. Um Membro vê o card e o aviso, sem o botão. Se a equipe precisar continuar, ele pede a um Administrador.",
          },
        ],
      },
      {
        title: "Como aprovar",
        blocks: [
          {
            kind: "steps",
            items: [
              "Abra a [Visão geral](/painel).",
              'No card "Banco de horas", clique em "Aprovar horas além do banco". O botão aparece quando o uso do mês chega ao percentual de aviso do contrato.',
              'Em "Até quantas horas além do banco neste mês?", digite o limite, como 5 ou 1,5.',
              'Clique em "Aprovar". O Console confirma o limite aprovado e lembra que o excedente é cobrado pelo valor do contrato. O card passa a mostrar quantas horas além do banco estão aprovadas.',
              'Para mudar o limite no mesmo mês, clique de novo em "Aprovar horas além do banco", troque o número e clique em "Aprovar".',
            ],
          },
          {
            kind: "note",
            tone: "attention",
            text: "As horas além do banco são cobradas à parte, pelo valor por hora do contrato. Confira esse valor no contrato antes de aprovar.",
          },
        ],
      },
      {
        title: "Regras da aprovação",
        blocks: [
          {
            kind: "list",
            items: [
              "O limite vale só para o mês corrente. No mês seguinte, o banco recomeça, e passar dele de novo pede uma nova aprovação.",
              "Um novo valor substitui o anterior, sem somar. Para liberar mais 3 horas sobre 5 já aprovadas, digite 8.",
              "O número precisa ser maior que zero e ir até 200 horas. Use vírgula para frações, como 1,5.",
              "A equipe recebe um aviso a cada aprovação.",
              "A correção de um defeito crítico pode passar do banco mesmo sem aprovação.",
            ],
          },
        ],
      },
      {
        title: "Como o excedente é cobrado",
        blocks: [
          {
            kind: "list",
            items: [
              "O excedente são as horas que o mês usou além das incluídas no banco, inclusive as de correção de defeito crítico, pelo valor por hora do contrato. O card do banco não mostra esse valor.",
              "A cobrança só é preparada depois do fim do mês e do envio do relatório final do mês. Quando o contrato prevê prazo para contestar o relatório, também depois que esse prazo termina sem contestação.",
              "A conta usa as horas incluídas e o valor por hora do relatório que a sua empresa recebeu, mesmo que as condições mudem depois.",
              "A equipe prepara a cobrança à mão, e nada é cobrado sozinho. Ela chega como uma fatura em [Financeiro](/financeiro).",
            ],
          },
          {
            kind: "p",
            text: "Se as horas do mês não conferem, conteste o relatório dentro do prazo. [Relatório mensal de horas e contestação](/ajuda/relatorio-de-horas).",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Posso aprovar horas além do banco antes de ele chegar ao aviso?",
        a: 'Pelo Console, não: o botão "Aprovar horas além do banco" aparece quando o uso chega ao percentual de aviso do contrato. Se quiser combinar antes, fale com a equipe por chamado.',
      },
      {
        q: "A aprovação vale para os próximos meses?",
        a: "Não. Ela vale só para o mês em que foi feita. No mês seguinte, uma nova aprovação é necessária para passar do banco.",
      },
      {
        q: "Aprovei 5 horas e a equipe precisa de mais. Como faço?",
        a: 'Clique de novo em "Aprovar horas além do banco" e digite o total do mês. O novo número substitui o anterior, sem somar: para liberar mais 3 horas sobre 5, digite 8.',
      },
      {
        q: "A equipe pode passar do banco sem a minha aprovação?",
        a: "Só para corrigir um defeito crítico. Essas horas também contam no banco e, se passarem dele, entram no excedente. Fora isso, nada passa do banco sem a aprovação de um Administrador da empresa.",
      },
      {
        q: "Quanto custa cada hora além do banco?",
        a: "O valor por hora do contrato. O card do banco não mostra esse valor. Confira no contrato assinado.",
      },
      {
        q: "Quando chega a cobrança do excedente?",
        a: "Depois que o mês fecha, o relatório final é enviado e, quando o contrato prevê, o prazo de contestação termina sem contestação. A equipe prepara a cobrança, que aparece como fatura em Financeiro.",
      },
    ],
    actions: [
      { label: "Ir para a Visão geral", href: "/painel" },
      { label: "Ir para Financeiro", href: "/financeiro" },
    ],
    related: ["banco-de-horas", "relatorio-de-horas", "estimativas-de-melhoria", "faturas"],
    updatedAt: "2026-10-14",
  },
  {
    slug: "membro-ou-administrador",
    category: "pessoas",
    title: "Membro ou Administrador",
    summary: "O que cada papel vê e faz no Console, como saber o seu e quem pode mudar.",
    audience: "todos",
    keywords: [
      "administrador",
      "membro",
      "permissao",
      "papel",
      "perfil de acesso",
      "admin",
      "gestor",
      "nao vejo financeiro",
      "quem e o administrador",
      "mudar permissao",
      "tipo de usuario",
      "nivel de acesso",
    ],
    video: "acessos",
    sections: [
      {
        title: "Os dois papéis",
        blocks: [
          {
            kind: "p",
            text: "Cada pessoa da sua empresa entra no Console com um de dois papéis. Só um Administrador da empresa muda o papel de alguém.",
          },
          {
            kind: "pairs",
            items: [
              {
                term: "Administrador",
                text: "Vê e faz tudo da empresa: Visão geral, Projetos, Produtos e serviços, Chamados, Bookmarks, Financeiro, Orçamentos e Contratos, com valores e vencimentos. Responde orçamentos, assina contratos, aprova entregas, estimativas de melhoria e horas além do banco, e contesta o relatório de horas. Cuida de Membros, Notificações e Dados da empresa.",
              },
              {
                term: "Membro",
                text: "Usa a Visão geral, Projetos, Produtos e serviços, Chamados e Bookmarks, sem valores nem vencimentos. Abre chamados e pede orçamentos, cria e comenta tarefas nos projetos, usa o assistente e o ditado e abre os apps liberados a membros. Um Administrador pode limitar o Membro a alguns produtos, serviços e projetos.",
              },
            ],
          },
        ],
      },
      {
        title: "Como saber o seu papel",
        blocks: [
          {
            kind: "steps",
            items: [
              'Olhe o menu do Console. Se aparecem "Financeiro", "Orçamentos" e "Contratos", você é Administrador. Sem eles, você é Membro.',
              'Confira o menu da conta (a sua foto, no fim do menu do Console): só o Administrador tem "Membros".',
              'Se preferir, pergunte ao assistente: "Sou Administrador ou Membro?". Ele sabe o seu papel.',
            ],
          },
          {
            kind: "p",
            text: 'No celular, as abas do Administrador são "Início", "Produtos", "Chamados" e "Financeiro". As do Membro são "Início", "Produtos", "Chamados" e "Projetos". O resto fica em "Mais".',
          },
          {
            kind: "note",
            tone: "info",
            text: 'O Membro não vê o próprio papel escrito em nenhuma tela, nem quem é o Administrador. Se precisar saber, ele pergunta a quem o convidou ou abre um chamado do tipo "Acesso". O Administrador vê o papel de cada pessoa, inclusive o dele, em Membros.',
          },
        ],
      },
      {
        title: "O que só o Administrador faz",
        blocks: [
          {
            kind: "list",
            items: [
              "Ver faturas, boletos e recorrências em [Financeiro](/financeiro).",
              "Aceitar ou recusar um orçamento.",
              "Ler, pedir alteração e assinar um contrato.",
              "Aprovar as entregas que estão em Revisão nos projetos.",
              "Aprovar estimativas de melhoria e horas além do banco, e contestar o relatório de horas.",
              "Convidar e remover pessoas, mudar papéis e escolher o que cada Membro vê, em Membros.",
              "Escolher quem recebe os avisos, em Notificações, e manter os Dados da empresa.",
              "Receber por e-mail os orçamentos e contratos enviados e os lembretes deles, o aviso de contrato assinado, as entregas para revisar, o aviso e o relatório do banco de horas e o resumo semanal.",
            ],
          },
          {
            kind: "p",
            text: "Um Membro que precisa de algo desta lista pede a um Administrador da empresa.",
          },
        ],
      },
      {
        title: "Mudar o papel de alguém",
        blocks: [
          {
            kind: "steps",
            items: [
              'Um Administrador abre o menu da conta e escolhe "Membros".',
              'No menu "..." da pessoa, clica em "Editar permissão".',
              'Em "Permissão", escolhe Membro ou Administrador e clica em "Salvar".',
            ],
          },
          {
            kind: "list",
            items: [
              '"Editar permissão" aparece para quem já entrou. Para um convite pendente, convide de novo o mesmo e-mail com a outra permissão: o Console atualiza o acesso e não manda outro e-mail.',
              'Ninguém muda o próprio papel. A sua linha aparece com "(você)" e sem menu.',
              "A empresa sempre fica com pelo menos um Administrador. Para rebaixar o último, promova outra pessoa antes.",
              "Promover um Membro a Administrador apaga a escolha do que ele via, porque o Administrador vê tudo.",
              "Mudar a permissão não manda aviso à pessoa. Se for o caso, avise você mesmo.",
            ],
          },
        ],
      },
    ],
    faq: [
      {
        q: "Como sei se sou Administrador ou Membro?",
        a: 'Olhe o menu do Console. Se aparecem "Financeiro", "Orçamentos" e "Contratos", e o menu da conta tem "Membros", você é Administrador. Sem esses itens, você é Membro. Você também pode perguntar ao assistente, que sabe o seu papel.',
      },
      {
        q: "Sou Membro. Por que não vejo Financeiro, Orçamentos e Contratos?",
        a: 'Essas áreas são só dos Administradores, porque trazem valores, vencimentos, propostas e contratos. Se você precisa desse acesso, peça a um Administrador da sua empresa que mude a sua permissão em "Membros".',
      },
      {
        q: "Como descubro quem é o Administrador da minha empresa?",
        a: 'O Console não mostra isso ao Membro. Pergunte a quem convidou você ou abra um chamado do tipo "Acesso", e a equipe da Anuntech responde.',
      },
      {
        q: 'Abri o link de uma fatura e apareceu "Não encontramos esta página". Por quê?',
        a: "Faturas, orçamentos e contratos só abrem para Administradores. O Console mostra a mesma tela quando o registro não existe e quando ele está fora do seu acesso, para não revelar o que você não pode ver. Se você digitar o endereço de Financeiro, Orçamentos ou Contratos, a lista abre vazia: essas áreas só mostram dados para o Administrador. Confira também se entrou com o e-mail certo.",
      },
      {
        q: "A empresa pode ter mais de um Administrador?",
        a: 'Pode. Em "Membros", um Administrador abre o menu "..." da pessoa, clica em "Editar permissão" e escolhe Administrador. A empresa nunca fica sem pelo menos um.',
      },
      {
        q: "Posso ser Administrador de uma empresa e Membro de outra?",
        a: "Não. Cada conta pertence a uma só empresa no Console, com um papel só. Um e-mail que já tem acesso a outra empresa não pode ser convidado para a sua.",
      },
      {
        q: "Como deixo de ser Administrador?",
        a: "Outro Administrador da empresa muda a sua permissão. Ninguém rebaixa o próprio acesso, e a empresa sempre fica com pelo menos um Administrador.",
      },
    ],
    actions: [
      { label: "Ir para Membros (Administrador)", href: "/configuracoes/membros" },
      { label: "Abrir um chamado", href: "/chamados/novo" },
    ],
    related: ["convidar-pessoas", "o-que-cada-membro-ve", "conhecer-o-console", "notificacoes"],
    updatedAt: "2026-10-14",
  },
  {
    slug: "convidar-pessoas",
    category: "pessoas",
    title: "Convidar, reenviar convite e remover acesso",
    summary: "Como um Administrador dá acesso ao Console a uma pessoa da empresa, reenvia o convite e tira o acesso de quem saiu.",
    audience: "administrador",
    keywords: [
      "convidar",
      "convite",
      "adicionar pessoa",
      "novo usuario",
      "liberar acesso",
      "reenviar convite",
      "cancelar convite",
      "remover acesso",
      "tirar acesso",
      "funcionario saiu",
      "nao recebeu convite",
      "membros",
      "usuarios",
    ],
    sections: [
      {
        title: "Antes de começar",
        blocks: [
          {
            kind: "p",
            text: "Entrar no Console não dá acesso a nada. Cada pessoa precisa ser adicionada por um Administrador da empresa ou pela equipe da Anuntech. Cada acesso é pessoal: convide cada pessoa com o próprio e-mail.",
          },
          {
            kind: "p",
            text: "Só um Administrador convida, reenvia e remove. Um Membro que precisa liberar alguém pede a um Administrador da empresa.",
          },
          {
            kind: "p",
            text: 'Tudo fica em [Membros](/configuracoes/membros). No computador, abra o menu da conta (a sua foto, no fim do menu do Console) e escolha "Membros". No celular, toque em "Mais" e, em "Conta", em "Membros".',
          },
        ],
      },
      {
        title: "Convidar uma pessoa",
        blocks: [
          {
            kind: "steps",
            items: [
              'Abra "Membros".',
              'Em "Convidar pessoa", digite o e-mail da pessoa.',
              'Em "Permissão", escolha Membro (o padrão) ou Administrador. Veja a diferença em [Membro ou Administrador](/ajuda/membro-ou-administrador).',
              'Para um Membro que deve ver só alguns produtos, serviços ou projetos, clique em "Escolher o que ele vê" e marque os itens. Sem isso, ele vê tudo da empresa.',
              'Clique em "Convidar pessoa". A mensagem "Acesso liberado. Um e-mail de convite foi enviado." confirma.',
            ],
          },
          {
            kind: "p",
            text: 'A pessoa recebe o e-mail "Seu acesso ao Console da Anuntech", com o endereço para entrar. Ela informa o e-mail convidado e confirma com um código que chega por e-mail. Até o primeiro acesso, ela aparece na lista como "Aguardando primeiro acesso"; depois, como "Ativo". [Primeiro acesso](/ajuda/primeiro-acesso).',
          },
          {
            kind: "p",
            text: 'Você também pode pedir ao assistente que convide alguém, dizendo o e-mail e a permissão. Um Membro convidado assim vê tudo da empresa até você escolher em "O que esta pessoa vê".',
          },
          {
            kind: "note",
            tone: "attention",
            text: 'Se aparecer "Acesso liberado, mas não foi possível enviar o e-mail de convite. Avise a pessoa manualmente.", o acesso já existe. Mande a ela o endereço do Console e peça que entre com o e-mail convidado.',
          },
        ],
      },
      {
        title: "Reenviar o convite",
        blocks: [
          {
            kind: "steps",
            items: [
              'Em "Membros", clique no menu "..." da pessoa que está em "Aguardando primeiro acesso".',
              'Clique em "Reenviar convite" e confirme em "Reenviar". Aparece "Convite reenviado para" com o e-mail.',
            ],
          },
          {
            kind: "list",
            items: [
              'Dá para reenviar uma vez por semana para cada pessoa, e a semana vai de segunda a domingo. Uma segunda tentativa na mesma semana mostra "O convite já foi reenviado esta semana. Confira o e-mail com a pessoa."',
              "Antes de reenviar, confira com a pessoa se o e-mail do convite está escrito certo. Se estiver errado, cancele o convite e convide o e-mail certo.",
            ],
          },
        ],
      },
      {
        title: "Cancelar um convite ou remover um acesso",
        blocks: [
          {
            kind: "steps",
            items: [
              'Em "Membros", clique no menu "..." da pessoa.',
              'Para um convite pendente, clique em "Cancelar convite" e confirme. A pessoa não poderá mais entrar com esse convite.',
              'Para quem já entra, clique em "Remover acesso" e confirme. A pessoa perde o acesso à empresa no Console.',
            ],
          },
          {
            kind: "list",
            items: [
              "O que a pessoa registrou continua guardado: chamados, comentários e aprovações.",
              "Remover apaga a escolha do que ela via. Se ela for convidada de novo, volta a ver tudo da empresa até alguém escolher outra vez.",
              "Ninguém remove o próprio acesso, e a empresa sempre fica com pelo menos um Administrador.",
              "Remover o acesso ou mudar a permissão não manda aviso à pessoa. Se for o caso, avise você mesmo.",
            ],
          },
          {
            kind: "note",
            tone: "attention",
            text: "Quando alguém sair da empresa, remova o acesso em Membros. Enquanto ele existir, a pessoa continua entrando no Console com o próprio e-mail.",
          },
        ],
      },
      {
        title: "Regras do convite",
        blocks: [
          {
            kind: "list",
            items: [
              'Uma conta pertence a uma só empresa no Console. Se o e-mail já tem acesso por outra empresa cliente, ou pela equipe da Anuntech, aparece "Esta conta já pertence a outro ambiente. Remova o vínculo anterior antes de convidá-la." Nesse caso, convide outro e-mail da pessoa ou peça que o outro acesso seja removido.',
              'Convidar um e-mail que já tem acesso à sua empresa só atualiza a permissão. Aparece "Acesso atualizado. A pessoa já tinha acesso a esta empresa." e nenhum e-mail novo sai.',
              'Abrir Membros conta como revisão de quem tem acesso. Seis meses depois da sua última revisão, a Visão geral volta a mostrar a você o passo "Revise quem tem acesso: faz 6 meses desde a última revisão", mesmo com os Primeiros passos ocultos.',
              'A lista mostra 25 pessoas por página. Use "Por página" para ver mais de uma vez.',
            ],
          },
        ],
      },
    ],
    faq: [
      {
        q: "A pessoa não recebeu o convite. O que faço?",
        a: 'Confira com ela se o e-mail está escrito certo. Depois, em "Membros", abra o menu "..." da pessoa e clique em "Reenviar convite". Dá para reenviar uma vez por semana. Ela também pode abrir o endereço do Console e entrar com o e-mail convidado, que recebe o código de acesso.',
      },
      {
        q: 'Apareceu "Esta conta já pertence a outro ambiente". E agora?',
        a: "Cada conta pertence a uma só empresa no Console. Se a pessoa já tem acesso por outra empresa cliente ou pela equipe da Anuntech, convide outro e-mail dela ou peça que o acesso anterior seja removido.",
      },
      {
        q: "Errei o e-mail do convite. Como corrijo?",
        a: 'Em "Membros", abra o menu "..." do convite errado, clique em "Cancelar convite" e convide o e-mail certo.',
      },
      {
        q: "O que acontece com os chamados de quem eu removi?",
        a: "Continuam guardados, com os comentários e as aprovações da pessoa. Ela só perde o acesso ao Console.",
      },
      {
        q: "Posso remover o meu próprio acesso?",
        a: "Não. Outro Administrador precisa fazer isso, e a empresa sempre fica com pelo menos um Administrador.",
      },
      {
        q: "A pessoa precisa de senha?",
        a: "Não. O Console não usa senha: ela entra com um código enviado ao e-mail convidado. Veja [Entrar no Console](/ajuda/entrar).",
      },
      {
        q: "Sou Membro. Como dou acesso a um colega?",
        a: 'Peça a um Administrador da sua empresa. Se não souber quem é, abra um chamado do tipo "Acesso".',
      },
    ],
    actions: [{ label: "Ir para Membros", href: "/configuracoes/membros" }],
    related: ["membro-ou-administrador", "o-que-cada-membro-ve", "primeiro-acesso", "seguranca-da-conta"],
    updatedAt: "2026-10-14",
  },
  {
    slug: "o-que-cada-membro-ve",
    category: "pessoas",
    title: "Escolher o que cada Membro vê",
    summary: "Como limitar um Membro aos produtos, serviços e projetos de que ele cuida, e o que continua visível para ele.",
    audience: "administrador",
    keywords: [
      "o que esta pessoa ve",
      "limitar acesso",
      "restringir acesso",
      "so o que eu escolher",
      "tudo da empresa",
      "acesso por projeto",
      "acesso por produto",
      "esconder projeto",
      "ver so alguns projetos",
      "visibilidade",
      "membro",
      "permissao por produto",
    ],
    sections: [
      {
        title: "O que é",
        blocks: [
          {
            kind: "p",
            text: "Por padrão, um Membro vê tudo da empresa: todos os produtos, serviços e projetos, inclusive os que entrarem depois. Um Administrador pode limitar o Membro aos itens de que ele cuida, sem tirar o resto de quem precisa.",
          },
          {
            kind: "p",
            text: "O Administrador sempre vê tudo. A escolha vale só para Membros, e só um Administrador a faz.",
          },
        ],
      },
      {
        title: "Como escolher",
        blocks: [
          {
            kind: "steps",
            items: [
              "Abra [Membros](/configuracoes/membros), pelo menu da conta.",
              'No menu "..." do Membro, clique em "O que esta pessoa vê".',
              'Escolha "Tudo da empresa" ou "Só o que eu escolher".',
              'Com "Só o que eu escolher", marque os itens nos grupos "Projetos" e "Produtos e serviços". "Marcar todos" e "Limpar" ajudam, e o contador mostra quantos estão escolhidos.',
              'Clique em "Salvar".',
            ],
          },
          {
            kind: "p",
            text: 'A mesma escolha aparece no convite, em "Escolher o que ele vê", e em "Editar permissão" quando a permissão é Membro. Na lista, a coluna "Permissão" mostra "Vê: Tudo da empresa" ou quantos itens a pessoa vê. No celular essa coluna não aparece; abra "O que esta pessoa vê" para conferir.',
          },
        ],
      },
      {
        title: "O que muda para o Membro",
        blocks: [
          {
            kind: "list",
            items: [
              "Projetos e Produtos e serviços mostram só os itens marcados, com os quadros, as tarefas, os anexos e os apps abertos no Console.",
              "Em Chamados, somem os chamados sobre os itens fora da escolha. Continuam visíveis os chamados sem produto e os que a própria pessoa abriu, mesmo sobre itens fora dela.",
              "Ao abrir um chamado, a pessoa escolhe só entre os itens marcados.",
              "Na Visão geral e no assistente, só aparecem os itens marcados. O card do banco de horas mostra o total do mês, mas só os lançamentos dos itens dela e os que não são de nenhum item.",
              "Em Como trabalhamos, as condições próprias de um item fora da escolha não aparecem.",
              "Os bookmarks não dependem desta escolha.",
            ],
          },
          {
            kind: "note",
            tone: "attention",
            text: "Itens novos não entram sozinhos. Quando a empresa ganha um produto, serviço ou projeto, o Membro com escolha só o vê depois que você marcar.",
          },
          {
            kind: "note",
            tone: "attention",
            text: "Sem nada marcado, a pessoa só vê os chamados sem produto, os chamados que ela mesma abriu e os bookmarks. Uma escolha vazia nunca vira tudo.",
          },
        ],
      },
      {
        title: "Outras regras",
        blocks: [
          {
            kind: "list",
            items: [
              'Salvar em "Editar permissão" sem mexer na escolha mantém o que a pessoa via.',
              "Promover o Membro a Administrador apaga a escolha, porque o Administrador vê tudo.",
              'Remover o acesso também apaga a escolha. Um convite novo começa em "Tudo da empresa", a menos que você escolha outra vez.',
              "A escolha vale para o que a pessoa vê no Console. Se o e-mail dela estiver nos contatos de Chamados, em [Notificações](/configuracoes/notificacoes), ela recebe os avisos de todos os chamados da empresa, inclusive dos itens fora da escolha.",
            ],
          },
        ],
      },
    ],
    faq: [
      {
        q: "Marquei alguns itens e a pessoa ainda vê um chamado de outro produto. Por quê?",
        a: "Ela continua vendo os chamados que ela mesma abriu e os chamados sem produto, mesmo com a escolha.",
      },
      {
        q: "Criamos um projeto novo e o Membro não vê. Por quê?",
        a: 'Com "Só o que eu escolher", itens novos só aparecem depois que um Administrador marca. Abra "O que esta pessoa vê", marque o projeto e clique em "Salvar".',
      },
      {
        q: 'Não aparece "O que esta pessoa vê" no menu da pessoa. Por quê?',
        a: "A opção existe só para quem tem a permissão Membro. Um Administrador sempre vê tudo. Se a empresa ainda não tem produtos, serviços ou projetos, a escolha avisa que não há itens para marcar.",
      },
      {
        q: "Posso limitar o que um Administrador vê?",
        a: "Não. O Administrador vê tudo da empresa. Para limitar alguém, mude a permissão dele para Membro e faça a escolha.",
      },
      {
        q: "O Membro com escolha vê valores?",
        a: "Não. Nenhum Membro vê valores nem vencimentos, com ou sem escolha.",
      },
    ],
    actions: [{ label: "Ir para Membros", href: "/configuracoes/membros" }],
    related: ["membro-ou-administrador", "convidar-pessoas", "produtos-e-servicos", "notificacoes"],
    updatedAt: "2026-10-14",
  },
  {
    slug: "notificacoes",
    category: "pessoas",
    title: "Quem recebe os avisos (Notificações)",
    summary: "Como escolher quais e-mails e WhatsApps da empresa recebem os avisos de cobrança e de chamados, e como conferir o que foi enviado.",
    audience: "administrador",
    keywords: [
      "notificacoes",
      "avisos",
      "quem recebe",
      "contatos",
      "email de aviso",
      "whatsapp",
      "nao recebo aviso",
      "nao recebi email",
      "aviso de chamado",
      "aviso de cobranca",
      "historico de envios",
      "alertas",
      "email do financeiro",
    ],
    sections: [
      {
        title: "O que é",
        blocks: [
          {
            kind: "p",
            text: "Em Notificações, um Administrador escolhe, por assunto, quais e-mails e telefones da empresa recebem os avisos do Console e por qual canal. Esses contatos não precisam ter acesso ao Console: pode ser o e-mail do financeiro ou de um sócio, por exemplo.",
          },
          {
            kind: "pairs",
            items: [
              {
                term: "Financeiro",
                text: "Novas cobranças, vencimentos e lembretes. [Avisos de cobrança](/ajuda/avisos-de-cobranca).",
              },
              { term: "Chamados", text: "Abertura, respostas e atualizações de qualquer chamado da empresa." },
            ],
          },
        ],
      },
      {
        title: "Onde fica",
        blocks: [
          {
            kind: "p",
            text: 'Abra o menu da conta (a sua foto, no fim do menu do Console) e escolha "Meu perfil". No grupo "Empresa" das configurações (à esquerda no computador, no topo no celular), clique em "Notificações". O passo "Escolha quem recebe os avisos de chamados", nos Primeiros passos da Visão geral, também leva até lá.',
          },
          {
            kind: "p",
            text: "Só um Administrador vê e muda Notificações. Um Membro que quer receber os avisos de chamados pede a um Administrador que inclua o e-mail dele.",
          },
        ],
      },
      {
        title: "Como escolher os contatos",
        blocks: [
          {
            kind: "steps",
            items: [
              "Abra [Notificações](/configuracoes/notificacoes).",
              'No card "Financeiro", preencha "E-mails" e "Telefones". Use "Adicionar e-mail" e "Adicionar telefone" para incluir mais, e o X ao lado de um contato para remover.',
              'Em "Receber por", marque "E-mail", "WhatsApp" ou os dois.',
              'Clique em "Salvar" no card. A mensagem "Preferências de notificações atualizadas." confirma.',
              'Faça o mesmo no card "Chamados".',
            ],
          },
          {
            kind: "note",
            tone: "attention",
            text: 'Os avisos de Chamados vêm desligados. Enquanto ninguém salvar o card "Chamados" com um canal marcado, os contatos da empresa não recebem esses avisos. Quem abre um chamado recebe os dele por e-mail de qualquer jeito.',
          },
        ],
      },
      {
        title: "Regras",
        blocks: [
          {
            kind: "list",
            items: [
              "Até 10 e-mails e 10 telefones por assunto.",
              "Telefone brasileiro com DDD, de 10 ou 11 dígitos. Para o WhatsApp, use um celular com WhatsApp.",
              'Um canal marcado sem contato não salva: aparece "Adicione um e-mail ou desative esse canal." ou "Adicione um telefone ou desative esse canal."',
              "A mudança vale para os próximos envios. Um contato removido deixa de receber até os avisos de chamados que ainda estavam na fila.",
              'Enquanto ninguém salvou, os dois assuntos usam o e-mail e o telefone de [Dados da empresa](/configuracoes/empresa). O "Financeiro" vem com e-mail e WhatsApp ligados, e o "Chamados" com os dois desligados.',
              'Depois do primeiro "Salvar", a lista fica como você deixou e não acompanha mais os Dados da empresa.',
            ],
          },
        ],
      },
      {
        title: "O que não depende desta tela",
        blocks: [
          {
            kind: "list",
            items: [
              "Quem abre um chamado recebe por e-mail o recibo e as movimentações da Anuntech naquele chamado, enquanto tiver acesso à empresa.",
              "Os Administradores recebem no e-mail de acesso deles os orçamentos e contratos enviados e os lembretes deles, o aviso de contrato assinado, as entregas para revisar, o aviso e o relatório do banco de horas e o resumo semanal.",
              "O WhatsApp de [Meu perfil](/conta) serve para entrar no Console e para a verificação em duas etapas. Ele não recebe avisos.",
            ],
          },
          {
            kind: "p",
            text: "A lista completa está em [E-mails e mensagens que o Console envia](/ajuda/avisos-do-console).",
          },
        ],
      },
      {
        title: "Conferir o que foi enviado",
        blocks: [
          {
            kind: "steps",
            items: [
              'Em Notificações, desça até "Histórico de envios".',
              'Em cada linha, veja a "Movimentação" (o chamado ou a fatura; clique para abrir), o "Destinatário" com o canal, a "Situação" e a "Data".',
              "A lista mostra 20 envios por página. Quando houver mais, use as setas no fim da lista para trocar de página.",
            ],
          },
          {
            kind: "pairs",
            items: [
              { term: "Agendado, Na fila e Enviando", text: "O aviso ainda vai sair." },
              {
                term: "Aceito pelo provedor, Enviado, Entregue e Lido",
                text: "O aviso saiu. As últimas etapas aparecem quando o serviço de e-mail ou de WhatsApp confirma.",
              },
              { term: "Falhou e Sem confirmação", text: "O aviso não saiu, ou o serviço não confirmou o envio. O motivo aparece embaixo da situação." },
              {
                term: "Não enviado",
                text: "O envio foi interrompido antes de sair: o canal estava desligado ou sem contato, o contato saiu da lista, ou a fatura já estava paga ou cancelada.",
              },
              { term: "Prazo encerrado", text: "O aviso esperou demais na fila e não foi enviado." },
            ],
          },
          {
            kind: "note",
            tone: "info",
            text: "O histórico mostra os avisos de cobrança e os avisos de chamados enviados aos contatos da empresa. Os recibos de quem abriu um chamado e os e-mails aos Administradores não aparecem nele.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Por que os contatos da empresa não recebem os avisos de chamados?",
        a: 'No assunto Chamados, os canais vêm desligados. Em Notificações, no card "Chamados", preencha os e-mails ou telefones, marque "E-mail" ou "WhatsApp" e clique em "Salvar". Quem abre um chamado recebe os dele por e-mail de qualquer jeito.',
      },
      {
        q: "Dá para enviar um aviso de teste?",
        a: 'Não existe envio de teste. Depois de salvar, espere o próximo aviso real e confira em "Histórico de envios" se ele saiu para o contato novo.',
      },
      {
        q: "Mudei o e-mail financeiro em Dados da empresa. Os avisos de cobrança vão para o novo e-mail?",
        a: 'Só se as preferências do assunto Financeiro nunca foram salvas. Depois do primeiro "Salvar", os avisos vão para a lista do card "Financeiro", em Notificações. Atualize também essa lista.',
      },
      {
        q: "Os contatos precisam ter acesso ao Console?",
        a: "Não. Qualquer e-mail ou telefone da lista recebe os avisos, sem ganhar acesso ao Console.",
      },
      {
        q: "Um Membro pode receber os avisos de chamados?",
        a: 'Sim, se um Administrador incluir o e-mail ou o telefone dele no card "Chamados". Ele passa a receber os avisos de todos os chamados da empresa.',
      },
      {
        q: "Por que não recebi o resumo semanal?",
        a: "O resumo vai só para os Administradores, no e-mail de acesso, toda segunda. Semana sem movimento não gera resumo.",
      },
    ],
    actions: [{ label: "Ir para Notificações", href: "/configuracoes/notificacoes" }],
    related: ["avisos-de-cobranca", "avisos-do-console", "dados-da-empresa", "acompanhar-um-chamado"],
    updatedAt: "2026-10-14",
  },
  {
    slug: "dados-da-empresa",
    category: "pessoas",
    title: "Dados da empresa",
    summary: "O cadastro da empresa que sai nas cobranças, nos contratos e nas notas, e como um Administrador o mantém em dia.",
    audience: "administrador",
    keywords: [
      "dados da empresa",
      "cadastro",
      "cnpj",
      "cpf",
      "razao social",
      "endereco",
      "endereco de cobranca",
      "cep",
      "email financeiro",
      "telefone",
      "mudar endereco",
      "atualizar cadastro",
      "nota fiscal",
    ],
    sections: [
      {
        title: "O que é",
        blocks: [
          {
            kind: "p",
            text: "Dados da empresa é o cadastro que aparece nas cobranças, nos contratos e nas notas: CPF ou CNPJ, razão social, e-mail e telefone do financeiro e o endereço de cobrança.",
          },
          {
            kind: "p",
            text: 'Só um Administrador vê e edita. Um Membro que encontrar algo errado avisa um Administrador. Para abrir, escolha "Meu perfil" no menu da conta e, no grupo "Empresa" das configurações, clique em "Dados da empresa".',
          },
        ],
      },
      {
        title: "Como atualizar",
        blocks: [
          {
            kind: "steps",
            items: [
              "Abra [Dados da empresa](/configuracoes/empresa).",
              'Em "Identificação", confira o "CNPJ" (o campo aceita CPF) e a "Razão social".',
              'Em "Contato financeiro", preencha "E-mail" e "Telefone", com DDD.',
              'Em "Endereço de cobrança e nota fiscal", digite o "CEP". O endereço se completa sozinho; confira "Endereço", "Número", "Complemento", "Bairro", "Cidade" e "UF".',
              'Clique em "Salvar". A mensagem "Dados da empresa atualizados." confirma.',
            ],
          },
        ],
      },
      {
        title: "Regras do cadastro",
        blocks: [
          {
            kind: "list",
            items: [
              'CPF com 11 dígitos ou CNPJ com 14. Se outro cliente já usa o número, aparece "Já existe uma empresa com este CPF/CNPJ."',
              "E-mail e telefone são obrigatórios. O telefone leva DDD e tem 10 ou 11 dígitos.",
              "O endereço vai completo ou fica vazio. Com um campo preenchido, todos são obrigatórios, menos o Complemento.",
              'O CEP preenche o endereço até 20 vezes por hora. Depois disso, aparece "Muitas consultas na última hora. Preencha o endereço manualmente."',
              "A equipe da Anuntech recebe um e-mail com o que mudou, o antes e o depois.",
            ],
          },
          {
            kind: "note",
            tone: "attention",
            text: 'Sem o endereço completo, as cobranças da empresa não podem ser emitidas. Enquanto faltar, se a empresa tem uma fatura ou uma recorrência, os Administradores veem o passo "Complete o endereço de cobrança da empresa" na Visão geral, mesmo com os Primeiros passos ocultos.',
          },
          {
            kind: "note",
            tone: "attention",
            text: "Para as cobranças saírem, a razão social precisa ter até 100 caracteres. O campo aceita mais, mas o banco que emite os boletos recusa.",
          },
          {
            kind: "note",
            tone: "attention",
            text: "Trocar o CPF ou o CNPJ muda o pagador das próximas cobranças.",
          },
        ],
      },
      {
        title: "Dados da empresa e os avisos",
        blocks: [
          {
            kind: "p",
            text: "O e-mail e o telefone daqui são o ponto de partida de [Notificações](/configuracoes/notificacoes). Enquanto ninguém salvou as preferências de um assunto, mudar aqui muda quem recebe aquele assunto. Depois do primeiro salvamento em Notificações, atualize também a lista de lá.",
          },
          {
            kind: "p",
            text: "Para algo que esta tela não tem, como a emissão de nota fiscal, veja [Nota fiscal](/ajuda/nota-fiscal) ou abra um chamado.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Por que não encontro Dados da empresa?",
        a: "A página é só dos Administradores. Se você é Membro, peça a um Administrador da sua empresa que faça a mudança.",
      },
      {
        q: "Posso cadastrar CPF em vez de CNPJ?",
        a: 'Pode. O campo se chama "CNPJ", mas aceita CPF com 11 dígitos.',
      },
      {
        q: "O CEP não preencheu o endereço. E agora?",
        a: 'Preencha os campos à mão: "Endereço", "Número", "Bairro", "Cidade" e "UF" são obrigatórios, e o "Complemento" é opcional. O preenchimento pelo CEP vale até 20 consultas por hora.',
      },
      {
        q: "Mudei o e-mail financeiro. Os avisos de cobrança vão para ele?",
        a: 'Só se as preferências do assunto Financeiro nunca foram salvas em Notificações. Se já foram, atualize também a lista do card "Financeiro" em [Notificações](/configuracoes/notificacoes).',
      },
      {
        q: "Quem fica sabendo quando eu mudo o cadastro?",
        a: "A equipe da Anuntech recebe um e-mail com o antes e o depois de cada campo alterado. Se faltar algo para as cobranças saírem, o mesmo e-mail avisa.",
      },
    ],
    actions: [{ label: "Ir para Dados da empresa", href: "/configuracoes/empresa" }],
    related: ["dados-de-cobranca", "notificacoes", "nota-fiscal", "faturas"],
    updatedAt: "2026-10-14",
  },
];
