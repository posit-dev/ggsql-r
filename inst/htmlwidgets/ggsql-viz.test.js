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
  var definedElements = new Map();

  function MockHTMLElement(tagName) {
    this.tagName = String(tagName || "div").toUpperCase();
    this.style = {};
    this.children = [];
    this.parentNode = null;
    this.clientWidth = 450;
    this.scrollHeight = 200;
    this.isConnected = true;
    this._innerHTML = "";
    this.textContent = "";
    this._classes = new Set();
    this.classList = {
      add: (...names) => {
        for (var i = 0; i < names.length; i++) this._classes.add(names[i]);
      },
      remove: (...names) => {
        for (var i = 0; i < names.length; i++) this._classes.delete(names[i]);
      },
      contains: (name) => this._classes.has(name)
    };
  }

  MockHTMLElement.prototype.appendChild = function(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  };

  MockHTMLElement.prototype.insertBefore = function(child, ref) {
    var idx = ref ? this.children.indexOf(ref) : this.children.length;
    if (idx === -1) idx = this.children.length;
    child.parentNode = this;
    this.children.splice(idx, 0, child);
    return child;
  };

  MockHTMLElement.prototype.removeChild = function(child) {
    var idx = this.children.indexOf(child);
    if (idx !== -1) this.children.splice(idx, 1);
    child.parentNode = null;
    return child;
  };

  MockHTMLElement.prototype.remove = function() {
    this.isConnected = false;
    if (this.parentNode) this.parentNode.removeChild(this);
    if (typeof this.disconnectedCallback === "function") {
      this.disconnectedCallback();
    }
  };

  Object.defineProperty(MockHTMLElement.prototype, "innerHTML", {
    get: function() { return this._innerHTML; },
    set: function(v) {
      this._innerHTML = v;
      this.children = [];
      this.textContent = "";
    }
  });

  Object.defineProperty(MockHTMLElement.prototype, "firstChild", {
    get: function() { return this.children[0] || null; }
  });

  var context = {
    HTMLWidgets: {
      widget: function(def) { capturedDef = def; }
    },
    HTMLElement: MockHTMLElement,
    customElements: {
      define: function(name, ctor) { definedElements.set(name, ctor); },
      get: function(name) { return definedElements.get(name); }
    },
    vegaEmbed: null,
    GgsqlSizing: {
      isCompound: function() { return false; },
      fitToContainer: function(spec) { return spec; }
    },
    requestAnimationFrame: function(fn) { fn(); },
    document: {
      head: new MockHTMLElement("head"),
      createElement: function(tag) {
        var ctor = definedElements.get(String(tag).toLowerCase());
        if (ctor) return new ctor();
        return new MockHTMLElement(tag);
      }
    },
    console: console,
    Promise: Promise
  };
  context.window = context;

  var scriptPath = path.join(__dirname, "ggsql_viz.js");
  var source = fs.readFileSync(scriptPath, "utf8");
  vm.runInNewContext(source, context, { filename: scriptPath });

  assert.ok(capturedDef, "widget definition should be registered");
  assert.equal(capturedDef.name, "ggsql_viz");
  assert.ok(definedElements.get("ggsql-viz"), "custom element should be registered");

  return {
    createInstance: function(clientWidth) {
      var Ctor = definedElements.get("ggsql-viz");
      var el = new Ctor();
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
  await flushMicrotasks();
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

test("finalizes view when widget element is disconnected", async () => {
  var env = createEnvironment();
  var finalized = false;

  env.setEmbed(function(container, spec) {
    return Promise.resolve({
      view: {
        spec: spec,
        finalize: function() { finalized = true; }
      }
    });
  });

  var w = env.createInstance(450);
  w.instance.renderValue({ spec: { name: "first" } });
  await flushMicrotasks();

  w.el.remove();

  assert.equal(finalized, true);
});

test("rerenders compound specs after moderate width changes", async () => {
  var env = createEnvironment();
  var calls = [];

  env.setEmbed(function(container, spec) {
    calls.push(spec);
    return Promise.resolve({
      view: {
        spec: spec,
        finalize: function() {}
      }
    });
  });

  var w = env.createInstance(900);
  w.el.clientHeight = 400;

  w.instance.renderValue({
    spec: {
      hconcat: [{ mark: "point" }, { mark: "bar" }]
    }
  });
  await flushMicrotasks();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].hconcat[0].width, 410);

  w.el.clientWidth = 760;
  w.instance.resize(760, 400);
  await flushMicrotasks();

  assert.equal(calls.length, 2);
  assert.equal(calls[1].hconcat[0].width, 340);
  assert.equal(calls[1].hconcat[1].width, 340);
});

test("passes explicit dimensions and fit autosize for simple specs", async () => {
  var env = createEnvironment();
  var calls = [];

  env.setEmbed(function(container, spec) {
    calls.push(spec);
    return Promise.resolve({
      view: {
        spec: spec,
        finalize: function() {}
      }
    });
  });

  var w = env.createInstance(600);
  w.el.clientHeight = 320;

  w.instance.renderValue({
    spec: { mark: "point" }
  });
  await flushMicrotasks();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].width, 600);
  assert.equal(calls[0].height, 320);
  assert.equal(JSON.stringify(calls[0].autosize), JSON.stringify({
    type: "fit",
    contains: "padding"
  }));
});

