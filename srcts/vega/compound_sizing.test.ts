import * as assert from "node:assert/strict";
import { test } from "node:test";

import {
  allocateCompoundChartSize,
  isCompoundSpec
} from "./compound_sizing";

// --- isCompound ---

test("isCompound returns false for a simple mark spec", () => {
  assert.equal(isCompoundSpec({ mark: "point" }), false);
});

test("isCompound returns true for facet spec", () => {
  assert.equal(isCompoundSpec({ facet: { field: "x" }, spec: {} }), true);
});

test("isCompound returns true for hconcat spec", () => {
  assert.equal(isCompoundSpec({ hconcat: [{}, {}] }), true);
});

test("isCompound returns true for vconcat spec", () => {
  assert.equal(isCompoundSpec({ vconcat: [{}, {}] }), true);
});

test("isCompound returns true for concat spec", () => {
  assert.equal(isCompoundSpec({ concat: [{}, {}] }), true);
});

// --- allocateCompoundSize ---

test("allocateCompoundSize divides concat height by inferred row count", () => {
  const spec = {
    concat: [{ mark: "point" }, { mark: "bar" }, { mark: "line" }],
    columns: 2
  };
  const layout = { renderWidth: 900, renderHeight: 500 };
  const result = allocateCompoundChartSize(spec, layout) as {
    concat: Array<{ width: number; height: number }>;
  };

  assert.equal(result.concat[0].width, 410);
  assert.equal(result.concat[1].width, 410);
  assert.equal(result.concat[2].width, 410);
  assert.equal(result.concat[0].height, 190);
  assert.equal(result.concat[1].height, 190);
  assert.equal(result.concat[2].height, 190);
});

test("allocateCompoundSize divides facet height by inferred row count", () => {
  const spec = {
    data: {
      values: [
        { facet_key: "a" },
        { facet_key: "b" },
        { facet_key: "c" },
        { facet_key: "d" },
        { facet_key: "e" },
        { facet_key: "f" }
      ]
    },
    facet: { field: "facet_key" },
    columns: 3,
    spec: { mark: "point" }
  };
  const layout = { renderWidth: 900, renderHeight: 500 };
  const result = allocateCompoundChartSize(spec, layout) as {
    spec: { width: number; height: number };
  };

  assert.equal(result.spec.width, 273);
  assert.equal(result.spec.height, 190);
});

test("allocateCompoundSize clamps facet dimensions to at least one pixel", () => {
  const values: Array<{ facet_key: string }> = [];
  for (let i = 0; i < 200; i += 1) {
    values.push({ facet_key: `facet_${i}` });
  }

  const spec = {
    data: { values },
    facet: { field: "facet_key" },
    columns: 1,
    spec: { mark: "point" }
  };
  const layout = { renderWidth: 120, renderHeight: 120 };
  const result = allocateCompoundChartSize(spec, layout) as {
    spec: { width: number; height: number };
  };

  assert.equal(result.spec.width, 100);
  assert.equal(result.spec.height, 1);
});

test("allocateCompoundSize distributes hconcat children across usable width", () => {
  const spec = { hconcat: [{ mark: "point" }, { mark: "bar" }] };
  const layout = { renderWidth: 900, renderHeight: 500 };
  const result = allocateCompoundChartSize(spec, layout) as {
    hconcat: Array<{ width: number; height: number }>;
  };

  assert.equal(result.hconcat[0].width, 410);
  assert.equal(result.hconcat[0].height, 380);
  assert.equal(result.hconcat[1].width, 410);
});

test("allocateCompoundSize handles row/column grid facets", () => {
  const spec = {
    data: {
      values: [
        { r: "a", c: "x" },
        { r: "a", c: "y" },
        { r: "a", c: "z" },
        { r: "b", c: "x" },
        { r: "b", c: "y" },
        { r: "b", c: "z" }
      ]
    },
    facet: { row: { field: "r" }, column: { field: "c" } },
    spec: { mark: "point" }
  };
  const layout = { renderWidth: 900, renderHeight: 500 };
  const result = allocateCompoundChartSize(spec, layout) as {
    spec: { width: number; height: number };
  };

  // 3 columns: usable_w=820, 820/3 = 273
  assert.equal(result.spec.width, 273);
  // 2 rows: usable_h=380, 380/2 = 190
  assert.equal(result.spec.height, 190);
});

test("allocateCompoundSize handles row-only grid facet", () => {
  const spec = {
    data: {
      values: [
        { r: "a" }, { r: "b" }, { r: "c" }
      ]
    },
    facet: { row: { field: "r" } },
    spec: { mark: "point" }
  };
  const layout = { renderWidth: 900, renderHeight: 500 };
  const result = allocateCompoundChartSize(spec, layout) as {
    spec: { width: number; height: number };
  };

  // No column facet: columnCount=1, full usable width
  assert.equal(result.spec.width, 820);
  // 3 rows: usable_h=380, 380/3 = 126
  assert.equal(result.spec.height, 126);
});

test("allocateCompoundSize does not mutate the input spec", () => {
  const sub: { mark: string; width?: number } = { mark: "point" };
  const spec: { concat: Array<{ mark: string; width?: number }>; columns: number } = {
    concat: [sub],
    columns: 1
  };
  const layout = { renderWidth: 600, renderHeight: 400 };

  allocateCompoundChartSize(spec, layout);

  assert.equal(spec.concat[0].width, undefined);
  assert.equal(sub.width, undefined);
});

test("allocateCompoundSize subtracts legend width when a legend channel has a field", () => {
  const base = { concat: [{ mark: "point" }] };
  const withLegend = {
    concat: [
      {
        mark: "point",
        encoding: { color: { field: "c" } }
      }
    ]
  };
  const layout = { renderWidth: 900, renderHeight: 500 };

  const baseResult = allocateCompoundChartSize(base, layout) as {
    concat: Array<{ width: number; height: number }>;
  };
  const legendResult = allocateCompoundChartSize(withLegend, layout) as {
    concat: Array<{ width: number; height: number }>;
  };

  // LEGEND_WIDTH = 120, so the legend spec should be 120px narrower
  assert.equal(baseResult.concat[0].width - legendResult.concat[0].width, 120);
  assert.equal(baseResult.concat[0].height, legendResult.concat[0].height);
});

test("allocateCompoundSize detects legends inside layers", () => {
  const spec = {
    concat: [
      {
        layer: [
          { mark: "line", encoding: { x: { field: "a" } } },
          { mark: "point", encoding: { color: { field: "b" } } }
        ]
      }
    ]
  };
  const noLegend = { concat: [{ mark: "point" }] };
  const layout = { renderWidth: 900, renderHeight: 500 };

  const result = allocateCompoundChartSize(spec, layout) as {
    concat: Array<{ width: number; height: number }>;
  };
  const baseResult = allocateCompoundChartSize(noLegend, layout) as {
    concat: Array<{ width: number; height: number }>;
  };

  assert.equal(baseResult.concat[0].width - result.concat[0].width, 120);
});
