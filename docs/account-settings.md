# Conta, contatos e membros

## Perfil

Minha conta mantém a organização dos Ajustes: foto e identificação no topo, informações pessoais, contatos e segurança. Nome, e-mail principal e telefone são editados diretamente nos respectivos campos. As ações Salvar e Cancelar aparecem quando há alterações; erros permanecem no contexto e campos inválidos recebem foco. Selects mantêm a interação nativa com visual personalizado. Campos usam fundo suave, bordas discretas e foco visível.

A própria foto é um botão com nome acessível para adicionar ou alterar o avatar. A câmera aparece ao passar o ponteiro ou receber foco; em dispositivos de toque, o indicador permanece visível. O botão abre o seletor de arquivos nativo. Remover foto continua sendo uma ação separada, disponível quando existe imagem.

A foto é enviada ao servidor autenticado (`POST /api/conta/foto`) como PNG, JPEG ou WebP de até 2 MB. O servidor confere assinatura, formato, dimensões e animação; reprocessa em WebP de 512 × 512 e remove metadados. O Blob é privado. O banco guarda somente um caminho pertencente ao usuário; `GET /api/conta/foto` fornece exclusivamente a foto da sessão atual, sem cache público. Troca/remoção usam lock da conta, validam a sessão ainda ativa e removem o objeto anterior. Falhas de limpeza de storage não desfazem a referência já salva.

## E-mails e telefone

- Acesso continua sem senha: código no e-mail principal, WhatsApp previamente verificado ou Google.
- Até cinco endereços verificados por conta, incluindo o principal. Endereços adicionais são contatos da mesma identidade; não abrem contas novas nem substituem o principal no formulário de login.
- Adicionar um endereço ou mudar o principal exige uma sessão criada há até dez minutos e códigos novos tanto no endereço atual como no destino. Provas valem cinco minutos, permitem cinco tentativas, pertencem a uma única sessão e são consumidas uma vez.
- Salvar o novo e-mail principal abre um diálogo para confirmar os dois códigos, com foco inicial no código do endereço atual. Cancelar fecha o diálogo e devolve foco ao campo de e-mail; a conta só muda depois da confirmação válida. Endereços adicionais mantêm o fluxo próprio de inclusão.
- Uma mudança do principal encerra todas as sessões e conserva o endereço anterior e suas permissões. O registro único de e-mails também é mantido por trigger para impedir colisões entre contatos e logins criados simultaneamente.
- O Google também precisa apresentar o e-mail principal atual e verificado. Um vínculo anterior do provedor não permite entrar pelo endereço antigo; a identidade é reavaliada antes de liberar a sessão.
- O e-mail do proprietário e endereços que identificam permissões atuais ou históricas permanecem na conta. Remover um contato livre encerra outras sessões.
- WhatsApp precisa ser confirmado com o código enviado ao próprio número. Telefone cadastral da empresa não equivale a contato autenticado.
- O telefone pode ser substituído sem desvincular o anterior. Salvar solicita o código no destino e mostra a confirmação no mesmo formulário; o número anterior permanece válido até o código ser aceito. Cancelar restaura o número salvo. Número já vinculado a outra conta é recusado, e reenviar respeita o intervalo de um minuto, inclusive após cancelar a edição. Esvaziar o campo exige confirmação antes de remover o telefone.

## Verificação em duas etapas

O recurso é opcional e não acrescenta senha. A interface usa o nome **verificação em duas etapas**; e-mail e WhatsApp não são apresentados como fatores independentes de autenticação.

- Login por e-mail exige WhatsApp na segunda etapa; login por WhatsApp exige e-mail.
- Google exige o canal escolhido individualmente na conta.
- Ativar, desativar ou trocar o canal exige códigos recentes nos dois contatos. A operação encerra as outras sessões e invalida desafios de entrada pendentes.
- Com a proteção ativa, não se alteram os contatos antes de desativá-la. Um trigger no banco também impede corridas entre vinculação de telefone e ativação da proteção.
- A sessão da primeira etapa (código ou Google) é descartada. A sessão plena só é criada depois da confirmação da segunda etapa, na mesma transação que consome o desafio. Sem opção de confiar no dispositivo, TOTP ou códigos de recuperação nesta versão.
- Código vale cinco minutos, desafio dez minutos. Três tentativas por código; na entrada, bloqueio de quinze minutos após dez falhas consecutivas. Envios respeitam o limite compartilhado por destinatário.
- Perda de um dos canais requer atendimento; esta versão não oferece recuperação automática que contorne a segunda etapa.

A implementação usa Better Auth com gate próprio para e-mail, telefone e Google. Reutiliza os provedores OTP já configurados (Resend e Synova). Os testes usam transportes simulados e banco descartável; não atestam entrega de mensagens reais.

## Membros

