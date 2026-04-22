const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadSizing() {
  var context = { console: console };
  context.window = context;

  var scriptPath = path.join(__dirname, "..", "..", "inst", "htmlwidgets", "ggsql_viz_sizing.js");
  var source = fs.readFileSync(scriptPath, "utf8");
  vm.runInNewContext(source, context, { filename: scriptPath });

  assert.ok(context.GgsqlSizing, "GgsqlSizing should be defined on window");
  return context.GgsqlSizing;
}

// --- isCompound ---

test("isCompound returns false for a simple mark spec", function() {
  var sizing = loadSizing();
  assert.equal(sizing.isCompound({ mark: "point" }), false);
});

test("isCompound returns true for facet spec", function() {
  var sizing = loadSizing();
  assert.equal(sizing.isCompound({ facet: { field: "x" }, spec: {} }), true);
});

test("isCompound returns true for hconcat spec", function() {
  var sizing = loadSizing();
  assert.equal(sizing.isCompound({ hconcat: [{}, {}] }), true);
});

test("isCompound returns true for vconcat spec", function() {
  var sizing = loadSizing();
  assert.equal(sizing.isCompound({ vconcat: [{}, {}] }), true);
});

test("isCompound returns true for concat spec", function() {
  var sizing = loadSizing();
  assert.equal(sizing.isCompound({ concat: [{}, {}] }), true);
});

// --- hasLegend ---

test("hasLegend returns false when no legend-producing encoding exists", function() {
  var sizing = loadSizing();
  assert.equal(sizing.hasLegend({ mark: "point", encoding: { x: { field: "a" }, y: { field: "b" } } }), false);
});

test("hasLegend returns true for color encoding with field", function() {
  var sizing = loadSizing();
  assert.equal(sizing.hasLegend({ mark: "point", encoding: { color: { field: "c" } } }), true);
});

test("hasLegend finds legends inside layer arrays", function() {
  var sizing = loadSizing();
  var spec = {
    layer: [
      { mark: "line", encoding: { x: { field: "a" } } },
      { mark: "point", encoding: { color: { field: "c" } } }
    ]
  };
  assert.equal(sizing.hasLegend(spec), true);
});

test("hasLegend finds legend inside facet inner spec", function() {
  var sizing = loadSizing();
  var spec = {
    facet: { field: "x" },
    spec: { mark: "point", encoding: { color: { field: "c" } } }
  };
  assert.equal(sizing.hasLegend(spec), true);
});

// --- fitToContainer ---

// padding_x = 80, padding_y = 120, LEGEND_WIDTH = 120
// usable_w = max(900 - 80, 100) = 820
// usable_h = max(500 - 120, 100) = 380

test("fitToContainer facet with columns=2 at 900x500", function() {
  var sizing = loadSizing();
  var spec = { facet: { field: "x" }, spec: { mark: "point" }, columns: 2 };
  var result = sizing.fitToContainer(spec, 900, 500);
  // usable_w=820, ncol=2, cell_w=floor(820/2)=410; usable_h=380
  assert.equal(result.spec.width, 410);
  assert.equal(result.spec.height, 380);
});

test("fitToContainer hconcat with 2 sub-specs at 900x500", function() {
  var sizing = loadSizing();
  var spec = { hconcat: [{ mark: "point" }, { mark: "bar" }] };
  var result = sizing.fitToContainer(spec, 900, 500);
  // usable_w=820, n=2, cell_w=floor(820/2)=410
  // usable_h=380
  assert.equal(result.hconcat[0].width, 410);
  assert.equal(result.hconcat[0].height, 380);
  assert.equal(result.hconcat[1].width, 410);
  assert.equal(result.hconcat[1].height, 380);
});

test("fitToContainer vconcat with 2 sub-specs at 900x500", function() {
  var sizing = loadSizing();
  var spec = { vconcat: [{ mark: "point" }, { mark: "bar" }] };
  var result = sizing.fitToContainer(spec, 900, 500);
  // usable_w=820, usable_h=380, n=2, cell_h=floor(380/2)=190
  assert.equal(result.vconcat[0].width, 820);
  assert.equal(result.vconcat[0].height, 190);
  assert.equal(result.vconcat[1].width, 820);
  assert.equal(result.vconcat[1].height, 190);
});

test("fitToContainer concat with 3 items columns=2 at 900x500", function() {
  var sizing = loadSizing();
  var spec = { concat: [{ mark: "point" }, { mark: "bar" }, { mark: "line" }], columns: 2 };
  var result = sizing.fitToContainer(spec, 900, 500);
  // usable_w=820, ncol=2, cell_w=floor(820/2)=410
  assert.equal(result.concat[0].width, 410);
  assert.equal(result.concat[1].width, 410);
  assert.equal(result.concat[2].width, 410);
});

test("fitToContainer concat defaults columns to item count when not specified", function() {
  var sizing = loadSizing();
  var spec = { concat: [{ mark: "point" }, { mark: "bar" }] };
  var result = sizing.fitToContainer(spec, 900, 500);
  // ncol defaults to 2 (item count), cell_w=floor(820/2)=410
  assert.equal(result.concat[0].width, 410);
  assert.equal(result.concat[1].width, 410);
});

test("fitToContainer concat sets height on sub-specs", function() {
  var sizing = loadSizing();
  var spec = { concat: [{ mark: "point" }, { mark: "bar" }] };
  var result = sizing.fitToContainer(spec, 900, 500);
  assert.equal(result.concat[0].height, 380);
  assert.equal(result.concat[1].height, 380);
});

test("fitToContainer adds legend padding for color legend on hconcat at 900x500", function() {
  var sizing = loadSizing();
  var spec = {
    hconcat: [
      { mark: "point", encoding: { color: { field: "c" } } },
      { mark: "bar" }
    ]
  };
  var result = sizing.fitToContainer(spec, 900, 500);
  // padding_x = 80 + 120 (legend) = 200, usable_w = 700, n=2, cell_w = 350
  assert.equal(result.hconcat[0].width, 350);
  assert.equal(result.hconcat[1].width, 350);
});

test("fitToContainer does NOT mutate input spec", function() {
  var sizing = loadSizing();
  var sub1 = { mark: "point" };
  var sub2 = { mark: "bar" };
  var spec = { hconcat: [sub1, sub2] };
  sizing.fitToContainer(spec, 900, 500);
  assert.equal(spec.hconcat[0].width, undefined);
  assert.equal(spec.hconcat[1].width, undefined);
  assert.equal(spec.hconcat, undefined || spec.hconcat); // original array untouched
  // More directly: sub-specs should not have width set
  assert.equal(sub1.width, undefined);
  assert.equal(sub2.width, undefined);
});

test("fitToContainer clamps usable dimensions to minimum 100", function() {
  var sizing = loadSizing();
  // Container smaller than padding: 50x50
  // usable_w = max(50 - 80, 100) = 100
  // usable_h = max(50 - 120, 100) = 100
  var spec = { hconcat: [{ mark: "point" }, { mark: "bar" }] };
  var result = sizing.fitToContainer(spec, 50, 50);
  // n=2, cell_w=floor(100/2)=50, height=100
  assert.equal(result.hconcat[0].width, 50);
  assert.equal(result.hconcat[0].height, 100);
});
