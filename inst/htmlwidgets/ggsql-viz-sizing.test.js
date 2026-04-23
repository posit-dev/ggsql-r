const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadSizing() {
  var context = {
    console: console,
    HTMLElement: function() {},
    customElements: {
      define: function() {},
      get: function() {}
    },
    HTMLWidgets: { widget: function() {} },
    Promise: Promise,
    module: { exports: {} }
  };
  context.window = context;
  context.document = { createElement: function() { return new context.HTMLElement(); } };

  var scriptPath = path.join(__dirname, "ggsql_viz.js");
  var source = fs.readFileSync(scriptPath, "utf8");
  vm.runInNewContext(source, context, { filename: scriptPath });

  assert.ok(context.module.exports.isCompound, "sizing helpers should be exported via module.exports");
  assert.ok(context.module.exports.allocateCompoundSize, "allocateCompoundSize should be exported via module.exports");
  return context.module.exports;
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

// --- allocateCompoundSize ---

test("allocateCompoundSize divides concat height by inferred row count", function() {
  var sizing = loadSizing();
  var spec = {
    concat: [{ mark: "point" }, { mark: "bar" }, { mark: "line" }],
    columns: 2
  };
  var viewport = { logicalWidth: 900, logicalHeight: 500 };
  var result = sizing.allocateCompoundSize(spec, viewport);

  assert.equal(result.concat[0].width, 410);
  assert.equal(result.concat[0].height, 190);
  assert.equal(result.concat[2].height, 190);
});

test("allocateCompoundSize distributes hconcat children across usable width", function() {
  var sizing = loadSizing();
  var spec = { hconcat: [{ mark: "point" }, { mark: "bar" }] };
  var viewport = { logicalWidth: 900, logicalHeight: 500 };
  var result = sizing.allocateCompoundSize(spec, viewport);

  assert.equal(result.hconcat[0].width, 410);
  assert.equal(result.hconcat[0].height, 380);
  assert.equal(result.hconcat[1].width, 410);
});

test("allocateCompoundSize does not mutate the input spec", function() {
  var sizing = loadSizing();
  var sub = { mark: "point" };
  var spec = { concat: [sub], columns: 1 };
  var viewport = { logicalWidth: 600, logicalHeight: 400 };

  sizing.allocateCompoundSize(spec, viewport);

  assert.equal(spec.concat[0].width, undefined);
  assert.equal(sub.width, undefined);
});

test("allocateCompoundSize ignores legends when computing allocation", function() {
  var sizing = loadSizing();
  var base = { concat: [{ mark: "point" }] };
  var withLegend = {
    concat: [{
      mark: "point",
      encoding: { color: { field: "c" } }
    }]
  };
  var viewport = { logicalWidth: 900, logicalHeight: 500 };

  var baseResult = sizing.allocateCompoundSize(base, viewport);
  var legendResult = sizing.allocateCompoundSize(withLegend, viewport);

  assert.equal(baseResult.concat[0].width, legendResult.concat[0].width);
  assert.equal(baseResult.concat[0].height, legendResult.concat[0].height);
});

test("allocateCompoundSize does not read legend encodings even via proxies", function() {
  var sizing = loadSizing();
  function throwingEncoding(field) {
    return new Proxy({ field: field }, {
      get(target, key) {
        if (key === "field") return target.field;
        throw new Error("encoding should not be inspected");
      }
    });
  }
  var spec = {
    concat: [{
      mark: "point",
      encoding: throwingEncoding("c")
    }]
  };
  var layeredSpec = {
    concat: [{
      mark: "point",
      layer: [{
        mark: "line",
        encoding: throwingEncoding("a")
      }, {
        mark: "point",
        encoding: throwingEncoding("b")
      }]
    }]
  };
  var viewport = { logicalWidth: 800, logicalHeight: 400 };

  sizing.allocateCompoundSize(spec, viewport);
  sizing.allocateCompoundSize(layeredSpec, viewport);
});
