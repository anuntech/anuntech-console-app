import type { Metadata } from "next";
import { Brand } from "@/components/shell/brand";
import { LegalDocument } from "@/components/legal/legal-document";
import styles from "@/components/shell/public-layout.module.css";

export const metadata: Metadata = {
  title: "Suporte",
  description: "Como falar com a Anuntech sobre o Console e o app.",
};

const SUPPORT = `# Suporte do Anuntech Console

O Console e o app "Anuntech Console" são o portal dos clientes da Anuntech: chamados, projetos, contratos, orçamentos, faturas e o assistente.

## Como pedir ajuda

- **Pelo Console ou pelo app:** abra um chamado em Chamados. A equipe responde por lá e avisa você por e-mail ou WhatsApp.
- **Pelo WhatsApp:** (11) 5107-3435, em dias úteis.
- **Pelo assistente:** toque em Assistente e pergunte. Quando for preciso falar com a equipe, ele abre o chamado para você.

## Acesso

Você entra com um código enviado ao seu e-mail ou WhatsApp. Se o código não chegar, confira se o seu e-mail foi liberado pela Anuntech ou pelo Administrador da sua empresa, ou fale com a gente pelo WhatsApp.

## Excluir sua conta

No app, abra Conta e toque em Excluir minha conta. No site, abra Minha conta. Sem acesso à conta, escreva para legal@anuntech.com a partir do e-mail cadastrado.

## Privacidade

Leia a **Política de Privacidade** em www.anuntech.com/privacy. Pedidos sobre dados pessoais: legal@anuntech.com.

## Empresa

ANUNTECH CORPORATE LTDA, CNPJ 43.619.917/0001-81. Rua Uruguai, 34, sala 04, Centro, Caieiras/SP, CEP 07700-665.`;

/** Public: the App Store's support URL. */
export default function Support() {
  return (
    <main id="main-content" tabIndex={-1} className={styles.page}>
      <header className={styles.header}>
        <Brand />
      </header>
      <div className="mx-auto w-full max-w-3xl px-5 pb-16">
        <LegalDocument source={SUPPORT} />
      </div>
    </main>
  );
}
