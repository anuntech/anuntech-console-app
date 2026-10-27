"use client";
import { SearchField } from "@/components/console/search-field";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Fragment, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import {
  BookmarkIcon,
  ChevronRightIcon,
  ClockIcon,
  CopyIcon,
  InfoIcon,
  Link2Icon,
  StarIcon,
  TypeIcon,
  DownloadIcon,
  ExternalLinkIcon,
  EyeIcon,
  FolderIcon,
  FolderInputIcon,
  FolderPlusIcon,
  InboxIcon,
  LinkIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  PresentationIcon,
  Share2Icon,
  RotateCcwIcon,
  Trash2Icon,
  UsersIcon,
} from "lucide-react";
import { TRASH_DAYS, trashDaysLeft } from "@/lib/drive/drive-rules";
import { excerptPieces } from "@/lib/drive/text-excerpt";
import { KIND_FILTERS, SORTS, type KindFilter, type SortOrder } from "@/lib/bookmarks/list-filters";
import { Checkbox } from "@/components/ui/checkbox";
import { ItemsDialog, type ItemsMove } from "./items-dialog";
import { FileCard, GROUP_ICONS, quickIcons } from "./file-card";
import { RenameDialog } from "./rename-dialog";
import { fileTypeOf } from "@/lib/bookmarks/file-types";
import { toast } from "@/components/shell/notifications";
import { tagLabels, type TagSlug } from "@/lib/drive/tag-rules";
import { folderPath, treeOrder } from "@/lib/bookmarks/folder-tree";
import { cn } from "@/lib/cn";
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
import {
  CompanyCell,
  LinkRow,
  ListCard,
  ListPagination,
  PrimaryCell,
  RowActions,
} from "@/components/console/list-view";
import { ConfirmDialog, ServerForm } from "@/components/console/server-form";
import { AvatarStack } from "@/components/console/person-avatar";
import { moveBookmark, moveBookmarks, deleteBookmark, purgeBookmark, restoreBookmark, toggleStar, trashBookmarks } from "@/lib/bookmarks/bookmark-actions";
import { boardHref, kindOf } from "@/lib/bookmarks/board-rules";
import type { BookmarkQuery, BookmarkView, FolderView } from "@/lib/bookmarks/bookmarks";
import type { ListLayout } from "@/lib/list-layout";
import { useListLayout, ViewToggle } from "@/components/console/list-grid";
import { dateTimeLabel, fileSizeLabel, relativeLabel } from "@/lib/format";
import { companyDisplayName } from "@/lib/companies/display-name";
import { DEFAULT_PAGE_SIZE, listHref, setPageParams, type PageQuery } from "@/lib/list-query";
import { letterTile, linkHost } from "@/lib/bookmarks/letter-tile";
import { BookmarkSheet, deleteNote, type BookmarkEditor } from "./bookmark-sheet";
import { useBulkUpload } from "./bulk-upload";
import { FilePreview, canPreview, downloadBookmark } from "./file-preview";
import { ShareLinkDialog, type ShareTarget } from "./share-link-dialog";
import { FolderDialogs, type CompanyOption, type FolderEditor } from "./folder-dialogs";

export type BookmarksViewData = {
  folders: FolderView[];
  items: BookmarkView[];
  query: BookmarkQuery;
  counts: { root: number; total: number; trash?: number; starred?: number };
  /**
   * The page shown; `total` is what the folder and the search leave. Optional
   * so fixtures without it still type: they show `items` as a single page.
   */
  paging?: { page: number; pageSize: number; total: number; pageCount: number };
  /** ISO instant the page was rendered at, so relative times hydrate equal. */
  now?: string;
  /** List or grid, as the viewer last chose (the page reads it from a cookie). */
  view?: ListLayout;
  /** Companies the viewer can file under; id "" is Anuntech's own space (staff). */
  companies: CompanyOption[];
  viewer: { id: string; admin: boolean };
  /** R2 is configured: files up to 100 GB go straight to the bucket (lib/drive). */
  largeFiles?: boolean;
  /** Used and total per space; quota null is Anuntech's own, without a limit. */
  spaces?: { companyId: string | null; used: number; quota: number | null; parts?: { media: number; documents: number; other: number } }[];
  /** An item to open on arrival (?abrir=, from "Copiar link"). */
  opened?: BookmarkView;
  /** The tags of what the folder shows, with how many items each, for the filter. */
  tags?: { tag: TagSlug; count: number }[];
};

/* Brand and neutrals only: green, amber and red mean a state elsewhere in the
   Console, and a link's letter is not one. */
const tones = [
  "bg-accent text-accent-foreground",
  "bg-secondary text-foreground",
  "border bg-card text-foreground",
];
/** A letter tile stands in for the favicon, without calling anyone. */
function Tile({ item, large = false }: { item: BookmarkView; large?: boolean }) {
  const size = large ? "size-10 rounded-lg" : "size-8 rounded-md";
  const kind = kindOf(item);
  if (kind === "board")
    return (
      <span className={cn("flex shrink-0 items-center justify-center bg-accent text-primary", size)}>
        <PresentationIcon className={large ? "size-5" : "size-4"} />
      </span>
    );
  if (!item.url) {
    const type = fileTypeOf(item.fileName);
    if (type.group === "image" && item.thumb)
      return (
        // The photo's small WebP (lib/drive/thumbnails.ts), through a short-lived signed address.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/bookmarks/${item.id}/miniatura`} alt="" loading="lazy" className={cn("shrink-0 border object-cover", size)} />
      );
    const Icon = GROUP_ICONS[type.group];
    return (
      <span className={cn("flex shrink-0 items-center justify-center bg-secondary text-muted-foreground", size)}>
        <Icon className={large ? "size-5" : "size-4"} />
      </span>
    );
  }
  const { letter, tone } = letterTile(item.url);
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center font-semibold uppercase",
        size,
        large ? "text-sm" : "text-xs",
        tones[tone],
      )}
    >
      {letter}
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
  if (next.tag) params.set("etiqueta", next.tag);
  if (next.kind) params.set("tipo", next.kind);
  if (next.sort) params.set("ordem", next.sort);
  if (next.mine) params.set("meus", "1");
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

