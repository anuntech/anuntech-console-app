"use client";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MailIcon, PhoneIcon, PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/shell/notifications";
import { setTicketNotifications } from "@/lib/notifications/notification-actions";

/** Up to ten addresses or numbers, one per line; empty lines are ignored. */
export function ContactsField({
  kind,
  values,
}: {
  kind: "email" | "phone";
  values: string[];
}) {
  const id = useId();
  const [contacts, setContacts] = useState(() => (values.length ? values : [""]));
  const label = kind === "email" ? "E-mail" : "Telefone";
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 flex items-center gap-2 text-sm font-medium text-foreground [&_svg]:size-4 [&_svg]:text-muted-foreground">
        {kind === "email" ? <MailIcon /> : <PhoneIcon />}
        {kind === "email" ? "E-mails" : "Telefones"}
      </legend>
      {contacts.map((value, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <Label htmlFor={`${id}-${index}`} className="sr-only">
            {label} {index + 1}
          </Label>
          <Input
            id={`${id}-${index}`}
            name={kind === "email" ? "emails" : "phones"}
            type={kind === "email" ? "email" : "tel"}
            value={value}
            autoComplete="off"
            maxLength={kind === "email" ? 254 : 30}
            placeholder={kind === "email" ? "nome@empresa.com.br" : "(11) 99999-9999"}
            onChange={(event) =>
              setContacts((current) =>
                current.map((item, i) => (i === index ? event.target.value : item)),
              )
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Remover ${label.toLowerCase()} ${index + 1}`}
            onClick={() =>
              setContacts((current) =>
                current.length === 1 ? [""] : current.filter((_, i) => i !== index),
              )
            }
          >
            <XIcon />
          </Button>
        </div>
      ))}
      {contacts.length < 10 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start text-muted-foreground"
          onClick={() => setContacts((current) => [...current, ""])}
        >
          <PlusIcon />
          {kind === "email" ? "Adicionar e-mail" : "Adicionar telefone"}
        </Button>
      )}
    </fieldset>
  );
}

/** Whether the Anuntech team is told about ticket activity at all. */
export function TicketNoticesSwitch({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const id = useId();
  const [pending, start] = useTransition();
  const [value, setValue] = useState(enabled);
  return (
    <div className="flex items-center justify-between gap-4">
      <Label htmlFor={id} className="flex-col items-start gap-0.5">
        <span>Avisar a equipe sobre chamados</span>
        <span className="text-xs font-normal text-muted-foreground">
          {value ? "Ativado" : "Desativado"}
        </span>
      </Label>
      <Switch
        id={id}
        checked={value}
        disabled={pending}
        onCheckedChange={(next) =>
          start(async () => {
            const form = new FormData();
            form.set("enabled", String(next));
            const result = await setTicketNotifications({}, form);
            if (result.error) toast.error(result.error);
            else {
              setValue(next);
              toast.success(result.success ?? "Preferências atualizadas.");
              router.refresh();
            }
          })
        }
      />
    </div>
  );
}
