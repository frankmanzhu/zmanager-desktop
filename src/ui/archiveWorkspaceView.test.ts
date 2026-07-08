import { describe, expect, it } from "vitest";

import {
  resetColumnSettings,
  visibleColumns,
  type ArchiveTableColumn,
  type ArchiveTableRow,
} from "../app/archiveTable";
import { createTranslator } from "../app/i18n/translator";
import {
  renderArchiveNavigationTree,
  renderArchiveWorkspaceTable,
  renderCreateNavigationTree,
  renderArchiveDetailsHtml,
  tableMinimumWidth,
  type ArchiveWorkspaceTreeFolder,
  type ArchiveWorkspaceTableElements,
  type ArchiveWorkspaceTableRenderOptions,
} from "./archiveWorkspaceView";

describe("archive workspace view", () => {
  it("renders archive tree empty state", () => {
    const treeContentElement = treeElement();

    renderArchiveNavigationTree({ treeContentElement }, {
      kind: "empty",
      message: "No archive is open.",
    });

    expect(treeContentElement.innerHTML).toContain('class="empty-pane"');
    expect(treeContentElement.innerHTML).toContain("<p>No archive is open.</p>");
  });

  it("renders archive tree folders with root placeholder, disclosure, active state, and icons", () => {
    const treeContentElement = treeElement();

    renderArchiveNavigationTree({ treeContentElement }, {
      kind: "folders",
      folders: treeFolders([
        {
          path: "",
          label: "demo.zip",
          depth: 0,
          canToggle: false,
          isExpanded: true,
          isActive: true,
          iconHtml: '<span class="tree-icon" data-icon="archive"></span>',
        },
        {
          path: "docs",
          label: "docs",
          depth: 1,
          canToggle: true,
          isExpanded: false,
          isActive: false,
          iconHtml: '<span class="tree-icon" data-icon="folder"></span>',
        },
      ]),
      collapseLabel: "Collapse",
      expandLabel: "Expand",
    });

    const html = treeContentElement.innerHTML;
    expect(html).toContain('class="tree-item is-active"');
    expect(html).toContain('data-tree-path=""');
    expect(html).toContain('style="--depth: 0"');
    expect(html).toContain('tree-disclosure tree-disclosure-placeholder');
    expect(html).toContain('<span class="tree-label">demo.zip</span>');
    expect(html).toContain('data-tree-toggle data-tree-path="docs"');
    expect(html).toContain('aria-label="Expand docs"');
    expect(html).toContain('<span class="tree-icon" data-icon="folder"></span>');
  });

  it("escapes archive tree labels and toggle attributes", () => {
    const treeContentElement = treeElement();

    renderArchiveNavigationTree({ treeContentElement }, {
      kind: "folders",
      folders: treeFolders([{
        path: "docs/<unsafe>",
        label: "docs <unsafe>",
        depth: 1,
        canToggle: true,
        isExpanded: true,
        isActive: false,
        iconHtml: '<span class="tree-icon" data-icon="folder"></span>',
      }]),
      collapseLabel: "Collapse",
      expandLabel: "Expand",
    });

    const html = treeContentElement.innerHTML;
    expect(html).toContain('data-tree-path="docs/&lt;unsafe&gt;"');
    expect(html).toContain('aria-label="Collapse docs &lt;unsafe&gt;"');
    expect(html).toContain('<span class="tree-label">docs &lt;unsafe&gt;</span>');
  });

  it("renders create tree empty, loading, and no-entry messages", () => {
    const noSources = treeElement();
    renderCreateNavigationTree({ treeContentElement: noSources }, {
      kind: "empty",
      message: "Add files or folders to create an archive.",
    });

    expect(noSources.innerHTML).toContain("Add files or folders to create an archive.");

    const loading = treeElement();
    renderCreateNavigationTree({ treeContentElement: loading }, {
      kind: "empty",
      message: "Scanning sources...",
    });

    expect(loading.innerHTML).toContain("Scanning sources...");

    const noEntries = treeElement();
    renderCreateNavigationTree({ treeContentElement: noEntries }, {
      kind: "empty",
      message: "No entries will be added.",
    });

    expect(noEntries.innerHTML).toContain("No entries will be added.");
  });

  it("renders create tree folders with root label, compress data attributes, and active folder", () => {
    const treeContentElement = treeElement();

    renderCreateNavigationTree({ treeContentElement }, {
      kind: "folders",
      folders: treeFolders([
        {
          path: "",
          label: "suggested.zip",
          depth: 0,
          canToggle: false,
          isExpanded: true,
          isActive: false,
          iconHtml: '<span class="tree-icon" data-icon="source-root"></span>',
        },
        {
          path: "src",
          label: "src",
          depth: 1,
          canToggle: true,
          isExpanded: true,
          isActive: true,
          iconHtml: '<span class="tree-icon" data-icon="folder"></span>',
        },
      ]),
      collapseLabel: "Collapse",
      expandLabel: "Expand",
    });

    const html = treeContentElement.innerHTML;
    expect(html).toContain('data-compress-folder-path=""');
    expect(html).toContain('<span class="tree-label">suggested.zip</span>');
    expect(html).toContain('data-compress-tree-toggle data-compress-folder-path="src"');
    expect(html).toContain('aria-label="Collapse src"');
    expect(html).toContain('class="tree-item is-active"');
    expect(html).toContain('<span class="tree-icon" data-icon="source-root"></span>');
  });

  it("renders no-archive details with the open action contract", () => {
    const html = renderArchiveDetailsHtml({
      kind: "noArchive",
      title: "No archive open",
      message: "Open an archive first.",
      openArchiveLabel: "Open Archive",
    }, detailHelpers());

    expect(html).toContain('class="details-empty"');
    expect(html).toContain("<h3>No archive open</h3>");
    expect(html).toContain("<p>Open an archive first.</p>");
    expect(html).toContain('class="primary-action" type="button" data-details-action="open-archive"');
  });

  it("renders hidden-selection details with clear-search and archive-info actions", () => {
    const html = renderArchiveDetailsHtml({
      kind: "hiddenSelection",
      title: "Selection hidden by search",
      description: "Clear search to show selected entries.",
      actions: [
        { label: "Clear search", action: "clear-search", primary: true },
        { label: "Archive Info", action: "archive-info" },
      ],
      rows: [
        { label: "Selected", value: "2 entries selected" },
        { label: "Search", value: "needle" },
        { label: "Path", value: "docs/readme.txt" },
      ],
    }, detailHelpers());

    expect(html).toContain("<h3>Selection hidden by search</h3>");
    expect(html).toContain('class="primary-action" data-details-action="clear-search"');
    expect(html).toContain('data-details-action="archive-info"');
    expect(html).toContain("<dt>Selected</dt>");
    expect(html).toContain('data-copy-value="docs/readme.txt"');
  });

  it("renders archive summary rows with the provided icon", () => {
    const html = renderArchiveDetailsHtml({
      kind: "archiveSummary",
      title: "demo.zip",
      iconHtml: '<span class="detail-icon" data-icon="archive"></span>',
      rows: [
        { label: "Archive name", value: "demo.zip" },
        { label: "Path", value: "C:/archives/demo.zip" },
      ],
    }, detailHelpers());

    expect(html).toContain("archive-detail-block");
    expect(html).toContain('<span class="detail-icon" data-icon="archive"></span>');
    expect(html).toContain("<span>demo.zip</span>");
    expect(html).toContain("<dt>Archive name</dt>");
  });

  it("renders synthetic folder details", () => {
    const html = renderArchiveDetailsHtml({
      kind: "syntheticFolder",
      title: "docs",
      iconHtml: '<span class="detail-icon" data-icon="folder"></span>',
      rows: [
        { label: "Name", value: "docs" },
        { label: "Type", value: "Directory" },
        { label: "Path", value: "docs" },
      ],
    }, detailHelpers());

    expect(html).toContain('<span class="detail-icon" data-icon="folder"></span>');
    expect(html).toContain("<span>docs</span>");
    expect(html).toContain("<dt>Type</dt>");
    expect(html).toContain(">Directory</span>");
  });

  it("renders entry details with and without preview action", () => {
    const withPreview = renderArchiveDetailsHtml({
      kind: "entry",
      title: "image.png",
      iconHtml: '<span class="detail-icon" data-icon="entry"></span>',
      actions: [
        {
          label: "View",
          action: "preview",
          primary: true,
          title: "Opens a temporary copy.",
          ariaLabel: "View: Opens a temporary copy.",
        },
      ],
      rows: [{ label: "Path", value: "images/image.png" }],
    }, detailHelpers());

    expect(withPreview).toContain('class="primary-action" data-details-action="preview"');
    expect(withPreview).toContain('title="Opens a temporary copy."');
    expect(withPreview).toContain('aria-label="View: Opens a temporary copy."');

    const withoutPreview = renderArchiveDetailsHtml({
      kind: "entry",
      title: "docs",
      iconHtml: '<span class="detail-icon" data-icon="directory"></span>',
      actions: [],
      rows: [{ label: "Path", value: "docs" }],
    }, detailHelpers());

    expect(withoutPreview).not.toContain("detail-actions");
    expect(withoutPreview).not.toContain('data-details-action="preview"');
  });

  it("renders multiple-selection actions", () => {
    const html = renderArchiveDetailsHtml({
      kind: "multipleSelection",
      title: "3 entries selected",
      actions: [
        { label: "Extract Selected", action: "extract-selected", primary: true },
        { label: "Test Selected", action: "test-selected" },
        { label: "Properties", action: "properties" },
        { label: "Archive Info", action: "archive-info" },
      ],
      rows: [{ label: "Entries", value: "3" }],
    }, detailHelpers());

    expect(html).toContain("<h3>3 entries selected</h3>");
    expect(html).toContain('class="primary-action" data-details-action="extract-selected"');
    expect(html).toContain('data-details-action="test-selected"');
    expect(html).toContain('data-details-action="properties"');
    expect(html).toContain('data-details-action="archive-info"');
  });

  it("escapes copyable details and preserves middle-truncated sr-only values", () => {
    const longPath = "C:/very/long/archive/path/with/<unsafe>/segments/and/a/final/file-name.txt";
    const html = renderArchiveDetailsHtml({
      kind: "entry",
      title: "<unsafe>.txt",
      iconHtml: '<span class="detail-icon" data-icon="entry"></span>',
      actions: [],
      rows: [
        { label: "Path", value: longPath },
        { label: "Empty", value: null },
      ],
    }, detailHelpers());

    expect(html).toContain("<span>&lt;unsafe&gt;.txt</span>");
    expect(html).toContain('class="detail-copyable"');
    expect(html).toContain('data-copy-value="C:/very/long/archive/path/with/&lt;unsafe&gt;/segments/and/a/final/file-name.txt"');
    expect(html).toContain('class="detail-value detail-value-middle" aria-hidden="true"');
    expect(html).toContain('<span class="sr-only">C:/very/long/archive/path/with/&lt;unsafe&gt;/segments/and/a/final/file-name.txt</span>');
    expect(html).toContain('aria-label="Copy Path"');
    expect(html).toContain('<span data-icon="copy"></span>');
    expect(html).not.toContain("<dt>Empty</dt>");
  });

  it("renders loading and error states without showing the start-empty panel", () => {
    const loading = createElements();

    renderArchiveWorkspaceTable(loading.elements, options({ browseState: "loading" }));

    expect(loading.elements.tableBody.innerHTML).toContain("Loading archive entries...");
    expect(loading.elements.tableBody.innerHTML).toContain('colspan="5"');
    expect(loading.selectAllInput.checked).toBe(false);
    expect(loading.selectAllInput.indeterminate).toBe(false);
    expect(loading.elements.archiveEmptyStateElement.hidden).toBe(true);
    expect(loading.tableShellClasses.has("has-start-empty")).toBe(false);

    const failed = createElements();
    renderArchiveWorkspaceTable(failed.elements, options({
      browseState: "error",
      browseError: "Could not parse archive",
    }));

    expect(failed.elements.tableBody.innerHTML).toContain("Could not parse archive");
    expect(failed.selectAllInput.checked).toBe(false);
    expect(failed.elements.archiveEmptyStateElement.hidden).toBe(true);
  });

  it("renders the no-archive start-empty state and clears the search count", () => {
    const view = createElements();
    view.elements.searchCountElement.textContent = "stale";

    renderArchiveWorkspaceTable(view.elements, options({
      browseState: "idle",
      currentArchivePath: null,
    }));

    expect(view.elements.tableBody.innerHTML).toContain("empty-row");
    expect(view.elements.tableBody.innerHTML).toContain("Open or create an archive to begin.");
    expect(view.elements.searchCountElement.textContent).toBe("");
    expect(view.elements.archiveEmptyStateElement.hidden).toBe(false);
    expect(view.elements.entryTable.hidden).toBe(false);
    expect(view.tableShellClasses.has("has-start-empty")).toBe(true);
    expect(view.selectAllInput.checked).toBe(false);
  });

  it("distinguishes search-empty and folder-empty rows", () => {
    const searchEmpty = createElements();

    renderArchiveWorkspaceTable(searchEmpty.elements, options({
      currentArchivePath: "C:/archives/demo.zip",
      searchQuery: "needle",
      selection: {
        selectedPaths: [],
        focusedPath: "",
        visibleSelectablePaths: [],
        visibleSelectedCount: 0,
      },
    }));

    expect(searchEmpty.elements.tableBody.innerHTML).toContain("search-empty-row");
    expect(searchEmpty.elements.tableBody.innerHTML).toContain("No entries match &quot;needle&quot;.");
    expect(searchEmpty.elements.searchCountElement.textContent).toBe("0 results");

    const folderEmpty = createElements();
    renderArchiveWorkspaceTable(folderEmpty.elements, options({
      currentArchivePath: "C:/archives/demo.zip",
      searchQuery: "",
    }));

    expect(folderEmpty.elements.tableBody.innerHTML).not.toContain("search-empty-row");
    expect(folderEmpty.elements.tableBody.innerHTML).toContain("This folder has no visible entries.");
    expect(folderEmpty.elements.archiveEmptyStateElement.hidden).toBe(true);
  });

  it("updates select-all checked and indeterminate states", () => {
    const checked = createElements();

    renderArchiveWorkspaceTable(checked.elements, options({
      currentArchivePath: "C:/archives/demo.zip",
      rows: [entryRow("docs/a.txt"), entryRow("docs/b.txt")],
      selection: {
        selectedPaths: ["docs/a.txt", "docs/b.txt"],
        focusedPath: "docs/a.txt",
        visibleSelectablePaths: ["docs/a.txt", "docs/b.txt"],
        visibleSelectedCount: 2,
      },
    }));

    expect(checked.selectAllInput.checked).toBe(true);
    expect(checked.selectAllInput.indeterminate).toBe(false);

    const partial = createElements();
    renderArchiveWorkspaceTable(partial.elements, options({
      currentArchivePath: "C:/archives/demo.zip",
      rows: [entryRow("docs/a.txt"), entryRow("docs/b.txt")],
      selection: {
        selectedPaths: ["docs/a.txt"],
        focusedPath: "docs/a.txt",
        visibleSelectablePaths: ["docs/a.txt", "docs/b.txt"],
        visibleSelectedCount: 1,
      },
    }));

    expect(partial.selectAllInput.checked).toBe(false);
    expect(partial.selectAllInput.indeterminate).toBe(true);
  });

  it("renders parent, folder, and entry row datasets, classes, icons, and drag attributes", () => {
    const view = createElements();

    renderArchiveWorkspaceTable(view.elements, options({
      currentArchivePath: "C:/archives/demo.zip",
      searchQuery: "docs",
      rows: [
        parentRow(""),
        folderRow("docs"),
        entryRow("docs/readme.txt", { size: 123, compressedSize: 45 }),
      ],
      selection: {
        selectedPaths: ["docs"],
        focusedPath: "docs",
        visibleSelectablePaths: ["docs", "docs/readme.txt"],
        visibleSelectedCount: 1,
      },
    }));

    const html = view.elements.tableBody.innerHTML;
    expect(html).toContain('class="folder-row parent-row"');
    expect(html).toContain('data-folder-path=""');
    expect(html).toContain("Open parent folder");
    expect(html).toContain('class="folder-row is-selected is-focused-row"');
    expect(html).toContain('data-folder-path="docs"');
    expect(html).toContain('data-entry-path="docs"');
    expect(html).toContain('draggable="true" data-native-drag="entry"');
    expect(html).toContain("Select docs");
    expect(html).toContain('data-entry-path="docs/readme.txt"');
    expect(html).toContain('<span class="row-secondary">docs/readme.txt</span>');
    expect(html).toContain('<span class="sr-only">Icon entry:</span>');
    expect(html).toContain(">123 B</td>");
  });

  it("renders header labels, sort state, and minimum table width", () => {
    const view = createElements();
    const columns = visibleColumns(resetColumnSettings()).map((column) =>
      column.id === "name" ? { ...column, width: 500 } : column,
    );

    renderArchiveWorkspaceTable(view.elements, options({
      columns,
      sortKey: "size",
      sortAscending: false,
    }));

    expect(view.elements.entryTable.style.minWidth).toBe(`${tableMinimumWidth(columns)}px`);
    expect(view.elements.tableHead.innerHTML).toContain('aria-label="Select visible entries"');
    expect(view.elements.tableHead.innerHTML).toContain('data-column-id="name"');
    expect(view.elements.tableHead.innerHTML).toContain('title="Name"');
    expect(view.elements.tableHead.innerHTML).toContain('data-column-id="size"');
    expect(view.elements.tableHead.innerHTML).toContain('aria-sort="descending"');
    expect(view.elements.tableHead.innerHTML).toContain('<span class="sort-indicator" aria-hidden="true">v</span>');
    expect(view.elements.tableHead.innerHTML).toContain('style="width: 500px; min-width: 140px"');
  });
});

