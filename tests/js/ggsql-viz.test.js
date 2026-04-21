const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function createDeferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function createEnvironment() {
  var capturedDef = null;

  function createMockElement() {
    var el = {
      style: {},
      children: [],
      clientWidth: 450,
      scrollHeight: 200,
      _innerHTML: "",
      get innerHTML() { return this._innerHTML; },
      set innerHTML(v) { this._innerHTML = v; this.children = []; this.textContent = ""; },
      textContent: "",
      get firstChild() { return this.children[0] || null; },
      appendChild: function(child) { this.children.push(child); return child; },
      insertBefore: function(child, ref) {
        var idx = ref ? this.children.indexOf(ref) : this.children.length;
        if (idx === -1) idx = this.children.length;
        this.children.splice(idx, 0, child);
        return child;
      }
    };
    return el;
  }

  var context = {
    HTMLWidgets: {
      widget: function(def) { capturedDef = def; }
    },
    vegaEmbed: null,
    document: {
      createElement: function(tag) { return createMockElement(); }
    },
    console: console,
    Promise: Promise
  };

  var scriptPath = path.join(__dirname, "..", "..", "inst", "htmlwidgets", "ggsql_viz.js");
  var source = fs.readFileSync(scriptPath, "utf8");
  vm.runInNewContext(source, context, { filename: scriptPath });

  assert.ok(capturedDef, "widget definition should be registered");
  assert.equal(capturedDef.name, "ggsql_viz");

  return {
    createInstance: function(clientWidth) {
      var el = createMockElement();
      el.clientWidth = clientWidth || 450;
      var instance = capturedDef.factory(el, el.clientWidth, 400);
      return { el: el, instance: instance };
    },
    setEmbed: function(impl) {
      context.vegaEmbed = impl;
    }
  };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

test("restores authored height after rerendering while scaled down", async () => {
  var env = createEnvironment();
  env.setEmbed(function(container, spec) {
    container.scrollHeight = 200;
    return Promise.resolve({
      view: { spec: spec, finalize: function() {} }
    });
  });

  var w = env.createInstance(225); // < 450 = scaled
  w.el.style.height = "400px";

  w.instance.renderValue({ spec: { name: "first" } });
  await flushMicrotasks();
  assert.equal(w.el.style.height, "100px"); // 200 * (225/450) = 100

  w.instance.renderValue({ spec: { name: "second" } });
  await flushMicrotasks();
  assert.equal(w.el.style.height, "100px");

  w.el.clientWidth = 450;
  w.instance.resize(450, 400);
  assert.equal(w.el.style.height, "400px");
});

test("ignores superseded async embed results", async () => {
  var env = createEnvironment();
  var first = createDeferred();
  var second = createDeferred();
  var calls = [];

  env.setEmbed(function(container, spec) {
    calls.push({ container: container, spec: spec });
    if (calls.length === 1) return first.promise;
    return second.promise;
  });

  var w = env.createInstance(450);

  w.instance.renderValue({ spec: { name: "first" } });
  w.instance.renderValue({ spec: { name: "second" } });

  var staleView = { id: "stale", finalized: false, finalize: function() { this.finalized = true; } };
  var latestView = { id: "latest", finalized: false, finalize: function() { this.finalized = true; } };

  second.resolve({ view: latestView });
  await flushMicrotasks();

  first.resolve({ view: staleView });
  await flushMicrotasks();

  assert.equal(staleView.finalized, true);
  assert.equal(latestView.finalized, false);
});