Ajustes → Membros está disponível à administração do Console e a clientes com permissão Administrador do cliente (`manager`). O proprietário definido em `CONSOLE_ADMIN_EMAIL` pode conceder/revogar administração global da Anuntech. Sua identidade é preservada mesmo após mudar o e-mail principal. Os demais administradores do Console gerenciam acesso a empresas, mas não concedem administração global.

Permissões por empresa: Atendimento (chamados), Financeiro (faturas e contratos) e Administrador do cliente (ambas as áreas e gestão de membros). O cliente administrador vê e altera somente pessoas e empresas nas quais tem um vínculo ativo de administrador; não recebe dados da equipe Anuntech nem opções de outras empresas. Atendimento e Financeiro não acessam essa gestão. Um vínculo ativo também permite administrar membros de uma empresa arquivada.

Os vínculos são resolvidos por identidade e e-mails verificados, com uma permissão efetiva ao editar cada empresa. Revogação alcança aliases da mesma pessoa e passa a valer nas próximas requisições, inclusive anexos e PDFs. Outras empresas permanecem preservadas. Combinações legadas de Atendimento e Financeiro exigem uma escolha explícita ao editar; não são convertidas automaticamente em Administrador do cliente.

O cliente administrador não pode revogar nem rebaixar o próprio acesso. Nenhum ator pode remover ou rebaixar o último administrador ativo da empresa; aliases da mesma pessoa não contam como administradores distintos. As alterações travam a empresa e revalidam a autorização antes da escrita, para preservar essas regras em solicitações concorrentes ou formulários abertos antes de uma revogação.

Adicionar uma pessoa libera o acesso e fornece o link de entrada para compartilhar. Não envia convite automaticamente. Nenhuma associação é concedida apenas por autenticar.

## Implantação e verificação

Aplicar `0010_account_settings.sql` antes da versão que usa esses campos. A migração é aditiva e preenche a reserva dos e-mails existentes; não ativa duas etapas nem concede novos administradores.

Fotos usam uma store Vercel Blob **privada**, conectada ao projeto no ambiente de produção. `BLOB_STORE_ID` identifica a store; a plataforma fornece o token OIDC temporário ao SDK. Não tornar o bucket público nem expor credenciais ao navegador. Desenvolvimento/testes devem usar store e banco separados, ou transportes simulados.

Executar `npm test`, `npm run lint`, `npm run build` e `npm run test:integration`. O runner cria e remove banco descartável e inclui OTP, segurança, membros, contatos e regressão HTTP financeira. Nunca executar os scripts de integração diretamente no banco de clientes.

### Verificação da edição direta — 20/09/2026

QA local confirmado em Chromium, com banco descartável e transportes simulados: salvamento do nome; substituição do telefone após código; mudança do principal após os dois códigos, com zero sessões restantes e alias anterior preservado em consulta ao banco. Validação inválida direcionou foco a Nome, código do telefone e código de origem do e-mail. O cliente administrador viu somente sua empresa, sem equipe Anuntech ou dados de outra empresa. Em 320 CSS px não houve overflow horizontal; o foco no avatar exibiu a câmera e acionou o seletor de arquivos.

Essas evidências não comprovam entrega de mensagens reais. O CI final desta rodada ainda não está registrado neste documento.

## Avatares ilustrados

O perfil oferece uma galeria de 89 SVGs da pasta Identidade visual/Ilustrações/SVG/Avatars e mantém o envio de foto. O catálogo público tem caminhos fixos; PATCH /api/conta/foto aceita somente essas opções, com sessão completa, origem validada e atualização transacional. O mapa de arquivos originais está em avatar-sources.json.

A criação da conta (inclusive primeiro acesso de convidados e Google) grava um avatar aleatório uma única vez. Convites não criam usuários antecipadamente. Remover uma foto atribui um novo avatar do catálogo. Fotos já enviadas permanecem inalteradas e privadas; imagens do catálogo são públicas.

## Membros do ambiente e notificações

A página Membros dos administradores mostra exclusivamente a equipe Anuntech, em Membros (conta verificada existente) e Convidados (ainda sem primeiro acesso verificado). O proprietário pode convidar, cancelar convite e expulsar; o proprietário é protegido e a revogação preserva histórico e vínculos próprios com empresas. Não há envio automático de convite. Acessos de clientes permanecem no cadastro da empresa; gestores clientes continuam vendo somente as empresas que administram.

Notificações substitui Avisos de chamados. A tela contém um interruptor para os avisos de chamados da operação Anuntech e histórico com 20 registros por página, ordenados por criação e ID decrescentes. Contatos ficam em Minha conta. Paginação é consultada no servidor e funciona tanto no acesso direto quanto no modal interceptado.

