import type { HelpArticle } from "../help-model";

/** Começar e Sua conta: primeiro acesso, entrar, navegação, Visão geral, perfil, contatos, segurança, aparência e sessões. */
export const comecarContaArticles: HelpArticle[] = [
  {
    slug: "primeiro-acesso",
    category: "comecar",
    title: "Primeiro acesso",
    summary: "Como entrar no Console pela primeira vez depois que o seu e-mail é liberado e o que fazer logo em seguida.",
    audience: "todos",
    keywords: [
      "primeiro acesso",
      "convite",
      "convidado",
      "criar conta",
      "cadastro",
      "como entrar",
      "nao recebi o convite",
      "senha",
      "acesso liberado",
      "boas-vindas",
      "comecar",
      "começar",
    ],
    sections: [
      {
        title: "Como o acesso é liberado",
        blocks: [
          {
            kind: "p",
            text: "Para entrar no Console, o seu e-mail precisa estar liberado para a sua empresa. Quem libera é a equipe da Anuntech ou um Administrador da sua empresa, em Membros. Sem essa liberação, a tela de entrada não envia código e não cria conta.",
          },
          {
            kind: "p",
            text: "Quando o acesso é liberado, chega o e-mail “Seu acesso ao Console da Anuntech”, com o nome da empresa e o endereço de entrada. Não existe senha: você entra com um código enviado na hora ou com a sua conta Google.",
          },
        ],
      },
      {
        title: "Entrar pela primeira vez",
        blocks: [
          {
            kind: "steps",
            items: [
              "Abra o endereço indicado no e-mail “Seu acesso ao Console da Anuntech” (console.anuntech.com/entrar). A tela mostra “Entre no Console”.",
              "Na aba “E-mail”, digite em “Seu e-mail” exatamente o endereço que recebeu o convite e clique em “Receber código”.",
              "Abra o e-mail “Seu código de acesso ao Console da Anuntech” e digite os 6 números em “Código de acesso”. Ao completar o último número, o Console confere sozinho.",
              "O Console abre a Visão geral, a página inicial da sua empresa.",
            ],
          },
          {
            kind: "p",
            text: "Se preferir, use “Continuar com Google” com uma conta Google do mesmo e-mail que recebeu o convite.",
          },
          {
            kind: "note",
            tone: "info",
            text: "No primeiro acesso não dá para entrar pela aba “WhatsApp”: o número só funciona depois de vinculado em Minha conta.",
          },
        ],
      },
      {
        title: "Logo depois de entrar",
        blocks: [
          {
            kind: "steps",
            items: [
              "Complete o seu perfil: abra o menu da conta (a sua foto ou avatar, no fim do menu do Console; no celular, em “Mais”) e clique em “Meu perfil”. Preencha o nome e, se quiser, vincule o WhatsApp. Vincular pede uma entrada feita há menos de 10 minutos, então aproveite logo depois de entrar. Veja [Meu perfil](/ajuda/meu-perfil).",
              "Siga os “Primeiros passos” que aparecem no topo da Visão geral. Cada passo leva à página onde ele se resolve.",
              "Leia [Como trabalhamos](/como-trabalhamos): quando abrir um chamado, como a equipe conta o tempo, o que ajuda a equipe e, quando as condições da sua empresa já estão publicadas no Console, os prazos combinados com ela.",
              "Se quiser mais proteção, ative a [verificação em duas etapas](/ajuda/verificacao-em-duas-etapas).",
            ],
          },
          {
            kind: "pairs",
            items: [
              {
                term: "Primeiros passos do Administrador",
                text: "Revisar quem tem acesso ao Console, escolher quem recebe os avisos de chamados e ler como a Anuntech trabalha com a sua empresa. Quando a empresa já tem uma fatura ou uma recorrência e falta o endereço de cobrança, completar o endereço aparece primeiro.",
              },
              {
                term: "Primeiros passos do Membro",
                text: "Completar o nome e o WhatsApp e ler como a Anuntech trabalha com a sua empresa.",
              },
            ],
          },
          {
            kind: "p",
            text: "Toda conta nova começa com um avatar ilustrado sorteado. Quem entra pela primeira vez com o código começa sem nome; pelo Google, o nome vem da conta Google.",
          },
        ],
      },
      {
        title: "Regras que valem desde o primeiro acesso",
        blocks: [
          {
            kind: "list",
            items: [
              "Cada pessoa entra com o próprio e-mail. Não compartilhe o seu acesso: peça a um Administrador da empresa que convide quem também precisa entrar.",
              "Cada conta pertence a uma única empresa. Se você trabalha para duas empresas clientes da Anuntech, use um e-mail diferente para cada uma.",
              "O código vale 5 minutos e só funciona uma vez. Não passe o código para ninguém: a equipe da Anuntech não precisa dele para atender você.",
              "Administrador e Membro veem áreas diferentes. Veja [Membro ou Administrador](/ajuda/membro-ou-administrador).",
            ],
          },
        ],
      },
    ],
    faq: [
      {
        q: "Não recebi o e-mail de convite. O que eu faço?",
        a: "Procure no spam por “Seu acesso ao Console da Anuntech”. Você também pode entrar sem ele: abra console.anuntech.com/entrar e peça o código com o seu e-mail. Se o acesso estiver liberado, o código chega. Se não chegar, peça a um Administrador da sua empresa para conferir o seu e-mail em Membros. Enquanto você não entrou nenhuma vez, ele pode usar “Reenviar convite” no menu da sua linha, uma vez por semana. Você também pode clicar em “Fale com a equipe da Anuntech” na tela de entrada.",
      },
      {
        q: "Preciso criar uma senha?",
        a: "Não. O Console não usa senha. Você entra com um código de 6 números enviado por e-mail ou WhatsApp, ou com “Continuar com Google”.",
      },
      {
        q: "Posso entrar pelo WhatsApp no primeiro acesso?",
        a: "Não. Entre a primeira vez pelo e-mail ou pelo Google. Depois vincule o número em Minha conta, no card “Contatos de acesso”, linha “WhatsApp”, botão “Vincular”. A partir daí a aba “WhatsApp” da tela de entrada funciona.",
      },
      {
        q: "O convite chegou num e-mail, mas quero usar outro.",
        a: "Entre a primeira vez com o e-mail do convite. Depois troque o e-mail de acesso em Minha conta, como explica [Trocar o e-mail ou o WhatsApp da conta](/ajuda/email-e-whatsapp).",
      },
      {
        q: "Apareceu “Falta só liberar seu acesso”. O que significa?",
        a: "Você está conectado, mas o seu e-mail não tem mais acesso ativo a nenhuma empresa no Console. Isso acontece, por exemplo, quando o acesso foi retirado depois que você entrou. Peça a um Administrador da sua empresa para liberar o seu e-mail em Membros, ou fale com a equipe da Anuntech. Depois clique em “Verificar acesso”.",
      },
      {
        q: "Trabalho para duas empresas clientes. Posso usar a mesma conta?",
        a: "Não. Cada conta pertence a uma única empresa. Para a segunda empresa, peça o acesso com outro e-mail, que vira outra conta. O WhatsApp só pode ficar vinculado a uma das contas.",
      },
    ],
    actions: [
      { label: "Ir para Minha conta", href: "/conta" },
      { label: "Ler Como trabalhamos", href: "/como-trabalhamos" },
    ],
    related: ["entrar", "meu-perfil", "conhecer-o-console", "membro-ou-administrador"],
    updatedAt: "2026-10-14",
  },
  {
    slug: "entrar",
    category: "comecar",
    title: "Entrar no Console",
    summary: "As três formas de entrar no Console, os limites do código e o que fazer quando ele não chega.",
    audience: "todos",
    keywords: [
      "entrar",
      "login",
      "logar",
      "acessar",
      "codigo",
      "código de acesso",
      "nao recebi o codigo",
      "codigo invalido",
      "esqueci a senha",
      "senha",
      "google",
      "whatsapp",
      "reenviar codigo",
      "acesso pendente",
    ],
    sections: [
      {
        title: "Formas de entrar",
        blocks: [
          {
            kind: "pairs",
            items: [
              { term: "Código por e-mail", text: "Na aba “E-mail”. Funciona com o e-mail liberado para a sua empresa." },
              { term: "Código pelo WhatsApp", text: "Na aba “WhatsApp”. Só funciona com o número já vinculado e confirmado em [Minha conta](/conta)." },
              { term: "Google", text: "No botão “Continuar com Google”. A conta Google precisa ser do mesmo e-mail que você usa no Console." },
            ],
          },
          {
            kind: "p",
            text: "Não existe senha. Pelo e-mail ou pelo WhatsApp, a entrada é confirmada por um código de 6 números, que vale 5 minutos e só funciona uma vez.",
          },
        ],
      },
      {
        title: "Entrar com código",
        blocks: [
          {
            kind: "steps",
            items: [
              "Abra console.anuntech.com. Sem estar conectado, as páginas do Console levam para a tela “Entre no Console”.",
              "Escolha a aba “E-mail” ou “WhatsApp” e preencha “Seu e-mail” ou “Seu WhatsApp”. No WhatsApp, use o número com DDD; para um número de outro país, comece com + e o código do país.",
              "Clique em “Receber código”. A tela avisa que, se o acesso estiver autorizado, o código chega e vale por 5 minutos.",
              "Digite os 6 números em “Código de acesso”. Ao completar o último número, o Console confere sozinho; você também pode clicar em “Entrar”.",
              "Sem a verificação em duas etapas, o Console abre a Visão geral. Com ela, abre a tela “Confirme seu acesso”.",
            ],
          },
          {
            kind: "p",
            text: "Digitou o e-mail ou o número errado? Clique em “Alterar”, ao lado de “Código enviado para”. O código não chegou? Espere a contagem “Reenviar em …s” terminar e clique em “Reenviar código”.",
          },
        ],
      },
      {
        title: "Entrar com o Google",
        blocks: [
          {
            kind: "steps",
            items: [
              "Na tela “Entre no Console”, clique em “Continuar com Google”.",
              "Escolha a conta Google do seu e-mail de acesso.",
              "Você volta ao Console na Visão geral, ou na tela “Confirme seu acesso” se a verificação em duas etapas estiver ativa.",
            ],
          },
          {
            kind: "p",
            text: "Se aparecer “Não foi possível concluir o acesso. Confira se está usando o e-mail autorizado e tente novamente.”, a conta Google escolhida não é a do seu e-mail de acesso atual, ou esse e-mail está sem acesso ativo. Depois de trocar o e-mail de acesso no Console, o Google do e-mail antigo deixa de entrar.",
          },
        ],
      },
      {
        title: "Se a sua conta tem verificação em duas etapas",
        blocks: [
          {
            kind: "steps",
            items: [
              "Depois do primeiro código, ou do Google, abre a tela “Confirme seu acesso”. Ela mostra para onde vai o segundo código, por exemplo “o WhatsApp •••• 1234”.",
              "Clique em “Receber código”. O segundo código só sai quando você pede.",
              "Digite o “Código da segunda etapa” e clique em “Concluir acesso”, ou apenas complete os 6 números.",
            ],
          },
          {
            kind: "p",
            text: "Quem entrou com o código do e-mail recebe o segundo código no WhatsApp, e quem entrou pelo WhatsApp recebe no e-mail. Os detalhes estão em [Verificação em duas etapas](/ajuda/verificacao-em-duas-etapas).",
          },
        ],
      },
      {
        title: "Limites do código",
        blocks: [
          {
            kind: "list",
            items: [
              "Cada código vale 5 minutos e aceita 3 tentativas. Depois disso, peça outro e use sempre o mais recente.",
              "Um novo código só pode ser pedido 60 segundos depois do anterior. Enquanto isso, o botão mostra a contagem.",
              "São no máximo 5 códigos em 15 minutos para o mesmo e-mail ou número, contando todos os códigos enviados para ele. Passando disso, aparece “Aguarde um minuto antes de pedir outro código.” até completar 15 minutos desde o primeiro código.",
              "Para um e-mail ou número sem acesso, a tela mostra a mesma mensagem, mas nenhum código é enviado. Assim o Console não revela quem tem acesso.",
            ],
          },
        ],
      },
      {
        title: "Para onde o Console leva depois de entrar",
        blocks: [
          {
            kind: "list",
            items: [
              "Normalmente, para a Visão geral.",
              "Se você abriu um app da sua empresa pelo endereço do próprio app, sem estar conectado, o Console volta para o app depois que você entra, também depois da segunda etapa. Se o app não estiver entre os produtos da sua empresa, aparece “Este app não está liberado para você”.",
              "Qualquer outro link, como o de um contrato ou de um chamado recebido por e-mail, abre a Visão geral. Depois de entrar, abra o link de novo.",
              "Cada entrada vale até 7 dias, e o uso do Console pode renovar esse prazo. Veja [Sair e sessões](/ajuda/sair-e-sessoes).",
            ],
          },
        ],
      },
      {
        title: "Falta só liberar seu acesso",
        blocks: [
          {
            kind: "p",
            text: "Se depois de entrar aparecer “Falta só liberar seu acesso”, você está conectado, mas o seu e-mail não tem mais acesso ativo a nenhuma empresa no Console. Isso acontece, por exemplo, quando o acesso foi retirado depois que você entrou.",
          },
          {
            kind: "steps",
            items: [
              "Peça a um Administrador da sua empresa para liberar o seu e-mail em Membros, ou fale com a equipe da Anuntech.",
              "Clique em “Verificar acesso”. Se o acesso já estiver liberado, a Visão geral abre.",
              "Para entrar com outra conta, clique em “Sair”.",
            ],
          },
          {
            kind: "note",
            tone: "attention",
            text: "Nunca passe o seu código para ninguém, nem para quem diz ser da Anuntech. A equipe não precisa dele para atender você.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Não recebi o código. O que eu faço?",
        a: "Confira se digitou o mesmo e-mail que foi liberado para a sua empresa: para e-mails sem acesso, o Console mostra a mesma mensagem, mas não envia nada. Procure no spam o e-mail “Seu código de acesso ao Console da Anuntech”. Depois de 60 segundos, use “Reenviar código”, lembrando que são no máximo 5 códigos em 15 minutos. Pelo WhatsApp, o código só chega se o número já estiver vinculado em Minha conta. Se nada funcionar, clique em “Fale com a equipe da Anuntech” na tela de entrada.",
      },
      {
        q: "Esqueci a minha senha. Como recupero?",
        a: "O Console não usa senha. Você entra com um código de 6 números enviado por e-mail ou WhatsApp, ou com “Continuar com Google”.",
      },
      {
        q: "Apareceu “Código inválido ou expirado”.",
        a: "O código vale 5 minutos e aceita 3 tentativas. Peça outro em “Reenviar código” e use sempre o mais recente. Na segunda etapa, 10 códigos errados seguidos bloqueiam a entrada por 15 minutos.",
      },
      {
        q: "Apareceu “Aguarde um minuto antes de pedir outro código.”",
        a: "Você pediu um código há menos de 60 segundos, ou já pediu 5 códigos em 15 minutos para o mesmo e-mail ou número. Espere e use o código mais recente que chegou.",
      },
      {
        q: "Entrei com o Google e apareceu “Não foi possível concluir o acesso”.",
        a: "A conta Google precisa ser do mesmo e-mail que você usa hoje no Console, e esse e-mail precisa ter acesso ativo. Se você trocou o e-mail no Console, o Google do e-mail antigo não entra mais. Tente pelo código no e-mail atual.",
      },
      {
        q: "Abri o link de um e-mail, entrei e caí na Visão geral. É normal?",
        a: "Sim. Depois de entrar, só os links de apps da sua empresa voltam sozinhos para onde você estava. Abra o link do e-mail de novo, agora já conectado.",
      },
    ],
    actions: [
      { label: "Vincular o WhatsApp em Minha conta", href: "/conta" },
      { label: "Ir para Segurança", href: "/configuracoes/seguranca" },
    ],
    related: ["primeiro-acesso", "verificacao-em-duas-etapas", "sair-e-sessoes", "email-e-whatsapp"],
    updatedAt: "2026-10-14",
  },
  {
    slug: "conhecer-o-console",
    category: "comecar",
    title: "Conhecendo o Console: menu, celular e atalhos",
    summary: "Onde fica cada área no computador e no celular, o que tem no menu da conta, como usar as listas e os atalhos de teclado.",
    audience: "todos",
    keywords: [
      "menu",
      "navegacao",
      "navegação",
      "onde fica",
      "celular",
      "aplicativo",
      "app do console",
      "mais",
      "atalhos",
      "teclado",
      "configuracoes",
      "configurações",
      "lista ou grade",
      "filtro",
      "pagina nao encontrada",
      "console indisponivel",
      "console fora do ar",
      "central de ajuda",
      "onde fica como trabalhamos",
    ],
    sections: [
      {
        title: "O menu no computador",
        blocks: [
          {
            kind: "p",
            text: "O menu do Console é a barra flutuante que fica embaixo da tela. A posição pode ser mudada em [Aparência](/ajuda/aparencia). Passe o mouse sobre um ícone para ver o nome da área.",
          },
          {
            kind: "list",
            items: [
              "O primeiro botão, a esfera de pontos, abre o “Assistente”. Veja [O assistente do Console](/ajuda/assistente).",
              "Os ícones seguintes levam às áreas. O Membro vê “Visão geral”, “Projetos”, “Produtos e serviços”, “Chamados” e “Bookmarks”. O Administrador da empresa vê, nesta ordem: “Visão geral”, “Projetos”, “Produtos e serviços”, “Chamados”, “Financeiro”, “Bookmarks”, “Orçamentos” e “Contratos”.",
              "O último botão, com a sua foto ou avatar, abre o menu da conta.",
            ],
          },
          {
            kind: "p",
            text: "O menu mostra só as áreas que o seu papel pode abrir, e o Console confere o seu acesso de novo em cada página. Veja [Membro ou Administrador](/ajuda/membro-ou-administrador).",
          },
        ],
      },
      {
        title: "O menu da conta",
        blocks: [
          {
            kind: "p",
            text: "No topo do menu da conta aparece o seu nome. Logo abaixo ficam estes itens:",
          },
          {
            kind: "pairs",
            items: [
              { term: "Meu perfil", text: "Abre a página Minha conta: nome, foto e os contatos que você usa para entrar." },
              { term: "Aparência", text: "Tema e posição do menu, neste navegador." },
              { term: "Membros", text: "Só para o Administrador: quem tem acesso ao Console e o que cada pessoa vê." },
              { term: "Ajuda", text: "Abre esta central, com os artigos, os tutoriais em vídeo e as perguntas frequentes." },
              { term: "Conversar com a equipe", text: "Abre o chat com a equipe da Anuntech." },
              { term: "Sair", text: "Encerra o acesso neste aparelho." },
            ],
          },
          {
            kind: "p",
            text: "Dentro de Minha conta, o trilho “Conta” leva a “Minha conta”, “Segurança” e “Aparência”. O Administrador vê também o grupo “Empresa”, com “Dados da empresa”, “Membros” e “Notificações”. No menu, a página Segurança só aparece nesse trilho. No celular, o trilho vira uma fileira de botões no topo.",
          },
          {
            kind: "p",
            text: "A página [Como trabalhamos](/como-trabalhamos) não fica no menu. Ela abre por estes caminhos:",
          },
          {
            kind: "list",
            items: [
              "O passo “Leia como a Anuntech trabalha com a …” dos Primeiros passos, na Visão geral.",
              "O botão “Abrir Como trabalhamos” do artigo [Prazos do seu contrato](/ajuda/como-trabalhamos), nesta central.",
              "O link “Como contamos o tempo”, no quadro “Prazos” de um chamado.",
              "O link “Como trabalhamos”, em “Sobre este projeto”: o botão com o ícone de informação, ao lado de “Nova tarefa”, no quadro do projeto.",
              "Para o Administrador, o link “Como trabalhamos” em “Próximos passos”, na página de um contrato assinado.",
            ],
          },
        ],
      },
      {
        title: "No celular",
        blocks: [
          {
            kind: "p",
            text: "Em telas de celular, o menu vira uma barra de abas fixa embaixo. Não há aplicativo para instalar: use o navegador do celular em console.anuntech.com.",
          },
          {
            kind: "pairs",
            items: [
              { term: "Abas do Administrador", text: "“Início” (a Visão geral), “Produtos”, “Chamados”, “Financeiro” e “Mais”." },
              { term: "Abas do Membro", text: "“Início”, “Produtos”, “Chamados”, “Projetos” e “Mais”." },
            ],
          },
          {
            kind: "p",
            text: "Toque em “Mais” para abrir um painel com o seu nome e estas seções:",
          },
          {
            kind: "list",
            items: [
              "“Perguntar ao assistente”.",
              "“Criar”, com “Abrir chamado”.",
              "“Mais áreas”, com o que não coube nas abas. Para o Administrador: Projetos, Bookmarks, Orçamentos e Contratos. Para o Membro: Bookmarks.",
              "“Conta”, com “Meu perfil”, “Aparência”, “Membros” (só Administrador), “Ajuda”, “Conversar com a equipe” e “Sair”.",
            ],
          },
        ],
      },
      {
        title: "Onde abrir um chamado",
        blocks: [
          {
            kind: "p",
            text: "No computador, use o botão “Abrir chamado” no topo da Visão geral ou da página Chamados. O assistente também oferece esse atalho. No celular, toque em “Mais” e, em “Criar”, em “Abrir chamado”. O passo a passo está em [Abrir um chamado](/ajuda/abrir-um-chamado).",
          },
        ],
      },
      {
        title: "Usar as listas",
        blocks: [
          {
            kind: "list",
            items: [
              "Busque pelo campo no topo da lista. O “x” do campo apaga a busca.",
              "Use os filtros na mesma linha da busca. Cada filtro ativo vira uma etiqueta, e o “x” da etiqueta tira só aquele filtro.",
              "No rodapé, “Por página” mostra 10, 25, 50 ou 100 linhas (o padrão é 25), e as setas mudam de página.",
              "Em Projetos, Produtos e serviços, Bookmarks e, para o Administrador, Contratos, escolha “Lista” (linhas) ou “Grade” (cartões) nos dois botões da barra da lista. Sem escolha, a lista abre em Grade. A escolha fica guardada neste navegador, para cada área.",
              "Clique na linha para abrir o registro. Com ⌘ (Mac) ou Ctrl (Windows) apertado, ele abre em outra aba.",
              "Para mandar uma lista filtrada a um colega, copie o endereço do navegador: a busca, os filtros e a página vão nele. O colega vê só o que o acesso dele permite.",
            ],
          },
        ],
      },
      {
        title: "Atalhos de teclado",
        blocks: [
          {
            kind: "pairs",
            items: [
              { term: "Tab, ao abrir uma página", text: "Mostra “Ir para o conteúdo”, que pula o menu." },
              { term: "Enter no assistente", text: "Envia a mensagem. Shift+Enter quebra a linha." },
              { term: "⌘+Enter ou Ctrl+Enter", text: "Envia a resposta de um chamado ou um comentário de tarefa. Editando um comentário seu, salva; Esc cancela." },
              { term: "Esc", text: "Fecha diálogos e painéis e cancela uma gravação de ditado." },
              { term: "⌘ ou Ctrl + clique", text: "Abre o registro da lista em outra aba." },
            ],
          },
        ],
      },
      {
        title: "Quando uma página não abre",
        blocks: [
          {
            kind: "pairs",
            items: [
              {
                term: "“Não encontramos esta página”",
                text: "O endereço pode estar errado, o registro pode ter sido excluído ou pode estar fora do seu acesso. O Console responde igual nos três casos, para não revelar o que você não pode ver. Confira se entrou com o e-mail certo e, se acha que deveria ver, fale com um Administrador da sua empresa.",
              },
              {
                term: "“Esta página não carregou”",
                text: "Algo falhou ao montar a tela. Clique em “Tentar de novo”. Se continuar, copie o “Código do erro” que aparece embaixo e mande pelo “Falar com a equipe”: com ele, a equipe encontra o registro da falha.",
              },
              {
                term: "“Esta página não existe”",
                text: "O endereço não existe no Console. Use “Ir para o Console”.",
              },
              {
                term: "O Console inteiro não abre (a aba diz “Console indisponível”)",
                text: "A tela mostra “Esta página não carregou”, mas sem o Console o chat da equipe não carrega. Clique em “Tentar de novo”. Se continuar, use “Falar com a equipe no WhatsApp”, na própria tela, e mande o “Código do erro”.",
              },
            ],
          },
        ],
      },
    ],
    faq: [
      {
        q: "Existe aplicativo do Console para celular?",
        a: "Não há aplicativo para instalar. Use o navegador do celular em console.anuntech.com: o menu vira uma barra de abas embaixo, e as outras áreas, a sua conta e “Perguntar ao assistente” ficam em “Mais”.",
      },
      {
        q: "Por que não vejo Financeiro, Orçamentos e Contratos no menu?",
        a: "Essas áreas são só do Administrador da empresa. O Membro usa a Visão geral, Projetos, Produtos e serviços, Chamados e Bookmarks. Se você precisa desse acesso, peça a um Administrador da sua empresa que mude a sua permissão em Membros.",
      },
      {
        q: "Onde fica a página Segurança?",
        a: "Abra o menu da conta, clique em “Meu perfil” e, no trilho “Conta”, clique em “Segurança”. Ela não aparece direto no menu da conta.",
      },
      {
        q: "“Meu perfil” e “Minha conta” são a mesma coisa?",
        a: "Sim. O item do menu se chama “Meu perfil” e abre a página “Minha conta”.",
      },
      {
        q: "No computador, não acho um botão para criar coisas.",
        a: "O menu do computador não tem botão “Criar”. Para abrir um chamado, use “Abrir chamado” na Visão geral ou em Chamados, ou o atalho do assistente. No celular, “Criar” fica em “Mais”.",
      },
      {
        q: "Escolhi Lista e, em outro computador, a página abriu em Grade.",
        a: "A escolha entre Lista e Grade fica guardada no navegador em que você escolheu, para cada área. Em outro computador ou navegador, escolha de novo.",
      },
      {
        q: "Onde fica a página Como trabalhamos?",
        a: "Ela não está no menu. Abra pelo passo “Leia como a Anuntech trabalha com a …” dos Primeiros passos, pelo link “Como contamos o tempo” de um chamado, pelo link “Como trabalhamos” de “Sobre este projeto” ou, para o Administrador, dos “Próximos passos” de um contrato assinado. Também abre pelo botão “Abrir Como trabalhamos” do artigo [Prazos do seu contrato](/ajuda/como-trabalhamos) e pelo botão “Ler Como trabalhamos” deste artigo.",
      },
    ],
    actions: [
      { label: "Ir para a Visão geral", href: "/painel" },
      { label: "Ler Como trabalhamos", href: "/como-trabalhamos" },
    ],
    related: ["visao-geral", "aparencia", "membro-ou-administrador", "assistente"],
    updatedAt: "2026-10-16",
  },
  {
    slug: "visao-geral",
    category: "comecar",
    title: "A Visão geral",
    summary: "A página que abre depois de entrar, com o resumo da sua empresa e o que está esperando por alguém.",
    audience: "todos",
    keywords: [
      "visao geral",
      "visão geral",
      "painel",
      "inicio",
      "início",
      "dashboard",
      "pagina inicial",
      "precisa de atencao",
      "primeiros passos",
      "ocultar",
      "a pagar",
      "indicadores",
      "resumo",
      "tudo em dia",
    ],
    sections: [
      {
        title: "O que é",
        blocks: [
          {
            kind: "p",
            text: "A Visão geral é a página inicial do Console e abre logo depois que você entra. No menu do computador ela se chama “Visão geral”; no celular, “Início”. Ela reúne os números da sua empresa e o que está esperando por alguém, e cada bloco leva à página onde o assunto se resolve.",
          },
          {
            kind: "p",
            text: "No topo aparecem a saudação, o seu primeiro nome, a data de hoje e o botão “Abrir chamado”.",
          },
          {
            kind: "p",
            text: "Para o Administrador, os valores começam borrados, para ninguém ver de relance. O botão do olho, ao lado de “Abrir chamado”, mostra ou esconde os valores, e o Console lembra a sua escolha neste navegador.",
          },
        ],
      },
      {
        title: "O que aparece, de cima para baixo",
        blocks: [
          {
            kind: "pairs",
            items: [
              { term: "Primeiros passos", text: "As poucas coisas que se fazem uma vez para trabalhar bem com a Anuntech. Aparece enquanto houver passo pendente." },
              { term: "Banco de horas", text: "Quando o contrato da sua empresa tem banco de horas: quanto do mês já foi usado e as últimas horas registradas. Veja [Banco de horas](/ajuda/banco-de-horas)." },
              { term: "Indicadores", text: "Os números principais. Cada quadro abre a lista que está por trás dele." },
              { term: "A pagar", text: "Só para o Administrador: até 5 faturas em aberto ou vencidas, da que vence primeiro para a última, com o botão “Pagar” quando a fatura tem link de pagamento. Sem fatura em aberto, aparece “Nada a pagar agora” e, se houver recorrência, o valor e o vencimento da próxima cobrança." },
              { term: "Precisa de atenção", text: "O que depende de alguém da sua empresa hoje." },
              { term: "Projetos", text: "Até 4 projetos ativos ou pausados, com o progresso das tarefas." },
              { term: "Produtos e serviços", text: "Até 5 itens ativos ou suspensos, os suspensos primeiro. Um app abre dentro do Console, um produto com site abre em outra aba, um serviço abre a página dele e os outros abrem a lista." },
              { term: "Últimos chamados", text: "Os 5 chamados atualizados mais recentemente, com a situação de cada um." },
              { term: "Bookmarks", text: "Os 5 últimos links, arquivos e lousas que você pode ver. Um link abre em outra aba, um arquivo é baixado e uma lousa abre no Console." },
            ],
          },
          {
            kind: "p",
            text: "Nos blocos com lista, “Ver todos” leva à lista completa.",
          },
        ],
      },
      {
        title: "Os indicadores",
        blocks: [
          {
            kind: "pairs",
            items: [
              { term: "A pagar (Administrador)", text: "Soma as faturas em aberto e vencidas. A linha de baixo mostra quantas venceram ou a data da próxima. Sem nada em aberto, mostra a próxima cobrança da recorrência, se houver, ou “Nada em aberto”." },
              { term: "Chamados em andamento", text: "Chamados aguardando atendimento, em atendimento ou aguardando você. A linha de baixo mostra quantos esperam você." },
              { term: "Projetos ativos", text: "Projetos em andamento, sem contar os pausados, e quantas tarefas estão em aberto." },
              { term: "Produtos e serviços", text: "Os produtos e serviços ativos contratados com a Anuntech." },
            ],
          },
        ],
      },
      {
        title: "Precisa de atenção",
        blocks: [
          {
            kind: "pairs",
            items: [
              { term: "Faturas vencidas para pagar", text: "Administrador. Faturas que passaram do vencimento, com o valor em atraso." },
              { term: "Chamados esperando sua resposta", text: "Todos. Chamados em “Aguardando você” que você pode ver, mesmo os que outra pessoa abriu." },
              { term: "Orçamentos para você responder", text: "Administrador. Orçamentos enviados e ainda dentro da validade." },
              { term: "Contratos para você assinar", text: "Administrador. Contratos enviados que ainda esperam a assinatura da sua empresa." },
              { term: "Banco de horas em …%", text: "Todos. Aparece quando o uso do mês chega ao percentual de alerta do seu contrato. O número no canto da linha são as horas já usadas. Para o Administrador, o card do banco de horas mostra também “Aprovar horas além do banco”." },
              { term: "Estimativas de melhoria para aprovar", text: "Administrador. Chamados com estimativa de horas proposta pela equipe." },
              { term: "Entregas para você revisar", text: "Administrador. Tarefas de projeto na coluna Revisão, esperando o seu teste." },
            ],
          },
          {
            kind: "p",
            text: "Clique na linha para ir até o que precisa de você. Depois que o assunto é resolvido, a linha sai sozinha na próxima vez que a página carregar. Sem nada pendente, aparece “Tudo em dia”.",
          },
        ],
      },
      {
        title: "Primeiros passos",
        blocks: [
          {
            kind: "pairs",
            items: [
              {
                term: "Administrador",
                text: "“Revise quem tem acesso ao Console” (abre Membros), “Escolha quem recebe os avisos de chamados” (abre Notificações) e “Leia como a Anuntech trabalha com a …” (abre Como trabalhamos). Quando a empresa já tem uma fatura ou uma recorrência e falta o endereço, “Complete o endereço de cobrança da empresa” (abre Dados da empresa) aparece primeiro.",
              },
              {
                term: "Membro",
                text: "“Complete seu nome e WhatsApp” (abre Minha conta) e “Leia como a Anuntech trabalha com a …”.",
              },
            ],
          },
          {
            kind: "list",
            items: [
              "Clique em um passo para abrir a página onde ele se resolve. O contador mostra quantos já foram feitos.",
              "Abrir Membros, Notificações ou Como trabalhamos já marca o passo correspondente. O passo dos avisos também fica marcado quando alguém salva quem recebe os avisos de chamados. O passo do perfil só fica marcado com o nome preenchido e o WhatsApp confirmado.",
              "Com todos os passos feitos, o card some sozinho.",
              "“Ocultar” esconde o card. Não há como mostrar de novo, mas cada passo continua disponível no lugar dele.",
            ],
          },
          {
            kind: "note",
            tone: "attention",
            text: "Dois avisos do Administrador voltam mesmo com o card oculto, sem o botão “Ocultar”. “Complete o endereço de cobrança da empresa” fica enquanto o endereço estiver incompleto, porque sem ele a cobrança não é emitida. “Revise quem tem acesso: faz 6 meses desde a última revisão” aparece 6 meses depois da última vez que você abriu Membros; abrir a página já conta como revisão.",
          },
        ],
      },
      {
        title: "O que o Membro vê",
        blocks: [
          {
            kind: "p",
            text: "O Membro não vê valores, faturas, orçamentos, contratos, estimativas nem entregas para revisar: esses itens são do Administrador. O banco de horas aparece para todos, em horas. Se o Administrador escolheu “Só o que eu escolher” para um Membro, os projetos, os produtos e serviços, os chamados e as linhas do banco de horas seguem essa escolha. Veja [Escolher o que cada Membro vê](/ajuda/o-que-cada-membro-ve).",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Sou Membro. Por que não vejo “A pagar” nem valores?",
        a: "Valores, faturas, orçamentos, contratos e aprovações são só para o Administrador da empresa. O Membro vê os chamados, os projetos, os produtos e serviços, o banco de horas (em horas) e os bookmarks. Se precisar pagar ou aprovar algo, peça a um Administrador da sua empresa.",
      },
      {
        q: "Quando um item sai de “Precisa de atenção”?",
        a: "Quando o que estava pendente é resolvido (pagar, responder, assinar, aprovar) e a página carrega de novo. Sem nada pendente, aparece “Tudo em dia”.",
      },
      {
        q: "Na linha do banco de horas aparece um número. É o percentual?",
        a: "Não. O percentual está no título, por exemplo “Banco de horas em 85%”. O número no canto da linha são as horas já usadas no mês, arredondadas.",
      },
      {
        q: "Como escondo os Primeiros passos? Dá para mostrar de novo?",
        a: "Clique em “Ocultar”, no canto do card. Não há como mostrar o card de novo, mas cada passo continua no lugar dele: Membros, Notificações, Como trabalhamos e Minha conta. O card também some sozinho quando todos os passos estão feitos.",
      },
      {
        q: "Ocultei os Primeiros passos, mas apareceu “Revise quem tem acesso”. Por quê?",
        a: "Seis meses depois da última vez que você abriu Membros, o Console pede uma nova revisão de quem tem acesso, mesmo com o card oculto. Clique no aviso, confira a lista e remova quem saiu da empresa. Abrir a página já conta como revisão e o aviso some.",
      },
      {
        q: "Apareceu “Complete o endereço de cobrança da empresa” e não consigo ocultar.",
        a: "Sem o endereço de cobrança completo, a cobrança da sua empresa não é emitida. Por isso o passo fica até o endereço ser preenchido. Clique nele, complete o endereço em Dados da empresa e salve.",
      },
      {
        q: "A barra de progresso de um projeto parece baixa. Por quê?",
        a: "A barra conta todas as tarefas do projeto, inclusive os pedidos que ainda estão no Backlog, e só as tarefas em Concluído contam como feitas.",
      },
    ],
    actions: [{ label: "Ir para a Visão geral", href: "/painel" }],
    related: ["conhecer-o-console", "abrir-um-chamado", "banco-de-horas", "membro-ou-administrador"],
    updatedAt: "2026-10-20",
  },
  {
    slug: "meu-perfil",
    category: "conta",
    title: "Meu perfil: nome, foto e WhatsApp",
    summary: "Como mudar o seu nome, a foto ou o avatar e vincular o WhatsApp na página Minha conta.",
    audience: "todos",
    keywords: [
      "meu perfil",
      "minha conta",
      "perfil",
      "nome",
      "trocar nome",
      "foto",
      "foto de perfil",
      "avatar",
      "imagem",
      "remover foto",
      "iniciais",
      "whatsapp",
      "vincular whatsapp",
    ],
    sections: [
      {
        title: "Onde fica",
        blocks: [
          {
            kind: "p",
            text: "Abra o menu da conta (a sua foto ou avatar, no fim do menu do Console) e clique em “Meu perfil”. No celular, toque em “Mais” e, em “Conta”, em “Meu perfil”. O item do menu se chama “Meu perfil”, e a página que abre se chama “Minha conta”, com os cards “Perfil” e “Contatos de acesso”.",
          },
          {
            kind: "p",
            text: "Cada pessoa cuida do próprio perfil. Administrador e Membro veem a mesma página e só mudam os próprios dados.",
          },
        ],
      },
      {
        title: "Mudar o nome",
        blocks: [
          {
            kind: "steps",
            items: [
              "Em Minha conta, no card “Perfil”, edite o campo “Nome”.",
              "Clique em “Salvar”. O botão só fica disponível quando o nome mudou.",
              "Aparece “Nome atualizado.”",
            ],
          },
          {
            kind: "p",
            text: "O nome precisa ter de 2 a 100 caracteres. É assim que você aparece para a equipe da Anuntech e para as outras pessoas da sua empresa, e ele forma as iniciais mostradas quando não há imagem.",
          },
        ],
      },
      {
        title: "Foto ou avatar",
        blocks: [
          {
            kind: "steps",
            items: [
              "Para usar uma foto, clique em “Enviar foto” e escolha uma imagem PNG, JPEG ou WebP de até 20 MB. Aparece “Foto de perfil atualizada.”",
              "Para usar uma ilustração, clique em “Escolher avatar” e escolha uma das ilustrações. Aparece “Avatar atualizado.”",
              "Para tirar a foto, clique em “Remover foto” e confirme em “Remover”. Aparece “Foto removida.” O botão só aparece quando o perfil usa uma foto enviada, e não uma ilustração.",
            ],
          },
          {
            kind: "list",
            items: [
              "Toda conta nova começa com um avatar ilustrado sorteado. São 89 ilustrações para escolher.",
              "Ao remover a foto, o perfil passa a mostrar um avatar ilustrado sorteado. Para trocar por outro, use “Escolher avatar”.",
              "Antes de guardar, o Console recorta a foto em um quadrado pelo centro, reduz para 512 × 512 pixels e apaga os dados do arquivo, como o local e o aparelho em que ela foi tirada.",
              "Veem a sua foto: você, as pessoas com acesso à sua empresa no Console e a equipe da Anuntech.",
            ],
          },
        ],
      },
      {
        title: "Vincular o WhatsApp",
        blocks: [
          {
            kind: "p",
            text: "No card “Contatos de acesso”, a linha “WhatsApp” mostra o número vinculado ou “Não vinculado”. Com o WhatsApp vinculado, você pode entrar com código pelo WhatsApp, e ele é obrigatório para ativar a [verificação em duas etapas](/ajuda/verificacao-em-duas-etapas).",
          },
          {
            kind: "steps",
            items: [
              "Se você entrou há mais de 10 minutos, saia e entre de novo. Sem isso, aparece “Não foi possível validar sua sessão. Entre novamente e refaça a alteração.”",
              "Na linha “WhatsApp”, clique em “Vincular”.",
              "Em “Número com DDD”, digite o número e clique em “Receber código”. Para um número de outro país, comece com + e o código do país.",
              "Digite o “Código de confirmação” que chegou no WhatsApp e clique em “Confirmar”. Aparece “WhatsApp confirmado e atualizado.”",
            ],
          },
          {
            kind: "p",
            text: "Para trocar ou remover o número, ou para trocar o e-mail de acesso, veja [Trocar o e-mail ou o WhatsApp da conta](/ajuda/email-e-whatsapp). Para o Membro, o passo “Complete seu nome e WhatsApp” da Visão geral só fica marcado com o nome preenchido e o WhatsApp confirmado.",
          },
          {
            kind: "note",
            tone: "info",
            text: "O WhatsApp da sua conta serve para entrar e receber códigos. Os avisos da empresa, como cobranças e respostas de chamados, vão para os contatos que o Administrador escolhe em Notificações. Veja [Quem recebe os avisos](/ajuda/notificacoes).",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Quem vê a minha foto?",
        a: "Você, as pessoas com acesso à sua empresa no Console e a equipe da Anuntech. A foto fica guardada de forma privada, reduzida e sem os dados do arquivo, como local e aparelho. Se preferir, use “Escolher avatar” para ter uma ilustração no lugar da foto.",
      },
      {
        q: "Removi a foto e apareceu uma ilustração no lugar das iniciais. Por quê?",
        a: "Quando não há foto, o Console usa um avatar ilustrado sorteado. Para escolher outro, clique em “Escolher avatar”.",
      },
      {
        q: "A foto não sobe. O que eu faço?",
        a: "Confira o formato e o tamanho: PNG, JPEG ou WebP, até 20 MB. Fora disso aparece “Use uma imagem PNG, JPEG ou WebP.” ou “A foto deve ter até 20 MB.” Se a mensagem for “Não foi possível alterar a foto. Tente novamente.”, tente de novo em instantes.",
      },
      {
        q: "Por que o botão “Salvar” do nome está apagado?",
        a: "Ele só fica disponível depois que você muda o nome no campo.",
      },
      {
        q: "Posso mudar o nome ou a foto de outra pessoa?",
        a: "Não. Cada pessoa muda o próprio nome e a própria foto em Minha conta.",
      },
    ],
    actions: [{ label: "Ir para Minha conta", href: "/conta" }],
    related: ["email-e-whatsapp", "verificacao-em-duas-etapas", "notificacoes", "primeiro-acesso"],
    updatedAt: "2026-10-14",
  },
  {
    slug: "email-e-whatsapp",
    category: "conta",
    title: "Trocar o e-mail ou o WhatsApp da conta",
    summary: "Como trocar o e-mail de acesso e vincular, trocar ou remover o WhatsApp, com as confirmações que o Console pede.",
    audience: "todos",
    keywords: [
      "trocar email",
      "alterar email",
      "mudar e-mail",
      "email de acesso",
      "trocar whatsapp",
      "alterar whatsapp",
      "remover whatsapp",
      "numero",
      "telefone",
      "celular novo",
      "perdi o celular",
      "contatos de acesso",
      "entre novamente",
    ],
    sections: [
      {
        title: "Antes de começar",
        blocks: [
          {
            kind: "list",
            items: [
              "O e-mail e o WhatsApp ficam em [Minha conta](/conta), no card “Contatos de acesso”. Cada pessoa troca os próprios contatos.",
              "É preciso ter entrado nos últimos 10 minutos. Se a sua entrada é mais antiga, o Console pede para entrar de novo: saia, entre e faça a alteração logo em seguida.",
              "Com a verificação em duas etapas ativa, os botões ficam desativados e aparece “Com a verificação em duas etapas ativa, e-mail e WhatsApp ficam protegidos. Desative em Segurança para alterá-los.”",
            ],
          },
          {
            kind: "p",
            text: "Como o e-mail e o WhatsApp servem para entrar na conta, o Console pede uma entrada recente e confirma cada contato com um código.",
          },
        ],
      },
      {
        title: "Trocar o e-mail de acesso",
        blocks: [
          {
            kind: "steps",
            items: [
              "Em Minha conta, na linha “E-mail de acesso”, clique em “Alterar”.",
              "Em “Novo e-mail”, digite o endereço e clique em “Enviar códigos”.",
              "Um código chega no e-mail atual e outro no novo. Em “Confirme os dois códigos”, digite cada um no campo “Código enviado para …” correspondente.",
              "Clique em “Confirmar e-mail”. Aparece “E-mail principal atualizado. Entre novamente com o novo endereço.”",
              "Entre de novo com o novo e-mail.",
            ],
          },
          {
            kind: "list",
            items: [
              "Os códigos valem 5 minutos. São 5 tentativas no total; depois disso, peça novos códigos. Para pedir, clique em “Cancelar” e comece de novo em “Alterar”.",
              "A troca encerra todas as sessões da conta, inclusive a deste aparelho.",
              "O e-mail antigo continua ligado à sua conta: o acesso à empresa e o histórico seguem valendo. Ele só deixa de servir para entrar, inclusive pelo Google.",
              "Uma conta pode ter até 5 e-mails, contando os antigos.",
              "O novo e-mail não pode ser de outra conta nem ter acesso a outra empresa no Console.",
            ],
          },
          {
            kind: "note",
            tone: "attention",
            text: "Use um e-mail que você continua acessando. Depois da troca, só o novo e-mail recebe os códigos de entrada.",
          },
        ],
      },
      {
        title: "Vincular ou trocar o WhatsApp",
        blocks: [
          {
            kind: "steps",
            items: [
              "Em Minha conta, na linha “WhatsApp”, clique em “Vincular” ou, se já houver número, em “Alterar”.",
              "Em “Número com DDD”, digite o número. Para um número de outro país, comece com + e o código do país.",
              "Clique em “Receber código”.",
              "Digite o “Código de confirmação” que chegou no WhatsApp e clique em “Confirmar”. Aparece “WhatsApp confirmado e atualizado.”",
            ],
          },
          {
            kind: "list",
            items: [
              "Cada número fica em uma só conta. Se ele já estiver em outra, ao confirmar o código aparece “Este telefone já está vinculado a outra conta. Informe outro número.”",
              "O código vale 5 minutos e aceita 3 tentativas. Um novo código só pode ser pedido 60 segundos depois, com no máximo 5 em 15 minutos.",
              "Trocar o número não muda para onde vão os avisos da empresa: eles seguem os contatos escolhidos em Notificações.",
            ],
          },
        ],
      },
      {
        title: "Remover o WhatsApp",
        blocks: [
          {
            kind: "steps",
            items: [
              "Em Minha conta, na linha “WhatsApp”, clique em “Remover”.",
              "Em “Remover o WhatsApp?”, clique em “Remover”. Aparece “Telefone removido.”",
            ],
          },
          {
            kind: "p",
            text: "O número deixa de servir para entrar. Você continua entrando por e-mail ou Google. Sem WhatsApp, não dá para ativar a verificação em duas etapas. Se aparecer “Não foi possível remover o telefone. Tente novamente.” e a sua entrada tiver mais de 10 minutos, saia, entre de novo e repita.",
          },
        ],
      },
      {
        title: "Mensagens que podem aparecer",
        blocks: [
          {
            kind: "pairs",
            items: [
              { term: "“Entre novamente para alterar os dados de acesso da sua conta.”", text: "A sua entrada tem mais de 10 minutos. Saia, entre de novo e refaça a alteração." },
              { term: "“Não foi possível validar sua sessão. Entre novamente e refaça a alteração.”", text: "O mesmo, na troca do WhatsApp: saia, entre de novo e refaça." },
              { term: "“Este e-mail não está disponível para esta conta.”", text: "O e-mail já pertence a outra conta. Use outro endereço." },
              { term: "“Esta conta já pertence a outro ambiente. Remova o vínculo anterior antes de convidá-la.”", text: "O novo e-mail tem acesso a outra empresa no Console. Use outro endereço ou fale com a equipe da Anuntech." },
              { term: "“Sua conta pode ter até 5 e-mails.”", text: "A conta chegou ao limite, contando os e-mails antigos. Fale com a equipe da Anuntech." },
              { term: "“Confira os dois códigos recebidos. Eles valem por 5 minutos.”", text: "Um dos códigos está errado. Confira qual chegou em cada endereço." },
              { term: "“Os códigos expiraram. Solicite novos códigos.” ou “Limite de tentativas atingido. Solicite novos códigos.”", text: "Clique em “Cancelar” e comece de novo em “Alterar”." },
              { term: "“Aguarde um minuto antes de solicitar novos códigos.” ou “Aguarde antes de pedir outro código.”", text: "Você pediu códigos para o mesmo endereço ou número há menos de 60 segundos, ou já pediu 5 em 15 minutos. Espere e tente de novo." },
              { term: "“Informe um telefone válido com DDD. Para outro país, use + e o DDI.”", text: "Confira o número: DDD e número, ou + e o código do país." },
            ],
          },
        ],
      },
    ],
    faq: [
      {
        q: "Por que os botões “Alterar” do e-mail e do WhatsApp estão desativados?",
        a: "A verificação em duas etapas está ativa e protege esses contatos. Desative-a em Segurança, confirmando um código no e-mail e outro no WhatsApp, faça a troca em Minha conta e ative de novo. Logo depois de desativar, você tem 10 minutos para trocar sem precisar entrar de novo.",
      },
      {
        q: "Ao trocar o e-mail ou o WhatsApp, aparece “Entre novamente”.",
        a: "Mudar um contato de acesso exige ter entrado nos últimos 10 minutos. Saia pelo menu da conta, entre de novo e faça a alteração logo em seguida.",
      },
      {
        q: "Troquei de número ou perdi o celular. E agora?",
        a: "Sem a verificação em duas etapas, entre pelo e-mail ou pelo Google e troque o número em Minha conta logo em seguida. Com ela ativa e sem acesso ao número antigo, você não consegue trocar sozinho: desativar a verificação pede um código no WhatsApp vinculado. Se o canal ligado em Segurança é “E-mail” e o seu e-mail de acesso é uma conta Google, você ainda entra com “Continuar com Google”. Para trocar o número, fale com a equipe da Anuntech pelo link da tela de entrada ou em “Conversar com a equipe”, ou peça a um colega que abra um chamado do tipo “Acesso”.",
      },
      {
        q: "Troquei meu e-mail. Perco o acesso à empresa e o meu histórico?",
        a: "Não. O e-mail antigo continua ligado à sua conta, e o acesso e o histórico seguem valendo. Ele só deixa de servir para entrar, inclusive pelo Google. Depois de confirmar os dois códigos, todas as sessões terminam e você entra com o novo e-mail.",
      },
      {
        q: "Troquei o WhatsApp da conta. Os avisos de cobrança e de chamados vão para o número novo?",
        a: "Não necessariamente. Os avisos da empresa vão para os contatos escolhidos em Notificações, que o Administrador mantém. O WhatsApp da conta serve para entrar e receber códigos.",
      },
      {
        q: "Trabalho para duas empresas clientes. Posso usar a mesma conta?",
        a: "Não. Cada conta pertence a uma única empresa, contando todos os e-mails dela. Para a segunda empresa, peça o acesso com outro e-mail, que vira outra conta. O WhatsApp só pode ficar vinculado a uma das contas.",
      },
    ],
    actions: [
      { label: "Ir para Minha conta", href: "/conta" },
      { label: "Ir para Segurança", href: "/configuracoes/seguranca" },
    ],
    related: ["meu-perfil", "verificacao-em-duas-etapas", "entrar", "sair-e-sessoes"],
    updatedAt: "2026-10-14",
  },
  {
    slug: "verificacao-em-duas-etapas",
    category: "conta",
    title: "Verificação em duas etapas",
    summary: "Como ativar, trocar ou desativar o segundo código que confirma a sua entrada, e para onde ele vai.",
    audience: "todos",
    keywords: [
      "verificacao em duas etapas",
      "duas etapas",
      "2fa",
      "dois fatores",
      "autenticacao",
      "segundo codigo",
      "seguranca",
      "segurança",
      "confirme seu acesso",
      "codigo da segunda etapa",
      "muitas tentativas",
      "bloqueado",
      "proteger conta",
    ],
    sections: [
      {
        title: "O que é",
        blocks: [
          {
            kind: "p",
            text: "Com a verificação em duas etapas, entrar no Console pede um segundo código. Quem entra com o código do e-mail precisa também do código do WhatsApp, e o contrário também vale. Ela é opcional e vale só para a sua conta: cada pessoa ativa a própria.",
          },
          {
            kind: "p",
            text: "Com ela ativa, o seu e-mail e o seu WhatsApp ficam protegidos e só podem ser trocados depois de desativar a verificação.",
          },
        ],
      },
      {
        title: "Antes de ativar",
        blocks: [
          {
            kind: "list",
            items: [
              "Vincule e confirme o WhatsApp em [Minha conta](/conta). Sem ele, os interruptores ficam desativados e aparece “Vincule seu WhatsApp em Minha conta para ativar a verificação.”",
              "Tenha o e-mail e o WhatsApp à mão: toda mudança é confirmada nos dois.",
            ],
          },
        ],
      },
      {
        title: "Ativar",
        blocks: [
          {
            kind: "steps",
            items: [
              "Abra o menu da conta, clique em “Meu perfil” e, no trilho “Conta”, clique em “Segurança”.",
              "No card “Verificação em duas etapas”, ligue o interruptor “E-mail” ou “WhatsApp”. Ele define para onde vai o segundo código quando você entra com o Google.",
              "No quadro “1 de 2 · Confirme seu e-mail”, clique em “Receber código”, digite o código e clique em “Confirmar código”.",
              "Aparece “E-mail confirmado. Agora confirme seu WhatsApp para concluir.” Faça o mesmo no quadro “2 de 2 · Confirme seu WhatsApp”.",
              "Aparece “Configuração de segurança atualizada. As outras sessões foram encerradas.” e o selo muda para “Ativada”.",
            ],
          },
        ],
      },
      {
        title: "Para onde vai o segundo código",
        blocks: [
          {
            kind: "pairs",
            items: [
              { term: "Entrou com o código do e-mail", text: "O segundo código vai para o WhatsApp." },
              { term: "Entrou com o código do WhatsApp", text: "O segundo código vai para o e-mail." },
              { term: "Entrou com o Google", text: "O segundo código vai para o canal ligado em Segurança." },
            ],
          },
          {
            kind: "note",
            tone: "info",
            text: "O card diz “Escolha por onde ele chega”, mas essa escolha só vale para a entrada pelo Google. Nas entradas por código, o segundo código sempre vai para o outro contato. Com “WhatsApp” ligado, a entrada pelo Google também pede o celular; com “E-mail”, quem abre a sua conta Google recebe os dois passos no mesmo lugar.",
          },
        ],
      },
      {
        title: "Trocar o canal ou desativar",
        blocks: [
          {
            kind: "steps",
            items: [
              "Para trocar o canal, ligue o outro interruptor e confirme os dois códigos, primeiro o do e-mail e depois o do WhatsApp.",
              "Para desativar, desligue o interruptor ativo e confirme os dois códigos.",
              "Para desistir no meio, clique em “Cancelar”.",
            ],
          },
        ],
      },
      {
        title: "Na hora de entrar",
        blocks: [
          {
            kind: "steps",
            items: [
              "Depois do primeiro código, ou do Google, abre a tela “Confirme seu acesso”. Ela mostra o contato com parte escondida, como “o WhatsApp •••• 1234” ou “o e-mail ab•••@empresa.com.br”.",
              "Clique em “Receber código”. O segundo código só sai quando você pede.",
              "Digite o “Código da segunda etapa” e clique em “Concluir acesso”, ou apenas complete os 6 números.",
              "Para desistir, clique em “Voltar para entrar”.",
            ],
          },
        ],
      },
      {
        title: "Regras",
        blocks: [
          {
            kind: "list",
            items: [
              "Uma mudança começada em Segurança (ativar, trocar o canal ou desativar) precisa ser concluída em 10 minutos. Depois disso, clique em “Cancelar” e comece de novo.",
              "Cada código vale 5 minutos e aceita 3 tentativas. Um novo código para o mesmo contato só pode ser pedido 60 segundos depois, com no máximo 5 em 15 minutos, contando os códigos de entrada. Logo depois de entrar com o código do e-mail, por exemplo, espere um minuto para pedir o código do e-mail em Segurança.",
              "Na entrada, a segunda etapa precisa ser concluída em até 10 minutos depois do primeiro código ou do Google. Depois disso os códigos deixam de valer e é preciso entrar de novo; ao reabrir a tela, aparece “A verificação expirou. Entre novamente para receber novos códigos.” e o botão “Entrar novamente”.",
              "Depois de 10 códigos errados seguidos na segunda etapa, a entrada fica bloqueada por 15 minutos.",
              "Ao ativar, trocar o canal ou desativar, o Console encerra as sessões abertas em outros aparelhos e cancela as entradas que estavam no meio da segunda etapa. A deste aparelho continua.",
              "Logo depois de desativar, você pode trocar o e-mail ou o WhatsApp sem entrar de novo, durante 10 minutos.",
              "Cada mudança fica registrada.",
            ],
          },
          {
            kind: "note",
            tone: "attention",
            text: "Vai trocar de número ou de celular? Desative a verificação enquanto ainda recebe mensagens no número antigo, porque desativar pede um código nele. Depois troque o WhatsApp em Minha conta e ative de novo.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Por que não consigo ligar os interruptores?",
        a: "A verificação exige um WhatsApp vinculado e confirmado. Vincule o número em Minha conta, no card “Contatos de acesso”, e volte para Segurança.",
      },
      {
        q: "Escolhi “E-mail”, mas o segundo código chegou no WhatsApp.",
        a: "Você entrou com o código do e-mail, então o segundo código foi para o outro contato, o WhatsApp. O canal escolhido em Segurança só vale para a entrada pelo Google.",
      },
      {
        q: "Apareceu “Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.”",
        a: "Foram 10 códigos errados seguidos na segunda etapa. Espere 15 minutos, peça um código novo e use sempre o mais recente.",
      },
      {
        q: "Perdi o celular e a verificação está ativa. Como entro?",
        a: "Se o canal ligado em Segurança é “E-mail” e o seu e-mail de acesso é uma conta Google, entre com “Continuar com Google”: o segundo código vai para o e-mail. Nos outros casos, você não consegue concluir a segunda etapa sozinho. Mesmo entrando, desativar a verificação ou trocar o número pede um código no WhatsApp antigo. Fale com a equipe da Anuntech pelo link “Fale com a equipe da Anuntech” da tela de entrada, ou peça a um colega que abra um chamado do tipo “Acesso”.",
      },
      {
        q: "Ativar a verificação me desconecta?",
        a: "Deste aparelho, não. Os outros aparelhos são desconectados na hora e precisam entrar de novo.",
      },
      {
        q: "Quero trocar o e-mail ou o WhatsApp com a verificação ativa.",
        a: "Desative a verificação em Segurança, faça a troca em Minha conta nos 10 minutos seguintes e ative de novo.",
      },
    ],
    actions: [
      { label: "Ir para Segurança", href: "/configuracoes/seguranca" },
      { label: "Vincular o WhatsApp em Minha conta", href: "/conta" },
    ],
    related: ["email-e-whatsapp", "entrar", "sair-e-sessoes", "seguranca-da-conta"],
    updatedAt: "2026-10-14",
  },
  {
    slug: "aparencia",
    category: "conta",
    title: "Aparência e posição do menu",
    summary: "Como escolher o tema claro, escuro ou do sistema e onde o menu do Console fica na tela.",
    audience: "todos",
    keywords: [
      "aparencia",
      "aparência",
      "tema",
      "modo escuro",
      "tema escuro",
      "dark mode",
      "claro",
      "cores",
      "posicao do menu",
      "menu em cima",
      "menu na lateral",
      "barra do menu",
    ],
    sections: [
      {
        title: "Onde fica",
        blocks: [
          {
            kind: "p",
            text: "Abra o menu da conta e clique em “Aparência”. No celular, toque em “Mais” e, em “Conta”, em “Aparência”. A página também está no trilho “Conta” de Minha conta. Cada pessoa escolhe a sua.",
          },
        ],
      },
      {
        title: "Escolher o tema e a posição do menu",
        blocks: [
          {
            kind: "steps",
            items: [
              "Em “Tema”, escolha “Claro”, “Escuro” ou “Sistema”. “Sistema” segue o tema do seu computador ou celular.",
              "Em “Posição do menu”, escolha “Embaixo”, “Em cima”, “À esquerda” ou “À direita”.",
              "A mudança vale na hora e aparece “Aparência atualizada.”",
            ],
          },
        ],
      },
      {
        title: "O que saber",
        blocks: [
          {
            kind: "list",
            items: [
              "O padrão é o tema “Claro” e o menu “Embaixo”.",
              "A escolha fica guardada neste navegador por 1 ano a partir da última mudança, e não na sua conta. Em outro computador, celular ou navegador, escolha de novo.",
              "No celular, o menu é sempre a barra de abas embaixo, qualquer que seja a posição escolhida.",
              "A sua escolha não muda nada para as outras pessoas da empresa.",
            ],
          },
          {
            kind: "note",
            tone: "info",
            text: "Se você limpar os dados do navegador, a escolha se perde e o Console volta ao padrão.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "O Console tem modo escuro?",
        a: "Sim. Em Aparência, escolha “Escuro”, ou “Sistema” para seguir o tema do aparelho.",
      },
      {
        q: "Mudei o tema, mas no celular (ou em outro computador) ficou igual.",
        a: "A aparência fica salva só no navegador em que você escolheu. Repita a escolha em cada aparelho.",
      },
      {
        q: "Escolhi o menu à esquerda, mas no celular ele continua embaixo.",
        a: "No celular, o menu é sempre a barra de abas embaixo. A posição escolhida vale para telas maiores.",
      },
      {
        q: "A aparência muda para as outras pessoas da empresa?",
        a: "Não. A escolha vale só para o navegador em que você fez.",
      },
    ],
    actions: [{ label: "Ir para Aparência", href: "/configuracoes/aparencia" }],
    related: ["conhecer-o-console", "meu-perfil"],
    updatedAt: "2026-10-14",
  },
  {
    slug: "sair-e-sessoes",
    category: "conta",
    title: "Sair e sessões",
    summary: "Como sair do Console, quanto tempo você fica conectado e como ver onde a sua conta está aberta.",
    audience: "todos",
    keywords: [
      "sair",
      "logout",
      "deslogar",
      "desconectar",
      "sessao",
      "sessões",
      "sessoes recentes",
      "outro computador",
      "computador compartilhado",
      "conectado",
      "pediu para entrar de novo",
      "expirou",
      "encerrar sessao",
    ],
    sections: [
      {
        title: "Sair",
        blocks: [
          {
            kind: "steps",
            items: [
              "No computador, clique na sua foto ou avatar, no fim do menu do Console, e depois em “Sair”. No celular, toque em “Mais” e, em “Conta”, em “Sair”.",
              "O Console mostra “Saindo…” e volta para a tela “Entre no Console”.",
            ],
          },
          {
            kind: "p",
            text: "Sair encerra só o acesso deste aparelho e deste navegador. Em computadores compartilhados, saia sempre ao terminar.",
          },
        ],
      },
      {
        title: "Quanto tempo você fica conectado",
        blocks: [
          {
            kind: "list",
            items: [
              "Cada entrada vale até 7 dias, e o uso do Console pode renovar esse prazo. Quando ele termina, o Console pede para entrar de novo.",
              "Ativar, trocar o canal ou desativar a [verificação em duas etapas](/ajuda/verificacao-em-duas-etapas) encerra as sessões dos outros aparelhos. A deste aparelho continua.",
              "Trocar o e-mail de acesso encerra todas as sessões, inclusive a deste aparelho.",
            ],
          },
        ],
      },
      {
        title: "Sessões recentes",
        blocks: [
          {
            kind: "steps",
            items: [
              "Abra o menu da conta, clique em “Meu perfil” e, no trilho “Conta”, clique em “Segurança”.",
              "Role até “Sessões recentes”. Cada linha mostra o navegador e o aparelho, como “Chrome · Mac”, a data em “Iniciada em …” e, se ainda vale, “ativa até …”.",
            ],
          },
          {
            kind: "pairs",
            items: [
              { term: "Esta sessão", text: "A deste aparelho, que você está usando agora." },
              { term: "Ativa", text: "Outra sessão que ainda vale." },
              { term: "Expirada", text: "Passou da validade sem uso e não serve mais." },
              { term: "Encerrada", text: "Já terminou: você saiu, ela foi encerrada por uma troca de e-mail ou por uma mudança na verificação em duas etapas, ou expirou e foi apagada." },
            ],
          },
          {
            kind: "p",
            text: "A lista mostra as 20 sessões mais recentes, com a deste aparelho primeiro. Ela serve para consulta: não há botão para encerrar uma sessão específica.",
          },
        ],
      },
      {
        title: "Se você não reconhece uma sessão",
        blocks: [
          {
            kind: "steps",
            items: [
              "Confira se não é um aparelho seu, como o celular ou outro navegador.",
              "Se não for, encerre as outras sessões: em Segurança, ative a verificação em duas etapas, ou troque o canal se ela já estiver ativa. Isso desconecta todos os outros aparelhos na hora.",
              "Avise a equipe da Anuntech em “Conversar com a equipe” ou abra um chamado do tipo “Acesso”.",
            ],
          },
          {
            kind: "note",
            tone: "attention",
            text: "Para ativar a verificação em duas etapas, o WhatsApp precisa estar vinculado em Minha conta. Faça isso antes de precisar.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Como saio do Console em outro computador?",
        a: "“Sair” encerra só o aparelho em que você clica, e não há botão para encerrar outras sessões. Para desconectar os outros aparelhos na hora, ative, troque o canal ou desative a verificação em duas etapas em Segurança.",
      },
      {
        q: "Por que o Console pediu para entrar de novo?",
        a: "Cada entrada vale até 7 dias, e o uso do Console pode renovar esse prazo; quando ele termina, é preciso entrar de novo. Também pedem nova entrada: trocar o e-mail de acesso, que encerra todas as sessões, e mudar a verificação em duas etapas em outro aparelho, que encerra as sessões dos demais. Para trocar o e-mail ou o WhatsApp, o Console pede uma entrada feita há menos de 10 minutos.",
      },
      {
        q: "Fechei o navegador. Preciso entrar de novo?",
        a: "Não, enquanto a sessão valer. Por isso, em computador compartilhado, use “Sair” antes de fechar.",
      },
      {
        q: "O que quer dizer “Dispositivo não informado”?",
        a: "O navegador daquela sessão não se identificou. Se você não reconhece a sessão, siga os passos de “Se você não reconhece uma sessão”.",
      },
      {
        q: "Apareceu “Não foi possível sair. Tente novamente.”",
        a: "A conexão falhou ao sair. Confira a internet e clique em “Sair” de novo.",
      },
    ],
    actions: [{ label: "Ver sessões em Segurança", href: "/configuracoes/seguranca" }],
    related: ["verificacao-em-duas-etapas", "entrar", "seguranca-da-conta", "email-e-whatsapp"],
    updatedAt: "2026-10-14",
  },
];
