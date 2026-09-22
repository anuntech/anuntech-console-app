"use client";
import type { ComponentProps } from "react";
import { FormModal } from "@/components/form-modal";
import { useShowInvited } from "./member-tabs";

/** An invite lands in the "Convidados" tab, so open it instead of leaving the
    admin on a members list that looks unchanged. */
export function MemberInviteModal(props: ComponentProps<typeof FormModal>) {
  const showInvited = useShowInvited();
  return <FormModal {...props} onSuccess={showInvited ?? undefined} />;
}
