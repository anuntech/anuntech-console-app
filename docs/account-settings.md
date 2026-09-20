# Conta, contatos e membros

## Perfil

Minha conta mantém a organização dos Ajustes: foto e identificação no topo, informações pessoais, contatos e segurança. A edição de nome permanece em um modal com rótulos, tratamento de erros, contenção e restauração de foco. Selects usam o controle nativo do navegador.

A foto é enviada ao servidor autenticado (`POST /api/conta/foto`) como PNG, JPEG ou WebP de até 2 MB. O servidor confere assinatura, formato, dimensões e animação; reprocessa em WebP de 512 × 512 e remove metadados. O Blob é privado. O banco guarda somente um caminho pertencente ao usuário; `GET /api/conta/foto` fornece exclusivamente a foto da sessão atual, sem cache público. Troca/remoção usam lock da conta, validam a sessão ainda ativa e removem o objeto anterior. Falhas de limpeza de storage não desfazem a referência já salva.

## E-mails e telefone

- Acesso continua sem senha: código no e-mail principal, WhatsApp previamente verificado ou Google.
- Até cinco endereços verificados por conta, incluindo o principal. Endereços adicionais são contatos da mesma identidade; não abrem contas novas nem substituem o principal no formulário de login.
- Adicionar um endereço ou mudar o principal exige uma sessão criada há até dez minutos e códigos novos tanto no endereço atual como no destino. Provas valem cinco minutos, permitem cinco tentativas, pertencem a uma única sessão e são consumidas uma vez.
- Uma mudança do principal encerra todas as sessões e conserva o endereço anterior e suas permissões. O registro único de e-mails também é mantido por trigger para impedir colisões entre contatos e logins criados simultaneamente.
- O Google também precisa apresentar o e-mail principal atual e verificado. Um vínculo anterior do provedor não permite entrar pelo endereço antigo; a identidade é reavaliada antes de liberar a sessão.
- O e-mail do proprietário e endereços que identificam permissões atuais ou históricas permanecem na conta. Remover um contato livre encerra outras sessões.
- WhatsApp precisa ser confirmado com o código enviado ao próprio número. Telefone cadastral da empresa não equivale a contato autenticado.

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

Ajustes → Membros é exclusivo da administração. O proprietário definido em `CONSOLE_ADMIN_EMAIL` pode conceder/revogar administração global da Anuntech. Sua identidade é preservada mesmo após mudar o e-mail principal. Administradores podem gerenciar acesso a empresas, mas não conceder administração global.

Permissões por empresa: Atendimento (chamados), Financeiro (faturas e contratos) e Administrador do cliente (ambas). Os vínculos são resolvidos por identidade e e-mails verificados, com uma permissão efetiva ao editar cada empresa. Revogação alcança aliases da mesma pessoa e passa a valer nas próximas requisições, inclusive anexos e PDFs. Outras empresas permanecem preservadas.

Adicionar uma pessoa libera o acesso e fornece o link de entrada para compartilhar. Não envia convite automaticamente. Nenhuma associação é concedida apenas por autenticar.

## Implantação e verificação

Aplicar `0010_account_settings.sql` antes da versão que usa esses campos. A migração é aditiva e preenche a reserva dos e-mails existentes; não ativa duas etapas nem concede novos administradores.

Fotos usam uma store Vercel Blob **privada**, conectada ao projeto no ambiente de produção. `BLOB_STORE_ID` identifica a store; a plataforma fornece o token OIDC temporário ao SDK. Não tornar o bucket público nem expor credenciais ao navegador. Desenvolvimento/testes devem usar store e banco separados, ou transportes simulados.

Executar `npm test`, `npm run lint`, `npm run build` e `npm run test:integration`. O runner cria e remove banco descartável e inclui OTP, segurança, membros, contatos e regressão HTTP financeira. Nunca executar os scripts de integração diretamente no banco de clientes.
