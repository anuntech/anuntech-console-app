import type { HelpArticle } from "../help-model";

export const bookmarksAssistenteArticles: HelpArticle[] = [
  {
    slug: "bookmarks",
    category: "bookmarks",
    title: "Arquivos e links",
    summary: "Guarde em Arquivos os arquivos (até 100 GB cada), os links e as lousas que a sua empresa usa e troca com a Anuntech, organizados em pastas.",
    audience: "todos",
    keywords: [
      "bookmarks",
      "bookmark",
      "favoritos",
      "marcadores",
      "link",
      "links",
      "guardar link",
      "salvar link",
      "arquivo",
      "guardar arquivo",
      "baixar arquivo",
      "drive",
      "tamanho do arquivo",
      "100 GB",
      "arquivos grandes",
      "enviar arquivos",
      "espaço",
      "cota",
      "5 GB",
      "excluir bookmark",
    ],
    sections: [
      {
        title: "O que é",
        blocks: [
          {
            kind: "p",
            text: "Arquivos (antes chamado Bookmarks) é o lugar da sua empresa para guardar e trocar arquivos com a Anuntech, de qualquer tipo e até 100 GB cada, e também endereços úteis, como o painel do site ou um arquivo no Figma. Cada item guarda uma coisa só: um arquivo, um link ou uma [lousa](/ajuda/lousas).",
          },
          {
            kind: "p",
            text: "Administradores e Membros têm os mesmos direitos aqui: os dois veem, adicionam e organizam bookmarks. Quem vê cada bookmark depende da pasta onde ele está, como explica [Pastas e compartilhamento](/ajuda/pastas-e-compartilhamento).",
          },
        ],
      },
      {
        title: "Onde fica",
        blocks: [
          {
            kind: "list",
            items: [
              "No computador: “Arquivos”, no menu do Console.",
              "No celular: toque em “Mais” e, na seção “Mais áreas”, em “Arquivos”.",
              "Na [Visão geral](/painel), o bloco “Arquivos” mostra os 5 itens adicionados mais recentemente entre os que você pode ver. “Ver todos” abre a página.",
            ],
          },
        ],
      },
      {
        title: "Enviar vários arquivos de uma vez",
        blocks: [
          {
            kind: "steps",
            items: [
              "Em [Arquivos](/bookmarks), abra a pasta onde os arquivos devem ficar.",
              "Arraste os arquivos do seu computador para a lista, ou clique em “Enviar arquivos” e selecione vários.",
              "Cada arquivo vira um item com o nome do arquivo como título. No canto da tela aparece o andamento de cada um.",
            ],
          },
          {
            kind: "note",
            tone: "attention",
            text: "Deixe a página aberta até o envio terminar. Se fechar a aba ou a conexão cair, o que não terminou é descartado e não ocupa espaço: envie de novo. Arraste arquivos, não pastas.",
          },
        ],
      },
      {
        title: "Adicionar um link ou um arquivo",
        blocks: [
          {
            kind: "steps",
            items: [
              "Em [Arquivos](/bookmarks), clique em “Adicionar”. Se você estiver dentro de uma pasta, ela já vem escolhida.",
              "Preencha o “Título”, por exemplo: Identidade visual no Drive.",
              "Em “Tipo”, escolha “Link” ou “Arquivo”.",
              "Para um link, cole o endereço completo em “Link”, começando com https://. Para um arquivo, arraste o arquivo para o campo “Arquivo” ou clique nele para selecionar.",
              "Em “Pasta”, escolha uma pasta ou deixe “Sem pasta”.",
              "Clique em “Adicionar bookmark”. Um arquivo grande mostra o andamento (“Enviando 40%”); ao terminar, aparece “Bookmark salvo.”.",
            ],
          },
          {
            kind: "note",
            tone: "attention",
            text: "Um bookmark em “Sem pasta” fica visível para todas as pessoas da sua empresa no Console. Para guardar algo só para algumas pessoas, adicione dentro de uma pasta “Só pessoas escolhidas”.",
          },
        ],
      },
      {
        title: "Limites",
        blocks: [
          {
            kind: "pairs",
            items: [
              { term: "Título", text: "Obrigatório, com até 160 caracteres." },
              {
                term: "Link",
                text: "Endereço http ou https, com até 2.048 caracteres e sem usuário ou senha dentro do endereço. Se o link não servir, aparece “Informe um link HTTP ou HTTPS válido, sem credenciais.”.",
              },
              {
                term: "Arquivo",
                text: "Qualquer tipo, até 100 GB, um arquivo por item. Acima disso, aparece “Escolha um arquivo de até 100 GB.”.",
              },
              {
                term: "Espaço",
                text: "Cada empresa tem 5 GB para os seus arquivos, somando todas as pastas. A coluna da esquerda mostra quanto já foi usado (por exemplo, “1,2 GB de 5,0 GB”). Sem espaço, aparece “O espaço da empresa acabou” com quanto resta: exclua arquivos que não usa mais ou fale com a Anuntech para aumentar.",
              },
              {
                term: "Tipo",
                text: "Escolhido ao adicionar, não muda depois. Um bookmark de link continua de link; para guardar um arquivo no lugar dele, adicione outro bookmark.",
              },
            ],
          },
        ],
      },
      {
        title: "Encontrar e abrir",
        blocks: [
          {
            kind: "list",
            items: [
              "Em telas a partir de 1024 px de largura, a coluna da esquerda mostra “Todos”, “Sem pasta” e, em “Pastas”, cada pasta com o número de itens. Em telas menores, como no celular, escolha a pasta no seletor acima da lista, que começa em “Todos os bookmarks”.",
              "O campo “Buscar por título, link ou nome do arquivo” procura no título, no endereço do link e no nome do arquivo.",
              "Os ícones “Lista” e “Grade”, ao lado da busca, mudam a forma de mostrar. A escolha fica guardada neste navegador.",
              "Clique no item: um link abre em outra aba, uma lousa abre no Console, e um arquivo abre na prévia quando é imagem, PDF, vídeo, áudio ou texto; os outros tipos são baixados.",
            ],
          },
          {
            kind: "p",
            text: "A lista vai do mais recente para o mais antigo, pela data em que cada bookmark foi adicionado. Editar não muda a ordem. No rodapé, “Por página” mostra 10, 25, 50 ou 100 itens; o padrão é 25.",
          },
        ],
      },
      {
        title: "Editar, mover e excluir",
        blocks: [
          {
            kind: "steps",
            items: [
              "Clique em “…” no bookmark.",
              "“Editar” muda o “Título”, o “Link” (em bookmark de link) e a “Pasta”. Clique em “Salvar”.",
              "“Mover para” leva o bookmark para outra pasta que você vê ou para “Sem pasta”.",
              "“Excluir” pergunta “Mover para a lixeira?” e move quando você confirma. O mesmo botão aparece dentro de “Editar bookmark”.",
            ],
          },
          {
            kind: "p",
            text: "Editar, mover e excluir ficam com quem adicionou o bookmark, com quem criou a pasta onde ele está e com a equipe da Anuntech. As outras pessoas veem no menu só a opção de abrir ou baixar. Ser Administrador da empresa não dá esse direito em Bookmarks.",
          },
          {
            kind: "p",
            text: "Para trocar o arquivo, abra “Editar” e, em “Versões”, clique em “Enviar nova versão”. O arquivo novo passa a ser o do item e o anterior fica guardado como “Versão 1”, “Versão 2” e assim por diante. Em cada versão, o botão de download baixa aquele arquivo e o de restaurar faz ele voltar a ser o atual (o que estava vira uma versão, nada se perde). Enviar e restaurar versões fica com quem pode editar o item. As versões ocupam o espaço da empresa e saem junto com o item quando ele é excluído de vez.",
          },
        ],
      },
      {
        title: "Compartilhar por link",
        blocks: [
          {
            kind: "p",
            text: "Para mandar um arquivo ou uma pasta a alguém que não tem conta no Console, clique em “…” e em “Compartilhar por link…”. Quem receber o endereço vê os arquivos e baixa, sem entrar. Numa pasta, o link leva também os arquivos das pastas de dentro.",
          },
          {
            kind: "list",
            items: [
              "“Vale por”: 1, 7 (o padrão), 30 ou 90 dias, ou “Sem prazo”.",
              "“Limite de downloads”: depois desse número de downloads, o link para. Vazio, não tem limite.",
              "“Senha”: opcional, de 6 a 100 caracteres. Antes da senha, a página não mostra nem o nome do que foi compartilhado. Mande a senha por outro canal, não junto do link.",
              "“Enviar o link por e-mail”: opcional. O Console manda o endereço para a pessoa.",
            ],
          },
          {
            kind: "p",
            text: "Clique em “Criar link” e copie o endereço na hora: por segurança, ele não aparece de novo. Em “Links criados”, você vê cada link, até quando vale e quantos downloads teve. “Desligar” para o link na hora, mesmo para quem já tinha aberto.",
          },
          {
            kind: "note",
            tone: "attention",
            text: "Qualquer pessoa com o endereço abre o link. Use prazo curto, senha ou limite de downloads para arquivos sensíveis, e desligue o link quando não precisar mais.",
          },
        ],
      },
      {
        title: "Pedir arquivos",
        blocks: [
          {
            kind: "p",
            text: "Para receber arquivos de alguém sem conta, clique em “…” numa pasta e em “Pedir arquivos…”. Escolha por quanto tempo o link vale e, se quiser, uma senha, e envie o endereço. A pessoa escreve o nome (opcional), escolhe ou arrasta os arquivos e envia. Cada arquivo chega na pasta no seu nome, com o nome de quem enviou no histórico.",
          },
          {
            kind: "list",
            items: [
              "Quem envia não vê o que já está na pasta.",
              "Programas e scripts (como .exe, .bat, .sh, .dmg e .apk) não são aceitos. A pessoa pode mandar em .zip.",
              "Os arquivos recebidos ocupam o espaço da empresa. Quando o espaço acaba, o link deixa de receber.",
            ],
          },
          {
            kind: "p",
            text: "“Compartilhar por link” e “Pedir arquivos” ficam com quem pode editar o item ou criou a pasta, e com a equipe da Anuntech.",
          },
        ],
      },
      {
        title: "Lixeira",
        blocks: [
          {
            kind: "p",
            text: "O que você exclui vai para a “Lixeira”, na coluna da esquerda (no celular, no seletor de pastas), e fica lá por 30 dias, com o arquivo, o link ou o desenho. Cada item mostra quantos dias faltam. Na lixeira, nada abre nem baixa.",
          },
          {
            kind: "list",
            items: [
              "“Restaurar”, no menu “…”, devolve o item para a pasta onde estava, ou para “Sem pasta” se a pasta foi excluída.",
              "“Excluir de vez” apaga o item e o arquivo na hora. Isso não tem volta.",
              "Depois de 30 dias, o item sai da lixeira sozinho, para sempre.",
              "Restaurar e excluir de vez ficam com quem adicionou o item, com quem criou a pasta e com a equipe da Anuntech.",
            ],
          },
          {
            kind: "note",
            tone: "attention",
            text: "Os arquivos da lixeira continuam ocupando o espaço da empresa até saírem. Para liberar espaço na hora, use “Excluir de vez”.",
          },
        ],
      },
      {
        title: "Baixar arquivos",
        blocks: [
          {
            kind: "p",
            text: "Imagens (PNG, JPEG, GIF, WebP, AVIF, SVG), PDF, vídeos (MP4, WebM, MOV), áudios (MP3, M4A, WAV, OGG) e textos (TXT, MD, CSV, JSON, CSS, até 2 MB) abrem na prévia, dentro do Console, com o botão “Baixar” ao lado. No menu “…”, “Ver” abre a prévia e “Baixar arquivo” baixa. Os outros tipos, como páginas HTML, planilhas ou instaladores, são sempre baixados, por segurança.",
          },
          {
            kind: "p",
            text: "O download vai direto para a pasta de downloads, mesmo de arquivos grandes, e aparece na lista de downloads do navegador. Abra o arquivo baixado no programa que você usa.",
          },
          {
            kind: "p",
            text: "Se o download não começar, recarregue a página. Se a sua sessão terminou, o Console pede para você entrar de novo. Depois, confira se o item ainda aparece para você e clique outra vez.",
          },
          {
            kind: "note",
            tone: "attention",
            text: "Não guarde senhas em bookmarks, nem no título, nem no link, nem em arquivos. Se a equipe precisar de um acesso, ela combina com você um jeito seguro.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Quem vê os bookmarks que eu guardo?",
        a: "Depende de onde você guarda. Em “Sem pasta” ou numa pasta “Todos da empresa”: todas as pessoas da sua empresa no Console, Administradores e Membros. Numa pasta “Só pessoas escolhidas”: quem criou a pasta e as pessoas escolhidas. A equipe da Anuntech vê todos os bookmarks.",
      },
      {
        q: "Qual o tamanho máximo de arquivo e que tipos posso guardar?",
        a: "Qualquer tipo de arquivo, até 100 GB, um arquivo por item. Cada empresa tem 5 GB no total; a coluna da esquerda mostra quanto já foi usado. Uma lousa pode ter até 3 MB, contando as imagens coladas nela.",
      },
      {
        q: "O espaço da empresa acabou. O que faço?",
        a: "Exclua os arquivos que não usa mais e, na “Lixeira”, use “Excluir de vez”: o espaço volta na hora. O que fica na lixeira ainda ocupa espaço por até 30 dias. Se precisar de mais de 5 GB, fale com a Anuntech por um [chamado](/chamados/novo).",
      },
      {
        q: "Excluí um arquivo sem querer. Dá para recuperar?",
        a: "Sim, por 30 dias. Abra a “Lixeira”, clique em “…” no item e em “Restaurar”. Ele volta para a pasta onde estava.",
      },
      {
        q: "Como troco o arquivo de um item sem perder o anterior?",
        a: "Em “Editar”, na seção “Versões”, clique em “Enviar nova versão”. O anterior fica guardado como versão e pode ser baixado ou restaurado a qualquer momento.",
      },
      {
        q: "Como mando um arquivo grande para alguém sem conta no Console?",
        a: "No “…” do arquivo ou da pasta, clique em “Compartilhar por link…”, escolha o prazo (e, se quiser, senha e limite de downloads) e copie o endereço. Para receber arquivos de alguém, use “Pedir arquivos…” numa pasta.",
      },
      {
        q: "Mandei um link para a pessoa errada. E agora?",
        a: "Abra “Compartilhar por link…” no mesmo arquivo ou pasta e, em “Links criados”, clique em “Desligar”. O link para na hora.",
      },
      {
        q: "Sou Administrador. Posso apagar ou mudar os bookmarks de outra pessoa?",
        a: "Só se o bookmark estiver numa pasta que você criou. Fora disso, um bookmark só pode ser alterado por quem o adicionou ou pela equipe da Anuntech. Se a pessoa saiu da empresa, [abra um chamado](/chamados/novo) e peça à equipe para reorganizar ou excluir.",
      },
      {
        q: "Por que a busca não encontra o meu arquivo?",
        a: "A busca procura no título, no endereço do link e no nome do arquivo, mas não dentro do conteúdo. Confira a empresa e a pasta escolhidas: a busca vale para o que está aberto. Tente também uma palavra menor.",
      },
      {
        q: "A lista abriu em cartões. Como vejo em linhas?",
        a: "Clique no ícone “Lista”, ao lado da busca. A escolha fica guardada neste navegador; em outro computador ou navegador, a página abre em “Grade” até você escolher de novo.",
      },
      {
        q: "Por que o arquivo baixa em vez de abrir?",
        a: "A prévia mostra imagens, PDF, vídeos, áudios e textos de até 2 MB. Os outros tipos sempre saem como download, por segurança, para nenhum conteúdo deles rodar dentro do Console. Abra o arquivo baixado no seu aparelho.",
      },
    ],
    actions: [{ label: "Ir para Arquivos", href: "/bookmarks" }],
    related: ["pastas-e-compartilhamento", "lousas", "visao-geral"],
    updatedAt: "2026-10-26",
  },
  {
    slug: "pastas-e-compartilhamento",
    category: "bookmarks",
    title: "Pastas e compartilhamento",
    summary: "Crie pastas para organizar os bookmarks e escolha se cada pasta é vista pela empresa toda ou só por pessoas escolhidas.",
    audience: "todos",
    keywords: [
      "pasta",
      "pastas",
      "nova pasta",
      "compartilhar",
      "compartilhamento",
      "quem ve",
      "pasta privada",
      "privado",
      "so pessoas escolhidas",
      "todos da empresa",
      "renomear pasta",
      "excluir pasta",
      "restringir acesso",
      "permissao bookmarks",
    ],
    sections: [
      {
        title: "Quem vê o quê",
        blocks: [
          {
            kind: "pairs",
            items: [
              { term: "Sem pasta", text: "Todas as pessoas da sua empresa no Console, Administradores e Membros." },
              { term: "Pasta “Todos da empresa”", text: "Todas as pessoas da sua empresa no Console." },
              { term: "Pasta “Só pessoas escolhidas”", text: "Quem criou a pasta e as pessoas escolhidas, até 50." },
              { term: "Equipe da Anuntech", text: "Vê todas as pastas e todos os bookmarks, inclusive os das pastas “Só pessoas escolhidas”." },
            ],
          },
          {
            kind: "p",
            text: "Ao abrir uma pasta “Só pessoas escolhidas”, o cabeçalho mostra quem a vê: “Só você” ou o nome de quem criou a pasta e o número de pessoas escolhidas, como “Só Marina e 3 pessoas”. Uma pasta aberta a toda a empresa não traz essa linha. Na coluna da esquerda, uma pasta “Só pessoas escolhidas” aparece com o ícone de pessoas.",
          },
          {
            kind: "p",
            text: "Quem vê uma pasta também pode adicionar bookmarks nela.",
          },
          {
            kind: "p",
            text: "O [assistente](/ajuda/assistente) segue as mesmas regras: ele só encontra os bookmarks que você vê na página Bookmarks. Os de uma pasta “Só pessoas escolhidas” ficam de fora para quem não está entre as pessoas da pasta.",
          },
          {
            kind: "p",
            text: "A escolha “Só o que eu escolher”, que o Administrador faz para um Membro, limita projetos, produtos e chamados. Ela não vale para os Bookmarks: ali o Membro vê o que as regras das pastas permitem. Veja [Escolher o que cada Membro vê](/ajuda/o-que-cada-membro-ve).",
          },
        ],
      },
      {
        title: "Criar uma pasta",
        blocks: [
          {
            kind: "steps",
            items: [
              "Em [Bookmarks](/bookmarks), clique em “Nova pasta”. No computador, ela fica na coluna da esquerda, abaixo das pastas. No celular, é o ícone de pasta com + ao lado de “Adicionar”.",
              "Dê um “Nome”, por exemplo: Referências de design.",
              "Em “Quem vê”, escolha “Todos da empresa” ou “Só pessoas escolhidas”. As pessoas você escolhe depois, em “Compartilhar”.",
              "Clique em “Criar pasta”. A pasta abre em seguida.",
            ],
          },
          {
            kind: "p",
            text: "O nome é obrigatório e tem até 80 caracteres. Uma pasta “Só pessoas escolhidas” sem ninguém escolhido fica só com você, e o cabeçalho mostra “Só você”.",
          },
        ],
      },
      {
        title: "Pastas dentro de pastas",
        blocks: [
          {
            kind: "list",
            items: [
              "Abra uma pasta e clique em “Nova pasta”: a nova fica dentro dela. Dá para ir até 5 níveis, como Marca › Logo › SVG.",
              "Uma pasta dentro de outra é vista por quem vê a pasta de cima. Mudar quem vê uma pasta, em “Compartilhar”, muda também as pastas de dentro.",
              "Dentro de uma pasta, as pastas dela aparecem acima dos arquivos, e o topo da página mostra o caminho; clique em uma pasta do caminho para voltar até ela. Na coluna da esquerda, as pastas de dentro aparecem recuadas, abaixo da de cima.",
              "“Mover para…”, no menu “…” da pasta, leva a pasta, com tudo o que tem dentro, para outra pasta da mesma empresa ou para o início. Quem vê passa a seguir a pasta de destino. Mover fica com quem criou a pasta e com a equipe da Anuntech.",
              "Excluir uma pasta não apaga o que está nela: os arquivos e as pastas de dentro sobem um nível.",
            ],
          },
        ],
      },
      {
        title: "Compartilhar com pessoas escolhidas",
        blocks: [
          {
            kind: "steps",
            items: [
              "Na coluna da esquerda, passe o mouse sobre a pasta, clique em “…” e depois em “Compartilhar”.",
              "Em “Quem vê”, escolha “Só pessoas escolhidas”. Aparece o campo “Pessoas”.",
              "Digite um nome em “Buscar pessoa pelo nome” e clique na pessoa para incluir. Para tirar alguém, clique no x ao lado do nome.",
              "Clique em “Salvar”. Aparece “Compartilhamento atualizado.”.",
            ],
          },
          {
            kind: "list",
            items: [
              "Cabem até 50 pessoas por pasta. Acima disso, aparece “Compartilhe com até 50 pessoas.”.",
              "A busca encontra pelo nome as pessoas ativas da sua empresa e da equipe da Anuntech, até 8 por vez. Sem resultado, aparece “Ninguém com esse nome.”.",
              "Só entram pessoas que já têm acesso à empresa no Console. Para incluir alguém novo, um Administrador convida a pessoa antes, em Membros. Ela aparece na busca depois de entrar no Console pela primeira vez.",
              "Para abrir a pasta para todos, escolha “Todos da empresa” e clique em “Salvar”. A lista de pessoas escolhidas é apagada e aparece “Pasta aberta para toda a empresa.”.",
              "Quem perde o acesso à empresa deixa de ver a pasta, mesmo que o nome continue na lista.",
            ],
          },
        ],
      },
      {
        title: "Renomear e excluir",
        blocks: [
          {
            kind: "steps",
            items: [
              "Para renomear: passe o mouse sobre a pasta, clique em “…” e em “Renomear”. Mude o nome e clique em “Salvar”.",
              "Para excluir: passe o mouse sobre a pasta, clique em “…”, depois em “Excluir pasta”, e confirme em “Excluir pasta”.",
            ],
          },
          {
            kind: "p",
            text: "Excluir a pasta não apaga os bookmarks: eles continuam na empresa, em “Sem pasta”, e o compartilhamento é desfeito.",
          },
          {
            kind: "note",
            tone: "attention",
            text: "Em “Sem pasta”, os bookmarks ficam visíveis para toda a empresa. Antes de excluir uma pasta “Só pessoas escolhidas”, mova o que for reservado para outra pasta restrita ou exclua esses bookmarks. O mesmo cuidado vale ao usar “Mover para” e escolher “Sem pasta”.",
          },
        ],
      },
      {
        title: "Quem pode mudar uma pasta",
        blocks: [
          {
            kind: "p",
            text: "Renomear, compartilhar e excluir uma pasta ficam com quem a criou e com a equipe da Anuntech. Só essas pessoas veem o menu “…” da pasta. Ser Administrador da empresa não dá esse direito, nem acesso às pastas “Só pessoas escolhidas” de outras pessoas.",
          },
          {
            kind: "p",
            text: "Quem criou a pasta também pode editar, mover e excluir qualquer bookmark que esteja dentro dela, inclusive os adicionados por outras pessoas.",
          },
          {
            kind: "note",
            tone: "info",
            text: "O menu “…” das pastas fica na coluna da esquerda, que aparece em telas a partir de 1024 px de largura. No celular dá para ver, buscar, adicionar e criar pastas. Para renomear, compartilhar ou excluir, use um computador ou um tablet na horizontal.",
          },
          {
            kind: "note",
            tone: "attention",
            text: "Mesmo numa pasta restrita, não guarde senhas nem dados reais dos seus clientes em bookmarks.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Excluí uma pasta. Os bookmarks dela foram apagados?",
        a: "Não. Eles continuam na empresa, em “Sem pasta”, e ficam visíveis para toda a empresa. Se a pasta era “Só pessoas escolhidas”, mova o que for reservado para outra pasta restrita ou exclua esses bookmarks.",
      },
      {
        q: "Sou Administrador. Consigo ver as pastas restritas dos Membros?",
        a: "Só se quem criou a pasta incluir você. Ser Administrador não dá acesso às pastas “Só pessoas escolhidas” de outras pessoas, nem permite renomeá-las ou excluí-las.",
      },
      {
        q: "Por que não vejo o menu “…” numa pasta?",
        a: "Só quem criou a pasta vê esse menu, e ele aparece ao passar o mouse sobre a pasta na coluna da esquerda, em telas a partir de 1024 px. Se você precisa mudar uma pasta de outra pessoa, peça a ela.",
      },
      {
        q: "Por que não consigo renomear, compartilhar ou excluir uma pasta pelo celular?",
        a: "As opções da pasta ficam na coluna de pastas, que só aparece em telas a partir de 1024 px de largura. No celular dá para ver, buscar, adicionar e criar pastas. Para o resto, use um computador ou um tablet na horizontal.",
      },
      {
        q: "Posso compartilhar uma pasta com alguém de fora da empresa?",
        a: "Não. A busca só mostra quem tem acesso à sua empresa no Console e a equipe da Anuntech. Se a pessoa ainda não tem acesso, um Administrador convida antes em Membros, e ela aparece na busca depois de entrar no Console pela primeira vez. Se alguém perder o acesso antes de você salvar, aparece “Uma das pessoas escolhidas não participa desta empresa.”.",
      },
      {
        q: "Quem criou a pasta saiu da empresa. E agora?",
        a: "A pasta e os bookmarks continuam onde estão. Como só quem criou a pasta pode renomear, compartilhar ou excluir, [abra um chamado](/chamados/novo) e peça à equipe da Anuntech para reorganizar.",
      },
    ],
    actions: [{ label: "Ir para Bookmarks", href: "/bookmarks" }],
    related: ["bookmarks", "lousas", "o-que-cada-membro-ve", "membro-ou-administrador"],
    updatedAt: "2026-10-14",
  },
  {
    slug: "lousas",
    category: "bookmarks",
    title: "Lousas",
    summary: "A lousa é um quadro em branco dentro de Bookmarks para desenhar fluxos, rabiscar telas e anotar ideias, e salva sozinha.",
    audience: "todos",
    keywords: [
      "lousa",
      "lousas",
      "quadro",
      "quadro branco",
      "whiteboard",
      "desenhar",
      "desenho",
      "rabisco",
      "diagrama",
      "fluxograma",
      "excalidraw",
      "exportar imagem",
      "png",
      "tela cheia",
    ],
    sections: [
      {
        title: "O que é",
        blocks: [
          {
            kind: "p",
            text: "A lousa é o terceiro tipo de bookmark, ao lado de link e arquivo: um quadro em branco para desenhar fluxos, rabiscar telas e anotar ideias. Ela fica guardada com os bookmarks da empresa, na pasta que você escolher, e segue as mesmas regras de quem vê. Veja [Pastas e compartilhamento](/ajuda/pastas-e-compartilhamento).",
          },
        ],
      },
      {
        title: "Criar uma lousa",
        blocks: [
          {
            kind: "steps",
            items: [
              "Em [Bookmarks](/bookmarks), clique em “Adicionar”. Se você estiver dentro de uma pasta, ela já vem escolhida.",
              "Preencha o “Título”, por exemplo: Fluxo do onboarding.",
              "Em “Tipo”, escolha “Lousa”.",
              "Em “Pasta”, escolha uma pasta ou deixe “Sem pasta”.",
              "Clique em “Criar lousa”. Aparece “Lousa criada.” e a lousa abre em seguida.",
            ],
          },
        ],
      },
      {
        title: "Desenhar",
        blocks: [
          {
            kind: "steps",
            items: [
              "Escolha uma ferramenta na barra do quadro e desenhe.",
              "No topo da página aparece “Salvando…” e depois “Salvo”, com há quanto tempo, como “Salvo agora”.",
              "Para usar a tela inteira, clique em “Tela cheia”, no canto superior direito do quadro. Esc ou “Sair da tela cheia” volta.",
              "No menu do quadro (o ícone de três linhas) ficam “Exportar imagem...”, “Limpar o canvas e redefinir a cor de fundo”, “Voltar aos bookmarks” e “Fundo da tela”.",
              "Para mudar o título ou a pasta, volte a Bookmarks, clique em “…” na lousa e em “Editar”. O desenho fica como está.",
            ],
          },
          {
            kind: "p",
            text: "Para abrir uma lousa depois, clique nela em Bookmarks ou no bloco “Bookmarks” da [Visão geral](/painel). Na grade, a lousa aparece com uma miniatura do desenho.",
          },
        ],
      },
      {
        title: "Como a lousa salva",
        blocks: [
          {
            kind: "list",
            items: [
              "A lousa salva sozinha pouco mais de 1 segundo depois do último traço. Não há botão de salvar.",
              "Se a gravação falhar, a mensagem aparece no topo da página e o Console tenta de novo sozinho a cada 8 segundos.",
              "Se você fechar ou recarregar a aba com um traço ainda não salvo, o navegador pede confirmação. Para ir a outra tela do Console, espere aparecer “Salvo”: um traço feito no último segundo pode se perder.",
              "A miniatura da grade de Bookmarks é refeita a cada gravação que tem algum desenho. Uma lousa limpa continua com a última miniatura.",
              "O Console registra quem desenhou, uma vez a cada vez que a lousa é aberta e alterada.",
            ],
          },
        ],
      },
      {
        title: "Limites",
        blocks: [
          {
            kind: "pairs",
            items: [
              {
                term: "Tamanho",
                text: "Até 3 MB por lousa, contando as imagens coladas. Acima disso aparece “A lousa passou de 3 MB. Reduza as imagens coladas para continuar salvando.”.",
              },
              {
                term: "Elementos",
                text: "Até 5.000 elementos por lousa. Acima disso, a gravação falha com “O desenho não pôde ser lido. Recarregue a página e tente de novo.”.",
              },
              {
                term: "Uma pessoa por vez",
                text: "Duas pessoas não desenham juntas ao vivo na mesma lousa. Cada gravação guarda o desenho inteiro e substitui a anterior, e quem está com a lousa aberta só vê o desenho de outra pessoa depois de recarregar a página. Combine quem desenha em cada momento.",
              },
              { term: "Tela cheia", text: "O botão não aparece em navegadores sem esse recurso, como o do iPhone." },
              {
                term: "Tema",
                text: "A lousa segue o tema claro ou escuro escolhido em [Aparência](/ajuda/aparencia). A imagem exportada sai com fundo claro, a não ser que você ligue “Modo escuro” na janela “Exportar imagem”.",
              },
            ],
          },
        ],
      },
      {
        title: "Quem pode desenhar",
        blocks: [
          {
            kind: "p",
            text: "Quem vê o bookmark abre a lousa. Desenham quem criou a lousa, quem criou a pasta onde ela está e a equipe da Anuntech. Ser Administrador da empresa não muda isso.",
          },
          {
            kind: "p",
            text: "As outras pessoas veem a lousa com “Só leitura” no topo e podem usar “Exportar imagem...” no menu do quadro. Se ela ainda estiver vazia, aparece “Ainda não há nada nesta lousa.”.",
          },
          {
            kind: "note",
            tone: "attention",
            text: "“Limpar o canvas e redefinir a cor de fundo” apaga tudo o que está na lousa e, depois de confirmado, a lousa salva sozinha sem o desenho. Excluir a lousa em Bookmarks também não tem volta: ela sai da lista com o desenho.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "A lousa salva sozinha?",
        a: "Sim. Pouco mais de 1 segundo depois do último traço, o topo mostra “Salvando…” e depois “Salvo”. Se a gravação falhar, o Console tenta de novo sozinho a cada 8 segundos.",
      },
      {
        q: "Como levo o desenho para fora do Console?",
        a: "Abra o menu do quadro (o ícone de três linhas) e use “Exportar imagem...”. Dá para salvar em PNG ou SVG, ou copiar a imagem. Ela sai com fundo claro; para fundo escuro, ligue “Modo escuro” na mesma janela. Quem só vê a lousa também pode exportar.",
      },
      {
        q: "Quem pode desenhar numa lousa? Duas pessoas podem desenhar ao mesmo tempo?",
        a: "Desenham quem criou a lousa, quem criou a pasta onde ela está e a equipe da Anuntech. Quem só vê o bookmark abre a lousa em “Só leitura”. Não há desenho ao vivo entre duas pessoas: combine quem desenha em cada momento.",
      },
      {
        q: "Abri a lousa e está escrito “Só leitura”. O que faço?",
        a: "Você pode ver, mas não desenhar. Peça a quem criou a lousa ou a quem criou a pasta. Se precisar de um quadro seu, crie uma lousa nova em Bookmarks.",
      },
      {
        q: "Apareceu “A lousa passou de 3 MB”. E agora?",
        a: "As imagens coladas deixaram a lousa grande demais, e o que você desenhar a partir daí não é salvo. Apague ou troque imagens por versões menores até a mensagem sumir.",
      },
      {
        q: "Por que não vejo o botão de tela cheia?",
        a: "Ele só aparece em navegadores que oferecem tela cheia. No iPhone, por exemplo, não há esse botão; a lousa já ocupa a largura toda da página.",
      },
    ],
    actions: [{ label: "Ir para Bookmarks", href: "/bookmarks" }],
    related: ["bookmarks", "pastas-e-compartilhamento", "aparencia"],
    updatedAt: "2026-10-14",
  },
  {
    slug: "assistente",
    category: "assistente",
    title: "O assistente do Console",
    video: "assistente",
    summary: "O assistente responde perguntas e faz pedidos em português, como abrir um chamado ou comentar numa tarefa, sempre com o seu acesso.",
    audience: "todos",
    keywords: [
      "assistente",
      "ia",
      "inteligencia artificial",
      "chat",
      "robo",
      "bot",
      "perguntar",
      "esfera",
      "historico de conversas",
      "apagar conversa",
      "nova conversa",
      "jev",
      "preencher formulario",
      "limite do assistente",
      "tokens",
    ],
    sections: [
      {
        title: "O que é",
        blocks: [
          {
            kind: "p",
            text: "O assistente é um painel de conversa que está em todas as telas do Console. Você escreve como falaria com alguém da equipe, e ele consulta e faz o que você pediu, com o mesmo acesso que você tem nas telas.",
          },
        ],
      },
      {
        title: "Onde fica",
        blocks: [
          {
            kind: "list",
            items: [
              "No computador: a esfera de pontos no começo do menu do Console. Parada, o assistente está livre. Enquanto ele trabalha, ela muda de forma a cada passo, e ao passar o mouse a dica diz o que ele está fazendo: pensando, consultando o Console, lendo o que encontrou, escrevendo a resposta ou, enquanto você dita, ouvindo o microfone.",
              "No computador, a esfera também avisa como terminou uma resposta que chegou com o painel fechado. Vermelha e em forma de triângulo, a resposta não terminou; ela volta ao normal quando você abre o painel. Âmbar e quadrada, um cartão espera a sua confirmação, até você confirmar ou descartar, ou até o cartão vencer, 15 minutos depois.",
              "No celular: toque em “Mais” e depois em “Perguntar ao assistente”. Enquanto ele trabalha ou espera você, essa linha diz o que está acontecendo, logo abaixo do nome.",
              "No fim da [Ajuda](/ajuda) e de cada artigo: o botão “Perguntar ao assistente”.",
            ],
          },
        ],
      },
      {
        title: "Como usar",
        blocks: [
          {
            kind: "steps",
            items: [
              "Abra o assistente. Numa conversa nova, ele cumprimenta você pelo nome e pergunta como pode ajudar.",
              "Escreva no campo “Pergunte ou peça algo…”. Enquanto você digita, aparecem perguntas e atalhos parecidos: toque num deles, ou use as setas e Enter, para enviar a pergunta ou abrir o formulário. Se preferir, use o microfone para [falar em vez de escrever](/ajuda/falar-em-vez-de-escrever).",
              "Envie com Enter ou com a seta. Shift+Enter quebra a linha.",
              "A resposta aparece enquanto ele escreve. Enquanto ele trabalha, aparece há quanto tempo ele está na resposta, e as etiquetas com ✓ acima dela mostram, conforme acontecem, o que ele consultou ou fez, como “Consultei as faturas”.",
              "Os links da resposta abrem a tela certa do Console.",
              "Para mudar de assunto, toque em “Nova conversa”. A conversa anterior fica no “Histórico”.",
            ],
          },
          {
            kind: "p",
            text: "Você pode fechar o painel enquanto ele trabalha. Quando ele terminar, aparece “O assistente terminou.” com o botão “Ver”. Com o painel fechado, ele não muda de tela nem preenche nada na sua tela.",
          },
          {
            kind: "p",
            text: "Em telas a partir de 1024 px de largura, ao enviar uma mensagem o painel vai para o lado da página, para você continuar usando a tela. O botão no topo do painel alterna entre “Centralizar” e “Mover para o lado”; depois que você centraliza, ele fica no centro.",
          },
        ],
      },
      {
        title: "O que ele faz por você",
        blocks: [
          {
            kind: "pairs",
            items: [
              {
                term: "Consultar",
                text: "Chamados e as últimas mensagens de cada um, projetos, tarefas e comentários, produtos e serviços, os bookmarks que você vê na página Bookmarks, os dados da empresa, a sua conta, os artigos desta Ajuda e as informações sobre a Anuntech. O Administrador também consulta faturas, boletos, Pix, recorrências, totais, contratos, orçamentos e quem tem acesso à empresa.",
              },
              {
                term: "Abrir e responder chamados",
                text: "Ele pergunta o tipo e, se for um erro, o impacto. Mostra um cartão com o assunto e a descrição, e o chamado só é aberto quando você toca em “Confirmar”. Você recebe o recibo por e-mail, como num chamado aberto pela tela.",
              },
              {
                term: "Tarefas de projeto",
                text: "Criar, mover, alterar e excluir tarefas e comentar nelas, com as mesmas regras do quadro: uma tarefa criada por você entra no Backlog como pedido, só a equipe conclui uma tarefa, a coloca em Revisão ou a tira de Concluído, só quem criou a tarefa pode excluí-la e só quem escreveu um comentário pode editá-lo ou excluí-lo.",
              },
              {
                term: "Bookmarks",
                text: "Guardar um link, numa pasta se você quiser, e criar uma pasta. Uma pasta criada por ele fica visível para toda a empresa; para restringir, use “Compartilhar” na pasta. Arquivos e lousas você adiciona em [Bookmarks](/bookmarks).",
              },
              {
                term: "Preencher a tela",
                text: "Com um formulário aberto, diga, por exemplo, “preencha este formulário com …”. Ele preenche e avisa quantos campos preencheu, com “Confira antes de salvar.”. Para enviar o formulário, ele mostra um cartão e só envia quando você confirma. Ele só aciona os botões que a tela libera para ele, como “Abrir chamado”, um por vez. Aceitar ou recusar um orçamento, assinar um contrato, aprovar ou contestar horas e as confirmações de enviar ou excluir ficam fora do alcance dele: ele não lê, não preenche e não clica nesses formulários.",
              },
              {
                term: "Dar acesso",
                text: "Só o Administrador: dar acesso a uma pessoa como Administrador ou Membro. Quem ainda não tinha acesso recebe o convite por e-mail e, como Membro, vê tudo da empresa. Para escolher o que um Membro vê, veja [Escolher o que cada Membro vê](/ajuda/o-que-cada-membro-ve).",
              },
              { term: "Abrir telas", text: "Leva você à tela certa, como Chamados, Projetos, Bookmarks ou Como trabalhamos." },
              {
                term: "Falar com a equipe",
                text: "Quando você pede para falar com alguém, ele abre o mesmo chat de “Conversar com a equipe” do menu da conta.",
              },
            ],
          },
        ],
      },
      {
        title: "Antes de alterar algo",
        blocks: [
          {
            kind: "p",
            text: "O assistente nunca altera nada sozinho. Para abrir ou responder um chamado, mexer em tarefas, comentar, guardar um bookmark, criar uma pasta, dar acesso a alguém ou enviar um formulário, ele mostra um cartão no painel com o que vai fazer e os dados. Só acontece quando você toca em “Confirmar”.",
          },
          {
            kind: "list",
            items: [
              "Cada cartão vale para uma ação, exatamente com os dados que mostra. Escrever “sim” na conversa não executa nada.",
              "“Descartar” cancela o cartão. Um cartão vale por 15 minutos e some se você recarregar a página: é só pedir de novo.",
              "Quando ele prepara uma ação depois de ler um texto escrito por outra pessoa, como um chamado ou um comentário, o cartão avisa. Confira cada dado antes de confirmar.",
              "Preencher campos sem enviar não salva nada e acontece direto. Numa tela que mostra texto de outra pessoa, como a página de um chamado, até preencher ou clicar pede o cartão.",
            ],
          },
          {
            kind: "note",
            tone: "attention",
            text: "Excluir uma tarefa ou um comentário pelo assistente não tem volta. Leia o cartão antes de confirmar. Aceitar um orçamento, assinar um contrato, aprovar uma entrega e pagar uma fatura são decisões suas: faça na tela, depois de ler.",
          },
        ],
      },
      {
        title: "O que ele não faz",
        blocks: [
          {
            kind: "list",
            items: [
              "Não cria cobranças, contratos nem orçamentos: quem cria é a equipe da Anuntech. Para pedir um orçamento, ele pode abrir um chamado do tipo “App ou projeto novo”.",
              "Não define prazo nem prioridade. A prioridade de um chamado é da equipe, mesmo quando ele abre o chamado, e os prazos são os das condições da sua empresa, em [Como trabalhamos](/como-trabalhamos).",
              "Não lê arquivos: o campo dele não aceita anexo. Um chamado aberto por ele sai sem anexo e sem produto vinculado; para isso, use [Abrir chamado](/chamados/novo).",
              "Não aceita nem recusa orçamentos e não assina contratos, nem com a página aberta. Quem responde é o Administrador da empresa, na própria página do orçamento ou do contrato.",
              "Não liga o seu microfone: só você começa uma gravação, e o texto ditado nunca é enviado sozinho.",
              "Não segue instruções escritas em chamados, comentários, tarefas ou bookmarks: trata esse texto como informação. Depois de ler um texto desses, as consultas daquela resposta ficam na empresa do registro que você está vendo.",
              "Não mostra a um Membro o que é só do Administrador, como faturas, contratos, orçamentos e totais. Se um Membro pedir, ele avisa que o acesso não inclui essa área e sugere pedir a um Administrador da empresa.",
            ],
          },
          {
            kind: "p",
            text: "Ele responde com o que consulta no Console. Antes de pagar ou decidir algo, confira o valor e a situação na tela.",
          },
        ],
      },
      {
        title: "Histórico de conversas",
        blocks: [
          {
            kind: "steps",
            items: [
              "No topo do painel, toque em “Histórico”. A lista “Suas conversas” mostra as 40 mais recentes, cada uma com o começo da primeira mensagem, quando foi a última e o número de mensagens.",
              "Toque numa conversa para continuar de onde parou, ou em “Voltar”.",
              "Para apagar uma conversa, toque na lixeira ao lado dela e depois em “Apagar?”.",
            ],
          },
          {
            kind: "list",
            items: [
              "Cada pessoa vê só as próprias conversas. O Console não tem uma tela para outra pessoa, nem para a equipe da Anuntech, ler as suas conversas.",
              "Ficam guardados o que você escreveu, as respostas e as etiquetas do que ele fez, até você apagar. Uma resposta que falhou não fica guardada.",
              "Recarregar a página mantém a conversa daquela aba.",
            ],
          },
          {
            kind: "note",
            tone: "attention",
            text: "Apagar uma conversa é definitivo e leva todas as mensagens dela.",
          },
          {
            kind: "note",
            tone: "info",
            text: "Para responder, o texto da conversa vai para o serviço de inteligência artificial que o Console usa, com o seu nome, a sua empresa, o seu papel, os campos da tela aberta e os dados que ele consulta. O Console só usa provedores que não guardam esses dados nem treinam modelos com eles. Não escreva senhas nem dados reais dos seus clientes. Veja [Seus dados e privacidade](/ajuda/seus-dados).",
          },
        ],
      },
      {
        title: "Limites",
        blocks: [
          {
            kind: "pairs",
            items: [
              {
                term: "Mensagem",
                text: "Até 20.000 caracteres por mensagem; acima disso, aparece “Não foi possível ler a mensagem. Envie de novo.”. Ele lê os primeiros 6.000 caracteres de cada mensagem: para um texto maior, mande em partes.",
              },
              {
                term: "Conversa longa",
                text: "Ele considera as 20 mensagens mais recentes da conversa, como estão guardadas no Console. Numa conversa muito longa, comece uma “Nova conversa” para ele não perder o fio.",
              },
              {
                term: "Muitas mensagens",
                text: "Até 60 mensagens por hora. Acima disso, aparece “Muitas mensagens nesta hora. Espere um pouco e tente de novo.”.",
              },
              {
                term: "Uso por dia",
                text: "Cada pessoa usa até 400 mil tokens por dia, e cada empresa, somando todas as pessoas dela, até 1 milhão. O painel mostra quanto cada resposta gastou, como “9 s · 30 mil tokens”. Quem tem acesso a mais de uma empresa gasta do limite de todas elas. No limite, aparece “Você usou todo o limite do assistente de hoje. Ele volta a responder à meia-noite, horário de Brasília.”, ou o mesmo aviso com o nome da empresa.",
              },
              {
                term: "Mensagens por empresa",
                text: "Até 300 mensagens por dia em cada empresa, somando todas as pessoas. Acima disso, aparece “A empresa … chegou a 300 mensagens no assistente hoje, o limite do dia.”.",
              },
              {
                term: "Limite no meio da resposta",
                text: "Se o limite do dia acabar enquanto ele trabalha, ele responde com o que já consultou e avisa que volta à meia-noite.",
              },
              {
                term: "Consultas por resposta",
                text: "Cada resposta faz até 12 consultas ou cartões. Para um pedido maior, ele diz o que ficou para a próxima mensagem.",
              },
              {
                term: "Pedido grande",
                text: "Se ele não chegar a uma resposta final, pede para você dividir o pedido em partes menores.",
              },
            ],
          },
        ],
      },
    ],
    faq: [
      {
        q: "Como abro o assistente?",
        a: "No computador, clique na esfera no começo do menu do Console. No celular, toque em “Mais” e depois em “Perguntar ao assistente”. Ele está em todas as telas e mantém a conversa enquanto você navega.",
      },
      {
        q: "Sou Membro. O assistente me mostra faturas ou valores?",
        a: "Não. O assistente usa o seu acesso, e faturas, boletos, Pix, contratos, orçamentos e totais são só do Administrador. Se o Administrador escolheu o que você vê, o assistente mostra só esses projetos, produtos e serviços.",
      },
      {
        q: "O assistente pode mudar alguma coisa sem eu pedir?",
        a: "Não. Toda alteração aparece como um cartão no painel e só acontece quando você toca em “Confirmar”. Preencher campos sem enviar não salva nada.",
      },
      {
        q: "Alguém da Anuntech lê minhas conversas com o assistente?",
        a: "As conversas ficam guardadas no Console, ligadas à sua conta, e só você as abre em “Histórico”. O Console não tem uma tela para a equipe ler as suas conversas. Para responder, o texto vai para o serviço de inteligência artificial que o Console usa. Você pode apagar cada conversa quando quiser.",
      },
      {
        q: "O cartão diz que expirou ou sumiu. E agora?",
        a: "Cada cartão vale por 15 minutos e fica só na aba em que apareceu. Peça de novo ao assistente, que ele prepara outro.",
      },
      {
        q: "A resposta parou no meio. E agora?",
        a: "Quando uma resposta não termina, o texto que já tinha aparecido sai do painel e, no lugar dele, aparece em vermelho o que deu errado. Se a falha foi do assistente, nada dessa resposta fica na conversa: envie a mensagem de novo em instantes. Se o aviso é “Sem conexão com o Console agora”, a resposta pode ter terminado mesmo assim: confira no “Histórico” antes de enviar de novo.",
      },
      {
        q: "O que quer dizer “Jev” nas etiquetas?",
        a: "É a parte do assistente que lê o seu pedido para responder mais rápido. Quando está claro que você só quer abrir uma tela ou falar com a equipe, ele responde na hora, por exemplo “Abrindo Chamados.”, com a etiqueta “Jev: abrir Chamados”. O Jev não aprova alterações: elas sempre passam pelo cartão.",
      },
      {
        q: "O assistente disse que não sabe. E agora?",
        a: "Peça para falar com alguém da equipe, e ele abre o chat de “Conversar com a equipe”. Você também pode [abrir um chamado](/chamados/novo) do tipo “Dúvida”.",
      },
    ],
    related: ["falar-em-vez-de-escrever", "abrir-um-chamado", "seus-dados", "membro-ou-administrador"],
    updatedAt: "2026-10-19",
  },
  {
    slug: "falar-em-vez-de-escrever",
    category: "assistente",
    title: "Falar em vez de escrever (ditado)",
    summary: "Use o botão “Falar” para ditar o texto no assistente e na descrição de um chamado novo, e revise antes de enviar.",
    audience: "todos",
    keywords: [
      "ditado",
      "ditar",
      "falar",
      "microfone",
      "audio",
      "voz",
      "gravar",
      "gravacao",
      "transcricao",
      "transcrever",
      "microfone bloqueado",
      "falar em vez de digitar",
    ],
    sections: [
      {
        title: "Onde aparece",
        blocks: [
          {
            kind: "list",
            items: [
              "No campo do [assistente](/ajuda/assistente): o botão do microfone, “Falar”.",
              "Em [Abrir chamado](/chamados/novo), inclusive em “Pedir orçamento”: o botão “Falar”, abaixo da “Descrição”.",
            ],
          },
          {
            kind: "p",
            text: "O ditado não aparece na resposta de um chamado já aberto nem nos comentários de tarefa. O botão só aparece quando o ditado está disponível e o navegador consegue gravar áudio; se ele não aparecer, digite o texto.",
          },
        ],
      },
      {
        title: "Como ditar",
        blocks: [
          {
            kind: "steps",
            items: [
              "Deixe o cursor onde o texto deve entrar e toque em “Falar”.",
              "Na primeira vez, o navegador pede para usar o microfone. Permita.",
              "Fale. No assistente, os pontinhos ao lado do botão se mexem com a sua voz; nos chamados, a tela mostra “Gravando” e o tempo.",
              "Toque em “Parar” (o quadrado). O áudio vira texto em alguns segundos.",
              "O texto entra onde estava o cursor.",
              "Revise e envie você mesmo. Nada é enviado sozinho.",
            ],
          },
          {
            kind: "p",
            text: "Para desistir no meio, toque no × (no assistente) ou em “Cancelar gravação” (nos chamados), ou aperte Esc. Nada é transcrito.",
          },
        ],
      },
      {
        title: "Limites",
        blocks: [
          {
            kind: "pairs",
            items: [
              {
                term: "Duração",
                text: "Até 2 minutos por gravação. Em 1:50 aparece “Faltam 10 segundos.” e em 2:00 a gravação para sozinha; o que você falou é transcrito.",
              },
              {
                term: "Quantidade",
                text: "Até 30 transcrições por pessoa numa hora, contando as que falharam. Acima disso aparece “Você usou o microfone muitas vezes na última hora. Digite o texto ou tente mais tarde.”.",
              },
              {
                term: "Gravação curta",
                text: "Uma gravação de menos de 1 segundo, ou em silêncio, não é enviada. Aparece “Não deu para ouvir nada. Fale perto do microfone e tente de novo.”.",
              },
              { term: "Idioma", text: "A transcrição é feita em português." },
              {
                term: "Texto longo",
                text: "Se o texto passar do limite do campo (10.000 caracteres na descrição do chamado, 20.000 no assistente), o excesso é cortado e o Console avisa para você revisar.",
              },
              {
                term: "Trocar de aba",
                text: "Trocar de aba ou de app, ou bloquear o celular, encerra a gravação. O que você já falou é transcrito.",
              },
            ],
          },
        ],
      },
      {
        title: "Privacidade",
        blocks: [
          {
            kind: "p",
            text: "O áudio vai para um serviço de transcrição que não guarda o que recebe, e o Console também não guarda o áudio: ele registra só dados como a duração e o tamanho da gravação. Fica no campo apenas o texto, para você revisar e enviar.",
          },
          {
            kind: "p",
            text: "O assistente nunca liga o seu microfone. Só você começa uma gravação.",
          },
          {
            kind: "note",
            tone: "attention",
            text: "Não fale senhas nem dados reais dos seus clientes. Se a equipe precisar de um acesso, ela combina com você um jeito seguro. Veja [Seus dados e privacidade](/ajuda/seus-dados).",
          },
        ],
      },
      {
        title: "Se der errado",
        blocks: [
          {
            kind: "pairs",
            items: [
              {
                term: "“O microfone está bloqueado para o Console.”",
                text: "Libere o microfone nas configurações do navegador e tente de novo. Se você abriu o link pelo WhatsApp ou pelo Instagram, abra no Safari ou no Chrome.",
              },
              { term: "“Nenhum microfone foi encontrado neste aparelho.”", text: "Conecte um microfone ou use outro aparelho." },
              {
                term: "“O microfone está em uso por outro app.”",
                text: "Encerre a ligação ou feche o app que está usando o microfone e tente de novo.",
              },
              {
                term: "“A transcrição demorou demais.” ou “Não foi possível enviar o áudio.”",
                text: "Confira a conexão e toque em “Tentar de novo”.",
              },
              { term: "“Sua sessão terminou. Entre de novo para usar o microfone.”", text: "Entre de novo no Console e grave outra vez." },
              {
                term: "“Não deu para entender o áudio.”",
                text: "Fale mais perto do microfone, num lugar mais silencioso, e grave de novo.",
              },
              {
                term: "“Não foi possível transcrever agora.” ou “A transcrição está indisponível agora.”",
                text: "Toque em “Tentar de novo”, se o botão aparecer, ou digite o texto.",
              },
            ],
          },
        ],
      },
    ],
    faq: [
      {
        q: "Para onde vai o áudio quando uso o “Falar”?",
        a: "Para um serviço de transcrição que não guarda o que recebe. O Console também não guarda o áudio. O texto aparece no campo para você revisar e enviar.",
      },
      {
        q: "Quanto posso gravar?",
        a: "Até 2 minutos por gravação. Em 1:50 aparece “Faltam 10 segundos.” e em 2:00 a gravação para sozinha. Cada pessoa pode fazer até 30 transcrições por hora.",
      },
      {
        q: "O texto é enviado sozinho quando eu paro de falar?",
        a: "Não. O texto entra no campo, onde estava o cursor, e você revisa e envia. No assistente, o envio fica desativado enquanto o ditado grava ou transcreve. Em Abrir chamado, enviar durante a transcrição mostra “Aguarde a transcrição terminar ou toque em Cancelar gravação.”, e enviar durante a gravação descarta o áudio.",
      },
      {
        q: "Posso ditar a resposta de um chamado ou um comentário de tarefa?",
        a: "Hoje não. O ditado aparece no campo do assistente e na “Descrição” de Abrir chamado.",
      },
      {
        q: "Não vejo o botão “Falar”. Por quê?",
        a: "Ele só aparece quando o ditado está disponível e o navegador consegue gravar áudio. Tente num navegador atualizado, como Safari ou Chrome. Se ainda não aparecer, digite o texto.",
      },
      {
        q: "O navegador não pediu o microfone e apareceu que ele está bloqueado.",
        a: "Você ou o navegador recusaram o microfone antes. Libere o microfone para o Console nas configurações do navegador e tente de novo. Links abertos dentro do WhatsApp ou do Instagram costumam bloquear o microfone: abra no Safari ou no Chrome.",
      },
    ],
    actions: [{ label: "Abrir chamado", href: "/chamados/novo" }],
    related: ["assistente", "abrir-um-chamado", "seus-dados"],
    updatedAt: "2026-10-14",
  },
];
