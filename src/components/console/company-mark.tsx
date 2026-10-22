import { cn } from "@/lib/cn";
import { companyNameInitials } from "@/lib/companies/display-name";

/** Two initials, the way the companies table names a client without a logo; numbers and "de", "da"… do not count. */
export const companyInitials = companyNameInitials;

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