/** Several items moved through one hidden form (by dragging them onto a folder). */
function useItemsAction(action: typeof moveBookmarks, onDone: () => void) {
  const formRef = useRef<HTMLFormElement>(null);
  const [batch, setBatch] = useState<{ ids: string[]; folderId: string }>({ ids: [], folderId: "" });
  const submit = (ids: string[], folderId = "") =>
    setTimeout(() => {
      flushSync(() => setBatch({ ids, folderId }));
      formRef.current?.requestSubmit();
    }, 0);
  const form = (
    <ServerForm ref={formRef} action={action} onSuccess={onDone}>
      {batch.ids.map((id) => (
        <input key={id} type="hidden" name="id" value={id} />
      ))}
      <input type="hidden" name="folderId" value={batch.folderId} />
    </ServerForm>
  );
  return { submit, form };
}

/** "Excluída há 3 dias · some em 27 dias", under an item in the trash. */
const trashNote = (deletedAt: string) => {
  const left = trashDaysLeft(deletedAt);
  return left === 0 ? "some hoje" : `some em ${left === 1 ? "1 dia" : `${left} dias`}`;
};

/** "Restaurar", from the trash, through one hidden form (no confirmation: nothing is lost). */
function useBookmarkRestore() {
  const formRef = useRef<HTMLFormElement>(null);
  const [id, setId] = useState("");
  const submit = (next: string) =>
    setTimeout(() => {
      flushSync(() => setId(next));
      formRef.current?.requestSubmit();
    }, 0);
  const form = (
    <ServerForm ref={formRef} action={restoreBookmark}>
      <input type="hidden" name="id" value={id} />
    </ServerForm>
  );
  return { submit, form };
}

/** What a dragged item carries: its id, or the selection's ids, comma-separated. */
const DRAG_TYPE = "application/x-arquivos-items";

