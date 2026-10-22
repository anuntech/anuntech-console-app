import "server-only";
import { phoneDigits } from "../companies/company-input";
import {
  getNoticePreferences,
  noticeEmails,
  noticePhones,
  type NotificationTopic,
} from "./notification-preferences";

/** The subjects a company's notices go out on, as Configurações → Notificações names them. */
export const COMPANY_NOTICE_TOPICS: { topic: NotificationTopic; title: string; description: string }[] = [
  { topic: "billing", title: "Financeiro", description: "Novas cobranças, vencimentos e lembretes." },
  { topic: "tickets", title: "Chamados", description: "Abertura, respostas e atualizações." },
];

/**
 * Who receives each subject of a company's notices: the saved contacts or,
 * before anyone saved them, the company's billing e-mail and phone. Phones
 * come as typed (DDD and number), without the country code the senders add.
 */
export function companyNoticeTopics(companyId: string) {
  return Promise.all(
    COMPANY_NOTICE_TOPICS.map(async (subject) => {
      const preferences = await getNoticePreferences(companyId, subject.topic);
      return {
        ...subject,
        emails: noticeEmails(preferences),
        phones: noticePhones(preferences).map(phoneDigits),
        emailEnabled: preferences.emailEnabled,
        whatsappEnabled: preferences.whatsappEnabled,
      };
    }),
  );
}
