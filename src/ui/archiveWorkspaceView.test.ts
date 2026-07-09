import { describe, expect, it } from "vitest";

import {
  resetColumnSettings,
  visibleColumns,
  type ArchiveTableColumn,
  type ArchiveTableRow,
} from "../app/archiveTable";
import { createTranslator } from "../app/i18n/translator";
import {
  archiveEntryPathsInViewportRect,
  renderArchiveBrowseMessage,
  renderArchiveCommandControlState,
  renderArchiveNavigationTree,
  renderArchiveMetaText,
  renderArchivePathBar,
  renderArchiveWorkspaceModeChrome,
  renderArchiveWorkspaceTable,
  renderCreateNavigationTree,
  renderArchiveDetailsHtml,
  syncArchiveVisibleSelection,
  tableMinimumWidth,
  type ArchiveCommandControlElements,
  type ArchivePathBarElements,
  type ArchiveWorkspaceModeChromeElements,
  type ArchiveWorkspaceTreeFolder,
  type ArchiveWorkspaceTableElements,
  type ArchiveWorkspaceTableRenderOptions,
} from "./archiveWorkspaceView";

describe("archive workspace view", () => {
  it("renders browse status classes and explicit messages", () => {
    const messageElement = element();

    renderArchiveBrowseMessage({ messageElement }, {
      browseState: "loading",
      message: "Loading archive entries...",
    });

    expect(messageElement.className).toBe("status status-loading");
    expect(messageElement.textContent).toBe("Loading archive entries...");

    renderArchiveBrowseMessage({ messageElement }, {
      browseState: "error",
      message: "Could not parse archive",
    });

    expect(messageElement.className).toBe("status status-error");
    expect(messageElement.textContent).toBe("Could not parse archive");

    renderArchiveBrowseMessage({ messageElement }, {
      browseState: "loaded",
      message: "12 entries loaded.",
    });

    expect(messageElement.className).toBe("status status-loaded");
    expect(messageElement.textContent).toBe("12 entries loaded.");
  });

  it("updates browse status class without replacing an omitted message", () => {
    const messageElement = element();
    messageElement.textContent = "Previous message";

    renderArchiveBrowseMessage({ messageElement }, {
      browseState: "empty",
    });

    expect(messageElement.className).toBe("status status-empty");
    expect(messageElement.textContent).toBe("Previous message");
  });

  it("renders explicit browse messages through textContent semantics", () => {
    const messageElement = element();
    messageElement.innerHTML = "";

    renderArchiveBrowseMessage({ messageElement }, {
      browseState: "error",
      message: "<img src=x onerror=alert(1)> & unsafe",
    });

    expect(messageElement.textContent).toBe("<img src=x onerror=alert(1)> & unsafe");
    expect(messageElement.innerHTML).toBe("");
  });

  it("renders the no-archive path bar state", () => {
    const view = createPathBarElements();

    renderArchivePathBar(view.elements, {
      kind: "empty",
      emptyLabel: "Open or create an archive to begin.",
      documentTitle: "ZManager",
    });

    expect(view.pathFieldInput.value).toBe("Open or create an archive to begin.");
    expect(view.pathFieldInput.disabled).toBe(true);
    expect(view.pathFieldInput.readOnly).toBe(true);
    expect(view.pathCrumbsElement.hidden).toBe(true);
    expect(view.pathCrumbsElement.textContent).toBe("Open or create an archive to begin.");
    expect(view.document.title).toBe("ZManager");
  });

  it("renders archive path bar breadcrumbs with escaped names and paths", () => {
    const view = createPathBarElements();

    renderArchivePathBar(view.elements, {
      kind: "archive",
      displayPath: "C:\\archives\\demo.zip\\docs/<unsafe>",
      documentTitle: "demo.zip\\docs\\<unsafe> - ZManager",
      crumbs: [
        { name: "demo.zip", path: "" },
        { name: "docs & <unsafe>", path: "docs/<unsafe>" },
      ],
    });

    expect(view.pathFieldInput.value).toBe("C:\\archives\\demo.zip\\docs/<unsafe>");
    expect(view.pathFieldInput.disabled).toBe(false);
    expect(view.pathFieldInput.readOnly).toBe(true);
    expect(view.pathCrumbsElement.hidden).toBe(false);
    expect(view.document.title).toBe("demo.zip\\docs\\<unsafe> - ZManager");
    expect(view.pathCrumbsElement.innerHTML).toContain('data-crumb-path=""');
    expect(view.pathCrumbsElement.innerHTML).toContain(">demo.zip</button>");
    expect(view.pathCrumbsElement.innerHTML).toContain('<span aria-hidden="true">&gt;</span>');
    expect(view.pathCrumbsElement.innerHTML).toContain('data-crumb-path="docs/&lt;unsafe&gt;"');
    expect(view.pathCrumbsElement.innerHTML).toContain(">docs &amp; &lt;unsafe&gt;</button>");
    expect(view.pathCrumbsElement.innerHTML).toContain('aria-keyshortcuts="Enter Space"');
  });

  it("renders archive meta text", () => {
    const metaElement = element();

    renderArchiveMetaText({ metaElement }, {
      text: "demo.zip > docs - 3 entries",
    });

    expect(metaElement.textContent).toBe("demo.zip > docs - 3 entries");
  });

  it("renders compress workspace mode chrome", () => {
    const chrome = createWorkspaceChromeElements();

    renderArchiveWorkspaceModeChrome(chrome.elements, {
      mode: "compress",
      compressActive: true,
      extractActive: false,
      compressSurfaceHidden: false,
      tableShellHidden: true,
      refreshArchiveHidden: true,
      messageHidden: true,
      detailsHidden: true,
      compressOptionsHidden: false,
      detailsPaneTitle: "Options",
      detailsPaneTitleI18nKey: "compress.options",
      workspaceTitle: "Create Archive",
      metaText: "Choose files to compress.",
      statusSelectionCountText: "2 sources staged",
      statusSelectionSizeText: "",
      statusFocusedSizeText: "",
      statusFocusedModifiedText: "",
    });

    expect(chrome.workspaceElement.dataset.mode).toBe("compress");
    expect(chrome.compressClasses.has("is-active")).toBe(true);
    expect(chrome.extractClasses.has("is-active")).toBe(false);
    expect(chrome.compressAttributes["aria-selected"]).toBe("true");
    expect(chrome.compressAttributes["aria-pressed"]).toBe("true");
    expect(chrome.extractAttributes["aria-selected"]).toBe("false");
    expect(chrome.extractAttributes["aria-pressed"]).toBe("false");
    expect(chrome.compressSurfaceElement.hidden).toBe(false);
    expect(chrome.tableShellElement.hidden).toBe(true);
    expect(chrome.refreshArchiveButton.hidden).toBe(true);
    expect(chrome.messageElement.hidden).toBe(true);
    expect(chrome.detailsElement.hidden).toBe(true);
    expect(chrome.compressOptionsPanel.hidden).toBe(false);
    expect(chrome.detailsPaneTitleElement.textContent).toBe("Options");
    expect(chrome.detailsPaneTitleElement.dataset.i18nText).toBe("compress.options");
    expect(chrome.workspaceTitleElement.textContent).toBe("Create Archive");
    expect(chrome.metaElement.textContent).toBe("Choose files to compress.");
    expect(chrome.statusSelectionCountElement.textContent).toBe("2 sources staged");
    expect(chrome.statusSelectionSizeElement.textContent).toBe("");
    expect(chrome.statusFocusedSizeElement.textContent).toBe("");
    expect(chrome.statusFocusedModifiedElement.textContent).toBe("");
  });

  it("renders extract workspace mode chrome without overwriting omitted status fields", () => {
    const chrome = createWorkspaceChromeElements();
    chrome.statusSelectionCountElement.textContent = "stale selection";
    chrome.metaElement.textContent = "stale meta";

    renderArchiveWorkspaceModeChrome(chrome.elements, {
      mode: "extract",
      compressActive: false,
      extractActive: true,
      compressSurfaceHidden: true,
      tableShellHidden: false,
      refreshArchiveHidden: false,
      messageHidden: false,
      detailsHidden: false,
      compressOptionsHidden: true,
      detailsPaneTitle: "Details",
      detailsPaneTitleI18nKey: "pane.details",
      workspaceTitle: "Browse Archive",
      metaText: "Open an archive to begin.",
    });

    expect(chrome.workspaceElement.dataset.mode).toBe("extract");
    expect(chrome.compressClasses.has("is-active")).toBe(false);
    expect(chrome.extractClasses.has("is-active")).toBe(true);
    expect(chrome.compressAttributes["aria-selected"]).toBe("false");
    expect(chrome.extractAttributes["aria-selected"]).toBe("true");
    expect(chrome.compressSurfaceElement.hidden).toBe(true);
    expect(chrome.tableShellElement.hidden).toBe(false);
    expect(chrome.refreshArchiveButton.hidden).toBe(false);
    expect(chrome.messageElement.hidden).toBe(false);
    expect(chrome.detailsElement.hidden).toBe(false);
    expect(chrome.compressOptionsPanel.hidden).toBe(true);
    expect(chrome.detailsPaneTitleElement.textContent).toBe("Details");
    expect(chrome.detailsPaneTitleElement.dataset.i18nText).toBe("pane.details");
    expect(chrome.workspaceTitleElement.textContent).toBe("Browse Archive");
    expect(chrome.metaElement.textContent).toBe("Open an archive to begin.");
    expect(chrome.statusSelectionCountElement.textContent).toBe("stale selection");
  });

  it("renders command and search control disabled states", () => {
    const controls = createCommandControlElements();

    renderArchiveCommandControlState(controls.elements, {
      searchDisabled: true,
      searchSubmitDisabled: true,
      clearSearchDisabled: true,
      selectAllDisabled: true,
      navBackDisabled: true,
    });

    expect(controls.searchInput.disabled).toBe(true);
    expect(controls.searchInputAttributes["aria-disabled"]).toBe("true");
    expect(controls.searchSubmitButton.disabled).toBe(true);
    expect(controls.searchSubmitAttributes["aria-disabled"]).toBe("true");
    expect(controls.clearSearchButton.disabled).toBe(true);
    expect(controls.clearSearchAttributes["aria-disabled"]).toBe("true");
    expect(controls.selectAllInput.disabled).toBe(true);
    expect(controls.navBackButton.disabled).toBe(true);

    renderArchiveCommandControlState(controls.elements, {
      searchDisabled: false,
      searchSubmitDisabled: false,
      clearSearchDisabled: true,
      selectAllDisabled: false,
      navBackDisabled: false,
    });

    expect(controls.searchInput.disabled).toBe(false);
    expect(controls.searchInputAttributes["aria-disabled"]).toBe("false");
    expect(controls.searchSubmitButton.disabled).toBe(false);
    expect(controls.searchSubmitAttributes["aria-disabled"]).toBe("false");
    expect(controls.clearSearchButton.disabled).toBe(true);
    expect(controls.clearSearchAttributes["aria-disabled"]).toBe("true");
    expect(controls.selectAllInput.disabled).toBe(false);
    expect(controls.navBackButton.disabled).toBe(false);
  });

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

  it("syncs archive select-all state for none, all, and partial visible selection", () => {
    const view = createSelectionSyncElements([]);

    syncArchiveVisibleSelection(view.elements, {
      selectedPaths: [],
      focusedPath: "",
      visibleSelectablePaths: ["docs/a.txt", "docs/b.txt"],
      visibleSelectedCount: 0,
    });

    expect(view.selectAllInput.checked).toBe(false);
    expect(view.selectAllInput.indeterminate).toBe(false);

    syncArchiveVisibleSelection(view.elements, {
      selectedPaths: ["docs/a.txt", "docs/b.txt"],
      focusedPath: "docs/a.txt",
      visibleSelectablePaths: ["docs/a.txt", "docs/b.txt"],
      visibleSelectedCount: 2,
    });

    expect(view.selectAllInput.checked).toBe(true);
    expect(view.selectAllInput.indeterminate).toBe(false);

    syncArchiveVisibleSelection(view.elements, {
      selectedPaths: ["docs/a.txt"],
      focusedPath: "docs/a.txt",
      visibleSelectablePaths: ["docs/a.txt", "docs/b.txt"],
      visibleSelectedCount: 1,
    });

    expect(view.selectAllInput.checked).toBe(false);
    expect(view.selectAllInput.indeterminate).toBe(true);
  });

  it("syncs selected and focused entry rows while ignoring non-entry rows", () => {
    const selectedRow = tableRow("docs/a.txt");
    const focusedRow = tableRow("docs/b.txt");
    const nonEntryRow = tableRow(null);
    const view = createSelectionSyncElements([selectedRow, focusedRow], nonEntryRow);

    syncArchiveVisibleSelection(view.elements, {
      selectedPaths: ["docs/a.txt"],
      focusedPath: "docs/b.txt",
      visibleSelectablePaths: ["docs/a.txt", "docs/b.txt"],
      visibleSelectedCount: 1,
    });

    expect(selectedRow.classes.has("is-selected")).toBe(true);
    expect(selectedRow.classes.has("is-focused-row")).toBe(false);
    expect(selectedRow.attributes["aria-selected"]).toBe("true");
    expect(selectedRow.checkbox.checked).toBe(true);

    expect(focusedRow.classes.has("is-selected")).toBe(false);
    expect(focusedRow.classes.has("is-focused-row")).toBe(true);
    expect(focusedRow.attributes["aria-selected"]).toBe("false");
    expect(focusedRow.checkbox.checked).toBe(false);

    expect(nonEntryRow.classes.size).toBe(0);
    expect(nonEntryRow.attributes).toEqual({});
    expect(nonEntryRow.checkbox.checked).toBe(false);
  });

  it("returns entry paths for rows intersecting a viewport rectangle", () => {
    const insideRow = tableRow("docs/a.txt", { left: 10, top: 10, right: 60, bottom: 40 });
    const outsideRow = tableRow("docs/b.txt", { left: 80, top: 80, right: 120, bottom: 120 });
    const missingPathRow = tableRow("", { left: 20, top: 20, right: 30, bottom: 30 });
    const view = createSelectionSyncElements([insideRow, outsideRow, missingPathRow]);

    expect(archiveEntryPathsInViewportRect(view.elements, {
      left: 0,
      top: 0,
      right: 70,
      bottom: 70,
    })).toEqual(["docs/a.txt"]);
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

type FakeTableRow = HTMLTableRowElement & {
  attributes: Record<string, string>;
  checkbox: HTMLInputElement;
  classes: Set<string>;
};

function createSelectionSyncElements(
  rows: readonly FakeTableRow[],
  ignoredRow?: FakeTableRow,
): {
  elements: { tableBody: HTMLTableSectionElement; selectAllInput: HTMLInputElement };
  selectAllInput: HTMLInputElement;
  ignoredRow?: FakeTableRow;
} {
  const selectAllInput = checkbox();
  const tableBody = {
    querySelectorAll: (selector: string) => selector === "tr[data-entry-path]" ? rows : [],
  } as unknown as HTMLTableSectionElement;
  return {
    elements: {
      tableBody,
      selectAllInput,
    },
    selectAllInput,
    ignoredRow,
  };
}

function tableRow(
  entryPath: string | null,
  rect: Partial<Pick<DOMRect, "left" | "top" | "right" | "bottom">> = {},
): FakeTableRow {
  const attributes: Record<string, string> = {};
  const classes = new Set<string>();
  const checkboxInput = checkbox();
  const boundingRect = {
    left: rect.left ?? 0,
    top: rect.top ?? 0,
    right: rect.right ?? 0,
    bottom: rect.bottom ?? 0,
  } as DOMRect;
  return {
    dataset: entryPath === null ? {} : { entryPath },
    attributes,
    checkbox: checkboxInput,
    classes,
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
    setAttribute: (name: string, value: string) => {
      attributes[name] = value;
    },
    getBoundingClientRect: () => boundingRect,
    querySelector: (selector: string) => selector === "input[type='checkbox']" ? checkboxInput : null,
  } as unknown as FakeTableRow;
}

function createPathBarElements(): {
  elements: ArchivePathBarElements;
  pathFieldInput: HTMLInputElement;
  pathCrumbsElement: HTMLElement;
  document: Pick<Document, "title">;
} {
  const pathFieldInput = input();
  const pathCrumbsElement = element();
  const document = { title: "" };
  return {
    elements: {
      pathFieldInput,
      pathCrumbsElement,
      document,
    },
    pathFieldInput,
    pathCrumbsElement,
    document,
  };
}

function createWorkspaceChromeElements(): {
  elements: ArchiveWorkspaceModeChromeElements;
  workspaceElement: HTMLElement;
  modeCompressButton: HTMLButtonElement;
  modeExtractButton: HTMLButtonElement;
  compressClasses: Set<string>;
  extractClasses: Set<string>;
  compressAttributes: Record<string, string>;
  extractAttributes: Record<string, string>;
  compressSurfaceElement: HTMLElement;
  tableShellElement: HTMLElement;
  refreshArchiveButton: HTMLElement;
  messageElement: HTMLElement;
  detailsElement: HTMLElement;
  compressOptionsPanel: HTMLElement;
  detailsPaneTitleElement: HTMLElement;
  workspaceTitleElement: HTMLElement;
  metaElement: HTMLElement;
  statusSelectionCountElement: HTMLElement;
  statusSelectionSizeElement: HTMLElement;
  statusFocusedSizeElement: HTMLElement;
  statusFocusedModifiedElement: HTMLElement;
} {
  const workspaceElement = element();
  const compressClasses = new Set<string>();
  const extractClasses = new Set<string>();
  const compressAttributes: Record<string, string> = {};
  const extractAttributes: Record<string, string> = {};
  const modeCompressButton = button(compressClasses, compressAttributes);
  const modeExtractButton = button(extractClasses, extractAttributes);
  const compressSurfaceElement = element();
  const tableShellElement = element();
  const refreshArchiveButton = element();
  const messageElement = element();
  const detailsElement = element();
  const compressOptionsPanel = element();
  const detailsPaneTitleElement = element();
  const workspaceTitleElement = element();
  const metaElement = element();
  const statusSelectionCountElement = element();
  const statusSelectionSizeElement = element();
  const statusFocusedSizeElement = element();
  const statusFocusedModifiedElement = element();

  return {
    elements: {
      workspaceElement,
      modeCompressButton,
      modeExtractButton,
      compressSurfaceElement,
      tableShellElement,
      refreshArchiveButton,
      messageElement,
      detailsElement,
      compressOptionsPanel,
      detailsPaneTitleElement,
      workspaceTitleElement,
      metaElement,
      statusSelectionCountElement,
      statusSelectionSizeElement,
      statusFocusedSizeElement,
      statusFocusedModifiedElement,
    },
    workspaceElement,
    modeCompressButton,
    modeExtractButton,
    compressClasses,
    extractClasses,
    compressAttributes,
    extractAttributes,
    compressSurfaceElement,
    tableShellElement,
    refreshArchiveButton,
    messageElement,
    detailsElement,
    compressOptionsPanel,
    detailsPaneTitleElement,
    workspaceTitleElement,
    metaElement,
    statusSelectionCountElement,
    statusSelectionSizeElement,
    statusFocusedSizeElement,
    statusFocusedModifiedElement,
  };
}

function createCommandControlElements(): {
  elements: ArchiveCommandControlElements;
  searchInput: HTMLInputElement;
  searchSubmitButton: HTMLButtonElement;
  clearSearchButton: HTMLButtonElement;
  selectAllInput: HTMLInputElement;
  navBackButton: HTMLButtonElement;
  searchInputAttributes: Record<string, string>;
  searchSubmitAttributes: Record<string, string>;
  clearSearchAttributes: Record<string, string>;
} {
  const searchInputAttributes: Record<string, string> = {};
  const searchSubmitAttributes: Record<string, string> = {};
  const clearSearchAttributes: Record<string, string> = {};
  const searchInput = input(searchInputAttributes);
  const searchSubmitButton = button(undefined, searchSubmitAttributes);
  const clearSearchButton = button(undefined, clearSearchAttributes);
  const selectAllInput = input();
  const navBackButton = button();
  return {
    elements: {
      searchInput,
      searchSubmitButton,
      clearSearchButton,
      selectAllInput,
      navBackButton,
    },
    searchInput,
    searchSubmitButton,
    clearSearchButton,
    selectAllInput,
    navBackButton,
    searchInputAttributes,
    searchSubmitAttributes,
    clearSearchAttributes,
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
    className: "",
    hidden: false,
    textContent: "",
    innerHTML: "",
    dataset: {},
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
    disabled: false,
  } as HTMLInputElement;
}

function input(attributes: Record<string, string> = {}): HTMLInputElement {
  return {
    value: "",
    checked: false,
    indeterminate: false,
    disabled: false,
    readOnly: false,
    setAttribute: (name: string, value: string) => {
      attributes[name] = value;
    },
  } as unknown as HTMLInputElement;
}

function button(
  classes = new Set<string>(),
  attributes: Record<string, string> = {},
): HTMLButtonElement {
  return {
    hidden: false,
    disabled: false,
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
    setAttribute: (name: string, value: string) => {
      attributes[name] = value;
    },
  } as unknown as HTMLButtonElement;
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
