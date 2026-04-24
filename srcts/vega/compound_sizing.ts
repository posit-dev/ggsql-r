// Pre-allocate sub-chart dimensions for compound Vega-Lite specs.
//
// Compound specs (facet, hconcat, vconcat, concat) don't reliably autosize
// into the available container with Vega-Lite's built-in autosize. This module
// inspects the spec structure and writes explicit width/height into each
// sub-chart before we hand the spec to vega-embed.

export type AnyRecord = Record<string, unknown>;

// These types model just enough of each Vega-Lite compound spec shape to
// extract the fields we need. They intersect with AnyRecord so we can spread
// any extra keys through unchanged.

type FacetSpec = AnyRecord & {
  facet: { field?: unknown; row?: { field?: unknown }; column?: { field?: unknown } };
  columns?: number;
  spec?: AnyRecord;
  data?: { values?: AnyRecord[] };
};

type HConcatSpec = AnyRecord & {
  hconcat: AnyRecord[];
};

type VConcatSpec = AnyRecord & {
  vconcat: AnyRecord[];
};

type ConcatSpec = AnyRecord & {
  concat: AnyRecord[];
  columns?: number;
};

export type CompoundSizingLayout = {
  renderWidth: number;
  renderHeight: number;
};

// Approximate space consumed by axes, legends, and padding that sit outside
// the plot area. These are rough estimates — Vega's actual padding depends on
// label lengths, legend position, etc.
const OUTER_PAD_X = 80;
const OUTER_PAD_Y = 120;
const LEGEND_WIDTH = 120;

const LEGEND_CHANNELS = new Set([
  "color", "fill", "stroke", "shape", "size", "opacity"
]);

export function isCompoundSpec(spec: AnyRecord): boolean {
  return (
    "facet" in spec ||
    "hconcat" in spec ||
    "vconcat" in spec ||
    "concat" in spec
  );
}

// Compound Vega-Lite specs don't reliably autosize, so we pre-allocate child
// dimensions before handing the spec to vega-embed.
export function allocateCompoundChartSize(
  spec: AnyRecord,
  layout: CompoundSizingLayout
): AnyRecord {
  const paddingX = OUTER_PAD_X + (hasLegend(spec) ? LEGEND_WIDTH : 0);
  const usableWidth = Math.max(layout.renderWidth - paddingX, 100);
  const usableHeight = Math.max(layout.renderHeight - OUTER_PAD_Y, 100);

  if ("facet" in spec) {
    const facetSpec = spec as FacetSpec;
    const isGridFacet = facetSpec.facet.row != null || facetSpec.facet.column != null;

    let columnCount: number;
    let rowCount: number;

    if (isGridFacet) {
      columnCount = inferDistinctCount(facetSpec, facetSpec.facet.column?.field) || 1;
      rowCount = inferDistinctCount(facetSpec, facetSpec.facet.row?.field) || 1;
    } else {
      columnCount = Math.max(facetSpec.columns || 1, 1);
      rowCount = inferFacetRows(facetSpec, columnCount);
    }

    const cellWidth = Math.max(Math.floor(usableWidth / Math.max(columnCount, 1)), 1);
    const cellHeight = Math.max(Math.floor(usableHeight / Math.max(rowCount, 1)), 1);
    return {
      ...facetSpec,
      spec: { ...(facetSpec.spec ?? {}), width: cellWidth, height: cellHeight }
    };
  }

  if ("hconcat" in spec) {
    const hconcatSpec = spec as HConcatSpec;
    const cellWidth = Math.max(
      Math.floor(usableWidth / Math.max(hconcatSpec.hconcat.length, 1)),
      1
    );
    return {
      ...hconcatSpec,
      hconcat: hconcatSpec.hconcat.map((subspec) => ({
        ...subspec,
        width: cellWidth,
        height: usableHeight
      }))
    };
  }

  if ("vconcat" in spec) {
    const vconcatSpec = spec as VConcatSpec;
    const cellHeight = Math.max(
      Math.floor(usableHeight / Math.max(vconcatSpec.vconcat.length, 1)),
      1
    );
    return {
      ...vconcatSpec,
      vconcat: vconcatSpec.vconcat.map((subspec) => ({
        ...subspec,
        width: usableWidth,
        height: cellHeight
      }))
    };
  }

  if ("concat" in spec) {
    const concatSpec = spec as ConcatSpec;
    const columnCount = Math.max(concatSpec.columns || concatSpec.concat.length || 1, 1);
    const rowCount = Math.ceil(concatSpec.concat.length / columnCount);
    const cellWidth = Math.max(Math.floor(usableWidth / Math.max(columnCount, 1)), 1);
    const cellHeight = Math.max(Math.floor(usableHeight / Math.max(rowCount, 1)), 1);
    return {
      ...concatSpec,
      concat: concatSpec.concat.map((subspec) => ({
        ...subspec,
        width: cellWidth,
        height: cellHeight
      }))
    };
  }

  return { ...spec };
}

function hasLegend(spec: AnyRecord): boolean {
  const subSpecs: AnyRecord[] = [];
  if ("spec" in spec) subSpecs.push(spec.spec as AnyRecord);
  for (const key of ["hconcat", "vconcat", "concat"] as const) {
    if (key in spec) subSpecs.push(...(spec[key] as AnyRecord[]));
  }
  for (const sub of subSpecs) {
    const layers = (Array.isArray(sub.layer) ? sub.layer : [sub]) as AnyRecord[];
    for (const layer of layers) {
      const enc = layer.encoding as AnyRecord | undefined;
      if (!enc) continue;
      for (const ch of LEGEND_CHANNELS) {
        if (ch in enc && typeof enc[ch] === "object" && enc[ch] !== null && "field" in (enc[ch] as AnyRecord)) {
          return true;
        }
      }
    }
  }
  return false;
}

function inferFacetRows(spec: FacetSpec, columns: number): number {
  const count = inferDistinctCount(spec, spec.facet?.field);
  if (count <= 0) return 1;
  return Math.ceil(count / Math.max(columns, 1));
}

// Count distinct values of a field from inline data. Returns 0 if the
// data isn't inline (e.g., loaded from a URL) or the field is missing.
function inferDistinctCount(spec: FacetSpec, field: unknown): number {
  if (typeof field !== "string") return 0;
  const values = spec.data && Array.isArray(spec.data.values) ? spec.data.values : null;
  if (!values || values.length === 0) return 0;

  const seen: Record<string, true> = Object.create(null) as Record<string, true>;
  for (let i = 0; i < values.length; i += 1) {
    if (!Object.prototype.hasOwnProperty.call(values[i], field)) continue;
    seen[String(values[i][field])] = true;
  }
  return Object.keys(seen).length;
}
