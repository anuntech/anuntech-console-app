import type { ReactNode } from "react";
import {
  BellIcon,
  Building2Icon,
  EraserIcon,
  PaletteIcon,
  FileSignatureIcon,
  PackageIcon,
  PlugZapIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UserRoundIcon,
  UsersIcon,
  WorkflowIcon,
} from "lucide-react";
import { getActor } from "@/lib/access/access";
import { canManageMembers } from "@/lib/access/member-access";
import { PageHeader } from "@/components/console/page-header";
import {
  SettingsNav,
  type SettingsGroup,
  type SettingsSection,
} from "./settings-nav";

/**
 * Every settings page shares this frame: a breadcrumb back to the account,
 * the section title with the section's create action on the right, the
 * rail of categories the viewer may open, and the section's cards. Sections
 * guard their own data access.
 */
export async function SettingsShell({
  section,
  title,
  description,
  actions,
  children,
}: {
  section: SettingsSection;
  title: string;
  description?: ReactNode;
  /** The section's create button, beside the title like every list page. */
  actions?: ReactNode;
  children: ReactNode;
}) {
  const actor = await getActor();
  const manager = canManageMembers(actor);
  const groups: SettingsGroup[] = [
    {
      title: "Conta",
      items: [
        { key: "account", href: "/conta", label: "Minha conta", icon: <UserRoundIcon /> },
        {
          key: "security",
          href: "/configuracoes/seguranca",
          label: "Segurança",
          icon: <ShieldCheckIcon />,
        },
        {
          key: "appearance",
          href: "/configuracoes/aparencia",
          label: "Aparência",
          icon: <PaletteIcon />,
        },
      ],
    },
    ...(manager
      ? [
          {
            title: actor.admin ? "Anuntech" : "Empresa",
            items: [
              {
                key: "company" as const,
                href: "/configuracoes/empresa",
                label: "Dados da empresa",
                icon: <Building2Icon />,
              },
              {
                key: "members" as const,
                href: "/configuracoes/membros",
                label: "Membros",
                icon: <UsersIcon />,
              },
              {
                key: "notifications" as const,
                href: "/configuracoes/notificacoes",
                label: "Notificações",
                icon: <BellIcon />,
              },
            ],
          },
        ]
      : []),
    ...(actor.admin
      ? [
          {
            title: "Console",
            items: [
              {
                key: "catalog" as const,
                href: "/configuracoes/catalogo",
                label: "Catálogo",
                icon: <PackageIcon />,
              },
              {
                key: "contracts" as const,
                href: "/configuracoes/contratos",
                label: "Modelos de contrato",
                icon: <FileSignatureIcon />,
              },
              {
                key: "integrations" as const,
                href: "/configuracoes/integracoes",
                label: "Integrações",
                icon: <PlugZapIcon />,
              },
              {
                key: "automations" as const,
                href: "/configuracoes/automacoes",
                label: "Automações",
                icon: <WorkflowIcon />,
              },
              {
                key: "cleanup" as const,
                href: "/configuracoes/limpeza",
                label: "Limpeza",
                icon: <EraserIcon />,
              },
              {
                key: "assistant" as const,
                href: "/configuracoes/assistente",
                label: "Assistente",
                icon: <SparklesIcon />,
              },
            ],
          },
        ]
      : []),
  ];
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Configurações", href: "/conta" }, { label: title }]}
        title={title}
        description={description}
        actions={actions}
      />
      <div className="grid gap-6 lg:grid-cols-[208px_minmax(0,1fr)] lg:items-start">
        <aside className="lg:sticky lg:top-6">
          <SettingsNav groups={groups} />
        </aside>
        <div
          data-preference-content={section}
          className="flex min-w-0 flex-col gap-6"
        >
          {children}
        </div>
      </div>
    </>
  );
}
