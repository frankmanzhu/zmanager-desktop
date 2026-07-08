import { escapeHtml } from "../app/formatting";
import type { Translator } from "../app/i18n/translator";

export type CreateSourceListElements = {
  sourceListElement: HTMLUListElement;
  clearSourcesButton: HTMLButtonElement;
  includeAllSourcesButton: HTMLButtonElement;
  excludeAllSourcesButton: HTMLButtonElement;
};

export type CreateSourceListRenderOptions = {
  sources: readonly string[];
  isEmpty: boolean;
  includeAllDisabled: boolean;
  excludeAllDisabled: boolean;
  noSourcesLabel: string;
  removeSourceLabel: string;
};

export type CreateSourceListActionHandlers = {
  onRemoveSource: (sourcePath: string) => void;
};

export type CreateActionStateElements = {
  addSourceButton: HTMLButtonElement;
  startCreateButton: HTMLButtonElement;
  createPlanMeta: HTMLElement;
};

export type CreateActionStateRenderOptions = {
  canCreate: boolean;
  hasSources: boolean;
  isEmpty: boolean;
  statusText: string;
  createArchiveLabel: string;
  isWarning: boolean;
};

export type CreatePlanSummaryElements = {
  createPlanSummary: HTMLElement;
};

export type CreatePlanSummaryData = {
  includedCount: number;
  excludedCount: number;
  totalBytes: number;
  excludedBytes: number;
  entries: readonly string[];
  warnings: readonly string[];
};

export type CreatePlanSummaryRenderOptions = {
  plan: CreatePlanSummaryData;
  translator: Translator;
  formatBytes: (value?: number) => string;
};

export type CreatePlanStatusRenderOptions = {
  message: string;
};

export type CreateDestinationHistoryElements = {
  createDestinationHistoryList: HTMLDataListElement;
  createDestinationRecentSelect: HTMLSelectElement;
};

export type CreateDestinationHistoryEntry = {
  value: string;
  label: string;
};

export type CreateDestinationHistoryRenderOptions = {
  entries: readonly CreateDestinationHistoryEntry[];
  recentLabel: string;
};

export type CreateOptionControlElements = {
  createFormatSelect: HTMLSelectElement;
  createCleanSourceCheckbox: HTMLInputElement;
  createPreserveMetadataCheckbox: HTMLInputElement;
  createReplaceExistingCheckbox: HTMLInputElement;
  createRespectGitignoreCheckbox: HTMLInputElement;
  createCompressionInput: HTMLSelectElement;
  createVolumeInput: HTMLInputElement;
  createTzapRecoveryField: HTMLElement;
  createTzapRecoveryInput: HTMLInputElement;
  createPasswordOptions: HTMLElement;
};

export type CreateOptionControlRenderOptions = {
  format: string;
  cleanSource: boolean;
  preserveMetadata: boolean;
  replaceExisting: boolean;
  respectGitignore: boolean;
  compressionLevel: number | null;
  volumeSize: number | null;
  tzapRecoveryPercentage: number;
  tzapRecoveryVisible: boolean;
  tzapRecoveryDisabled: boolean;
  passwordVisible: boolean;
};

export type CreateOptionControlPatch = {
  cleanSource: boolean;
  preserveMetadata: boolean;
  replaceExisting: boolean;
  respectGitignore: boolean;
  compressionLevel: string;
  volumeSize: string;
  tzapRecoveryPercentage: string;
};

export type CompressSourceTableElements = {
  compressSourceBody: HTMLTableSectionElement;
};

export type CompressSourceColumnWidthOptions<ColumnId extends string> = {
  columnIds: readonly ColumnId[];
  defaultWidths: Record<ColumnId, number>;
  minWidths: Record<ColumnId, number>;
  maxWidth: number;
};

export type ApplyCompressSourceColumnWidthsOptions<ColumnId extends string> = {
  columnIds: readonly ColumnId[];
  includeColumnWidth: number;
  widths: Record<ColumnId, number>;
};

export type CompressIncludeAllControlElements = {
  compressIncludeAllInput: HTMLInputElement;
};

export type CompressIncludeAllControlState = {
  checked: boolean;
  indeterminate: boolean;
  disabled: boolean;
};

export type CompressSourceSelectionRenderOptions = {
  selectedPaths: readonly string[];
  focusedPath: string | null;
};

export type CompressSourceTableInclusionState = "included" | "excluded" | "partial";

