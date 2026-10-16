import {
  BookmarkIcon,
  CalculatorIcon,
  Clock3Icon,
  FolderKanbanIcon,
  HeadsetIcon,
  PackageIcon,
  PenLineIcon,
  ReceiptTextIcon,
  RocketIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UserRoundIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import type { HelpCategoryId } from "@/lib/help/help-model";

/** The same glyphs as the dock where an area has one. */
export const CATEGORY_ICONS: Record<HelpCategoryId, LucideIcon> = {
  comecar: RocketIcon,
  conta: UserRoundIcon,
  chamados: HeadsetIcon,
  projetos: FolderKanbanIcon,
  produtos: PackageIcon,
  financeiro: ReceiptTextIcon,
  orcamentos: CalculatorIcon,
  contratos: PenLineIcon,
  condicoes: Clock3Icon,
  pessoas: UsersIcon,
  bookmarks: BookmarkIcon,
  assistente: SparklesIcon,
  seguranca: ShieldCheckIcon,
};

export function CategoryTile({ id, className }: { id: HelpCategoryId; className?: string }) {
  const Icon = CATEGORY_ICONS[id];
  return (
    <span aria-hidden="true" className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary [&_svg]:size-[18px]", className)}>
      <Icon />
    </span>
  );
}
