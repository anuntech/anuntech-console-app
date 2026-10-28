import type { HelpArticle } from "../help-model";

export const bookmarksAssistenteArticles: HelpArticle[] = [
  {
    slug: "bookmarks",
    category: "bookmarks",
    title: "Arquivos: o que é e como usar",
    summary: "Em Arquivos, a sua empresa guarda arquivos de até 100 GB, links e lousas, organizados em pastas, com prévia, estrela, busca e download em .zip.",
    audience: "todos",
    keywords: [
      "arquivos",
      "arquivo",
      "drive",
      "upload",
      "enviar arquivo",
      "enviar arquivos",
      "subir arquivo",
      "bookmarks",
      "bookmark",
      "favoritos",
      "link",
      "links",
      "guardar link",
      "baixar arquivo",
      "download",
      "armazenamento",
      "espaço",
      "cota",
      "5 GB",
      "100 GB",
      "arquivos grandes",
      "estrela",
      "recentes",
      "previa",
      "miniatura",
      "selecionar varios",
      "mover arquivos",
      "copiar arquivo",
      "baixar pasta",
      "zip",
    ],
    sections: [
      {
        title: "O que é",
        blocks: [
          {
            kind: "p",
            text: "Arquivos (antes chamado Bookmarks) é o lugar da sua empresa no Console para guardar e trocar arquivos com a Anuntech, de qualquer tipo e até 100 GB cada. Ali também ficam endereços úteis, como o painel do site ou um arquivo no Figma, e as [lousas](/ajuda/lousas). Cada item guarda uma coisa só: um arquivo, um link ou uma lousa.",
          },
          {
            kind: "p",
            text: "Administradores e Membros têm os mesmos direitos aqui: os dois veem, enviam e organizam. Quem vê cada item depende da pasta onde ele está, como explica [Pastas e compartilhamento](/ajuda/pastas-e-compartilhamento).",
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
              "Arraste os arquivos do seu computador para a lista, ou clique em “Enviar” e selecione vários.",
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
        title: "Adicionar um link, um arquivo ou uma lousa",
        blocks: [
          {
            kind: "steps",
            items: [
              "Em [Arquivos](/bookmarks), clique em “Adicionar”. Se você estiver dentro de uma pasta, ela já vem escolhida.",
              "Em “Tipo”, escolha “Link”, “Arquivo” ou “Lousa”.",
              "Preencha o “Título”, por exemplo: Identidade visual no Drive.",
              "Para um link, cole o endereço completo em “Link”, começando com https://. Para um arquivo, arraste o arquivo para o campo “Arquivo” ou clique nele para selecionar.",
              "Em “Pasta”, escolha uma pasta ou deixe “Sem pasta”.",
              "Clique em “Adicionar bookmark” (numa lousa, “Criar lousa”). Um arquivo grande mostra o andamento (“Enviando 40%”); ao terminar, aparece “Bookmark salvo.”.",
            ],
          },
          {
            kind: "note",
            tone: "attention",
            text: "Um item em “Sem pasta” fica visível para todas as pessoas da sua empresa no Console. Para guardar algo só para algumas pessoas, adicione dentro de uma pasta “Só pessoas escolhidas”.",
          },
        ],
      },
      {
        title: "Limites e armazenamento",
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
                text: "Cada empresa tem 5 GB para os seus arquivos, a não ser que tenha combinado outro tamanho com a Anuntech. O espaço soma todas as pastas, as versões guardadas e o que está na lixeira. Sem espaço, aparece “O espaço da empresa acabou” com quanto resta: exclua arquivos que não usa mais ou fale com a Anuntech para aumentar.",
              },
              {
                term: "Tipo",
                text: "Escolhido ao adicionar, não muda depois. Um item de link continua de link; para guardar um arquivo no lugar dele, adicione outro item.",
              },
            ],
          },
          {
            kind: "p",
            text: "Em telas a partir de 1024 px de largura, o quadro “Armazenamento”, abaixo das pastas, mostra quanto já foi usado, como “1,2 GB de 5,0 GB · 3,8 GB livres”, a porcentagem e quanto ocupam “Fotos e vídeos”, “Documentos” e “Outros”. Acima de 90%, a barra fica vermelha.",
          },
        ],
      },
      {
        title: "Encontrar e abrir",
        blocks: [
          {
            kind: "list",
            items: [
              "Em telas a partir de 1024 px de largura, a coluna da esquerda mostra “Todos”, “Recentes”, “Com estrela”, “Sem pasta”, “Lixeira” e, em “Pastas”, cada pasta com o número de arquivos, somando os das pastas de dentro. Em telas menores, como no celular, escolha a pasta no seletor acima da lista, que começa em “Todos os bookmarks”.",
              "Uma pasta com pastas dentro tem uma seta ao lado do nome: clique nela para abrir ou recolher. A pasta começa recolhida, a não ser que a que você abriu esteja dentro dela, e o que você abre ou recolhe fica guardado neste navegador.",
              "“Recentes” mostra o que você adicionou, mudou ou abriu nos últimos 30 dias. Clique na estrela de um cartão (ou em “Marcar com estrela”, no menu “…”) para achar o item depois em “Com estrela”. A estrela é só sua.",
              "O campo “Buscar pelo nome ou pelo que está escrito no arquivo” procura no título, no link, no nome e no texto de dentro dos arquivos. Veja [Buscar dentro dos arquivos e etiquetas](/ajuda/buscar-e-etiquetas).",
              "Os ícones “Lista” e “Grade”, ao lado da busca, mudam a forma de mostrar. A escolha fica guardada neste navegador.",
              "Na “Grade”, cada cartão mostra o arquivo: fotos aparecem direto (o Console prepara uma miniatura alguns segundos depois do envio), vídeos mostram o primeiro quadro, PDFs e documentos mostram o começo da página, links mostram a letra e o endereço do site, e os outros tipos mostram o ícone com o tipo. Ao passar o mouse sobre um arquivo, aparecem os botões de ver, baixar e, para quem pode editar o arquivo, compartilhar por link.",
              "Clicar num arquivo abre a prévia com os “Detalhes” ao lado (tipo, tamanho, pasta, etiqueta, quem adicionou e quando). As setas, ou as teclas ← e →, passam para o arquivo anterior e o próximo da lista. Arquivos sem prévia mostram o ícone e o botão “Baixar”.",
              "Um link abre em outra aba, e uma lousa abre no Console.",
              "No menu “…”: “Renomear” muda só o nome, e “Copiar link” copia o endereço do item no Console, que só abre para quem já tem acesso a ele. Para mandar a alguém sem conta, use [Compartilhar por link](/ajuda/compartilhar-por-link).",
            ],
          },
          {
            kind: "p",
            text: "A lista começa pelo mais recente, pela data em que cada item foi adicionado. Editar não muda a ordem. No rodapé, “Por página” mostra 10, 25, 50 ou 100 itens; o padrão é 25.",
          },
        ],
      },
      {
        title: "Organizar vários itens",
        blocks: [
          {
            kind: "list",
            items: [
              "Marque a caixa ao lado de cada item (na grade, ela aparece ao passar o mouse). Na barra que aparece em cima: “Baixar” (vários arquivos vêm num .zip), “Mover para…” e “Lixeira”.",
              "Você também pode arrastar um item, ou os marcados, até uma pasta na coluna da esquerda.",
              "“Copiar para…”, no menu “…” do item, faz uma cópia numa pasta que você escolher, inclusive de outra empresa sua. O original fica onde está, e o arquivo copiado ocupa o espaço da empresa de destino.",
              "Ao lado da busca, “Todos os tipos” filtra por arquivos, links, lousas, PDF, imagens, vídeos, documentos, planilhas ou apresentações. “Mais recentes” muda a ordem: mais antigos, por nome ou os maiores primeiro. “Só os meus” mostra só o que você adicionou.",
            ],
          },
        ],
      },
      {
        title: "Editar, mover e excluir",
        blocks: [
          {
            kind: "steps",
            items: [
              "Clique em “…” no item.",
              "“Editar” muda o “Título”, o “Link” (num item de link), a “Pasta” e a “Etiqueta”. Clique em “Salvar”.",
              "“Mover para” leva o item para outra pasta da mesma empresa ou para “Sem pasta”.",
              "“Excluir” pergunta “Mover para a lixeira?” e move quando você confirma.",
            ],
          },
          {
            kind: "p",
            text: "Editar, mover e excluir ficam com quem adicionou o item, com quem criou a pasta onde ele está e com a equipe da Anuntech. As outras pessoas veem no menu só as opções de abrir, baixar, marcar com estrela e copiar o link. Ser Administrador da empresa não dá esse direito em Arquivos.",
          },
          {
            kind: "p",
            text: "O que vai para a lixeira fica lá por 30 dias. Trocar o arquivo sem perder o anterior e ver quem baixou ou mudou um item estão em [Lixeira, versões e atividade](/ajuda/lixeira-versoes-e-atividade).",
          },
        ],
      },
      {
        title: "Contratos e entregas que chegam sozinhos",
        blocks: [
          {
            kind: "p",
            text: "Alguns arquivos o Console guarda sozinho na sua empresa, em até 15 minutos:",
          },
          {
            kind: "list",
            items: [
              "Na pasta “Contratos”, o PDF de cada contrato assinado por todos. Ela só aparece para os Administradores da empresa, que são quem vê os contratos no Console, e para a equipe da Anuntech.",
              "Na pasta “Entregas”, uma pasta por projeto, com os anexos das tarefas que chegaram em Revisão ou foram concluídas. Cada pasta de projeto só aparece para quem vê aquele projeto.",
            ],
          },
          {
            kind: "p",
            text: "São cópias: o contrato e a tarefa continuam onde estão, e as cópias não ocupam o espaço da empresa. Essas pastas são mantidas pelo Console (o menu mostra “Mantida pelo Console”), então não podem ser excluídas, movidas nem compartilhadas. Pastas criadas dentro delas seguem a mesma regra de quem vê, e o que está nelas só pode ir para outra pasta com a mesma regra. Se o projeto for excluído, a pasta dele e as cópias saem junto. Antes, a equipe tira os arquivos que alguém tenha colocado ali.",
          },
        ],
      },
      {
        title: "Baixar arquivos",
        blocks: [
          {
            kind: "p",
            text: "Imagens (PNG, JPEG, GIF, WebP, AVIF, SVG), PDF, vídeos (MP4, WebM, MOV), áudios (MP3, M4A, WAV, OGG) e textos (TXT, MD, CSV, JSON, CSS, até 2 MB) abrem na prévia, dentro do Console, com o botão “Baixar” embaixo. No menu “…”, “Ver” abre a prévia, “Baixar arquivo” baixa e “Detalhes” mostra os dados do arquivo. Os outros tipos, como páginas HTML, planilhas ou instaladores, não abrem na prévia, por segurança: baixe e abra no programa que você usa.",
          },
          {
            kind: "p",
            text: "O download vai direto para a pasta de downloads, mesmo de arquivos grandes, e aparece na lista de downloads do navegador.",
          },
          {
            kind: "p",
            text: "Para baixar uma pasta inteira, abra a pasta e clique em “Baixar a pasta em .zip”, o ícone de download ao lado de “Enviar”. Vem um arquivo .zip com os arquivos dela e das pastas de dentro que você vê, na mesma organização. O .zip vai até 3,5 GB e 2.000 arquivos; acima disso, baixe as pastas de dentro uma de cada vez. Links e lousas não entram no .zip.",
          },
          {
            kind: "p",
            text: "Se o download não começar, recarregue a página. Se a sua sessão terminou, o Console pede para você entrar de novo. Depois, confira se o item ainda aparece para você e clique outra vez.",
          },
          {
            kind: "note",
            tone: "attention",
            text: "Não guarde senhas em Arquivos, nem no título, nem no link, nem dentro de arquivos. Se a equipe precisar de um acesso, ela combina com você um jeito seguro.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Bookmarks virou Arquivos. Mudou alguma coisa no que eu tinha guardado?",
        a: "Não. O que estava em Bookmarks continua lá, nas mesmas pastas e com as mesmas pessoas vendo. Mudou o nome, e a área ganhou o que um drive tem: arquivos grandes, prévia, lixeira, versões, busca dentro dos arquivos e links para quem não tem conta.",
      },
      {
        q: "Quem vê o que eu guardo?",
        a: "Depende de onde você guarda. Em “Sem pasta” ou numa pasta “Todos da empresa”: todas as pessoas da sua empresa no Console, Administradores e Membros. Numa pasta “Só pessoas escolhidas”: quem criou a pasta e as pessoas escolhidas. A equipe da Anuntech vê tudo.",
      },
      {
        q: "Qual o tamanho máximo de arquivo e que tipos posso guardar?",
        a: "Qualquer tipo de arquivo, até 100 GB, um arquivo por item. Cada empresa tem 5 GB no total, a não ser que tenha combinado outro tamanho com a Anuntech; o quadro “Armazenamento” mostra quanto já foi usado. Uma lousa pode ter até 3 MB, contando as imagens coladas nela.",
      },
      {
        q: "O espaço da empresa acabou. O que faço?",
        a: "Exclua os arquivos que não usa mais e, na “Lixeira”, use “Excluir de vez”: o espaço volta na hora. O que fica na lixeira ainda ocupa espaço por até 30 dias, e as versões antigas de um arquivo também contam. Se precisar de mais espaço, fale com a Anuntech por um [chamado](/chamados/novo).",
      },
      {
        q: "Como mando um arquivo grande para alguém sem conta no Console?",
        a: "No “…” do arquivo ou da pasta, clique em “Compartilhar por link…”, escolha o prazo (e, se quiser, senha e limite de downloads) e copie o endereço. Veja [Compartilhar por link e pedir arquivos](/ajuda/compartilhar-por-link).",
      },
      {
        q: "Sou Administrador. Posso apagar ou mudar os itens de outra pessoa?",
        a: "Só se o item estiver numa pasta que você criou. Fora disso, um item só pode ser alterado por quem o adicionou ou pela equipe da Anuntech. Se a pessoa saiu da empresa, [abra um chamado](/chamados/novo) e peça à equipe para reorganizar ou excluir.",
      },
      {
        q: "O número ao lado da pasta não bate com o que vejo dentro dela.",
        a: "O número soma os arquivos da pasta e os das pastas de dentro que você vê. Abra as pastas de dentro, que aparecem acima da lista, para ver o resto.",
      },
      {
        q: "A lista abriu em cartões. Como vejo em linhas?",
        a: "Clique no ícone “Lista”, ao lado da busca. A escolha fica guardada neste navegador; em outro computador ou navegador, a página abre em “Grade” até você escolher de novo.",
      },
      {
        q: "Por que o arquivo não abre na prévia?",
        a: "A prévia mostra imagens, PDF, vídeos, áudios e textos de até 2 MB. Os outros tipos aparecem só com o ícone e o botão “Baixar”, por segurança, para nenhum conteúdo deles rodar dentro do Console. Abra o arquivo baixado no seu aparelho.",
      },
    ],
    actions: [{ label: "Ir para Arquivos", href: "/bookmarks" }],
    related: ["pastas-e-compartilhamento", "compartilhar-por-link", "lixeira-versoes-e-atividade", "buscar-e-etiquetas", "lousas"],
    updatedAt: "2026-10-27",
  },
  {
    slug: "pastas-e-compartilhamento",
    category: "bookmarks",
    title: "Pastas e compartilhamento",
    summary: "Organize Arquivos em pastas, umas dentro das outras, e escolha se cada pasta é vista pela empresa toda ou só por pessoas escolhidas, e se quem vê pode adicionar.",
    audience: "todos",
    keywords: [
      "pasta",
      "pastas",
      "nova pasta",
      "subpasta",
      "pasta dentro de pasta",
      "compartilhar",
      "compartilhamento",
      "compartilhar pasta",
      "quem ve",
      "pasta privada",
      "privado",
      "so pessoas escolhidas",
      "todos da empresa",
      "so ver e baixar",
      "renomear pasta",
      "excluir pasta",
      "mover pasta",
      "restringir acesso",
      "permissao arquivos",
      "bookmarks",
      "drive",
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
              { term: "Pastas “Contratos” e “Entregas”", text: "Mantidas pelo Console: “Contratos” só para os Administradores, e cada pasta de projeto em “Entregas” só para quem vê aquele projeto. Veja [Arquivos](/ajuda/bookmarks)." },
              { term: "Equipe da Anuntech", text: "Vê todas as pastas e todos os itens, inclusive os das pastas “Só pessoas escolhidas”." },
            ],
          },
          {
            kind: "p",
            text: "Ao abrir uma pasta “Só pessoas escolhidas”, o cabeçalho mostra quem a vê: “Só você” ou o nome de quem criou a pasta e o número de pessoas escolhidas, como “Só Marina e 3 pessoas”. Uma pasta aberta a toda a empresa não traz essa linha. Na coluna da esquerda, uma pasta “Só pessoas escolhidas” aparece com o ícone de pessoas.",
          },
          {
            kind: "p",
            text: "O [assistente](/ajuda/assistente) segue as mesmas regras: ele só encontra os itens que você vê em Arquivos. Os de uma pasta “Só pessoas escolhidas” ficam de fora para quem não está entre as pessoas da pasta.",
          },
          {
            kind: "p",
            text: "A escolha “Só o que eu escolher”, que o Administrador faz para um Membro, limita projetos, produtos e chamados. Em Arquivos, ela vale só para as pastas de projeto em “Entregas”: o Membro vê as dos projetos liberados para ele. O resto segue as regras das pastas. Veja [Escolher o que cada Membro vê](/ajuda/o-que-cada-membro-ve).",
          },
        ],
      },
      {
        title: "Criar uma pasta",
        blocks: [
          {
            kind: "steps",
            items: [
              "Em [Arquivos](/bookmarks), clique em “Nova pasta”. No computador, ela fica na coluna da esquerda, abaixo das pastas. No celular, é o ícone de pasta com + ao lado de “Adicionar”.",
              "Dê um “Nome”, por exemplo: Referências de design.",
              "Em “Quem vê”, escolha “Todos da empresa” ou “Só pessoas escolhidas”. As pessoas você escolhe depois, em “Compartilhar”.",
              "Clique em “Criar pasta”. Aparece “Pasta criada.” e a pasta abre em seguida.",
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
              "Abra uma pasta e clique em “Nova pasta”: a nova fica dentro dela, e o campo “Quem vê” não aparece, porque quem vê segue a pasta de cima. Dá para ir até 5 níveis, como Marca › Logo › SVG.",
              "Mudar quem vê uma pasta, em “Compartilhar”, muda também as pastas de dentro.",
              "Dentro de uma pasta, as pastas dela aparecem acima dos arquivos, e o topo da página mostra o caminho; clique em uma pasta do caminho para voltar até ela.",
              "Na coluna da esquerda, as pastas de dentro aparecem recuadas, abaixo da de cima. A seta ao lado do nome abre ou recolhe; a escolha fica guardada neste navegador.",
              "O número ao lado de cada pasta soma os arquivos dela e os das pastas de dentro que você vê.",
              "“Mover para…”, no menu “…” da pasta, leva a pasta, com tudo o que tem dentro, para outra pasta da mesma empresa ou para “Início (fora de outras pastas)”. Quem vê passa a seguir a pasta de destino.",
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
              "Em “Quem vê pode”, escolha “Ver, baixar e adicionar itens” ou “Só ver e baixar”.",
              "Clique em “Salvar”. Aparece “Compartilhamento atualizado.”, e cada pessoa incluída recebe um e-mail com o link para a pasta.",
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
        title: "Quem pode adicionar",
        blocks: [
          {
            kind: "p",
            text: "Quem vê uma pasta também adiciona itens nela, enquanto “Quem vê pode” estiver em “Ver, baixar e adicionar itens”, o padrão. Com “Só ver e baixar”, só quem criou a pasta e a equipe da Anuntech adicionam; para as outras pessoas, os botões “Enviar” e “Adicionar” não aparecem nessa pasta. A escolha fica em “Compartilhar” e vale também para pastas “Todos da empresa”.",
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
            text: "Excluir a pasta não apaga o que está nela. Numa pasta dentro de outra, os arquivos e as pastas de dentro vão para a pasta de cima. Numa pasta do início, os arquivos vão para “Sem pasta” e as pastas de dentro sobem para o início. O compartilhamento da pasta excluída é desfeito.",
          },
          {
            kind: "note",
            tone: "attention",
            text: "Em “Sem pasta”, os itens ficam visíveis para toda a empresa. Antes de excluir uma pasta “Só pessoas escolhidas”, mova o que for reservado para outra pasta restrita ou mande esses itens para a lixeira. O mesmo cuidado vale ao usar “Mover para” e escolher “Sem pasta”.",
          },
        ],
      },
      {
        title: "Quem pode mudar uma pasta",
        blocks: [
          {
            kind: "p",
            text: "Renomear, compartilhar, mover, excluir uma pasta e criar links externos para ela ficam com quem a criou e com a equipe da Anuntech. Só essas pessoas veem o menu “…” da pasta. Ser Administrador da empresa não dá esse direito, nem acesso às pastas “Só pessoas escolhidas” de outras pessoas. As pastas “Contratos” e “Entregas” são do Console e não têm esse menu para ninguém da empresa.",
          },
          {
            kind: "p",
            text: "Quem criou a pasta também pode editar, mover e excluir qualquer item que esteja dentro dela, inclusive os adicionados por outras pessoas.",
          },
          {
            kind: "note",
            tone: "info",
            text: "O menu “…” das pastas fica na coluna da esquerda, que aparece em telas a partir de 1024 px de largura. No celular dá para ver, buscar, adicionar e criar pastas. Para renomear, compartilhar, mover ou excluir, use um computador ou um tablet na horizontal.",
          },
          {
            kind: "note",
            tone: "attention",
            text: "Mesmo numa pasta restrita, não guarde senhas nem dados reais dos seus clientes em Arquivos.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Excluí uma pasta. O que estava nela foi apagado?",
        a: "Não. Os arquivos e as pastas de dentro sobem um nível: para a pasta de cima ou, se a pasta estava no início, os arquivos vão para “Sem pasta”. Em “Sem pasta”, ficam visíveis para toda a empresa. Se a pasta era “Só pessoas escolhidas”, mova o que for reservado para outra pasta restrita.",
      },
      {
        q: "Quero que as pessoas vejam e baixem, mas não coloquem nada na pasta.",
        a: "No “…” da pasta, clique em “Compartilhar” e, em “Quem vê pode”, escolha “Só ver e baixar”. Aí só você e a equipe da Anuntech adicionam itens nela.",
      },
      {
        q: "Sou Administrador. Consigo ver as pastas restritas dos Membros?",
        a: "Só se quem criou a pasta incluir você. Ser Administrador não dá acesso às pastas “Só pessoas escolhidas” de outras pessoas, nem permite renomeá-las ou excluí-las.",
      },
      {
        q: "Por que não vejo o menu “…” numa pasta?",
        a: "Só quem criou a pasta vê esse menu, e ele aparece ao passar o mouse sobre a pasta na coluna da esquerda, em telas a partir de 1024 px. As pastas “Contratos” e “Entregas” são mantidas pelo Console e não têm esse menu. Se você precisa mudar uma pasta de outra pessoa, peça a ela.",
      },
      {
        q: "Por que não consigo renomear, compartilhar ou excluir uma pasta pelo celular?",
        a: "As opções da pasta ficam na coluna de pastas, que só aparece em telas a partir de 1024 px de largura. No celular dá para ver, buscar, adicionar e criar pastas. Para o resto, use um computador ou um tablet na horizontal.",
      },
      {
        q: "Posso compartilhar uma pasta com alguém de fora da empresa?",
        a: "Pelo “Compartilhar”, não: a busca só mostra quem tem acesso à sua empresa no Console e a equipe da Anuntech. Para quem não tem conta, use “Compartilhar por link…” ou “Pedir arquivos…”, no mesmo menu. Veja [Compartilhar por link e pedir arquivos](/ajuda/compartilhar-por-link).",
      },
      {
        q: "Quem criou a pasta saiu da empresa. E agora?",
        a: "A pasta e os itens continuam onde estão. Como só quem criou a pasta pode renomear, compartilhar ou excluir, [abra um chamado](/chamados/novo) e peça à equipe da Anuntech para reorganizar. Os links externos que essa pessoa criou param de abrir.",
      },
    ],
    actions: [{ label: "Ir para Arquivos", href: "/bookmarks" }],
    related: ["bookmarks", "compartilhar-por-link", "o-que-cada-membro-ve", "membro-ou-administrador"],
    updatedAt: "2026-10-27",
  },
  {
    slug: "lousas",
    category: "bookmarks",
    title: "Lousas",
    summary: "A lousa é um quadro em branco dentro de Arquivos para desenhar fluxos, rabiscar telas e anotar ideias, e salva sozinha.",
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
      "arquivos",
      "bookmarks",
    ],
    sections: [
      {
        title: "O que é",
        blocks: [
          {
            kind: "p",
            text: "A lousa é o terceiro tipo de item em Arquivos, ao lado de link e arquivo: um quadro em branco para desenhar fluxos, rabiscar telas e anotar ideias. Ela fica guardada com os arquivos da empresa, na pasta que você escolher, e segue as mesmas regras de quem vê. Veja [Pastas e compartilhamento](/ajuda/pastas-e-compartilhamento).",
          },
        ],
      },
      {
        title: "Criar uma lousa",
        blocks: [
          {
            kind: "steps",
            items: [
              "Em [Arquivos](/bookmarks), clique em “Adicionar”. Se você estiver dentro de uma pasta, ela já vem escolhida.",
              "Em “Tipo”, escolha “Lousa”.",
              "Preencha o “Título”, por exemplo: Fluxo do onboarding.",
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
              "No menu do quadro (o ícone de três linhas) ficam “Exportar imagem...”, “Limpar o canvas e redefinir a cor de fundo”, “Voltar aos bookmarks” (que volta para Arquivos) e “Fundo da tela”.",
              "Para mudar o título ou a pasta, volte a Arquivos, clique em “…” na lousa e em “Editar” ou “Renomear”. O desenho fica como está.",
            ],
          },
          {
            kind: "p",
            text: "Para abrir uma lousa depois, clique nela em Arquivos ou no bloco “Arquivos” da [Visão geral](/painel). Na grade, a lousa aparece com uma miniatura do desenho.",
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
              "A miniatura da grade de Arquivos é refeita a cada gravação que tem algum desenho. Uma lousa limpa continua com a última miniatura.",
              "O Console registra quem desenhou, uma vez a cada vez que a lousa é aberta e alterada. Isso aparece na “Atividade” da lousa, como “Desenhou na lousa”.",
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
              {
                term: "Fora do .zip",
                text: "Lousas não entram no .zip de uma pasta nem num link externo. Para levar o desenho, use “Exportar imagem...”.",
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
            text: "Quem vê a lousa em Arquivos abre a lousa. Desenham quem criou a lousa, quem criou a pasta onde ela está e a equipe da Anuntech. Ser Administrador da empresa não muda isso.",
          },
          {
            kind: "p",
            text: "As outras pessoas veem a lousa com “Só leitura” no topo e podem usar “Exportar imagem...” no menu do quadro. Se ela ainda estiver vazia, aparece “Ainda não há nada nesta lousa.”.",
          },
          {
            kind: "note",
            tone: "attention",
            text: "“Limpar o canvas e redefinir a cor de fundo” apaga tudo o que está na lousa e, depois de confirmado, a lousa salva sozinha sem o desenho; isso não tem volta. Excluir a lousa em Arquivos leva a lousa, com o desenho, para a lixeira, onde ela fica por 30 dias.",
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
        a: "Desenham quem criou a lousa, quem criou a pasta onde ela está e a equipe da Anuntech. Quem só vê abre a lousa em “Só leitura”. Não há desenho ao vivo entre duas pessoas: combine quem desenha em cada momento.",
      },
      {
        q: "Abri a lousa e está escrito “Só leitura”. O que faço?",
        a: "Você pode ver, mas não desenhar. Peça a quem criou a lousa ou a quem criou a pasta. Se precisar de um quadro seu, crie uma lousa nova em Arquivos.",
      },
      {
        q: "Excluí uma lousa sem querer. Dá para recuperar?",
        a: "Sim, por 30 dias. Abra a “Lixeira”, em Arquivos, clique em “…” na lousa e em “Restaurar”. Ela volta com o desenho para a pasta onde estava.",
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
    actions: [{ label: "Ir para Arquivos", href: "/bookmarks" }],
    related: ["bookmarks", "pastas-e-compartilhamento", "lixeira-versoes-e-atividade", "aparencia"],
    updatedAt: "2026-10-27",
  },
  {
    slug: "compartilhar-por-link",
    category: "bookmarks",
    title: "Compartilhar por link e pedir arquivos",
    summary: "Mande um arquivo ou uma pasta para quem não tem conta no Console, ou receba arquivos dessa pessoa numa pasta, com prazo, senha e limite de downloads.",
    audience: "todos",
    keywords: [
      "compartilhar por link",
      "link externo",
      "link publico",
      "mandar arquivo",
      "enviar arquivo grande",
      "transferir arquivo",
      "wetransfer",
      "pedir arquivos",
      "receber arquivos",
      "upload",
      "enviar arquivo",
      "senha no link",
      "limite de downloads",
      "prazo do link",
      "desligar link",
      "baixar tudo",
      "drive",
      "bookmarks",
    ],
    sections: [
      {
        title: "Para que serve",
        blocks: [
          {
            kind: "pairs",
            items: [
              {
                term: "“Compartilhar por link…”",
                text: "Num arquivo ou numa pasta. Quem tiver o endereço vê os arquivos e baixa, sem entrar no Console. Numa pasta, o link leva também os arquivos das pastas de dentro. O endereço começa com /compartilhado/.",
              },
              {
                term: "“Pedir arquivos…”",
                text: "Só numa pasta. Quem tiver o endereço envia arquivos para essa pasta, sem conta e sem ver o que já está nela. O endereço começa com /enviar/.",
              },
            ],
          },
          {
            kind: "p",
            text: "Para quem já tem acesso à sua empresa no Console, não precisa de link externo: use “Copiar link” no menu “…” do item, ou compartilhe a pasta, como explica [Pastas e compartilhamento](/ajuda/pastas-e-compartilhamento).",
          },
        ],
      },
      {
        title: "Criar um link",
        blocks: [
          {
            kind: "steps",
            items: [
              "Em [Arquivos](/bookmarks), clique em “…” no arquivo e em “Compartilhar por link…”. Numa pasta, use o “…” dela na coluna da esquerda e escolha “Compartilhar por link…” ou “Pedir arquivos…”. Na prévia de um arquivo, o botão “Compartilhar” faz o mesmo.",
              "Em “Vale por”, escolha 1, 7 (o padrão), 30 ou 90 dias, ou “Sem prazo”.",
              "Em “Limite de downloads”, se quiser, diga depois de quantos downloads o link para. Vazio, não tem limite. Esse campo não aparece em “Pedir arquivos”.",
              "Em “Senha”, se quiser, escolha uma senha de 6 a 100 caracteres.",
              "Em “Enviar o link por e-mail”, se quiser, escreva o e-mail da pessoa: o Console manda o endereço para ela, com o prazo e, se houver senha, o aviso de que ela deve pedir a senha a você.",
              "Clique em “Criar link” e copie o endereço com “Copiar”.",
            ],
          },
          {
            kind: "note",
            tone: "attention",
            text: "O endereço aparece uma vez só: por segurança, o Console não mostra de novo. Se perder, crie outro link com “Criar outro link” e desligue o antigo.",
          },
        ],
      },
      {
        title: "O que a pessoa vê",
        blocks: [
          {
            kind: "list",
            items: [
              "Num link de download: quem compartilhou, o nome do arquivo ou da pasta, quantos arquivos são, até quando o link vale e quantos downloads restam. Cada arquivo tem o botão “Baixar”.",
              "Num link de pasta com mais de um arquivo, o botão “Baixar tudo (.zip)” baixa tudo de uma vez, na mesma organização de pastas. Isso conta como um download no limite. O .zip vai até 3,5 GB e 2.000 arquivos.",
              "Com senha, a página mostra só “Arquivos protegidos por senha”, sem o nome do que foi compartilhado, até a pessoa digitar a senha e clicar em “Abrir”.",
              "Num pedido de arquivos: a pessoa escreve “Seu nome” (opcional), escolhe ou arrasta os arquivos e envia. Ela não vê o que já está na pasta.",
              "Links e lousas não entram num link de download: só arquivos.",
            ],
          },
        ],
      },
      {
        title: "Arquivos recebidos",
        blocks: [
          {
            kind: "list",
            items: [
              "Cada arquivo enviado pelo pedido chega na pasta em nome de quem criou o link. Na “Atividade” do item aparece “Enviado pelo pedido de arquivos”, com o nome que a pessoa escreveu e “sem conta”.",
              "Programas e scripts (como .exe, .bat, .sh, .dmg e .apk) não são aceitos. A pessoa vê “Por segurança, programas e scripts não são aceitos por este link. Envie em .zip ou fale com quem pediu.”.",
              "Cada arquivo pode ter até 100 GB. Os recebidos ocupam o espaço da empresa: quando o espaço acaba, a pessoa vê “O espaço de quem pediu acabou. Fale com quem enviou o link.”.",
            ],
          },
        ],
      },
      {
        title: "Acompanhar e desligar",
        blocks: [
          {
            kind: "p",
            text: "Abra de novo “Compartilhar por link…” ou “Pedir arquivos…” no mesmo item ou pasta. Em “Links criados” aparece cada link, com a situação (“Ativo”, “Vencido”, “Desligado” ou “Limite de downloads atingido”), se tem senha, quem criou, até quando vale e quantos downloads teve, ou quantos arquivos recebeu. “Desligar” para o link na hora, mesmo para quem já tinha aberto, e aparece “Link desligado. Quem tiver o endereço não abre mais.”.",
          },
          {
            kind: "p",
            text: "Um link só funciona enquanto quem o criou ainda pode criá-lo. Se essa pessoa sair da empresa, perder o direito de editar o item ou de mexer na pasta, ou tiver a conta excluída, o link para de abrir, e quem tiver o endereço lê “Este link foi desligado por quem enviou.”. Se o acesso voltar, o link volta a funcionar.",
          },
        ],
      },
      {
        title: "Quem pode criar",
        blocks: [
          {
            kind: "p",
            text: "Um link de arquivo fica com quem pode editar o arquivo: quem o adicionou, quem criou a pasta onde ele está e a equipe da Anuntech. Um link de pasta, de download ou de pedido, fica com quem criou a pasta e com a equipe. As pastas “Contratos” e “Entregas”, mantidas pelo Console, não ganham link externo pela empresa. Ser Administrador da empresa não muda isso.",
          },
          {
            kind: "note",
            tone: "attention",
            text: "Qualquer pessoa com o endereço abre o link. Use prazo curto, senha ou limite de downloads para arquivos sensíveis, mande a senha por outro canal, não junto do link, e desligue o link quando não precisar mais.",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Como mando um arquivo grande para alguém sem conta no Console?",
        a: "Envie o arquivo para Arquivos, clique em “…” nele e em “Compartilhar por link…”. Escolha o prazo e, se quiser, senha e limite de downloads, clique em “Criar link” e mande o endereço. O arquivo pode ter até 100 GB.",
      },
      {
        q: "Mandei um link para a pessoa errada. E agora?",
        a: "Abra “Compartilhar por link…” no mesmo arquivo ou pasta e, em “Links criados”, clique em “Desligar”. O link para na hora.",
      },
      {
        q: "Perdi o endereço do link. Dá para ver de novo?",
        a: "Não. Por segurança, o endereço aparece só quando o link é criado. Crie outro link e desligue o antigo em “Links criados”.",
      },
      {
        q: "A pessoa diz que o link não abre mais.",
        a: "Veja em “Links criados” a situação dele: ele pode ter vencido, chegado ao limite de downloads ou sido desligado. Também para quando quem criou o link perde o acesso ao item ou à pasta. Crie um link novo, se for o caso.",
      },
      {
        q: "Não vejo “Compartilhar por link…” no menu.",
        a: "A opção aparece para quem pode editar o arquivo ou criou a pasta, e para a equipe da Anuntech. Entre os itens, só arquivos têm essa opção; links e lousas não são compartilhados assim. Peça a quem adicionou o arquivo ou criou a pasta.",
      },
      {
        q: "Quem mandou arquivos pelo pedido vê o que já está na pasta?",
        a: "Não. A página do pedido só recebe arquivos. A pessoa não vê nem baixa o que está na pasta, nem o que outras pessoas enviaram.",
      },
    ],
    actions: [{ label: "Ir para Arquivos", href: "/bookmarks" }],
    related: ["bookmarks", "pastas-e-compartilhamento", "lixeira-versoes-e-atividade", "seus-dados"],
    updatedAt: "2026-10-27",
  },
  {
    slug: "lixeira-versoes-e-atividade",
    category: "bookmarks",
    title: "Lixeira, versões e atividade",
    summary: "O que você exclui em Arquivos fica 30 dias na lixeira, cada arquivo guarda as versões anteriores, e a atividade mostra quem enviou, baixou e mudou.",
    audience: "todos",
    keywords: [
      "lixeira",
      "excluir",
      "apagar arquivo",
      "recuperar arquivo",
      "restaurar",
      "excluir de vez",
      "desfazer exclusao",
      "versao",
      "versoes",
      "nova versao",
      "substituir arquivo",
      "trocar arquivo",
      "historico",
      "atividade",
      "quem baixou",
      "bookmarks",
      "drive",
    ],
    sections: [
      {
        title: "Lixeira",
        blocks: [
          {
            kind: "p",
            text: "O que você exclui em [Arquivos](/bookmarks) vai para a “Lixeira”, na coluna da esquerda (no celular, no seletor de pastas), e fica lá por 30 dias, com o arquivo, o link ou o desenho. Cada item mostra quantos dias faltam, como “some em 27 dias”. Na lixeira, nada abre nem baixa.",
          },
          {
            kind: "list",
            items: [
              "Para excluir um item, clique em “…” e em “Excluir”, e confirme em “Mover para a lixeira”. Para vários, marque as caixas e use “Lixeira” na barra de cima.",
              "“Restaurar”, no menu “…” do item na lixeira, devolve o item para a pasta onde estava, ou para “Sem pasta” se a pasta foi excluída.",
              "“Excluir de vez” apaga o item, o arquivo e as versões dele na hora. Isso não tem volta.",
              "Depois de 30 dias, o item sai da lixeira sozinho, para sempre.",
              "Restaurar e excluir de vez ficam com quem adicionou o item, com quem criou a pasta e com a equipe da Anuntech. Para as outras pessoas, o menu mostra “Só quem adicionou ou o dono da pasta restaura”.",
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
        title: "Versões de um arquivo",
        blocks: [
          {
            kind: "steps",
            items: [
              "Clique em “…” no arquivo e em “Editar”.",
              "Em “Versões”, clique em “Enviar nova versão” e escolha o arquivo novo.",
              "Ao terminar, aparece “Nova versão salva”, com o número da versão. O arquivo novo passa a ser o do item, com o mesmo título e na mesma pasta, e o anterior fica em “Versões”.",
            ],
          },
          {
            kind: "list",
            items: [
              "Cada versão anterior aparece como “Versão 1”, “Versão 2” e assim por diante, com o nome do arquivo, o tamanho, a data e quem enviou.",
              "O botão de download baixa aquela versão. O de restaurar faz ela voltar a ser o arquivo atual; o que estava vira uma versão, então nada se perde.",
              "Enviar e restaurar versões fica com quem pode editar o item. Quem só vê o item baixa as versões.",
              "As versões ocupam o espaço da empresa e saem junto com o item quando ele é excluído de vez.",
              "As cópias guardadas pelo Console nas pastas “Contratos” e “Entregas” não ganham versões: para mudar, mude o contrato ou a tarefa.",
            ],
          },
        ],
      },
      {
        title: "Atividade",
        blocks: [
          {
            kind: "p",
            text: "Em “Editar”, a seção “Atividade” (“Ver quem enviou, baixou e mudou”) mostra o que aconteceu com o item, do mais recente para o mais antigo, com quem fez, data e hora. Por exemplo: “Adicionou”, “Editou”, “Enviou uma nova versão”, “Baixou”, “Moveu para a lixeira”, “Criou um link externo”, “Baixado pelo link externo” e “Enviado pelo pedido de arquivos”.",
          },
          {
            kind: "list",
            items: [
              "O que veio de alguém sem conta, por um link externo, aparece como “Alguém sem conta”, ou com o nome que a pessoa escreveu.",
              "A atividade aparece só para quem pode editar o item: quem o adicionou, quem criou a pasta e a equipe da Anuntech. Quem só vê o item não vê quem baixou.",
              "Ela mostra as 50 ações mais recentes.",
            ],
          },
        ],
      },
    ],
    faq: [
      {
        q: "Excluí um arquivo sem querer. Dá para recuperar?",
        a: "Sim, por 30 dias. Abra a “Lixeira”, clique em “…” no item e em “Restaurar”. Ele volta para a pasta onde estava.",
      },
      {
        q: "Excluí um arquivo e o espaço não voltou.",
        a: "O que está na lixeira ainda ocupa espaço. Abra a “Lixeira”, clique em “…” no item e em “Excluir de vez”. O espaço volta na hora, mas o item não pode mais ser recuperado.",
      },
      {
        q: "Como troco o arquivo de um item sem perder o anterior?",
        a: "Em “Editar”, na seção “Versões”, clique em “Enviar nova versão”. O anterior fica guardado como versão e pode ser baixado ou restaurado a qualquer momento.",
      },
      {
        q: "Consigo saber quem baixou um arquivo?",
        a: "Sim, se você pode editar o item. Abra “Editar” e a seção “Atividade”: cada download aparece com o nome da pessoa, ou como baixado pelo link externo, com data e hora.",
      },
    ],
    actions: [{ label: "Ir para Arquivos", href: "/bookmarks" }],
    related: ["bookmarks", "compartilhar-por-link", "pastas-e-compartilhamento"],
    updatedAt: "2026-10-27",
  },
  {
    slug: "buscar-e-etiquetas",
    category: "bookmarks",
    title: "Buscar dentro dos arquivos e etiquetas",
    summary: "A busca de Arquivos encontra palavras escritas dentro de PDFs, documentos, planilhas e apresentações, e cada arquivo ganha uma etiqueta para filtrar a lista.",
    audience: "todos",
    keywords: [
      "buscar",
      "busca",
      "pesquisar",
      "procurar arquivo",
      "achar arquivo",
      "buscar no conteudo",
      "texto do arquivo",
      "pdf",
      "word",
      "excel",
      "powerpoint",
      "etiqueta",
      "etiquetas",
      "tag",
      "classificar",
      "filtro",
      "bookmarks",
      "drive",
    ],
    sections: [
      {
        title: "O que a busca procura",
        blocks: [
          {
            kind: "p",
            text: "O campo “Buscar pelo nome ou pelo que está escrito no arquivo”, em [Arquivos](/bookmarks), procura no título, no endereço do link, no nome do arquivo e no texto de dentro dos arquivos: PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), arquivos do LibreOffice (.odt, .ods, .odp), páginas HTML e textos (como .txt, .md, .csv e .json).",
          },
          {
            kind: "list",
            items: [
              "Para buscar no texto, digite pelo menos 3 letras. Acentos não fazem diferença.",
              "A busca procura palavras inteiras e parecidas: em “contrato”, acha também “contratos”. Se não achar, tente a palavra completa ou outra parecida.",
              "Quando a palavra está dentro do arquivo, o item mostra o trecho com ela destacada.",
              "A busca vale para o que está aberto: a empresa, a pasta e os filtros escolhidos. Para procurar em tudo, abra “Todos”.",
              "O texto de um arquivo novo entra na busca alguns segundos depois de salvar.",
            ],
          },
          {
            kind: "note",
            tone: "info",
            text: "Imagens, vídeos, PDFs escaneados (que são fotos de páginas), formatos antigos como .doc e .xls e arquivos acima de 50 MB não têm o texto lido; nesses, busque pelo título ou pelo nome do arquivo. De arquivos muito longos, a busca lê as primeiras 40 páginas, mais ou menos.",
          },
          {
            kind: "p",
            text: "O [assistente](/ajuda/assistente) também acha arquivos pelo que está escrito neles e lê o texto para responder ou resumir, só entre os itens que você vê.",
          },
        ],
      },
      {
        title: "Etiquetas",
        blocks: [
          {
            kind: "p",
            text: "Cada arquivo pode ter uma etiqueta: Contrato, Proposta, Nota fiscal, Boleto, Comprovante, Relatório, Apresentação, Planilha, Marca e logo, Foto, Vídeo, Documento pessoal, Ata ou Briefing. O Console sugere uma sozinho, alguns segundos depois de salvar. A etiqueta aparece ao lado do nome do arquivo e nos “Detalhes” da prévia.",
          },
          {
            kind: "list",
            items: [
              "Primeiro, o Console tenta pelas regras: o nome, o tipo e o começo do texto do arquivo. Só quando nenhuma regra serve, a IA do Console escolhe uma etiqueta da lista.",
              "Acima da lista, clique numa etiqueta para ver só os itens com ela. O número ao lado diz quantos são. “Todas as etiquetas” volta a mostrar tudo.",
              "Para trocar ou tirar, abra “Editar” e escolha em “Etiqueta” (ou “Sem etiqueta”). Uma etiqueta sugerida mostra “Sugerida pelo Console a partir do nome e do conteúdo. Troque se não servir.”.",
              "A sua escolha vale sempre: o Console não muda uma etiqueta escolhida por uma pessoa, nem quando chega uma nova versão do arquivo.",
              "Trocar a etiqueta fica com quem pode editar o item.",
            ],
          },
          {
            kind: "note",
            tone: "attention",
            text: "Quando a IA escolhe, ela lê o título e o começo do texto, sem e-mails, telefones e documentos. O provedor não guarda o texto nem treina com ele. Veja [Seus dados e privacidade](/ajuda/seus-dados).",
          },
        ],
      },
    ],
    faq: [
      {
        q: "Por que a busca não encontra o meu arquivo?",
        a: "Confira a empresa e a pasta escolhidas: a busca vale para o que está aberto. Dentro dos arquivos, a busca procura palavras inteiras, então tente a palavra completa ou outra parecida. Imagens, vídeos, PDFs escaneados e arquivos acima de 50 MB não têm o texto lido; nesses, busque pelo título ou pelo nome do arquivo.",
      },
      {
        q: "A etiqueta que o Console escolheu está errada.",
        a: "Abra “…” no arquivo, clique em “Editar” e escolha outra em “Etiqueta”, ou “Sem etiqueta”. A sua escolha fica, e o Console não muda mais a etiqueta desse arquivo.",
      },
      {
        q: "Links e lousas têm etiqueta?",
        a: "O Console sugere etiquetas só para arquivos. Num link ou numa lousa, você pode escolher uma em “Editar”, se quiser filtrar por ela.",
      },
    ],
    actions: [{ label: "Ir para Arquivos", href: "/bookmarks" }],
    related: ["bookmarks", "assistente", "seus-dados"],
    updatedAt: "2026-10-27",
  },
  {
    slug: "assistente",
    category: "assistente",
    title: "O assistente do Console",
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
                text: "Chamados e as últimas mensagens de cada um, projetos, tarefas e comentários, produtos e serviços, os itens que você vê em Arquivos (o assistente acha um arquivo pelo nome ou pelo que está escrito nele e lê o texto de PDFs, Word, Excel, PowerPoint e textos para responder ou resumir, por exemplo “ache o contrato da Espaço Absolut” ou “o que diz a ata de outubro?”), os dados da empresa, a sua conta, os artigos desta Ajuda e as informações sobre a Anuntech. O Administrador também consulta faturas, boletos, Pix, recorrências, totais, contratos, orçamentos e quem tem acesso à empresa.",
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
                term: "Arquivos",
                text: "Organizar Arquivos como você faria na tela: criar pastas (também dentro de outras), juntar várias pastas numa só, mover itens, renomear, trocar a etiqueta, copiar, mandar para a lixeira e restaurar, excluir uma pasta, mudar quem vê e criar um link externo. Por exemplo: “junte as pastas de marca numa pasta Anuntech” ou “mande para a lixeira os PDFs antigos da pasta Propostas”. Cada mudança aparece num cartão com os nomes das pastas e dos itens, e só acontece quando você confirma. O assistente só mexe no que você poderia mexer. Enviar arquivos você faz em [Arquivos](/bookmarks).",
              },
              {
                term: "Preencher a tela",
                text: "Com um formulário aberto, diga, por exemplo, “preencha este formulário com …”. Ele preenche e avisa quantos campos preencheu, com “Confira antes de salvar.”. Para enviar o formulário, ele mostra um cartão e só envia quando você confirma. Ele só aciona os botões que a tela libera para ele, como “Abrir chamado”, um por vez. Aceitar ou recusar um orçamento, assinar um contrato, aprovar ou contestar horas e as confirmações de enviar ou excluir ficam fora do alcance dele: ele não lê, não preenche e não clica nesses formulários.",
              },
              {
                term: "Dar acesso",
                text: "Só o Administrador: dar acesso a uma pessoa como Administrador ou Membro. Quem ainda não tinha acesso recebe o convite por e-mail e, como Membro, vê tudo da empresa. Para escolher o que um Membro vê, veja [Escolher o que cada Membro vê](/ajuda/o-que-cada-membro-ve).",
              },
              { term: "Abrir telas", text: "Leva você à tela certa, como Chamados, Projetos, Arquivos ou Como trabalhamos." },
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
            text: "O assistente nunca altera nada sozinho. Para abrir ou responder um chamado, mexer em tarefas, comentar, guardar um link em Arquivos, criar uma pasta, dar acesso a alguém ou enviar um formulário, ele mostra um cartão no painel com o que vai fazer e os dados. Só acontece quando você toca em “Confirmar”.",
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
              "Não segue instruções escritas em chamados, comentários, tarefas ou arquivos: trata esse texto como informação. Depois de ler um texto desses, as consultas daquela resposta ficam na empresa do registro que você está vendo.",
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
    updatedAt: "2026-10-27",
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
