# Anuntech Console

Perfil, contatos verificados, verificação em duas etapas e permissões de membros: [documentação da conta](docs/account-settings.md).

Portal de clientes da Anuntech para produtos, projetos, atendimento e financeiro.

## Implementado

- Código por e-mail (Resend), código por WhatsApp (FLW) e Google opcional, com Better Auth e sessões no PostgreSQL/Neon.
- Administração interna por e-mail explicitamente autorizado.
- Empresas e liberação/revogação de acesso por e-mail verificado.
- Permissões separadas de atendimento e financeiro por empresa.
- Produtos e projetos com situação e descrição.
- Chamados com respostas, responsável, status e anexos privados.
- Faturas manuais: rascunhos, emissão Inter de boleto com Pix, consulta manual de pagamento e download privado do boleto.
- Tentativa bancária persistida antes do envio; edição/cancelamento do rascunho bloqueados após tentativa. Resposta incerta exige reconciliação, sem repetir a emissão.
- Diagnóstico de autenticação Inter, Focus NFe e canais FLW em Configurações (admin).
- Aviso de acesso manual via Resend, com idempotência e registro da tentativa.
- Histórico de operações no banco.
- Avisos automáticos de movimentações de chamados por e-mail e WhatsApp para a administração, com fila persistida e histórico.

## Executar

```sh
npm ci
cp .env.example .env.local # apenas se o arquivo local ainda não existir
# Preencher banco, Google, secret, URL e CONSOLE_ADMIN_EMAIL localmente.
npm run db:migrate
npm run dev
```

Desenvolvimento em http://localhost:3100. A aplicação inicia pelo login em `/entrar`.

O primeiro administrador é definido em `CONSOLE_ADMIN_EMAIL`. Não existe cadastro público que conceda acesso a empresas. Um cliente entra com o e-mail autorizado pela administração. A autenticação não substitui autorização.

