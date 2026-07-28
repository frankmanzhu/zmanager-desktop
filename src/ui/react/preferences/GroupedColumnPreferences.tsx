import { useState } from "react";
import { Checkbox } from "../../components/ui/checkbox";
import { Button } from "../../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { TABLE_COLUMN_CATALOGUE, type TableColumnId, type TableColumnDefinition } from "../../../app/tableColumnCatalogue";
import { ALL_ARCHIVE_FORMAT_FAMILIES, preferredSuffixForFamily, type ArchiveFormatFamily } from "../../../app/archiveFormatFamily";
import type { TableColumnVisibilityPreferences } from "../../../app/tableColumnPreferences";

type Props = Readonly<{
  /** Current visibility preferences (may be draft) */
  visibility: TableColumnVisibilityPreferences;
  /** Called when the user toggles a global column or changes a family override */
  onChange: (patch: TableColumnVisibilityPreferences) => void;
}>;

const COMMON_COLUMNS: readonly TableColumnDefinition[] = TABLE_COLUMN_CATALOGUE.filter((c: TableColumnDefinition) => c.scope === "common");
const COMPRESS_ONLY_COLUMNS: readonly TableColumnDefinition[] = TABLE_COLUMN_CATALOGUE.filter((c: TableColumnDefinition) => c.scope === "compress");
const EXTRACT_ONLY_COLUMNS: readonly TableColumnDefinition[] = TABLE_COLUMN_CATALOGUE.filter((c: TableColumnDefinition) => c.scope === "extract");

export function GroupedColumnPreferences({ visibility, onChange }: Props) {
  const [selectedFamily, setSelectedFamily] = useState<string>("");

  const globalVisible = new Set<TableColumnId>(visibility.visibleColumnIds as readonly TableColumnId[]);

  const handleGlobalToggle = (columnId: TableColumnId) => {
    const isVisible = globalVisible.has(columnId);
    const newVisible = isVisible
      ? visibility.visibleColumnIds.filter((id: TableColumnId) => id !== columnId)
      : [...visibility.visibleColumnIds, columnId];

    onChange({
      ...visibility,
      visibleColumnIds: newVisible,
    });
  };

  const familyOverride = selectedFamily
    ? (visibility.visibleColumnIdsByFormatFamily as Record<string, readonly string[]>)[selectedFamily]
    : undefined;

  const handleFamilyToggle = (columnId: string) => {
    if (!selectedFamily) return;
    // Seed from existing override, otherwise from intersection of global visibility
    // and extract-only columns — common columns stay global, only extract-only
    // columns are configurable per format family.
    const current = familyOverride
      ? [...familyOverride]
      : visibility.visibleColumnIds.filter((id) =>
          EXTRACT_ONLY_COLUMNS.some((col) => col.id === id),
        );
    const idx = current.indexOf(columnId);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(columnId);
    }

    const byFamily = { ...visibility.visibleColumnIdsByFormatFamily as Record<string, readonly string[]> };
    if (current.length > 0 && current.some((id) => id !== "name")) {
      byFamily[selectedFamily] = current;
    } else {
      delete byFamily[selectedFamily];
    }

    onChange({
      ...visibility,
      visibleColumnIdsByFormatFamily: byFamily as TableColumnVisibilityPreferences["visibleColumnIdsByFormatFamily"],
    });
  };

  const handleResetFamily = () => {
    if (!selectedFamily) return;
    const byFamily = { ...visibility.visibleColumnIdsByFormatFamily as Record<string, readonly string[]> };
    delete byFamily[selectedFamily];
    onChange({
      ...visibility,
      visibleColumnIdsByFormatFamily: byFamily as TableColumnVisibilityPreferences["visibleColumnIdsByFormatFamily"],
    });
  };

  const familyOverrideSet = new Set(familyOverride ?? []);

  return (
    <div className="space-y-6">
      {/* Common columns */}
      <section>
        <h4 className="text-sm font-semibold mb-2">Common Columns</h4>
        <p className="text-xs text-muted-foreground mb-2">
          Visible in both Compress and Extract tables when supported.
        </p>
        <div className="grid gap-2">
          {COMMON_COLUMNS.map((col: TableColumnDefinition) => (
            <label key={col.id} className="flex items-center gap-2 text-sm font-medium">
              <Checkbox
                checked={globalVisible.has(col.id)}
                disabled={col.alwaysVisible}
                onCheckedChange={() => handleGlobalToggle(col.id)}
              />
              <span>{col.id.replace(/([A-Z])/g, " $1").replace(/^./, (s: string) => s.toUpperCase())}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Compress-only columns */}
      <section>
        <h4 className="text-sm font-semibold mb-2">Compress Only</h4>
        <p className="text-xs text-muted-foreground mb-2">
          Visible in the Compress (Create) table only.
        </p>
        <div className="grid gap-2">
          {COMPRESS_ONLY_COLUMNS.map((col: TableColumnDefinition) => (
            <label key={col.id} className="flex items-center gap-2 text-sm font-medium">
              <Checkbox
                checked={globalVisible.has(col.id)}
                disabled={col.alwaysVisible}
                onCheckedChange={() => handleGlobalToggle(col.id)}
              />
              <span>Source Path</span>
            </label>
          ))}
        </div>
      </section>

      {/* Extract-only columns */}
      <section>
        <h4 className="text-sm font-semibold mb-2">Extract Only</h4>
        <p className="text-xs text-muted-foreground mb-2">
          Visible in the Extract (Archive) table only when the format supports them.
        </p>
        <div className="grid gap-2">
          {EXTRACT_ONLY_COLUMNS.map((col: TableColumnDefinition) => (
            <label key={col.id} className="flex items-center gap-2 text-sm font-medium">
              <Checkbox
                checked={globalVisible.has(col.id)}
                disabled={col.alwaysVisible}
                onCheckedChange={() => handleGlobalToggle(col.id)}
              />
              <span>{col.id.replace(/([A-Z])/g, " $1").replace(/^./, (s: string) => s.toUpperCase())}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Per-format-family Extract overrides */}
      <section className="border-t pt-4">
        <h4 className="text-sm font-semibold mb-2">Per-Format Overrides</h4>
        <p className="text-xs text-muted-foreground mb-2">
          Override which Extract columns are visible for a specific archive format.
        </p>

        <div className="flex items-center gap-2 mb-3">
          <Select value={selectedFamily} onValueChange={setSelectedFamily}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Select format family..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None (use global defaults)</SelectItem>
              {ALL_ARCHIVE_FORMAT_FAMILIES.map((family: ArchiveFormatFamily) => (
                <SelectItem key={family} value={family}>
                  {family} ({preferredSuffixForFamily(family)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedFamily && familyOverride && (
            <Button
              type="button"
              variant="dialog"
              size="unset"
              className="!px-2 !py-1 !text-xs"
              onClick={handleResetFamily}
            >
              Reset
            </Button>
          )}
        </div>

        {selectedFamily && (
          <div className="grid gap-2 ml-4">
            {EXTRACT_ONLY_COLUMNS.map((col: TableColumnDefinition) => (
              <label key={col.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={familyOverrideSet.has(col.id)}
                  onCheckedChange={() => handleFamilyToggle(col.id)}
                />
                <span className={familyOverrideSet.has(col.id) ? "font-medium" : "text-muted-foreground"}>
                  {col.id.replace(/([A-Z])/g, " $1").replace(/^./, (s: string) => s.toUpperCase())}
                </span>
              </label>
            ))}
            <p className="text-xs text-muted-foreground mt-1">
              Only checked columns will be visible for {selectedFamily} archives.
              Common columns continue to use global defaults.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
