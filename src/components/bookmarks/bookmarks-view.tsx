"use client";
import { SearchField } from "@/components/console/search-field";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import {
  BookmarkIcon,
  FileIcon,
  FolderIcon,
  FolderInputIcon,
  FolderPlusIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Share2Icon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState, PageHeader } from "@/components/console/page-header";
import { DownloadLink } from "@/components/console/download-link";
import { ConfirmDialog, ServerForm } from "@/components/console/server-form";
import { AvatarStack } from "@/components/console/person-avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { moveBookmark, deleteBookmark } from "@/lib/bookmark-actions";
import type { BookmarkQuery, BookmarkView, FolderView } from "@/lib/bookmarks";
import { BookmarkSheet, type BookmarkEditor } from "./bookmark-sheet";
import { FolderDialogs, type CompanyOption, type FolderEditor } from "./folder-dialogs";

export type BookmarksViewData = {
  folders: FolderView[];
  items: BookmarkView[];
  query: BookmarkQuery;
  counts: { root: number; total: number };
  /** Companies the viewer can file under; id "" is Anuntech's own space (staff). */
  companies: CompanyOption[];
  viewer: { id: string; admin: boolean };
};

const tones = [
  "bg-accent text-primary",
  "bg-success-soft text-success",
  "bg-warning-soft text-warning",
  "bg-destructive-soft text-destructive",
  "bg-secondary text-foreground",
];
function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
/** A letter tile stands in for the favicon, without calling anyone. */
function Tile({ item }: { item: BookmarkView }) {
  if (!item.url)
    return (
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
        <FileIcon className="size-4" />
      </span>
    );
  const host = hostOf(item.url);
  let hash = 0;
  for (const char of host) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold uppercase",
        tones[hash % tones.length],
      )}
    >
      {host.replace(/^[^a-z0-9]+/i, "").charAt(0) || "•"}
    </span>
  );
}

function href(query: BookmarkQuery, patch: Partial<BookmarkQuery>) {
  const next = { ...query, ...patch };
  const params = new URLSearchParams();
  if (next.company !== "all") params.set("empresa", next.company);
  if (next.folder !== "all") params.set("pasta", next.folder);
  if (next.search) params.set("q", next.search);
  return `/bookmarks${params.size ? `?${params}` : ""}`;
}

/** Moves through one hidden form so the row menu stays a menu. */
function useBookmarkMove() {
  const formRef = useRef<HTMLFormElement>(null);
  const [move, setMove] = useState({ id: "", folderId: "" });
  const submit = (id: string, folderId: string) =>
    setTimeout(() => {
      flushSync(() => setMove({ id, folderId }));
      formRef.current?.requestSubmit();
    }, 0);
  const form = (
    <ServerForm ref={formRef} action={moveBookmark}>
      <input type="hidden" name="id" value={move.id} />
      <input type="hidden" name="folderId" value={move.folderId} />
    </ServerForm>
  );
  return { submit, form };
}

function NavItem({
  active,
  href: to,
  icon,
  label,
  count,
  hint,
  menu,
}: {
  active: boolean;
  href: string;
  icon: ReactNode;
  label: string;
  count?: number;
  hint?: string;
  menu?: ReactNode;
}) {
  return (
    <li className="group/nav relative">
      <Link
        href={to}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
          active
            ? "bg-accent font-medium text-primary"
            : "text-foreground hover:bg-secondary",
          menu && "pr-9",
        )}
      >
        <span className="shrink-0 text-muted-foreground [&_svg]:size-4">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate">{label}</span>
          {hint && <span className="block truncate text-xs text-muted-foreground">{hint}</span>}
        </span>
        {typeof count === "number" && (
          <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
        )}
      </Link>
      {menu && (
        <span className="absolute top-1/2 right-1 -translate-y-1/2 opacity-0 transition-opacity group-hover/nav:opacity-100 focus-within:opacity-100 data-[state=open]:opacity-100">
          {menu}
        </span>
      )}
    </li>
  );
}

