import type { HelpArticle } from "../help-model";

export const financeiroArticles: HelpArticle[] = [
  {
    slug: "faturas",
    category: "financeiro",
    title: "Faturas e o que cada situação quer dizer",
    summary: "Onde ficam as faturas da sua empresa, como filtrar a lista e o que significam Em aberto, Vencida e Paga.",
    audience: "administrador",
    keywords: [
      "fatura",
      "faturas",
      "financeiro",
      "cobrança",
      "cobranca",
      "em aberto",
      "vencida",
      "paga",
      "situação da fatura",
      "status da fatura",
      "contas a pagar",
      "segunda via",
      "historico de faturas",
    ],
    sections: [
      {
        title: "Onde ficam as faturas",
        blocks: [
          {
            kind: "p",
            text: "No menu do Console, clique em “Financeiro”. A página se chama “Faturas” e reúne o que a Anuntech cobrou da sua empresa: o que está em aberto, o que venceu e o que já foi pago. No celular, “Financeiro” é uma das abas da barra de baixo.",
          },
          {
            kind: "p",
            text: "A [Visão geral](/painel) também mostra o que pagar. O quadro “A pagar” lista até 5 faturas em aberto ou vencidas, a partir da que vence primeiro, com o botão “Pagar”, e mostra o total sob o título quando há mais de uma. O botão “Ver todos”, no canto do quadro, leva ao Financeiro.",
          },
        ],
      },
      {
        title: "Quem vê o Financeiro",
        blocks: [
          {
            kind: "p",
            text: "Só o Administrador da empresa. O Membro não vê o Financeiro no menu, nem valores e vencimentos na Visão geral. Quando um Membro precisa pagar uma fatura, ele pede a um Administrador, que pode mandar o [link de pagamento](/ajuda/link-de-pagamento): quem tem o link paga sem entrar no Console.",
          },
        ],
      },
      {
        title: "Ler a lista",
        blocks: [
          {
            kind: "steps",
            items: [
              "No menu do Console, clique em “Financeiro”.",
              "No topo, os cartões “Em aberto”, “Vencidas” e “Pagas” mostram o total em reais e quantas faturas há em cada grupo, já com a busca e o período que você escolheu. O número ao lado do título é o total de faturas.",
              "Se a empresa tem recorrências, o quadro “Próximas cobranças” mostra o que vem pela frente. Veja [Próximas cobranças e recorrências](/ajuda/recorrencias).",
              "Na tabela, cada linha traz a “Fatura” (a descrição e, numa recorrência, “Recorrência mensal” ou “Recorrência anual”; a cobrança única não leva rótulo), a “Situação”, o “Valor” e o “Vencimento”. Numa fatura vencida, a data fica em vermelho com os dias de atraso.",
              "Clique na linha para abrir a fatura. O botão de três pontos (“...”) da linha tem “Abrir fatura” e, enquanto o link de pagamento estiver ativo, “Copiar link de pagamento” e “Abrir página de pagamento”.",
            ],
          },
          {
            kind: "list",
            items: [
              "A lista começa pela fatura criada mais recentemente e mostra 25 por página. Você pode trocar para 10, 50 ou 100.",
              "No celular, a tabela esconde o valor e o vencimento. Abra a fatura para ver os dois.",
            ],
          },
        ],
      },
      {
        title: "Filtrar e buscar",
        blocks: [
          {
            kind: "steps",
            items: [
              "Clique num dos cartões para ver só aquele grupo. O cartão ativo fica destacado.",
              "Para achar uma fatura pelo nome, digite no campo “Buscar por descrição”.",
              "No seletor de período, escolha “Todo o período”, “Este mês”, “Mês passado”, “Próximos 30 dias”, “Este ano” ou “Personalizado”, com as datas “De” e “Até”. O período considera a data de vencimento.",
              "No seletor de situação, escolha “Todas as situações”, “Em aberto”, “Vencidas” ou “Pagas”. Ele faz o mesmo que os cartões.",
              "Se aparecer “Nenhuma fatura encontrada”, clique em “Limpar filtros”.",
            ],
          },
          {
            kind: "p",
            text: "Os filtros ficam no endereço da página. Dá para guardar a visão nos favoritos do navegador ou mandar o endereço para outro Administrador da empresa.",
          },
        ],
      },
      {
        title: "O que cada situação quer dizer",
        blocks: [
          {
            kind: "pairs",
            items: [
              {
                term: "Em aberto",
                text: "A fatura foi emitida no banco e o vencimento ainda não passou.",
              },
              {
                term: "Vencida",
                text: "O vencimento passou e o pagamento ainda não foi confirmado. A fatura vence no fim do dia do vencimento, no horário de Brasília. Os mesmos boleto e Pix continuam valendo por um tempo: veja [Desconto, multa, juros e atraso](/ajuda/atraso-multa-e-juros).",
              },
              {
                term: "Paga",
                text: "O Banco Inter confirmou o pagamento pelo boleto ou pelo Pix, ou a equipe da Anuntech confirmou um pagamento feito por outro meio.",
              },
            ],
          },
          {
            kind: "note",
            tone: "attention",
            text: "O cartão “Em aberto” não inclui as vencidas: cada fatura fica em uma situação só. Para ver tudo o que falta pagar, confira também o cartão “Vencidas”.",
          },
          {
            kind: "p",
            text: "A lista mostra só faturas emitidas ou pagas. Uma cobrança que a equipe ainda está preparando não aparece. Uma fatura cancelada, ou encerrada pelo banco depois do prazo para pagar, sai da lista.",
          },
        ],
      },
      {
        title: "A página da fatura",
        blocks: [
          {
            kind: "list",
            items: [
              "“Cobrança”: o “Valor”, o “Vencimento” (com os dias de atraso, quando houver), o “Pagador” (a razão social com o CNPJ ou CPF, como sai no boleto), a “Recorrência” e a “Próxima cobrança” nas recorrências e as “Condições” (desconto, multa e juros, enquanto a fatura pode ser paga). “Criada em” fica em “Ver detalhes”. Enquanto a fatura não foi paga, o link “Como pagar” abre [Pagar com Pix ou boleto](/ajuda/pagar-uma-fatura).",
              "“Pagamento”: com a fatura em aberto ou vencida, o “Pix copia e cola” e a “Linha digitável do boleto”, cada um com “Copiar”, e “Baixar PDF” para o boleto. Com a fatura paga, aparece “Pagamento confirmado pelo Inter.”",
              "“Nota fiscal”: se a nota desta cobrança já foi emitida. Veja [Nota fiscal](/ajuda/nota-fiscal).",
            ],
          },
          {
            kind: "note",
            tone: "attention",
            text: "A página da fatura não mostra o QR Code do Pix nem o link de pagamento. Para o QR Code, abra a página de pagamento pelo “...” da fatura na lista ou pelo botão “Pagar” da Visão geral.",
          },
          {
            kind: "note",
            tone: "info",
            text: "A página da fatura não se atualiza sozinha. Enquanto o banco emite o boleto e o Pix, o quadro “Pagamento” diz “Boleto e Pix aparecem aqui assim que o Inter concluir a emissão. Atualize a página em alguns minutos.” Depois de pagar, recarregue a página para ver a situação nova.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Quem da minha empresa vê o Financeiro?",
        a: "Só os Administradores da empresa no Console. O Membro não vê faturas, valores nem vencimentos. Mesmo assim, qualquer pessoa com o link de pagamento abre a fatura e paga, sem acesso ao Console.",
      },
      {
        q: "Sou Membro e preciso pagar uma fatura. O que faço?",
        a: "Peça a um Administrador da sua empresa. Ele copia o link de pagamento em Financeiro e manda para você, e você paga por Pix ou boleto sem entrar no Console. Se o seu trabalho pede acesso ao Financeiro, o Administrador pode mudar a sua permissão: veja [Membro ou Administrador](/ajuda/membro-ou-administrador).",
      },
      {
        q: "Paguei, mas a fatura continua Em aberto ou Vencida. Por quê?",
        a: "A fatura muda para Paga quando o Banco Inter confirma o pagamento. A página de pagamento indica confirmação em poucos minutos no Pix e compensação em até 3 dias úteis no boleto. Depois disso, o Console consulta o banco a cada 5 minutos. Recarregue a página da fatura para ver a situação nova. Se você pagou por outro meio, veja [Pagar com Pix ou boleto](/ajuda/pagar-uma-fatura).",
      },
      {
        q: "Uma fatura sumiu da lista. O que aconteceu?",
        a: "Saem da lista as faturas canceladas pela equipe e as que o banco encerrou depois do prazo para pagar. Uma fatura vencida que o banco encerrou sem pagamento continua devida, e a equipe da Anuntech pode enviar uma nova cobrança, com uma nova data para pagar. O link de pagamento da fatura que saiu diz o que aconteceu: “Boleto e Pix vencidos” (o valor continua em aberto), “Cobrança substituída” (pague pela cobrança nova) ou “Fatura cancelada” (não há nada a pagar). Se não sabe por que uma fatura saiu, [abra um chamado](/chamados/novo).",
      },
      {
        q: "Onde vejo a próxima cobrança, que ainda não foi emitida?",
        a: "No quadro “Próximas cobranças”, no Financeiro. Quando não há nada em aberto, a Visão geral também mostra a próxima cobrança no cartão e no quadro “A pagar”. Veja [Próximas cobranças e recorrências](/ajuda/recorrencias).",
      },
      {
        q: "Posso mandar a lista filtrada para outra pessoa?",
        a: "Para outro Administrador da empresa, sim: os filtros ficam no endereço da página. Quem não é Administrador não vê o Financeiro. Para quem só vai pagar, mande o [link de pagamento](/ajuda/link-de-pagamento).",
      },
    ],
    actions: [
      { label: "Ir para Financeiro", href: "/financeiro" },
      { label: "Ir para a Visão geral", href: "/painel" },
    ],
    related: ["pagar-uma-fatura", "recorrencias", "atraso-multa-e-juros", "membro-ou-administrador"],
    updatedAt: "2026-10-14",
  },
  {
    slug: "pagar-uma-fatura",
    category: "financeiro",
    title: "Pagar com Pix ou boleto",
    summary: "Como abrir a página de pagamento, pagar pelo QR Code, pelo código Pix ou pelo boleto e saber quando o banco confirmou.",
    audience: "administrador",
    video: "fatura",
    keywords: [
      "pagar",
      "pagamento",
      "pix",
      "qr code",
      "pix copia e cola",
      "boleto",
      "linha digitavel",
      "codigo de barras",
      "baixar boleto",
      "pdf do boleto",
      "segunda via do boleto",
      "comprovante",
      "pagar fatura",
      "loterica",
    ],
    sections: [
      {
        title: "Onde pagar",
        blocks: [
          {
            kind: "p",
            text: "Cada fatura emitida tem uma página de pagamento, com o QR Code do Pix, o código Pix e o boleto. Ela abre sem pedir login. Chegue a ela por um destes caminhos:",
          },
          {
            kind: "list",
            items: [
              "Na [Visão geral](/painel), no quadro “A pagar”, clique em “Pagar” ao lado da fatura.",
              "Em [Financeiro](/financeiro), clique no “...” da fatura e escolha “Abrir página de pagamento”.",
              "No e-mail de cobrança, clique em “Pagar agora”. No WhatsApp, abra o link da mensagem.",
            ],
          },
          {
            kind: "p",
            text: "Dentro do Console, a página da fatura também tem o “Pix copia e cola” e a “Linha digitável do boleto”, cada um com “Copiar”, e “Baixar PDF” para o boleto. O QR Code fica só na página de pagamento.",
          },
        ],
      },
      {
        title: "Quem pode pagar",
        blocks: [
          {
            kind: "p",
            text: "O Administrador da empresa encontra as faturas no Console. Qualquer pessoa com o link de pagamento também paga, sem conta no Console, como o contador ou quem cuida das contas da empresa. Um Membro não vê as faturas e pede o link a um Administrador. Veja [Mandar o link de pagamento para outra pessoa](/ajuda/link-de-pagamento).",
          },
        ],
      },
      {
        title: "Pagar com Pix",
        blocks: [
          {
            kind: "steps",
            items: [
              "Abra a página de pagamento da fatura.",
              "Abra o app do seu banco e escolha Pix.",
              "Leia o QR Code. Se estiver no celular, toque em “Copiar código Pix” e cole o código no app do banco.",
              "Confira os dados e confirme o pagamento.",
            ],
          },
          { kind: "p", text: "Para o Pix, a página indica “Confirmação em poucos minutos.”" },
        ],
      },
      {
        title: "Pagar com boleto",
        blocks: [
          {
            kind: "steps",
            items: [
              "Abra a página de pagamento da fatura.",
              "Clique em “Copiar linha digitável”, ou em “Baixar boleto PDF” para ter o boleto em arquivo.",
              "Pague pelo app do banco, pelo internet banking ou em qualquer lotérica.",
            ],
          },
          { kind: "p", text: "Para o boleto, a página indica “Compensa em até 3 dias úteis.”" },
        ],
      },
      {
        title: "Depois de pagar",
        blocks: [
          {
            kind: "list",
            items: [
              "O Console consulta o Banco Inter a cada 5 minutos. Com o pagamento confirmado, a fatura muda para “Paga” no Financeiro e na Visão geral, e os lembretes de cobrança param.",
              "Se quiser acompanhar, deixe a página de pagamento aberta. Ela se atualiza a cada 15 segundos e mostra “Pagamento confirmado” assim que o Console registra a confirmação do banco.",
              "A página da fatura no Console não se atualiza sozinha. Recarregue para ver “Pagamento confirmado pelo Inter.”",
            ],
          },
          {
            kind: "p",
            text: "O Console não gera recibo. O comprovante é o do banco em que você pagou, e o documento fiscal é a [nota fiscal](/ajuda/nota-fiscal).",
          },
          {
            kind: "note",
            tone: "attention",
            text: "Pague sempre pelo Pix ou pelo boleto da própria fatura. É assim que o banco identifica o pagamento e a fatura muda para Paga sozinha. Um pagamento feito por outro meio precisa ser conferido pela equipe da Anuntech, e até lá a fatura continua em aberto e os lembretes podem continuar chegando.",
          },
        ],
      },
      {
        title: "Se algo não funcionar",
        blocks: [
          {
            kind: "pairs",
            items: [
              {
                term: "“Preparando o pagamento”",
                text: "O banco ainda está gerando o boleto e o Pix. Deixe a página aberta: os códigos aparecem sozinhos, sem recarregar.",
              },
              {
                term: "“Não foi possível baixar o arquivo.” ao baixar o boleto",
                text: "O PDF do boleto não veio do banco naquele momento. Tente de novo em instantes ou pague pela linha digitável.",
              },
              {
                term: "Código Pix ou linha digitável recusados",
                text: "A equipe pode ter mudado o valor, o vencimento ou as condições da fatura. Nesse caso, o boleto e o Pix são emitidos de novo e os códigos antigos deixam de valer. O link continua o mesmo: abra a página de pagamento de novo e copie o código atual.",
              },
              {
                term: "“Boleto e Pix vencidos”",
                text: "A página diz “O prazo do boleto e do Pix acabou sem pagamento.”: a fatura venceu, passou do prazo do banco e o banco encerrou o boleto e o Pix. O valor continua em aberto. Fale com a Anuntech para receber uma nova forma de pagamento. Veja [Desconto, multa, juros e atraso](/ajuda/atraso-multa-e-juros).",
              },
              {
                term: "“Cobrança substituída”",
                text: "A página diz “Esta cobrança foi substituída por uma nova.”: a Anuntech mandou uma nova cobrança no lugar desta. Pague pela cobrança nova, pelo link que chegou com ela ou em [Financeiro](/financeiro).",
              },
              {
                term: "“Fatura cancelada”",
                text: "A página diz “Esta cobrança foi cancelada pela Anuntech.” e “Não é necessário pagar esta fatura.”: a Anuntech cancelou a cobrança ou encerrou o valor sem pedir um novo pagamento. Não há nada a pagar por este link.",
              },
              {
                term: "“Este link não abre nenhuma fatura”",
                text: "O link foi desativado, trocado por um novo ou chegou incompleto. Clique em “Falar com a Anuntech no WhatsApp” na própria página, ou abra a fatura em [Financeiro](/financeiro).",
              },
            ],
          },
          {
            kind: "note",
            tone: "info",
            text: "A página de pagamento é do próprio Console da Anuntech, em console.anuntech.com, e mostra o selo “Página oficial da Anuntech” no topo (no celular, “Página oficial”). Ela não pede login nem senha, e não mostra o CNPJ ou CPF nem o e-mail da sua empresa.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Paguei. Em quanto tempo a fatura aparece como Paga?",
        a: "Depende de quando o Banco Inter registra o pagamento: no Pix, a página indica poucos minutos; no boleto, indica compensação em até 3 dias úteis. Depois disso, o Console consulta o banco a cada 5 minutos e muda a fatura para Paga. A página de pagamento se atualiza sozinha; a página da fatura no Console precisa ser recarregada.",
      },
      {
        q: "Onde está o QR Code do Pix?",
        a: "Na página de pagamento. Abra pelo botão “Pagar” da Visão geral, pelo “...” da fatura em Financeiro (“Abrir página de pagamento”) ou pelo “Pagar agora” do e-mail. A página da fatura no Console tem o código Pix para copiar, sem o QR Code.",
      },
      {
        q: "Posso pagar depois do vencimento?",
        a: "Sim. Os mesmos boleto e Pix continuam valendo depois do vencimento até o prazo do banco, com multa e juros se a fatura tiver. Veja [Desconto, multa, juros e atraso](/ajuda/atraso-multa-e-juros).",
      },
      {
        q: "O Console gera recibo do pagamento?",
        a: "Não. A confirmação fica na fatura (“Pagamento confirmado pelo Inter.”) e na página de pagamento (“Pagamento confirmado”). Use o comprovante do seu banco e, para fins fiscais, a nota fiscal.",
      },
      {
        q: "Paguei por transferência, fora do boleto e do Pix. O que faço?",
        a: "Esse pagamento não chega ao Console sozinho. [Abra um chamado](/chamados/novo) com o comprovante para a equipe conferir. Quando a equipe confirma o recebimento, a fatura muda para Paga e os lembretes param. Até lá, a fatura continua em aberto e os lembretes podem continuar chegando.",
      },
      {
        q: "Recebi um lembrete depois de pagar. Preciso fazer algo?",
        a: "Antes de cada aviso o Console consulta o banco, mas o boleto pode levar alguns dias úteis para compensar. Se você pagou há pouco, aguarde a confirmação. Se a fatura não mudar para Paga depois disso, abra um chamado com o comprovante.",
      },
    ],
    actions: [
      { label: "Ir para Financeiro", href: "/financeiro" },
      { label: "Ir para a Visão geral", href: "/painel" },
    ],
    related: ["faturas", "link-de-pagamento", "atraso-multa-e-juros", "nota-fiscal"],
    updatedAt: "2026-10-14",
  },
  {
    slug: "link-de-pagamento",
    category: "financeiro",
    title: "Mandar o link de pagamento para outra pessoa",
    summary: "Como copiar o link de uma fatura para que outra pessoa pague por Pix ou boleto, sem entrar no Console.",
    audience: "administrador",
    keywords: [
      "link de pagamento",
      "compartilhar fatura",
      "enviar fatura",
      "mandar boleto",
      "mandar pix",
      "contador",
      "financeiro terceirizado",
      "pagar sem login",
      "copiar link",
      "link da fatura",
      "enviar por whatsapp",
    ],
    sections: [
      {
        title: "Para que serve",
        blocks: [
          {
            kind: "p",
            text: "Cada fatura emitida tem um link próprio, que abre a página de pagamento. Quem recebe o link paga por Pix ou boleto sem conta no Console. É o caminho quando as contas são pagas pelo contador, por um financeiro terceirizado ou por alguém da empresa que não usa o Console.",
          },
          {
            kind: "p",
            text: "A página mostra só a descrição da fatura, o nome da empresa, o valor, as datas, as condições de desconto, multa e juros, quando houver, e as formas de pagar. O CNPJ ou CPF e o e-mail da empresa não aparecem.",
          },
        ],
      },
      {
        title: "Quem pode copiar o link",
        blocks: [
          {
            kind: "p",
            text: "O Administrador da empresa, em Financeiro. O Membro não vê as faturas: se precisar pagar uma, ele pede o link a um Administrador.",
          },
        ],
      },
      {
        title: "Copiar e enviar",
        blocks: [
          {
            kind: "steps",
            items: [
              "No menu do Console, clique em “Financeiro”.",
              "Na linha da fatura, clique no botão de três pontos (“...”).",
              "Escolha “Copiar link de pagamento”. Aparece “Link de pagamento copiado.”",
              "Cole o link no e-mail ou na conversa de WhatsApp com quem vai pagar.",
            ],
          },
          {
            kind: "p",
            text: "Se aparecer “Não foi possível copiar.”, escolha “Abrir página de pagamento” no mesmo menu e copie o endereço da barra do navegador. A página da fatura não mostra o link. O botão “Pagar” da Visão geral abre a mesma página de pagamento.",
          },
        ],
      },
      {
        title: "O que acontece com o link",
        blocks: [
          {
            kind: "list",
            items: [
              "“Copiar link de pagamento” aparece nas faturas em aberto, vencidas ou pagas, enquanto o link estiver ativo.",
              "Quando a equipe muda o valor, o vencimento ou as condições de uma fatura, o boleto e o Pix são emitidos de novo, mas o link continua o mesmo. Quem já tem o link vê sempre os códigos atuais.",
              "Depois do pagamento, o link mostra “Pagamento confirmado”. Se o banco encerrar o boleto e o Pix sem pagamento, ele mostra “Boleto e Pix vencidos”, e o valor continua em aberto. Se a Anuntech mandar uma nova cobrança no lugar, ele mostra “Cobrança substituída”. Se a Anuntech cancelar a cobrança, ele mostra “Fatura cancelada”.",
              "Só a equipe da Anuntech desativa um link. Desativado, ele mostra “Este link não abre nenhuma fatura”, e a cobrança no banco continua a mesma.",
            ],
          },
          {
            kind: "note",
            tone: "attention",
            text: "Quem tem o link vê a descrição, o nome da empresa e o valor da fatura. Mande o link só para quem vai pagar. Se ele foi parar com quem não devia, peça à equipe para desativar, por um [chamado](/chamados/novo).",
          },
          {
            kind: "p",
            text: "Para que alguém receba os avisos de cobrança sem você precisar mandar o link a cada fatura, inclua essa pessoa nos contatos do quadro “Financeiro”, em [Notificações](/configuracoes/notificacoes). Ela passa a receber o e-mail ou o WhatsApp com o link, sem ganhar acesso ao Console. Veja [Avisos de cobrança](/ajuda/avisos-de-cobranca).",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Quem recebe o link precisa ter conta no Console?",
        a: "Não. A página de pagamento abre sem login.",
      },
      {
        q: "O link mostra dados da minha empresa?",
        a: "Só o nome da empresa, a descrição, o valor, as datas e as condições da fatura. O CNPJ ou CPF e o e-mail da empresa não aparecem.",
      },
      {
        q: "O link diz “Este link não abre nenhuma fatura”. E agora?",
        a: "O link pode ter sido desativado, trocado por um novo ou chegado incompleto. Clique em “Falar com a Anuntech no WhatsApp” na própria página, ou mande mensagem para o WhatsApp (11) 5107-3435. Se o link ainda estiver ativo, um Administrador da empresa encontra a fatura em Financeiro e copia o link de novo.",
      },
      {
        q: "Se a equipe mudar o valor ou o vencimento, preciso mandar outro link?",
        a: "Não. O link continua o mesmo e passa a mostrar o boleto e o Pix novos. Os códigos copiados antes deixam de valer.",
      },
      {
        q: "Posso desativar um link?",
        a: "Pelo Console, não. Só a equipe da Anuntech desativa. Peça por um chamado.",
      },
      {
        q: "Não acho “Copiar link de pagamento” na página da fatura.",
        a: "Ele fica no menu “...” da linha da fatura, na lista do Financeiro. A página da fatura mostra os códigos para pagar, sem o link.",
      },
    ],
    actions: [
      { label: "Ir para Financeiro", href: "/financeiro" },
      { label: "Ir para Notificações", href: "/configuracoes/notificacoes" },
    ],
    related: ["pagar-uma-fatura", "avisos-de-cobranca", "notificacoes", "faturas"],
    updatedAt: "2026-10-14",
  },
  {
    slug: "recorrencias",
    category: "financeiro",
    title: "Próximas cobranças e recorrências",
    summary: "Como funcionam as cobranças periódicas da sua empresa, quando cada fatura sai e onde ver a próxima antes de ela ser emitida.",
    audience: "administrador",
    keywords: [
      "recorrência",
      "recorrencia",
      "mensalidade",
      "cobrança mensal",
      "cobranca anual",
      "próxima cobrança",
      "proxima fatura",
      "quando vence",
      "dia do vencimento",
      "fatura do mes",
      "boleto do mes",
      "cobrança automática",
    ],
    sections: [
      {
        title: "O que é uma recorrência",
        blocks: [
          {
            kind: "p",
            text: "Recorrência é uma cobrança que se repete, mensal ou anual, por um produto ou serviço contínuo, como suporte, hospedagem ou um sistema. A equipe da Anuntech cria cada recorrência com o valor, o dia do vencimento e as condições de pagamento. A cada período, o Console emite uma fatura nova, que aparece em Financeiro com “Recorrência mensal” ou “Recorrência anual”.",
          },
        ],
      },
      {
        title: "Onde ver a próxima cobrança",
        blocks: [
          {
            kind: "list",
            items: [
              "Em [Financeiro](/financeiro), o quadro “Próximas cobranças” lista cada recorrência ativa com a descrição, o valor, o vencimento e a data até a qual chegam o boleto e o Pix (“Boleto e Pix chegam até”). Quando a recorrência já tem fatura emitida, clique na descrição para abrir a mais recente. Com mais de 4 recorrências, use “Ver mais”.",
              "O quadro aparece na lista com a situação em “Todas”, sem busca e na primeira página. Se você clicou em outro cartão ou buscou algo, volte para “Todas”.",
              "Na página de uma fatura recorrente, “Próxima cobrança” mostra o valor e o vencimento da seguinte, ou o link para ela quando já foi emitida.",
              "Na [Visão geral](/painel), quando não há nada em aberto, o quadro “A pagar” mostra “Nada a pagar agora” com o valor e o vencimento da próxima cobrança e quando chegam o boleto e o Pix.",
            ],
          },
        ],
      },
      {
        title: "Quando cada fatura sai",
        blocks: [
          {
            kind: "list",
            items: [
              "Cada período é emitido 5 dias antes do vencimento. Nesse dia, o boleto e o Pix ficam prontos e o aviso “Nova fatura” sai por e-mail e WhatsApp, a partir das 8h, no horário de Brasília.",
              "Nas recorrências mensais, o período seguinte normalmente sai antes: logo depois que o pagamento do atual é confirmado, desde que o próximo vencimento esteja a até 45 dias. Assim você pode pagar quando quiser. O aviso “Nova fatura” continua chegando 5 dias antes do vencimento.",
              "A emissão antecipada não acontece quando há outra fatura em aberto na mesma recorrência ou quando o produto ou serviço ligado a ela não está ativo. Nesses casos, vale o calendário de 5 dias.",
              "Nas recorrências anuais, a fatura sai sempre 5 dias antes do vencimento.",
              "O dia do vencimento se mantém de um período para o outro. Num mês mais curto, vale o último dia do mês.",
              "Se o vencimento cai num dia sem expediente bancário, o banco pode movê-lo, e o Console mostra a data do banco.",
            ],
          },
          {
            kind: "note",
            tone: "info",
            text: "Se o boleto do mês seguinte aparecer no DDA do seu banco logo depois de você pagar o atual, ele é o próximo período, com o vencimento dele.",
          },
        ],
      },
      {
        title: "O que só a equipe faz",
        blocks: [
          {
            kind: "p",
            text: "Criar uma recorrência, mudar o valor, o dia do vencimento ou as condições das próximas cobranças, pausar e retomar são ações da equipe da Anuntech. Para pedir qualquer uma delas, [abra um chamado](/chamados/novo).",
          },
          {
            kind: "p",
            text: "Uma recorrência pausada não emite faturas e sai do quadro “Próximas cobranças”.",
          },
          {
            kind: "note",
            tone: "attention",
            text: "Sem o endereço de cobrança completo em [Dados da empresa](/configuracoes/empresa), o banco não emite a fatura e a recorrência fica pausada. Enquanto faltar o endereço, a Visão geral mostra ao Administrador o passo “Complete o endereço de cobrança da empresa”. Depois que o cadastro é corrigido, a recorrência volta quando a equipe a retoma. O mesmo vale para uma razão social com mais de 100 caracteres ou qualquer outro dado que o banco recuse: a recorrência fica pausada até a equipe corrigir e retomar. Nesses casos, a Visão geral não mostra o passo. Veja [Dados de cobrança da empresa](/ajuda/dados-de-cobranca).",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Paguei e apareceu outra fatura em aberto. Está certo?",
        a: "Sim, nas recorrências mensais. Quando o pagamento é confirmado, o Console já emite o período seguinte, se o vencimento dele estiver a até 45 dias, para você pagar quando quiser. O aviso “Nova fatura” dessa fatura chega 5 dias antes do vencimento, a partir das 8h.",
      },
      {
        q: "Quando chega o boleto do próximo mês?",
        a: "Até 5 dias antes do vencimento. A data aparece em “Próximas cobranças”, no Financeiro, na linha “Boleto e Pix chegam até”.",
      },
      {
        q: "Uma recorrência não aparece em Próximas cobranças. Por quê?",
        a: "O quadro só aparece com a situação em “Todas”, sem busca e na primeira página da lista. Se mesmo assim ela não aparece, a recorrência pode estar pausada. Pergunte à equipe por um chamado.",
      },
      {
        q: "Quero mudar o dia do vencimento ou o valor.",
        a: "Peça à equipe da Anuntech por um chamado. Só a equipe muda as próximas cobranças de uma recorrência.",
      },
      {
        q: "Como encerro uma recorrência?",
        a: "Abra um chamado pedindo o encerramento. Só a equipe da Anuntech pausa ou encerra uma recorrência.",
      },
      {
        q: "O vencimento mudou para outro dia. Por quê?",
        a: "O banco pode mover um vencimento que cai em dia sem expediente bancário, e o Console adota a data do banco.",
      },
    ],
    actions: [{ label: "Ir para Financeiro", href: "/financeiro" }],
    related: ["faturas", "pagar-uma-fatura", "avisos-de-cobranca", "dados-de-cobranca"],
    updatedAt: "2026-10-14",
  },
  {
    slug: "atraso-multa-e-juros",
    category: "financeiro",
    title: "Desconto, multa, juros e atraso",
    summary: "O que muda no valor antes e depois do vencimento, até quando dá para pagar uma fatura vencida e o que acontece com o atraso.",
    audience: "administrador",
    keywords: [
      "atraso",
      "fatura atrasada",
      "fatura vencida",
      "boleto vencido",
      "multa",
      "juros",
      "desconto",
      "encargos",
      "pagar depois do vencimento",
      "suspensão",
      "suspensao",
      "serviço suspenso",
      "prazo para pagar",
      "outra data",
      "renegociar",
    ],
    sections: [
      {
        title: "Onde ver as condições da fatura",
        blocks: [
          {
            kind: "p",
            text: "A equipe da Anuntech define as condições de cada cobrança. Elas aparecem em “Condições”, no quadro “Cobrança” da fatura, e na página de pagamento, logo abaixo do valor. Se a fatura não mostra “Condições”, ela não tem desconto, multa nem juros.",
          },
          {
            kind: "pairs",
            items: [
              {
                term: "Desconto",
                text: "Um valor fixo que vale até o vencimento. A fatura mostra o desconto e quanto fica pagando em dia; a página de pagamento mostra “Pagando até” a data do vencimento, com o valor já com desconto. Depois do vencimento, o desconto deixa de valer.",
              },
              {
                term: "Multa e juros",
                text: "Depois do vencimento, a fatura pode ter multa, um percentual do valor, e juros ao mês. Eles aparecem como “Após o vencimento: multa de X% e juros de Y% ao mês”. O próprio banco calcula os dois na hora do pagamento.",
              },
            ],
          },
          {
            kind: "note",
            tone: "info",
            text: "O Console mostra sempre o valor original da fatura, também nos e-mails de atraso, onde ele aparece como “Valor atualizado”. Multa e juros entram só no pagamento, calculados pelo banco.",
          },
          {
            kind: "p",
            text: "Nas recorrências, cada fatura nova sai com as condições da recorrência.",
          },
        ],
      },
      {
        title: "Quando a fatura vence",
        blocks: [
          {
            kind: "p",
            text: "A fatura vence no fim do dia do vencimento, no horário de Brasília. No dia seguinte, ela passa a “Vencida”, com os dias de atraso em vermelho, e aparece primeiro no quadro “A pagar” da [Visão geral](/painel), com a etiqueta “Vencida”.",
          },
        ],
      },
      {
        title: "Até quando dá para pagar",
        blocks: [
          {
            kind: "list",
            items: [
              "Depois do vencimento, os mesmos boleto e Pix continuam valendo, com multa e juros se a fatura tiver. A página de pagamento avisa: “O vencimento passou, mas o boleto e o Pix continuam válidos para pagamento.”",
              "Eles valem até um prazo que a equipe da Anuntech define no banco para cada cobrança. Esse prazo não aparece na fatura nem na página de pagamento. Se precisar dele, pergunte à equipe.",
              "Passado o prazo, o banco encerra o boleto e o Pix e a fatura sai da sua lista. A página de pagamento passa a dizer “O prazo do boleto e do Pix acabou sem pagamento.”, com o quadro “Boleto e Pix vencidos”: o valor continua em aberto. Fale com a Anuntech para receber uma nova forma de pagamento.",
              "A equipe da Anuntech pode então enviar uma nova cobrança. Ela já aparece como “Vencida”, com a data até a qual o novo boleto e o novo Pix valem (“Boleto e Pix válidos até”, na fatura, e “Pague até”, na página de pagamento). O link antigo passa a dizer “Esta cobrança foi substituída por uma nova.” e pede para usar o link que chegou com a nova.",
            ],
          },
        ],
      },
      {
        title: "Lembretes e contato da equipe",
        blocks: [
          {
            kind: "p",
            text: "Por e-mail e WhatsApp, chegam o aviso “Vence hoje” no dia do vencimento e lembretes aos 5, 10, 15, 20 e 25 dias de atraso, sempre a partir das 8h. Eles param assim que o pagamento é confirmado ou o banco encerra a cobrança. Depois do 25º dia, os lembretes automáticos acabam, e a equipe da Anuntech acompanha o atraso e pode entrar em contato. Veja [Avisos de cobrança](/ajuda/avisos-de-cobranca).",
          },
          {
            kind: "note",
            tone: "attention",
            text: "Se você precisa de outra data para pagar, fale com a equipe o quanto antes: por um [chamado](/chamados/novo), em “Conversar com a equipe”, no menu da conta, ou pelo WhatsApp (11) 5107-3435.",
          },
        ],
      },
      {
        title: "Suspensão do serviço",
        blocks: [
          {
            kind: "p",
            text: "A suspensão só existe se as condições do contrato da sua empresa preverem. A regra fica em [Como trabalhamos](/como-trabalhamos), na seção “O que ajuda a equipe”, no quadro “O que o seu contrato pede”, na linha que começa com “Pague em dia.”: ela diz com quantos dias de atraso o serviço pode ser suspenso e se há um aviso antes.",
          },
          {
            kind: "p",
            text: "Só a equipe da Anuntech decide uma suspensão, seguindo essas condições. Se a linha não aparece em Como trabalhamos e você tiver dúvida, pergunte à equipe por um [chamado](/chamados/novo).",
          },
          {
            kind: "list",
            items: [
              "Quando as condições pedem aviso, os Administradores e os contatos de cobrança recebem antes um e-mail “Aviso de suspensão”, com a data, as faturas vencidas e o link para pagar. Se o pagamento for confirmado antes da data, a suspensão é cancelada sozinha.",
              "No dia, a equipe confirma a suspensão e chega o e-mail “Serviço suspenso”. Em [Produtos e serviços](/produtos), o item aparece como “Suspenso”, com uma faixa no topo da página, os botões “Pagar agora” e “Falar com a equipe”, e a [Visão geral](/painel) mostra o aviso em “Precisa de atenção”.",
              "Suspensão não apaga nada. Um produto que abre pelo Console deixa de abrir (o site público continua no ar); numa aplicação hospedada ou num e-mail, a equipe bloqueia o acesso sem apagar dados, e a caixa de e-mail continua recebendo mensagens.",
              "O Console e os chamados continuam funcionando durante a suspensão, e a cobrança mensal continua como no contrato.",
              "Depois que o pagamento de todas as faturas vencidas é confirmado, a equipe reativa o serviço e chega o e-mail “Serviço reativado”.",
            ],
          },
          {
            kind: "p",
            text: "O Membro também lê essa regra em Como trabalhamos, mas só o Administrador vê as faturas.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Quanto pago se pagar com atraso?",
        a: "O valor da fatura mais a multa e os juros que ela tiver, calculados pelo banco no pagamento. O Console e os avisos mostram o valor original. Se a fatura não tem “Condições”, não há multa nem juros.",
      },
      {
        q: "Perco o desconto se pagar depois do vencimento?",
        a: "Sim. O desconto vale só até o vencimento.",
      },
      {
        q: "Até quando posso pagar um boleto vencido?",
        a: "Até o prazo que a equipe definiu no banco para aquela cobrança. Ele não aparece na fatura: pergunte à equipe por um chamado. Depois dele, o banco encerra o boleto e o Pix, e a equipe pode enviar uma nova cobrança com uma nova data para pagar.",
      },
      {
        q: "O serviço é suspenso se eu atrasar?",
        a: "Só se as condições do seu contrato preverem, com o número de dias que aparece em Como trabalhamos, no quadro “O que o seu contrato pede”. Quem decide é a equipe da Anuntech.",
      },
      {
        q: "Meu produto aparece como “Suspenso”. Como volto a usar?",
        a: "Pague as faturas vencidas em Financeiro (o botão “Pagar agora”, em Produtos e serviços, leva até elas). Assim que o banco confirma o pagamento, a equipe reativa o serviço e você recebe um e-mail. Nenhum dado foi apagado. Se a suspensão não for por atraso, ou se já pagou, fale com a equipe por um chamado.",
      },
      {
        q: "A página de pagamento não mostra mais o boleto e o Pix. Preciso pagar?",
        a: "Depende do que ela diz. “Boleto e Pix vencidos”: o prazo do banco acabou sem pagamento e o valor continua em aberto. Fale com a Anuntech para receber uma nova forma de pagamento. “Cobrança substituída”: a Anuntech mandou uma nova cobrança no lugar, e você paga por ela. “Fatura cancelada”, com “Não é necessário pagar esta fatura.”: a Anuntech cancelou a cobrança e não há nada a pagar por ela.",
      },
      {
        q: "O e-mail de atraso mostra o valor com multa e juros?",
        a: "Não. Mesmo com o rótulo “Valor atualizado”, ele mostra o valor da fatura. Multa e juros são calculados pelo banco na hora do pagamento.",
      },
      {
        q: "Posso combinar outra data?",
        a: "Fale com a equipe da Anuntech por um chamado, em “Conversar com a equipe” ou pelo WhatsApp (11) 5107-3435. Os e-mails de cobrança também trazem o link “Fale com a nossa equipe”.",
      },
    ],
    actions: [
      { label: "Ir para Financeiro", href: "/financeiro" },
      { label: "Ver Como trabalhamos", href: "/como-trabalhamos" },
    ],
    related: ["pagar-uma-fatura", "avisos-de-cobranca", "como-trabalhamos", "faturas"],
    updatedAt: "2026-10-20",
  },
  {
    slug: "nota-fiscal",
    category: "financeiro",
    title: "Nota fiscal",
    summary: "Onde ver a nota fiscal de uma fatura, o que cada aviso do quadro quer dizer e o que fazer quando a nota não aparece.",
    audience: "administrador",
    keywords: [
      "nota fiscal",
      "nfs-e",
      "nfse",
      "nf",
      "nota de serviço",
      "nota de servico",
      "documento fiscal",
      "emitir nota",
      "baixar nota",
      "segunda via da nota",
      "recibo",
      "comprovante",
    ],
    sections: [
      {
        title: "Onde fica",
        blocks: [
          {
            kind: "p",
            text: "Na página de cada fatura, no quadro “Nota fiscal” (“Documento fiscal desta cobrança.”). Abra a fatura em [Financeiro](/financeiro). Só o Administrador da empresa vê as faturas e as notas; um Membro que precisa de uma nota pede a um Administrador.",
          },
        ],
      },
      {
        title: "O que o quadro quer dizer",
        blocks: [
          {
            kind: "pairs",
            items: [
              {
                term: "“Nota fiscal emitida.”",
                text: "A nota foi emitida e registrada na fatura. Quando a equipe registra o link da nota, aparece “Abrir a nota”: clique para abrir.",
              },
              {
                term: "“Emissão ainda não solicitada.”",
                text: "Ainda não há nota registrada nesta fatura. É o que aparece antes do pagamento e enquanto a equipe não registra a nota.",
              },
              {
                term: "“Emissão em andamento com a equipe da Anuntech.”",
                text: "A equipe está cuidando da emissão desta nota.",
              },
            ],
          },
        ],
      },
      {
        title: "Como a nota é emitida hoje",
        blocks: [
          {
            kind: "list",
            items: [
              "A nota é emitida depois que o pagamento é confirmado: a fatura precisa estar “Paga”.",
              "A equipe da Anuntech emite a nota fora do Console, para as empresas que têm a emissão de nota fiscal ativada no cadastro. Só a equipe liga essa opção.",
              "Emitida a nota, a equipe registra na fatura o número ou o link dela. O número fica só com a equipe; o link aparece para você em “Abrir a nota”.",
              "A nota usa a razão social, o CNPJ ou CPF e o endereço de cobrança e nota fiscal de [Dados da empresa](/configuracoes/empresa). Mantenha esses dados atualizados.",
            ],
          },
          {
            kind: "p",
            text: "Se a sua empresa precisa de nota e o quadro continua em “Emissão ainda não solicitada.” depois do pagamento, [abra um chamado](/chamados/novo) com o nome da fatura.",
          },
        ],
      },
      {
        title: "Recibo e comprovante",
        blocks: [
          {
            kind: "p",
            text: "O Console não gera recibo. A confirmação do pagamento fica na fatura (“Pagamento confirmado pelo Inter.”), o comprovante é o do banco em que você pagou e o documento fiscal é a nota.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Onde fica a nota fiscal?",
        a: "Na página da fatura, no quadro “Nota fiscal”. Quando a equipe registra o link, aparece “Abrir a nota”.",
      },
      {
        q: "Quando a nota é emitida?",
        a: "Depois que o pagamento da fatura é confirmado. A equipe da Anuntech emite a nota e registra na fatura.",
      },
      {
        q: "O quadro diz “Nota fiscal emitida.”, mas não tem link. Como consigo a nota?",
        a: "A equipe registrou a nota sem o link. [Abra um chamado](/chamados/novo) pedindo o arquivo.",
      },
      {
        q: "Minha empresa precisa de nota e ela não apareceu.",
        a: "Abra um chamado com o nome da fatura. A emissão depende de a opção de nota fiscal estar ativada no cadastro da sua empresa, o que só a equipe faz.",
      },
      {
        q: "Os dados da nota saíram errados. O que faço?",
        a: "Confira a razão social, o CNPJ ou CPF e o endereço em [Dados da empresa](/configuracoes/empresa) e corrija o que for preciso. Para uma nota já emitida, abra um chamado.",
      },
      {
        q: "O Console gera recibo do pagamento?",
        a: "Não. Use o comprovante do banco e, para fins fiscais, a nota fiscal.",
      },
    ],
    actions: [
      { label: "Ir para Financeiro", href: "/financeiro" },
      { label: "Abrir um chamado", href: "/chamados/novo" },
    ],
    related: ["faturas", "dados-de-cobranca", "pagar-uma-fatura", "abrir-um-chamado"],
    updatedAt: "2026-10-14",
  },
  {
    slug: "avisos-de-cobranca",
    category: "financeiro",
    title: "Avisos de cobrança",
    summary: "Quais e-mails e mensagens de WhatsApp a Anuntech envia sobre cada fatura, em que horário, para quem e como mudar quem recebe.",
    audience: "administrador",
    keywords: [
      "aviso de cobrança",
      "aviso de cobranca",
      "lembrete",
      "e-mail de cobrança",
      "whatsapp",
      "nova fatura",
      "vence hoje",
      "fatura em aberto",
      "quem recebe",
      "contato financeiro",
      "contador",
      "parar de receber",
      "notificação",
      "notificacao",
    ],
    sections: [
      {
        title: "Quais avisos saem",
        blocks: [
          {
            kind: "pairs",
            items: [
              {
                term: "Nova fatura",
                text: "Quando o boleto e o Pix ficam prontos. Nas recorrências, 5 dias antes do vencimento. Assunto do e-mail: “Anuntech | Nova fatura · <descrição>”.",
              },
              {
                term: "Vence hoje",
                text: "No dia do vencimento. Assunto: “Anuntech | Vence hoje · <descrição>”.",
              },
              {
                term: "Fatura em aberto",
                text: "Aos 5, 10, 15, 20 e 25 dias de atraso, dizendo há quantos dias a fatura está em aberto. Assunto: “Anuntech | Fatura em aberto · <descrição>”.",
              },
            ],
          },
          {
            kind: "p",
            text: "O e-mail chega de “Anuntech · Financeiro”, traz o produto ou serviço, o valor e o vencimento, e o botão “Pagar agora”, que abre a página de pagamento sem login. O próprio e-mail diz em qual endereço o botão abre a fatura.",
          },
          {
            kind: "p",
            text: "O WhatsApp sai do número (11) 5107-3435 e traz o nome da empresa, o produto ou serviço, o valor e o link para pagar. A “Nova fatura” traz também o vencimento, e os lembretes trazem os dias de atraso.",
          },
        ],
      },
      {
        title: "Quando saem e quando param",
        blocks: [
          {
            kind: "list",
            items: [
              "Os avisos automáticos saem a partir das 8h, no horário de Brasília. O que fica pronto de madrugada espera a manhã.",
              "Antes de cada aviso, o Console consulta o banco. Se a fatura já foi paga ou cancelada, o aviso não sai.",
              "Os lembretes vão até o 25º dia de atraso, enquanto o banco não encerra a cobrança. Depois disso, a equipe da Anuntech acompanha o atraso diretamente.",
              "Nas recorrências, os avisos saem sempre. Numa cobrança única, a equipe decide se a empresa recebe o aviso “Nova fatura”. Sem esse primeiro aviso, os lembretes daquela fatura também não saem.",
              "Os avisos também param se a equipe desativa o link de pagamento da fatura ou se o canal ou o contato é retirado em Notificações.",
            ],
          },
        ],
      },
      {
        title: "Quem recebe",
        blocks: [
          {
            kind: "p",
            text: "Os contatos do quadro “Financeiro”, em [Notificações](/configuracoes/notificacoes). Cada contato recebe a sua própria mensagem, e ninguém precisa ter acesso ao Console para receber: dá para incluir o contador, por exemplo.",
          },
          {
            kind: "p",
            text: "Enquanto esse quadro nunca foi salvo, os avisos vão para o “E-mail” e o “Telefone” de [Dados da empresa](/configuracoes/empresa), pelos dois canais.",
          },
          {
            kind: "p",
            text: "O WhatsApp vai para números do Brasil, com DDD. Cadastre um número que tenha WhatsApp.",
          },
        ],
      },
      {
        title: "Mudar quem recebe",
        blocks: [
          {
            kind: "p",
            text: "Só o Administrador da empresa muda os contatos. O Membro pede a um Administrador.",
          },
          {
            kind: "steps",
            items: [
              "Abra o menu da conta, com a sua foto, no fim do menu do Console, e clique em “Meu perfil”. No celular, toque em “Mais” e depois em “Meu perfil”.",
              "Em “Empresa”, abra “Notificações”.",
              "No quadro “Financeiro” (“Novas cobranças, vencimentos e lembretes.”), preencha os “E-mails” e os “Telefones”. Use “Adicionar e-mail” e “Adicionar telefone” para mais contatos, até 10 de cada, e o “x” ao lado de um contato para removê-lo.",
              "Em “Receber por”, marque “E-mail”, “WhatsApp” ou os dois.",
              "Clique em “Salvar”. Aparece “Preferências de notificações atualizadas.”, e a mudança vale para os próximos envios.",
            ],
          },
          {
            kind: "note",
            tone: "attention",
            text: "Depois que o quadro “Financeiro” foi salvo uma vez, mudar o e-mail ou o telefone em Dados da empresa não muda quem recebe os avisos. Atualize os dois lugares.",
          },
          {
            kind: "p",
            text: "Mais detalhes desta página em [Quem recebe os avisos](/ajuda/notificacoes).",
          },
        ],
      },
      {
        title: "Conferir o que foi enviado",
        blocks: [
          {
            kind: "p",
            text: "Na mesma página, “Histórico de envios” lista os avisos de cobrança e de chamados, com o destinatário, o canal, a situação e a data, 20 por página. Os de cobrança aparecem com “Financeiro” embaixo da descrição da fatura.",
          },
          {
            kind: "pairs",
            items: [
              { term: "“Entregue”", text: "O aviso chegou ao destinatário." },
              { term: "“Falhou”", text: "O aviso não chegou. O motivo aparece embaixo da situação." },
              {
                term: "“Não enviado”",
                text: "O envio foi interrompido antes de sair: o canal estava desligado ou sem contato, o contato saiu da lista, ou a fatura já estava paga ou cancelada.",
              },
            ],
          },
          {
            kind: "p",
            text: "As outras situações estão em [Quem recebe os avisos](/ajuda/notificacoes).",
          },
          {
            kind: "note",
            tone: "attention",
            text: "Se um endereço de e-mail devolveu um aviso ou o marcou como spam, os próximos avisos para ele não são enviados e aparecem como “Falhou”. Confira o endereço em Notificações e, se precisar, use outro.",
          },
          {
            kind: "p",
            text: "O resumo semanal que os Administradores recebem por e-mail às segundas, quando houve movimento em chamados ou tarefas, também cita a próxima fatura ou a que está em aberto.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Quando chegam os avisos de cobrança?",
        a: "“Nova fatura” quando o boleto e o Pix ficam prontos (nas recorrências, 5 dias antes do vencimento), “Vence hoje” no dia do vencimento e lembretes aos 5, 10, 15, 20 e 25 dias de atraso. Os automáticos saem a partir das 8h, no horário de Brasília, e param quando o banco confirma o pagamento.",
      },
      {
        q: "Como mudo quem recebe os avisos?",
        a: "No menu da conta, clique em “Meu perfil”, abra “Notificações” em “Empresa” e ajuste os e-mails e telefones do quadro “Financeiro”, até 10 de cada. Marque os canais em “Receber por” e clique em “Salvar”. A mudança vale para os próximos envios.",
      },
      {
        q: "Mudei o e-mail em Dados da empresa, mas os avisos continuam indo para o endereço antigo. Por quê?",
        a: "Depois que o quadro “Financeiro” de Notificações foi salvo uma vez, os avisos seguem a lista de lá. Atualize o e-mail também em [Notificações](/configuracoes/notificacoes).",
      },
      {
        q: "Já paguei e recebi um lembrete. Por quê?",
        a: "Antes de cada aviso o Console consulta o banco, mas o boleto pode levar alguns dias úteis para compensar. Enquanto o banco não confirma, a fatura continua em aberto. Se ela não mudar para Paga depois disso, ou se você pagou fora do boleto e do Pix, abra um chamado com o comprovante.",
      },
      {
        q: "O contador pode receber os avisos sem ter acesso ao Console?",
        a: "Sim. Inclua o e-mail ou o celular dele no quadro “Financeiro” de Notificações. Ele recebe o aviso com o link de pagamento e paga sem entrar no Console.",
      },
      {
        q: "Recebi um aviso de cobrança e não sei se é verdadeiro.",
        a: "Entre no Console e confira a fatura em Financeiro. O botão do e-mail abre a fatura em console.anuntech.com, o endereço do Console da Anuntech, numa página com o selo “Página oficial” no topo. Se ainda tiver dúvida, fale com a equipe pelo WhatsApp (11) 5107-3435.",
      },
    ],
    actions: [
      { label: "Ir para Notificações", href: "/configuracoes/notificacoes" },
      { label: "Ir para Financeiro", href: "/financeiro" },
    ],
    related: ["notificacoes", "link-de-pagamento", "atraso-multa-e-juros", "avisos-do-console"],
    updatedAt: "2026-10-14",
  },
  {
    slug: "dados-de-cobranca",
    category: "financeiro",
    title: "Dados de cobrança da empresa",
    summary: "Quais dados do cadastro vão para o boleto e para a nota fiscal, quem pode atualizar e o que acontece quando falta o endereço.",
    audience: "administrador",
    keywords: [
      "dados de cobrança",
      "dados de cobranca",
      "endereço de cobrança",
      "endereco",
      "cep",
      "cnpj",
      "cpf",
      "razão social",
      "razao social",
      "e-mail financeiro",
      "telefone",
      "cadastro da empresa",
      "pagador",
      "dados do boleto",
    ],
    sections: [
      {
        title: "Para que servem",
        blocks: [
          {
            kind: "p",
            text: "O cadastro da empresa no Console é o pagador de cada boleto e o destinatário da nota fiscal. Ele tem três partes:",
          },
          {
            kind: "list",
            items: [
              "Em “Identificação”, o “CNPJ” (ou CPF) e a “Razão social”.",
              "Em “Contato financeiro”, o “E-mail” e o “Telefone”. Eles recebem os avisos de cobrança enquanto o quadro “Financeiro” de Notificações nunca foi salvo.",
              "Em “Endereço de cobrança e nota fiscal”, o CEP, o endereço, o número, o complemento, o bairro, a cidade e a UF.",
            ],
          },
        ],
      },
      {
        title: "Quem pode atualizar",
        blocks: [
          {
            kind: "p",
            text: "O Administrador da empresa, em Dados da empresa. O Membro não vê esta página e pede a um Administrador.",
          },
        ],
      },
      {
        title: "Atualizar os dados",
        blocks: [
          {
            kind: "steps",
            items: [
              "Abra o menu da conta, com a sua foto, no fim do menu do Console, e clique em “Meu perfil”. No celular, toque em “Mais” e depois em “Meu perfil”.",
              "Em “Empresa”, abra “Dados da empresa”.",
              "Em “Identificação”, confira o “CNPJ” (o campo também aceita CPF) e a “Razão social”.",
              "Em “Contato financeiro”, preencha o “E-mail” e o “Telefone”, com DDD.",
              "Em “Endereço de cobrança e nota fiscal”, digite os 8 dígitos do “CEP”: o endereço se preenche sozinho. Complete o “Número” e, se houver, o “Complemento”, e confira “Endereço”, “Bairro”, “Cidade” e “UF”.",
              "Clique em “Salvar”. Aparece “Dados da empresa atualizados.”",
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
              "O endereço vai inteiro ou não vai: endereço, número, bairro, cidade, UF e um CEP com 8 dígitos. Se faltar algo, o Console não salva e pede para completar o endereço.",
              "Limites: endereço até 100 caracteres, número até 10, complemento até 30, bairro e cidade até 60.",
              "Para o banco, a razão social pode ter até 100 caracteres. O campo aceita mais, mas uma razão social maior impede a emissão das cobranças.",
              "O telefone precisa ter DDD, com 10 ou 11 dígitos. Para receber avisos por WhatsApp, use um número que tenha WhatsApp.",
              "A busca pelo CEP aceita até 20 consultas por hora. Passado isso, aparece “Muitas consultas na última hora. Preencha o endereço manualmente.”",
              "Quando a razão social, o CNPJ ou CPF, o e-mail, o telefone ou o endereço mudam, a equipe da Anuntech recebe um e-mail com os dados de antes e de depois.",
            ],
          },
          {
            kind: "note",
            tone: "attention",
            text: "Sem o endereço completo, o banco não emite boleto nem Pix. Uma recorrência que chega à data de emissão sem endereço fica pausada, e a Visão geral mostra ao Administrador o passo “Complete o endereço de cobrança da empresa” até o cadastro ser corrigido. Depois disso, a recorrência volta quando a equipe a retoma.",
          },
          {
            kind: "note",
            tone: "info",
            text: "O boleto e o Pix de uma fatura já emitida continuam com os dados de quando ela foi emitida. As próximas cobranças saem com o cadastro novo, inclusive com outro CNPJ ou CPF, se ele mudou.",
          },
          {
            kind: "p",
            text: "“Buscar na Receita”, que preenche o cadastro pelo CNPJ, e a opção de emitir nota fiscal são usados só pela equipe da Anuntech. A página completa está explicada em [Dados da empresa](/ajuda/dados-da-empresa).",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Por que o endereço é obrigatório?",
        a: "Sem o endereço completo do pagador, o banco não emite o boleto e o Pix. Ele também é o endereço da nota fiscal.",
      },
      {
        q: "Digitei o CEP e o endereço não apareceu.",
        a: "Confira se o CEP tem 8 dígitos. Se a consulta falhar ou passar de 20 consultas na hora, preencha o endereço à mão.",
      },
      {
        q: "Mudei os dados. O que acontece com as faturas já emitidas?",
        a: "O boleto e o Pix delas continuam com os dados antigos. As próximas saem com os dados novos. Se uma fatura em aberto precisa sair com outro pagador, abra um chamado.",
      },
      {
        q: "Mudei o e-mail financeiro, mas os avisos continuam indo para o endereço antigo.",
        a: "Depois que o quadro “Financeiro” de Notificações foi salvo uma vez, os avisos seguem a lista de lá. Atualize o e-mail também em [Notificações](/configuracoes/notificacoes).",
      },
      {
        q: "Não consigo abrir Dados da empresa.",
        a: "A página é só dos Administradores. Se você é Membro, peça a um Administrador da sua empresa.",
      },
      {
        q: "A razão social da minha empresa é longa. Tem problema?",
        a: "O banco aceita até 100 caracteres. Com mais que isso, as cobranças não são emitidas: abra um chamado para a equipe da Anuntech ajustar o cadastro.",
      },
    ],
    actions: [{ label: "Ir para Dados da empresa", href: "/configuracoes/empresa" }],
    related: ["dados-da-empresa", "avisos-de-cobranca", "nota-fiscal", "recorrencias"],
    updatedAt: "2026-10-14",
  },
];
