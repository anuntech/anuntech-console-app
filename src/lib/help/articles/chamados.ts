import type { HelpArticle } from "../help-model";

export const chamadosArticles: HelpArticle[] = [
  {
    slug: "abrir-um-chamado",
    category: "chamados",
    title: "Abrir um chamado",
    summary: "Como pedir ajuda à equipe da Anuntech pelo Console, com o tipo certo, uma boa descrição e os arquivos que agilizam a resposta.",
    audience: "todos",
    keywords: [
      "abrir chamado",
      "novo chamado",
      "suporte",
      "pedir ajuda",
      "ticket",
      "reportar erro",
      "problema",
      "bug",
      "anexar print",
      "atendimento",
      "solicitacao",
      "falar com o suporte",
      "chat",
      "conversar com a equipe",
    ],
    video: "chamado",
    sections: [
      {
        title: "O que é um chamado",
        blocks: [
          {
            kind: "p",
            text: "O chamado é o canal oficial entre a sua empresa e a equipe da Anuntech. A conversa, os arquivos e cada mudança ficam registrados nele, e é nele que o pedido passa a contar para os prazos do seu contrato.",
          },
          {
            kind: "p",
            text: "Administradores e Membros podem abrir chamados e veem os chamados da empresa. A exceção é o Membro limitado a alguns produtos, serviços ou projetos. [Quem vê cada chamado](/ajuda/acompanhar-um-chamado).",
          },
        ],
      },
      {
        title: "Onde abrir",
        blocks: [
          {
            kind: "list",
            items: [
              'Em [Chamados](/chamados), no menu do Console, pelo botão "Abrir chamado".',
              'No topo da [Visão geral](/painel), pelo mesmo botão.',
              'Na página de um serviço, pelo botão "Abrir chamado". O formulário não marca esse serviço sozinho: escolha-o em "Sobre o quê", quando o campo aparecer.',
              'No celular, em "Mais" → "Criar" → "Abrir chamado".',
              "Conversando com o [assistente](/ajuda/assistente), como explicado mais abaixo.",
            ],
          },
          {
            kind: "p",
            text: 'Dentro do Console, o formulário abre num painel ao lado, com o título "Novo chamado". Ao fechar o painel, você volta para onde estava.',
          },
        ],
      },
      {
        title: "Passo a passo",
        blocks: [
          {
            kind: "steps",
            items: [
              'Clique em "Abrir chamado".',
              'Em "O que você precisa?", escolha o tipo: "Parou ou deu erro", "Dúvida", "Ajuste ou algo novo", "Acesso" ou "App ou projeto novo". Veja [qual tipo escolher](/ajuda/tipos-de-chamado).',
              'Se escolheu "Parou ou deu erro", responda "Qual o impacto?". A opção "Outro problema" já vem marcada: troque se parou tudo ou se a falha afeta muita gente.',
              'Se a empresa tem mais de um produto, serviço ou projeto, escolha em "Sobre o quê". Se não souber, deixe "Não sei ou vale para todos".',
              'Escreva o "Assunto", um resumo em uma linha. Enquanto você escreve, o quadro "Talvez isto responda" pode sugerir artigos da Ajuda. Abrir um deles não fecha o formulário.',
              'Escreva a "Descrição". O texto de exemplo do campo muda conforme o tipo e diz o que contar. Se preferir, clique em "Falar" e dite.',
              'Em "Anexos", arraste os arquivos ou clique para selecionar. Um print da tela ajuda muito.',
              'Leia o quadro "O que esperar". Quando o contrato da empresa tem prazos publicados, ele mostra a data e a hora da primeira resposta.',
              'Clique em "Abrir chamado". Aparece "Chamado aberto." e a página do chamado abre.',
            ],
          },
          {
            kind: "note",
            tone: "attention",
            text: 'O formulário não guarda rascunho. Se você fechar o painel ou sair dele antes de clicar em "Abrir chamado", o que escreveu se perde.',
          },
        ],
      },
      {
        title: "O que contar na descrição",
        blocks: [
          {
            kind: "pairs",
            items: [
              { term: "Parou ou deu erro", text: "O que você fez, o que esperava e o que aconteceu. Um print ajuda." },
              { term: "Dúvida", text: "O que você quer fazer e onde está agora." },
              { term: "Ajuste ou algo novo", text: "O que precisa mudar, onde e por quê." },
              { term: "Acesso", text: "Quem, em qual sistema e o que precisa: liberar, remover ou recuperar." },
              { term: "App ou projeto novo", text: "O problema, quem vai usar e se há uma data importante." },
            ],
          },
          {
            kind: "note",
            tone: "attention",
            text: "Não escreva nem fale senhas ou dados reais dos seus clientes no chamado. Se a equipe precisar de um acesso, ela combina com você um jeito seguro.",
          },
        ],
      },
      {
        title: "Limites do formulário",
        blocks: [
          {
            kind: "pairs",
            items: [
              { term: "Assunto", text: "Obrigatório, com até 160 caracteres." },
              { term: "Descrição", text: "Obrigatória, com até 10.000 caracteres." },
              {
                term: "Anexos",
                text: "PDF, PNG, JPEG ou WebP. Até 5 arquivos e 20 MB no total por envio, e até 20 anexos no chamado inteiro. As imagens são convertidas para WebP e reduzidas a no máximo 2048 pixels de lado.",
              },
              {
                term: "Ditado",
                text: 'O botão "Falar" grava até 2 minutos por vez e põe o texto onde estava o cursor, para você revisar. [Falar em vez de escrever](/ajuda/falar-em-vez-de-escrever).',
              },
            ],
          },
        ],
      },
      {
        title: "O que acontece depois",
        blocks: [
          {
            kind: "list",
            items: [
              'Você recebe por e-mail o recibo "Chamado aberto", com o link "Acompanhe e responda no Console". Quando o contrato prevê, o e-mail diz até quando vem a primeira resposta.',
              'O chamado começa em "Aguardando atendimento". [O que cada situação quer dizer](/ajuda/situacoes-do-chamado).',
              "O Console sugere uma prioridade a partir do tipo e do impacto. A equipe confirma ou muda ao ler o chamado.",
              'Com o impacto "Parou tudo e não dá para contornar", a equipe recebe um aviso na hora.',
              "As condições de atendimento em vigor no dia ficam gravadas no chamado. Uma mudança depois não altera um prazo já informado.",
              "Quem abriu recebe por e-mail cada ação da equipe. [Acompanhar e responder](/ajuda/acompanhar-um-chamado).",
            ],
          },
        ],
      },
      {
        title: "Pelo assistente",
        blocks: [
          {
            kind: "p",
            text: 'Abra o assistente e diga, por exemplo, "Quero abrir um chamado". Ele pergunta o tipo e, se for erro, o impacto, e confirma o assunto e a descrição com você antes de abrir. Se o seu pedido já vier completo, ele pode abrir direto. O chamado aberto assim não leva anexos nem produto: para isso, use o formulário.',
          },
        ],
      },
      {
        title: "Quando usar outro caminho",
        blocks: [
          {
            kind: "list",
            items: [
              "Tarefa de projeto em andamento: comente na própria tarefa. [Comentários e anexos nas tarefas](/ajuda/comentarios-e-anexos).",
              'Algo novo, que ainda não existe: escolha "App ou projeto novo". A equipe conversa com você e prepara um orçamento. [Pedir um orçamento](/ajuda/pedir-um-orcamento).',
              "Pedido feito por WhatsApp ou telefone: a equipe registra num chamado, que aparece na sua lista.",
            ],
          },
        ],
      },
    ],
    faq: [
      {
        q: "Quem pode abrir um chamado?",
        a: 'Qualquer pessoa da empresa com acesso ao Console, Administrador ou Membro. Um Membro que o Administrador limitou a alguns produtos vê em "Sobre o quê" só os itens escolhidos para ele.',
      },
      {
        q: "Preciso escolher o produto?",
        a: 'O campo "Sobre o quê" só aparece quando a empresa tem mais de um produto, serviço ou projeto ativo. Com um só, ele é ligado ao chamado sem perguntar. Se não souber, deixe "Não sei ou vale para todos". O produto escolhido define quais condições de atendimento valem para o chamado.',
      },
      {
        q: "Quais arquivos posso anexar?",
        a: "PDF, PNG, JPEG ou WebP. Até 5 arquivos e 20 MB no total por envio, tanto ao abrir quanto em cada resposta, e até 20 anexos por chamado. As imagens são convertidas para WebP e reduzidas a no máximo 2048 pixels de lado.",
      },
      {
        q: 'Apareceu "Os anexos expiraram". O que houve?',
        a: "Os arquivos sobem quando você clica para enviar e ficam guardados por até 1 hora, até o chamado ou a resposta ser registrado. Se o envio passou desse tempo, selecione os arquivos de novo e envie outra vez.",
      },
      {
        q: "Errei o tipo ou o assunto. Posso corrigir?",
        a: "Depois de aberto, o chamado não é editado. Explique a correção numa resposta na conversa: ela fica registrada, e a equipe ajusta a prioridade se for o caso.",
      },
      {
        q: "Posso apagar um chamado ou uma mensagem?",
        a: "Não. O cliente não apaga mensagens, anexos nem chamados, porque o chamado é o registro do atendimento. Se enviou algo por engano, como uma senha, avise a equipe na conversa: só ela pode excluir um chamado inteiro.",
      },
      {
        q: "Pedi algo por WhatsApp ou telefone. Preciso abrir um chamado também?",
        a: 'Não precisa. A equipe registra o pedido num chamado, que aparece na sua lista aberto pela pessoa da equipe que o registrou. Na página do chamado, em "Aberto por", aparece o nome dela com "Equipe Anuntech" embaixo. Os e-mails desse chamado vão só para os contatos de Chamados da empresa. Para recebê-los, peça a um Administrador que inclua o seu e-mail em [Notificações](/ajuda/notificacoes), ou abra você mesmo o chamado pelo Console.',
      },
      {
        q: 'Qual a diferença entre "Conversar com a equipe" e abrir um chamado?',
        a: '"Conversar com a equipe", no menu da conta (no celular, em "Mais"), abre um chat com a equipe da Anuntech, bom para uma dúvida rápida. A conversa do chat não fica no Console e não conta para os prazos. Quando o assunto precisa de acompanhamento, a equipe registra um chamado, que aparece na sua lista, ou você mesmo abre um em [Chamados](/chamados).',
      },
    ],
    actions: [
      { label: "Abrir chamado", href: "/chamados/novo" },
      { label: "Ir para Chamados", href: "/chamados" },
    ],
    related: ["tipos-de-chamado", "acompanhar-um-chamado", "prazos-de-atendimento", "falar-em-vez-de-escrever"],
    updatedAt: "2026-10-14",
  },
  {
    slug: "tipos-de-chamado",
    category: "chamados",
    title: "Qual tipo de chamado escolher",
    summary: "Os cinco tipos do formulário, quando usar cada um e o que cada escolha muda na prioridade, no prazo e no caminho do pedido.",
    audience: "todos",
    keywords: [
      "tipo de chamado",
      "erro",
      "duvida",
      "ajuste",
      "acesso",
      "projeto novo",
      "impacto",
      "parou tudo",
      "sistema fora do ar",
      "melhoria",
      "categoria",
      "liberar acesso",
      "recuperar acesso",
    ],
    sections: [
      {
        title: "Os cinco tipos",
        blocks: [
          {
            kind: "p",
            text: 'O primeiro campo do formulário é "O que você precisa?". A escolha ajuda a equipe a entender o pedido e define a prioridade sugerida e os prazos que valem.',
          },
          {
            kind: "pairs",
            items: [
              {
                term: "Parou ou deu erro",
                text: "Algo não funciona como deveria. Diga também o impacto: é ele que define a prioridade sugerida.",
              },
              { term: "Dúvida", text: "Como usar ou onde encontrar algo." },
              {
                term: "Ajuste ou algo novo",
                text: "Um texto, uma regra, uma tela ou uma função. A equipe avalia se o pedido entra no que você já tem, se sai do banco de horas ou se precisa de orçamento.",
              },
              { term: "Acesso", text: "Liberar, remover ou recuperar um acesso. Diga quem, em qual sistema e o que precisa." },
              { term: "App ou projeto novo", text: "Algo que ainda não existe. A equipe conversa com você e prepara um orçamento." },
            ],
          },
        ],
      },
      {
        title: "O impacto, para erros",
        blocks: [
          {
            kind: "p",
            text: 'Ao escolher "Parou ou deu erro", o formulário pergunta "Qual o impacto?":',
          },
          {
            kind: "pairs",
            items: [
              {
                term: "Parou tudo e não dá para contornar",
                text: "O Console sugere Crítica nos contratos com níveis de prioridade e Alta nos demais. A equipe recebe um aviso na hora.",
              },
              { term: "Falha, mas dá para contornar, ou afeta muita gente", text: "O Console sugere Alta." },
              { term: "Outro problema", text: "Já vem marcado. O Console sugere Normal." },
            ],
          },
          {
            kind: "note",
            tone: "info",
            text: "A prioridade é decisão da equipe da Anuntech. O Console só sugere a partir do que você marcou, e a equipe confirma ou muda ao ler o chamado. Se mudar, quem abriu recebe um e-mail e os prazos do chamado são recalculados.",
          },
        ],
      },
      {
        title: "O que cada tipo muda",
        blocks: [
          {
            kind: "list",
            items: [
              'Prioridade: só "Parou ou deu erro" recebe uma sugestão acima de Normal. Os outros tipos começam em Normal.',
              'Prazo: "Ajuste ou algo novo" tem só o prazo da primeira resposta, sem meta de solução, porque o pedido é avaliado antes. "App ou projeto novo" fica fora dos prazos de atendimento. [Prazos de atendimento](/ajuda/prazos-de-atendimento).',
              'Produto: em "App ou projeto novo", o campo "Sobre o quê" não aparece e nenhum produto é ligado ao pedido.',
              "Descrição: o texto de exemplo do campo muda e diz o que contar em cada caso.",
            ],
          },
        ],
      },
      {
        title: "Ajuste ou algo novo: o aviso do seu contrato",
        blocks: [
          {
            kind: "p",
            text: "Ao escolher este tipo, o formulário mostra um aviso com o caminho do pedido, conforme o contrato da sua empresa. Ele diz uma destas coisas:",
          },
          {
            kind: "list",
            items: [
              "Contrato de suporte com banco de horas: a equipe avalia se é um ajuste incluído no suporte ou uma melhoria. A melhoria até o limite do contrato sai do banco de horas depois que um Administrador aprovar a estimativa. Acima disso, a empresa recebe um orçamento em Orçamentos. [Melhorias com estimativa de horas](/ajuda/estimativas-de-melhoria).",
              "Contrato que não inclui desenvolvimento: a equipe avalia o pedido e, se fizer sentido, envia um orçamento.",
              "Nos demais casos, e enquanto a empresa não tem condições publicadas no Console: a equipe avalia o pedido e diz se ele entra no que você já tem ou se precisa de orçamento.",
            ],
          },
        ],
      },
      {
        title: "Quando o caminho é outro",
        blocks: [
          {
            kind: "list",
            items: [
              "Tarefa de projeto em andamento: comente na própria tarefa.",
              "Dar ou tirar o acesso de alguém da sua empresa ao Console: um Administrador faz isso em Membros, sem chamado. [Convidar pessoas](/ajuda/convidar-pessoas).",
              'O botão "Pedir orçamento", em Orçamentos (só para Administradores) e em Projetos quando ainda não há projeto ativo, abre este mesmo formulário já no tipo "App ou projeto novo", com o título "Pedir orçamento" e o botão "Enviar pedido".',
            ],
          },
        ],
      },
    ],
    faq: [
      {
        q: "Que tipo de chamado eu escolho?",
        a: '"Parou ou deu erro" quando algo não funciona como deveria; nesse caso, diga também o impacto. "Dúvida" para saber como usar ou onde encontrar algo. "Ajuste ou algo novo" para mudar um texto, uma regra, uma tela ou uma função. "Acesso" para liberar, remover ou recuperar um acesso. "App ou projeto novo" quando você quer algo que ainda não existe: a equipe conversa com você e prepara um orçamento.',
      },
      {
        q: "Fiquei em dúvida entre erro e ajuste. Qual escolho?",
        a: 'Se algo parou de funcionar ou não faz o que deveria, escolha "Parou ou deu erro". Se funciona e você quer que passe a funcionar de outro jeito, escolha "Ajuste ou algo novo". Na dúvida, escolha o mais próximo e explique na descrição.',
      },
      {
        q: 'Marquei "Outro problema", mas o sistema parou. E agora?',
        a: "Explique na conversa que parou tudo e que não há como contornar. A equipe pode subir a prioridade ao ler o chamado. Nos contratos com níveis de prioridade, os prazos passam a ser os da nova prioridade.",
      },
      {
        q: 'Por que "App ou projeto novo" não mostra prazo?',
        a: "Um pedido novo segue o caminho do orçamento: a equipe marca uma conversa para entender o que você precisa e prepara uma proposta. Por isso ele fica fora dos prazos de atendimento.",
      },
      {
        q: "Um Membro pode pedir um orçamento?",
        a: 'Pode, escolhendo "App ou projeto novo" no formulário de chamado. A conversa segue no chamado, que o Membro acompanha. O orçamento chega em Orçamentos, área que só os Administradores veem, e só um Administrador aceita ou recusa.',
      },
      {
        q: 'Preciso dar acesso ao Console a um colega. Abro um chamado de "Acesso"?',
        a: 'Não precisa. Um Administrador da sua empresa convida a pessoa em Membros. Use o tipo "Acesso" para pedir à equipe que libere, remova ou recupere um acesso, dizendo quem, em qual sistema e o que precisa.',
      },
    ],
    actions: [
      { label: "Abrir chamado", href: "/chamados/novo" },
      { label: "Pedir orçamento", href: "/chamados/novo?tipo=novo-projeto" },
    ],
    related: ["abrir-um-chamado", "prazos-de-atendimento", "estimativas-de-melhoria", "pedir-um-orcamento"],
    updatedAt: "2026-10-14",
  },
  {
    slug: "acompanhar-um-chamado",
    category: "chamados",
    title: "Acompanhar e responder um chamado",
    summary: "Onde ver os chamados da empresa, como ler a página de cada um e como responder à equipe com texto ou arquivos.",
    audience: "todos",
    keywords: [
      "acompanhar chamado",
      "responder chamado",
      "lista de chamados",
      "meus chamados",
      "resposta da equipe",
      "aguardando voce",
      "buscar chamado",
      "filtrar chamados",
      "email do chamado",
      "anexar arquivo",
      "baixar anexo",
      "historico",
      "quem ve o chamado",
    ],
    sections: [
      {
        title: "A lista de chamados",
        blocks: [
          {
            kind: "p",
            text: 'Clique em "Chamados" no menu do Console. No celular, "Chamados" é uma das abas.',
          },
          {
            kind: "list",
            items: [
              'Por padrão, o seletor de situação fica em "Em aberto": "Aguardando atendimento", "Em atendimento" e "Aguardando você". Os com atividade mais recente vêm primeiro.',
              'Para ver outros, troque o seletor de situação, ao lado da busca, por exemplo para "Resolvidos", "Encerrados" ou "Todas as situações".',
              'Para achar um chamado, digite no campo "Buscar por assunto".',
              'Cada linha mostra o assunto, o tipo, quem abriu, o produto ou projeto, a situação, a prioridade e quando foi atualizado. No celular, a prioridade e a data ficam na página do chamado. Quando o contrato da empresa tem prazos publicados, a situação vem com "Resposta até…", "Meta até…" ou "Prazo pausado".',
              'No rodapé, em "Por página", escolha ver 10, 25, 50 ou 100 chamados.',
            ],
          },
          {
            kind: "p",
            text: 'Na [Visão geral](/painel), o card "Chamados em andamento" mostra quantos estão abertos e quantos esperam por você. O item "Chamados esperando sua resposta", em "Precisa de atenção", leva direto ao filtro "Aguardando você".',
          },
        ],
      },
      {
        title: "A página do chamado",
        blocks: [
          {
            kind: "pairs",
            items: [
              { term: "Conversa", text: 'As mensagens e os arquivos em ordem. As mensagens da Anuntech têm o selo "Equipe".' },
              {
                term: "Detalhes",
                text: 'Situação, prioridade e responsável, mais empresa, tipo (com o impacto, quando é erro), produto ou projeto, quem abriu, quando abriu e a última atividade. O responsável é a pessoa da equipe que cuida do chamado, ou "Ainda não atribuído".',
              },
              {
                term: "Prazos",
                text: "Aparece quando o contrato da empresa tem prazos publicados: a primeira resposta e a meta de solução. [Como contamos o tempo](/ajuda/prazos-de-atendimento).",
              },
              {
                term: "Estimativa da melhoria",
                text: "Aparece quando a equipe estima as horas de uma melhoria. [Melhorias com estimativa de horas](/ajuda/estimativas-de-melhoria).",
              },
              { term: "Anexos", text: "Todos os arquivos enviados no chamado, para baixar." },
            ],
          },
        ],
      },
      {
        title: "Responder",
        blocks: [
          {
            kind: "steps",
            items: [
              "Abra o chamado.",
              'Escreva na caixa "Escreva sua resposta…", no fim da conversa.',
              'Se quiser, clique em "Anexar" e escolha os arquivos. Dá para mandar só um arquivo, sem texto.',
              'Clique em "Enviar resposta", ou use Ctrl+Enter (Cmd+Enter no Mac).',
              'Aparece "Resposta enviada." (ou "Anexo enviado.", quando foi só arquivo) e a caixa fica limpa.',
            ],
          },
          {
            kind: "list",
            items: [
              "Cada resposta tem até 10.000 caracteres.",
              "Cada envio aceita até 5 arquivos e 20 MB no total, e o chamado inteiro, até 20 anexos.",
              'Responder a um chamado "Aguardando você" ou "Resolvido" devolve o chamado para a equipe, em "Aguardando atendimento". Nas outras situações, ela não muda.',
              'A caixa de resposta não tem o botão "Falar". Para ditar, use o formulário de abrir chamado ou o assistente.',
            ],
          },
          {
            kind: "note",
            tone: "attention",
            text: 'Um chamado "Encerrado" não tem caixa de resposta e não aceita anexos. Para continuar o assunto, clique em "Abrir novo chamado" e, se ajudar, cite o chamado anterior.',
          },
        ],
      },
      {
        title: "Quando a equipe precisa de você",
        blocks: [
          {
            kind: "p",
            text: 'Se a equipe precisa de uma informação, um acesso ou um teste, o chamado fica "Aguardando você" e a faixa "A equipe precisa de você para continuar", no topo da conversa, mostra o que falta. Responda com o que foi pedido. Se o contrato prevê, o prazo da Anuntech fica pausado até você responder.',
          },
          {
            kind: "list",
            items: [
              'Quem abriu recebe o e-mail "A equipe precisa de você", com o que falta e, quando o contrato prevê, até quando responder.',
              'Enquanto o chamado espera por você, chega o e-mail "Lembrete: a equipe ainda precisa de você", com o mesmo pedido. O Console manda um sozinho na metade do prazo que o seu contrato dá para responder (ou alguns dias úteis depois, quando o contrato não tem esse prazo), e a equipe pode mandar outro. Nunca vai mais de um lembrete por dia.',
              "Sem retorno, a equipe pode marcar o chamado como resolvido. Se ainda precisar, responda no próprio chamado: ele volta para a equipe.",
            ],
          },
        ],
      },
      {
        title: "Avisos por e-mail",
        blocks: [
          {
            kind: "p",
            text: 'Quem abriu o chamado recebe por e-mail cada ação da equipe: respostas, anexos, mudanças de situação, de prioridade e de responsável, e lembretes. O e-mail diz o que aconteceu e traz o link "Acompanhe e responda no Console". A conversa fica só no Console.',
          },
          {
            kind: "list",
            items: [
              'O recibo "Chamado aberto" vai sempre para quem abriu e não pode ser desligado.',
              "A resposta de um colega da sua empresa não gera e-mail para quem abriu.",
              "Para avisar mais pessoas, por e-mail ou WhatsApp, um Administrador cadastra os contatos de Chamados em [Notificações](/ajuda/notificacoes). Esse envio começa desligado.",
            ],
          },
        ],
      },
      {
        title: "Quem vê os chamados da empresa",
        blocks: [
          {
            kind: "p",
            text: "Todos os Administradores e Membros da empresa veem os chamados dela, e a equipe da Anuntech vê todos. Não existe chamado privado.",
          },
          {
            kind: "p",
            text: 'A exceção é o Membro que um Administrador limitou a alguns produtos, serviços e projetos ("Só o que eu escolher"). Ele vê os chamados sem produto, os que ele mesmo abriu e os dos itens escolhidos para ele. [Escolher o que cada Membro vê](/ajuda/o-que-cada-membro-ve).',
          },
        ],
      },
    ],
    faq: [
      {
        q: "O e-mail traz a resposta da equipe?",
        a: 'Não. O e-mail diz o que aconteceu, por exemplo "Nova resposta no chamado", e traz o link "Acompanhe e responda no Console". A exceção é "A equipe precisa de você", que traz o que falta e, quando o contrato prevê, até quando responder.',
      },
      {
        q: "O chamado foi resolvido, mas o problema voltou. O que faço?",
        a: 'Se ele está "Resolvido", responda no próprio chamado: ele volta para "Aguardando atendimento". Se está "Encerrado", a conversa fica só para consulta; clique em "Abrir novo chamado" e, se ajudar, cite o chamado anterior. Só a equipe reabre um chamado encerrado.',
      },
      {
        q: "Sou Membro e não encontro um chamado que um colega abriu. Por quê?",
        a: 'Provavelmente o Administrador limitou o que você vê a alguns produtos, serviços ou projetos, e esse chamado é sobre outro item. Você continua vendo os chamados sem produto e os que você abriu. Peça ao Administrador para incluir o item em "O que esta pessoa vê", na página Membros.',
      },
      {
        q: 'Por que aparece "Equipe Anuntech" em "Aberto por"?',
        a: "A equipe registrou um pedido que chegou por WhatsApp, telefone ou outro canal. Em Detalhes aparece o nome de quem registrou, com \"Equipe Anuntech\" embaixo, e na lista aparece só o nome. Ele funciona como qualquer outro chamado: acompanhe e responda pelo Console. Os e-mails dele vão só para os contatos de Chamados da empresa.",
      },
      {
        q: "Como baixo um anexo?",
        a: 'Clique no arquivo na conversa ou no quadro "Anexos". Por segurança, o anexo não abre no navegador: ele é baixado, e você abre o arquivo no seu aparelho. As imagens chegam em WebP, o formato em que foram guardadas.',
      },
      {
        q: "Posso pedir ao assistente para ver ou responder um chamado?",
        a: 'Pode. Pergunte, por exemplo, "Quais chamados estão esperando por mim?". O assistente lê as últimas mensagens de um chamado e responde em seu nome depois de confirmar o texto com você. Ele vê só os chamados que você vê.',
      },
    ],
    actions: [
      { label: "Ir para Chamados", href: "/chamados" },
      { label: "Ver chamados esperando você", href: "/chamados?status=waiting_customer" },
    ],
    related: ["situacoes-do-chamado", "prazos-de-atendimento", "notificacoes", "o-que-cada-membro-ve"],
    updatedAt: "2026-10-14",
  },
  {
    slug: "situacoes-do-chamado",
    category: "chamados",
    title: "O que cada situação do chamado quer dizer",
    summary: "As cinco situações de um chamado, quem muda cada uma e o que você pode fazer em cada momento.",
    audience: "todos",
    keywords: [
      "situacao",
      "status",
      "aguardando atendimento",
      "em atendimento",
      "aguardando voce",
      "resolvido",
      "encerrado",
      "reabrir chamado",
      "chamado fechado",
      "prioridade",
      "critica",
      "alta",
      "etiqueta",
    ],
    sections: [
      {
        title: "As situações",
        blocks: [
          {
            kind: "pairs",
            items: [
              {
                term: "Aguardando atendimento",
                text: 'O chamado está na fila da equipe. É a situação de todo chamado novo e a de um chamado que você respondeu quando estava "Aguardando você" ou "Resolvido". Se lembrar de algo, escreva na conversa.',
              },
              { term: "Em atendimento", text: "Alguém da equipe está trabalhando nele. Você pode acrescentar informações na conversa." },
              {
                term: "Aguardando você",
                text: 'A equipe precisa de algo seu para continuar. O que falta aparece no topo da conversa. Responda e o chamado volta para "Aguardando atendimento".',
              },
              {
                term: "Resolvido",
                text: "A equipe considera o pedido resolvido. Se o problema continuar, responda no chamado: ele volta para a equipe.",
              },
              {
                term: "Encerrado",
                text: 'O atendimento acabou e a conversa fica só para consulta. Não dá para responder nem anexar. Para continuar o assunto, use "Abrir novo chamado".',
              },
            ],
          },
          {
            kind: "p",
            text: "Na lista e no topo do chamado, cada situação tem uma etiqueta com o nome e uma cor: azul para o que espera a equipe, âmbar para o que espera você, verde para o resolvido e cinza para o encerrado.",
          },
        ],
      },
      {
        title: "Quem muda a situação",
        blocks: [
          {
            kind: "p",
            text: 'A situação, a prioridade e o responsável são definidos pela equipe da Anuntech. A sua forma de mudar a situação é responder: a resposta, com texto ou só com um arquivo, leva um chamado "Aguardando você" ou "Resolvido" de volta para "Aguardando atendimento".',
          },
          {
            kind: "list",
            items: [
              'Quando a equipe põe o chamado em "Aguardando você", ela sempre escreve o que falta. Esse texto aparece no chamado e no e-mail.',
              'Um chamado "Resolvido" continua aceitando resposta até a equipe encerrar. O Console não encerra chamados sozinho.',
              "Só a equipe encerra um chamado e reabre um chamado encerrado.",
            ],
          },
        ],
      },
      {
        title: "Resolvido por falta de resposta",
        blocks: [
          {
            kind: "p",
            text: 'Se um chamado fica em "Aguardando você" sem retorno, a equipe pode marcá-lo como resolvido. Nesse caso entra na conversa a mensagem "Como não tivemos retorno, marcamos este chamado como resolvido. Se ainda precisar, é só responder aqui: o chamado volta para a equipe."',
          },
        ],
      },
      {
        title: "Prioridade",
        blocks: [
          {
            kind: "pairs",
            items: [
              {
                term: "Crítica",
                text: "Sistema parado, sem contorno. Etiqueta vermelha cheia. O Console só sugere Crítica nos contratos com níveis de prioridade.",
              },
              { term: "Alta", text: "Falha com contorno, ou que afeta muita gente. Etiqueta vermelha clara." },
              { term: "Normal", text: "Demais defeitos, dúvidas e ajustes. Aparece em texto discreto." },
            ],
          },
          {
            kind: "p",
            text: 'No topo do chamado, a prioridade só aparece quando é Alta ou Crítica. Em "Detalhes", ela aparece sempre. Quando a equipe muda a prioridade, quem abriu recebe um e-mail e os prazos do chamado são recalculados. [Prazos de atendimento](/ajuda/prazos-de-atendimento).',
          },
        ],
      },
      {
        title: "Os e-mails de cada mudança",
        blocks: [
          {
            kind: "p",
            text: "Cada ação da equipe gera um e-mail com o que aconteceu e o assunto do chamado no título, por exemplo:",
          },
          {
            kind: "list",
            items: [
              '"A equipe precisa de você", com o que falta.',
              '"Situação alterada: Em atendimento".',
              '"Chamado resolvido" ou "Chamado encerrado".',
              '"Chamado reaberto: Aguardando atendimento", quando a equipe reabre um chamado encerrado.',
              '"Prioridade: Alta" ou "Responsável:" com o nome da pessoa da equipe.',
              '"Nova resposta no chamado" ou "Novo anexo no chamado".',
            ],
          },
          {
            kind: "p",
            text: "Eles vão para quem abriu o chamado e, quando um Administrador ligou esse envio, para os contatos de Chamados cadastrados em [Notificações](/ajuda/notificacoes).",
          },
        ],
      },
    ],
    faq: [
      {
        q: 'O que quer dizer "Aguardando você"?',
        a: 'A equipe precisa de uma informação, um acesso ou um teste seu para continuar. O que falta aparece no topo do chamado, na faixa "A equipe precisa de você para continuar", e no e-mail. Quando você responde, mesmo que só com um anexo, o chamado volta para "Aguardando atendimento". Se o seu contrato prevê, o prazo da Anuntech fica pausado enquanto o chamado espera por você.',
      },
      {
        q: "Posso reabrir um chamado encerrado?",
        a: 'Não. Só a equipe reabre. Clique em "Abrir novo chamado", no aviso "Este chamado foi encerrado.", e cite o chamado anterior se ajudar.',
      },
      {
        q: "Posso marcar o meu chamado como resolvido ou encerrar?",
        a: "Essa opção é só da equipe. Se o pedido já foi atendido, avise na conversa.",
      },
      {
        q: "Quanto tempo um chamado fica Resolvido antes de ser encerrado?",
        a: 'Não há um tempo fixo: o Console não encerra chamados sozinho, a equipe encerra. Enquanto estiver "Resolvido", você pode responder e o chamado volta para a equipe.',
      },
      {
        q: 'Responder a um chamado "Em atendimento" muda alguma coisa?',
        a: "A situação continua a mesma. A resposta fica registrada na conversa para a equipe.",
      },
      {
        q: "Por que a prioridade do meu chamado mudou?",
        a: "A prioridade é decisão da equipe. Ela confirma ou muda a prioridade sugerida ao ler o chamado. Quem abriu recebe um e-mail com a nova prioridade, e os prazos são recalculados.",
      },
    ],
    actions: [{ label: "Ir para Chamados", href: "/chamados" }],
    related: ["acompanhar-um-chamado", "prazos-de-atendimento", "abrir-um-chamado"],
    updatedAt: "2026-10-14",
  },
  {
    slug: "prazos-de-atendimento",
    category: "chamados",
    title: "Prazos de atendimento e como contamos o tempo",
    summary: "Quando a equipe responde, onde ver o prazo de cada chamado e como dias úteis, prioridade e esperas mudam a contagem.",
    audience: "todos",
    keywords: [
      "prazo",
      "sla",
      "tempo de resposta",
      "quando respondem",
      "horario de atendimento",
      "dias uteis",
      "horas uteis",
      "feriado",
      "fim de semana",
      "meta de solucao",
      "primeira resposta",
      "prazo pausado",
      "demora",
      "atraso",
    ],
    sections: [
      {
        title: "De onde vêm os prazos",
        blocks: [
          {
            kind: "p",
            text: 'Os prazos de cada empresa vêm do contrato dela e ficam nas condições de atendimento que a Anuntech publica no Console. Por isso esta página não traz números: os seus estão em [Como trabalhamos](/como-trabalhamos), na parte "Seus prazos". Em cada chamado, o link "Como contamos o tempo", no quadro "Prazos", leva até lá.',
          },
          {
            kind: "p",
            text: "Enquanto a empresa não tem condições publicadas, nenhum prazo aparece. Vale o horário de atendimento: dias úteis, das 9h às 18h, horário de Brasília.",
          },
        ],
      },
      {
        title: "Como o tempo conta",
        blocks: [
          {
            kind: "list",
            items: [
              "Horário: das 9h às 18h, horário de Brasília. Um dia útil tem 9 horas úteis. As datas e horas do Console seguem o mesmo horário.",
              "Dias úteis: segunda a sexta, menos os feriados nacionais, a Sexta-feira Santa e os feriados da cidade da sede da Anuntech.",
              'Um chamado aberto à noite, no fim de semana ou num feriado começa a contar às 9h do próximo dia útil. Nesse caso, o quadro "O que esperar" avisa quando a equipe volta.',
              "Um prazo que não termina até as 18h continua às 9h do próximo dia útil.",
            ],
          },
          {
            kind: "p",
            text: "Contamos assim porque dias úteis são os dias em que a equipe que conhece o seu sistema está trabalhando.",
          },
        ],
      },
      {
        title: "Compromisso e meta",
        blocks: [
          {
            kind: "pairs",
            items: [
              {
                term: "Primeira resposta",
                text: "É um compromisso da Anuntech. Conta quando a equipe escreve no chamado, pede algo a você ou marca o chamado como resolvido ou encerrado.",
              },
              {
                term: "Meta de solução",
                text: "Quando o contrato prevê, é uma meta, porque depende do problema, dos acessos e de respostas suas e de outros fornecedores.",
              },
            ],
          },
        ],
      },
      {
        title: "O que muda o prazo de um chamado",
        blocks: [
          {
            kind: "pairs",
            items: [
              {
                term: "Prioridade",
                text: 'Nos contratos com níveis, cada prioridade tem o seu prazo. Nos contratos sem níveis, o prazo é o mesmo para todos os chamados, e alguns preveem uma primeira resposta mais rápida quando você marca "Parou tudo e não dá para contornar".',
              },
              {
                term: "Mudança de prioridade",
                text: "Nos contratos com níveis, quando a equipe muda a prioridade, os prazos são recalculados a partir da abertura, com a regra da nova prioridade.",
              },
              {
                term: "Tipo",
                text: '"Ajuste ou algo novo" tem só o prazo da primeira resposta, porque o pedido é avaliado antes. "App ou projeto novo" fica fora dos prazos de atendimento.',
              },
              {
                term: "Espera por você",
                text: 'Se o contrato prevê, o prazo fica pausado enquanto o chamado está em "Aguardando você". Quando você responde, ou a equipe retoma o chamado, o tempo de espera em horas úteis é somado aos prazos.',
              },
              {
                term: "Produto",
                text: 'O chamado usa as condições do produto escolhido em "Sobre o quê" ou, se ele não tiver condições próprias, as da empresa.',
              },
              {
                term: "Dia da abertura",
                text: "As condições em vigor no dia ficam gravadas no chamado. Uma mudança depois não altera um prazo já informado, e um chamado aberto antes de a empresa ter condições não ganha prazo.",
              },
            ],
          },
        ],
      },
      {
        title: "Onde ver o prazo",
        blocks: [
          {
            kind: "pairs",
            items: [
              { term: "Ao abrir", text: 'O quadro "O que esperar" mostra a primeira resposta com data e hora e, quando houver, a meta.' },
              { term: "No recibo por e-mail", text: 'O e-mail "Chamado aberto" diz até quando vem a primeira resposta.' },
              {
                term: "Na lista",
                text: 'Abaixo da situação: "Resposta até…" antes da primeira resposta, "Meta até…" depois dela, ou "Prazo pausado".',
              },
              {
                term: "No chamado",
                text: 'O quadro "Prazos" mostra "Primeira resposta", com a data limite ou "Respondido em" e o tempo que levou em horas ou dias úteis, e "Meta de solução". Com o prazo pausado, mostra desde quando. A meta some quando o chamado é resolvido ou encerrado.',
              },
              {
                term: "Em Como trabalhamos",
                text: '"Seus prazos" lista os prazos do seu contrato e "O que o seu contrato pede" mostra o que cabe à sua empresa.',
              },
            ],
          },
        ],
      },
    ],
    faq: [
      {
        q: "Quando a equipe responde?",
        a: 'Em dias úteis, das 9h às 18h, horário de Brasília. O prazo da primeira resposta e a meta de solução são os do contrato da sua empresa. Eles aparecem no quadro "O que esperar" ao abrir, no e-mail de confirmação, no quadro "Prazos" do chamado e em "Seus prazos", em Como trabalhamos.',
      },
      {
        q: "Por que o meu chamado não mostra prazo?",
        a: 'A sua empresa pode ainda não ter condições de atendimento publicadas no Console, ou o chamado foi aberto antes de elas existirem. O tipo "App ou projeto novo" fica fora dos prazos de atendimento, e "Ajuste ou algo novo" tem só o prazo da primeira resposta, sem meta. Na lista, o prazo também some quando o chamado está Resolvido ou Encerrado.',
      },
      {
        q: "O prazo conta no fim de semana?",
        a: "Não. Só contam dias úteis, das 9h às 18h. Um chamado aberto na sexta à noite começa a contar às 9h do próximo dia útil.",
      },
      {
        q: "Quais feriados não contam?",
        a: "Os nacionais (1º de janeiro, Tiradentes, Dia do Trabalho, Independência, Nossa Senhora Aparecida, Finados, Proclamação da República, Dia Nacional de Zumbi e da Consciência Negra e Natal), a Sexta-feira Santa e os feriados da cidade da sede da Anuntech.",
      },
      {
        q: "O que conta como primeira resposta?",
        a: 'Uma mensagem da equipe no chamado, ou a equipe pedir algo a você ("Aguardando você"), marcar o chamado como resolvido ou encerrar. Depois disso, o quadro "Prazos" mostra "Respondido em", com o tempo em horas úteis.',
      },
      {
        q: "A prioridade mudou. O prazo também muda?",
        a: "Nos contratos com níveis de prioridade, muda: os prazos são recalculados a partir da abertura do chamado, com a regra da nova prioridade. Nos contratos sem níveis, o prazo é o mesmo para todas as prioridades.",
      },
      {
        q: "A data da primeira resposta passou. O que faço?",
        a: 'Escreva no próprio chamado: a mensagem fica registrada e aparece para a equipe. Se o caso parou tudo, diga isso na mensagem. Para falar com uma pessoa, use "Conversar com a equipe", no menu da conta.',
      },
    ],
    actions: [
      { label: "Ver Como trabalhamos", href: "/como-trabalhamos" },
      { label: "Ir para Chamados", href: "/chamados" },
    ],
    related: ["como-trabalhamos", "situacoes-do-chamado", "tipos-de-chamado", "banco-de-horas"],
    updatedAt: "2026-10-14",
  },
  {
    slug: "estimativas-de-melhoria",
    category: "chamados",
    title: "Melhorias com estimativa de horas",
    summary: "Como a equipe estima uma melhoria em horas do banco, quem aprova e o que acontece depois de aprovar ou recusar.",
    audience: "todos",
    keywords: [
      "estimativa",
      "aprovar estimativa",
      "recusar estimativa",
      "melhoria",
      "banco de horas",
      "horas",
      "ajuste",
      "aprovacao",
      "consumo de horas",
      "desenvolvimento",
      "orcamento",
      "pedido de melhoria",
    ],
    sections: [
      {
        title: "Quando aparece uma estimativa",
        blocks: [
          {
            kind: "p",
            text: 'Nos contratos de suporte com banco de horas, uma melhoria pequena sai do banco depois que um Administrador da empresa aprova a estimativa da equipe. Tudo começa num chamado do tipo "Ajuste ou algo novo".',
          },
          {
            kind: "p",
            text: "A equipe avalia o pedido e segue um destes caminhos:",
          },
          {
            kind: "list",
            items: [
              "Um ajuste incluído no seu suporte.",
              'Uma melhoria até o limite do contrato: a equipe envia uma estimativa em horas, que aparece no chamado no quadro "Estimativa da melhoria".',
              "Uma melhoria acima do limite: vira orçamento, que chega em Orçamentos para um Administrador aceitar ou recusar. [Ler e responder a um orçamento](/ajuda/responder-um-orcamento).",
            ],
          },
          {
            kind: "p",
            text: "Nos contratos que não incluem desenvolvimento, a equipe avalia o pedido e, se fizer sentido, envia um orçamento.",
          },
        ],
      },
      {
        title: "Quem aprova",
        blocks: [
          {
            kind: "p",
            text: 'Só um Administrador da empresa aprova ou recusa. Um Membro vê a estimativa no chamado com o aviso "Um Administrador da sua empresa aprova ou recusa a estimativa." e pode pedir a um Administrador que responda.',
          },
        ],
      },
      {
        title: "Aprovar ou recusar",
        blocks: [
          {
            kind: "steps",
            items: [
              'Na [Visão geral](/painel), em "Precisa de atenção", clique em "Estimativas de melhoria para aprovar". O item leva à lista de Chamados.',
              "Abra o chamado da melhoria.",
              'Leia o quadro "Estimativa da melhoria", ao lado da conversa (no celular, abaixo dela). Ele diz quantas horas a melhoria vai usar do seu banco.',
              'Clique em "Aprovar" ou "Recusar".',
              'Aprovada, aparece "Estimativa aprovada. A equipe pode começar." Recusada, aparece "Estimativa recusada. A equipe vai falar com você no chamado."',
            ],
          },
          {
            kind: "note",
            tone: "attention",
            text: "Depois de aprovar ou recusar, o quadro não mostra mais os botões. Aprovar libera o trabalho e o uso das horas, por isso leia o pedido e a estimativa antes. Para rever uma decisão, escreva no chamado.",
          },
        ],
      },
      {
        title: "O que acontece depois",
        blocks: [
          {
            kind: "pairs",
            items: [
              {
                term: "Aprovada",
                text: 'A equipe começa e registra as horas trabalhadas, que saem do banco de horas do mês em que o trabalho foi feito. O consumo aparece no card "Banco de horas" da Visão geral.',
              },
              { term: "Recusada", text: "A melhoria não usa o banco de horas, e a equipe combina com você no chamado o que fazer." },
              { term: "Sem resposta", text: "Enquanto a estimativa espera, a equipe não lança horas de melhoria no banco para esse chamado." },
            ],
          },
        ],
      },
      {
        title: "Regras que valem",
        blocks: [
          {
            kind: "list",
            items: [
              "O limite de uma melhoria pelo banco é o do seu contrato.",
              "Uma melhoria só usa o banco com a estimativa aprovada. E, fora a correção de um defeito crítico, nenhuma hora passa do banco do mês sem a aprovação de um Administrador. [Horas além do banco](/ajuda/horas-alem-do-banco).",
              'A decisão vale para a estimativa que você viu. Se ela mudou ou já foi respondida por outra pessoa, aparece "A estimativa mudou ou já foi respondida. Recarregue o chamado."',
              'Quando o contrato prevê, cada melhoria tem garantia por um período depois do aceite, sem usar o banco. O período está em "Seus prazos", em [Como trabalhamos](/como-trabalhamos).',
              'O e-mail "Estimativa para aprovar" vai para os contatos de Chamados cadastrados em [Notificações](/ajuda/notificacoes), e não para quem abriu o chamado. Por isso vale o Administrador conferir a Visão geral.',
            ],
          },
        ],
      },
    ],
    faq: [
      {
        q: "A equipe mandou uma estimativa de horas. Quem aprova e o que acontece?",
        a: 'Só um Administrador da empresa aprova, no quadro "Estimativa da melhoria" do chamado, com "Aprovar" ou "Recusar". Na Visão geral do Administrador aparece "Estimativas de melhoria para aprovar". Aprovada, a equipe começa e as horas trabalhadas saem do banco de horas. Recusada, a melhoria não usa o banco e a equipe combina com você no chamado.',
      },
      {
        q: "Sou Membro. Posso aprovar uma estimativa?",
        a: "Não. Só um Administrador da empresa aprova ou recusa. Você vê a estimativa no chamado e pode avisar um Administrador.",
      },
      {
        q: "Recusei por engano. E agora?",
        a: "Escreva no chamado. A equipe pode enviar uma nova estimativa, que volta a aparecer para aprovação.",
      },
      {
        q: 'Cliquei em "Aprovar" e apareceu "A estimativa mudou ou já foi respondida". Por quê?',
        a: "Outra pessoa da empresa já respondeu, ou a equipe mudou a estimativa enquanto a página estava aberta. Recarregue o chamado e leia o quadro de novo.",
      },
      {
        q: "E se a melhoria passar do limite do contrato?",
        a: "Ela não usa o banco. A equipe prepara um orçamento, que chega em Orçamentos para um Administrador aceitar ou recusar.",
      },
      {
        q: "Onde vejo quantas horas ainda tenho?",
        a: 'No card "Banco de horas", na Visão geral. [Banco de horas](/ajuda/banco-de-horas).',
      },
    ],
    actions: [
      { label: "Ir para a Visão geral", href: "/painel" },
      { label: "Ir para Chamados", href: "/chamados" },
    ],
    related: ["banco-de-horas", "horas-alem-do-banco", "tipos-de-chamado", "responder-um-orcamento"],
    updatedAt: "2026-10-14",
  },
];
