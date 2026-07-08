import { describe, expect, it } from "vitest";

import { createTranslator } from "../app/i18n/translator";
import {
  applyCompressSourceColumnWidths,
  bindCreateSourceListActions,
  findCompressSourceColumnHeader,
  findCompressSourceRowByPath,
  focusFirstCompressSourceRow,
  getCompressSourceRows,
  getCompressSourceSelectableRows,
  readCompressIncludeAllChecked,
  readCompressSourceColumnWidths,
  renderCompressIncludeAllControl,
  renderCompressSourceTable,
  renderCreateActionState,
  renderCreateDestinationHistory,
  readCreateOptionControlPatch,
  renderCreateOptionControls,
  renderCreatePlanStatus,
  renderCreatePlanSummary,
  renderCreateSourceList,
  syncCompressSourceInclusionControls,
  syncCompressSourceSelectionUi,
  type CompressSourceTableRowModel,
  type CompressSourceTableElements,
  type CreateActionStateElements,
  type CreateDestinationHistoryElements,
  type CreateOptionControlElements,
  type CreatePlanSummaryData,
  type CreatePlanSummaryElements,
  type CreateSourceListElements,
} from "./createWorkspaceView";

describe("create workspace view", () => {
  it("renders the empty source list and disables source controls", () => {
    const view = sourceListElements();

    renderCreateSourceList(view.elements, {
      sources: [],
      isEmpty: true,
      includeAllDisabled: true,
      excludeAllDisabled: true,
      noSourcesLabel: "No sources yet.",
      removeSourceLabel: "Remove",
    });

    expect(view.elements.sourceListElement.innerHTML).toBe('<li class="empty">No sources yet.</li>');
    expect(view.elements.clearSourcesButton.hidden).toBe(true);
    expect(view.elements.clearSourcesButton.disabled).toBe(true);
    expect(view.elements.includeAllSourcesButton.hidden).toBe(true);
    expect(view.elements.excludeAllSourcesButton.hidden).toBe(true);
    expect(view.elements.includeAllSourcesButton.disabled).toBe(true);
    expect(view.elements.excludeAllSourcesButton.disabled).toBe(true);
  });

  it("renders sources with escaped labels and remove-button data attributes", () => {
    const view = sourceListElements();

    renderCreateSourceList(view.elements, {
      sources: ["C:/safe/file.txt", "C:/unsafe/<name>.txt"],
      isEmpty: false,
      includeAllDisabled: false,
      excludeAllDisabled: true,
      noSourcesLabel: "No sources yet.",
      removeSourceLabel: "Remove <source>",
    });

    const html = view.elements.sourceListElement.innerHTML;
    expect(html).toContain('data-source-path="C:/safe/file.txt"');
    expect(html).toContain("<span>C:/safe/file.txt</span>");
    expect(html).toContain('data-source-path="C:/unsafe/&lt;name&gt;.txt"');
    expect(html).toContain("<span>C:/unsafe/&lt;name&gt;.txt</span>");
    expect(html).toContain("<button type=\"button\" data-source-remove>Remove &lt;source&gt;</button>");
    expect(view.elements.clearSourcesButton.hidden).toBe(false);
    expect(view.elements.clearSourcesButton.disabled).toBe(false);
    expect(view.elements.includeAllSourcesButton.disabled).toBe(false);
    expect(view.elements.excludeAllSourcesButton.disabled).toBe(true);
  });

  it("decodes source remove clicks from rendered rows", () => {
    let unbound = false;
    let clickHandler: (event: MouseEvent) => void = (_event: MouseEvent) => {
      throw new Error("click handler was not bound");
    };
    const sourceListElement = {
      addEventListener: (_type: string, handler: (event: MouseEvent) => void) => {
        clickHandler = handler;
      },
      removeEventListener: (_type: string, handler: (event: MouseEvent) => void) => {
        if (clickHandler === handler) {
          unbound = true;
        }
      },
    } as unknown as HTMLUListElement;
    const removed: string[] = [];

    const unbind = bindCreateSourceListActions({ sourceListElement }, {
      onRemoveSource: (path) => removed.push(path),
    });

    const button = {
      closest: (selector: string) => selector === "[data-source-remove]"
        ? {
            closest: () => ({ dataset: { sourcePath: "C:/unsafe/<name>.txt" } }),
          }
        : null,
    };
    clickHandler?.({
      target: button,
      preventDefault: () => undefined,
    } as unknown as MouseEvent);
    unbind();

    expect(removed).toEqual(["C:/unsafe/<name>.txt"]);
    expect(unbound).toBe(true);
  });

  it("renders ready and warning action status states", () => {
    const ready = actionStateElements();

    renderCreateActionState(ready.elements, {
      canCreate: true,
      hasSources: true,
      isEmpty: false,
      statusText: "2 entries ready",
      createArchiveLabel: "Create Archive",
      isWarning: false,
    });

    expect(ready.elements.startCreateButton.disabled).toBe(false);
    expect(ready.elements.startCreateButton.title).toBe("2 entries ready");
    expect(ready.elements.startCreateButton.getAttribute("aria-label")).toBe("Create Archive");
    expect(ready.planMetaClasses.has("is-ready")).toBe(true);
    expect(ready.planMetaClasses.has("is-warning")).toBe(false);
    expect(ready.addSourceClasses.has("secondary-action")).toBe(true);
    expect(ready.startCreateClasses.has("primary-action")).toBe(true);

    const warning = actionStateElements();
    renderCreateActionState(warning.elements, {
      canCreate: false,
      hasSources: false,
      isEmpty: true,
      statusText: "Choose a destination",
      createArchiveLabel: "Create Archive",
      isWarning: true,
    });

    expect(warning.elements.startCreateButton.disabled).toBe(true);
    expect(warning.elements.startCreateButton.getAttribute("aria-label")).toBe("Create Archive: Choose a destination");
    expect(warning.elements.createPlanMeta.textContent).toBe("Choose a destination");
    expect(warning.planMetaClasses.has("is-ready")).toBe(false);
    expect(warning.planMetaClasses.has("is-warning")).toBe(true);
    expect(warning.addSourceClasses.has("primary-action")).toBe(true);
    expect(warning.startCreateClasses.has("secondary-action")).toBe(true);
  });

  it("renders escaped plan status messages", () => {
    const elements = planSummaryElements();

    renderCreatePlanStatus(elements, {
      message: "Planning <sources>...",
    });

    expect(elements.createPlanSummary.innerHTML).toBe("<p>Planning &lt;sources&gt;...</p>");
  });

  it("renders ready plan summaries with escaped samples and no warnings", () => {
    const elements = planSummaryElements();

    renderCreatePlanSummary(elements, {
      plan: createPlan({
        entries: ["docs/readme.md", "unsafe/<entry>.txt"],
        warnings: [],
      }),
      translator: createTranslator("en"),
      formatBytes: (value) => `${value ?? 0} B`,
    });

    const html = elements.createPlanSummary.innerHTML;
    expect(html).toContain('class="plan-validation is-ready"');
    expect(html).toContain("<strong>2 entries ready, 1024 B, 0 warning(s).</strong>");
    expect(html).toContain("<summary>Plan details</summary>");
    expect(html).toContain("<strong>Included:</strong> 2 entries - 1024 B");
    expect(html).toContain("<li>unsafe/&lt;entry&gt;.txt</li>");
    expect(html).toContain("<p>No warnings.</p>");
  });

  it("renders warning plan summaries open with escaped warning text", () => {
    const elements = planSummaryElements();

    renderCreatePlanSummary(elements, {
      plan: createPlan({
        entries: [],
        warnings: ["Skipped <secret>.tmp"],
      }),
      translator: createTranslator("en"),
      formatBytes: (value) => `${value ?? 0} B`,
    });

    const html = elements.createPlanSummary.innerHTML;
    expect(html).toContain('class="plan-validation has-warnings"');
    expect(html).toContain('<details class="plan-details" open>');
    expect(html).toContain("<li>(none)</li>");
    expect(html).toContain("<li>Skipped &lt;secret&gt;.tmp</li>");
  });

  it("renders empty and populated destination history controls", () => {
    const empty = destinationHistoryElements();

    renderCreateDestinationHistory(empty, {
      entries: [],
      recentLabel: "Recent",
    });

    expect(empty.createDestinationHistoryList.innerHTML).toBe("");
    expect(empty.createDestinationRecentSelect.disabled).toBe(true);
    expect(empty.createDestinationRecentSelect.innerHTML).toContain('<option value="">Recent</option>');

    const populated = destinationHistoryElements();
    renderCreateDestinationHistory(populated, {
      entries: [
        { value: "C:/archives/app.zip", label: "C:/archives/app.zip" },
        { value: "C:/unsafe/<archive>.zip", label: "C:/unsafe/.../<archive>.zip" },
      ],
      recentLabel: "Recent <destinations>",
    });

    expect(populated.createDestinationRecentSelect.disabled).toBe(false);
    expect(populated.createDestinationHistoryList.innerHTML).toContain('<option value="C:/unsafe/&lt;archive&gt;.zip"></option>');
    expect(populated.createDestinationRecentSelect.innerHTML).toContain('<option value="">Recent &lt;destinations&gt;</option>');
    expect(populated.createDestinationRecentSelect.innerHTML).toContain(
      '<option value="C:/unsafe/&lt;archive&gt;.zip">C:/unsafe/.../&lt;archive&gt;.zip</option>',
    );
  });

  it("syncs create option controls from render-ready option values", () => {
    const elements = optionControlElements();

    renderCreateOptionControls(elements, {
      format: "tzap",
      cleanSource: true,
      preserveMetadata: false,
      replaceExisting: true,
      respectGitignore: true,
      compressionLevel: 9,
      volumeSize: 1048576,
      tzapRecoveryPercentage: 7,
      tzapRecoveryVisible: true,
      tzapRecoveryDisabled: false,
      passwordVisible: true,
    });

    expect(elements.createFormatSelect.value).toBe("tzap");
    expect(elements.createCleanSourceCheckbox.checked).toBe(true);
    expect(elements.createPreserveMetadataCheckbox.checked).toBe(false);
    expect(elements.createReplaceExistingCheckbox.checked).toBe(true);
    expect(elements.createRespectGitignoreCheckbox.checked).toBe(true);
    expect(elements.createCompressionInput.value).toBe("9");
    expect(elements.createVolumeInput.value).toBe("1048576");
    expect(elements.createTzapRecoveryField.hidden).toBe(false);
    expect(elements.createTzapRecoveryInput.disabled).toBe(false);
    expect(elements.createTzapRecoveryInput.value).toBe("7");
    expect(elements.createPasswordOptions.hidden).toBe(false);
  });

  it("syncs empty optional option values and hides disabled TZAP/password controls", () => {
    const elements = optionControlElements();

    renderCreateOptionControls(elements, {
      format: "zip",
      cleanSource: false,
      preserveMetadata: true,
      replaceExisting: false,
      respectGitignore: false,
      compressionLevel: null,
      volumeSize: null,
      tzapRecoveryPercentage: 10,
      tzapRecoveryVisible: false,
      tzapRecoveryDisabled: true,
      passwordVisible: false,
    });

    expect(elements.createFormatSelect.value).toBe("zip");
    expect(elements.createCompressionInput.value).toBe("");
    expect(elements.createVolumeInput.value).toBe("");
    expect(elements.createTzapRecoveryField.hidden).toBe(true);
    expect(elements.createTzapRecoveryInput.disabled).toBe(true);
    expect(elements.createTzapRecoveryInput.value).toBe("10");
    expect(elements.createPasswordOptions.hidden).toBe(true);
  });

  it("decodes non-password create option control values into a patch", () => {
    const elements = optionControlElements({
      cleanSource: true,
      preserveMetadata: true,
      replaceExisting: false,
      respectGitignore: true,
      compressionLevel: "22",
      volumeSize: "2097152",
      tzapRecoveryPercentage: "15",
    });

    const patch = readCreateOptionControlPatch(elements);

    expect(patch).toEqual({
      cleanSource: true,
      preserveMetadata: true,
      replaceExisting: false,
      respectGitignore: true,
      compressionLevel: "22",
      volumeSize: "2097152",
      tzapRecoveryPercentage: "15",
    });
    expect(Object.keys(patch).some((key) => key.toLowerCase().includes("password"))).toBe(false);
  });

  it("renders the empty compress source table state", () => {
    const elements = compressSourceTableElements();

    renderCompressSourceTable(elements, {
      state: "emptySources",
      emptyTitle: "No <sources>",
      emptyHint: "Drag <files> here",
    });

    const html = elements.compressSourceBody.innerHTML;
    expect(html).toContain('class="compress-empty-cell"');
    expect(html).toContain('class="compress-empty-state"');
    expect(html).toContain("<strong>No &lt;sources&gt;</strong>");
    expect(html).toContain("<span>Drag &lt;files&gt; here</span>");
  });

  it("renders compress source table planning and folder-empty status rows", () => {
    const planning = compressSourceTableElements();
    renderCompressSourceTable(planning, {
      state: "planning",
      message: "Planning <sources>...",
    });

    expect(planning.compressSourceBody.innerHTML).toContain(
      '<td colspan="5" class="empty">Planning &lt;sources&gt;...</td>',
    );

    const folderEmpty = compressSourceTableElements();
    renderCompressSourceTable(folderEmpty, {
      state: "folderEmpty",
      message: "Folder <empty>",
    });

    expect(folderEmpty.compressSourceBody.innerHTML).toContain(
      '<td colspan="5" class="empty">Folder &lt;empty&gt;</td>',
    );
  });

  it("renders parent compress rows with escaped attributes, name, icon label, and aria", () => {
    const elements = compressSourceTableElements();

    renderCompressSourceTable(elements, {
      state: "rows",
      rows: [{
        rowType: "parent",
        path: "docs/<parent>",
        name: ".. <up>",
        iconHtml: '<span class="row-icon" data-icon="parent"></span>',
        iconLabel: "Parent <folder>",
        ariaLabel: "Go to parent <folder>",
        kindText: "Parent <folder>",
      }],
    });

    const html = elements.compressSourceBody.innerHTML;
    expect(html).toContain('class="folder-row parent-row"');
    expect(html).toContain('data-compress-folder-row="docs/&lt;parent&gt;"');
    expect(html).toContain('aria-label="Go to parent &lt;folder&gt;"');
    expect(html).toContain('aria-keyshortcuts="Enter ContextMenu Shift+F10"');
    expect(html).toContain('<span class="row-icon" data-icon="parent"></span>');
    expect(html).toContain('<span class="sr-only">Parent &lt;folder&gt;:</span>');
    expect(html).toContain('<span class="row-name">.. &lt;up&gt;</span>');
    expect(html).toContain("<td>Parent &lt;folder&gt;</td>");
  });

  it("renders folder compress rows with selection, focus, source path, partial state, and escaped badge", () => {
    const elements = compressSourceTableElements();

    renderCompressSourceTable(elements, {
      state: "rows",
      rows: [
        folderRow({
          path: "src/<unsafe>",
          sourcePath: "C:/repo/<src>",
          name: "src <unsafe>",
          selected: true,
          focused: true,
          inclusionState: "partial",
          inclusionLabel: "Partially <included>",
          includeAriaLabel: "Exclude src <unsafe>",
          iconLabel: "Folder <icon>",
          ariaLabel: "Open src <unsafe>",
          sizeText: "12 KB",
          modifiedText: "Today <soon>",
          kindText: "Directory <kind>",
        }),
        folderRow({
          path: "vendor",
          sourcePath: null,
          name: "vendor",
          inclusionState: "excluded",
          inclusionLabel: "Excluded <item>",
          includeAriaLabel: "Include vendor",
        }),
      ],
    });

    const html = elements.compressSourceBody.innerHTML;
    expect(html).toContain('class="folder-row is-selected is-focused-row is-partial"');
    expect(html).toContain('data-compress-folder-row="src/&lt;unsafe&gt;"');
    expect(html).toContain('data-compress-path="src/&lt;unsafe&gt;"');
    expect(html).toContain('data-compress-source-path="C:/repo/&lt;src&gt;"');
    expect(html).toContain('aria-label="Open src &lt;unsafe&gt;"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('data-compress-inclusion-state="partial"');
    expect(html).toContain('aria-label="Exclude src &lt;unsafe&gt;"');
    expect(html).not.toContain("checked");
    expect(html).toContain('<span class="sr-only">Folder &lt;icon&gt;:</span>');
    expect(html).toContain('<span class="row-name">src &lt;unsafe&gt;</span>');
    expect(html).toContain('<span class="source-stage-badge ">Partially &lt;included&gt;</span>');
    expect(html).toContain("<td>12 KB</td>");
    expect(html).toContain("<td>Today &lt;soon&gt;</td>");
    expect(html).toContain("<td>Directory &lt;kind&gt;</td>");
    expect(html).toContain('class="folder-row is-excluded"');
    expect(html).toContain('<span class="source-stage-badge is-excluded">Excluded &lt;item&gt;</span>');
  });

  it("renders entry compress rows with checked inclusion, detail columns, and no empty source-path attribute", () => {
    const elements = compressSourceTableElements();

    renderCompressSourceTable(elements, {
      state: "rows",
      rows: [{
        rowType: "entry",
        path: "docs/readme<unsafe>.md",
        sourcePath: null,
        name: "readme<unsafe>.md",
        selected: true,
        focused: false,
        inclusionState: "included",
        inclusionLabel: "Included <item>",
        includeAriaLabel: "Exclude readme <unsafe>",
        iconHtml: '<span class="row-icon" data-icon="file"></span>',
        iconLabel: "File <icon>",
        sizeText: "1 KB",
        modifiedText: "2026-07-08",
        kindText: "Markdown <file>",
      }],
    });

    const html = elements.compressSourceBody.innerHTML;
    expect(html).toContain('data-compress-entry-row="docs/readme&lt;unsafe&gt;.md"');
    expect(html).toContain('data-compress-path="docs/readme&lt;unsafe&gt;.md"');
    expect(html).not.toContain("data-compress-source-path");
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('data-compress-inclusion-state="included"');
    expect(html).toContain('aria-label="Exclude readme &lt;unsafe&gt;"');
    expect(html).toContain("checked");
    expect(html).toContain('<span class="sr-only">File &lt;icon&gt;:</span>');
    expect(html).toContain('<span class="row-name">readme&lt;unsafe&gt;.md</span>');
    expect(html).toContain('<span class="source-stage-badge ">Included &lt;item&gt;</span>');
    expect(html).toContain("<td>1 KB</td>");
    expect(html).toContain("<td>2026-07-08</td>");
    expect(html).toContain("<td>Markdown &lt;file&gt;</td>");
  });

  it("syncs the include-all checkbox from plain control state", () => {
    const input = optionInput();

    renderCompressIncludeAllControl({ compressIncludeAllInput: input }, {
      checked: true,
      indeterminate: true,
      disabled: true,
    });

    expect(input.checked).toBe(true);
    expect(input.indeterminate).toBe(true);
    expect(input.disabled).toBe(true);
    expect(readCompressIncludeAllChecked({ compressIncludeAllInput: input })).toBe(true);

    renderCompressIncludeAllControl({ compressIncludeAllInput: input }, {
      checked: false,
      indeterminate: false,
      disabled: false,
    });

    expect(input.checked).toBe(false);
    expect(input.indeterminate).toBe(false);
    expect(input.disabled).toBe(false);
    expect(readCompressIncludeAllChecked({ compressIncludeAllInput: input })).toBe(false);
  });

  it("sets row inclusion checkbox indeterminate state from dataset state", () => {
    const inputs = [
      compressIncludeInput("partial"),
      compressIncludeInput("included"),
    ];
    const elements = mockCompressSourceTableElements([], inputs);
    inputs[0].indeterminate = false;
    inputs[1].indeterminate = true;

    syncCompressSourceInclusionControls(elements);

    expect(inputs[0].indeterminate).toBe(true);
    expect(inputs[1].indeterminate).toBe(false);
  });

  it("syncs compress source row selected and focused classes from path arrays", () => {
    const elements = mockCompressSourceTableElements([
      compressRow({ folderPath: "src", path: "src", ariaSelected: "true", classes: ["is-focused-row"] }),
      compressRow({ entryPath: "docs/readme.md", path: "docs/readme.md", ariaSelected: "false" }),
      compressRow({ folderPath: "parent" }),
    ]);

    syncCompressSourceSelectionUi(elements, {
      selectedPaths: ["docs/readme.md"],
      focusedPath: "docs/readme.md",
    });

    const rows = getCompressSourceRows(elements);
    expect(rows[0].classList.contains("is-selected")).toBe(false);
    expect(rows[0].classList.contains("is-focused-row")).toBe(false);
    expect(rows[0].getAttribute("aria-selected")).toBe("false");
    expect(rows[1].classList.contains("is-selected")).toBe(true);
    expect(rows[1].classList.contains("is-focused-row")).toBe(true);
    expect(rows[1].getAttribute("aria-selected")).toBe("true");
    expect(rows[2].getAttribute("aria-selected")).toBe(null);
  });

  it("queries selectable compress rows and finds paths without selector escaping hazards", () => {
    const trickyPath = String.raw`docs/[draft]"#1.md`;
    const elements = mockCompressSourceTableElements([
      compressRow({ folderPath: "parent", focusable: true }),
      compressRow({ folderPath: "src", path: "src", focusable: true }),
      compressRow({ entryPath: trickyPath, path: trickyPath, focusable: true }),
    ]);

    expect(getCompressSourceRows(elements).map((row) => row.dataset.compressPath ?? "")).toEqual([
      "",
      "src",
      trickyPath,
    ]);
    expect(getCompressSourceSelectableRows(elements).map((row) => row.dataset.compressPath)).toEqual([
      "src",
      trickyPath,
    ]);
    expect(findCompressSourceRowByPath(elements, trickyPath)?.dataset.compressPath).toBe(trickyPath);
    expect(findCompressSourceRowByPath(elements, "missing")).toBe(null);
  });

  it("focuses the first focusable compress source row", () => {
    const first = compressRow({ folderPath: "src", focusable: true });
    const second = compressRow({ entryPath: "docs/readme.md", path: "docs/readme.md", focusable: true });
    const elements = mockCompressSourceTableElements([
      compressRow({}),
      first,
      second,
    ]);

    const focused = focusFirstCompressSourceRow(elements);

    expect(focused?.dataset.compressFolderRow).toBe("src");
    expect((focused as TestCompressRow).focused).toBe(true);
    expect(second.focused).toBe(false);
  });

  it("reads rendered compress source column widths with fallback and clamping", () => {
    const restoreCss = stubCssEscape((value) => value);
    const table = compressSourceColumnTable({
      name: 139.4,
      size: undefined,
      modified: 0,
      kind: 999,
    });

    try {
      const widths = readCompressSourceColumnWidths(table, {
        columnIds: ["name", "size", "modified", "kind"] as const,
        defaultWidths: {
          name: 320,
          size: 120,
          modified: 170,
          kind: 120,
        },
        minWidths: {
          name: 140,
          size: 72,
          modified: 110,
          kind: 80,
        },
        maxWidth: 520,
      });

      expect(widths).toEqual({
        name: 140,
        size: 120,
        modified: 170,
        kind: 520,
      });
    } finally {
      restoreCss();
    }
  });

  it("applies compress source column width CSS variables and table min width", () => {
    const styleProperties: Record<string, string> = {};
    const table = {
      style: {
        minWidth: "",
        setProperty: (name: string, value: string) => {
          styleProperties[name] = value;
        },
      },
    } as unknown as HTMLTableElement;

    applyCompressSourceColumnWidths(table, {
      columnIds: ["name", "size", "kind"] as const,
      includeColumnWidth: 28,
      widths: {
        name: 201,
        size: 96,
        kind: 111,
      },
    });

    expect(styleProperties).toEqual({
      "--compress-source-name-column-width": "201px",
      "--compress-source-size-column-width": "96px",
      "--compress-source-kind-column-width": "111px",
    });
    expect(table.style.minWidth).toBe("436px");
  });

  it("escapes tricky compress source column ids when querying headers", () => {
    const restoreCss = stubCssEscape((value) => `escaped(${value})`);
    let selector = "";
    const header = compressSourceColumnHeader(222);
    const table = {
      querySelector: (value: string) => {
        selector = value;
        return header;
      },
    } as unknown as HTMLTableElement;

    try {
      const result = findCompressSourceColumnHeader(table, String.raw`name"] .other`);

      expect(result).toBe(header);
      expect(selector).toBe('th[data-compress-column-id="escaped(name"] .other)"]');
    } finally {
      restoreCss();
    }
  });
});

function sourceListElements(): { elements: CreateSourceListElements } {
  return {
    elements: {
      sourceListElement: element() as HTMLUListElement,
      clearSourcesButton: button(),
      includeAllSourcesButton: button(),
      excludeAllSourcesButton: button(),
    },
  };
}

function actionStateElements(): {
  elements: CreateActionStateElements;
  addSourceClasses: Set<string>;
  startCreateClasses: Set<string>;
  planMetaClasses: Set<string>;
} {
  const addSourceClasses = new Set<string>();
  const startCreateClasses = new Set<string>();
  const planMetaClasses = new Set<string>();
  return {
    addSourceClasses,
    startCreateClasses,
    planMetaClasses,
    elements: {
      addSourceButton: buttonWithClassSet(addSourceClasses),
      startCreateButton: buttonWithClassSet(startCreateClasses),
      createPlanMeta: elementWithClassSet(planMetaClasses),
    },
  };
}

function planSummaryElements(): CreatePlanSummaryElements {
  return {
    createPlanSummary: element(),
  };
}

function destinationHistoryElements(): CreateDestinationHistoryElements {
  return {
    createDestinationHistoryList: element() as HTMLDataListElement,
    createDestinationRecentSelect: element() as HTMLSelectElement,
  };
}

function optionControlElements(overrides: Partial<{
  format: string;
  cleanSource: boolean;
  preserveMetadata: boolean;
  replaceExisting: boolean;
  respectGitignore: boolean;
  compressionLevel: string;
  volumeSize: string;
  tzapRecoveryPercentage: string;
}> = {}): CreateOptionControlElements {
  return {
    createFormatSelect: optionSelect(overrides.format ?? ""),
    createCleanSourceCheckbox: optionInput("", overrides.cleanSource ?? false),
    createPreserveMetadataCheckbox: optionInput("", overrides.preserveMetadata ?? false),
    createReplaceExistingCheckbox: optionInput("", overrides.replaceExisting ?? false),
    createRespectGitignoreCheckbox: optionInput("", overrides.respectGitignore ?? false),
    createCompressionInput: optionSelect(overrides.compressionLevel ?? ""),
    createVolumeInput: optionInput(overrides.volumeSize ?? ""),
    createTzapRecoveryField: element(),
    createTzapRecoveryInput: optionInput(overrides.tzapRecoveryPercentage ?? ""),
    createPasswordOptions: element(),
  };
}

function compressSourceTableElements() {
  return {
    compressSourceBody: element() as HTMLTableSectionElement,
  };
}

type TestCompressRow = HTMLTableRowElement & {
  classes: Set<string>;
  attrs: Record<string, string>;
  focused: boolean;
  focusable: boolean;
};

function mockCompressSourceTableElements(
  rows: readonly TestCompressRow[],
  inclusionInputs: readonly HTMLInputElement[] = [],
): CompressSourceTableElements {
  return {
    compressSourceBody: {
      querySelectorAll: (selector: string) => {
        if (selector === "[data-compress-include]") {
          return inclusionInputs;
        }
        if (selector === "tr[data-compress-folder-row], tr[data-compress-entry-row]") {
          return rows.filter((row) =>
            row.dataset.compressFolderRow !== undefined || row.dataset.compressEntryRow !== undefined
          );
        }
        if (selector === "tr[data-compress-path]") {
          return rows.filter((row) => row.dataset.compressPath !== undefined);
        }
        return [];
      },
      querySelector: (selector: string) => {
        if (selector === "tr[tabindex='0']") {
          return rows.find((row) => row.focusable) ?? null;
        }
        return null;
      },
    },
  } as unknown as CompressSourceTableElements;
}

function compressRow(options: Partial<{
  folderPath: string;
  entryPath: string;
  path: string;
  ariaSelected: string;
  classes: readonly string[];
  focusable: boolean;
}>): TestCompressRow {
  const classes = new Set(options.classes ?? []);
  const attrs: Record<string, string> = {};
  if (options.ariaSelected !== undefined) {
    attrs["aria-selected"] = options.ariaSelected;
  }
  return {
    dataset: {
      ...(options.folderPath !== undefined ? { compressFolderRow: options.folderPath } : {}),
      ...(options.entryPath !== undefined ? { compressEntryRow: options.entryPath } : {}),
      ...(options.path !== undefined ? { compressPath: options.path } : {}),
    },
    classList: {
      toggle: (className: string, force?: boolean) => {
        if (force) {
          classes.add(className);
          return true;
        }
        classes.delete(className);
        return false;
      },
      contains: (className: string) => classes.has(className),
    },
    setAttribute: (name: string, value: string) => {
      attrs[name] = value;
    },
    getAttribute: (name: string) => attrs[name] ?? null,
    focus: function focus(this: TestCompressRow) {
      this.focused = true;
    },
    classes,
    attrs,
    focused: false,
    focusable: options.focusable ?? false,
  } as unknown as TestCompressRow;
}

function compressIncludeInput(inclusionState: string): HTMLInputElement {
  return {
    dataset: {
      compressInclusionState: inclusionState,
    },
    indeterminate: false,
  } as unknown as HTMLInputElement;
}

function folderRow(
  overrides: Partial<Extract<CompressSourceTableRowModel, { rowType: "folder" }>>,
): Extract<CompressSourceTableRowModel, { rowType: "folder" }> {
  return {
    rowType: "folder",
    path: "src",
    sourcePath: null,
    name: "src",
    selected: false,
    focused: false,
    inclusionState: "included",
    inclusionLabel: "Included",
    includeAriaLabel: "Exclude src",
    iconHtml: '<span class="row-icon" data-icon="folder"></span>',
    iconLabel: "Folder",
    ariaLabel: "Open src",
    sizeText: "",
    modifiedText: "",
    kindText: "Directory",
    ...overrides,
  };
}

function createPlan(overrides: Partial<CreatePlanSummaryData>): CreatePlanSummaryData {
  return {
    includedCount: overrides.entries?.length ?? 2,
    excludedCount: 1,
    totalBytes: 1024,
    excludedBytes: 12,
    entries: ["docs/readme.md", "images/photo.jpg"],
    warnings: [],
    ...overrides,
  };
}

function buttonWithClassSet(classes: Set<string>): HTMLButtonElement {
  return {
    ...button(),
    classList: classListWithSet(classes),
  } as unknown as HTMLButtonElement;
}

function elementWithClassSet(classes: Set<string>): HTMLElement {
  return {
    ...element(),
    classList: classListWithSet(classes),
  } as HTMLElement;
}

function button(): HTMLButtonElement {
  const attributes: Record<string, string> = {};
  return {
    disabled: false,
    hidden: false,
    title: "",
    setAttribute(name: string, value: string) {
      attributes[name] = value;
    },
    getAttribute(name: string) {
      return attributes[name] ?? null;
    },
    classList: {
      toggle: () => false,
    },
  } as unknown as HTMLButtonElement;
}

function element(): HTMLElement {
  return {
    innerHTML: "",
    textContent: "",
    disabled: false,
    hidden: false,
    classList: {
      toggle: () => false,
    },
  } as unknown as HTMLElement;
}

function optionInput(value = "", checked = false): HTMLInputElement {
  return {
    ...element(),
    value,
    checked,
  } as unknown as HTMLInputElement;
}

function optionSelect(value = ""): HTMLSelectElement {
  return {
    ...element(),
    value,
  } as unknown as HTMLSelectElement;
}

function classListWithSet(classes: Set<string>): Pick<DOMTokenList, "toggle"> {
  return {
    toggle: (className: string, force?: boolean) => {
      if (force) {
        classes.add(className);
        return true;
      }
      classes.delete(className);
      return false;
    },
  };
}

function compressSourceColumnTable(widths: Record<string, number | undefined>): HTMLTableElement {
  return {
    querySelector: (selector: string) => {
      const match = selector.match(/^th\[data-compress-column-id="(.+)"\]$/);
      if (!match) {
        return null;
      }
      const width = widths[match[1]];
      return width === undefined ? null : compressSourceColumnHeader(width);
    },
  } as unknown as HTMLTableElement;
}

function compressSourceColumnHeader(width: number): HTMLTableCellElement {
  return {
    getBoundingClientRect: () => ({ width }),
  } as unknown as HTMLTableCellElement;
}

function stubCssEscape(escape: (value: string) => string): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "CSS");
  Object.defineProperty(globalThis, "CSS", {
    configurable: true,
    value: { escape },
  });

  return () => {
    if (descriptor) {
      Object.defineProperty(globalThis, "CSS", descriptor);
      return;
    }
    Reflect.deleteProperty(globalThis, "CSS");
  };
}
