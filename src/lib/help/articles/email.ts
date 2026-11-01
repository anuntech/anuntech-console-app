import type { HelpArticle } from "../help-model";

/** E-mail da Anuntech: configurar os aplicativos e gerenciar as caixas no Console (o Administrador da empresa e a equipe). */
export const emailArticles: HelpArticle[] = [
  {
    slug: "configurar-email-nos-aparelhos",
    category: "conta",
    title: "Configurar o e-mail no celular e no computador",
    summary: "Os dados para entrar numa caixa do servidor de e-mail da Anuntech (@anuntech.com ou o domínio da sua empresa) pelo app Mail, Outlook, Gmail ou Mailbird, e o perfil pronto para iPhone e Mac.",
    audience: "todos",
    keywords: [
      "email",
      "e-mail",
      "configurar email",
      "imap",
      "smtp",
      "outlook",
      "gmail",
      "mailbird",
      "thunderbird",
      "iphone",
      "mac",
      "apple mail",
      "perfil",
      "mobileconfig",
      "servidor de entrada",
      "servidor de saida",
      "porta 993",
      "porta 465",
      "caixa de e-mail",
      "anuntech.com",
    ],
    sections: [
      {
        title: "Onde ler e enviar",
        blocks: [
          {
            kind: "p",
            text: "Os e-mails de uma caixa do servidor da Anuntech, @anuntech.com ou do domínio da sua empresa, são lidos e enviados pelo aplicativo de e-mail que você já usa: Mail do iPhone e do Mac, Outlook, Gmail, Thunderbird ou Mailbird. O Console não abre as mensagens; nele o Administrador da sua empresa e a equipe da Anuntech só cuidam das caixas (senha, espaço, apelidos e redirecionamentos), em Produtos, no produto de e-mail.",
          },
        ],
      },
      {
        title: "Os dados da caixa",
        blocks: [
          {
            kind: "pairs",
            items: [
              { term: "Usuário", text: "O endereço completo, por exemplo nome@anuntech.com ou nome@suaempresa.com.br." },
              { term: "Senha", text: "A da caixa, que o Administrador da empresa ou a equipe da Anuntech passou quando criou ou trocou a senha. Se a caixa é sua, você mesmo troca no Console." },
              { term: "Recebimento (IMAP)", text: "Servidor mail.anuntech.com, porta 993, segurança SSL/TLS." },
              { term: "Envio (SMTP)", text: "Servidor mail.anuntech.com, porta 465, segurança SSL/TLS. Se o aplicativo não aceitar, porta 587 com STARTTLS." },
              { term: "Autenticação", text: "Entrada e envio com o mesmo usuário e a mesma senha." },
            ],
          },
          {
            kind: "note",
            tone: "info",
            text: "Escolha sempre IMAP, nunca POP. Com IMAP, o que você lê, apaga ou envia num aparelho aparece igual nos outros.",
          },
        ],
      },
      {
        title: "iPhone, iPad e Mac",
        blocks: [
          {
            kind: "steps",
            items: [
              "Baixe o perfil da sua caixa no Console: em Produtos, abra o produto de e-mail e, na caixa, Configurar aparelhos. No app do Console no iPhone, toque na caixa e em Baixar perfil para iPhone. Ele é um arquivo .mobileconfig e não leva a senha.",
              "No iPhone ou iPad, abra o arquivo pelo Safari, pelo AirDrop ou pelo app Arquivos (no app do Console, escolha Salvar em Arquivos e abra o arquivo). Aparece o aviso de perfil transferido.",
              "Abra Ajustes e toque em Perfil Transferido (ou em Geral, VPN e Gerenciamento de Dispositivo) e depois em Instalar.",
              "Digite a senha da caixa quando o aparelho pedir. A conta aparece no app Mail.",
              "No Mac, abra o arquivo e confirme em Ajustes do Sistema, na parte de perfis (Geral, Gerenciamento de Dispositivo).",
            ],
          },
          {
            kind: "p",
            text: "O perfil aparece como não verificado porque não é assinado. Pode instalar: ele só configura a conta de e-mail, sem mexer em mais nada do aparelho, e você remove quando quiser no mesmo lugar dos Ajustes.",
          },
        ],
      },
      {
        title: "Outlook no Windows",
        blocks: [
          {
            kind: "steps",
            items: [
              "No Outlook, abra Arquivo e Adicionar Conta. No Outlook novo, abra Configurações, Contas e Adicionar conta.",
              "Digite o endereço completo. Em Opções avançadas, marque a configuração manual da conta e escolha IMAP.",
              "Em Email de entrada, use mail.anuntech.com, porta 993 e SSL/TLS. Em Email de saída, mail.anuntech.com, porta 465 e SSL/TLS.",
              "Digite a senha da caixa e conclua.",
            ],
          },
        ],
      },
      {
        title: "Outlook no celular",
        blocks: [
          {
            kind: "steps",
            items: [
              "No app Outlook, toque no ícone da conta, depois em Adicionar conta e Adicionar conta de email.",
              "Digite o endereço completo e toque em Continuar. Se o app perguntar o tipo de conta, escolha IMAP.",
              "Ligue as configurações avançadas e preencha o IMAP e o SMTP com os dados acima, com o endereço completo como usuário.",
              "Digite a senha da caixa e confirme.",
            ],
          },
        ],
      },
      {
        title: "Gmail no Android",
        blocks: [
          {
            kind: "steps",
            items: [
              "No Gmail, toque na sua foto, em Adicionar outra conta e em Outra.",
              "Digite o endereço completo e toque em Configuração manual. Escolha Pessoal (IMAP) e digite a senha.",
              "Servidor de entrada: mail.anuntech.com, porta 993, SSL/TLS.",
              "Servidor de saída: mail.anuntech.com, porta 465, SSL/TLS, com o login exigido e o mesmo usuário e senha.",
              "Escolha com que frequência sincronizar e o nome que aparece nos e-mails enviados.",
            ],
          },
        ],
      },
      {
        title: "Mailbird",
        blocks: [
          {
            kind: "steps",
            items: [
              "No Mailbird, abra o menu, Configurações, Contas e Adicionar.",
              "Digite o seu nome, o endereço completo e a senha da caixa, e continue.",
              "Se ele não encontrar o servidor sozinho, edite as configurações do servidor: IMAP mail.anuntech.com, porta 993, SSL; SMTP mail.anuntech.com, porta 465, SSL; usuário, o endereço completo.",
            ],
          },
        ],
      },
    ],
    faq: [
      {
        q: "Esqueci a senha da caixa. O que faço?",
        a: "Se o endereço da caixa é um dos e-mails da sua conta no Console, troque você mesmo: em Produtos, abra o produto de e-mail, depois Trocar senha. Senão, peça uma senha nova ao Administrador da sua empresa. A senha antiga não fica guardada em lugar nenhum, então não há como recuperar: só trocar. Depois da troca, digite a nova em cada aparelho.",
      },
      {
        q: "O aplicativo diz que a senha está errada.",
        a: "Confira se o usuário é o endereço completo, com o @ e o domínio, e se a senha foi digitada sem espaço no começo ou no fim. Se a senha foi trocada há pouco, cada aparelho pede a nova uma vez.",
      },
      {
        q: "Recebo, mas não consigo enviar.",
        a: "Confira o servidor de saída: mail.anuntech.com, porta 465 com SSL/TLS (ou 587 com STARTTLS), e o login ligado com o mesmo usuário e senha da entrada.",
      },
      {
        q: "A caixa está cheia.",
        a: "Apague mensagens grandes e esvazie a lixeira pelo aplicativo, ou peça mais espaço ao Administrador da sua empresa. O espaço usado aparece no produto de e-mail, em Produtos.",
      },
    ],
    related: ["gerenciar-caixas-de-email"],
    updatedAt: "2026-11-01",
  },
  {
    slug: "gerenciar-caixas-de-email",
    category: "conta",
    title: "Gerenciar as caixas de e-mail da empresa",
    summary: "Como o Administrador da empresa e a equipe da Anuntech criam caixas, trocam senhas, mudam o espaço e os apelidos, fazem redirecionamentos e conferem o DNS pelo produto de e-mail em Produtos, e o que um Membro faz com a própria caixa.",
    audience: "todos",
    keywords: [
      "email",
      "e-mail",
      "caixa de e-mail",
      "nova caixa",
      "criar email",
      "trocar senha",
      "senha do email",
      "apelido",
      "alias",
      "redirecionamento",
      "encaminhar",
      "cota",
      "espaço",
      "excluir caixa",
      "dns",
      "mx",
      "spf",
      "dkim",
      "dmarc",
      "dominio",
      "vincular dominio",
      "administrador",
      "membro",
      "produtos",
      "minha caixa",
    ],
    sections: [
      {
        title: "Quem usa",
        blocks: [
          {
            kind: "p",
            text: "O e-mail fica em Produtos: o card do produto de e-mail abre as caixas da empresa dentro do Console, sem item próprio no menu. O Administrador da empresa gerencia as caixas dos domínios da empresa; com mais de um domínio, o seletor ao lado dos botões mostra só os da empresa. A equipe da Anuntech abre pelo mesmo caminho. As contas de administração do servidor e as que têm papel próprio aparecem na lista como gerenciadas no servidor, sem ações. O Console não lê nem envia e-mails: quem usa a caixa lê pelo aplicativo de e-mail.",
          },
          {
            kind: "list",
            items: [
              "Membro: vê só a própria caixa, a que tem como endereço um dos e-mails da conta dele no Console, com o espaço usado, Trocar senha e Configurar aparelhos. Não cria, não edita nem exclui caixas, e não vê redirecionamentos nem o DNS.",
              "No acesso assistido o e-mail não abre, porque as caixas mexem com senhas da empresa: a equipe sai do acesso assistido e abre o produto de e-mail.",
              "No app do Console, o produto de e-mail mostra as caixas, a troca de senha e o perfil para iPhone. Criar, editar, excluir, os redirecionamentos e o DNS ficam no Console na web.",
              "Criar ou excluir uma caixa ainda não muda a cobrança sozinho: a mudança aparece na atividade da empresa, e a equipe da Anuntech ajusta o valor do produto.",
            ],
          },
        ],
      },
      {
        title: "Domínios dos clientes (equipe)",
        blocks: [
          {
            kind: "steps",
            items: [
              "Em Configurações, abra E-mail. A lista mostra anuntech.com (as caixas da Anuntech ficam aqui, porque não são produto de nenhuma empresa) e cada domínio de cliente, com a empresa e quantas caixas tem.",
              "Clique em Vincular domínio, escolha a empresa e o domínio. A lista traz os domínios que já estão no servidor de e-mail e ainda não são de ninguém.",
              "Pronto: as caixas, os redirecionamentos e o DNS do domínio passam a ser gerenciados no Console, pelo Administrador da empresa e pela equipe, e cada mudança aparece na atividade da empresa.",
            ],
          },
          {
            kind: "note",
            tone: "attention",
            text: "Um domínio novo precisa ser criado no servidor de e-mail antes de aparecer aqui. Desvincular (no menu do domínio, digitando o domínio) só tira o domínio do Console: as caixas e os e-mails continuam no servidor, funcionando.",
          },
        ],
      },
      {
        title: "Criar uma caixa",
        blocks: [
          {
            kind: "steps",
            items: [
              "Em Produtos, abra o produto de e-mail e clique em Nova caixa.",
              "Digite a parte do endereço antes do @, o nome da pessoa ou da equipe e escolha o espaço: 1, 5, 10 ou 20 GB.",
              "Deixe marcado Gerar uma senha forte, ou escolha Digitar a senha (pelo menos 12 caracteres; o servidor confere a força).",
              "Clique em Criar caixa. A senha gerada aparece uma vez, com o botão de copiar. Guarde agora: ela não aparece de novo.",
              "Passe o endereço e a senha para a pessoa por um canal seguro e mostre a ela o artigo de configuração dos aparelhos.",
            ],
          },
          {
            kind: "note",
            tone: "attention",
            text: "O Console não guarda nenhuma senha, nem na auditoria. Se a senha se perder, troque por outra.",
          },
        ],
      },
      {
        title: "Trocar a senha, editar e apelidos",
        blocks: [
          {
            kind: "list",
            items: [
              "Trocar senha (no menu da caixa): gere uma nova ou digite. Os aplicativos conectados com a senha antiga passam a pedir a nova.",
              "Editar: muda o nome, o espaço e os apelidos. O endereço da caixa não muda.",
              "Apelidos são outros endereços do mesmo domínio que chegam na mesma caixa. O Console recusa um apelido que já é caixa, apelido de outra caixa ou redirecionamento.",
              "As trocas de senha e as caixas novas têm um limite por hora para cada pessoa.",
            ],
          },
        ],
      },
      {
        title: "Configurar aparelhos",
        blocks: [
          {
            kind: "p",
            text: "No menu da caixa, Configurar aparelhos mostra os dados para copiar (usuário, servidores e portas) e o botão Baixar perfil para iPhone/Mac. O perfil não leva a senha: o aparelho pede na instalação.",
          },
        ],
      },
      {
        title: "Excluir uma caixa",
        blocks: [
          {
            kind: "p",
            text: "Excluir apaga todos os e-mails da caixa no servidor, sem volta. Para confirmar, digite o endereço completo. Se a caixa é a sua, o Console pede mais uma confirmação.",
          },
        ],
      },
      {
        title: "Redirecionamentos",
        blocks: [
          {
            kind: "p",
            text: "No produto de e-mail, Redirecionamentos lista os endereços do domínio que não são caixas e mandam o que chega para um ou mais destinos, de fora (um Gmail) ou caixas dos domínios da empresa. Dá para criar, mudar os destinos e excluir. Um destino num domínio da empresa precisa existir, para nenhum e-mail voltar.",
          },
        ],
      },
      {
        title: "Saúde do DNS",
        blocks: [
          {
            kind: "p",
            text: "No produto de e-mail, DNS compara os registros do domínio com o que o servidor de e-mail espera: recebimento (MX), quem pode enviar (SPF), a assinatura dos e-mails (DKIM) e a proteção contra falsificação (DMARC). Cada item diz Certo ou Falta isto, com o registro para copiar no painel de DNS. A conferência fica guardada por alguns minutos.",
          },
        ],
      },
    ],
    related: ["configurar-email-nos-aparelhos"],
    updatedAt: "2026-11-01",
  },
];
