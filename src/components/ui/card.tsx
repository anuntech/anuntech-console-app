import type { ComponentProps } from "react";

// shadcn.io Card composition, styled with the Console's shared design tokens.
export function Card({ className = "", ...props }: ComponentProps<"section">) {
  return (
    <section data-slot="card" className={`panel ${className}`} {...props} />
  );
}
export function CardHeader({
  className = "",
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={`panel-heading ${className}`}
      {...props}
    />
  );
}
export function CardTitle({ className = "", ...props }: ComponentProps<"h2">) {
  return <h2 data-slot="card-title" className={className} {...props} />;
}
export function CardDescription({
  className = "",
  ...props
}: ComponentProps<"p">) {
  return (
    <p
      data-slot="card-description"
      className={`muted ${className}`}
      {...props}
    />
  );
}
export function CardContent({
  className = "",
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={`padded ${className}`}
      {...props}
    />
  );
}
