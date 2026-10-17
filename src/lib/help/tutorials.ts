import type { TutorialId } from "./help-model";

/*
 * The tutorial videos (videos/tutorial-* in the working copy, light versions
 * made like videos/central-tutoriais/gerar.py: H.264 CRF 30, 650 kbps, AAC 64 kbps,
 * faststart). Only fictitious data appears in them. Files in public/ajuda/videos
 * carry a hash in the name, so a new render is a new file and caches never
 * serve an old one. The captions are burned into the video; the transcript
 * below is the narration with the second each line starts.
 */

export type Tutorial = {
  id: TutorialId;
  title: string;
  description: string;
  src: string;
  /** Seconds. */
  duration: number;
  chapters: { title: string; hint: string; start: number }[];
  transcript: [number, string][];
};

export const TUTORIALS: Tutorial[] = [
  {
    id: "chamado",
    title: "Abrir um chamado",
    description: "Peça ajuda à equipe e acompanhe a resposta.",
    src: "/ajuda/videos/chamado-84be1f2fff.mp4",
    duration: 89.68,
    chapters: [
      { title: "Abra o chamado", hint: "Na Visão geral ou na página Chamados.", start: 8.43 },
      { title: "Conte o que aconteceu", hint: "Tipo, impacto, assunto, descrição e anexos.", start: 16.23 },
      { title: "Envie e acompanhe", hint: "Você recebe um recibo por e-mail.", start: 46.25 },
      { title: "Responda à equipe", hint: "Quando a situação for Aguardando você.", start: 61.0 },
    ],
    transcript: [
      [0.9, "Este vídeo mostra como abrir um chamado no Console e acompanhar a resposta da equipe da Anuntech."],
      [8.9, "Na Visão geral, clique em Abrir chamado. O mesmo botão fica na página Chamados."],
      [16.7, "Escolha o que você precisa. Se algo parou ou deu erro, diga também o impacto: se parou tudo ou se dá para contornar."],
      [26.0, "Indique o produto ou projeto, escreva um assunto curto e conte o que aconteceu, com o máximo de detalhes."],
      [39.9, "Se ajudar, anexe um print da tela. Não envie senhas nem dados dos seus clientes."],
      [46.7, "Clique em Abrir chamado. Você recebe a confirmação por e-mail, e a equipe responde por aqui."],
      [55.5, "Na página Chamados ficam os seus pedidos, com a situação de cada um."],
      [61.5, "Quando a equipe precisa de algo, o chamado fica como Aguardando você, e o pedido aparece em destaque."],
      [69.2, "Escreva a sua resposta e clique em Enviar resposta. O chamado volta para a equipe, e você é avisado a cada novidade."],
      [82.0, "Ficou alguma dúvida sobre o Console? Abra um chamado. A equipe da Anuntech responde por lá."],
    ],
  },
  {
    id: "fatura",
    title: "Pagar uma fatura",
    description: "Pix ou boleto, pela página de pagamento.",
    src: "/ajuda/videos/fatura-2a60d7396e.mp4",
    duration: 82.28,
    chapters: [
      { title: "Encontre a fatura", hint: "Na Visão geral, em A pagar.", start: 8.92 },
      { title: "Pague com Pix ou boleto", hint: "QR Code, código Pix ou linha digitável.", start: 20.38 },
      { title: "Veja a confirmação", hint: "O Banco Inter confirma o pagamento.", start: 41.75 },
      { title: "Acompanhe no Financeiro", hint: "Faturas, próximas cobranças e link de pagamento.", start: 50.93 },
    ],
    transcript: [
      [0.9, "Este vídeo mostra onde encontrar as suas faturas da Anuntech e como pagar com Pix ou boleto."],
      [9.4, "Quando uma fatura é emitida, você recebe um aviso com o link de pagamento. No Console, ela aparece na Visão geral, em A pagar. Clique em Pagar."],
      [20.8, "A página de pagamento mostra o valor e o vencimento. Para pagar com Pix, leia o QR Code no app do seu banco, ou copie o código Pix e cole no app."],
      [32.7, "Se preferir boleto, copie a linha digitável ou baixe o PDF. O boleto compensa em até três dias úteis."],
      [42.2, "Quando o Banco Inter confirma o pagamento, a página mostra Pagamento confirmado, e a fatura fica como Paga no Console."],
      [51.4, "Em Financeiro ficam todas as faturas, com a situação de cada uma. Em Próximas cobranças, você vê o valor e o vencimento da próxima, antes de ela ser emitida."],
      [62.7, "Pelo menu de cada fatura, você copia o link de pagamento para enviar a quem paga as contas da empresa."],
      [74.0, "Dúvidas sobre uma cobrança? Abra um chamado pelo Console. A equipe da Anuntech responde por lá."],
    ],
  },
  {
    id: "orcamento",
    title: "Responder a um orçamento",
    description: "Leia a proposta, aceite ou recuse.",
    src: "/ajuda/videos/orcamento-5e9432ffce.mp4",
    duration: 86.92,
    chapters: [
      { title: "Abra a proposta", hint: "Em Precisa de atenção ou em Orçamentos.", start: 7.68 },
      { title: "Leia o escopo e o valor", hint: "Resumo, valor, entrada, saldo e fases.", start: 18.53 },
      { title: "Aceite ou recuse", hint: "Marque que leu e clique em Aceitar orçamento.", start: 46.41 },
    ],
    transcript: [
      [0.9, "Este vídeo mostra como ler e responder a um orçamento da Anuntech pelo Console."],
      [8.1, "Quando a Anuntech envia um orçamento, você recebe um e-mail. No Console, ele aparece em Precisa de atenção e na página Orçamentos."],
      [19.0, "A proposta começa pelo resumo do projeto, com o esforço estimado em horas, a taxa por hora e o número de fases e tarefas."],
      [28.3, "Em Proposta financeira ficam o valor total, a entrada e o saldo."],
      [34.4, "Depois vêm as fases, com as tarefas e as horas de cada uma."],
      [41.6, "Para guardar ou mostrar a alguém, clique em Baixar PDF."],
      [46.9, "Se a proposta não servir, clique em Recusar e, se quiser, conte o motivo. A Anuntech recebe a resposta e pode ajustar a proposta."],
      [56.9, "Para aceitar, marque que leu a proposta e clique em Aceitar orçamento. Ficam registrados o seu nome, e-mail, data, IP e o código que identifica a proposta."],
      [68.9, "A Anuntech é avisada na hora. Em Próximos passos, você vê o que vem depois: contrato, entrada, acessos e início."],
      [80.0, "Precisa de algo novo? Na página Orçamentos, clique em Pedir orçamento."],
    ],
  },
  {
    id: "projeto",
    title: "Acompanhar o projeto",
    description: "O quadro de tarefas, os pedidos e as entregas.",
    src: "/ajuda/videos/projeto-96c785f63c.mp4",
    duration: 96.78,
    chapters: [
      { title: "Abra o quadro", hint: "Backlog, A fazer, Em andamento, Revisão e Concluído.", start: 9.06 },
      { title: "Peça uma tarefa", hint: "O pedido entra no Backlog.", start: 44.57 },
      { title: "Revise as entregas", hint: "Aprove ou aponte um problema.", start: 67.28 },
    ],
    transcript: [
      [0.9, "Este vídeo mostra como acompanhar o seu projeto no Console, pedir uma tarefa e aprovar as entregas."],
      [9.5, "Quando há uma entrega para revisar, ela aparece na Visão geral, em Precisa de atenção. Clique para abrir o quadro do projeto."],
      [22.9, "O quadro mostra cada tarefa numa coluna: Backlog, A fazer, Em andamento, Revisão e Concluído."],
      [34.3, "Clique numa tarefa para ver os detalhes. Em Comentários ficam as mensagens da equipe sobre ela."],
      [45.0, "Precisa de algo novo? Clique em Nova tarefa, dê um título e descreva o que precisa."],
      [59.1, "Clique em Criar tarefa. Ela entra no Backlog como pedido do cliente, e a equipe confirma se faz parte do combinado."],
      [67.7, "Quando uma entrega fica pronta, a equipe a coloca em Revisão. Um Administrador da empresa testa e clica em Revisar."],
      [76.3, "Se algo não funcionar, clique em Encontrei um problema e conte o que testou. A entrega volta para a equipe. Se estiver tudo certo, clique em Aprovar, e a tarefa vai para Concluído."],
      [90.0, "Dúvidas sobre o projeto? Comente na tarefa ou abra um chamado pelo Console."],
    ],
  },
  {
    id: "acessos",
    title: "Acessos e avisos",
    description: "Quem entra no Console e quem recebe os avisos.",
    src: "/ajuda/videos/acessos-ded34e8a75.mp4",
    duration: 84.19,
    chapters: [
      { title: "Abra Membros", hint: "No menu da sua conta, na sua foto no fim da barra.", start: 9.59 },
      { title: "Convide uma pessoa", hint: "E-mail, permissão e convite.", start: 20.97 },
      { title: "Escolha quem recebe os avisos", hint: "Contatos por assunto e canal.", start: 49.02 },
    ],
    transcript: [
      [0.9, "Este vídeo mostra como dar acesso ao Console para outras pessoas da sua empresa e escolher quem recebe os avisos."],
      [10.0, "Clique nas suas iniciais, no fim da barra, e abra Membros. Aqui está quem entra no Console em nome da sua empresa."],
      [21.4, "Digite o e-mail da pessoa e escolha a permissão. Membro abre chamados e acompanha projetos e bookmarks. Administrador pode tudo, inclusive o financeiro."],
      [33.1, "Clique em Convidar pessoa. Ela recebe um e-mail para entrar e aparece como Aguardando primeiro acesso."],
      [40.9, "Pelo menu de cada pessoa, você reenvia ou cancela um convite, muda a permissão ou remove o acesso."],
      [49.5, "Em Notificações, você escolhe quem recebe os avisos de cobranças e de chamados. Esses contatos recebem os avisos, mas não ganham acesso ao Console."],
      [60.7, "Adicione os e-mails e telefones, marque por onde quer receber e clique em Salvar."],
      [76.8, "Dúvidas? Abra um chamado pelo Console. A equipe da Anuntech responde por lá."],
    ],
  },
  {
    id: "assistente",
    title: "Usar o assistente",
    description: "Pergunte e peça em português, sem procurar telas.",
    src: "/ajuda/videos/assistente-45c4ae91f9.mp4",
    duration: 77.84,
    chapters: [
      { title: "Abra o assistente", hint: "O primeiro botão da barra, em todas as telas.", start: 9.2 },
      { title: "Pergunte", hint: "Faturas, chamados, projetos, contratos e orçamentos.", start: 18.23 },
      { title: "Peça uma ação", hint: "Conte o que aconteceu e, se souber, o impacto.", start: 28.46 },
      { title: "Confirme no cartão", hint: "Nada acontece até você clicar em Confirmar.", start: 38.15 },
      { title: "Fale, se preferir", hint: "O texto aparece no campo para você revisar.", start: 60.46 },
    ],
    transcript: [
      [0.9, "Este vídeo mostra como usar o assistente do Console para tirar dúvidas e pedir coisas sem procurar pelas telas."],
      [9.7, "O assistente fica no primeiro botão da barra, em todas as telas. Clique para abrir e escreva como falaria com alguém da equipe."],
      [18.7, "Pergunte, por exemplo, qual é o seu último boleto. O assistente consulta as faturas e responde com o valor, o vencimento e o link para pagar."],
      [28.9, "Ele também faz coisas por você, como abrir um chamado. Conte o que aconteceu e, se souber, o impacto."],
      [38.6, "Antes de criar ou mudar qualquer coisa, o assistente mostra um cartão com o que vai fazer e os dados. Confira cada um. Se não quiser, clique em Descartar."],
      [49.8, "Nada acontece até você clicar em Confirmar. Depois do clique, o chamado é aberto e a tela se atualiza. A equipe responde por ele como em qualquer chamado."],
      [60.9, "Se preferir, clique no microfone e fale. O texto aparece no campo para você revisar antes de enviar."],
      [69.2, "O assistente usa o seu acesso e nunca vê o que você não veria. Dúvidas? Abra um chamado pelo Console."],
    ],
  },
  {
    id: "assinatura",
    title: "Assinar um contrato",
    description: "Do e-mail ao PDF assinado.",
    src: "/ajuda/videos/assinatura-5676666b2f.mp4",
    duration: 168.0,
    chapters: [
      { title: "Abra o e-mail", hint: "O link do contrato chega no seu e-mail.", start: 9.5 },
      { title: "Entre com o código", hint: "Digite seu e-mail e o código de 6 números.", start: 20.3 },
      { title: "Leia o contrato", hint: "O texto completo, cláusula por cláusula.", start: 49.5 },
      { title: "Peça alterações, se precisar", hint: "Comente a cláusula e envie à Anuntech.", start: 62.9 },
      { title: "Assine", hint: "Marque que concorda e clique em Assinar contrato.", start: 120.1 },
    ],
    transcript: [
      [0.9, "Este vídeo mostra como ler, pedir alterações e assinar um contrato da Anuntech pelo Console. Leva poucos minutos."],
      [10.0, "Quando o contrato fica pronto, você recebe um e-mail da Anuntech com o título do contrato e um link. Clique no link para abrir o Console."],
      [20.7, "Na tela de entrada, digite o e-mail que a Anuntech cadastrou para a sua empresa e clique em Receber código. O código chega no seu e-mail. Se preferir, use a aba WhatsApp. Digite os seis números e você entra."],
      [41.9, "Você chega ao Painel. Em Precisa de atenção, clique em Contratos para você assinar e abra o contrato."],
      [49.9, "O contrato aparece completo, cláusula por cláusula. Leia com calma. Ao lado ficam as assinaturas, a vigência e os dados do documento."],
      [63.2, "Quer mudar alguma coisa? Passe o mouse na cláusula e clique no ícone de comentário. Explique o que precisa mudar. Se quiser, reescreva o texto como ele deveria ficar. Depois, clique em Adicionar pedido."],
      [83.2, "Você pode fazer quantos pedidos precisar. Quando terminar, clique em Enviar à Anuntech e confirme. O contrato fica em revisão, e a equipe responde cada pedido."],
      [97.3, "A Anuntech manda uma nova versão, e você recebe outro e-mail. No Console, a barra na margem marca o que mudou. No fim da página, você lê a resposta a cada pedido."],
      [120.6, "Se estiver tudo certo, marque que leu e concorda e clique em Assinar contrato. Ficam registrados seu nome, e-mail, data, IP e o código que identifica o texto assinado."],
      [137.3, "Quando a Anuntech também assina, o contrato fica como Assinado e você recebe um e-mail de confirmação. O PDF final, com as duas assinaturas, fica no Console, em Baixar PDF assinado."],
      [159.4, "Se ficar alguma dúvida, abra um chamado pelo Console. A equipe da Anuntech responde por lá."],
    ],
  },
];

export function tutorialOf(id: TutorialId | undefined) {
  return id ? (TUTORIALS.find((t) => t.id === id) ?? null) : null;
}
