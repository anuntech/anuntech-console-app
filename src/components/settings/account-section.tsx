import "server-only";
import { getActor } from "@/lib/access/access";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SectionTitle } from "@/components/console/page-header";
import { AuthAlert } from "@/components/auth/feedback";
import { AvatarPicker } from "./avatar-picker";
import { EmailRow, NameForm, WhatsappRow } from "./account-forms";
import { AccountDeletion } from "./account-deletion";
import { getAccountEmails } from "@/lib/account/account-identity";
import { accountActivity } from "@/lib/account/activity";
import { ActivityCard } from "./activity-card";

export async function AccountSection() {
  const actor = await getActor();
  const locked = actor.user.twoFactorEnabled === true;
  const phone = actor.user.phoneNumberVerified
    ? actor.user.phoneNumber || null
    : null;
  const owner = (
    await getAccountEmails(actor.user.id, actor.user.email)
  ).includes(process.env.CONSOLE_ADMIN_EMAIL?.trim().toLowerCase() || "");
  const activity = await accountActivity(actor.user.id);
  return (
    <>
      <Card>
        <CardHeader>
          <SectionTitle title="Perfil" />
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <AvatarPicker name={actor.user.name} image={actor.user.image ?? null} />
          <div className="max-w-md">
            <NameForm name={actor.user.name} />
          </div>
        </CardContent>
      </Card>
      <ActivityCard days={activity} />
      <Card>
        <CardHeader>
          <SectionTitle title="Contatos de acesso" />
        </CardHeader>
        <CardContent className="flex flex-col gap-4 px-0">
          {locked && (
            <div className="px-6">
              <AuthAlert kind="info">
                Com a verificação em duas etapas ativa, e-mail e WhatsApp ficam
                protegidos. Desative em Segurança para alterá-los.
              </AuthAlert>
            </div>
          )}
          <ul className="divide-y border-t">
            <EmailRow email={actor.user.email} locked={locked} />
            <WhatsappRow phone={phone} locked={locked} />
          </ul>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <SectionTitle title="Excluir conta" />
        </CardHeader>
        <CardContent>
          <AccountDeletion owner={owner} hasWhatsapp={!!phone} />
        </CardContent>
      </Card>
    </>
  );
}