function options(
  overrides: Partial<ArchiveWorkspaceTableRenderOptions> = {},
): ArchiveWorkspaceTableRenderOptions {
  return {
    browseState: "loaded",
    browseError: "",
    currentArchivePath: "C:/archives/demo.zip",
    rows: [],
    searchQuery: "",
    flatView: false,
    selection: {
      selectedPaths: [],
      focusedPath: "",
      visibleSelectablePaths: [],
      visibleSelectedCount: 0,
    },
    columns: visibleColumns(resetColumnSettings()),
    sortKey: "name",
    sortAscending: true,
    translator: createTranslator("en"),
    formatSearchCount: (count) => count === 1 ? `${count} result` : `${count} results`,
    renderRowIcon: (row) => ({
      html: `<span class="row-icon" data-icon="${row.rowType}"></span>`,
      label: `Icon ${row.rowType}`,
    }),
    nativeDragAttributes: 'draggable="true" data-native-drag="entry"',
    ...overrides,
  };
}

function parentRow(path: string): ArchiveTableRow {
  return {
    rowType: "parent",
    rowId: `parent:${path}`,
    path,
    name: "..",
    currentFolderPath: "docs",
  };
}

function folderRow(path: string): ArchiveTableRow {
  return {
    rowType: "folder",
    rowId: `folder:${path}`,
    path,
    name: path.split("/").at(-1) ?? path,
    entry: {
      path,
      kind: "directory",
    },
    isSynthetic: false,
  };
}

