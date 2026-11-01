# Plano: e-mail contratado pelo próprio cliente

Plano de 01/11/2026. O objetivo é o cliente fazer tudo pelo Console, como na Hostinger: contratar o e-mail, criar e aumentar caixas, adicionar o domínio e pagar. Hoje a equipe cria cada caixa e cobra o e-mail como um item do catálogo.

O que já existe: o servidor Stalwart v1 do repositório `anuntech-mail-server` (Hetzner, envio pelo Amazon SES, backups no R2), com anuntech.com migrado do cPanel em 31/10; e a área `/email` do Console, só da equipe, que gerencia caixas, senhas, espaço, apelidos, redirecionamentos e a saúde do DNS pela API JMAP de gestão ([prd.md](prd.md#e-mail-só-a-equipe)). O Console não lê nem envia e-mail (decisão de 31/10): cada pessoa usa o próprio aplicativo.

## Decisões do Kauan (01/11/2026)

1. **Quem contrata:** só empresas já cadastradas no Console, pelo Administrador. Cliente novo continua entrando pela equipe; a venda para quem ainda não é cliente fica para depois.
2. **Quando ativa:** na hora, para a empresa em dia (sem fatura vencida e sem suspensão aberta). A primeira contratação de e-mail da empresa espera o Inter confirmar o pagamento.
3. **Preço:** por caixa com 10 GB, espaço extra em blocos de 10 GB e um mínimo por empresa. Ponto de partida, do `custos.md` do servidor: R$ 19,90 por caixa por mês (R$ 17,90 no anual), R$ 5 a cada 10 GB extras, mínimo de R$ 49. A equipe edita os valores em Configurações e pode dar preço próprio a uma empresa.
4. **Pagamento:** boleto e Pix do Inter, com recorrência mensal ou anual, como o resto do Console. Cartão continua fora.

Isso abre uma exceção à regra 1 de [rules.md](rules.md) ("cobranças são criadas manualmente"): um pedido de e-mail feito pelo Administrador emite cobrança e muda a recorrência sozinho. A regra continua valendo para todo o resto. Quando a Fase 3 for publicada, a exceção entra no `AGENTS.md`, em [rules.md](rules.md) e no [prd.md](prd.md).

## Fases

**Fase 0, no servidor (pré-requisito para vender):** nome do servidor de produção; SES configurado; backup no R2 com uma restauração testada; monitoramento; limites de envio por caixa e por domínio; conferir que uma caixa só envia com os próprios endereços (um cliente não manda como outro). Na conta de serviço do Console, as permissões de criar domínio (com DKIM) e de mudar `emailSend` nas contas. A regra do servidor que exige o Kauan para apagar caixa ou domínio ganha a exceção da exclusão pedida pelo cliente.

**Fase 1, a equipe gerencia o e-mail dos clientes (feita em 01/11, ramo `codex/email-empresas`):** a tabela `console_mail_domains` liga um domínio do servidor a uma empresa; `/email/dominios` vincula e desvincula; caixas, redirecionamentos e DNS mostram um domínio por vez (`?dominio=`), com o seletor e a empresa no cabeçalho; as mudanças de um domínio de cliente entram na atividade da empresa. O domínio continua sendo criado no servidor por quem o administra. Com isso, a equipe deixa de mexer no servidor para criar caixa ou trocar senha de cliente.

**Fase 1b:** a suspensão de um produto do tipo "Servidor de e-mail" tira `emailSend` das caixas dos domínios da empresa e devolve na reativação, marcando os passos sozinha (o recebimento continua). Criar o domínio no servidor pelo Console, quando a conta de serviço tiver a permissão.

**Fase 2, o Administrador do cliente gerencia o que já tem (feita em 01/11, ramo `codex/email-cliente`; decisões por padrão em [memory.md](memory.md)):** vê as caixas e o uso, cria e exclui caixa dentro do que contratou, troca senha, cria apelidos e redirecionamentos e configura os aparelhos. Um membro ligado a uma caixa troca a própria senha e vê o espaço, sem valores. Na web e no app. Ainda sem compra. Na mesma entrega, o e-mail passa a ser aberto pelo produto em Produtos, e o item E-mail sai do menu da equipe (ver [Onde fica o e-mail](#onde-fica-o-e-mail)).

**Entrega do cliente (feita em 01/11, ramo `codex/email-autoatendimento`, decisões do Kauan em [memory.md](memory.md)):** antes da compra, o caminho que o Kauan pediu: o Administrador contrata o e-mail em Produtos (o produto nasce ativo e a equipe cobra como hoje, sem fatura automática), adiciona o domínio, prova a posse com o TXT `_anuntech` e publica o resto do DNS no próprio provedor; o Console cria o domínio no servidor (a conta de serviço ganhou `sysDomainCreate`) ou vincula o que a equipe já preparou. A prova já libera as caixas. Ficam para a Fase 3 o preço por caixa, a fatura e a recorrência; para a Fase 4, a conferência sozinha a cada 15 minutos, o guia por provedor mais detalhado e a cópia de outro servidor pelo próprio cliente.

**Fase 3, o cliente compra:** preços em Configurações, pedido com o proporcional, recorrência recalculada, fatura emitida sozinha, ativação na hora (empresa em dia) ou depois do pagamento, Pix conferido mais rápido, limites antiabuso e o aceite das condições. Entra a exceção à regra 1.

**Fase 4, domínio e migração pelo cliente:** adicionar domínio com prova de posse e guia por provedor; trazer caixas de outro servidor com o andamento; levar os clientes do cPanel (cerca de 122 caixas em 14 domínios) um a um.

**Depois:** conectar o DNS da Cloudflare do cliente com um clique, o assistente propondo criar caixas (com o cartão de confirmação de sempre), Pix Automático ou cartão, e a venda para quem ainda não é cliente.

## Onde fica o e-mail

Decisão do Kauan (01/11/2026): o e-mail fica dentro de Produtos, não num item próprio do menu.

- **Cliente:** o card do produto de e-mail em Produtos (o item do catálogo com o tipo "Servidor de e-mail") abre a gestão das caixas da empresa, como os apps que abrem dentro do Console. Sem item no menu. Com mais de um domínio, o seletor mostra só os da empresa. Vale igual no app.
- **Equipe:** o trabalho de cada cliente segue o mesmo caminho (Produtos ou a página da empresa), com o que a equipe pode a mais. O anuntech.com, que não é produto de nenhuma empresa, e a página Domínios (vincular e desvincular) vão para Configurações › E-mail. O item E-mail sai do menu da equipe na mesma entrega, para o caminho mudar uma vez só.

## O que o cliente vai fazer (Fases 2 a 4)

| Ação | Como funciona |
| --- | --- |
| Contratar o e-mail | Escolhe o domínio, quantas caixas, mensal ou anual; vê o total por mês, aceita as condições do serviço e recebe a fatura (Pix e boleto). Ativa quando o Inter confirma. |
| Adicionar domínio | Digita o domínio. O Console mostra os registros a criar (verificação, MX, SPF, DKIM, DMARC, configuração automática) com botão de copiar e um guia para Cloudflare, Registro.br, GoDaddy e Hostinger, e confere sozinho. |
| Criar caixa | Endereço, nome e senha. Antes de confirmar, mostra o novo valor da recorrência e o proporcional até o próximo vencimento. |
| Aumentar o espaço | Mais 10 GB por vez numa caixa, com o preço antes de confirmar. Diminuir só até o que a caixa já usa. |
| Gerenciar a caixa | Trocar senha, apelidos, redirecionamento e resposta automática, sem custo. |
| Excluir caixa | Confirma digitando o endereço. A caixa para de entrar e de receber na hora e some da próxima cobrança, sem devolução do período pago. Fica guardada 30 dias com "Restaurar"; depois é apagada. |
| Cancelar o e-mail | O mesmo, para todas as caixas e domínios da empresa. |

Decidido por padrão, para revisar: só o Administrador contrata e muda caixas, porque mexe em dinheiro.

## Como funciona por dentro

### Console e Stalwart

- O Console chama a API de gestão do Stalwart (`urn:stalwart:jmap`, métodos `x:`) com a conta de serviço, cujo papel não tem `impersonate`: ela gerencia contas e listas, mas não abre caixa nenhuma. Toda ação lê de volta do servidor a conta ou a lista antes de mexer e só mexe num domínio gerenciado.
- Domínios gerenciados: os da Anuntech (`MAIL_DOMAINS`) e os vinculados a uma empresa (`console_mail_domains`). Os da Anuntech e da infraestrutura (anuntech.com, anuntech.cloud) nunca são de cliente.
- Sem tenant do Stalwart por empresa por enquanto: quem autoriza é o Console. O tenant (recurso do Enterprise) entra se a cota da empresa inteira ou o isolamento no próprio servidor fizerem falta.
- A senha da caixa vai direto ao Stalwart. O Console não guarda, não registra em log e não manda ao assistente.
- Os nomes e formatos dos métodos novos (criar domínio, permissões da conta, limites de envio) são conferidos na documentação da v1 e no servidor de teste antes de escrever o código, nunca de memória (regra 5 do servidor).

### Dados (Neon)

O Neon guarda só vínculos e estado; o servidor continua sendo a fonte das caixas. Já existe `console_mail_domains`. Para a Fase 3:

| Tabela | Para quê |
| --- | --- |
| `console_mail_pricing` | Os preços e limites que a equipe edita (uma linha, como `assistant_settings`). |
| `console_mail_orders` | Cada pedido: itens, preço congelado, proporcional, fatura, condições aceitas (versão, quando, IP), situação. |
| `console_mail_jobs` | A fila de mudanças no servidor depois do pagamento: operação, dados, tentativas, último erro, chave de idempotência. |

A recorrência do e-mail da empresa e o espaço contratado de cada caixa ficam no vínculo do produto e na própria conta do servidor.

### Pedido e cobrança (Fase 3)

1. O Administrador monta o pedido. A action confere acesso, empresa em dia e limites, e grava o pedido com o preço do momento.
2. **Primeira contratação:** o Console cria e publica a fatura no Inter (vencimento no dia seguinte, a regra do Inter; o Pix paga na hora). O pedido fica "Aguardando pagamento". Quando o Inter confirma, a fila cria domínio e caixas e o cliente recebe "E-mail ativado" com os dados para configurar. Sem pagamento em 3 dias, o pedido expira e a cobrança é cancelada no Inter.
3. **Empresa em dia:** a fila cria na hora. O proporcional até o próximo vencimento sai numa fatura do pedido; abaixo de R$ 2,50 (mínimo do Inter) não é cobrado. A recorrência passa a cobrar o novo total a partir do próximo período ainda não emitido, pela mesma regra de "Editar próximas cobranças".
4. **Limite sem pagar antes:** acima de um teto por mês (proposta: 10 caixas ou R$ 200 em pedidos não pagos), o pedido volta a ser pago antes. Fatura de pedido vencida segue a régua e a suspensão de sempre.
5. **Pix mais rápido:** as faturas de pedido entram primeiro na conciliação de 5 minutos, e o webhook do Inter (preparado no Piloto automático) apressa quando for cadastrado na conta. Continua valendo só a confirmação do Inter.

Valor da recorrência: o maior entre o mínimo e (caixas × preço da caixa + blocos extras × preço do bloco), com o desconto do anual quando for o caso.

### Domínio pelo cliente (Fase 4)

- **Prova de posse primeiro:** um TXT `_anuntech.<domínio>` com um token. Só depois o domínio vai ao servidor e aceita caixas. Sem isso, alguém criaria caixas num domínio que não é dele e mandaria e-mail em nome dele para os outros clientes do mesmo servidor.
- Depois, os registros que o servidor gera (MX, SPF, os dois DKIM, DMARC começando em `p=none`), com a saúde do DNS que já existe. Domínio pendente é conferido a cada 15 minutos por 7 dias; domínio ativo, todo dia, com aviso quando o MX ou o DKIM saem.
- Quem vem de outro provedor cria as caixas antes, copia os e-mails e só então troca o MX, para não perder nada no meio.

### Antiabuso

O envio de todos os clientes sai pelo mesmo servidor e pelo mesmo SES; um cliente mandando spam pode bloquear o envio de todos. Por isso: só empresas já cadastradas compram, e a primeira compra é paga antes; caixa nova começa com limite de envio, que sobe com o tempo; rejeições e reclamações do SES chegam ao Console e bloqueiam o envio da caixa acima do limite; as condições do serviço trazem a política de uso e são aceitas em cada pedido.

### Segurança, LGPD e app

- Toda action começa com `getActor()` e toda rota da API do app com `guard(...)`; caixa ou domínio de outra empresa responde como inexistente. Toda mudança fica na auditoria, na empresa.
- Hetzner (Alemanha) e AWS (SES) entram como suboperadores na política de privacidade; as condições do serviço dizem quanto tempo a caixa excluída fica guardada. Antes da Fase 3, passar pelo jurídico: condições e aceite no pedido (`advogado-consumidor-produto`), suboperadores e retenção (`advogado-lgpd`).
- A área do cliente entra no app junto com a web (Fase 2). Comprar no app gera a fatura de Pix como as outras; antes de publicar, conferir a regra 3.1.3 da Apple (serviço vendido a empresas); se a revisão recusar, a compra fica na web e o motivo vai para `mobile/task.md`.

## Pontos a conferir

- Os números do `custos.md` são estimativa: refazer a conta com o uso real do cPanel antes de fixar os preços.
- Um servidor só é um ponto único de falha. As condições não prometem disponibilidade que ele não sustenta.
- Cada boleto pago tem tarifa no Inter; muitos proporcionais pequenos custam. Se pesar, o proporcional passa a somar na próxima fatura da recorrência.
- Mais vendas aumentam a lista de "Notas fiscais a emitir" enquanto a emissão pela Focus não for ligada.