export type CompressSourceTableRowModel =
  | {
      rowType: "parent";
      path: string;
      name: string;
      iconHtml: string;
      iconLabel: string;
      ariaLabel: string;
      kindText: string;
    }
  | {
      rowType: "folder";
      path: string;
      sourcePath: string | null;
      name: string;
      selected: boolean;
      focused: boolean;
      inclusionState: CompressSourceTableInclusionState;
      inclusionLabel: string;
      includeAriaLabel: string;
      iconHtml: string;
      iconLabel: string;
      ariaLabel: string;
      sizeText: string;
      modifiedText: string;
      kindText: string;
    }
  | {
      rowType: "entry";
      path: string;
      sourcePath: string | null;
      name: string;
      selected: boolean;
      focused: boolean;
      inclusionState: CompressSourceTableInclusionState;
      inclusionLabel: string;
      includeAriaLabel: string;
      iconHtml: string;
      iconLabel: string;
      sizeText: string;
      modifiedText: string;
      kindText: string;
    };

export type CompressSourceTableRenderOptions =
  | {
      state: "emptySources";
      emptyTitle: string;
      emptyHint: string;
    }
  | {
      state: "planning";
      message: string;
    }
  | {
      state: "folderEmpty";
      message: string;
    }
  | {
      state: "rows";
      rows: readonly CompressSourceTableRowModel[];
    };

export function renderCreateSourceList(
  elements: CreateSourceListElements,
  options: CreateSourceListRenderOptions,
): void {
  elements.clearSourcesButton.hidden = options.isEmpty;
  elements.clearSourcesButton.disabled = options.isEmpty;
  elements.includeAllSourcesButton.hidden = options.isEmpty;
  elements.excludeAllSourcesButton.hidden = options.isEmpty;
  elements.includeAllSourcesButton.disabled = options.includeAllDisabled;
  elements.excludeAllSourcesButton.disabled = options.excludeAllDisabled;

  if (options.isEmpty) {
    elements.sourceListElement.innerHTML = `<li class="empty">${escapeHtml(options.noSourcesLabel)}</li>`;
    return;
  }

  elements.sourceListElement.innerHTML = options.sources
    .map(
      (path) => `
        <li data-source-path="${escapeHtml(path)}">
          <span>${escapeHtml(path)}</span>
          <button type="button" data-source-remove>${escapeHtml(options.removeSourceLabel)}</button>
        </li>
      `,
    )
    .join("");
}

export function bindCreateSourceListActions(
  elements: Pick<CreateSourceListElements, "sourceListElement">,
  handlers: CreateSourceListActionHandlers,
): () => void {
  const onClick = (event: MouseEvent) => {
    const button = closestElement<HTMLButtonElement>(event.target, "[data-source-remove]");
    if (!button) {
      return;
    }

    const path = button.closest<HTMLElement>("li")?.dataset.sourcePath;
    if (!path) {
      return;
    }

    event.preventDefault();
    handlers.onRemoveSource(path);
  };

  elements.sourceListElement.addEventListener("click", onClick);

  return () => {
    elements.sourceListElement.removeEventListener("click", onClick);
  };
}

export function renderCreateActionState(
  elements: CreateActionStateElements,
  options: CreateActionStateRenderOptions,
): void {
  elements.startCreateButton.disabled = !options.canCreate;
  elements.startCreateButton.title = options.statusText;
  elements.startCreateButton.setAttribute("aria-label", options.canCreate
    ? options.createArchiveLabel
    : `${options.createArchiveLabel}: ${options.statusText}`);
  elements.addSourceButton.classList.toggle("primary-action", options.isEmpty);
  elements.addSourceButton.classList.toggle("secondary-action", options.hasSources);
  elements.startCreateButton.classList.toggle("primary-action", options.canCreate);
  elements.startCreateButton.classList.toggle("secondary-action", !options.canCreate);
  elements.createPlanMeta.textContent = options.statusText;
  elements.createPlanMeta.classList.toggle("is-ready", options.canCreate);
  elements.createPlanMeta.classList.toggle("is-warning", options.isWarning);
}

export function renderCreatePlanSummary(
  elements: CreatePlanSummaryElements,
  options: CreatePlanSummaryRenderOptions,
): void {
  elements.createPlanSummary.innerHTML = createPlanSummaryHtml(options);
}

export function renderCreatePlanStatus(
  elements: CreatePlanSummaryElements,
  options: CreatePlanStatusRenderOptions,
): void {
  elements.createPlanSummary.innerHTML = `<p>${escapeHtml(options.message)}</p>`;
}

