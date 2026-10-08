# Tarefas

O que está em aberto no Console. Ao terminar um item, mova para "Feito" com a data; ao descobrir um, anote aqui com o contexto necessário para outra pessoa pegar.

## Depende do Kauan

- [ ] Apagar o repositório vazio `anuntech/anuntech-console-vazio`, que sobrou da transferência.
- [ ] Trocar a chave do OpenRouter (foi colada numa conversa) e decidir entre créditos e modelo pago para o assistente.
- [ ] Apagar pela interface os registros de teste criados em produção durante o QA. Desde 08/10, Configurações → Limpeza lista os candidatos, filhos antes da empresa.
- [ ] Passar os parâmetros fiscais da contabilidade para ligar a emissão de NFS-e pela Focus.
- [ ] Especificar Relatórios.

- [ ] Como trabalhamos: marcar no documento do plano as decisões D1 a D24 (as recomendações foram aplicadas por padrão). O e-mail automático de 80% do banco (D19) foi autorizado no pedido de 08/10 e entra com o interruptor em Configurações → Automações. Falta definir a cidade da sede e os feriados em Configurações → Dados da empresa (D6), e levar ao advogado as mudanças de texto dos modelos (D1, D2, D8, D10, D16).
- [ ] Ditado por microfone: testar no próprio iPhone e num Android logo depois da publicação (assistente e Abrir chamado), conferir o custo no OpenRouter depois das primeiras gravações e rever o preço do MAI-Transcribe-2 quando a promoção acabar (31/12/2026). Decidir se o microfone também entra na resposta do chamado.
- [ ] Recorrências pausadas por endereço: completar o endereço de cobrança da KAPÔ e da CATEL e retomar (CATEL até 07/10, KAPÔ Squad até 08/10). A KAPÔ S3 (vencia 02/10) precisa de fatura avulsa para outubro e próximo vencimento em 02/11.
- [ ] Webhook do Inter para confirmar pagamento na hora: com a emissão no pagamento, a próxima fatura sairia em segundos em vez de até 10 minutos.
- [ ] Automação (08/10): o que depende de terceiros fica preparado. Reajuste anual por IPCA precisa da cláusula do advogado; a cópia de segurança semanal precisa do destino e da credencial; a triagem de pedidos por WhatsApp precisa do webhook da FLW (Synova); o webhook do Inter precisa do cadastro na conta Inter.
- [ ] Cadastrar as condições de atendimento de cada empresa (página da empresa), começando pelas 12 do Synova, conferindo com o contrato assinado. Sem isso, nenhum prazo aparece para o cliente. Desde 08/10, Configurações → Modelos de contrato prepara os rascunhos do Synova de uma vez; falta conferir cada um.

## Engenharia

- [ ] Dividir `src/lib/actions.ts` (empresas, vínculos, chamados, faturas) entre as pastas de domínio.
- [ ] Levar o CSS antigo para Tailwind: `@layer legacy` em `src/app/globals.css` (cerca de 1.400 linhas), `components/shell/dock.module.css`, `components/shell/public-layout.module.css` e a tela `/acesso-pendente`. No fim, remover a camada `legacy`.
- [ ] Webhook do Inter para confirmar pagamento na hora, mantendo a conciliação a cada 5 minutos como garantia.
- [ ] Testes de navegador (Playwright como dependência de desenvolvimento) para dock, painéis laterais, assistente e tema escuro. Os antigos foram removidos em 28/09 porque dependiam de uma instalação que o projeto nunca teve.
- [ ] Cobrir na integração as exclusões definitivas (empresa, projeto, serviço, contrato, orçamento, fatura) e as chaves estrangeiras que elas precisam limpar.
- [ ] Título da aba: numa URL inexistente dentro do app, o título da página vence o do `not-found` enquanto a resposta é transmitida.
- [ ] Atualizar no `anuntech/design-system` as referências a caminhos do Console (`components/legacy-ui` virou `components/shell`; `lib/*` agora tem pastas por domínio).
- [ ] Marcar o wiki antigo (`anuntech-wiki/Console`) como histórico e apontar para `docs/`.

## Feito

