const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createEnvironment() {
  class MockHTMLElement {
    constructor(tagName = "div") {
      this.tagName = String(tagName).toUpperCase();
      this.children = [];
      this.parentNode = null;
      this.style = {};
      this.attributes = {};
      this.textContent = "";
      this.isConnected = true;
      this.clientWidth = 450;
      this.scrollHeight = 200;
      this._innerHTML = "";
    }

    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    }

    removeChild(child) {
      this.children = this.children.filter((node) => node !== child);
      child.parentNode = null;
      return child;
    }

    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    }

    querySelectorAll(selector) {
      const matches = [];
      const walk = (node) => {
        for (const child of node.children) {
          if (matchesSelector(child, selector)) {
            matches.push(child);
          }
          walk(child);
        }
      };
      walk(this);
      return matches;
    }

    remove() {
      if (this.parentNode) {
        this.parentNode.removeChild(this);
      }
    }

    setAttribute(name, value) {
      this.attributes[name] = String(value);
    }

    getAttribute(name) {
      return Object.hasOwn(this.attributes, name) ? this.attributes[name] : null;
    }

    set innerHTML(value) {
      this._innerHTML = value;
      this.children = [];
      this.textContent = "";
    }

    get innerHTML() {
      return this._innerHTML;
    }
  }

  function matchesSelector(node, selector) {
    if (selector === 'script[type="application/json"]') {
      return (
        node.tagName === "SCRIPT" &&
        node.getAttribute("type") === "application/json"
      );
    }
    return node.tagName.toLowerCase() === selector.toLowerCase();
  }

  const definedElements = new Map();
  const resizeObservers = [];

  class MockResizeObserver {
    constructor(callback) {
      this.callback = callback;
      this.target = null;
      this.disconnected = false;
      resizeObservers.push(this);
    }

    observe(target) {
      this.target = target;
    }

    disconnect() {
      this.disconnected = true;
      this.target = null;
    }
  }

  const document = {
    head: new MockHTMLElement("head"),
    createElement(tagName) {
      const element = new MockHTMLElement(tagName);
      if (String(tagName).toLowerCase() === "script") {
        element.setAttribute("type", "");
      }
      return element;
    }
  };

  const window = {
    vegaEmbed: null
  };

  const context = {
    window,
    document,
    HTMLElement: MockHTMLElement,
    customElements: {
      define(name, ctor) {
        definedElements.set(name, ctor);
      }
    },
    ResizeObserver: MockResizeObserver,
    requestAnimationFrame(callback) {
      callback();
    },
    console,
    setTimeout,
    clearTimeout,
    Promise
  };
  context.globalThis = context;
  window.window = window;
  window.document = document;

  const scriptPath = path.join(
    __dirname,
    "..",
    "..",
    "inst",
    "shiny",
    "ggsql-viz.js"
  );
  const source = fs.readFileSync(scriptPath, "utf8");
  vm.runInNewContext(source, context, { filename: scriptPath });

  const GgsqlViz = definedElements.get("ggsql-viz");
  assert.ok(GgsqlViz, "custom element should be registered");

  return {
    createViz() {
      const el = new GgsqlViz();
      el.isConnected = true;
      return el;
    },
    setEmbed(impl) {
      window.vegaEmbed = impl;
    },
    getLatestResizeObserver() {
      return resizeObservers[resizeObservers.length - 1] || null;
    }
  };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

test("restores authored height after rerendering while scaled down", async () => {
  const env = createEnvironment();
  env.setEmbed((container, spec) => {
    container.scrollHeight = 200;
    return Promise.resolve({
      view: {
        spec,
        finalize() {}
      }
    });
  });

  const el = env.createViz();
  el.style.height = "400px";
  el.clientWidth = 225;

  el.spec = { name: "first" };
  await flushMicrotasks();
  assert.equal(el.style.height, "100px");

  el.spec = { name: "second" };
  await flushMicrotasks();
  assert.equal(el.style.height, "100px");

  el.clientWidth = 450;
  env.getLatestResizeObserver().callback();

  assert.equal(el.style.height, "400px");
});

test("ignores superseded async embed results", async () => {
  const env = createEnvironment();
  const first = createDeferred();
  const second = createDeferred();
  const calls = [];

  env.setEmbed((container, spec) => {
    calls.push({ container, spec });
    if (calls.length === 1) {
      return first.promise;
    }
    return second.promise;
  });

  const el = env.createViz();

  el.spec = { name: "first" };
  el.spec = { name: "second" };

  const staleView = {
    id: "stale",
    finalized: false,
    finalize() {
      this.finalized = true;
    }
  };
  const latestView = {
    id: "latest",
    finalized: false,
    finalize() {
      this.finalized = true;
    }
  };

  second.resolve({ view: latestView });
  await flushMicrotasks();
  assert.equal(el._view, latestView);

  first.resolve({ view: staleView });
  await flushMicrotasks();

  assert.equal(el._view, latestView);
  assert.equal(staleView.finalized, true);
  assert.equal(latestView.finalized, false);
});
