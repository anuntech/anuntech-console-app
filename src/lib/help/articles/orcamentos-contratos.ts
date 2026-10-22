import type { HelpArticle } from "../help-model";

export const orcamentosContratosArticles: HelpArticle[] = [
  {
    slug: "responder-um-orcamento",
    category: "orcamentos",
    title: "Ler e responder a um orçamento",
    summary: "Como ler a proposta da Anuntech no Console, aceitar ou recusar, e o que fica registrado na sua resposta.",
    audience: "administrador",
    video: "orcamento",
    keywords: [
      "orçamento",
      "orcamento",
      "proposta",
      "proposta comercial",
      "aceitar orçamento",
      "aprovar orçamento",
      "recusar orçamento",
      "cotação",
      "cotacao",
      "validade",
      "expirado",
      "entrada",
      "saldo",
      "valor total",
      "pdf do orçamento",
    ],
    sections: [
      {
        title: "Quem responde",
        blocks: [
          {
            kind: "p",
            text: "O orçamento é a proposta da Anuntech para um trabalho novo: escopo, horas, valor, entrada, saldo e validade. Só um Administrador da empresa vê os orçamentos e pode aceitar ou recusar uma proposta, porque a resposta compromete a empresa.",
          },
          {
            kind: "p",
            text: "O Membro não vê Orçamentos no menu e não recebe o e-mail da proposta. Se abrir o link de um orçamento, o Console mostra “Não encontramos esta página”. Nesse caso, peça a um Administrador da sua empresa que responda, ou que mude a sua permissão em [Membros](/configuracoes/membros). Veja [Membro ou Administrador](/ajuda/membro-ou-administrador).",
          },
        ],
      },
      {
        title: "Onde encontrar o orçamento",
        blocks: [
          {
            kind: "list",
            items: [
              "No e-mail “Orçamento 2026-007: título da proposta”, com o valor total, a validade (quando houver) e o link para responder pelo Console. O aviso vai para o e-mail de acesso de cada Administrador da empresa.",
              "Na [Visão geral](/painel), no quadro “Precisa de atenção”, em “Orçamentos para você responder”. O atalho abre a lista com os orçamentos que aguardam resposta.",
              "Na página [Orçamentos](/orcamentos), no menu do Console. No celular, ela fica em “Mais”.",
            ],
          },
          {
            kind: "p",
            text: "A lista mostra cada orçamento com o título, o número (ano e sequência, como 2026-007), as horas estimadas e a “Situação”. Em telas maiores, aparecem também o “Valor”, a “Validade” e quando foi “Atualizado”. Use a busca “Buscar por número ou título” e o filtro de situação: “Aguardando resposta”, “Aceitos”, “Recusados” ou “Expirados”.",
          },
          {
            kind: "p",
            text: "No menu de cada linha, “Abrir e responder” abre a proposta e “Baixar PDF” baixa o documento. Quando não há mais o que responder, a primeira opção se chama “Abrir orçamento”.",
          },
        ],
      },
      {
        title: "Como ler a proposta",
        blocks: [
          {
            kind: "p",
            text: "A proposta no Console tem o mesmo conteúdo do PDF e é a versão congelada no envio. Para mudar qualquer coisa, a Anuntech precisa mandar uma nova versão. No topo ficam o título, o número, a sua empresa e o resumo do trabalho.",
          },
          {
            kind: "pairs",
            items: [
              { term: "Esforço estimado", text: "As horas previstas, de um mínimo a um máximo (por exemplo, de 48 a 60 horas)." },
              { term: "Taxa/hora", text: "O valor de cada hora de trabalho nesta proposta." },
              {
                term: "Proposta financeira",
                text: "O “Valor total”, a “Entrada” e o “Saldo”, com o percentual de cada um. Quando há desconto negociado, a linha logo abaixo mostra o valor das horas e o desconto.",
              },
              { term: "Stack", text: "As tecnologias previstas, quando a proposta lista alguma." },
              { term: "Resumo por fase", text: "Cada fase com o número de tarefas e as horas estimadas, e o total no fim." },
              {
                term: "Tarefas detalhadas",
                text: "Cada fase com a descrição, as horas e, quando a equipe já estimou, as semanas. Abaixo vêm as tarefas, cada uma com o código (P1-01, P1-02…), o título e a descrição.",
              },
              {
                term: "Total estimado do projeto",
                text: "As horas, a conta (horas máximas × taxa) e o valor. No rodapé ficam a data da proposta, a validade e as observações.",
              },
            ],
          },
          {
            kind: "p",
            text: "Ao lado da proposta (em telas menores, abaixo dela) ficam os quadros “Resposta” e “Versões”, quando já houve um envio anterior. Em “Resposta”, enquanto o orçamento aguarda, aparece por quanto tempo ele ainda vale, e “Ver detalhes” mostra a data de envio, o hash SHA-256 e, depois da resposta, o e-mail e o IP de quem respondeu. A data de validade fica no rodapé da proposta.",
          },
        ],
      },
      {
        title: "Como o valor é calculado",
        blocks: [
          {
            kind: "p",
            text: "O valor das horas é o máximo de horas da estimativa vezes a taxa por hora. Se houve desconto negociado, ele sai desse valor, e o resultado é o Valor total. A entrada é o percentual indicado na proposta sobre o Valor total, e o saldo é o restante.",
          },
          {
            kind: "p",
            text: "Exemplo: uma estimativa de 48 a 60 horas a R$ 40,00 por hora dá R$ 2.400,00. Com 50% de entrada, são R$ 1.200,00 de entrada e R$ 1.200,00 de saldo.",
          },
        ],
      },
      {
        title: "Aceitar o orçamento",
        blocks: [
          {
            kind: "steps",
            items: [
              "Leia a proposta inteira. Para guardar uma cópia, clique em “Baixar PDF”.",
              "No quadro “Resposta”, marque “Li a proposta e aceito o escopo, as condições e o valor de R$ …, como [seu nome] por [empresa].”",
              "Clique em “Aceitar orçamento”. O botão só libera depois que a caixa está marcada.",
              "Aparece “Orçamento aceito. A Anuntech já foi avisada e entra em contato para os próximos passos.” O quadro “Resposta” passa a mostrar quem aceitou e quando, e logo abaixo aparece o quadro “Próximos passos”.",
            ],
          },
          { kind: "p", text: "O que vem depois está em [O que acontece depois do aceite](/ajuda/depois-do-aceite)." },
        ],
      },
      {
        title: "Recusar o orçamento",
        blocks: [
          {
            kind: "steps",
            items: [
              "No quadro “Resposta”, clique em “Recusar”.",
              "Na janela “Recusar orçamento”, escreva em “Observação” o que pesou na decisão. O campo é opcional e aceita até 1.000 caracteres.",
              "Clique em “Recusar orçamento”. Aparece “Resposta registrada. Obrigado por avisar.”",
            ],
          },
          {
            kind: "p",
            text: "A situação vira “Recusado”, e a Anuntech recebe a resposta com a sua observação. Se a equipe preparar outra proposta, ela chega como outro orçamento, com número novo.",
          },
        ],
      },
      {
        title: "O que fica registrado",
        blocks: [
          {
            kind: "p",
            text: "No aceite e na recusa ficam registrados o seu nome (o de [Meu perfil](/conta), ou o e-mail se não houver nome), o seu e-mail, a data e a hora, o IP e a versão da proposta. Na recusa, a observação também fica. O quadro “Resposta” mostra esses dados, e o PDF baixado depois da resposta traz o mesmo registro na seção “Registro”.",
          },
          {
            kind: "p",
            text: "Se a sua empresa respondeu por outro canal, como e-mail ou WhatsApp, a equipe da Anuntech pode registrar a resposta no Console. Nesse caso, o quadro “Resposta” e o PDF dizem “registrado pela Anuntech a pedido do cliente”, com o nome de quem registrou.",
          },
          {
            kind: "p",
            text: "O hash SHA-256 é um código que identifica exatamente o texto da proposta. Ele fica em “Ver detalhes”, no quadro “Resposta”, e no PDF. Antes de registrar a resposta, o Console confere o hash. Se ele não bater com o da proposta enviada, aparece “O conteúdo não confere com o registro. Peça um novo envio.”",
          },
          {
            kind: "note",
            tone: "attention",
            text: "Cada envio aceita uma resposta só, e o Console não tem como desfazer um aceite ou uma recusa. Se respondeu por engano, abra um [chamado](/chamados/novo) e explique o que aconteceu.",
          },
        ],
      },
      {
        title: "Validade",
        blocks: [
          {
            kind: "list",
            items: [
              "A data de validade fica no rodapé da proposta. Enquanto o orçamento aguarda resposta, o quadro “Resposta” diz quanto falta: “Válido por N dias”, “Válido até amanhã” ou “Válido até hoje”.",
              "O orçamento vale até o fim do dia indicado. No dia seguinte ele fica “Expirado” e não aceita mais resposta.",
              "Quando a equipe não define uma data, a proposta não mostra validade e o orçamento não expira.",
              "Quando faltam 3 dias ou menos para a validade e o orçamento ainda aguarda resposta, os Administradores recebem um lembrete por e-mail, uma vez por versão.",
            ],
          },
          {
            kind: "p",
            text: "Se a validade passou, o orçamento aparece como “Expirado” e o quadro “Resposta” diz “Peça à Anuntech uma nova versão.” Peça uma nova versão no chamado em que você pediu o orçamento, ou abra um chamado. A nova versão chega por e-mail, com o mesmo número e uma validade nova.",
          },
        ],
      },
      {
        title: "Novas versões",
        blocks: [
          {
            kind: "p",
            text: "Para ajustar uma proposta que ainda aguarda resposta, a equipe volta o orçamento para rascunho, e ele sai da sua lista até o novo envio. Quando ele volta, você recebe outro e-mail, com “Esta é uma nova versão (N); a anterior deixou de valer.”",
          },
          {
            kind: "p",
            text: "O quadro “Versões” lista cada envio, marca o atual e baixa o PDF de cada um. As versões anteriores ficam para consulta, sem efeito. Se a equipe cancelar um orçamento, ele deixa de aparecer para você.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Quem da minha empresa pode responder a um orçamento?",
        a: "Só quem é Administrador da empresa no Console. Qualquer Administrador pode aceitar ou recusar, e vale a primeira resposta registrada. Para dar esse papel a outra pessoa, um Administrador abre Membros e usa “Editar permissão”.",
      },
      {
        q: "Não recebi o e-mail do orçamento. Onde encontro?",
        a: "O aviso vai para o e-mail de acesso de cada Administrador, e não para os contatos de Notificações. Confira a caixa de spam. No Console, abra a Visão geral e veja “Orçamentos para você responder”, em “Precisa de atenção”, ou abra a página Orçamentos.",
      },
      {
        q: "Quero mudar algo na proposta antes de responder.",
        a: "Não aceite nem recuse ainda. Responda no chamado em que você pediu o orçamento, ou abra um chamado, dizendo o que precisa mudar. Se a equipe ajustar, você recebe uma nova versão, que substitui a anterior.",
      },
      {
        q: "O orçamento expirou. E agora?",
        a: "Depois da validade, o orçamento não aceita mais resposta. Peça uma nova versão por chamado. Ela chega por e-mail, com o mesmo número e uma validade nova.",
      },
      {
        q: "Aceitei, ou recusei, por engano. Dá para desfazer?",
        a: "Não pelo Console, porque cada envio aceita uma resposta só. Abra um chamado e explique. Se for preciso, a equipe prepara uma nova proposta.",
      },
      {
        q: "O que é o hash SHA-256?",
        a: "É um código calculado a partir do texto da proposta. Se uma vírgula mudar, o código muda. Ele prova qual versão exata você aceitou ou recusou. Use “Copiar hash”, em “Ver detalhes” no quadro Resposta, para guardar.",
      },
      {
        q: "O orçamento sumiu da minha lista. O que houve?",
        a: "A equipe voltou o orçamento para rascunho para ajustar, ou o cancelou. Rascunhos e cancelados não aparecem para o cliente. Depois do ajuste, você recebe outro e-mail com a nova versão.",
      },
      {
        q: "O assistente pode responder ao orçamento por mim?",
        a: "O assistente lê os orçamentos que você pode ver e responde perguntas sobre eles, mas não tem uma ação para aceitar ou recusar. A resposta é sua, no quadro “Resposta” do orçamento.",
      },
    ],
    actions: [{ label: "Ir para Orçamentos", href: "/orcamentos" }],
    related: ["depois-do-aceite", "pedir-um-orcamento", "membro-ou-administrador", "assinar-um-contrato"],
    updatedAt: "2026-10-14",
  },
  {
    slug: "pedir-um-orcamento",
    category: "orcamentos",
    title: "Pedir um orçamento",
    summary: "Como pedir à Anuntech uma proposta para um app, um sistema ou um projeto novo, e o que acontece até o orçamento chegar.",
    audience: "todos",
    keywords: [
      "pedir orçamento",
      "pedir orcamento",
      "solicitar orçamento",
      "proposta",
      "cotação",
      "cotacao",
      "app novo",
      "projeto novo",
      "sistema novo",
      "quanto custa",
      "preço",
      "preco",
      "contratar",
    ],
    sections: [
      {
        title: "Quando pedir um orçamento",
        blocks: [
          {
            kind: "p",
            text: "Peça um orçamento quando precisar de algo novo que ainda não faz parte do que a sua empresa tem com a Anuntech: um app, um sistema ou um projeto. O pedido abre uma conversa com a equipe, que entende o escopo antes de preparar a proposta.",
          },
          {
            kind: "p",
            text: "Para um ajuste no que você já usa (um texto, uma regra, uma tela ou uma função), abra um chamado do tipo “Ajuste ou algo novo”. A equipe avalia se entra no que você já tem ou se precisa de orçamento. Veja [Qual tipo de chamado escolher](/ajuda/tipos-de-chamado).",
          },
        ],
      },
      {
        title: "Quem pode pedir",
        blocks: [
          {
            kind: "p",
            text: "Qualquer pessoa da empresa com acesso ao Console pode pedir, Administrador ou Membro. A proposta, quando sair, chega só aos Administradores, que são quem aceita ou recusa.",
          },
          {
            kind: "pairs",
            items: [
              {
                term: "Administrador",
                text: "Use o botão “Pedir orçamento” na página [Orçamentos](/orcamentos), ou abra um chamado do tipo “App ou projeto novo”.",
              },
              {
                term: "Membro",
                text: "Abra um chamado em [Chamados](/chamados) e escolha “App ou projeto novo”. Quando não há projeto ativo, a página [Projetos](/projetos) também mostra o botão “Pedir orçamento”.",
              },
            ],
          },
        ],
      },
      {
        title: "Como pedir",
        blocks: [
          {
            kind: "steps",
            items: [
              "Clique em “Pedir orçamento”. Abre a tela “Pedir orçamento”, que diz “Conte o que você precisa. A equipe conversa com você e prepara um orçamento.”, com “App ou projeto novo” já escolhido em “O que você precisa?”.",
              "Em “Assunto”, resuma o pedido em uma linha.",
              "Em “Descrição”, conte o problema, quem vai usar e se há uma data importante.",
              "Se ajudar, anexe arquivos em “Anexos”: PDF, PNG, JPEG ou WebP, até 5 arquivos e 20 MB no total.",
              "Clique em “Enviar pedido”. Aparece “Chamado aberto.”, e o Console abre o chamado do seu pedido.",
            ],
          },
          {
            kind: "p",
            text: "Também dá para abrir um chamado comum e escolher “App ou projeto novo” em “O que você precisa?”. Nesse caso, a tela se chama “Novo chamado” e o botão, “Abrir chamado”. O pedido é o mesmo. O botão também se chama “Abrir chamado” quando o formulário abre como página inteira, pelo endereço direto.",
          },
          {
            kind: "note",
            tone: "attention",
            text: "Não escreva senhas nem dados reais dos seus clientes no pedido. Se a equipe precisar de um acesso, ela combina com você um jeito seguro.",
          },
        ],
      },
      {
        title: "O que acontece depois",
        blocks: [
          {
            kind: "list",
            items: [
              "O pedido vira um chamado do tipo “App ou projeto novo”, na página Chamados. A conversa com a equipe acontece ali.",
              "Esse tipo de chamado fica fora dos prazos de atendimento do suporte. Em “O que esperar”, o formulário diz: “A equipe marca uma conversa para entender o que você precisa e prepara um orçamento.”",
              "Quando a proposta fica pronta, a Anuntech envia o orçamento pelo Console. Cada Administrador da empresa recebe um e-mail, e o orçamento aparece em [Orçamentos](/orcamentos).",
              "Um Administrador lê a proposta e aceita ou recusa. Veja [Ler e responder a um orçamento](/ajuda/responder-um-orcamento).",
            ],
          },
          {
            kind: "p",
            text: "Se a sua empresa ainda não tem um Administrador no Console, a equipe pode liberar o acesso de Administrador para a pessoa que vai responder, junto com o envio do orçamento.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Sou Membro. Posso pedir um orçamento?",
        a: "Sim. Abra um chamado do tipo “App ou projeto novo”. Você acompanha a conversa no chamado, mas a proposta chega aos Administradores da empresa, que são quem responde.",
      },
      {
        q: "Em quanto tempo recebo a proposta?",
        a: "O pedido de orçamento não segue os prazos de atendimento do suporte, porque antes a equipe precisa entender o escopo. Ela marca uma conversa com você e depois prepara a proposta. Acompanhe tudo pelo chamado.",
      },
      {
        q: "Pedi por WhatsApp ou telefone. Preciso pedir de novo no Console?",
        a: "O que você pede por WhatsApp ou telefone, a equipe registra num chamado. Confira em Chamados se ele já aparece. Se não aparecer, faça o pedido pelo Console.",
      },
      {
        q: "Quero mudar algo num projeto que já está em andamento. É orçamento?",
        a: "Abra um chamado do tipo “Ajuste ou algo novo”. A equipe mostra o efeito no prazo e no valor, e a mudança só vale depois que um Administrador da sua empresa aprovar.",
      },
      {
        q: "Onde vejo o orçamento quando ele chegar?",
        a: "Os Administradores recebem o e-mail “Orçamento …” com o link. No Console, ele aparece em Orçamentos e na Visão geral, em “Precisa de atenção”.",
      },
      {
        q: "Qual a diferença entre “Pedir orçamento” e “Novo chamado”?",
        a: "“Pedir orçamento” abre o mesmo formulário de chamado com o tipo “App ou projeto novo” já escolhido. O pedido fica na lista de Chamados como qualquer outro.",
      },
    ],
    actions: [
      { label: "Pedir orçamento", href: "/chamados/novo?tipo=novo-projeto" },
      { label: "Ir para Chamados", href: "/chamados" },
    ],
    related: ["responder-um-orcamento", "tipos-de-chamado", "abrir-um-chamado", "membro-ou-administrador"],
    updatedAt: "2026-10-14",
  },
  {
    slug: "depois-do-aceite",
    category: "orcamentos",
    title: "O que acontece depois do aceite",
    summary: "Do orçamento aceito à reunião de início: contrato, cobrança da entrada, acessos e projeto.",
    audience: "administrador",
    keywords: [
      "depois do aceite",
      "orçamento aceito",
      "orcamento aceito",
      "próximos passos",
      "proximos passos",
      "entrada",
      "saldo",
      "reunião de início",
      "reuniao de inicio",
      "kickoff",
      "quando começa",
      "quando comeca",
      "contrato",
    ],
    sections: [
      {
        title: "Logo depois do aceite",
        blocks: [
          {
            kind: "p",
            text: "A Anuntech recebe um aviso na hora. Depois, a equipe prepara o contrato, as cobranças e o projeto a partir do orçamento aceito, e confere cada um antes de mandar para você.",
          },
          {
            kind: "p",
            text: "No orçamento aceito, o quadro “Próximos passos” mostra a ordem do que vem a seguir. Cada passo leva à página onde ele acontece.",
          },
        ],
      },
      {
        title: "Os próximos passos",
        blocks: [
          {
            kind: "pairs",
            items: [
              {
                term: "Contrato",
                text: "A Anuntech prepara o contrato e envia para assinatura. Você recebe o e-mail “Contrato para assinatura” e pode pedir alterações em cada cláusula antes de assinar. Veja [Assinar um contrato](/ajuda/assinar-um-contrato).",
              },
              {
                term: "Entrada",
                text: "Quando a proposta tem entrada, a cobrança aparece em [Financeiro](/financeiro) depois que a equipe a emite. Pague por Pix ou boleto. Veja [Pagar com Pix ou boleto](/ajuda/pagar-uma-fatura).",
              },
              {
                term: "Acessos",
                text: "A equipe pede por chamado o que precisa para começar: contas, ambientes e contatos. Responda no próprio chamado.",
              },
              {
                term: "Início",
                text: "A reunião de início é marcada depois do contrato assinado, da entrada paga (quando houver) e dos acessos liberados. O andamento fica em [Projetos](/projetos).",
              },
            ],
          },
          {
            kind: "p",
            text: "O saldo do orçamento vira outra cobrança, que a equipe prepara e que aparece em Financeiro quando for emitida, com o vencimento na própria fatura.",
          },
        ],
      },
      {
        title: "O projeto",
        blocks: [
          {
            kind: "p",
            text: "A equipe cria o projeto a partir do orçamento. Ele aparece em Projetos assim que é criado, o que pode acontecer antes de o contrato ser assinado. O quadro começa com os cartões “Acessos” e “Reunião de início” e uma tarefa para cada item da proposta, com o código e a fase como etiqueta, na coluna “A fazer”.",
          },
          {
            kind: "p",
            text: "Os Membros veem o projeto conforme o acesso de cada um. Veja [O quadro do projeto](/ajuda/quadro-do-projeto) e [Escolher o que cada Membro vê](/ajuda/o-que-cada-membro-ve).",
          },
        ],
      },
      {
        title: "Mudar algo depois do aceite",
        blocks: [
          {
            kind: "p",
            text: "Antes de assinar, peça a mudança na própria cláusula do contrato. Veja [Pedir alteração antes de assinar](/ajuda/pedir-alteracao-no-contrato).",
          },
          {
            kind: "p",
            text: "Depois do contrato assinado, um pedido novo ou uma mudança de escopo entra por chamado do tipo “Ajuste ou algo novo”. A equipe mostra o efeito no prazo e no valor, e a mudança só vale depois que um Administrador da sua empresa aprovar. O que muda no contrato assinado entra por aditivo.",
          },
          {
            kind: "note",
            tone: "attention",
            text: "O aceite não pode ser desfeito pelo Console. Se aceitou por engano, abra um chamado e explique o que aconteceu.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Quando o contrato chega?",
        a: "A equipe prepara o contrato a partir do orçamento aceito e envia quando ele está pronto. Você recebe o e-mail “Contrato para assinatura”, e o contrato aparece em Contratos com “Falta a sua assinatura”.",
      },
      {
        q: "O projeto apareceu antes de eu assinar o contrato. Está certo?",
        a: "Sim. A equipe pode criar o projeto logo depois do aceite, para organizar as tarefas. O trabalho começa na reunião de início, marcada depois do contrato assinado, da entrada paga (quando houver) e dos acessos.",
      },
      {
        q: "A proposta não tem entrada. O que muda?",
        a: "O passo “Entrada” não aparece, e a reunião de início é marcada depois do contrato assinado e dos acessos liberados.",
      },
      {
        q: "Outra pessoa da empresa vai pagar a entrada. Como faço?",
        a: "A cobrança aparece em Financeiro, que só os Administradores veem. Copie o link de pagamento da fatura e mande para quem paga. Veja [Mandar o link de pagamento para outra pessoa](/ajuda/link-de-pagamento).",
      },
      {
        q: "Aceitei por engano. E agora?",
        a: "O Console não desfaz o aceite. Abra um chamado e explique. A equipe vê com você o que fazer com o contrato e as cobranças.",
      },
      {
        q: "Onde acompanho cada passo?",
        a: "O contrato fica em Contratos, a entrada em Financeiro, os pedidos de acesso em Chamados e o andamento em Projetos. O quadro “Próximos passos”, no orçamento aceito, leva a cada uma dessas páginas.",
      },
    ],
    actions: [
      { label: "Ir para Contratos", href: "/contratos" },
      { label: "Ir para Financeiro", href: "/financeiro" },
      { label: "Ir para Projetos", href: "/projetos" },
    ],
    related: ["responder-um-orcamento", "assinar-um-contrato", "pagar-uma-fatura", "quadro-do-projeto"],
    updatedAt: "2026-10-14",
  },
  {
    slug: "assinar-um-contrato",
    category: "contratos",
    title: "Assinar um contrato",
    summary: "Do e-mail “Contrato para assinatura” à assinatura no Console, com o que fica registrado.",
    audience: "administrador",
    video: "assinatura",
    keywords: [
      "assinar contrato",
      "assinatura",
      "assinatura eletrônica",
      "assinatura eletronica",
      "contrato",
      "aditivo",
      "assinar aditivo",
      "falta a sua assinatura",
      "contrato para assinatura",
      "codigo de acesso",
      "não consigo assinar",
      "nao consigo assinar",
      "pdf do contrato",
    ],
    sections: [
      {
        title: "Quem assina",
        blocks: [
          {
            kind: "p",
            text: "Só um Administrador da empresa vê os contratos e pode assinar. Cada parte assina uma vez em cada versão do contrato: pela sua empresa, vale a assinatura do primeiro Administrador que assinar. Pela Anuntech, alguém da equipe assina como “Contratada”.",
          },
          {
            kind: "p",
            text: "O Membro não vê Contratos no menu nem recebe o e-mail do contrato. Se a pessoa que deve assinar é Membro, um Administrador muda a permissão dela em [Membros](/configuracoes/membros), em “Editar permissão”. Veja [Membro ou Administrador](/ajuda/membro-ou-administrador).",
          },
        ],
      },
      {
        title: "Onde o contrato chega",
        blocks: [
          {
            kind: "list",
            items: [
              "No e-mail “Contrato para assinatura: título do contrato” (ou “Aditivo para assinatura”), com o link para ler e assinar pelo Console. O aviso vai para o e-mail de acesso de cada Administrador da empresa.",
              "Na página [Contratos](/contratos), onde o contrato mostra “Falta a sua assinatura”. Clique nele ou, no menu do contrato, em “Ler e assinar”. No celular, Contratos fica em “Mais”.",
              "Na [Visão geral](/painel), no quadro “Precisa de atenção”, em “Contratos para você assinar”. O atalho abre a lista dos contratos que aguardam assinatura.",
            ],
          },
          {
            kind: "p",
            text: "Quando o contrato completa 7 dias sem a assinatura da sua empresa, os Administradores recebem o lembrete “Contrato esperando sua assinatura” (num aditivo, “Aditivo esperando sua assinatura”), uma vez por versão.",
          },
        ],
      },
      {
        title: "A lista de contratos",
        blocks: [
          {
            kind: "p",
            text: "Em [Contratos](/contratos), cada contrato mostra a situação (“Aguardando assinatura”, “Em revisão” ou “Assinado”) e a vigência. Os aditivos aparecem com “Aditivo de” e o título do contrato original.",
          },
          {
            kind: "pairs",
            items: [
              { term: "Falta a sua assinatura", text: "A sua empresa ainda não assinou esta versão." },
              { term: "Falta a assinatura da Anuntech", text: "A sua empresa já assinou, e falta a equipe assinar pela Contratada." },
            ],
          },
          {
            kind: "p",
            text: "Use “Buscar por título” e o filtro de situação: “Todas as situações”, “Aguardando assinatura”, “Em revisão” ou “Assinados”. Os botões “Lista” e “Grade” mudam a forma de mostrar. No menu de cada contrato ficam “Abrir contrato” (num aditivo, “Abrir aditivo”), “Ler e assinar”, quando falta a sua assinatura, e “Baixar PDF”, que vira “Baixar PDF assinado” depois das duas assinaturas.",
          },
        ],
      },
      {
        title: "Entrar pelo link do e-mail",
        blocks: [
          {
            kind: "steps",
            items: [
              "Clique no link do e-mail.",
              "Se você não estiver conectado, escolha a aba “E-mail” ou “WhatsApp”, digite o endereço ou o número cadastrado e clique em “Receber código”. Você também pode entrar com “Continuar com Google”.",
              "Digite os 6 números do “Código de acesso” e clique em “Entrar”. Se a sua conta usa verificação em duas etapas, conclua a segunda etapa.",
              "O Console abre a Visão geral, e não o contrato. Clique em “Contratos para você assinar”, em “Precisa de atenção”, e abra o contrato na lista, ou abra o link do e-mail de novo, agora já conectado.",
            ],
          },
          {
            kind: "p",
            text: "O código vale 5 minutos e aceita 3 tentativas. Se ele não chegar, o botão de reenvio libera depois de 60 segundos. A aba WhatsApp só funciona com um número já vinculado em [Meu perfil](/conta). Mais detalhes em [Entrar no Console](/ajuda/entrar) e [Verificação em duas etapas](/ajuda/verificacao-em-duas-etapas).",
          },
        ],
      },
      {
        title: "Ler o contrato",
        blocks: [
          {
            kind: "p",
            text: "O contrato abre com o título, a situação e o “Texto do contrato”, cláusula por cláusula. O texto foi congelado no envio: o que você assina é exatamente o que está na tela, e o hash SHA-256, em “Ver detalhes” no quadro “Assinaturas”, identifica esse texto.",
          },
          {
            kind: "p",
            text: "Ao lado do texto (em telas menores, depois dele) ficam “Assinaturas”, com o “Cliente” (a sua empresa) e a “Anuntech”, e “Ver detalhes” com a data de envio e o hash; “Vigência”; e “Versões”, quando já houve um envio anterior. Para guardar uma cópia, clique em “Baixar PDF”.",
          },
          {
            kind: "p",
            text: "Se algo precisa mudar, peça antes de assinar, na própria cláusula. O quadro “Pedir alterações” fica ao lado do texto (em telas menores, antes dele). Veja [Pedir alteração antes de assinar](/ajuda/pedir-alteracao-no-contrato).",
          },
        ],
      },
      {
        title: "Assinar",
        blocks: [
          {
            kind: "steps",
            items: [
              "Leia o texto até o fim.",
              "No quadro “Assinaturas”, marque “Li o contrato e concordo com todos os termos, assinando como [seu nome] por [empresa].” Num aditivo, a frase começa com “Li o aditivo”.",
              "Clique em “Assinar contrato” (num aditivo, “Assinar aditivo”). O botão só libera depois que a caixa está marcada.",
              "Aparece “Sua assinatura foi registrada. Falta a assinatura da Anuntech.” Se a Anuntech já tinha assinado, aparece “Contrato assinado pelas duas partes. O PDF final já está disponível.”",
            ],
          },
          {
            kind: "note",
            tone: "attention",
            text: "Assinar descarta os pedidos de alteração da sua empresa que ainda não foram enviados, inclusive os escritos por outros Administradores. Quando há algum, o quadro “Assinaturas” avisa quantos serão descartados. Se quer que a Anuntech leia esses pedidos, envie antes de assinar.",
          },
          {
            kind: "note",
            tone: "info",
            text: "Com o contrato “Em revisão”, a assinatura fica bloqueada até a nova versão chegar por e-mail.",
          },
        ],
      },
      {
        title: "O que fica registrado",
        blocks: [
          {
            kind: "p",
            text: "Na assinatura ficam registrados o seu nome (o de [Meu perfil](/conta), ou o e-mail se não houver nome), o seu e-mail, a data e a hora, o IP, o navegador e o hash do texto assinado.",
          },
          {
            kind: "p",
            text: "Antes de registrar, o Console confere o hash. Se o texto não bater com o enviado, aparece “O texto do contrato não confere com o registro. Peça um novo envio.” Os dados da assinatura aparecem na última página do PDF final. Veja [Depois de assinar](/ajuda/contrato-assinado).",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Entrei pelo link do e-mail e caí na Visão geral, não no contrato.",
        a: "Depois do código, o Console abre a Visão geral. Clique em “Contratos para você assinar”, em “Precisa de atenção”, ou abra o link do e-mail de novo, já conectado. O contrato também está em Contratos, com “Falta a sua assinatura”.",
      },
      {
        q: "Não recebi o código de acesso.",
        a: "Espere um pouco e confira o spam. Depois de 60 segundos, a tela libera “Reenviar código”. Cada código vale 5 minutos, aceita 3 tentativas e só funciona uma vez.",
      },
      {
        q: "Não recebi o e-mail do contrato.",
        a: "O aviso vai para o e-mail de acesso de cada Administrador, e não para os contatos de Notificações. Confira o spam. No Console, o contrato está em Contratos.",
      },
      {
        q: "Outro Administrador já assinou. Preciso assinar também?",
        a: "Não. A empresa assina uma vez por versão, e vale a assinatura do primeiro Administrador que assinar. O quadro “Assinaturas” mostra quem assinou pela sua empresa, na linha “Cliente”.",
      },
      {
        q: "Já assinei, mas o contrato voltou a pedir a minha assinatura.",
        a: "A Anuntech enviou uma nova versão. A assinatura da versão anterior fica no histórico, mas deixa de valer, e a nova versão precisa das duas assinaturas de novo. A barra na margem do texto marca o que mudou. Você encontra o contrato em Contratos, com “Falta a sua assinatura”, e na Visão geral, em “Contratos para você assinar”.",
      },
      {
        q: "Posso assinar pelo celular?",
        a: "Sim. No celular, o quadro “Assinaturas” fica abaixo do texto do contrato.",
      },
      {
        q: "O assistente pode assinar por mim?",
        a: "O assistente lê os contratos que você pode ver e responde perguntas sobre eles, mas não tem uma ação para assinar. A assinatura é sua, no quadro “Assinaturas” do contrato.",
      },
    ],
    actions: [{ label: "Ir para Contratos", href: "/contratos" }],
    related: ["pedir-alteracao-no-contrato", "contrato-assinado", "entrar", "membro-ou-administrador"],
    updatedAt: "2026-10-14",
  },
  {
    slug: "pedir-alteracao-no-contrato",
    category: "contratos",
    title: "Pedir alteração antes de assinar",
    summary: "Como pedir mudanças cláusula por cláusula, enviar os pedidos à Anuntech e conferir a nova versão do contrato.",
    audience: "administrador",
    keywords: [
      "pedir alteração",
      "pedir alteracao",
      "alterar contrato",
      "mudar cláusula",
      "mudar clausula",
      "revisão do contrato",
      "revisao do contrato",
      "em revisão",
      "nova versão",
      "nova versao",
      "comentar cláusula",
      "negociar contrato",
      "texto proposto",
    ],
    sections: [
      {
        title: "Quando dá para pedir",
        blocks: [
          {
            kind: "p",
            text: "Você pede a mudança na própria cláusula, dentro do Console, enquanto o contrato está “Aguardando assinatura” e antes de alguém da sua empresa assinar. Só um Administrador da empresa pode pedir alterações.",
          },
          {
            kind: "p",
            text: "Aceitam pedido as cláusulas numeradas, os parágrafos e as linhas das partes (como a da Contratante). Títulos e cabeçalhos não têm o botão.",
          },
        ],
      },
      {
        title: "Como pedir",
        blocks: [
          {
            kind: "steps",
            items: [
              "Abra o contrato em [Contratos](/contratos).",
              "Clique no ícone de balão ao lado da cláusula. Com o mouse em cima, ele mostra “Pedir alteração”. No celular, toque no ícone.",
              "No formulário “Pedido de alteração”, escreva em “O que precisa mudar” o que você quer e por quê. Esse campo é obrigatório.",
              "“Texto proposto (opcional)” já vem com o texto atual da cláusula. Reescreva como ela deveria ficar, ou deixe como está para só comentar.",
              "Clique em “Adicionar pedido”. Aparece “Pedido salvo. Envie à Anuntech quando terminar.”, e o pedido fica embaixo da cláusula como “Não enviado”. Use o lápis para editar ou a lixeira para descartar.",
              "Repita nas outras cláusulas que quiser mudar.",
              "No quadro “Pedir alterações” (ao lado do texto; em telas menores, antes dele), clique em “Enviar pedido à Anuntech” (com mais de um, “Enviar N pedidos à Anuntech”) e confirme em “Enviar pedidos”.",
            ],
          },
        ],
      },
      {
        title: "Limites",
        blocks: [
          {
            kind: "list",
            items: [
              "“O que precisa mudar”: até 2.000 caracteres por pedido.",
              "“Texto proposto”: até 8.000 caracteres.",
              "Até 50 pedidos não enviados por rodada. Passou disso, envie os que já escreveu e continue numa nova rodada, na próxima versão.",
              "Um texto proposto igual ao original conta como comentário.",
            ],
          },
        ],
      },
      {
        title: "Quem vê os pedidos",
        blocks: [
          {
            kind: "p",
            text: "Os pedidos não enviados ficam guardados e aparecem para todos os Administradores da sua empresa. A Anuntech só vê depois do envio.",
          },
          {
            kind: "note",
            tone: "attention",
            text: "Quem envia a rodada envia todos os pedidos daquela versão, inclusive os escritos por outros Administradores. Combine com eles antes de enviar. Depois do envio, os pedidos não podem mais ser editados.",
          },
        ],
      },
      {
        title: "Enquanto a Anuntech revisa",
        blocks: [
          {
            kind: "list",
            items: [
              "A equipe recebe os pedidos por e-mail na hora do envio.",
              "O contrato fica “Em revisão”, e o quadro “Em revisão pela Anuntech” mostra quantos pedidos você enviou e quando.",
              "Cada pedido fica como “Aguardando a Anuntech”.",
              "Essa versão não pode ser assinada. O PDF dela sai marcado como em revisão, sem validade para assinatura.",
              "A equipe aceita ou recusa cada pedido, e toda recusa vem com uma resposta. A nova versão só sai depois que todos os pedidos foram respondidos.",
            ],
          },
        ],
      },
      {
        title: "A nova versão",
        blocks: [
          {
            kind: "steps",
            items: [
              "Você recebe o e-mail “Contrato para assinatura” da nova versão, com “Esta é uma nova versão (N); a anterior deixou de valer.” e o aviso de que ela traz a resposta aos seus pedidos e mostra o que mudou.",
              "Abra o contrato. A barra na margem marca o que mudou desde a versão anterior, e os trechos removidos aparecem riscados. Use “Esconder mudanças” ou “Marcar mudanças” para alternar.",
              "Abaixo do texto, o quadro “Revisões” mostra cada pedido com “Aceito” ou “Recusado”, a “Resposta da Anuntech” e, quando for o caso, o aviso de que o texto foi aplicado na versão seguinte.",
              "Se estiver tudo certo, assine. Se ainda faltar algo, peça novas alterações numa nova rodada.",
            ],
          },
        ],
      },
    ],
    faq: [
      {
        q: "Posso pedir alteração depois de assinar?",
        a: "Não pelo Console. Depois que a sua empresa assina, o botão some. Se algo precisa mudar num contrato assinado, abra um chamado. A mudança entra por aditivo, assinado à parte.",
      },
      {
        q: "Quantas rodadas de alteração posso fazer?",
        a: "O Console não limita o número de rodadas. Cada rodada aceita até 50 pedidos.",
      },
      {
        q: "Preciso escrever o texto novo da cláusula?",
        a: "Não. O texto proposto é opcional. Você pode só explicar em “O que precisa mudar”, e a equipe responde.",
      },
      {
        q: "Escrevi pedidos e assinei sem enviar. O que acontece com eles?",
        a: "Assinar descarta os pedidos não enviados, e a Anuntech não recebe esses pedidos.",
      },
      {
        q: "Por que não consigo assinar?",
        a: "Com o contrato “Em revisão”, a assinatura fica bloqueada. A nova versão chega por e-mail depois que a equipe responde a todos os pedidos, e aí a assinatura volta a ficar disponível.",
      },
      {
        q: "A Anuntech recusou um pedido meu. E agora?",
        a: "Leia a resposta no quadro “Revisões”. Se ainda quiser a mudança, faça um novo pedido na nova versão, explicando o ponto, ou abra um chamado para conversar com a equipe.",
      },
      {
        q: "Posso mandar um arquivo com as mudanças?",
        a: "O pedido de alteração é escrito na própria cláusula, sem anexo. Assim cada pedido e cada resposta ficam registrados junto do texto, versão por versão. Se precisar mandar um arquivo, abra um chamado.",
      },
    ],
    actions: [{ label: "Ir para Contratos", href: "/contratos" }],
    related: ["assinar-um-contrato", "contrato-assinado", "membro-ou-administrador"],
    updatedAt: "2026-10-14",
  },
  {
    slug: "contrato-assinado",
    category: "contratos",
    title: "Depois de assinar: PDF, registro e aditivos",
    summary: "O que acontece quando as duas partes assinam, onde fica o PDF final, como acompanhar a vigência e como chegam os aditivos.",
    audience: "administrador",
    keywords: [
      "contrato assinado",
      "pdf assinado",
      "baixar contrato",
      "registro de assinaturas",
      "hash",
      "vigência",
      "vigencia",
      "vencimento do contrato",
      "renovação",
      "renovacao",
      "aditivo",
      "prorrogação",
      "reajuste",
      "rescisão",
      "rescisao",
    ],
    sections: [
      {
        title: "Falta a assinatura da Anuntech",
        blocks: [
          {
            kind: "p",
            text: "Depois que a sua empresa assina, a lista mostra “Falta a assinatura da Anuntech”, e no contrato a “Contratada” fica em “Aguardando assinatura”. A equipe recebe um aviso na hora, e alguém da Anuntech assina pela Contratada.",
          },
        ],
      },
      {
        title: "Contrato assinado pelas duas partes",
        blocks: [
          {
            kind: "list",
            items: [
              "A situação vira “Assinado”, e o quadro “Assinaturas” mostra as duas assinaturas, cada uma com a data e a hora.",
              "Os Administradores recebem o e-mail “Contrato assinado: título do contrato” (num aditivo, “Aditivo assinado”), com o link do contrato no Console e os próximos passos. O PDF não vai anexado.",
            ],
          },
        ],
      },
      {
        title: "O PDF assinado",
        blocks: [
          {
            kind: "p",
            text: "Com as duas assinaturas, o Console gera o PDF final uma vez e guarda. Cada download devolve esse mesmo arquivo.",
          },
          {
            kind: "steps",
            items: [
              "Abra o contrato em [Contratos](/contratos).",
              "Clique em “Baixar PDF assinado”. A mesma opção fica no menu do contrato, na lista.",
            ],
          },
          {
            kind: "p",
            text: "A última página do PDF, “Registro de assinaturas eletrônicas”, mostra de cada parte o nome e o e-mail de quem assinou, a data e a hora, e o IP. Logo abaixo vêm o hash SHA-256, que identifica exatamente o texto assinado, e o identificador do contrato.",
          },
          {
            kind: "p",
            text: "As versões anteriores ficam no quadro “Versões”, para consulta, com quem assinou cada uma. O PDF delas sai marcado como versão substituída, sem efeito.",
          },
        ],
      },
      {
        title: "Próximos passos",
        blocks: [
          { kind: "p", text: "No contrato assinado, o quadro “Próximos passos” indica onde continuar:" },
          {
            kind: "list",
            items: [
              "As cobranças aparecem em [Financeiro](/financeiro).",
              "Acessos, dúvidas e pedidos seguem por [chamado](/chamados).",
              "O andamento de um projeto fica em [Projetos](/projetos).",
              "[Como trabalhamos](/como-trabalhamos) mostra os prazos e o que ajuda a equipe.",
            ],
          },
          {
            kind: "p",
            text: "Os prazos de atendimento do seu contrato aparecem em Como trabalhamos, em “Seus prazos”, depois que a equipe publica as condições da sua empresa. Veja [Prazos do seu contrato](/ajuda/como-trabalhamos).",
          },
        ],
      },
      {
        title: "Vigência",
        blocks: [
          {
            kind: "p",
            text: "O quadro “Vigência” mostra o “Início”, o “Fim” e a “Situação” do contrato. Sem data de fim, ele diz “Sem prazo definido.”",
          },
          {
            kind: "list",
            items: [
              "Nos 30 dias antes do fim, aparece “Vence em N dias”, “Vence amanhã” ou “Vence hoje”, no topo do contrato, no quadro “Vigência” e na lista.",
              "Depois do fim, aparece “Venceu ontem” ou “Vencido há N dias”.",
              "Se o início ainda não chegou, o quadro “Vigência” mostra “Começa amanhã” ou “Começa em N dias”.",
            ],
          },
          {
            kind: "p",
            text: "O aviso de vencimento por e-mail vai para a equipe da Anuntech. Se a relação continua, ela prepara um aditivo de prorrogação ou um novo contrato. Se as datas do quadro forem diferentes das do texto, vale o que está no texto assinado.",
          },
        ],
      },
      {
        title: "Aditivos",
        blocks: [
          {
            kind: "p",
            text: "O que muda depois da assinatura entra num aditivo: um documento próprio, assinado à parte, sem reescrever o contrato assinado. Um contrato assinado não é cancelado pelo Console, e a rescisão também é feita por aditivo.",
          },
          {
            kind: "pairs",
            items: [
              { term: "Prorrogação", text: "Estende a vigência do contrato." },
              { term: "Reajuste", text: "Atualiza o valor no aniversário do contrato e não muda a vigência." },
              { term: "Mudança de escopo", text: "Registra o que entra ou sai do que foi contratado." },
              { term: "Rescisão", text: "Encerra o contrato." },
            ],
          },
          {
            kind: "steps",
            items: [
              "Você recebe o e-mail “Aditivo para assinatura: título do aditivo”.",
              "Abra o aditivo. O topo mostra a marca “Aditivo”, e o caminho acima do título leva ao contrato original.",
              "Leia, peça alterações se precisar e clique em “Assinar aditivo”, como num contrato.",
            ],
          },
          {
            kind: "p",
            text: "No contrato original, o quadro “Aditivos” lista cada aditivo com a situação. Quando o aditivo tem datas, o quadro “Vigência” dele avisa “Ao ser assinado, passa a valer para o contrato original.”, e a vigência do contrato original muda quando as duas partes assinam. Sem datas, diz “Este aditivo não muda o prazo do contrato.”",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Já assinei. Quando o contrato fica pronto?",
        a: "Falta a assinatura da Anuntech, e a equipe recebe um aviso na hora em que você assina. Quando ela assina, a situação vira “Assinado”, você recebe o e-mail “Contrato assinado” e o PDF final fica disponível.",
      },
      {
        q: "Onde encontro o PDF assinado?",
        a: "Na página do contrato, em “Baixar PDF assinado”, ou no menu do contrato na lista Contratos. O e-mail de confirmação traz o link do contrato no Console, sem o arquivo anexado.",
      },
      {
        q: "Como confiro que o PDF é o mesmo texto que assinei?",
        a: "Compare o hash SHA-256 de “Ver detalhes”, no quadro “Assinaturas”, com o que aparece na última página do PDF. Se o texto mudasse, o hash seria outro.",
      },
      {
        q: "O contrato vai vencer. Preciso fazer algo?",
        a: "Nos 30 dias antes do fim, o contrato mostra “Vence em N dias”. A equipe da Anuntech recebe o aviso e, para renovar, prepara um aditivo de prorrogação, que você assina como assinou o contrato. Se tiver dúvida, abra um chamado.",
      },
      {
        q: "Quero mudar algo no contrato assinado.",
        a: "Abra um chamado do tipo “Ajuste ou algo novo” e explique. Se a mudança for combinada, ela entra por aditivo, que chega por e-mail para um Administrador assinar.",
      },
      {
        q: "Um Membro da minha empresa pode ver o contrato?",
        a: "Não. Contratos e o PDF assinado são só dos Administradores. Para dar acesso a alguém, um Administrador muda a permissão da pessoa em Membros, em “Editar permissão”.",
      },
    ],
    actions: [{ label: "Ir para Contratos", href: "/contratos" }],
    related: ["assinar-um-contrato", "como-trabalhamos", "pedir-alteracao-no-contrato", "faturas"],
    updatedAt: "2026-10-14",
  },
];
