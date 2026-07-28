import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { GroupedColumnPreferences } from "./GroupedColumnPreferences";
import { cleanInstallVisibilityPreferences, type TableColumnVisibilityPreferences } from "../../../app/tableColumnPreferences";

function renderWithDefaults(
  overrides?: Partial<TableColumnVisibilityPreferences>,
) {
  const base = cleanInstallVisibilityPreferences();
  const visibility: TableColumnVisibilityPreferences = {
    ...base,
    ...overrides,
    visibleColumnIdsByFormatFamily: {
      ...base.visibleColumnIdsByFormatFamily,
      ...(overrides?.visibleColumnIdsByFormatFamily ?? {}),
    },
  } as TableColumnVisibilityPreferences;

  const onChange = vi.fn();
  const utils = render(
    <GroupedColumnPreferences visibility={visibility} onChange={onChange} />,
  );
  return { ...utils, onChange, visibility };
}

describe("GroupedColumnPreferences", () => {
  it("renders without crashing", () => {
    const { container } = renderWithDefaults();
    expect(container).toBeTruthy();
  });

  it("renders section headings for Common, Compress, Extract, and Per-Format", () => {
    renderWithDefaults();
    const headings = screen.getAllByRole("heading");
    const texts = headings.map((h) => h.textContent);
    expect(texts).toContain("Common Columns");
    expect(texts).toContain("Compress Only");
    expect(texts).toContain("Extract Only");
    expect(texts).toContain("Per-Format Overrides");
  });

  it("renders checkboxes for column visibility", () => {
    const { container } = renderWithDefaults();
    const checkboxes = within(container).getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(22);
  });

  it("renders Name as a disabled checkbox (always visible)", () => {
    const { container } = renderWithDefaults();
    expect(within(container).getByRole("checkbox", { name: "Name" })).toBeDisabled();
  });

  it("has a format family selector combobox", () => {
    renderWithDefaults();
    const comboboxes = screen.getAllByRole("combobox");
    expect(comboboxes.length).toBeGreaterThan(0);
  });

  it("calls onChange when a non-disabled checkbox is toggled", () => {
    const { container, onChange } = renderWithDefaults();
    fireEvent.click(within(container).getByRole("checkbox", { name: "Kind" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const patch = onChange.mock.calls[0][0];
    expect(patch.visibleColumnIds).not.toContain("kind");
  });

  it("renders Source Path in the UI", () => {
    renderWithDefaults();
    const elements = screen.getAllByText("Source Path");
    expect(elements.length).toBeGreaterThan(0);
  });
});
