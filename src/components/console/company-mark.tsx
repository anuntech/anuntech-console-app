import { cn } from "cn";

/** Two initials, the way the companies table names a client without a logo. */
export function companyInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] || "") + (words[1]?.[0] || "")).toUpperCase() || "•";
}

/** A small square with the company's initials, used wherever a company is listed. */
export function CompanyMark({
  name,
  size = 28,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.36)) }}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md bg-accent font-semibold tracking-tight text-primary",
        className,
      )}
    >
      {companyInitials(name)}
    </span>
  );
}
