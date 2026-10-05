# Memória do projeto

O contexto que não aparece no código: quem decide, onde as coisas estão, o que foi decidido e por quê, e o que já deu errado. Atualize quando uma decisão mudar; registre a data.

## Contexto

- **Dono e decisor:** Kauan Ketner (kauan@anuntech.com), dono da Anuntech e do Console. Pede design primeiro, respostas em português e relatórios curtos.
- **Produção:** console.anuntech.com, Vercel (time `anuntech`), banco Neon.
- **Código:** github.com/anuntech/anuntech-console (transferido de `kauanketner/anuntech-console` em 26/09/2026). Branch de trabalho `codex/bookmarks-ticket-modal`; `main` publica.
- **Identidade visual e voz:** repositório `anuntech/design-system`.
- **Histórico de decisões anterior a este documento:** wiki local em `anuntech-wiki/Console/` (00 a 05). É um registro por rodada; várias entradas foram superadas (ver abaixo).
- **Integrações ativas:** Inter (boleto e Pix, produção), Resend, Synova/FLW para WhatsApp (canal (11) 5107-3435), OpenRouter, Vercel Blob. Focus NFe só autenticado.

## Linha do tempo

| Data | O que mudou |
| --- | --- |
| 18/09/2026 | Primeira versão: Inter manual, código por e-mail e WhatsApp, calendário e valores em pt-BR |
| 19/09 | Contratos com PDF, recorrência, página pública de pagamento, avisos de cobrança, tabela de faturas. 27 recorrências importadas da planilha e 4 parcelas únicas ativadas com autorização do Kauan |
| 20/09 | Dock, Minha conta, duas etapas, avatares, membros por empresa, notificações por assunto, bookmarks |
| 21/09 | Papéis das empresas reduzidos a dois (Administrador e Membro); cadastro de empresa por link removido; acesso assistido |
| 23/09 | Redesenho completo sobre Tailwind v4 e shadcn: Empresas, Chamados, Financeiro, pagamento público, entrada, Configurações em páginas, Projetos com Kanban |
| 24/09 | Bookmarks por pastas, catálogo, desconto e juros, contratos com assinatura eletrônica, versões e aditivos, Orçamentos, assistente |
| 25–27/09 | Visão geral do cliente em widgets, painel lateral do assistente, comentários nas tarefas (com anexos e edição), revisão de todos os textos na voz da Anuntech, páginas de erro |
| 28/09 | Suítes de integração atualizadas (CI verde de novo), limpeza de arquivos sem uso, `src/lib` por domínio, estes documentos |

## Decisões

