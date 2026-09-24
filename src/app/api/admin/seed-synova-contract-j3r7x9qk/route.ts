import "server-only";
import { ilike } from "drizzle-orm";
import { contractTemplates } from "@/db/schema";
import { db } from "@/lib/db";

const NAME = "Licença de uso do Synova";
const DESCRIPTION = "Assinatura mensal ou anual do Synova: licença de uso, suporte, pagamento pelo Console e LGPD.";

const BODY = `CONTRATO DE LICENÇA DE USO DE SOFTWARE E PRESTAÇÃO DE SERVIÇOS — SYNOVA

CONTRATANTE: {{empresa}}, inscrita no CNPJ sob o nº {{cnpj}}, com endereço em {{endereco}}, neste ato representada por quem assina eletronicamente este contrato pelo Anuntech Console.

CONTRATADA: {{anuntech}}, inscrita no CNPJ sob o nº {{anuntech_cnpj}}, com sede em {{anuntech_endereco}}, neste ato representada por quem assina eletronicamente este contrato pelo Anuntech Console.

As partes celebram o presente contrato, que se rege pelas cláusulas a seguir.

CLÁUSULA 1 — OBJETO
1.1. A CONTRATADA concede à CONTRATANTE uma licença de uso, não exclusiva e intransferível, da plataforma Synova ({{produto}}), que centraliza o atendimento por WhatsApp, Instagram e Messenger em um único ambiente, com CRM integrado, chatbots e automações.
1.2. A licença compreende o acesso à plataforma pela internet, as atualizações liberadas durante a vigência e o suporte descrito na Cláusula 5.
1.3. Não fazem parte do objeto: custos cobrados pela Meta ou por operadoras pelo envio de mensagens, números de telefone, chips, aparelhos e serviços de terceiros contratados diretamente pela CONTRATANTE.

CLÁUSULA 2 — ACESSO E CONTAS
2.1. A CONTRATADA disponibilizará o acesso à CONTRATANTE em até 5 dias úteis após a assinatura e a confirmação do primeiro pagamento.
2.2. As credenciais de acesso são pessoais. A CONTRATANTE responde pelo uso feito por seus usuários e deve comunicar imediatamente qualquer uso indevido ou perda de acesso.
2.3. A CONTRATANTE é responsável por manter suas contas do WhatsApp Business, Instagram e Messenger ativas e em conformidade com as políticas das respectivas plataformas.

CLÁUSULA 3 — VALOR E PAGAMENTO
3.1. Pela licença e pelos serviços, a CONTRATANTE pagará à CONTRATADA o valor de {{valor}}, em periodicidade {{ciclo}}, por boleto bancário ou Pix emitidos pelo Anuntech Console.
3.2. O pagamento em atraso está sujeito a multa de 2% (dois por cento) sobre o valor devido e juros de 1% (um por cento) ao mês, calculados pro rata die, além de eventual correção prevista na cobrança.
3.3. Persistindo o atraso por mais de 15 (quinze) dias, a CONTRATADA poderá suspender o acesso à plataforma até a regularização, sem prejuízo da cobrança dos valores devidos durante a suspensão.
3.4. Os valores poderão ser reajustados a cada 12 (doze) meses pela variação do IPCA/IBGE ou por outro índice que venha a substituí-lo, mediante comunicação prévia de 30 (trinta) dias.

CLÁUSULA 4 — VIGÊNCIA E RENOVAÇÃO
4.1. Este contrato entra em vigor na data da assinatura pelas duas partes e vigora por prazo indeterminado.
4.2. Qualquer das partes pode encerrá-lo, sem ônus, mediante comunicação com antecedência mínima de 30 (trinta) dias, permanecendo devidos os valores do período em curso.
4.3. No plano anual, o encerramento antes do fim do período contratado não dá direito a reembolso dos meses já pagos, salvo em caso de descumprimento pela CONTRATADA.

CLÁUSULA 5 — SUPORTE E DISPONIBILIDADE
5.1. O suporte é prestado pelo Anuntech Console, por meio da abertura de chamados, em dias úteis, das 9h às 18h, horário de Brasília, com primeira resposta em até 1 (um) dia útil.
5.2. A CONTRATADA empregará seus melhores esforços para manter a plataforma disponível, ressalvadas janelas de manutenção comunicadas com antecedência e indisponibilidades causadas por terceiros, como a Meta, provedores de hospedagem ou de telecomunicações.
5.3. A CONTRATADA poderá alterar funcionalidades da plataforma para aprimorá-la, sem reduzir de forma relevante o objeto contratado.

CLÁUSULA 6 — OBRIGAÇÕES DA CONTRATANTE
6.1. Utilizar a plataforma de forma lícita, respeitando a legislação aplicável, os direitos de terceiros e as políticas do WhatsApp, do Instagram e do Messenger, especialmente quanto ao consentimento para o envio de mensagens.
6.2. Fornecer as informações e os acessos necessários à configuração e ao funcionamento do serviço.
6.3. Não ceder, sublicenciar, copiar, descompilar ou tentar acessar o código-fonte da plataforma.

CLÁUSULA 7 — PROTEÇÃO DE DADOS PESSOAIS
7.1. Para os fins da Lei nº 13.709/2018 (LGPD), a CONTRATANTE é a controladora dos dados pessoais de seus clientes e contatos tratados na plataforma, e a CONTRATADA atua como operadora, tratando esses dados somente conforme as instruções da CONTRATANTE e para a execução deste contrato.
7.2. A CONTRATADA adotará medidas técnicas e administrativas adequadas para proteger os dados, comunicará à CONTRATANTE incidentes de segurança relevantes em prazo razoável e, ao término do contrato, eliminará ou devolverá os dados, salvo obrigação legal de guarda.
7.3. A CONTRATANTE declara possuir base legal para o tratamento dos dados que inserir na plataforma.

CLÁUSULA 8 — PROPRIEDADE INTELECTUAL E CONFIDENCIALIDADE
8.1. A plataforma Synova, seu código, marcas, layouts e documentação pertencem à CONTRATADA. Este contrato não transfere qualquer direito de propriedade intelectual, apenas a licença de uso aqui prevista.
8.2. Os dados, conversas e conteúdos inseridos pela CONTRATANTE permanecem de sua propriedade.
8.3. As partes manterão em sigilo as informações confidenciais a que tiverem acesso em razão deste contrato, durante a vigência e por 2 (dois) anos após o seu término.

CLÁUSULA 9 — LIMITAÇÃO DE RESPONSABILIDADE
9.1. A CONTRATADA não responde por lucros cessantes, perda de negócios ou danos indiretos, nem por indisponibilidades ou bloqueios impostos pela Meta e por outras plataformas de terceiros.
9.2. A responsabilidade total da CONTRATADA, por qualquer causa relacionada a este contrato, fica limitada ao valor pago pela CONTRATANTE nos 12 (doze) meses anteriores ao evento.

CLÁUSULA 10 — RESCISÃO
10.1. Além da hipótese da Cláusula 4.2, este contrato pode ser rescindido por qualquer das partes em caso de descumprimento não sanado em 15 (quinze) dias após notificação, ou de uso da plataforma para fins ilícitos ou contrários às políticas das plataformas integradas, caso em que a rescisão pode ser imediata.
10.2. Encerrado o contrato, a CONTRATANTE terá 30 (trinta) dias para exportar seus dados pela plataforma ou solicitá-los à CONTRATADA.

CLÁUSULA 11 — DISPOSIÇÕES GERAIS
11.1. As partes reconhecem a validade jurídica deste contrato assinado eletronicamente pelo Anuntech Console, na forma da Medida Provisória nº 2.200-2/2001 e da Lei nº 14.063/2020, com identificação dos signatários por código enviado ao e-mail ou WhatsApp cadastrado e registro de data, hora, endereço IP e hash do documento.
11.2. Este contrato substitui entendimentos anteriores sobre o mesmo objeto e só pode ser alterado por escrito, inclusive por meio de novo contrato assinado eletronicamente pelo Console.
11.3. A tolerância de qualquer das partes quanto ao descumprimento de alguma cláusula não implica renúncia ao direito de exigi-la.
11.4. Fica eleito o foro da comarca da sede da CONTRATADA para dirimir questões oriundas deste contrato, com renúncia a qualquer outro.

E, por estarem de acordo, as partes assinam eletronicamente este contrato pelo Anuntech Console, na data registrada no documento.

{{data}}`;

/** Seeds the Synova contract template once; remove after use. */
export async function GET() {
  const existing = await db.select({ id: contractTemplates.id }).from(contractTemplates).where(ilike(contractTemplates.name, NAME));
  if (existing.length) return Response.json({ created: false, id: existing[0].id });
  const [row] = await db
    .insert(contractTemplates)
    .values({ name: NAME, description: DESCRIPTION, body: BODY })
    .returning({ id: contractTemplates.id });
  return Response.json({ created: true, id: row.id, characters: BODY.length });
}