test("updates simple specs in-place on resize without re-embedding", async () => {
  var env = createEnvironment();
  var embedCalls = 0;
  var widthCalls = [];
  var heightCalls = [];
  var resizeCalls = 0;
  var runAsyncCalls = 0;

  env.setEmbed(function(container, spec) {
    embedCalls += 1;
    return Promise.resolve({
      view: {
        spec: spec,
        finalize: function() {},
        width: function(value) {
          widthCalls.push(value);
          return this;
        },
        height: function(value) {
          heightCalls.push(value);
          return this;
        },
        resize: function() {
          resizeCalls += 1;
          return this;
        },
        runAsync: function() {
          runAsyncCalls += 1;
          return Promise.resolve(this);
        }
      }
    });
  });

  var w = env.createInstance(600);
  w.el.clientHeight = 320;

  w.instance.renderValue({ spec: { mark: "point" } });
  await flushMicrotasks();

  w.el.clientWidth = 540;
  w.el.clientHeight = 280;
  w.instance.resize(540, 280);
  await flushMicrotasks();

  assert.equal(embedCalls, 1);
  assert.deepEqual(widthCalls, [540]);
  assert.deepEqual(heightCalls, [280]);
  assert.equal(resizeCalls, 1);
  assert.equal(runAsyncCalls, 1);
});

test("grows compound widgets to fit taller embedded content", async () => {
  var env = createEnvironment();

  env.setEmbed(function(container, spec) {
    container.scrollHeight = 760;
    return Promise.resolve({
      view: {
        spec: spec,
        finalize: function() {}
      }
    });
  });

  var w = env.createInstance(900);
  w.el.clientHeight = 360;
  w.el.style.height = "360px";

  w.instance.renderValue({
    spec: {
      facet: { field: "carb" },
      columns: 3,
      spec: { mark: "point" }
    }
  });
  await flushMicrotasks();

  assert.equal(w.el.style.height, "760px");
});

test("rerenders compound specs after height changes", async () => {
  var env = createEnvironment();
  var calls = [];

  env.setEmbed(function(container, spec) {
    calls.push(spec);
    return Promise.resolve({
      view: {
        spec: spec,
        finalize: function() {}
      }
    });
  });

  var w = env.createInstance(900);
  w.el.clientHeight = 400;

  w.instance.renderValue({
    spec: {
      facet: { field: "carb" },
      columns: 3,
      spec: { mark: "point" }
    }
  });
  await flushMicrotasks();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].spec.height, 280);

  w.el.clientHeight = 520;
  w.instance.resize(900, 520);
  await flushMicrotasks();

  assert.equal(calls.length, 2);
  assert.equal(calls[1].spec.height, 400);
});

test("rerenders compound specs using the base host height after self-expansion", async () => {
  var env = createEnvironment();
  var calls = [];

  env.setEmbed(function(container, spec) {
    calls.push(spec);
    container.scrollHeight = calls.length === 1 ? 760 : 900;
    return Promise.resolve({
      view: {
        spec: spec,
        finalize: function() {}
      }
    });
  });

  var w = env.createInstance(900);
  w.el.clientHeight = 360;
  w.el.style.height = "360px";

  w.instance.renderValue({
    spec: {
      facet: { field: "carb" },
      columns: 3,
      spec: { mark: "point" }
    }
  });
  await flushMicrotasks();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].spec.height, 240);
  assert.equal(w.el.style.height, "760px");

  w.el.clientWidth = 760;
  w.el.clientHeight = 760;
  w.instance.resize(760, 760);
  await flushMicrotasks();

  assert.equal(calls.length, 2);
  assert.equal(calls[1].spec.height, 240);
});

test("rerenders compound specs using a new base height after a real host height change", async () => {
  var env = createEnvironment();
  var calls = [];

  env.setEmbed(function(container, spec) {
    calls.push(spec);
    container.scrollHeight = 760;
    return Promise.resolve({
      view: {
        spec: spec,
        finalize: function() {}
      }
    });
  });

  var w = env.createInstance(900);
  w.el.clientHeight = 360;
  w.el.style.height = "360px";

  w.instance.renderValue({
    spec: {
      facet: { field: "carb" },
      columns: 3,
      spec: { mark: "point" }
    }
  });
  await flushMicrotasks();

  assert.equal(calls.length, 1);
  assert.equal(calls[0].spec.height, 240);

  w.el.clientHeight = 520;
  w.instance.resize(900, 520);
  await flushMicrotasks();

  assert.equal(calls.length, 2);
  assert.equal(calls[1].spec.height, 400);
});

test("adds a scaled host class below the minimum width", async () => {
  var env = createEnvironment();

  env.setEmbed(function(container, spec) {
    container.scrollHeight = 200;
    return Promise.resolve({
      view: {
        spec: spec,
        finalize: function() {}
      }
    });
  });

  var w = env.createInstance(225);
  w.el.style.height = "400px";

  w.instance.renderValue({ spec: { mark: "point" } });
  await flushMicrotasks();

  assert.equal(w.el.classList.contains("ggsql-viz--scaled"), true);
});

test("removes the scaled host class after returning to normal width", async () => {
  var env = createEnvironment();

  env.setEmbed(function(container, spec) {
    container.scrollHeight = 200;
    return Promise.resolve({
      view: {
        spec: spec,
        finalize: function() {}
      }
    });
  });

  var w = env.createInstance(225);
  w.el.style.height = "400px";

  w.instance.renderValue({ spec: { mark: "point" } });
  await flushMicrotasks();
  assert.equal(w.el.classList.contains("ggsql-viz--scaled"), true);

  w.el.clientWidth = 450;
  w.instance.resize(450, 400);
  await flushMicrotasks();

  assert.equal(w.el.classList.contains("ggsql-viz--scaled"), false);
});
