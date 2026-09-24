"use client";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ServerForm } from "@/components/console/server-form";
import { updateEngagement } from "@/lib/actions";

export type EngagementStatus = "active" | "paused" | "completed";

/** Pause, resume or finish a project or product from a menu, through one hidden form. */
export function useEngagementStatus() {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState({ id: "", status: "" });
  const change = (id: string, status: EngagementStatus) =>
    setTimeout(() => {
      flushSync(() => setPending({ id, status }));
      formRef.current?.requestSubmit();
    }, 0);
  const form = (
    <ServerForm ref={formRef} action={updateEngagement}>
      <input type="hidden" name="id" value={pending.id} />
      <input type="hidden" name="status" value={pending.status} />
    </ServerForm>
  );
  return { change, form };
}
