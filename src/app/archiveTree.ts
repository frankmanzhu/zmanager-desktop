import type { ArchiveEntryDto, ArchiveEntryKind } from "../api/types";

export const ARCHIVE_ROOT_PATH = "";
export const DEFAULT_ARCHIVE_ROOT_NAME = "Archive";

const ARCHIVE_PATH_SEPARATOR = "/";
const ARCHIVE_PATH_SEPARATOR_PATTERN = /[\\/]+/g;
const ARCHIVE_PATH_COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

export type ArchiveFolderNode = {
  name: string;
  path: string;
  parentPath: string | null;
  depth: number;
  entry?: ArchiveEntryDto;
  children: ArchiveFolderNode[];
  isRoot: boolean;
  isExplicit: boolean;
};

export type ArchiveBreadcrumb = {
  name: string;
  path: string;
  isRoot: boolean;
};

export type ArchiveVisibleEntry = {
  path: string;
  name: string;
  parentPath: string;
  kind: ArchiveEntryKind;
  entry?: ArchiveEntryDto;
  isDirectory: boolean;
  isSynthetic: boolean;
  hasChildren: boolean;
};

export type ArchiveViewMode = "folder" | "flat";

export type GetVisibleArchiveEntriesOptions = {
  currentFolderPath?: string | null;
  mode?: ArchiveViewMode;
  query?: string | null;
};

export type ArchiveTreeOptions = {
  rootName?: string;
};

type MutableArchiveFolderNode = ArchiveFolderNode & {
  childMap: Map<string, MutableArchiveFolderNode>;
};

export function normalizeArchivePath(value?: string | null): string {
  if (!value) {
    return ARCHIVE_ROOT_PATH;
  }

  return value
    .replace(ARCHIVE_PATH_SEPARATOR_PATTERN, ARCHIVE_PATH_SEPARATOR)
    .split(ARCHIVE_PATH_SEPARATOR)
    .filter((segment) => segment.length > 0 && segment !== ".")
    .join(ARCHIVE_PATH_SEPARATOR);
}

export function splitArchivePath(value?: string | null): string[] {
  const normalized = normalizeArchivePath(value);
  return normalized ? normalized.split(ARCHIVE_PATH_SEPARATOR) : [];
}

export function joinArchivePath(...parts: Array<string | null | undefined>): string {
  return parts.flatMap((part) => splitArchivePath(part)).join(ARCHIVE_PATH_SEPARATOR);
}

export function getArchiveEntryName(value?: string | null): string {
  const segments = splitArchivePath(value);
  return segments.at(-1) ?? "";
}

export function getArchiveEntryFolder(value?: string | null): string {
  const segments = splitArchivePath(value);
  segments.pop();
  return segments.join(ARCHIVE_PATH_SEPARATOR);
}

export function getParentArchivePath(value?: string | null): string | null {
  const normalized = normalizeArchivePath(value);
  if (!normalized) {
    return null;
  }

  return getArchiveEntryFolder(normalized);
}

export function isArchivePathInFolder(
  entryPath: string,
  folderPath?: string | null,
): boolean {
  const normalizedEntryPath = normalizeArchivePath(entryPath);
  const normalizedFolderPath = normalizeArchivePath(folderPath);

  if (!normalizedEntryPath) {
    return !normalizedFolderPath;
  }

  if (!normalizedFolderPath) {
    return true;
  }

  return (
    normalizedEntryPath === normalizedFolderPath ||
    normalizedEntryPath.startsWith(`${normalizedFolderPath}${ARCHIVE_PATH_SEPARATOR}`)
  );
}

export function getArchivePathRelativeToFolder(
  entryPath: string,
  folderPath?: string | null,
): string | null {
  const normalizedEntryPath = normalizeArchivePath(entryPath);
  const normalizedFolderPath = normalizeArchivePath(folderPath);

  if (!isArchivePathInFolder(normalizedEntryPath, normalizedFolderPath)) {
    return null;
  }

  if (!normalizedFolderPath) {
    return normalizedEntryPath;
  }

  if (normalizedEntryPath === normalizedFolderPath) {
    return "";
  }

  return normalizedEntryPath.slice(normalizedFolderPath.length + 1);
}

