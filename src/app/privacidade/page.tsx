import type { Metadata } from "next";
import { Brand } from "@/components/shell/brand";
import { LegalDocument } from "@/components/legal/legal-document";
import { PRIVACY_POLICY } from "@/lib/legal/privacy-policy";
import styles from "@/components/shell/public-layout.module.css";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description: "Quais dados o Anuntech Console trata, para quê, com quem compartilha, por quanto tempo guarda e como exercer seus direitos.",
};

/** Public: linked from the App Store, Google Play and the sign-in page. */
export default function PrivacyPolicy() {
  return (
    <main id="main-content" tabIndex={-1} className={styles.page}>
      <header className={styles.header}>
        <Brand />
      </header>
      <div className="mx-auto w-full max-w-3xl px-5 pb-16">
        <LegalDocument source={PRIVACY_POLICY} />
      </div>
    </main>
  );
}
