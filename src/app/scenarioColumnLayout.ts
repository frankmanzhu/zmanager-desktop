import type { TableColumnId } from "./tableColumnCatalogue";

// ---------------------------------------------------------------------------
// Scenario-specific intrinsic column widths.
//
// Compress and Extract have different width needs for the same semantic column.
// The catalogue does NOT own one shared pixel width.
// ---------------------------------------------------------------------------

export type ScenarioColumnLayout = Readonly<{
  width: number;
  minWidth?: number;
}>;

type ScenarioLayoutMap = Readonly<Record<TableColumnId, ScenarioColumnLayout>>;

// -- Compress intrinsic widths -----------------------------------------------

const COMPRESS_LAYOUT: ScenarioLayoutMap = {
  name:         { width: 320, minWidth: 140 },
  kind:         { width: 120, minWidth: 80 },
  size:         { width: 120, minWidth: 72 },
  modified:     { width: 170, minWidth: 110 },
  created:      { width: 140, minWidth: 110 },
  accessed:     { width: 140, minWidth: 110 },
  attributes:   { width: 90,  minWidth: 64 },
  mode:         { width: 82,  minWidth: 64 },
  linkTarget:   { width: 160, minWidth: 100 },
  uid:          { width: 70,  minWidth: 56 },
  gid:          { width: 70,  minWidth: 56 },
  owner:        { width: 100, minWidth: 72 },
  group:        { width: 100, minWidth: 72 },
  sourcePath:   { width: 220, minWidth: 120 },
  // Extract-only columns — not applicable to Compress but defined for type completeness
  compressedSize:     { width: 0, minWidth: 0 },
  encrypted:          { width: 0, minWidth: 0 },
  method:             { width: 0, minWidth: 0 },
  crc:                { width: 0, minWidth: 0 },
  comment:            { width: 0, minWidth: 0 },
  ratio:              { width: 0, minWidth: 0 },
  solid:              { width: 0, minWidth: 0 },
  metadataDiagnostics: { width: 0, minWidth: 0 },
};

// -- Extract intrinsic widths ------------------------------------------------

const EXTRACT_LAYOUT: ScenarioLayoutMap = {
  name:         { width: 190, minWidth: 140 },
  kind:         { width: 90,  minWidth: 80 },
  size:         { width: 100, minWidth: 60 },
  modified:     { width: 150, minWidth: 110 },
  created:      { width: 140, minWidth: 110 },
  accessed:     { width: 140, minWidth: 110 },
  attributes:   { width: 90,  minWidth: 64 },
  mode:         { width: 82,  minWidth: 64 },
  linkTarget:   { width: 160, minWidth: 100 },
  uid:          { width: 70,  minWidth: 56 },
  gid:          { width: 70,  minWidth: 56 },
  owner:        { width: 100, minWidth: 72 },
  group:        { width: 100, minWidth: 72 },
  sourcePath:   { width: 0,   minWidth: 0 },
  compressedSize:     { width: 110, minWidth: 72 },
  encrypted:          { width: 80,  minWidth: 64 },
  method:             { width: 120, minWidth: 80 },
  crc:                { width: 90,  minWidth: 72 },
  comment:            { width: 120, minWidth: 80 },
  ratio:              { width: 70,  minWidth: 56 },
  solid:              { width: 60,  minWidth: 52 },
  metadataDiagnostics: { width: 100, minWidth: 72 },
};

// -- Public accessors --------------------------------------------------------

export function getCompressLayout(id: TableColumnId): ScenarioColumnLayout {
  return COMPRESS_LAYOUT[id] ?? { width: 100, minWidth: 64 };
}

export function getExtractLayout(id: TableColumnId): ScenarioColumnLayout {
  return EXTRACT_LAYOUT[id] ?? { width: 100, minWidth: 64 };
}