- **Cobrança manual, recorrência autorizada.** A regra geral é não automatizar cobrança. As recorrências existentes foram ativadas a pedido do Kauan em 19/09/2026; novas automações precisam de pedido explícito.
- **Dois papéis por empresa** (21/09): "Atendimento" e "Financeiro" viraram "Membro"; só o Administrador vê dinheiro, contratos e orçamentos. A migração 0016 converteu os dados.
- **Um ambiente por conta.** A mesma pessoa não pode ser da equipe e de um cliente, nem de dois clientes, contando os e-mails verificados.
- **Contratos são assinados no Console** (24/09), com hash do texto de cada versão. Substituiu "publicar para o cliente".
- **Exclusão de faturas** (28/09): além dos rascunhos que nunca foram ao Inter, a equipe exclui cobranças que o próprio Inter encerrou (`CANCELADO`, `EXPIRADO`, `FALHA_EMISSAO`, já aplicados pela conciliação). Paga ou com nota fiscal, nunca.
- **Desconto no orçamento** (29/09, pedido do Kauan): desconto negociado em reais, tirado do valor das horas antes de dividir entrada e saldo. Fica no conteúdo JSON do orçamento (`discountCents`), sem migração; orçamentos anteriores leem como sem desconto.
- **Revisão de contratos** (01/10, decidido pelo Kauan): o cliente pede alterações na própria cláusula, no Console (não por arquivo anexado), e o texto proposto que a equipe aceita entra sozinho no rascunho. Situação nova `in_review` no contrato; pedidos em `console_contract_change_requests`, presos à versão e à posição do bloco no texto.
- **Telas compactas** (01/10, pedido do Kauan, que diz que 90% dos clientes usam tela pequena): listas e quadro sem descrição no cabeçalho, ações na linha dos filtros e conteúdo até logo acima do dock, sem rolar a página.
- **Grade por padrão** (01/10, pedido do Kauan): Bookmarks, Projetos, Contratos, Produtos e Empresas abrem em grade; quem escolheu lista continua em lista (cookie por área).
- **Como trabalhamos** (02 a 04/10, plano em https://claude.ai/artifact/LpehuEMdsHvaSCS6GGYbFU): o Console guia o cliente no ponto de uso e só mostra prazos que vêm das condições de atendimento de cada empresa, copiadas do contrato com a cláusula de cada valor. Kauan pediu a entrega completa sem marcar as 24 decisões; valeram as recomendações, com três exceções: os textos dos modelos de contrato não foram alterados (advogado), nenhum e-mail automático novo (o aviso de 80% do banco e o relatório do mês saem por clique da equipe; ligar sozinho precisa de autorização explícita) e nada de preço da conversa de descoberta no texto. Feriados da sede são configuração, não código. A ficha de cada modelo fica em código (`presets.ts`) em vez de variáveis no texto do contrato.
- **Nota fiscal fica para depois.** A preferência por empresa existe; a emissão depende dos parâmetros fiscais da contabilidade.
- **Datas:** o calendário próprio (`DateField`, react-day-picker) voltou no redesenho de 23/09 e substituiu o `<input type="date">` nativo de 20/09. Seleções simples continuam com `<select>` nativo (`NativeSelect`).
- **Visual:** shadcn e shadcn.io como base, com a marca Anuntech. O CSS antigo continua numa camada própria até cada tela ser refeita.
- **Escrita:** todos os textos seguem o manual de voz (revisão completa em 27/09).
- **Assistente:** age com o acesso da pessoa e sempre pergunta antes de alterar. Um "sim" simples depois da pergunta aprova sem segunda opinião (decidido depois de o Jev recusar confirmações claras).
- **Chave de idempotência do e-mail de cobrança** fixa por rodada de envio (28/09). Por tentativa, uma repetição depois de timeout poderia mandar o mesmo e-mail duas vezes; por aviso, um reenvio manual cairia no resultado antigo.

## Lições

- O Next 16 só resolve uma server action a partir de uma página que a renderiza. Testes e chamadas manuais precisam postar na página certa.
- Uma página que chama `notFound()` pode responder HTTP 200 porque o layout já foi enviado; o sinal confiável é `NEXT_HTTP_ERROR_FALLBACK;404` no HTML.
- A suíte de integração ficou uma semana vermelha (21 a 28/09) porque procurava textos de botão. Hoje posta pelo nome da action; mantenha assim.
- Migração em produção: rota temporária com token, dois deploys (ver [rules.md](rules.md#migrações-em-produção)). Selecionar colunas novas antes da migração derruba as telas.
- Publicar com a árvore suja já levou arquivos não commitados à produção uma vez. Commit primeiro, deploy depois.
- Os vãos grandes no painel vinham do CSS antigo: `p { margin-bottom: 16px }` e `h2 { margin-bottom: 12px }` em `@layer legacy` atingem qualquer `<p>` sem classe de margem. Removidos em 01/10; a única tela antiga com `<p>` (acesso pendente) já define as próprias margens.
- Regra em `@layer components` perde para qualquer utility do Tailwind, seja qual for a especificidade (o `overflow-x-auto` da tabela anulava o cabeçalho fixo). Para vencer uma utility, use outra utility mais específica.
- Teste `engagement-company-deletion` falha quando uma tabela nova aponta para empresa, vínculo ou chamado: é o lembrete de ensinar as exclusões. Foi o que pegou `service_terms`, `time_entries` e `hours_months`.
- Migração que acrescenta colunas em tabela existente: o primeiro deploy leva só a rota e o código que não lê as colunas; o schema novo entra depois que a rota rodou, senão `select()` de `tickets` derruba as telas.
- No zsh, `$VAR:r` é um modificador e não "a variável seguida de :r"; use `${VAR}`. E `for f in $LISTA` não separa por espaço.
