/*
 * "Como trabalhamos": how Anuntech works with its clients, in the client's
 * words. No deadline or number lives here: what a company's contract
 * promises comes from its conditions (lib/service-terms) and is rendered
 * next to this text. Versioned, so reading it can be recorded per version.
 */

export const GUIDE_VERSION = 1;

export type GuideBlock =
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "steps"; items: string[] }
  | { kind: "pairs"; items: { term: string; text: string }[] };

export type GuideSection = { id: string; title: string; lead: string; blocks: GuideBlock[] };

export const guideSections: GuideSection[] = [
  {
    id: "chamados",
    title: "Quando abrir um chamado",
    lead: "O chamado é o canal oficial com a equipe: a conversa, os arquivos e cada mudança ficam registrados.",
    blocks: [
      {
        kind: "pairs",
        items: [
          { term: "Parou ou deu erro", text: "Algo não funciona como deveria. Diga o impacto: se parou tudo, a equipe trata primeiro." },
          { term: "Dúvida", text: "Como usar ou onde encontrar algo." },
          { term: "Ajuste ou algo novo", text: "Um texto, uma regra, uma tela ou uma função. A equipe avalia se entra no que você já tem ou se precisa de orçamento." },
          { term: "Acesso", text: "Liberar, remover ou recuperar um acesso." },
          { term: "App ou projeto novo", text: "A equipe conversa com você e prepara um orçamento." },
        ],
      },
      { kind: "p", text: "Para uma tarefa de projeto em andamento, comente na própria tarefa. O que você pedir por WhatsApp ou telefone, a equipe registra num chamado: é ali que o pedido passa a contar." },
      { kind: "p", text: "Não escreva senhas nem dados reais dos seus clientes no chamado. Se a equipe precisar de um acesso, ela combina com você um jeito seguro." },
    ],
  },
  {
    id: "tempo",
    title: "Prazos e como contamos o tempo",
    lead: "Os prazos dizem quando esperar cada resposta. Eles são os do contrato da sua empresa.",
    blocks: [
      {
        kind: "list",
        items: [
          "Dias úteis: segunda a sexta, menos os feriados nacionais e os da cidade da sede da Anuntech.",
          "Horário: das 9h às 18h, horário de Brasília.",
          "Um chamado aberto fora desse horário começa a contar às 9h do próximo dia útil.",
          "A primeira resposta é um compromisso. A solução, quando o contrato prevê, tem uma meta: depende do problema, dos acessos e de respostas suas e de outros fornecedores.",
          "A prioridade faz um sistema parado ser atendido antes de uma dúvida. A equipe confirma a prioridade ao ler o chamado e avisa quando muda.",
        ],
      },
      { kind: "p", text: "Por que contamos assim: dias úteis são os dias em que a equipe que conhece o seu sistema está trabalhando. Quando falta algo seu, ninguém avança, e por isso alguns contratos param o prazo enquanto a equipe espera você." },
    ],
  },
  {
    id: "voce",
    title: "O que ajuda a equipe",
    lead: "Algumas atitudes fazem cada pedido andar mais rápido.",
    blocks: [
      {
        kind: "list",
        items: [
          "Descreva o problema com os passos para repetir e um print.",
          "Responda quando o chamado estiver em \"Aguardando você\": ele mostra o que falta.",
          "Mantenha os acessos que a equipe usa para trabalhar.",
          "Dê acesso ao Console só a quem precisa e remova em Membros quem sair da empresa. Cada acesso é pessoal.",
          "Avise antes de trocar sistemas, servidores, integrações ou fornecedores.",
          "Guarde a sua própria cópia dos dados importantes.",
          "Mantenha atualizados os contatos que recebem os avisos.",
        ],
      },
    ],
  },
  {
    id: "projetos",
    title: "Projetos",
    lead: "Um projeto aparece quando um trabalho com a Anuntech começa, depois do orçamento aceito.",
    blocks: [
      {
        kind: "list",
        items: [
          "O quadro mostra o andamento do que foi contratado, etapa por etapa. Use os comentários da tarefa para responder à equipe e enviar o que ela pedir.",
          "Pedido novo ou mudança de escopo: abra um chamado em \"Ajuste ou algo novo\". A equipe mostra o efeito no prazo e no valor, e a mudança só vale depois que um Administrador da sua empresa aprovar.",
          "Uma tarefa que você cria entra como pedido. A equipe confirma se ela faz parte do combinado.",
          "Quando uma entrega fica pronta para teste, ela aparece em Revisão para você aprovar ou apontar um problema.",
          "O que for combinado por WhatsApp, telefone ou reunião só muda o projeto depois de confirmado no Console.",
          "Erro em algo que já está em uso vai para um chamado.",
        ],
      },
    ],
  },
  {
    id: "contratar",
    title: "Contratar algo novo",
    lead: "Do primeiro pedido ao trabalho começar, tudo acontece aqui no Console.",
    blocks: [
      {
        kind: "steps",
        items: [
          "Conte o que você precisa em Pedir orçamento: o problema, quem vai usar e se há uma data importante.",
          "A equipe marca uma conversa para entender o escopo. Se houver informação sigilosa, assinamos antes um acordo de confidencialidade, que não obriga ninguém a contratar.",
          "O orçamento chega aqui no Console, com fases, horas, valor, entrada e validade, e o tempo de cada fase quando a equipe já consegue estimar. Só um Administrador da sua empresa aceita ou recusa.",
          "Com o orçamento aceito, a Anuntech prepara o contrato. Você pode pedir alterações em cada cláusula e assina no Console.",
          "O trabalho começa na reunião de início, depois do contrato assinado, da entrada paga e dos acessos liberados.",
          "Você acompanha em Projetos e testa cada entrega.",
          "Depois da entrega final, defeitos no que foi entregue são corrigidos sem custo durante a garantia do contrato. Suporte e melhorias contínuas ficam num contrato de suporte.",
        ],
      },
    ],
  },
];

export const guideSection = (id: string) => guideSections.find((s) => s.id === id) ?? null;