export function renderCreateDestinationHistory(
  elements: CreateDestinationHistoryElements,
  options: CreateDestinationHistoryRenderOptions,
): void {
  elements.createDestinationHistoryList.innerHTML = options.entries
    .map((entry) => `<option value="${escapeHtml(entry.value)}"></option>`)
    .join("");
  elements.createDestinationRecentSelect.disabled = options.entries.length === 0;
  elements.createDestinationRecentSelect.innerHTML = `
    <option value="">${escapeHtml(options.recentLabel)}</option>
    ${options.entries
      .map((entry) => `<option value="${escapeHtml(entry.value)}">${escapeHtml(entry.label)}</option>`)
      .join("")}
  `;
}

export function renderCreateOptionControls(
  elements: CreateOptionControlElements,
  options: CreateOptionControlRenderOptions,
): void {
  elements.createFormatSelect.value = options.format;
  elements.createCleanSourceCheckbox.checked = options.cleanSource;
  elements.createPreserveMetadataCheckbox.checked = options.preserveMetadata;
  elements.createReplaceExistingCheckbox.checked = options.replaceExisting;
  elements.createRespectGitignoreCheckbox.checked = options.respectGitignore;
  elements.createCompressionInput.value = optionNumberValue(options.compressionLevel);
  elements.createVolumeInput.value = optionNumberValue(options.volumeSize);
  elements.createTzapRecoveryField.hidden = !options.tzapRecoveryVisible;
  elements.createTzapRecoveryInput.disabled = options.tzapRecoveryDisabled;
  elements.createTzapRecoveryInput.value = String(options.tzapRecoveryPercentage);
  elements.createPasswordOptions.hidden = !options.passwordVisible;
}

export function readCreateOptionControlPatch(
  elements: CreateOptionControlElements,
): CreateOptionControlPatch {
  return {
    cleanSource: elements.createCleanSourceCheckbox.checked,
    preserveMetadata: elements.createPreserveMetadataCheckbox.checked,
    replaceExisting: elements.createReplaceExistingCheckbox.checked,
    respectGitignore: elements.createRespectGitignoreCheckbox.checked,
    compressionLevel: elements.createCompressionInput.value,
    volumeSize: elements.createVolumeInput.value,
    tzapRecoveryPercentage: elements.createTzapRecoveryInput.value,
  };
}

export function renderCompressSourceTable(
  elements: CompressSourceTableElements,
  options: CompressSourceTableRenderOptions,
): void {
  if (options.state === "emptySources") {
    elements.compressSourceBody.innerHTML = `
      <tr>
        <td colspan="5" class="compress-empty-cell">
          <div class="compress-empty-state">
            <strong>${escapeHtml(options.emptyTitle)}</strong>
            <span>${escapeHtml(options.emptyHint)}</span>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  if (options.state === "planning" || options.state === "folderEmpty") {
    elements.compressSourceBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty">${escapeHtml(options.message)}</td>
      </tr>
    `;
    return;
  }

  elements.compressSourceBody.innerHTML = options.rows
    .map((row) => renderCompressSourceTableRow(row))
    .join("");
}

export function renderCompressIncludeAllControl(
  elements: CompressIncludeAllControlElements,
  state: CompressIncludeAllControlState,
): void {
  elements.compressIncludeAllInput.checked = state.checked;
  elements.compressIncludeAllInput.indeterminate = state.indeterminate;
  elements.compressIncludeAllInput.disabled = state.disabled;
}

export function readCompressIncludeAllChecked(elements: CompressIncludeAllControlElements): boolean {
  return elements.compressIncludeAllInput.checked;
}

export function syncCompressSourceInclusionControls(elements: CompressSourceTableElements): void {
  for (const input of elements.compressSourceBody.querySelectorAll<HTMLInputElement>("[data-compress-include]")) {
    input.indeterminate = input.dataset.compressInclusionState === "partial";
  }
}

export function syncCompressSourceSelectionUi(
  elements: CompressSourceTableElements,
  options: CompressSourceSelectionRenderOptions,
): void {
  const selectedPaths = new Set(options.selectedPaths);
  for (const row of getCompressSourceSelectableRows(elements)) {
    const rowPath = row.dataset.compressPath ?? "";
    const selected = selectedPaths.has(rowPath);
    const focused = options.focusedPath === rowPath;
    row.classList.toggle("is-selected", selected);
    row.classList.toggle("is-focused-row", focused);
    row.setAttribute("aria-selected", String(selected));
  }
}

export function getCompressSourceRows(elements: CompressSourceTableElements): HTMLTableRowElement[] {
  return Array.from(elements.compressSourceBody.querySelectorAll<HTMLTableRowElement>(
    "tr[data-compress-folder-row], tr[data-compress-entry-row]",
  ));
}