A configuração persiste em console_notification_settings (migração 0011). Desativar aguarda os envios em andamento, cancela avisos ainda não enviados e impede enfileiramento enquanto desativado; reativar não recupera cancelados. O histórico é preservado. Tentativas de envio são registradas antes do contato com provedores para preservar a proteção contra reenvios incertos. Alterações exigem administrador e geram auditoria. Esta configuração é da operação Anuntech, não de eventuais preferências individuais por empresa.

Validação: `npm run test:integration -- --members-only` e `--notifications-only` usam banco descartável. O teste de fila usa provedores simulados, nunca envia mensagens reais. Para QA visual opcional, `CONSOLE_PLAYWRIGHT_MODULE` aponta ao módulo Playwright disponível no ambiente.

## Company settings and notification contacts

`/configuracoes/empresa` is available to Console administrators and company managers. Managers can edit only companies for which they retain an active manager grant; grants are checked again inside the transaction under the same company lock used by member changes. The form edits name, CPF/CNPJ, billing contact and address, but never changes fiscal automation or grants access.

Financial and support notification preferences have separate email, telephone and channel flags. Without a saved preference, financial notices retain the company billing contacts and enabled channels; client support notices remain off. Changes do not emit test messages or replay old events. The Anuntech operation switch and its paginated history remain separate from company recipients.

Workers validate current destinations before delivery, honor disabled channels, and preserve immutable retry payloads. Changing a destination cancels an old pending retry instead of retargeting it. Already accepted deliveries remain eligible for delivery-status checks. Financial notices still require current Inter reconciliation and stop after payment. Preference writes synchronize with in-flight company dispatches.

### Refinamento de Minha conta — 20/09/2026

Confirmações de salvamento usam notificações flutuantes compartilhadas. Erros de campos permanecem associados ao formulário. Formato e limite da foto aparecem apenas quando o arquivo é inválido. Minha conta oferece somente a troca do e-mail principal com os dois códigos, sem opção de adicionar contatos extras; aliases anteriores ficam preservados internamente para manter vínculos. A explicação de segurança foi reduzida sem alterar as verificações.

## Aparência e Segurança — 20/09/2026

Os ajustes separam Usuário (Minha conta, Aparência e Segurança) de Empresa. Minha conta contém perfil e contatos. Segurança reúne a verificação em duas etapas e as últimas 20 sessões, com a sessão atual destacada. Só a própria pessoa pode consultar suas sessões; a consulta não seleciona tokens. Sessões completas novas geram `account.session.started`, sem códigos nem tokens, e continuam no histórico depois do encerramento. A primeira etapa de um acesso com duas etapas não entra nesse histórico. Sessões anteriores ainda presentes aparecem; acessos já encerrados antes da atualização não podem ser reconstruídos. Horários exibidos em Brasília, com “última atualização” conforme o registro de sessão do provedor.

Aparência permite claro, escuro ou tema do sistema e menu embaixo, em cima, à esquerda ou à direita. Preferências são persistidas por um ano em cookies do navegador, com valores validados e aplicados no HTML inicial para evitar troca de cores na abertura. Em telas até 640px o menu fica embaixo. O tema usa cores semânticas e mantém foco visível e controles nativos; notificações acompanham o tema.

## Um ambiente por conta — 21/09/2026

Cada identidade, incluindo seus e-mails verificados, pertence a um único ambiente. Convites e troca/verificação de e-mail compartilham um lock de atribuição e recusam vínculos que misturem ambientes. A operação Anuntech continua administrando clientes pelo cadastro de empresas; os próprios Ajustes mostram somente o cadastro interno, armazenado separadamente dos clientes. Gestores clientes veem somente seu ambiente, sem seletor de empresa.

Dados da empresa contém apenas o cadastro. Notificações permite até dez e-mails e dez telefones por assunto, com canais independentes. Clientes têm Financeiro e Chamados; a operação Anuntech mantém seu controle de chamados. O histórico do ambiente combina seus envios financeiros e de chamados, com vinte itens por página. Destinatários não recebem acesso ao Console por serem adicionados à lista.

Cada destinatário tem sua própria entrega e chave de idempotência. E-mails são enviados individualmente, sem divulgar outros contatos. Repetições mantêm o destino original e são canceladas quando esse contato é removido ou o canal desativado. Adicionar contatos não reenvia eventos antigos automaticamente. A migração 0013 mantém as preferências antigas como fallback e resolve destinatários de instâncias antigas antes da checagem de unicidade durante a publicação.

Membros de clientes seguem o mesmo layout de Membros e Convidados da operação, com avatar, convite e expulsão. A permissão continua restrita ao ambiente; não é possível remover o próprio acesso nem o último administrador. Permissões legadas combinadas exigem escolha explícita na edição.

Ao revalidar os Ajustes, o proxy evita que uma página retida seja interceptada por ela mesma (next-url igual ao caminho solicitado). Isso mantém o modal e a confirmação de salvamento sem recarregar o documento. Navegações entre seções e entrada a partir do painel continuam usando as rotas existentes.
