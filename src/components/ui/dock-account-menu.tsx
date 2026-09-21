"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { UserRound, Palette, Users, LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { isCatalogAvatar } from "@/lib/avatar-catalog";
import { IllustratedAvatar } from "@/components/preferences/illustrated-avatar";
import { profileAvatarSource } from "@/components/preferences/profile-avatar";
import { useAppearance } from "@/components/appearance-provider";
import { toast } from "@/components/notifications";
import styles from "./bottom-menu.module.css";

export function DockAccountMenu({ name, image, canManageMembers }: {
  name: string;
  image: string | null;
  canManageMembers: boolean;
}) {
  const router = useRouter();
  const { position } = useAppearance();
  const [pending, setPending] = useState(false);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const navigating = useRef(false);
  const lock = useRef(false);
  const source = profileAvatarSource(image);
  const initials = name.trim().split(/\s+/).filter((_, i, parts) => i === 0 || i === parts.length - 1).map(part => part[0]).join("").toLocaleUpperCase("pt-BR");
  return <Menu.Root modal={false} onOpenChange={open => { if (open) navigating.current = false; }}>
    <Menu.Trigger id="console-menu-trigger" className={`${styles.link} ${styles.accountTrigger}`} aria-label="Menu da conta" title={name}>
      <span className={styles.accountAvatar} aria-hidden="true">
        {source && isCatalogAvatar(image) ? <IllustratedAvatar image={source} size={34} /> : source && failedSource !== source ?
          <Image src={source} alt="" width={34} height={34} unoptimized onError={() => setFailedSource(source)} /> : initials || <UserRound size={22} />}
      </span>
    </Menu.Trigger>
    <Menu.Portal>
      <Menu.Content className={`${styles.panel} ${styles.accountPanel}`} side={position === "top" ? "bottom" : position === "left" ? "right" : position === "right" ? "left" : "top"} align="end" sideOffset={12} collisionPadding={12}
        onCloseAutoFocus={event => { if (navigating.current) event.preventDefault(); }}>
        <Menu.Label className={styles.accountLabel}>{name}</Menu.Label>
        {[
          { href: "/conta", label: "Meu perfil", icon: UserRound, allowed: true },
          { href: "/configuracoes/aparencia", label: "Aparência", icon: Palette, allowed: true },
          { href: "/configuracoes/membros", label: "Membros", icon: Users, allowed: canManageMembers },
        ].filter(item => item.allowed).map(({href, label, icon: Icon}) =>
          <Menu.Item key={href} asChild disabled={pending} onSelect={() => { navigating.current = true; }}>
            <Link href={href} className={styles.panelLink}><Icon size={18} aria-hidden="true" />{label}</Link>
          </Menu.Item>)}
        <Menu.Separator className={styles.accountSeparator} />
        <Menu.Item className={`${styles.panelLink} ${styles.accountSignOut}`} disabled={pending} onSelect={async event => {
          event.preventDefault();
          if (lock.current) return;
          lock.current = true;
          setPending(true);
          try {
            const result = await authClient.signOut();
            if (result.error) throw Error();
            navigating.current = true;
            router.replace("/entrar");
            router.refresh();
          } catch {
            toast.error("Não foi possível sair. Tente novamente.");
            setPending(false);
            lock.current = false;
          }
        }}>
          <LogOut size={18} aria-hidden="true" />{pending ? "Saindo…" : "Sair"}
        </Menu.Item>
      </Menu.Content>
    </Menu.Portal>
  </Menu.Root>;
}