export function BookmarksView({ data }: { data: BookmarksViewData }) {
  const { folders, items, query, counts, companies, viewer } = data;
  const router = useRouter();
  const [editor, setEditor] = useState<BookmarkEditor | null>(null);
  const [folderEditor, setFolderEditor] = useState<FolderEditor | null>(null);
  const [removing, setRemoving] = useState<BookmarkView | null>(null);
  const { submit: move, form: moveForm } = useBookmarkMove();
  const folderById = new Map(folders.map((folder) => [folder.id, folder]));
  const companyName = new Map(companies.map((company) => [company.id, company.name]));
  const current = folderById.get(query.folder);
  const manyCompanies = companies.length > 1;
  const showCompany = manyCompanies && query.company === "all";
  const manages = (folder: FolderView) => viewer.admin || folder.ownerId === viewer.id;
  const canEdit = (item: BookmarkView) =>
    viewer.admin ||
    item.ownerId === viewer.id ||
    (item.folderId ? folderById.get(item.folderId)?.ownerId === viewer.id : false);
  const createIn = query.folder !== "all" && query.folder !== "root" ? query.folder : "";
  // A new item lands in the company being looked at, or the folder's company.
  const createCompany = current
    ? (current.companyId ?? "")
    : query.company === "internal"
      ? ""
      : query.company !== "all"
        ? query.company
        : (companies[0]?.id ?? "");
  const later = (fn: () => void) => setTimeout(fn, 0);
  const companyPicker = manyCompanies && (
    <Select
      value={query.company}
      onValueChange={(company) => router.push(href(query, { company, folder: "all" }), { scroll: false })}
    >
      <SelectTrigger aria-label="Empresa" className="w-full bg-card">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todas as empresas</SelectItem>
        {companies.map((company) => (
          <SelectItem key={company.id || "internal"} value={company.id || "internal"}>
            {company.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const folderMenu = (folder: FolderView) => (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-xs" aria-label={`Ações da pasta ${folder.name}`}>
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onSelect={() => later(() => setFolderEditor({ mode: "rename", folder }))}>
          <PencilIcon />
          Renomear
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => later(() => setFolderEditor({ mode: "share", folder }))}>
          <Share2Icon />
          Compartilhar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => later(() => setFolderEditor({ mode: "delete", folder }))}
        >
          <Trash2Icon />
          Excluir pasta
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const list = (
    <ul className="divide-y rounded-xl border bg-card shadow-card">
      {items.map((item) => {
        const folder = item.folderId ? folderById.get(item.folderId) : undefined;
        const meta = [
          item.url ? hostOf(item.url) : item.fileName,
          query.folder === "all" && folder ? folder.name : null,
          showCompany ? (companyName.get(item.companyId ?? "") ?? null) : null,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <li key={item.id} className="flex items-center gap-3 px-3 py-2">
            <Tile item={item} />
            <div className="min-w-0 flex-1">
              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-sm font-medium text-foreground hover:text-primary"
                >
                  {item.title}
                </a>
              ) : (
                <DownloadLink
                  href={`/api/bookmarks/${item.id}`}
                  filename={item.fileName ?? item.title}
                  className="block truncate text-sm font-medium text-foreground hover:text-primary"
                >
                  {item.title}
                </DownloadLink>
              )}
              <p className="truncate text-xs text-muted-foreground">{meta}</p>
            </div>
            {canEdit(item) && (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground"
                    aria-label={`Ações de ${item.title}`}
                  >
                    <MoreHorizontalIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onSelect={() => later(() => setEditor({ mode: "edit", item }))}>
                    <PencilIcon />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <FolderInputIcon />
                      Mover para
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-52">
                      <DropdownMenuItem
                        disabled={!item.folderId}
                        onSelect={() => move(item.id, "")}
                      >
                        Sem pasta
                      </DropdownMenuItem>
                      {folders
                        .filter((folder) => (folder.companyId ?? "") === (item.companyId ?? ""))
                        .map((folder) => (
                        <DropdownMenuItem
                          key={folder.id}
                          disabled={folder.id === item.folderId}
                          onSelect={() => move(item.id, folder.id)}
                        >
                          <FolderIcon />
                          <span className="truncate">{folder.name}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => later(() => setRemoving(item))}
                  >
                    <Trash2Icon />
                    Remover
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      <PageHeader
        title={current ? current.name : query.folder === "root" ? "Sem pasta" : "Bookmarks"}
        count={items.length}
        description={
          current ? (
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {manyCompanies && <span>{companyName.get(current.companyId ?? "")}</span>}
              {manyCompanies && <span aria-hidden="true">·</span>}
              {current.visibility === "people" ? (
                <span className="flex items-center gap-2">
                  {current.sharedWith.length > 0 && (
                    <AvatarStack people={current.sharedWith} size={20} />
                  )}
                  {current.sharedWith.length
                    ? `Só ${current.owner} e ${current.sharedWith.length} ${current.sharedWith.length === 1 ? "pessoa" : "pessoas"}`
                    : `Só ${current.ownerId === viewer.id ? "você" : current.owner}`}
                </span>
              ) : (
                <span>Todos da empresa</span>
              )}
            </span>
          ) : undefined
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setFolderEditor({ mode: "create" })}>
              <FolderPlusIcon />
              Nova pasta
            </Button>
            <Button
              onClick={() =>
                setEditor({ mode: "create", companyId: createCompany, folderId: createIn })
              }
            >
              <PlusIcon />
              Adicionar
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[232px_minmax(0,1fr)] lg:items-start">
        <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
          {companyPicker}
          <div className="lg:hidden">
            <NativeSelect
              aria-label="Pasta"
              value={query.folder}
              onChange={(event) =>
                router.push(href(query, { folder: event.target.value }), { scroll: false })
              }
              className="bg-card"
            >
              <NativeSelectOption value="all">Todos os bookmarks</NativeSelectOption>
              <NativeSelectOption value="root">Sem pasta</NativeSelectOption>
              {folders.length > 0 && (
                <NativeSelectOptGroup label="Pastas">
                  {folders.map((folder) => (
                    <NativeSelectOption key={folder.id} value={folder.id}>
                      {folder.name}
                      {showCompany ? ` · ${companyName.get(folder.companyId ?? "") ?? ""}` : ""}
                    </NativeSelectOption>
                  ))}
                </NativeSelectOptGroup>
              )}
            </NativeSelect>
          </div>
          <nav aria-label="Pastas" className="hidden lg:block">
            <ul className="flex flex-col gap-0.5">
              <NavItem
                active={query.folder === "all"}
                href={href(query, { folder: "all" })}
                icon={<BookmarkIcon />}
                label="Todos"
                count={counts.total}
              />
              <NavItem
                active={query.folder === "root"}
                href={href(query, { folder: "root" })}
                icon={<FolderIcon className="opacity-60" />}
                label="Sem pasta"
                count={counts.root}
              />
            </ul>
            <p className="mt-5 mb-1.5 px-2.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Pastas
            </p>
            <ul className="flex flex-col gap-0.5">
              {folders.map((folder) => (
                <NavItem
                  key={folder.id}
                  active={query.folder === folder.id}
                  href={href(query, { folder: folder.id })}
                  icon={folder.visibility === "people" ? <UsersIcon /> : <FolderIcon />}
                  label={folder.name}
                  hint={showCompany ? companyName.get(folder.companyId ?? "") : undefined}
                  count={folder.count}
                  menu={manages(folder) ? folderMenu(folder) : undefined}
                />
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => setFolderEditor({ mode: "create" })}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <FolderPlusIcon className="size-4" />
                  Nova pasta
                </button>
              </li>
            </ul>
          </nav>
        </aside>

        <div className="min-w-0">
          <SearchField
            value={query.search}
            onChange={(search) => router.push(href(query, { search }), { scroll: false })}
            placeholder={"Buscar por título ou link"}
          />
          {items.length ? (
            list
          ) : (
            <section className="rounded-xl border bg-card shadow-card">
              <EmptyState
                icon={<BookmarkIcon />}
                title={query.search ? "Nada encontrado" : "Nenhum bookmark aqui"}
                description={
                  query.search
                    ? "Tente outro termo."
                    : "Guarde links e arquivos pequenos da empresa e organize em pastas."
                }
                action={
                  query.search ? (
                    <Button variant="outline" asChild>
                      <Link href={href(query, { search: "" })}>Limpar busca</Link>
                    </Button>
                  ) : (
                    <Button
                      onClick={() =>
                        setEditor({ mode: "create", companyId: createCompany, folderId: createIn })
                      }
                    >
                      <PlusIcon />
                      Adicionar
                    </Button>
                  )
                }
              />
            </section>
          )}
        </div>
      </div>

      <BookmarkSheet
        editor={editor}
        onClose={() => setEditor(null)}
        folders={folders}
        companies={companies}
      />
      <FolderDialogs
        editor={folderEditor}
        onClose={() => setFolderEditor(null)}
        companies={companies}
        defaultCompany={createCompany}
      />
      {removing && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setRemoving(null)}
          action={deleteBookmark}
          fields={{ id: removing.id }}
          title="Remover bookmark?"
          description={`"${removing.title}" sai da lista. Isso não pode ser desfeito.`}
          confirmLabel="Remover"
          destructive
          onSuccess={() => setRemoving(null)}
        />
      )}
      {moveForm}
    </>
  );
}