function NavItem({
  active,
  href: to,
  icon,
  label,
  count,
  hint,
  menu,
  depth = 0,
  toggle,
  onDropItems,
}: {
  active: boolean;
  href: string;
  icon: ReactNode;
  label: string;
  count?: number;
  hint?: string;
  menu?: ReactNode;
  /** A subfolder's level, indented under its parent. */
  depth?: number;
  /** A folder row: room for the arrow, and the arrow itself when it has subfolders. */
  toggle?: { open: boolean; onToggle: () => void; label: string } | "leaf";
  /** Items dragged from the list land here (Arquivos: "Mover" by dragging). */
  onDropItems?: (ids: string[]) => void;
}) {
  const [over, setOver] = useState(false);
  const drop = onDropItems
    ? {
        onDragOver: (event: React.DragEvent) => {
          if (!event.dataTransfer.types.includes(DRAG_TYPE)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          setOver(true);
        },
        onDragLeave: () => setOver(false),
        onDrop: (event: React.DragEvent) => {
          setOver(false);
          const ids = event.dataTransfer.getData(DRAG_TYPE).split(",").filter(Boolean);
          if (!ids.length) return;
          event.preventDefault();
          onDropItems(ids);
        },
      }
    : {};
  return (
    <li className={cn("group/nav relative rounded-md", over && "ring-2 ring-primary")} {...drop}>
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
        style={toggle ? { paddingLeft: `${1.75 + depth * 0.875}rem` } : depth ? { paddingLeft: `${0.625 + depth * 0.875}rem` } : undefined}
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
      {toggle && toggle !== "leaf" && (
        <button
          type="button"
          onClick={toggle.onToggle}
          aria-expanded={toggle.open}
          aria-label={`${toggle.open ? "Recolher" : "Expandir"} ${toggle.label}`}
          className="absolute top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          style={{ left: `${0.25 + depth * 0.875}rem` }}
        >
          <ChevronRightIcon className={cn("size-3.5 transition-transform", toggle.open && "rotate-90")} />
        </button>
      )}
      {menu && (
        <span className="absolute top-1/2 right-1 -translate-y-1/2 opacity-0 transition-opacity group-hover/nav:opacity-100 focus-within:opacity-100 data-[state=open]:opacity-100">
          {menu}
        </span>
      )}
    </li>
  );
}

const EXPANDED_KEY = "bookmarks-folders-open";
const expandedListeners = new Set<() => void>();
type Folding = Record<string, boolean>;
let expandedCache: { raw: string | null; map: Folding } = { raw: null, map: {} };
function readExpanded(): Folding {
  const raw = typeof window === "undefined" ? null : window.localStorage.getItem(EXPANDED_KEY);
  if (raw !== expandedCache.raw) {
    let map: Folding = {};
    try {
      const parsed = JSON.parse(raw ?? "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
        map = Object.fromEntries(Object.entries(parsed).filter(([, v]) => typeof v === "boolean")) as Folding;
    } catch {}
    expandedCache = { raw, map };
  }
  return expandedCache.map;
}
const noExpanded: Folding = {};
/** Which folders someone opened or folded in the rail, kept in this browser. */
function useExpandedFolders() {
  const set = React.useSyncExternalStore(
    (onChange) => {
      expandedListeners.add(onChange);
      return () => expandedListeners.delete(onChange);
    },
    readExpanded,
    () => noExpanded,
  );
  const toggle = (id: string, open: boolean) => {
    const next = { ...readExpanded(), [id]: open };
    try {
      window.localStorage.setItem(EXPANDED_KEY, JSON.stringify(next));
    } catch {}
    expandedListeners.forEach((listener) => listener());
  };
  return [set, toggle] as const;
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
  const [purging, setPurging] = useState<BookmarkView | null>(null);
  const [sharing, setSharing] = useState<ShareTarget | null>(null);
  const { submit: restore, form: restoreForm } = useBookmarkRestore();
  // The trash: what was deleted in the last 30 days, to restore or delete for good; nothing opens from it.
  const inTrash = query.folder === "lixeira";
  const [view, chooseView] = useListLayout("bookmarks", data.view ?? "grid");
  const { submit: move, form: moveForm } = useBookmarkMove();
  const folderById = new Map(folders.map((folder) => [folder.id, folder]));
  // Names as people read them; the picker keeps the razão social to search by.
  const companyName = new Map(companies.map((company) => [company.id, companyDisplayName(company.name, company.document)]));
  const current = folderById.get(query.folder);
  // Folders inside folders: the rail as a tree, the path to the open one, and its subfolders above its items.
  const tree = treeOrder(folders.map((folder) => ({ ...folder, parentId: folder.parentId ?? null })));
  const path = current ? folderPath(tree, current.id) : [];
  // The rail folds: a folder starts folded unless the open one is inside it; what someone opens or folds is remembered here.
  const [expanded, toggleFolder] = useExpandedFolders();
  const parents = new Set(tree.map((folder) => folder.parentId).filter(Boolean));
  const onPath = new Set(path.map((folder) => folder.id));
  const isOpen = (id: string) => expanded[id] ?? (onPath.has(id) && id !== current?.id);
  const visible = (() => {
    const shown = new Set<string>();
    return tree.filter((folder) => {
      const show = !folder.parentId || (shown.has(folder.parentId) && isOpen(folder.parentId));
      if (show) shown.add(folder.id);
      return show;
    });
  })();
  const subfolders = current ? tree.filter((folder) => folder.parentId === current.id) : [];
  const manyCompanies = companies.length > 1;
  // The folder rail spans companies until one is picked; the bookmarks inside a
  // folder are all one company's, and the header names it once.
  const railCompany = manyCompanies && query.company === "all";
  const showCompany = railCompany && !current;
  // Staff get the company as its own column while the list spans companies; a
  // member of several companies keeps it in the subtitle.
  const companyColumn = viewer.admin && showCompany;
  const folderColumn = query.folder === "all";
  // The Console's own folders are the team's; their owner does not manage them, nor edit what is inside for that.
  const manages = (folder: FolderView) => viewer.admin || (folder.ownerId === viewer.id && !folder.system);
  const canEdit = (item: BookmarkView) => {
    const folder = item.folderId ? folderById.get(item.folderId) : undefined;
    return viewer.admin || item.ownerId === viewer.id || (!!folder && folder.ownerId === viewer.id && !folder.system);
  };
  // The selection lives on this page of the list: another folder, search or page starts it over.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const listKey = href(state, {});
  const [selectedFor, setSelectedFor] = useState(listKey);
  if (selectedFor !== listKey) {
    setSelectedFor(listKey);
    setSelected(new Set());
  }
  const clearSelection = () => setSelected(new Set());
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const [itemsMove, setItemsMove] = useState<ItemsMove | null>(null);
  const { submit: star, form: starForm } = useItemsAction(toggleStar, () => undefined);
  const [renaming, setRenaming] = useState<BookmarkView | null>(null);
  /** The item's address in the Console, for someone who already has access (outside, use "Compartilhar por link"). */
  const copyLink = (item: BookmarkView) => {
    void navigator.clipboard
      .writeText(`${window.location.origin}/bookmarks?abrir=${item.id}`)
      .then(() => toast.success("Link copiado. Só abre para quem já tem acesso ao item."))
      .catch(() => toast.error("Não foi possível copiar."));
  };
  const { submit: moveMany, form: moveManyForm } = useItemsAction(moveBookmarks, clearSelection);
  const [trashingMany, setTrashingMany] = useState(false);
  /** A row's drag carries the selection when the row is in it, or the row alone. */
  const dragOf = (item: BookmarkView) =>
    !inTrash && canEdit(item)
      ? (event: React.DragEvent) => {
          event.dataTransfer.setData(DRAG_TYPE, (selected.has(item.id) ? [...selected] : [item.id]).join(","));
          event.dataTransfer.effectAllowed = "move";
        }
      : undefined;
  const picked = items.filter((item) => selected.has(item.id));
  const pickedFiles = picked.filter((item) => kindOf(item) === "file");
  const createIn = query.folder !== "all" && query.folder !== "root" && query.folder !== "lixeira" ? query.folder : "";
  // A new item lands in the company being looked at, or the folder's company.
  const createCompany = current
    ? (current.companyId ?? "")
    : query.company === "internal"
      ? ""
      : query.company !== "all"
        ? query.company
        : (companies[0]?.id ?? "");
  // Several files at once, picked or dropped on the list (R2 only).
  // A folder set to "Só ver e baixar" takes items only from its owner and the team.
  const canAddHere = !current || current.adds !== "owner" || viewer.admin || current.ownerId === viewer.id;
  const bulk = useBulkUpload({ companyId: createCompany, folderId: createIn, enabled: !!data.largeFiles && canAddHere });
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
        {/* The Console's own folders (contracts, deliveries) keep their place and who sees them. */}
        {!folder.system && (
          <>
            <DropdownMenuItem onSelect={() => later(() => setFolderEditor({ mode: "share", folder }))}>
              <Share2Icon />
              Compartilhar
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => later(() => setFolderEditor({ mode: "move", folder }))}>
              <FolderInputIcon />
              Mover para…
            </DropdownMenuItem>
          </>
        )}
        {data.largeFiles && (
          <>
            <DropdownMenuItem onSelect={() => later(() => setSharing({ kind: "download", folderId: folder.id, title: folder.name }))}>
              <LinkIcon />
              Compartilhar por link…
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => later(() => setSharing({ kind: "request", folderId: folder.id, title: folder.name }))}>
              <InboxIcon />
              Pedir arquivos…
            </DropdownMenuItem>
          </>
        )}
        {folder.system ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>Mantida pelo Console</DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => later(() => setFolderEditor({ mode: "delete", folder }))}>
              <Trash2Icon />
              Excluir pasta
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  /** Link host or file name and size; the company too when the list spans several and has no column for it. */
  const subtitleFor = (item: BookmarkView, withCompany: boolean) => {
    const line = [
      item.tag ? tagLabels[item.tag] : null,
      kindOf(item) === "board" ? "Lousa" : item.url ? linkHost(item.url) : item.fileName,
      kindOf(item) === "file" && item.fileSize ? fileSizeLabel(item.fileSize) : null,
      withCompany ? (companyName.get(item.companyId ?? "") ?? null) : null,
      item.deletedAt ? trashNote(item.deletedAt) : null,
    ]
      .filter(Boolean)
      .join(" · ");
    // A search that found the words inside the file shows where.
    return item.excerpt ? (
      <>
        {line}
        <FoundInFile excerpt={item.excerpt} />
      </>
    ) : (
      line
    );
  };
  // A file opens in the preview when the Console can show it; anything else downloads.
  // "Copiar link" lands here with ?abrir=<id>: the item opens in the viewer (or its whiteboard, or its link).
  const [previewing, setPreviewing] = useState<BookmarkView | null>(data.opened && kindOf(data.opened) === "file" ? data.opened : null);
  // Every file opens in the viewer: the picture or the page when the Console can show it, its details and "Baixar" otherwise.
  const download = (item: BookmarkView) => setPreviewing(item);
  const files = items.filter((item) => kindOf(item) === "file");
  // Where a click goes; in the trash, nowhere (it has to come back first).
  const hrefOf = (item: BookmarkView) => (inTrash ? undefined : kindOf(item) === "board" ? boardHref(item.id) : item.url);
  const openOf = (item: BookmarkView) => (inTrash || kindOf(item) === "board" || item.url ? undefined : () => download(item));

  /** The "…" menu of a bookmark, the same in the list and in the grid. */
  const actionsFor = (item: BookmarkView) =>
    inTrash ? (
      canEdit(item) ? (
        <>
          <DropdownMenuItem onSelect={() => restore(item.id)}>
            <RotateCcwIcon />
            Restaurar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => later(() => setPurging(item))}>
            <Trash2Icon />
            Excluir de vez
          </DropdownMenuItem>
        </>
      ) : (
        <DropdownMenuItem disabled>Só quem adicionou ou o dono da pasta restaura</DropdownMenuItem>
      )
    ) : (
    <>
      {kindOf(item) === "board" ? (
        <DropdownMenuItem asChild>
          <Link href={boardHref(item.id)}>
            <PresentationIcon />
            Abrir lousa
          </Link>
        </DropdownMenuItem>
      ) : item.url ? (
        <DropdownMenuItem asChild>
          <a href={item.url} target="_blank" rel="noopener noreferrer">
            <ExternalLinkIcon />
            Abrir link
          </a>
        </DropdownMenuItem>
      ) : (
        <>
          {canPreview(item) && (
            <DropdownMenuItem onSelect={() => later(() => setPreviewing(item))}>
              <EyeIcon />
              Ver
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={() => downloadBookmark(item)}>
            <DownloadIcon />
            Baixar arquivo
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => later(() => setPreviewing(item))}>
            <InfoIcon />
            Detalhes
          </DropdownMenuItem>
          {data.largeFiles && canEdit(item) && (
            <DropdownMenuItem onSelect={() => later(() => setSharing({ kind: "download", bookmarkId: item.id, title: item.title }))}>
              <LinkIcon />
              Compartilhar por link…
            </DropdownMenuItem>
          )}
        </>
      )}
      <DropdownMenuItem onSelect={() => star([item.id])}>
        <StarIcon className={cn(item.starred && "fill-current text-primary")} />
        {item.starred ? "Tirar a estrela" : "Marcar com estrela"}
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => copyLink(item)}>
        <Link2Icon />
        Copiar link
      </DropdownMenuItem>
      {canEdit(item) && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => later(() => setRenaming(item))}>
            <TypeIcon />
            Renomear
          </DropdownMenuItem>
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
          <DropdownMenuItem onSelect={() => later(() => setItemsMove({ mode: "copy", ids: [item.id], title: item.title, companyId: item.companyId }))}>
            <CopyIcon />
            Copiar para…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => later(() => setRemoving(item))}>
            <Trash2Icon />
            Excluir
          </DropdownMenuItem>
        </>
      )}
    </>
    );

  const table = (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-10 pr-0 pl-4">
            <Checkbox
              aria-label="Selecionar todos desta página"
              checked={items.length > 0 && picked.length === items.length}
              onCheckedChange={(on) => setSelected(on === true ? new Set(items.map((item) => item.id)) : new Set())}
            />
          </TableHead>
          <TableHead className="pl-2">Bookmark</TableHead>
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
          const subtitle = subtitleFor(item, showCompany && !companyColumn);
          const board = kindOf(item) === "board";
          return (
            <LinkRow
              key={item.id}
              href={hrefOf(item)}
              external={!board}
              onOpen={openOf(item)}
              onDragStart={dragOf(item)}
              className={selected.has(item.id) ? "bg-accent/50" : undefined}
            >
              <TableCell className="w-10 pr-0 pl-4">
                <Checkbox aria-label={`Selecionar ${item.title}`} checked={selected.has(item.id)} onCheckedChange={() => toggle(item.id)} />
              </TableCell>
              <PrimaryCell
                href={hrefOf(item)}
                external={!board}
                onOpen={openOf(item)}
                leading={<Tile item={item} />}
                title={item.title}
                subtitle={subtitle || undefined}
              />
              {folderColumn && (
                <TableCell className="hidden max-w-[14rem] md:table-cell">
                  {/* Unfiled is the absence of a folder: the cell stays empty. */}
                  {folder && <span className="block truncate text-foreground">{folder.name}</span>}
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
                {actionsFor(item)}
              </RowActions>
            </LinkRow>
          );
        })}
      </TableBody>
    </Table>
  );

  /** "4,2 MB · há 3 h", and the folder or the company when the list spans several. */
  const cardMeta = (item: BookmarkView) =>
    [
      item.deletedAt ? trashNote(item.deletedAt) : null,
      kindOf(item) === "file" && item.fileSize ? fileSizeLabel(item.fileSize) : kindOf(item) === "board" ? "Lousa" : null,
      relativeLabel(item.updatedAt ?? item.createdAt, now),
      folderColumn && item.folderId ? (folderById.get(item.folderId)?.name ?? null) : null,
      showCompany ? (companyName.get(item.companyId ?? "") ?? null) : null,
    ]
      .filter(Boolean)
      .join(" · ");
  /** The buttons on a card's picture: see, download, share by link. */
  const quickOf = (item: BookmarkView) =>
    inTrash || kindOf(item) !== "file"
      ? undefined
      : [
          ...(canPreview(item) ? [{ label: "Ver", icon: quickIcons.preview, onClick: () => setPreviewing(item) }] : []),
          { label: "Baixar", icon: quickIcons.download, onClick: () => downloadBookmark(item) },
          ...(data.largeFiles && canEdit(item)
            ? [{ label: "Compartilhar por link", icon: quickIcons.link, onClick: () => setSharing({ kind: "download", bookmarkId: item.id, title: item.title }) }]
            : []),
        ];
  const grid = (
    <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-2.5 p-4">
      {items.map((item) => (
        <FileCard
          key={item.id}
          item={item}
          href={hrefOf(item)}
          external={kindOf(item) !== "board"}
          onOpen={openOf(item)}
          selected={selected.has(item.id)}
          selecting={selected.size > 0}
          onToggle={() => toggle(item.id)}
          onDragStart={dragOf(item)}
          onStar={inTrash ? undefined : () => star([item.id])}
          quick={quickOf(item)}
          badge={item.tag ? tagLabels[item.tag] : null}
          meta={cardMeta(item)}
          actions={<RowActions label={item.title}>{actionsFor(item)}</RowActions>}
        />
      ))}
    </ul>
  );

  return (
    <>
      <PageHeader
        className="mb-4"
        crumbs={
          path.length > 1
            ? [{ label: "Arquivos", href: href(state, { folder: "all" }) }, ...path.slice(0, -1).map((folder) => ({ label: folder.name, href: href(state, { folder: folder.id }) }))]
            : undefined
        }
        title={current ? current.name : query.folder === "root" ? "Sem pasta" : inTrash ? "Lixeira" : "Arquivos"}
        count={paging.total}
        // A folder says whose it is (when there are several companies) and, only
        // when it is not open to the whole company, who sees it.
        meta={
          current
            ? [
                manyCompanies && <span key="company">{companyName.get(current.companyId ?? "")}</span>,
                current.visibility === "people" && (
                  <span key="people" className="flex items-center gap-2">
                    {current.sharedWith.length > 0 && <AvatarStack people={current.sharedWith} size={20} />}
                    {current.sharedWith.length
                      ? `Só ${current.owner} e ${current.sharedWith.length} ${current.sharedWith.length === 1 ? "pessoa" : "pessoas"}`
                      : `Só ${current.ownerId === viewer.id ? "você" : current.owner}`}
                  </span>
                ),
              ]
            : undefined
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
              <NativeSelectOption value="lixeira">Lixeira</NativeSelectOption>
              {folders.length > 0 && (
                <NativeSelectOptGroup label="Pastas">
                  {tree.map((folder) => (
                    <NativeSelectOption key={folder.id} value={folder.id}>
                      {"— ".repeat(folder.depth)}
                      {folder.name}
                      {railCompany ? ` · ${companyName.get(folder.companyId ?? "") ?? ""}` : ""}
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
                // No count: it is the number beside the title whenever this view is open.
              />
              <NavItem
                active={query.folder === "recentes"}
                href={href(state, { folder: "recentes" })}
                icon={<ClockIcon className="opacity-60" />}
                label="Recentes"
              />
              <NavItem
                active={query.folder === "estrela"}
                href={href(state, { folder: "estrela" })}
                icon={<StarIcon className="opacity-60" />}
                label="Com estrela"
                count={counts.starred || undefined}
              />
              <NavItem
                active={query.folder === "root"}
                href={href(state, { folder: "root" })}
                icon={<FolderIcon className="opacity-60" />}
                label="Sem pasta"
                count={counts.root}
                onDropItems={inTrash ? undefined : (ids) => moveMany(ids, "")}
              />
              <NavItem
                active={inTrash}
                href={href(state, { folder: "lixeira" })}
                icon={<Trash2Icon className="opacity-60" />}
                label="Lixeira"
                count={counts.trash || undefined}
              />
            </ul>
            <p className="mt-5 mb-1.5 px-2.5 text-caption font-medium text-muted-foreground">Pastas</p>
            <ul className="flex flex-col gap-0.5">
              {visible.map((folder) => (
                <NavItem
                  key={folder.id}
                  depth={folder.depth}
                  toggle={parents.has(folder.id) ? { open: isOpen(folder.id), onToggle: () => toggleFolder(folder.id, !isOpen(folder.id)), label: folder.name } : "leaf"}
                  active={query.folder === folder.id}
                  href={href(state, { folder: folder.id })}
                  icon={folder.visibility === "people" ? <UsersIcon /> : <FolderIcon />}
                  label={folder.name}
                  hint={railCompany ? companyName.get(folder.companyId ?? "") : undefined}
                  count={folder.count}
                  menu={manages(folder) ? folderMenu(folder) : undefined}
                  onDropItems={inTrash ? undefined : (ids) => moveMany(ids, folder.id)}
                />
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => setFolderEditor({ mode: "create", parent: current ?? undefined })}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <FolderPlusIcon className="size-4" />
                  Nova pasta
                </button>
              </li>
            </ul>
          </nav>
          {data.spaces?.map((space) => (
            <SpaceMeter
              key={space.companyId ?? "anuntech"}
              // A name only to tell several spaces apart: in one, the screen already says whose it is.
              name={data.spaces!.length > 1 ? (companyName.get(space.companyId ?? "") ?? "Anuntech") : null}
              used={space.used}
              quota={space.quota}
              parts={space.parts}
            />
          ))}
        </aside>

        <div {...bulk.dropProps} className={cn("relative flex min-w-0 flex-col gap-4", bulk.dragging && "rounded-xl ring-2 ring-primary ring-offset-2")}>
        {subfolders.length > 0 && (
          <nav aria-label="Pastas dentro desta" className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {subfolders.map((folder) => (
              <Link
                key={folder.id}
                href={href(state, { folder: folder.id })}
                className="flex min-w-0 items-center gap-2.5 rounded-xl border bg-card px-3 py-2.5 text-sm transition-colors hover:border-primary/40 hover:bg-accent/40"
              >
                {folder.visibility === "people" ? <UsersIcon className="size-4 shrink-0 text-muted-foreground" /> : <FolderIcon className="size-4 shrink-0 text-muted-foreground" />}
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">{folder.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{folder.count}</span>
              </Link>
            ))}
          </nav>
        )}
        {!inTrash && (data.tags?.length || query.tag) ? (
          <nav aria-label="Filtrar por etiqueta" className="flex flex-wrap gap-1.5">
            {[{ tag: "" as const, count: null }, ...(data.tags ?? [])].map(({ tag, count }) => {
              const active = (query.tag ?? "") === tag;
              return (
                <Link
                  key={tag || "todas"}
                  href={href(state, { tag })}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors",
                    active ? "border-primary bg-accent font-medium text-primary" : "bg-card text-foreground hover:border-primary/40",
                  )}
                >
                  {tag ? tagLabels[tag] : "Todas as etiquetas"}
                  {count !== null && <span className="ml-1.5 tabular-nums text-muted-foreground">{count}</span>}
                </Link>
              );
            })}
          </nav>
        ) : null}
        {picked.length > 0 && (
          <div role="toolbar" aria-label="Itens selecionados" className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
            <span className="font-medium text-foreground">{picked.length === 1 ? "1 selecionado" : `${picked.length} selecionados`}</span>
            <span className="text-xs text-muted-foreground">Dica: arraste para uma pasta à esquerda.</span>
            <span className="ml-auto flex flex-wrap gap-2">
              {pickedFiles.length > 0 && (
                <Button variant="outline" size="sm" asChild>
                  <a href={`/api/bookmarks/zip?${pickedFiles.map((item) => `id=${item.id}`).join("&")}`} download>
                    <DownloadIcon />
                    Baixar {pickedFiles.length === 1 ? "" : "em .zip"}
                  </a>
                </Button>
              )}
              {!inTrash && picked.every(canEdit) && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setItemsMove({
                        mode: "move",
                        ids: picked.map((item) => item.id),
                        title: picked.length === 1 ? `“${picked[0].title}”` : `${picked.length} itens`,
                        companyId: picked[0].companyId,
                      })
                    }
                  >
                    <FolderInputIcon />
                    Mover para…
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setTrashingMany(true)}>
                    <Trash2Icon />
                    Lixeira
                  </Button>
                </>
              )}
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                Limpar
              </Button>
            </span>
          </div>
        )}
        <ListCard
          fill
          empty={items.length === 0}
          label="Lista de bookmarks"
          className="min-w-0"
          actions={
            <>
              {/* On a large screen the rail has it, under the folders. */}
              <Button
                variant="outline"
                size="icon"
                aria-label="Nova pasta"
                title="Nova pasta"
                className="lg:hidden"
                onClick={() => setFolderEditor({ mode: "create", parent: current ?? undefined })}
              >
                <FolderPlusIcon />
              </Button>
              {/* The open folder, its subfolders included, as one .zip (whatever the viewer sees inside). */}
              {current && !inTrash && current.count + subfolders.length > 0 && (
                <Button variant="outline" size="icon" aria-label="Baixar a pasta em .zip" title="Baixar a pasta em .zip" asChild>
                  <a href={`/api/bookmarks/pastas/${current.id}/zip`} download>
                    <DownloadIcon />
                  </a>
                </Button>
              )}
              {canAddHere && bulk.picker}
              {canAddHere && (
                <Button className="sm:w-28" onClick={() => setEditor({ mode: "create", companyId: createCompany, folderId: createIn })}>
                  <PlusIcon />
                  Adicionar
                </Button>
              )}
            </>
          }
          layout={<ViewToggle view={view} onChange={chooseView} />}
          toolbar={
            <>
              <SearchField
                value={query.search}
                onChange={(search) => go({ search })}
                placeholder="Buscar pelo nome ou pelo que está escrito no arquivo"
                className="min-w-0 flex-1 max-sm:basis-full"
              />
              {!inTrash && (
                <>
                  {/* The select fills its wrapper: the wrapper sets the width, so the toolbar stays on one line. */}
                  <div className="w-40 shrink-0 max-sm:flex-1">
                  <NativeSelect aria-label="Tipo" value={query.kind ?? ""} onChange={(event) => go({ kind: event.target.value as KindFilter | "" })} className="bg-card">
                    <NativeSelectOption value="">Todos os tipos</NativeSelectOption>
                    {KIND_FILTERS.map((kind) => (
                      <NativeSelectOption key={kind.value} value={kind.value}>
                        {kind.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  </div>
                  <div className="w-40 shrink-0 max-sm:flex-1">
                  <NativeSelect aria-label="Ordem" value={query.sort ?? ""} onChange={(event) => go({ sort: event.target.value as SortOrder })} className="bg-card">
                    {SORTS.map((sort) => (
                      <NativeSelectOption key={sort.value} value={sort.value}>
                        {sort.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  </div>
                  <Button variant={query.mine ? "secondary" : "outline"} aria-pressed={!!query.mine} onClick={() => go({ mine: !query.mine })}>
                    Só os meus
                  </Button>
                </>
              )}
            </>
          }
          footer={
            <ListPagination
              page={paging.page}
              pageSize={paging.pageSize}
              total={paging.total}
              pageCount={paging.pageCount}
              noun={["item", "itens"]}
              hrefFor={(patch) => href(state, patch)}
            />
          }
        >
          {items.length ? (
            view === "grid" ? grid : table
          ) : (
            <EmptyState
              art={query.search ? "busca" : "projetos"}
              title={query.search ? "Nada encontrado" : inTrash ? "A lixeira está vazia" : "Nada aqui ainda"}
              description={
                query.search
                  ? "Tente outro termo ou mude os filtros."
                  : inTrash
                    ? `O que você excluir fica aqui por ${TRASH_DAYS} dias, para restaurar se precisar.`
                    : "Envie arquivos, guarde links e organize tudo em pastas."
              }
              action={
                inTrash ? undefined : query.search ? (
                  // The folder and the company are where the person is (the rail
                  // shows it); only the search is a filter here.
                  <Button variant="outline" asChild>
                    <Link href={href(state, { search: "" })} scroll={false}>
                      Limpar filtros
                    </Link>
                  </Button>
                ) : canAddHere ? (
                  <Button
                    onClick={() =>
                      setEditor({ mode: "create", companyId: createCompany, folderId: createIn })
                    }
                  >
                    <PlusIcon />
                    Adicionar
                  </Button>
                ) : null
              }
            />
          )}
        </ListCard>
        </div>
      </div>
      {bulk.tray}
      <FilePreview
        item={previewing}
        items={files}
        onNavigate={setPreviewing}
        onClose={() => setPreviewing(null)}
        details={
          previewing
            ? [
                ["Tipo", fileTypeOf(previewing.fileName).label],
                ["Tamanho", previewing.fileSize ? fileSizeLabel(previewing.fileSize) : "—"],
                ["Pasta", previewing.folderId ? (folderById.get(previewing.folderId)?.name ?? "—") : "Sem pasta"],
                ["Empresa", previewing.companyId ? (companyName.get(previewing.companyId) ?? "—") : "Anuntech"],
                ["Etiqueta", previewing.tag ? tagLabels[previewing.tag] : "—"],
                ["Adicionado por", previewing.ownerName ?? "—"],
                ["Adicionado em", dateTimeLabel(previewing.createdAt)],
                ["Alterado em", dateTimeLabel(previewing.updatedAt ?? previewing.createdAt)],
              ]
            : []
        }
        actions={
          previewing && !inTrash ? (
            <>
              {data.largeFiles && canEdit(previewing) && (
                <Button variant="outline" onClick={() => setSharing({ kind: "download", bookmarkId: previewing.id, title: previewing.title })}>
                  <LinkIcon />
                  Compartilhar
                </Button>
              )}
              {canEdit(previewing) && (
                <Button variant="outline" onClick={() => setEditor({ mode: "edit", item: previewing })}>
                  <PencilIcon />
                  Editar
                </Button>
              )}
            </>
          ) : null
        }
      />
      <RenameDialog item={renaming} onClose={() => setRenaming(null)} />
      {starForm}
      <ShareLinkDialog target={sharing} onClose={() => setSharing(null)} />
      <ItemsDialog
        target={itemsMove}
        folders={folders}
        companyName={companyName}
        onClose={() => {
          setItemsMove(null);
          clearSelection();
        }}
      />
      <ConfirmDialog
        open={trashingMany}
        onOpenChange={setTrashingMany}
        action={trashBookmarks}
        title={picked.length === 1 ? "Mover 1 item para a lixeira?" : `Mover ${picked.length} itens para a lixeira?`}
        description={`Ficam lá por ${TRASH_DAYS} dias, e dá para restaurar.`}
        confirmLabel="Mover para a lixeira"
        onSuccess={clearSelection}
        destructive
        extra={(formId) =>
          picked.map((item) => <input key={item.id} form={formId} type="hidden" name="id" value={item.id} />)
        }
      />

      <BookmarkSheet
        editor={editor}
        onClose={() => setEditor(null)}
        folders={folders}
        companies={companies}
        largeFiles={data.largeFiles}
      />
      <FolderDialogs
        editor={folderEditor}
        folders={tree}
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
          title="Mover para a lixeira?"
          description={`"${removing.title}" vai para a lixeira${deleteNote(removing)} e fica lá por ${TRASH_DAYS} dias. Até lá, dá para restaurar.`}
          confirmLabel="Mover para a lixeira"
          destructive
          onSuccess={() => setRemoving(null)}
        />
      )}
      {purging && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPurging(null)}
          action={purgeBookmark}
          fields={{ id: purging.id }}
          title="Excluir de vez?"
          description={`"${purging.title}" sai do Console${deleteNote(purging)}, e o espaço volta para a empresa. Isso não pode ser desfeito.`}
          confirmLabel="Excluir de vez"
          destructive
          onSuccess={() => setPurging(null)}
        />
      )}
      {restoreForm}
      {moveForm}
      {moveManyForm}
    </>
  );
}

/** How much of a space its files take; Anuntech's own has no limit. */
type SpaceParts = { media: number; documents: number; other: number };
const PART_LOOKS: [keyof SpaceParts, string, string][] = [
  ["media", "Fotos e vídeos", "bg-primary"],
  ["documents", "Documentos", "bg-primary/55"],
  ["other", "Outros", "bg-primary/25"],
];

/**
 * "Armazenamento": what the space holds, split into photos and videos,
 * documents and the rest, on a bar that fills up to the company's limit (the
 * space without a limit, Anuntech's own, shows only the split). The space's
 * name only when there are several on the screen.
 */
function SpaceMeter({ name, used, quota, parts }: { name: string | null; used: number; quota: number | null; parts?: SpaceParts }) {
  const full = quota ? used / quota : 0;
  // With a limit, the bar is the limit; without, it is what is used.
  const whole = quota ?? used;
  const split = parts ?? { media: 0, documents: 0, other: used };
  const left = quota ? Math.max(0, quota - used) : null;
  return (
    <div className="hidden rounded-lg border bg-card px-3 py-3 lg:block">
      <div className="flex items-baseline justify-between gap-2">
        <p className="m-0 text-xs font-medium text-foreground">{name ?? "Armazenamento"}</p>
        {quota !== null && <span className={cn("text-xs tabular-nums", full > 0.9 ? "text-destructive" : "text-muted-foreground")}>{Math.min(100, Math.round(full * 100))}%</span>}
      </div>
      <div
        className="mt-2 flex h-2 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-label={name ? `Armazenamento de ${name}` : "Armazenamento"}
        aria-valuemin={0}
        aria-valuemax={whole || 1}
        aria-valuenow={used}
        aria-valuetext={`${fileSizeLabel(used)}${quota ? ` de ${fileSizeLabel(quota)}` : ""}`}
      >
        {whole > 0 &&
          PART_LOOKS.map(([key, , look]) =>
            split[key] > 0 ? (
              <div
                key={key}
                className={cn("h-full first:rounded-l-full last:rounded-r-full", quota && full > 0.9 ? "bg-destructive" : look)}
                style={{ width: `${Math.max(1.5, (split[key] / whole) * 100)}%` }}
              />
            ) : null,
          )}
      </div>
      <p className="m-0 mt-1.5 text-xs text-foreground tabular-nums">
        {used ? fileSizeLabel(used) : "0 KB"}
        <span className="text-muted-foreground">{quota === null ? " usados, sem limite" : ` de ${fileSizeLabel(quota)} · ${fileSizeLabel(left!)} livres`}</span>
      </p>
      {used > 0 && (
        <ul className="m-0 mt-2 grid list-none gap-1 p-0">
          {PART_LOOKS.filter(([key]) => split[key] > 0).map(([key, label, look]) => (
            <li key={key} className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", look)} />
              <span className="min-w-0 flex-1 truncate">{label}</span>
              <span className="tabular-nums">{fileSizeLabel(split[key])}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The passage of the file where the search found its words, the words highlighted. */
function FoundInFile({ excerpt }: { excerpt: string }) {
  return (
    <span className="mt-0.5 line-clamp-2 block whitespace-normal text-xs text-muted-foreground">
      <span className="sr-only">Encontrado no arquivo: </span>…
      {excerptPieces(excerpt).map((piece, index) =>
        piece.hit ? (
          <mark key={index} className="rounded-sm bg-accent px-0.5 font-medium text-primary">
            {piece.text}
          </mark>
        ) : (
          <Fragment key={index}>{piece.text}</Fragment>
        ),
      )}
      …
    </span>
  );
}
