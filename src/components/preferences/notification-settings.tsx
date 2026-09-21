import "server-only";
import { ActionForm } from "@/components/action-form";
import { NotificationContacts } from "./notification-contacts";
import { saveNotificationPreferences } from "@/lib/company-settings-actions";
import {
  getNoticePreferences,
  noticeEmails,
  noticePhones,
  type NotificationTopic,
  type NoticePreferences,
} from "@/lib/notification-preferences";
import styles from "./preferences-content.module.css";
export async function NotificationTopicForm({
  companyId,
  topic,
  title,
  description,
  preferences: suppliedPreferences,
}: {
  companyId: string | null;
  topic: NotificationTopic;
  title: string;
  description: string;
  preferences?: NoticePreferences;
}) {
  const preferences =
    suppliedPreferences || (await getNoticePreferences(companyId, topic));
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeading}>
        <h2>{title}</h2>
      </div>
      <div className={`${styles.card} ${styles.deliveryCard}`}>
        <p className={styles.helper}>{description}</p>
        <ActionForm
          action={saveNotificationPreferences}
          label="Salvar preferências"
          submitAriaLabel={`Salvar preferências de ${title}`}
        >
          <input type="hidden" name="companyId" value={companyId || ""} />
          <input type="hidden" name="topic" value={topic} />
          <div className="form-grid">
            <NotificationContacts
              kind="email"
              values={noticeEmails(preferences)}
            />
            <NotificationContacts
              kind="phone"
              values={noticePhones(preferences)}
            />
          </div>
          <fieldset className={styles.channelChoices}>
            <legend>Receber por</legend>
            <label className="checkbox-field">
              <input
                type="checkbox"
                name="emailEnabled"
                value="yes"
                defaultChecked={preferences.emailEnabled}
              />{" "}
              E-mail
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                name="whatsappEnabled"
                value="yes"
                defaultChecked={preferences.whatsappEnabled}
              />{" "}
              WhatsApp
            </label>
          </fieldset>
          <p className="form-footnote">
            As alterações valem para os próximos envios.
          </p>
        </ActionForm>
      </div>
    </section>
  );
}