function entryRow(
  path: string,
  entry: Partial<Extract<ArchiveTableRow, { rowType: "entry" }>["entry"]> = {},
): ArchiveTableRow {
  return {
    rowType: "entry",
    rowId: `entry:${path}`,
    path,
    name: path.split("/").at(-1) ?? path,
    entry: {
      path,
      kind: "file",
      ...entry,
    },
  };
}

function createElements(): {
  elements: ArchiveWorkspaceTableElements;
  selectAllInput: HTMLInputElement;
  tableShellClasses: Set<string>;
} {
  const selectAllInput = checkbox();
  const tableShellClasses = new Set<string>();
  return {
    selectAllInput,
    tableShellClasses,
    elements: {
      tableHead: section(),
      tableBody: section(),
      entryTable: table(),
      tableShellElement: elementWithClassSet(tableShellClasses),
      archiveEmptyStateElement: element(),
      searchCountElement: element(),
      findSelectAllInput: () => selectAllInput,
    },
  };
}

function section(): HTMLTableSectionElement {
  return {
    innerHTML: "",
    querySelector: () => null,
  } as unknown as HTMLTableSectionElement;
}

function table(): HTMLTableElement {
  return {
    hidden: false,
    style: {
      minWidth: "",
    },
  } as unknown as HTMLTableElement;
}

function element(): HTMLElement {
  return {
    hidden: false,
    textContent: "",
    classList: {
      toggle: () => false,
    },
  } as unknown as HTMLElement;
}

function elementWithClassSet(classes: Set<string>): HTMLElement {
  return {
    hidden: false,
    classList: {
      toggle: (className: string, force?: boolean) => {
        if (force) {
          classes.add(className);
          return true;
        }
        classes.delete(className);
        return false;
      },
    },
  } as unknown as HTMLElement;
}

function checkbox(): HTMLInputElement {
  return {
    checked: false,
    indeterminate: false,
  } as HTMLInputElement;
}

function treeElement(): HTMLElement {
  return {
    innerHTML: "",
  } as HTMLElement;
}

function treeFolders(folders: readonly ArchiveWorkspaceTreeFolder[]): readonly ArchiveWorkspaceTreeFolder[] {
  return folders;
}

function detailHelpers(): { copyLabel: string; copyIconHtml: string } {
  return {
    copyLabel: "Copy",
    copyIconHtml: '<span data-icon="copy"></span>',
  };
}
