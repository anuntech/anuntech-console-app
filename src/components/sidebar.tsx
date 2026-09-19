"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Layers3,
  MessagesSquare,
  ReceiptText,
  Settings2,
} from "lucide-react";
const items = [
  { href: "/painel", label: "Visão geral", icon: LayoutDashboard },
  { href: "/empresas", label: "Empresas", icon: Building2, admin: true },
  { href: "/produtos", label: "Produtos e projetos", icon: Layers3 },
  {
    href: "/chamados",
    label: "Chamados",
    icon: MessagesSquare,
    area: "support",
  },
  {
    href: "/financeiro",
    label: "Financeiro",
    icon: ReceiptText,
    area: "finance",
  },
  {
    href: "/configuracoes",
    label: "Configurações",
    icon: Settings2,
    admin: true,
  },
];
export function Sidebar({
  admin,
  support,
  finance,
}: {
  admin: boolean;
  support: boolean;
  finance: boolean;
}) {
  const path = usePathname();
  return (
    <nav aria-label="Navegação principal">
      {items
        .filter(
          (i) =>
            (!i.admin || admin) &&
            (!i.area || (i.area === "support" ? support : finance) || admin),
        )
        .map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={
              path === i.href || path.startsWith(i.href + "/")
                ? "nav-link active"
                : "nav-link"
            }
            aria-current={
              path === i.href || path.startsWith(i.href + "/")
                ? "page"
                : undefined
            }
          >
            <i.icon size={19} strokeWidth={1.6} />
            {i.label}
          </Link>
        ))}
    </nav>
  );
}