## Verificação

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:integration
```

O teste de integração requer build prévio e uma conexão PostgreSQL com permissão de criar banco. Cria um banco descartável separado, aplica as migrações, testa autenticação e permissões por HTTP e remove o banco ao terminar. Os provedores Resend, FLW e Inter são simulados; nenhuma mensagem ou cobrança real é enviada. Os scripts recusam bancos fora do padrão temporário. O teste de OAuth verifica apenas o redirecionamento. No CI, as suítes completas rodam em PostgreSQL temporário. O certificado usado no teste Inter é gerado localmente para a simulação e removido ao final.

## Estrutura

- `src/app`: páginas e rotas HTTP.
- `src/components`: interface e formulários.
- `src/lib`: autenticação, permissões e operações de negócio.
- `src/db/schema.ts`: estrutura do banco.
- `drizzle`: migrações versionadas; não alterar migrações já aplicadas.
- `tests` e `scripts/smoke.mjs`: verificações automatizadas.

## Limites atuais

Autenticação Inter validada com certificado real. Emissão e consulta de cobranças têm testes HTTP com banco simulado; nenhuma cobrança real foi emitida na validação. A cobrança Inter exige pagador/endereço, pelo menos R$ 2,50 e vencimento a partir do próximo dia. O QR Pix depende de chave cadastrada na conta Inter. A atualização de pagamento ocorre pela ação manual de consulta; webhook bancário ainda não está habilitado.

Focus NFe: tokens testados por consulta nos dois ambientes; emissão bloqueada enquanto aguardamos dados fiscais. FLW: canal e modelo de autenticação configurados para login por WhatsApp; modelo de cobrança segue pendente. Nenhuma emissão fiscal é simulada. Não há recorrência ou disparos automáticos de cobranças. Notificações de entrega/bounce de e-mail ainda não têm webhook: acompanhar no Resend. O aviso de acesso é enviado uma única vez por vínculo; repetição segura dentro de 23 horas reutiliza a tentativa. Links de acesso em avisos exigem HTTPS.

### Cadastro de cobrança e preferência fiscal

Endereço, número, complemento, bairro, cidade, UF, CEP e código IBGE opcional ficam no cadastro da empresa. Cadastro sem endereço pode ser salvo, mas um endereço parcialmente preenchido é rejeitado. Para emitir Pix/boleto é obrigatório ter o endereço completo salvo: o servidor ignora endereços enviados no formulário da fatura e preserva o retrato dos dados usado em cada cobrança já emitida.

A opção `autoIssueNfse` é individual por empresa e começa desativada, inclusive para clientes existentes. Somente o administrador pode alterá-la. Nesta etapa ela registra a preferência; não cria notas, não altera o estado fiscal das faturas e não ativa retroativamente emissões. O gatilho e a integração de emissão Focus dependem da conclusão dos parâmetros fiscais do prestador e do serviço. A interface informa essa pendência explicitamente.

Anexos de PDF/PNG/JPEG ficam no banco, com download privado: até 1 MB cada e 20 por chamado. A leitura exige a mesma permissão de atendimento do chamado. Para volume maior, migrar o conteúdo para armazenamento privado dedicado.

Chamados exibem até 200 itens recentes. Faturas têm paginação no servidor (10, 25, 50 ou 100 por página), busca por cliente/descrição e abas por situação com contagens autorizadas. Filtros e página ficam na URL; alterar filtros volta à primeira página. A tabela usa como referência crud-data-table do shadcn.io, sem totais monetários no cabeçalho/rodapé. Ainda não há edição de cobrança emitida, estorno, baixa manual ou cancelamento bancário.

Antes de receber clientes reais, separar desenvolvimento/produção no Neon e concluir testes do OAuth Google e dos provedores financeiros em homologação.

## Documentação e segredos

Decisões do produto: `/Users/kauan/Desktop/anuntech/anuntech-wiki/Console/`.

`.env.local` é ignorado pelo Git. `.env.example` contém somente nomes e valores públicos de configuração. Segredos nunca usam `NEXT_PUBLIC_`. GitHub/Vercel/Cloudflare são configurados como infraestrutura, não como credenciais do runtime.

Referências: [Next.js](https://nextjs.org/docs), [Better Auth](https://better-auth.com/docs), [Neon](https://neon.com/docs), [Resend](https://resend.com/docs).

## Integrações — referências oficiais

- [Inter Cobrança](https://developers.inter.co/references/cobranca-bolepix): emissão, consulta, PDF e idempotência bancária de 30 minutos.
- [Focus autenticação](https://doc.focusnfe.com.br/reference/autenticacao): Basic com token por ambiente; consultar referência inexistente verifica autenticação sem emitir nota.
- [FLW/Helena](https://helena.readme.io/reference/getting-started-with-your-api): Bearer; canais e templates usam /chat/v1, separado do /core/v1.

Certificados em certificates/inter são privados e excluídos do Git e dos uploads Vercel. Na Vercel utilizam-se apenas as variáveis BASE64; caminhos locais não são enviados.

## Acesso por código

O e-mail autorizado pode entrar sem conta Google. Código de 6 dígitos, validade de 5 minutos, uso único e até 3 tentativas. Reenvio após 60 segundos, no máximo 5 envios por destinatário em 15 minutos, com controle compartilhado no PostgreSQL e limite adicional por IP. E-mails desconhecidos e números sem vínculo recebem uma resposta genérica sem envio.

Para WhatsApp, entre por e-mail ou Google e abra Minha conta. Vinculação e remoção exigem sessão criada nos últimos 10 minutos; confirme o número com código enviado pelo FLW. Depois, o número verificado pode ser usado na tela de entrada. Configure FLW_SENDER_NUMBER (DDI e DDD, somente dígitos) e FLW_OTP_TEMPLATE_ID (modelo AUTHENTICATION aprovado). Nenhum usuário é criado a partir de um telefone não vinculado.

Os testes automatizados cobrem os fluxos e proteções com provedores simulados. A entrega efetiva na caixa de e-mail e no WhatsApp deve ser confirmada pelo destinatário ao solicitar um código.

## Avisos de chamados

Abertura, resposta, anexo, mudança de situação (incluindo encerramento/reabertura) ou responsável criam avisos na mesma transação do evento de auditoria. Salvar sem mudança ou uma ação recusada não dispara aviso. Atualmente o único destinatário é CONSOLE_ADMIN_EMAIL, conforme solicitado; o WhatsApp é o número verificado desse usuário. Clientes não recebem estes avisos internos.

O e-mail descreve a movimentação e aponta para o chamado. O WhatsApp usa FLW_TICKET_TEMPLATE_ID com o parâmetro [nome_do_cliente] preenchido com o nome da empresa cliente. Modelo em análise permanece aguardando, sem bloquear e-mail. Aprovação é conferida antes do POST.

Processamento imediato via after e retomada a cada 5 minutos por cron Vercel protegido por CRON_SECRET. A fila é bloqueada por registro para evitar workers concorrentes enviando a mesma tentativa. Resend usa chave idempotente e conteúdo persistido. Envio incerto ao FLW não é repetido automaticamente, porque senderId é somente um identificador de correlação documentado. WhatsApp aceito é consultado até confirmação de entrega, falha ou 23 horas; aceite do Resend não é apresentado como entrega.

Tentativas pendentes expiram após 23 horas para manter as retentativas dentro do prazo de idempotência. Erros e respostas incertas ficam disponíveis em Configurações → Avisos de chamados. Remover/trocar o WhatsApp ou administrador cancela o destinatário antigo ainda pendente. Nenhum histórico anterior à implantação é reenviado.

## Contratos

Administração escreve contratos em texto simples por cliente, salva rascunhos e publica uma versão para consulta e download em PDF. Perfis administrador do cliente e financeiro veem apenas publicações da própria empresa; atendimento não acessa contratos. As mesmas regras são verificadas no download privado, sem cache público.

Editar um rascunho não altera a publicação: a versão publicada guarda título, texto e identificação do cliente. Publicar novamente substitui essa versão e incrementa sua numeração. Retirar a publicação bloqueia consulta/download do cliente e preserva o rascunho. Revisão numérica impede sobrescrita/publicação por uma aba desatualizada. Toda alteração gera auditoria.

PDF gerado no servidor com PDFKit, A4, fontes Noto Sans incluídas no deploy, acentos, paginação e indicação de versão ou rascunho. Fontes sob SIL Open Font License em assets/fonts/OFL.txt. Nenhum conteúdo do contrato é enviado a um serviço externo para gerar o PDF.

## Preenchimento por CNPJ e CEP

Cadastro e edição da empresa consultam razão social e endereço pelo CNPJ (CNPJ.ws) e logradouro, bairro, cidade, UF e código IBGE pelo CEP (ViaCEP). Consulta automática 650 ms após completar os dígitos, sem botões de busca. CPF não é consultado. Número/complemento disponíveis no CNPJ são aproveitados; a consulta de CEP preserva esses campos e não usa o complemento de logradouro do ViaCEP como unidade do cliente.

Todos os campos permanecem editáveis e só são persistidos ao salvar. Respostas atrasadas não sobrescrevem campos editados durante a consulta. API interna exige administrador verificado, usa hosts fixos, timeout de 8 segundos e não encaminha dados de sócios ou contatos públicos. Falhas e limite do provedor deixam o preenchimento manual disponível. Sem novas credenciais ou migrações.

Referências: [CNPJ.ws público](https://docs.cnpj.ws/referencia-de-api/api-publica/consultando-cnpj), [ViaCEP](https://viacep.com.br/).

## Cadastro por link

Em Empresas → Cadastrar empresa, a administração pode preencher o cadastro ou gerar um link individual em Links e cadastros recebidos. Link aleatório de 256 bits, apenas hash SHA-256 persistido, validade de 7 dias e um único envio. O endereço completo fica disponível para cópia somente na criação; perder o link exige cancelar e gerar outro. Envio e cancelamento concorrentes são condicionados ao estado atual no banco.

O cliente não precisa de login. Preenche documento, razão social, e-mail financeiro, telefone obrigatório e endereço completo, com as mesmas buscas de CNPJ/CEP. Telefone com DDD, máscaras CPF/CNPJ e telefone, e-mail normalizado para minúsculas e validado no servidor. A busca pública exige token válido e permite no máximo 40 consultas por link. Sem envio de mensagens ao gerar um link.

Dados recebidos ficam pendentes para revisão administrativa. Aprovar cria a empresa em transação, impede documento duplicado e registra auditoria; não cria usuário, associação, cobrança ou nota fiscal. Preferência fiscal é exclusiva da administração. Telefone cadastral não é verificação de WhatsApp para login. Cancelar descarta o payload pendente; aprovação move os dados para o cadastro e remove a cópia do convite. A página pública não reexibe dados já enviados. Referrer-Policy no-referrer impede que o token seja propagado em referências. Migração 0007 adiciona convites sem alterar clientes existentes.

## Notificações de interface

Sonner do catálogo shadcn.io, consultado pelo MCP shadcnio e adaptado em src/components/ui/sonner.tsx ao tema claro e à fonte Sofia da Console, sem reconfigurar a identidade visual. Toaster global mantém avisos entre navegações. Formulários, login, WhatsApp, cópia de convite, consultas de CNPJ/CEP e downloads usam notificações de sucesso, erro, informação ou carregamento. Erros de validação nativa viram uma notificação em português com foco no primeiro campo inválido. Confirmação de desvinculação do WhatsApp usa notificação com ações explícitas.

CNPJ e CEP consultam automaticamente após completar os dígitos e 650ms de pausa; não há botões de busca. Cancelar/alterar a consulta descarta resposta e notificação obsoletas. Feedback de salvamento permanece em noscript para navegadores sem JavaScript. Histórico e informações permanentes continuam como conteúdo da página, sem disparar mensagens históricas como eventos novos. Falhas de página têm aviso genérico e botão de tentar novamente.

Origem do componente: https://www.shadcn.io/ui/sonner. O MCP já estava conectado; nenhum token/configuração privada foi incluído no repositório.

## Edição de documento e arquivamento de clientes

Em Empresas → Gerenciar → Editar dados da empresa, a administração pode alterar CPF/CNPJ, com máscara e consulta automática de CNPJ. O servidor normaliza o documento, rejeita duplicidade sem salvar alterações parciais e registra documento anterior e novo na auditoria. A identidade interna da empresa e seus vínculos são preservados.

Arquivar cliente remove o cadastro da lista principal de Empresas. A aba Arquivados permite consultar e restaurar; históricos, documentos e permissões de acesso são preservados. Arquivar não revoga acessos nem altera faturas, contratos ou chamados. Arquivamento e restauração exigem administrador e geram auditoria apenas quando a situação muda. Migração 0008 adiciona archived com false como padrão, preservando todos os clientes atuais como ativos.

## Conciliação automática de cobranças

O cron `/api/cron/billing-sync`, protegido por `CRON_SECRET`, consulta cobranças emitidas no Inter a cada cinco minutos. Processa até 20 por execução, priorizando as menos recentemente consultadas, em grupos de quatro. Só consulta cobranças do ambiente configurado e com código de solicitação; não emite cobranças, notas fiscais nem mensagens.

Consulta manual e automática usam a mesma validação: código, referência, valor, vencimento e documento original do pagador devem corresponder à fatura. Apenas `RECEBIDO` confirma pagamento; `MARCADO_RECEBIDO` não comprova recebimento. Estados pagos não retrocedem. Mudanças automáticas são auditadas com `source: scheduled`, vinculadas ao responsável pela emissão original. A trava transacional evita execuções de cron sobrepostas. Respostas divergentes/falhas mantêm a fatura e retornam HTTP 503 com contagem de falhas, permitindo diagnóstico e nova tentativa.
