import Link from "next/link";
export { Field } from "./field";
import {
  ArrowLeft,
  ArrowUpRight,
  Plus,
  Inbox,
  type LucideIcon,
} from "lucide-react";
export function Heading({
  eyebrow,
  title,
  description,
  action,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: { label: string; href: string };
  children?: React.ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
        {children}
      </div>
      {action && (
        <Link className="button primary" href={action.href}>
          {/nov|cadastr|abrir|criar|adicionar/i.test(action.label) ? (
            <>
              <Plus size={16} aria-hidden="true" />
              {action.label}
            </>
          ) : (
            <>
              {action.label}
              <ArrowUpRight size={16} aria-hidden="true" />
            </>
          )}
        </Link>
      )}
    </header>
  );
}
export function Empty({
  title,
  description,
  icon: Icon = Inbox,
  action,
  headingLevel = 2,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: { label: string; href: string };
  headingLevel?: 2 | 3;
}) {
  const Title = headingLevel === 3 ? "h3" : "h2";
  return (
    <div className="empty" data-slot="empty">
      <span className="empty-icon" data-slot="empty-icon">
        <Icon size={24} strokeWidth={1.7} aria-hidden="true" />
      </span>
      <Title>{title}</Title>
      <p>{description}</p>
      {action && (
        <Link className="button" href={action.href}>
          {action.label}
          <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}
export function Badge({
  children,
  status = "",
}: {
  children: React.ReactNode;
  status?: string;
}) {
  return (
    <span data-slot="badge" className={`badge status-${status}`}>
      <span className="badge-dot" aria-hidden="true" />
      {children}
    </span>
  );
}
export function Back({ href, label }: { href: string; label: string }) {
  return (
    <Link className="back" href={href}>
      <ArrowLeft size={15} aria-hidden="true" /> {label}
    </Link>
  );
}