export function getCompressSourceSelectableRows(elements: CompressSourceTableElements): HTMLTableRowElement[] {
  return Array.from(elements.compressSourceBody.querySelectorAll<HTMLTableRowElement>("tr[data-compress-path]"));
}

export function findCompressSourceRowByPath(
  elements: CompressSourceTableElements,
  path: string,
): HTMLTableRowElement | null {
  return getCompressSourceSelectableRows(elements).find((row) => row.dataset.compressPath === path) ?? null;
}

export function focusFirstCompressSourceRow(elements: CompressSourceTableElements): HTMLTableRowElement | null {
  const row = elements.compressSourceBody.querySelector<HTMLTableRowElement>("tr[tabindex='0']");
  row?.focus();
  return row;
}

export function findCompressSourceColumnHeader<ColumnId extends string>(
  table: HTMLTableElement,
  columnId: ColumnId,
): HTMLTableCellElement | null {
  return table.querySelector<HTMLTableCellElement>(
    `th[data-compress-column-id="${CSS.escape(columnId)}"]`,
  );
}

export function clampCompressSourceColumnWidth(
  width: number,
  options: { minWidth: number; maxWidth: number },
): number {
  return Math.min(options.maxWidth, Math.max(options.minWidth, Math.round(width)));
}

export function readCompressSourceColumnWidths<ColumnId extends string>(
  table: HTMLTableElement,
  options: CompressSourceColumnWidthOptions<ColumnId>,
): Record<ColumnId, number> {
  const widths = { ...options.defaultWidths } as Record<ColumnId, number>;
  for (const columnId of options.columnIds) {
    const renderedWidth = findCompressSourceColumnHeader(table, columnId)?.getBoundingClientRect().width;
    widths[columnId] = clampCompressSourceColumnWidth(
      Number.isFinite(renderedWidth) && renderedWidth ? renderedWidth : widths[columnId],
      {
        minWidth: options.minWidths[columnId],
        maxWidth: options.maxWidth,
      },
    );
  }
  return widths;
}

export function applyCompressSourceColumnWidths<ColumnId extends string>(
  table: HTMLTableElement,
  options: ApplyCompressSourceColumnWidthsOptions<ColumnId>,
): void {
  for (const columnId of options.columnIds) {
    table.style.setProperty(
      `--compress-source-${columnId}-column-width`,
      `${options.widths[columnId]}px`,
    );
  }
  const tableWidth = options.includeColumnWidth
    + options.columnIds.reduce((total, columnId) => total + options.widths[columnId], 0);
  table.style.minWidth = `${tableWidth}px`;
}

function createPlanSummaryHtml(options: CreatePlanSummaryRenderOptions): string {
  const { plan, translator, formatBytes } = options;
  const hasWarnings = plan.warnings.length > 0;
  const warnings = hasWarnings
    ? `<ul>${plan.warnings.map((value) => `<li>${escapeHtml(value)}</li>`).join("")}</ul>`
    : `<p>${escapeHtml(translator.t("create.plan.noWarnings"))}</p>`;

  const sampleRows = plan.entries
    .slice(0, 8)
    .map((entry) => `<li>${escapeHtml(entry)}</li>`)
    .join("");

  const summaryText = translator.t("create.plan.summary", {
    count: plan.includedCount,
    size: formatBytes(plan.totalBytes),
    warnings: plan.warnings.length,
  });

  return `
    <div class="plan-validation ${hasWarnings ? "has-warnings" : "is-ready"}">
      <strong>${escapeHtml(summaryText)}</strong>
    </div>
    <details class="plan-details" ${hasWarnings ? "open" : ""}>
      <summary>${escapeHtml(translator.t("create.plan.details"))}</summary>
      <div class="plan-grid">
        <p><strong>${escapeHtml(translator.t("create.plan.included"))}</strong> ${plan.includedCount} entries - ${formatBytes(plan.totalBytes)}</p>
        <p><strong>${escapeHtml(translator.t("create.plan.excluded"))}</strong> ${plan.excludedCount} entries - ${formatBytes(plan.excludedBytes)}</p>
        <p><strong>${escapeHtml(translator.t("create.plan.warnings"))}</strong> ${plan.warnings.length}</p>
      </div>
      <div class="plan-list">
        <p>${escapeHtml(translator.t("create.plan.includedSample"))}</p>
        <ul>${sampleRows || `<li>${escapeHtml(translator.t("create.plan.none"))}</li>`}</ul>
      </div>
      <div class="plan-warnings">
        ${warnings}
      </div>
    </details>
  `;
}

