import { getActor } from "@/lib/access";
import { Heading } from "@/components/ui";
import { WhatsappAccount } from "@/components/whatsapp-account";
export default async function AccountPage() {
  const actor = await getActor();
  return (
    <>
      <Heading
        title="Minha conta"
        description={`Seu e-mail de acesso: ${actor.user.email}`}
      />
      <WhatsappAccount
        phone={
          actor.user.phoneNumberVerified ? actor.user.phoneNumber || null : null
        }
      />
    </>
  );
}
