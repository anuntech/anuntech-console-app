import type { HelpArticle } from "../help-model";

export const segurancaArticles: HelpArticle[] = [
  {
    slug: "seguranca-da-conta",
    category: "seguranca",
    title: "Segurança da conta e boas práticas",
    summary: "Como o Console protege o seu acesso e o que você e o Administrador da empresa podem fazer para manter a conta segura.",
    audience: "todos",
    keywords: [
      "seguranca",
      "conta segura",
      "proteger conta",
      "codigo de acesso",
      "senha",
      "golpe",
      "acesso suspeito",
      "invadiram minha conta",
      "hackeado",
      "sessoes",
      "duas etapas",
      "2fa",
      "celular perdido",
      "remover acesso",
      "boas praticas",
    ],
    sections: [
      {
        title: "Como o Console protege o seu acesso",
        blocks: [
          {
            kind: "p",
            text: "O Console não usa senha. Cada entrada é confirmada por um código de 6 números enviado ao seu e-mail ou ao WhatsApp vinculado à conta, ou pelo Google, com o mesmo e-mail de acesso. Assim não existe senha para esquecer, repetir em outros sites ou vazar.",
          },
          {
            kind: "list",
            items: [
              "Cada código de entrada vale 5 minutos, funciona uma vez só e aceita 3 tentativas. Depois disso, é preciso pedir outro.",
              "Um novo código só pode ser pedido depois de 60 segundos, e no máximo 5 vezes a cada 15 minutos para o mesmo e-mail ou número.",
              "A tela de entrada responde do mesmo jeito para qualquer e-mail, com ou sem acesso. Quem tenta adivinhar não descobre quem usa o Console.",
              "Com a [verificação em duas etapas](/ajuda/verificacao-em-duas-etapas) ligada, entrar pede um segundo código. Quem entra pelo e-mail confirma no WhatsApp, quem entra pelo WhatsApp confirma no e-mail e quem entra pelo Google confirma no canal escolhido em Segurança. Depois de 10 códigos errados seguidos nessa etapa, a entrada fica bloqueada por 15 minutos.",
              "A sessão dura 7 dias e se renova enquanto você usa o Console. Depois de 7 dias sem uso, é preciso entrar de novo.",
              "O Console confere o seu acesso no servidor a cada consulta e a cada ação. Um registro fora do seu acesso aparece como “Não encontramos esta página”, a mesma resposta de um endereço que não existe.",
              "Trocar o e-mail ou o WhatsApp de acesso exige ter entrado há menos de 10 minutos e confirmar por código. Com a verificação em duas etapas ligada, esses contatos ficam travados até você desligá-la.",
            ],
          },
        ],
      },
      {
        title: "Boas práticas para você",
        blocks: [
          {
            kind: "list",
            items: [
              "Não passe o código para ninguém. Ele só serve na tela do Console, e a equipe da Anuntech não precisa dele para atender você, porque tem o próprio acesso.",
              "Entre sempre com o seu próprio e-mail. Cada acesso é pessoal, e o que você faz fica registrado no seu nome.",
              "Ligue a verificação em duas etapas em [Segurança](/configuracoes/seguranca). Ela exige o WhatsApp vinculado em [Minha conta](/conta).",
              "Em computador compartilhado, saia ao terminar: abra o menu da conta (a sua foto ou avatar no fim do menu do Console) e clique em “Sair”. No celular, toque em “Mais” e, na seção “Conta”, em “Sair”.",
              "Confira de vez em quando as “Sessões recentes”, em Segurança, e veja se reconhece cada aparelho.",
              "Mantenha o WhatsApp da conta atualizado em Minha conta. Com a verificação em duas etapas ligada, faça a troca enquanto ainda recebe mensagens no número antigo, porque desligá-la pede um código nele.",
              "Não escreva nem fale senhas ou dados reais dos seus clientes em chamados, comentários ou no assistente. Se a equipe precisar de um acesso, ela combina com você um jeito seguro.",
              "Desconfie de mensagens que pedem código ou pagamento fora do Console. Veja como reconhecer os avisos verdadeiros em [E-mails e mensagens que o Console envia](/ajuda/avisos-do-console).",
            ],
          },
        ],
      },
      {
        title: "Boas práticas para o Administrador da empresa",
        blocks: [
          {
            kind: "p",
            text: "Na sua empresa, só os Administradores liberam e removem acessos. Um Membro que precisa incluir ou tirar alguém pede a um Administrador.",
          },
          {
            kind: "list",
            items: [
              "Dê acesso só a quem precisa e escolha o papel certo. Faturas, orçamentos e contratos ficam só com os Administradores. Um Membro pode ver só alguns produtos, serviços e projetos, em “O que esta pessoa vê”. Veja [Membro ou Administrador](/ajuda/membro-ou-administrador).",
              "Quando alguém sair da empresa, remova o acesso em [Membros](/configuracoes/membros): abra o menu da pessoa, escolha “Remover acesso” e confirme. A pessoa perde o acesso à empresa, e os registros do que ela fez são preservados.",
              "A remoção vale na hora, mesmo que a pessoa esteja com o Console aberto, porque o acesso é conferido a cada consulta.",
              "Um convite que não vai ser usado se cancela no mesmo menu, em “Cancelar convite”.",
              "Nos Primeiros passos da Visão geral aparece “Revise quem tem acesso ao Console”. Seis meses depois da última revisão, o lembrete volta, mesmo com o card escondido.",
              "Mantenha atualizados os contatos que recebem os avisos de cobrança e de chamados, em [Notificações](/ajuda/notificacoes).",
            ],
          },
        ],
      },
      {
        title: "Se você notar um acesso que não reconhece",
        blocks: [
          {
            kind: "steps",
            items: [
              "Abra o menu da conta, escolha “Meu perfil” e, no grupo “Conta”, clique em “Segurança”.",
              "Em “Sessões recentes”, veja o aparelho e a data de cada entrada. A sessão aberta diz “ativa até” e a data; o selo marca “Esta sessão”, “Expirada” ou “Encerrada”.",
              "Se houver uma sessão ativa que você não reconhece, ligue a verificação em duas etapas, ou troque o canal se ela já estiver ligada. Ao confirmar o código no e-mail e depois no WhatsApp, aparece “Configuração de segurança atualizada. As outras sessões foram encerradas.”",
              "Troque a senha do seu e-mail e confira quem mais abre essa caixa de entrada. O código de acesso chega nela e, sem a verificação em duas etapas, quem lê o seu e-mail consegue entrar no Console.",
              "Abra um chamado do tipo “Acesso” e conte o que viu. Se não conseguir entrar, use “Fale com a equipe da Anuntech” na tela de entrada ou o WhatsApp (11) 5107-3435.",
            ],
          },
          {
            kind: "note",
            tone: "attention",
            text: "Não há botão para encerrar uma sessão específica. “Sair” encerra só o aparelho em que você está. As outras sessões terminam quando você liga, troca ou desliga a verificação em duas etapas, e trocar o e-mail de acesso encerra todas, inclusive a atual.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Esqueci a minha senha. Como recupero?",
        a: "O Console não tem senha. Você entra com um código de 6 números enviado por e-mail ou pelo WhatsApp vinculado à conta, ou com “Continuar com Google”. Veja [Entrar no Console](/ajuda/entrar).",
      },
      {
        q: "Recebi um código que eu não pedi. O que faço?",
        a: "Alguém pode ter digitado o seu e-mail na tela de entrada. Sem o código, essa tentativa não vai adiante, e ele vence em 5 minutos. Não repasse o código e ignore a mensagem, como o próprio e-mail orienta. Se isso se repetir, ligue a verificação em duas etapas e avise a equipe num chamado do tipo “Acesso”.",
      },
      {
        q: "Alguém da Anuntech pode pedir o meu código?",
        a: "A equipe não precisa do seu código para atender você, porque tem o próprio acesso. O e-mail do código diz “Não compartilhe com ninguém.” Se alguém pedir, não passe e avise a equipe por chamado ou pelo WhatsApp (11) 5107-3435.",
      },
      {
        q: "Como encerro o Console aberto em outro computador?",
        a: "“Sair” encerra só o aparelho em que você clica, e não há botão para encerrar uma sessão específica. Em Segurança, “Sessões recentes” mostra onde a conta está aberta. Ligar, trocar o canal ou desligar a verificação em duas etapas encerra todas as outras sessões na hora. Trocar o e-mail de acesso encerra todas, inclusive a atual.",
      },
      {
        q: "Perdi o celular ou troquei de número. E agora?",
        a: "Sem a verificação em duas etapas, entre pelo e-mail ou pelo Google e, em Minha conta, altere ou remova o WhatsApp. O número antigo deixa de servir para entrar. Se o Console estava aberto no celular perdido, aquela sessão continua valendo: vincule o número novo e ligue a verificação em duas etapas, o que encerra as sessões dos outros aparelhos. Com a verificação já ligada, mudar o WhatsApp pede desligá-la antes, e isso pede um código no WhatsApp antigo. Sem acesso a ele, abra um chamado do tipo “Acesso” se ainda tiver o Console aberto em algum aparelho, ou use “Fale com a equipe da Anuntech”, na tela de entrada. Veja [Verificação em duas etapas](/ajuda/verificacao-em-duas-etapas).",
      },
      {
        q: "Por que o Console pediu para eu entrar de novo?",
        a: "A sessão vence depois de 7 dias sem uso. Trocar o e-mail de acesso encerra todas as sessões, e ligar, trocar ou desligar a verificação em duas etapas encerra as dos outros aparelhos. Veja [Sair e sessões](/ajuda/sair-e-sessoes).",
      },
      {
        q: "Uma pessoa saiu da empresa. Como tiro o acesso dela?",
        a: "Um Administrador abre Membros, abre o menu da pessoa, escolhe “Remover acesso” e confirma. Ela deixa de ver a empresa na hora, e o que ela fez continua registrado. Se você é Membro, peça a um Administrador da sua empresa. Veja [Convidar, reenviar convite e remover acesso](/ajuda/convidar-pessoas).",
      },
    ],
    actions: [
      { label: "Ir para Segurança", href: "/configuracoes/seguranca" },
      { label: "Ir para Minha conta", href: "/conta" },
      { label: "Abrir chamado de acesso", href: "/chamados/novo?tipo=acesso" },
    ],
    related: ["verificacao-em-duas-etapas", "sair-e-sessoes", "entrar", "convidar-pessoas"],
    updatedAt: "2026-10-14",
  },
  {
    slug: "seus-dados",
    category: "seguranca",
    title: "Seus dados e privacidade",
    summary: "O que o Console guarda sobre você e a sua empresa, quem vê cada coisa e o que vai para serviços de fora.",
    audience: "todos",
    keywords: [
      "privacidade",
      "dados pessoais",
      "lgpd",
      "quem ve",
      "quem pode ver",
      "excluir conta",
      "apagar dados",
      "apagar conversa",
      "foto",
      "inteligencia artificial",
      "ia",
      "terceiros",
      "anuntech ve meus dados",
      "equipe entra como a empresa",
      "outra empresa",
    ],
    sections: [
      {
        title: "O que o Console guarda",
        blocks: [
          {
            kind: "list",
            items: [
              "Da sua conta: nome, e-mail de acesso, o WhatsApp, se você vincular, e a foto ou o avatar ilustrado. Quando você troca o e-mail de acesso, o anterior continua ligado à conta para manter o acesso e o histórico, mas deixa de servir para entrar.",
              "Das suas entradas: o navegador, o aparelho, o endereço IP e a data de cada sessão. O aparelho e a data aparecem em “Sessões recentes”, em [Segurança](/configuracoes/seguranca).",
              "Do trabalho com a Anuntech: chamados, respostas e anexos, tarefas e comentários, bookmarks e lousas, e os orçamentos, contratos e faturas da empresa.",
              "Quem fez cada ação importante e quando: abrir e responder chamados, aceitar ou recusar um orçamento, assinar um contrato, liberar ou remover acessos.",
              "Ao assinar um contrato, ficam registrados o seu nome, e-mail, data e hora, IP, navegador e um código que identifica o texto exato que você assinou. O PDF final mostra todos eles, menos o navegador.",
              "As suas conversas com o assistente, até você apagá-las.",
              "A foto de perfil fica em armazenamento privado, reduzida para 512 × 512 e sem os dados do arquivo, como local e aparelho.",
            ],
          },
          {
            kind: "p",
            text: "O Console não guarda senha, porque não existe uma, nem o áudio do ditado, que vai para a transcrição e não fica guardado. A aparência que você escolhe (tema e posição do menu) fica só no navegador em que você escolheu.",
          },
        ],
      },
      {
        title: "Quem vê o quê",
        blocks: [
          {
            kind: "pairs",
            items: [
              {
                term: "Você",
                text: "Tudo o que é seu. As conversas com o assistente só você abre, em “Histórico”, e o Console não tem uma tela para outra pessoa lê-las.",
              },
              {
                term: "Pessoas da sua empresa",
                text: "Os chamados da empresa, inclusive os que você abriu, os projetos, os bookmarks sem pasta, os das pastas “Todos da empresa” e os das pastas compartilhadas com elas. Veem também o seu nome e a sua foto. Um Membro com “Só o que eu escolher” vê só os produtos, serviços e projetos marcados e não vê os chamados sobre os itens que ficaram de fora, a não ser os que ele mesmo abriu.",
              },
              {
                term: "Administradores da empresa",
                text: "Além disso, faturas, valores, orçamentos e contratos, e as telas de Membros, Notificações e Dados da empresa. Membros não veem essas áreas nem os valores, nem pelo assistente.",
              },
              {
                term: "Equipe da Anuntech",
                text: "Os dados da sua empresa no Console, porque é ela que atende os chamados, toca os projetos e emite as cobranças. Para entender um problema, alguém da equipe pode abrir o Console como a sua empresa, por até 6 horas de cada vez. O início fica registrado no Console, com o nome de quem entrou.",
              },
              {
                term: "Outras empresas",
                text: "Nunca. Cada consulta é conferida no servidor, e um registro de outra empresa aparece como “Não encontramos esta página”.",
              },
              {
                term: "Contatos de Notificações",
                text: "Recebem por e-mail ou WhatsApp os avisos de cobrança e de chamados que o Administrador escolheu, e não entram no Console.",
              },
            ],
          },
          {
            kind: "p",
            text: "Para entender os papéis, veja [Membro ou Administrador](/ajuda/membro-ou-administrador) e [O que cada Membro vê](/ajuda/o-que-cada-membro-ve). Para as pastas de Bookmarks, veja [Pastas e compartilhamento](/ajuda/pastas-e-compartilhamento).",
          },
        ],
      },
      {
        title: "O que sai do Console e para onde",
        blocks: [
          {
            kind: "p",
            text: "Alguns serviços de fora ajudam o Console a funcionar. Cada um recebe o que precisa para a sua parte:",
          },
          {
            kind: "pairs",
            items: [
              { term: "E-mails", text: "Códigos, convites e avisos saem por um serviço de envio de e-mails." },
              {
                term: "WhatsApp",
                text: "Códigos de acesso e avisos de chamados e de cobrança saem pela plataforma de WhatsApp da Anuntech, a mesma do chat “Conversar com a equipe”.",
              },
              {
                term: "Boleto e Pix",
                text: "O Banco Inter emite a cobrança com os dados de cobrança da empresa, e o Console consulta o banco para saber quando ela é paga.",
              },
              {
                term: "Google",
                text: "Só se você usa “Continuar com Google”. O Google confirma o seu e-mail, e no primeiro acesso o seu nome vem de lá.",
              },
              {
                term: "Assistente",
                text: "Para responder, a conversa vai para um serviço de inteligência artificial, com o seu nome, empresa e papel, o que está preenchido nos campos da tela aberta e o resultado das consultas que ele faz com o seu acesso. O Console só usa provedores que não guardam esses dados nem treinam modelos com eles. Veja [O assistente do Console](/ajuda/assistente).",
              },
              {
                term: "Ditado",
                text: "O áudio vai para um serviço de transcrição, só em provedores que não guardam nada, e volta como texto para você revisar. Veja [Falar em vez de escrever](/ajuda/falar-em-vez-de-escrever).",
              },
              {
                term: "Chamado novo",
                text: "O assunto e a descrição passam por um modelo de inteligência artificial que sugere uma prioridade à equipe. Você não vê essa sugestão e nada muda sozinho: quem decide a prioridade é a equipe.",
              },
            ],
          },
          {
            kind: "note",
            tone: "attention",
            text: "Por isso, não escreva nem fale senhas, chaves de acesso ou dados reais dos seus clientes em chamados, comentários ou no assistente. Se a equipe precisar de um acesso, ela combina com você um jeito seguro. O assunto do chamado também aparece no assunto dos e-mails de aviso.",
          },
        ],
      },
      {
        title: "Corrigir e apagar",
        blocks: [
          {
            kind: "list",
            items: [
              "Nome, foto, e-mail e WhatsApp: você mesmo muda em [Minha conta](/conta). Veja [Meu perfil](/ajuda/meu-perfil) e [Trocar o e-mail ou o WhatsApp](/ajuda/email-e-whatsapp).",
              "Razão social, documento, contato financeiro e endereço de cobrança: o Administrador muda em Dados da empresa. Veja [Dados da empresa](/ajuda/dados-da-empresa).",
              "Conversas com o assistente: abra o assistente, toque em “Histórico”, depois na lixeira ao lado da conversa, e confirme em “Apagar?”.",
              "O Console não tem um botão para excluir a conta. Quando você deixa a empresa, um Administrador remove o seu acesso em “Membros”. Você deixa de entrar, e os registros do que você fez, como chamados e contratos assinados, continuam.",
              "Para outras dúvidas sobre os seus dados, abra um chamado ou use “Conversar com a equipe”, no menu da conta.",
            ],
          },
          {
            kind: "note",
            tone: "attention",
            text: "Apagar uma conversa com o assistente é definitivo: ela não volta.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "A Anuntech vê os dados da minha empresa?",
        a: "Sim. A equipe vê no Console os dados da sua empresa, porque atende os chamados, toca os projetos e emite as cobranças. Para entender um problema, alguém da equipe pode abrir o Console como a sua empresa, por até 6 horas de cada vez, e o início fica registrado. O Console não tem uma tela para a equipe ler as suas conversas com o assistente.",
      },
      {
        q: "Outra empresa cliente pode ver os meus dados?",
        a: "Não. Cada consulta é conferida no servidor com o acesso de quem pede. Um registro de outra empresa responde como uma página que não existe, sem confirmar nem que ele existe.",
      },
      {
        q: "Quem vê a minha foto?",
        a: "Você, as pessoas da sua empresa e a equipe da Anuntech. A foto fica em armazenamento privado, reduzida e sem os dados do arquivo, como local e aparelho. Se preferir, use “Escolher avatar” em Minha conta para ter uma ilustração no lugar da foto.",
      },
      {
        q: "Para onde vai o que eu escrevo no assistente?",
        a: "Para responder, a conversa vai para um serviço de inteligência artificial. Ela também fica guardada no Console, ligada à sua conta, e só você a abre em “Histórico”. Para apagar, toque na lixeira ao lado da conversa e em “Apagar?”.",
      },
      {
        q: "Para onde vai o áudio quando uso o “Falar”?",
        a: "Para um serviço de transcrição, só em provedores que não guardam nada. O áudio não fica guardado no Console. O texto aparece no campo para você revisar, e nada é enviado sozinho.",
      },
      {
        q: "Como excluo a minha conta?",
        a: "O Console não tem essa opção. Um Administrador da sua empresa remove o seu acesso em “Membros”, e você deixa de entrar. O que você fez, como chamados e contratos assinados, continua registrado. Para outras dúvidas sobre os seus dados, abra um chamado ou fale com a equipe.",
      },
      {
        q: "Um colega mandou um link e apareceu “Não encontramos esta página”. Por quê?",
        a: "O Console responde assim quando o registro não existe, foi excluído ou está fora do seu acesso, e não diferencia os casos para não revelar o que você não pode ver. Confira se entrou com o e-mail certo e, se acha que deveria ver, fale com um Administrador da sua empresa.",
      },
    ],
    actions: [
      { label: "Ir para Minha conta", href: "/conta" },
      { label: "Ir para Segurança", href: "/configuracoes/seguranca" },
    ],
    related: ["seguranca-da-conta", "membro-ou-administrador", "assistente", "falar-em-vez-de-escrever"],
    updatedAt: "2026-10-14",
  },
  {
    slug: "avisos-do-console",
    category: "seguranca",
    title: "E-mails e mensagens que o Console envia",
    summary: "Cada e-mail e mensagem de WhatsApp que o Console manda, quem recebe e como reconhecer um aviso verdadeiro.",
    audience: "todos",
    keywords: [
      "avisos",
      "notificacao",
      "email",
      "e-mail",
      "whatsapp",
      "mensagem",
      "nao recebi",
      "spam",
      "golpe",
      "boleto falso",
      "remetente",
      "lembrete",
      "resumo semanal",
      "convite",
      "responder email",
    ],
    sections: [
      {
        title: "Quem recebe o quê",
        blocks: [
          {
            kind: "p",
            text: "O Console avisa por e-mail e, em alguns casos, por WhatsApp. Quem recebe depende do assunto:",
          },
          {
            kind: "pairs",
            items: [
              {
                term: "Você",
                text: "Os códigos para entrar e para confirmar mudanças na conta, o convite e os avisos dos chamados que você abriu.",
              },
              {
                term: "Contatos de Notificações",
                text: "Os avisos de cobrança (contatos de “Financeiro”) e todas as movimentações dos chamados da empresa (contatos de “Chamados”), por e-mail e WhatsApp, como o Administrador escolheu. Esses contatos não entram no Console.",
              },
              {
                term: "Administradores da empresa",
                text: "Orçamentos, contratos para assinar, banco de horas, entregas para revisar e o resumo semanal. Membros não recebem esses e-mails.",
              },
            ],
          },
          {
            kind: "p",
            text: "Quem escolhe os contatos de cobrança e de chamados é o Administrador, em [Notificações](/ajuda/notificacoes). Um Membro que quer receber ou deixar de receber esses avisos pede a um Administrador.",
          },
        ],
      },
      {
        title: "Acesso à conta",
        blocks: [
          {
            kind: "pairs",
            items: [
              {
                term: "Código de acesso",
                text: "E-mail “Seu código de acesso ao Console da Anuntech”, com 6 números, quando você pede para entrar, na segunda etapa ou ao confirmar uma mudança em Minha conta ou em Segurança. Vale 5 minutos e só funciona uma vez. Pelo WhatsApp, chega uma mensagem com o código.",
              },
              {
                term: "Convite",
                text: "E-mail “Seu acesso ao Console da Anuntech”, quando a equipe da Anuntech ou um Administrador da sua empresa libera o seu acesso. Diz como entrar.",
              },
            ],
          },
        ],
      },
      {
        title: "Chamados",
        blocks: [
          {
            kind: "p",
            text: "Quem abriu o chamado recebe por e-mail o recibo e cada movimentação da equipe. O assunto do e-mail traz a movimentação e, depois de um ponto, o assunto do chamado.",
          },
          {
            kind: "pairs",
            items: [
              {
                term: "“Chamado aberto”",
                text: "Logo depois de abrir: “Recebemos o seu chamado e a equipe da Anuntech já foi avisada.” Quando as condições da sua empresa preveem, diz até quando vem a primeira resposta.",
              },
              {
                term: "“Nova resposta no chamado” ou “Novo anexo no chamado”",
                text: "A equipe respondeu ou mandou um arquivo.",
              },
              {
                term: "“A equipe precisa de você”",
                text: "O chamado espera algo seu. O e-mail diz “O que falta” e, quando as condições da sua empresa preveem, que o prazo da Anuntech fica pausado e até quando responder.",
              },
              {
                term: "“Lembrete: a equipe ainda precisa de você”",
                text: "O mesmo pedido, de novo. O Console manda um sozinho na metade do prazo que as condições da sua empresa dão para responder, ou depois de 3 dias úteis quando não há esse prazo, e a equipe pode mandar outros. Nunca sai mais de um lembrete por dia.",
              },
              {
                term: "“Chamado resolvido”, “Chamado encerrado” ou “Chamado reaberto”",
                text: "A situação mudou. Outras mudanças chegam como “Situação alterada”, “Prioridade” ou “Responsável”.",
              },
              {
                term: "“Estimativa para aprovar”",
                text: "A equipe estimou em horas do banco uma melhoria pedida no chamado, e um Administrador aprova ou recusa no Console. Este aviso vai só para os contatos de “Chamados”, não para quem abriu. Veja [Estimativas de melhoria](/ajuda/estimativas-de-melhoria).",
              },
            ],
          },
          {
            kind: "p",
            text: "Os contatos de “Chamados” recebem todas as movimentações dos chamados da empresa, inclusive as respostas das pessoas da sua empresa. Esse envio vem desligado até um Administrador escolher os contatos e salvar. Pelo WhatsApp, o aviso de chamado é uma mensagem curta com o nome da empresa, sem o assunto nem o que mudou. Para ver o que aconteceu, abra Chamados no Console. Veja também [Acompanhar e responder um chamado](/ajuda/acompanhar-um-chamado).",
          },
          {
            kind: "note",
            tone: "attention",
            text: "Responda sempre no Console, pelo link do aviso. O Console não lê respostas de e-mail nem de WhatsApp, então o que você responder por lá não entra no chamado.",
          },
        ],
      },
      {
        title: "Cobrança",
        blocks: [
          {
            kind: "p",
            text: "Os avisos de cobrança vão para os contatos de “Financeiro”. Se nada foi salvo em Notificações, eles vão para o e-mail financeiro e o telefone do cadastro da empresa, por e-mail e WhatsApp.",
          },
          {
            kind: "pairs",
            items: [
              {
                term: "“Anuntech | Nova fatura”",
                text: "Uma fatura ficou disponível para pagar. Traz o valor, o vencimento e o botão “Pagar agora”.",
              },
              {
                term: "“Anuntech | Vence hoje”",
                text: "No dia de pagar: “Pague por Pix ou boleto pelo link abaixo. Se já pagou, pode ignorar esta mensagem.”",
              },
              {
                term: "“Anuntech | Fatura em aberto”",
                text: "A fatura venceu sem pagamento. Sai nos dias 5, 10, 15, 20 e 25 depois do vencimento e diz há quantos dias ela está em aberto.",
              },
            ],
          },
          {
            kind: "list",
            items: [
              "O remetente do e-mail é “Anuntech · Financeiro”, e o WhatsApp sai do número (11) 5107-3435, o mesmo do atendimento.",
              "Os avisos automáticos saem a partir das 8h, horário de Brasília.",
              "Antes de cada aviso, o Console confere no Banco Inter se a fatura foi paga. Fatura paga ou cancelada não recebe aviso.",
              "Cada contato recebe cada aviso uma vez só.",
            ],
          },
          {
            kind: "p",
            text: "Os detalhes estão em [Avisos de cobrança](/ajuda/avisos-de-cobranca).",
          },
        ],
      },
      {
        title: "Só para os Administradores",
        blocks: [
          {
            kind: "p",
            text: "Estes e-mails vão para todos os Administradores da empresa. Os lembretes, as entregas para revisar, o relatório do banco de horas e o resumo semanal saem uma vez por dia, às 9h, horário de Brasília. A equipe da Anuntech pode desligar algum desses envios automáticos.",
          },
          {
            kind: "pairs",
            items: [
              {
                term: "Orçamento enviado",
                text: "Assunto “Orçamento”, com o número e o título, quando a equipe manda um orçamento ou uma nova versão. Mostra o valor total e até quando ele vale.",
              },
              {
                term: "Orçamento perto de vencer",
                text: "Assunto “Orçamento … vale até …”, quando faltam até 3 dias para a validade e ainda não houve resposta. Uma vez por versão enviada.",
              },
              {
                term: "Contrato para assinar",
                text: "Assunto “Contrato para assinatura” ou “Aditivo para assinatura”, quando o documento chega ou quando sai uma nova versão com a resposta aos pedidos de alteração.",
              },
              {
                term: "Contrato sem assinatura",
                text: "Assunto “Contrato esperando sua assinatura” ou “Aditivo esperando sua assinatura”, uma semana depois do envio, se a empresa ainda não assinou. Uma vez por versão.",
              },
              {
                term: "Contrato assinado",
                text: "Assunto “Contrato assinado” ou “Aditivo assinado”, quando as duas partes assinam. Traz o link do contrato no Console, onde fica o PDF final, e os próximos passos. O PDF não vai anexado.",
              },
              {
                term: "Banco de horas",
                text: "Assunto “Banco de horas em …%”, logo que o uso do mês passa do limite de aviso das condições da sua empresa, uma vez por mês. No 2º dia útil do mês, o relatório do mês anterior chega com o assunto “Banco de horas de”, o mês e a empresa, com os registros e, quando as condições preveem, o prazo para contestar. Veja [Relatório mensal de horas e contestação](/ajuda/relatorio-de-horas).",
              },
              {
                term: "Entregas para revisar",
                text: "Assunto “Uma entrega para revisar” ou com o número de entregas, uma vez por dia, quando entram entregas em Revisão no projeto.",
              },
              {
                term: "Resumo semanal",
                text: "Assunto “Sua semana com a Anuntech”, toda segunda-feira, se algo mudou nos chamados ou nas tarefas da empresa: chamados abertos e resolvidos, o que espera você, entregas em Revisão, banco de horas e a próxima fatura.",
              },
            ],
          },
        ],
      },
      {
        title: "Como reconhecer um aviso verdadeiro",
        blocks: [
          {
            kind: "list",
            items: [
              "Os links levam ao endereço do Console da Anuntech, console.anuntech.com.",
              "O link de pagamento abre a fatura no Console, com Pix e boleto, sem pedir para entrar.",
              "O código de acesso só serve na tela do Console. Se alguém pedir o código por mensagem ou telefone, não passe.",
              "Os avisos de cobrança por WhatsApp saem do número (11) 5107-3435.",
              "Na dúvida, não clique: abra o Console digitando o endereço e confira em Financeiro (Administrador) ou em Chamados.",
            ],
          },
          {
            kind: "note",
            tone: "attention",
            text: "Se receber uma cobrança que não aparece no Console, fale com a equipe antes de pagar, pelo WhatsApp (11) 5107-3435 ou num chamado.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Posso responder o e-mail ou o WhatsApp de aviso?",
        a: "Responda pelo Console, no link do aviso. O Console não lê respostas de e-mail nem de WhatsApp, então elas não entram no chamado.",
      },
      {
        q: "Por que não recebo os avisos dos chamados que outra pessoa abriu?",
        a: "Cada pessoa recebe os avisos dos chamados que abriu. Para alguém receber todos os chamados da empresa, um Administrador cadastra os contatos em Notificações, no card “Chamados”, e marca “E-mail” ou “WhatsApp”. Esse envio vem desligado até alguém salvar.",
      },
      {
        q: "Sou Membro. Por que não recebo orçamentos, contratos ou cobranças?",
        a: "Orçamentos, contratos, banco de horas, entregas para revisar e o resumo semanal vão só para os Administradores da empresa. Os avisos de cobrança vão para os contatos de “Financeiro” que o Administrador escolheu em Notificações.",
      },
      {
        q: "Não recebi nenhum e-mail do Console. O que confiro?",
        a: "Procure no spam. O código de acesso só chega para um e-mail liberado para entrar; um e-mail que você trocou em Minha conta deixa de receber. Avisos de chamados chegam para quem abriu e para os contatos de “Chamados”. Se um e-mail de cobrança voltou ou foi marcado como spam, o Console para de enviar cobranças para esse endereço; o Administrador vê a falha em “Histórico de envios”, em Notificações, e pode cadastrar outro e-mail.",
      },
      {
        q: "Recebi um lembrete de uma fatura que já paguei.",
        a: "Antes de cada aviso o Console consulta o Banco Inter e não avisa fatura paga. Se o pagamento ainda não tinha sido confirmado pelo banco na hora do envio, o lembrete pode ter saído. Como o próprio aviso diz, se já pagou, pode ignorar.",
      },
      {
        q: "Os contatos de Notificações entram no Console?",
        a: "Não. Eles só recebem os avisos por e-mail ou WhatsApp. Para alguém entrar no Console, um Administrador convida a pessoa em Membros.",
      },
      {
        q: "O Console tem uma central de notificações?",
        a: "Não. O que espera por você aparece em “Precisa de atenção”, na Visão geral. Os avisos saem por e-mail e WhatsApp, como descrito acima.",
      },
      {
        q: "Como sei que um WhatsApp de cobrança é mesmo da Anuntech?",
        a: "Os avisos de cobrança saem do número (11) 5107-3435, o mesmo do atendimento, e o link “Pagar agora” abre a fatura no endereço do Console da Anuntech, sem pedir para entrar. Na dúvida, abra o Console e confira em Financeiro.",
      },
    ],
    actions: [{ label: "Ir para Notificações (Administrador)", href: "/configuracoes/notificacoes" }],
    related: ["notificacoes", "avisos-de-cobranca", "acompanhar-um-chamado", "seguranca-da-conta"],
    updatedAt: "2026-10-14",
  },
];