export function buildArchiveTree(
  entries: readonly ArchiveEntryDto[],
  options: ArchiveTreeOptions = {},
): ArchiveFolderNode {
  const root = createMutableNode({
    name: options.rootName ?? DEFAULT_ARCHIVE_ROOT_NAME,
    path: ARCHIVE_ROOT_PATH,
    parentPath: null,
    depth: 0,
    isRoot: true,
    isExplicit: true,
  });

  for (const entry of entries) {
    const normalizedPath = normalizeArchivePath(entry.path);
    if (!normalizedPath) {
      continue;
    }

    const folderPath =
      entry.kind === "directory" ? normalizedPath : getArchiveEntryFolder(normalizedPath);
    const folderNode = getOrCreateMutableFolder(root, folderPath);

    if (entry.kind === "directory") {
      folderNode.entry = entry;
      folderNode.isExplicit = true;
    }
  }

  return finalizeFolderNode(root);
}

export function flattenArchiveTree(root: ArchiveFolderNode): ArchiveFolderNode[] {
  const nodes: ArchiveFolderNode[] = [root];
  for (const child of root.children) {
    nodes.push(...flattenArchiveTree(child));
  }
  return nodes;
}

export function getArchiveBreadcrumbs(
  currentFolderPath?: string | null,
  options: ArchiveTreeOptions = {},
): ArchiveBreadcrumb[] {
  const rootName = options.rootName ?? DEFAULT_ARCHIVE_ROOT_NAME;
  const segments = splitArchivePath(currentFolderPath);
  const breadcrumbs: ArchiveBreadcrumb[] = [
    {
      name: rootName,
      path: ARCHIVE_ROOT_PATH,
      isRoot: true,
    },
  ];

  let path = ARCHIVE_ROOT_PATH;
  for (const segment of segments) {
    path = joinArchivePath(path, segment);
    breadcrumbs.push({
      name: segment,
      path,
      isRoot: false,
    });
  }

  return breadcrumbs;
}

export function archiveFolderExists(
  entries: readonly ArchiveEntryDto[],
  folderPath?: string | null,
): boolean {
  const normalizedFolderPath = normalizeArchivePath(folderPath);
  if (!normalizedFolderPath) {
    return true;
  }

  return entries.some((entry) => {
    const normalizedEntryPath = normalizeArchivePath(entry.path);
    return (
      (entry.kind === "directory" && normalizedEntryPath === normalizedFolderPath) ||
      normalizedEntryPath.startsWith(`${normalizedFolderPath}${ARCHIVE_PATH_SEPARATOR}`)
    );
  });
}

export function filterArchiveEntries(
  entries: readonly ArchiveEntryDto[],
  query?: string | null,
): ArchiveEntryDto[] {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) {
    return [...entries];
  }

  return entries.filter((entry) => archiveEntryMatchesSearch(entry, normalizedQuery));
}

export function getVisibleArchiveEntries(
  entries: readonly ArchiveEntryDto[],
  options: GetVisibleArchiveEntriesOptions = {},
): ArchiveVisibleEntry[] {
  const mode = options.mode ?? "folder";
  const query = normalizeSearchQuery(options.query);
  const foldersWithChildren = collectFoldersWithChildren(entries);

  if (mode === "flat") {
    return filterArchiveEntries(entries, query)
      .map((entry) => createVisibleEntryFromEntry(entry, foldersWithChildren))
      .sort(compareArchiveVisibleEntries);
  }

  const currentFolderPath = normalizeArchivePath(options.currentFolderPath);
  const visibleByPath = new Map<string, ArchiveVisibleEntry>();

  for (const entry of entries) {
    const normalizedPath = normalizeArchivePath(entry.path);
    if (!normalizedPath) {
      continue;
    }

    const relativePath = getArchivePathRelativeToFolder(normalizedPath, currentFolderPath);
    if (relativePath === null || relativePath === "") {
      continue;
    }

    const [childName, ...remainingSegments] = splitArchivePath(relativePath);
    if (!childName) {
      continue;
    }

    const childPath = joinArchivePath(currentFolderPath, childName);
    if (remainingSegments.length > 0) {
      upsertSyntheticFolder(visibleByPath, childPath, currentFolderPath, foldersWithChildren);
      continue;
    }

    const visibleEntry = createVisibleEntryFromEntry(entry, foldersWithChildren);
    visibleByPath.set(visibleEntry.path, visibleEntry);
  }

  return Array.from(visibleByPath.values())
    .filter((entry) => visibleEntryMatchesSearch(entry, query))
    .sort(compareArchiveVisibleEntries);
}