function renderCompressSourceTableRow(row: CompressSourceTableRowModel): string {
  if (row.rowType === "parent") {
    return `
      <tr class="folder-row parent-row" data-compress-folder-row="${escapeHtml(row.path)}" tabindex="0" aria-label="${escapeHtml(row.ariaLabel)}" aria-keyshortcuts="Enter ContextMenu Shift+F10">
        <td class="inclusion-cell"></td>
        <td class="name-cell">${renderCompressPlanNameCell(row)}</td>
        <td></td>
        <td></td>
        <td>${escapeHtml(row.kindText)}</td>
      </tr>
    `;
  }

  if (row.rowType === "folder") {
    return `
      <tr
        class="${compressSourceRowClasses(row)}"
        data-compress-folder-row="${escapeHtml(row.path)}"
        data-compress-path="${escapeHtml(row.path)}"
        ${compressSourcePathAttribute(row.sourcePath)}
        tabindex="0"
        aria-label="${escapeHtml(row.ariaLabel)}"
        aria-selected="${row.selected ? "true" : "false"}"
        aria-keyshortcuts="Space Enter Delete ContextMenu Shift+F10"
      >
        <td class="inclusion-cell">${renderCompressInclusionCheckbox(row)}</td>
        <td class="name-cell">${renderCompressPlanNameCell(row)}</td>
        <td>${escapeHtml(row.sizeText)}</td>
        <td>${escapeHtml(row.modifiedText)}</td>
        <td>${escapeHtml(row.kindText)}</td>
      </tr>
    `;
  }

  return `
    <tr
      class="${compressSourceRowClasses(row)}"
      data-compress-entry-row="${escapeHtml(row.path)}"
      data-compress-path="${escapeHtml(row.path)}"
      ${compressSourcePathAttribute(row.sourcePath)}
      tabindex="0"
      aria-selected="${row.selected ? "true" : "false"}"
      aria-keyshortcuts="Space Enter Delete ContextMenu Shift+F10"
    >
      <td class="inclusion-cell">${renderCompressInclusionCheckbox(row)}</td>
      <td class="name-cell">${renderCompressPlanNameCell(row)}</td>
      <td>${escapeHtml(row.sizeText)}</td>
      <td>${escapeHtml(row.modifiedText)}</td>
      <td>${escapeHtml(row.kindText)}</td>
    </tr>
  `;
}

function compressSourceRowClasses(row: Extract<CompressSourceTableRowModel, { rowType: "folder" | "entry" }>): string {
  return [
    row.rowType === "folder" ? "folder-row" : "",
    row.selected ? "is-selected" : "",
    row.focused ? "is-focused-row" : "",
    row.inclusionState === "excluded" ? "is-excluded" : "",
    row.rowType === "folder" && row.inclusionState === "partial" ? "is-partial" : "",
  ].filter(Boolean).join(" ");
}

function renderCompressInclusionCheckbox(row: Extract<CompressSourceTableRowModel, { rowType: "folder" | "entry" }>): string {
  return `
    <input
      data-compress-include
      data-compress-path="${escapeHtml(row.path)}"
      data-compress-inclusion-state="${row.inclusionState}"
      type="checkbox"
      aria-label="${escapeHtml(row.includeAriaLabel)}"
      ${row.inclusionState === "included" ? "checked" : ""}
    />
  `;
}

function renderCompressPlanNameCell(row: CompressSourceTableRowModel): string {
  const inclusionBadge = row.rowType === "parent"
    ? ""
    : `<span class="source-stage-badge ${row.inclusionState === "excluded" ? "is-excluded" : ""}">${escapeHtml(row.inclusionLabel)}</span>`;

  return `
    <span class="row-primary">
      ${row.iconHtml}
      <span class="sr-only">${escapeHtml(row.iconLabel)}:</span>
      <span class="row-name">${escapeHtml(row.name)}</span>
      ${inclusionBadge}
    </span>
  `;
}

function compressSourcePathAttribute(sourcePath: string | null): string {
  return sourcePath ? `data-compress-source-path="${escapeHtml(sourcePath)}"` : "";
}

function optionNumberValue(value: number | null): string {
  return value === null ? "" : String(value);
}

function closestElement<T extends Element>(target: EventTarget | null, selector: string): T | null {
  if (!target || typeof (target as Partial<Element>).closest !== "function") {
    return null;
  }

  return (target as Element).closest<T>(selector);
}