- [x] 08/10/2026: automação, lote 6 (cobrança): fila de atrasos com texto pronto e registro de contato, pago fora do boleto, localizar no Inter a emissão sem resposta, retomada guiada da recorrência, fechamento do mês, fila de notas fiscais e reajuste pelo IPCA preparado.
- [x] 08/10/2026: automação, lote 5 (clientes e operação): convites conferidos e reenviados, aviso quando o cliente muda o cadastro, implantação, contatos e acessos para revisar, revisão de acessos a cada 6 meses, Limpeza e encerramento guiado ao arquivar.
- [x] 08/10/2026: automação, lotes 3 e 4 (suporte, banco de horas e avisos ao cliente): responsável na abertura, lembrete de primeira resposta, triagem do Jev, acompanhamento de chamados parados, aviso e relatório do banco uma vez por mês, excedente pronto para cobrar, horas pelo assistente, sugestões de resposta e de fases, e os avisos automáticos ao cliente com interruptor em Configurações → Automações.
- [x] 08/10/2026: automação, lote 2 (contrato, orçamento e comercial): contrato, projeto e cobranças de entrada e saldo preparados a partir do orçamento aceito, orçamento ligado ao chamado com resposta pronta, recorrência, condições e prorrogação preparadas no contrato assinado, aviso quando o cliente assina, seguimento comercial no resumo e no painel, convite do Administrador no envio.
- [x] 08/10/2026: automação, lote 1 (proteger o dinheiro): cadastro conferido antes da emissão, dívida expirada no Inter com Cobrar de novo e Encerrar, aviso 7 dias antes de o Inter encerrar, cobrança de quem saiu, saúde das rotinas, certificado do Inter e alertas da equipe que não chegam.
- [x] 08/10/2026: campos do contrato no topo do rascunho, com sugestões do cadastro, do produto e do orçamento, aplicar e salvar.
- [x] 07/10/2026: próxima fatura das recorrências mensais emitida assim que a atual é paga (aviso continua 5 dias antes), Próximas cobranças no Financeiro, na Visão geral e na fatura, recorrências pausadas em destaque e Cancelar no Inter.
- [x] 06/10/2026: ditado por microfone no assistente e em Abrir chamado (`/api/transcricao`, OpenRouter com retenção zero, 2 minutos por gravação, 30 por hora por pessoa).
- [x] 04/10/2026: Como trabalhamos, todas as fases: formulário de chamado guiado (tipo, impacto, produto, o que esperar), prioridade só da equipe com Crítica, Aguardando você com o que falta, condições de atendimento por empresa com fichas dos modelos e feriados da sede, relógio do chamado (resposta, meta, pausa), fila e resumo da equipe por prazo, página Como trabalhamos, Primeiros passos, Pedir orçamento, próximos passos, Sobre este projeto, regras do quadro e revisão de entregas, estimativa de melhoria, banco de horas com aprovação e relatório, duração das fases do orçamento e o assistente com o guia e as condições.
- [x] 01/10/2026: widgets da Visão geral (equipe e cliente) sem descrição e mais compactos; fim da margem antiga em `p`, `h1` e `h2` que abria vãos em todo o Console.
- [x] 01/10/2026: Projetos, Contratos, Produtos e Empresas em lista ou grade, como Bookmarks; grade é o padrão nas cinco.
- [x] 01/10/2026: telas de lista e quadro mais compactas para telas pequenas: cabeçalho sem descrição, ações na linha dos filtros, conteúdo até logo acima do dock com cabeçalho de colunas fixo.
- [x] 01/10/2026: rodadas de revisão de contratos: pedidos por cláusula, decisão da equipe, nova versão com o que mudou marcado.
- [x] 29/09/2026: Bookmarks em lista ou grade, com a escolha salva; paginação nos dois modos.
- [x] 29/09/2026: desconto negociado no orçamento (editor, proposta, PDF e assistente).
- [x] 28/09/2026: fatura que o Inter cancelou pode ser excluída (aprovado pelo Kauan).
- [x] 28/09/2026: azul-marinho `#0d1d41` e amarelo `#e1e666` iguais às tintas do logotipo ([anuntech/anuntech-console#1](https://github.com/anuntech/anuntech-console/pull/1)).
- [x] 28/09/2026: suítes de integração atualizadas para o Console atual; CI verde localmente (388 verificações).
- [x] 28/09/2026: chave de idempotência do e-mail de cobrança fixa por rodada, evitando e-mail duplicado depois de timeout.
- [x] 28/09/2026: removidos arquivos, dependências e testes sem uso; `src/lib` organizado por domínio; `components/shell` para a moldura do app.
- [x] 28/09/2026: documentação do projeto em `docs/` (este arquivo, [prd.md](prd.md), [memory.md](memory.md), [rules.md](rules.md), [design.md](design.md), [architecture.md](architecture.md)).
- [x] 27/09/2026: páginas de erro (404, erro inesperado, link de pagamento inválido).
- [x] 27/09/2026: revisão de todos os textos na voz da Anuntech.
- [x] 26–27/09/2026: comentários nas tarefas com anexos, edição e ferramentas no assistente.