export function compareArchiveVisibleEntries(
  left: ArchiveVisibleEntry,
  right: ArchiveVisibleEntry,
): number {
  if (left.isDirectory !== right.isDirectory) {
    return left.isDirectory ? -1 : 1;
  }

  return (
    ARCHIVE_PATH_COLLATOR.compare(left.name, right.name) ||
    ARCHIVE_PATH_COLLATOR.compare(left.path, right.path)
  );
}

export function archiveEntryMatchesSearch(entry: ArchiveEntryDto, query?: string | null): boolean {
  const normalizedQuery = normalizeSearchQuery(query);
  if (!normalizedQuery) {
    return true;
  }

  const normalizedPath = normalizeArchivePath(entry.path).toLowerCase();
  return normalizedPath.includes(normalizedQuery) || entry.kind.includes(normalizedQuery);
}

function normalizeSearchQuery(query?: string | null): string {
  return query?.trim().toLowerCase() ?? "";
}

function visibleEntryMatchesSearch(entry: ArchiveVisibleEntry, query: string): boolean {
  if (!query) {
    return true;
  }

  return (
    entry.name.toLowerCase().includes(query) ||
    entry.path.toLowerCase().includes(query) ||
    entry.kind.includes(query)
  );
}

function createMutableNode(
  node: Omit<ArchiveFolderNode, "children">,
): MutableArchiveFolderNode {
  return {
    ...node,
    children: [],
    childMap: new Map(),
  };
}

function getOrCreateMutableFolder(
  root: MutableArchiveFolderNode,
  folderPath: string,
): MutableArchiveFolderNode {
  let currentNode = root;
  let currentPath = ARCHIVE_ROOT_PATH;

  for (const segment of splitArchivePath(folderPath)) {
    currentPath = joinArchivePath(currentPath, segment);
    const existingNode = currentNode.childMap.get(segment);
    if (existingNode) {
      currentNode = existingNode;
      continue;
    }

    const childNode = createMutableNode({
      name: segment,
      path: currentPath,
      parentPath: currentNode.path,
      depth: currentNode.depth + 1,
      isRoot: false,
      isExplicit: false,
    });
    currentNode.childMap.set(segment, childNode);
    currentNode = childNode;
  }

  return currentNode;
}

function finalizeFolderNode(node: MutableArchiveFolderNode): ArchiveFolderNode {
  return {
    name: node.name,
    path: node.path,
    parentPath: node.parentPath,
    depth: node.depth,
    entry: node.entry,
    children: Array.from(node.childMap.values())
      .map(finalizeFolderNode)
      .sort(compareFolderNodes),
    isRoot: node.isRoot,
    isExplicit: node.isExplicit,
  };
}

function compareFolderNodes(left: ArchiveFolderNode, right: ArchiveFolderNode): number {
  return (
    ARCHIVE_PATH_COLLATOR.compare(left.name, right.name) ||
    ARCHIVE_PATH_COLLATOR.compare(left.path, right.path)
  );
}

function collectFoldersWithChildren(entries: readonly ArchiveEntryDto[]): Set<string> {
  const foldersWithChildren = new Set<string>();

  for (const entry of entries) {
    const segments = splitArchivePath(entry.path);
    for (let index = 1; index < segments.length; index += 1) {
      foldersWithChildren.add(segments.slice(0, index).join(ARCHIVE_PATH_SEPARATOR));
    }
  }

  return foldersWithChildren;
}

function createVisibleEntryFromEntry(
  entry: ArchiveEntryDto,
  foldersWithChildren: ReadonlySet<string>,
): ArchiveVisibleEntry {
  const path = normalizeArchivePath(entry.path);
  return {
    path,
    name: getArchiveEntryName(path),
    parentPath: getArchiveEntryFolder(path),
    kind: entry.kind,
    entry,
    isDirectory: entry.kind === "directory",
    isSynthetic: false,
    hasChildren: foldersWithChildren.has(path),
  };
}

function upsertSyntheticFolder(
  visibleByPath: Map<string, ArchiveVisibleEntry>,
  folderPath: string,
  parentPath: string,
  foldersWithChildren: ReadonlySet<string>,
): void {
  if (visibleByPath.has(folderPath)) {
    return;
  }

  visibleByPath.set(folderPath, {
    path: folderPath,
    name: getArchiveEntryName(folderPath),
    parentPath,
    kind: "directory",
    isDirectory: true,
    isSynthetic: true,
    hasChildren: foldersWithChildren.has(folderPath),
  });
}
