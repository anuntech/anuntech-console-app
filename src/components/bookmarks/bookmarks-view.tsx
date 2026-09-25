"use client";
import { SearchField } from "@/components/console/search-field";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import {
  BookmarkIcon,
  ExternalLinkIcon,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { CompanyField } from "@/components/console/company-field";
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
import { downloadFile } from "@/components/console/download-link";
import {
  CompanyCell,
  DownloadMenuItem,
  LinkRow,
  ListCard,
  ListPagination,
  PrimaryCell,
  RowActions,
} from "@/components/console/list-view";
import { ConfirmDialog, ServerForm } from "@/components/console/server-form";
import { AvatarStack } from "@/components/console/person-avatar";
import { moveBookmark, deleteBookmark } from "@/lib/bookmark-actions";
import type { BookmarkQuery, BookmarkView, FolderView } from "@/lib/bookmarks";
import { dateTimeLabel, fileSizeLabel, relativeLabel } from "@/lib/format";
import { DEFAULT_PAGE_SIZE, listHref, setPageParams, type PageQuery } from "@/lib/list-query";
import { BookmarkSheet, type BookmarkEditor } from "./bookmark-sheet";
import { FolderDialogs, type CompanyOption, type FolderEditor } from "./folder-dialogs";

export type BookmarksViewData = {
  folders: FolderView[];
  items: BookmarkView[];
  query: BookmarkQuery;
  counts: { root: number; total: number };
  /**
   * The page shown; `total` is what the folder and the search leave. Optional
   * so fixtures without it still type: they show `items` as a single page.
   */
  paging?: { page: number; pageSize: number; total: number; pageCount: number };
  /** ISO instant the page was rendered at, so relative times hydrate equal. */
  now?: string;
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

type ListState = BookmarkQuery & PageQuery;

/** Changing the folder, the company or the search starts over at page 1; the page size stays. */
function href(state: ListState, patch: Partial<ListState>) {
  const next = { ...state, page: 1, ...patch };
  const params = new URLSearchParams();
  if (next.company !== "all") params.set("empresa", next.company);
  if (next.folder !== "all") params.set("pasta", next.folder);
  if (next.search) params.set("q", next.search);
  setPageParams(params, next);
  return listHref("/bookmarks", params);
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
  const { folders, items, query, counts, now, companies, viewer } = data;
  const paging = data.paging ?? { page: 1, pageSize: DEFAULT_PAGE_SIZE, total: items.length, pageCount: 1 };
  const router = useRouter();
  const state: ListState = { ...query, page: paging.page, pageSize: paging.pageSize };
  const go = (patch: Partial<ListState>) => router.push(href(state, patch), { scroll: false });
  const [editor, setEditor] = useState<BookmarkEditor | null>(null);
  const [folderEditor, setFolderEditor] = useState<FolderEditor | null>(null);
  const [removing, setRemoving] = useState<BookmarkView | null>(null);
  const { submit: move, form: moveForm } = useBookmarkMove();
  const folderById = new Map(folders.map((folder) => [folder.id, folder]));
  const companyName = new Map(companies.map((company) => [company.id, company.name]));
  const current = folderById.get(query.folder);
  const manyCompanies = companies.length > 1;
  const showCompany = manyCompanies && query.company === "all";
  // Staff get the company as its own column while the list spans companies; a
  // member of several companies keeps it in the subtitle.
  const companyColumn = viewer.admin && showCompany;
  const folderColumn = query.folder === "all";
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
    <CompanyField
      aria-label="Empresa"
      companies={companies.map((company) => ({ ...company, id: company.id || "internal" }))}
      allOption={{ id: "all", label: "Todas as empresas" }}
      value={query.company}
      onChange={(company) => go({ company, folder: "all" })}
      className="bg-card"
    />
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

  const table = (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="pl-4">Bookmark</TableHead>
          {folderColumn && <TableHead className="hidden md:table-cell">Pasta</TableHead>}
          {companyColumn && <TableHead className="hidden md:table-cell">Empresa</TableHead>}
          <TableHead className="hidden md:table-cell">Adicionado</TableHead>
          <TableHead className="w-12 pr-3">
            <span className="sr-only">Ações</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => {
          const folder = item.folderId ? folderById.get(item.folderId) : undefined;
          const company = companyName.get(item.companyId ?? "") ?? null;
          const subtitle = [
            item.url ? hostOf(item.url) : item.fileName,
            !item.url && item.fileSize ? fileSizeLabel(item.fileSize) : null,
            showCompany && !companyColumn ? company : null,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <LinkRow
              key={item.id}
              href={item.url}
              external
              onOpen={item.url ? undefined : () => void downloadFile(`/api/bookmarks/${item.id}`, item.fileName ?? item.title)}
            >
              <PrimaryCell
                href={item.url}
                external
                onOpen={item.url ? undefined : () => void downloadFile(`/api/bookmarks/${item.id}`, item.fileName ?? item.title)}
                leading={<Tile item={item} />}
                title={item.title}
                subtitle={subtitle || undefined}
              />
              {folderColumn && (
                <TableCell className="hidden max-w-[14rem] md:table-cell">
                  <span className={cn("block truncate", folder ? "text-foreground" : "text-muted-foreground")}>
                    {folder ? folder.name : "Sem pasta"}
                  </span>
                </TableCell>
              )}
              {companyColumn && (
                <CompanyCell>{company ?? "—"}</CompanyCell>
              )}
              <TableCell className="hidden whitespace-nowrap text-muted-foreground md:table-cell">
                <time dateTime={item.createdAt} title={dateTimeLabel(item.createdAt)}>
                  {relativeLabel(item.createdAt, now)}
                </time>
              </TableCell>
              <RowActions label={item.title}>
                {item.url ? (
                  <DropdownMenuItem asChild>
                    <a href={item.url} target="_blank" rel="noopener noreferrer">
                      <ExternalLinkIcon />
                      Abrir link
                    </a>
                  </DropdownMenuItem>
                ) : (
                  <DownloadMenuItem href={`/api/bookmarks/${item.id}`} filename={item.fileName ?? item.title}>
                    Baixar arquivo
                  </DownloadMenuItem>
                )}
                {canEdit(item) && (
                  <>
                    <DropdownMenuSeparator />
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
                        <DropdownMenuItem disabled={!item.folderId} onSelect={() => move(item.id, "")}>
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
                    <DropdownMenuItem variant="destructive" onSelect={() => later(() => setRemoving(item))}>
                      <Trash2Icon />
                      Excluir
                    </DropdownMenuItem>
                  </>
                )}
              </RowActions>
            </LinkRow>
          );
        })}
      </TableBody>
    </Table>
  );

  return (
    <>
      <PageHeader
        title={current ? current.name : query.folder === "root" ? "Sem pasta" : "Bookmarks"}
        count={paging.total}
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
              onChange={(event) => go({ folder: event.target.value })}
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
                href={href(state, { folder: "all" })}
                icon={<BookmarkIcon />}
                label="Todos"
                count={counts.total}
              />
              <NavItem
                active={query.folder === "root"}
                href={href(state, { folder: "root" })}
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
                  href={href(state, { folder: folder.id })}
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

        <ListCard
          label="Lista de bookmarks"
          className="min-w-0"
          toolbar={
            <SearchField
              value={query.search}
              onChange={(search) => go({ search })}
              placeholder="Buscar por título ou link"
            />
          }
          footer={
            <ListPagination
              page={paging.page}
              pageSize={paging.pageSize}
              total={paging.total}
              pageCount={paging.pageCount}
              noun={["bookmark", "bookmarks"]}
              hrefFor={(patch) => href(state, patch)}
            />
          }
        >
          {items.length ? (
            table
          ) : (
            <EmptyState
              icon={<BookmarkIcon />}
              title={query.search ? "Nenhum bookmark encontrado" : "Nenhum bookmark aqui"}
              description={
                query.search
                  ? "Tente outro termo ou mude os filtros."
                  : "Guarde links e arquivos pequenos da empresa e organize em pastas."
              }
              action={
                query.search ? (
                  // The folder and the company are where the person is (the rail
                  // shows it); only the search is a filter here.
                  <Button variant="outline" asChild>
                    <Link href={href(state, { search: "" })} scroll={false}>
                      Limpar filtros
                    </Link>
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
          )}
        </ListCard>
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
          title="Excluir bookmark?"
          description={`"${removing.title}" sai da lista${removing.fileName ? ", com o arquivo" : ""}. Isso não pode ser desfeito.`}
          confirmLabel="Excluir"
          destructive
          onSuccess={() => setRemoving(null)}
        />
      )}
      {moveForm}
    </>
  );
}
