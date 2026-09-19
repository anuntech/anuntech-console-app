import Link from "next/link";
import { ArrowUpRight, Inbox } from "lucide-react";
export function Heading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {action && (
        <Link className="button primary" href={action.href}>
          {action.label}
          <ArrowUpRight size={16} />
        </Link>
      )}
    </div>
  );
}
export function Empty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="empty">
      <Inbox size={28} strokeWidth={1.4} />
      <h3>{title}</h3>
      <p>{description}</p>
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
  return <span className={`badge status-${status}`}>{children}</span>;
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Back({ href, label }: { href: string; label: string }) {
  return (
    <Link className="back" href={href}>
      ← {label}
    </Link>
  );
}
