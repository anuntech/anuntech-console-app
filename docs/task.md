# Tarefas

O que está em aberto no Console. Ao terminar um item, mova para "Feito" com a data; ao descobrir um, anote aqui com o contexto necessário para outra pessoa pegar.

## Depende do Kauan

- [ ] Apagar o repositório vazio `anuntech/anuntech-console-vazio`, que sobrou da transferência.
- [ ] Trocar a chave do OpenRouter (foi colada numa conversa) e decidir entre créditos e modelo pago para o assistente.
- [ ] Apagar pela interface os registros de teste criados em produção durante o QA.
- [ ] Passar os parâmetros fiscais da contabilidade para ligar a emissão de NFS-e pela Focus.
- [ ] Especificar Relatórios.

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
