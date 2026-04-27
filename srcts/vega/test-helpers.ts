// Test helpers shared by srcts/vega/widget.test.ts and other widget tests.
//
// Tests run in Node via `tsx --test`, not in a browser. We use Node's `vm`
// module to execute an in-memory IIFE bundle compiled from srcts/index.ts in a
// sandboxed context with mock DOM/HTMLWidgets globals so we can exercise
// renderValue/resize logic without a real browser.

import * as assert from "node:assert/strict";
import * as path from "node:path";
import * as vm from "node:vm";
import { buildSync } from "esbuild";

type Resolver<T> = (value: T | PromiseLike<T>) => void;
type Rejecter = (reason?: unknown) => void;

type WidgetDefinition = {
  name: string;
  factory: (el: MockHTMLElement, width: number, height: number) => WidgetInstance;
};

type WidgetInstance = {
  renderValue: (x: { spec: Record<string, unknown> }) => void;
  resize: (width: number, height: number) => void;
};

type WidgetView = {
  finalize?: () => void;
};

class MockHTMLElement {
  tagName: string;
  style: Record<string, string>;
  children: MockHTMLElement[];
  parentNode: MockHTMLElement | null;
  clientWidth: number;
  clientHeight: number;
  scrollHeight: number;
  isConnected: boolean;
  textContent: string;
  className: string;
  disconnectedCallback?: () => void;
  classList: {
    add: (...names: string[]) => void;
    remove: (...names: string[]) => void;
    contains: (name: string) => boolean;
  };

  _innerHTML: string;
  _classes: Set<string>;
  _view: WidgetView | null;
  _scaleWrapper: MockHTMLElement | null;
  _vegaContainer: MockHTMLElement | null;

  constructor(tagName?: string) {
    this.tagName = String(tagName ?? "div").toUpperCase();
    this.style = {};
    this.children = [];
    this.parentNode = null;
    this.clientWidth = 450;
    this.clientHeight = 400;
    this.scrollHeight = 200;
    this.isConnected = true;
    this.textContent = "";
    this.className = "";
    this._innerHTML = "";
    this._classes = new Set();
    this._view = null;
    this._scaleWrapper = null;
    this._vegaContainer = null;
    this.classList = {
      add: (...names: string[]) => {
        for (const name of names) this._classes.add(name);
      },
      remove: (...names: string[]) => {
        for (const name of names) this._classes.delete(name);
      },
      contains: (name: string) => this._classes.has(name)
    };
  }

  appendChild(child: MockHTMLElement): MockHTMLElement {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  insertBefore(child: MockHTMLElement, ref: MockHTMLElement | null): MockHTMLElement {
    let idx = ref ? this.children.indexOf(ref) : this.children.length;
    if (idx === -1) idx = this.children.length;
    child.parentNode = this;
    this.children.splice(idx, 0, child);
    return child;
  }

  removeChild(child: MockHTMLElement): MockHTMLElement {
    const idx = this.children.indexOf(child);
    if (idx !== -1) this.children.splice(idx, 1);
    child.parentNode = null;
    return child;
  }

  remove(): void {
    this.isConnected = false;
    if (this.parentNode) this.parentNode.removeChild(this);
    if (typeof this.disconnectedCallback === "function") this.disconnectedCallback();
  }

  get innerHTML(): string {
    return this._innerHTML;
  }

  set innerHTML(value: string) {
    this._innerHTML = value;
    this.children = [];
    this.textContent = "";
  }

  get firstChild(): MockHTMLElement | null {
    return this.children[0] ?? null;
  }
}

function widgetEntryPointPath(): string {
  return path.join(process.cwd(), "srcts", "index.ts");
}

function runBundleInContext(context: vm.Context): void {
  const scriptPath = widgetEntryPointPath();
  const result = buildSync({
    entryPoints: [scriptPath],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    write: false
  });
  const source = result.outputFiles[0]?.text;

  if (!source) {
    throw new Error("expected esbuild to produce an in-memory widget bundle");
  }

  vm.runInNewContext(source, context, { filename: scriptPath });
}

export function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: Resolver<T>;
  reject: Rejecter;
} {
  let resolve!: Resolver<T>;
  let reject!: Rejecter;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

export function createWidgetTestEnvironment(): {
  createInstance: (clientWidth?: number, clientHeight?: number) => {
    el: MockHTMLElement;
    instance: WidgetInstance;
  };
  setEmbed: (
    impl: (container: MockHTMLElement, spec: Record<string, unknown>) => Promise<{ view: WidgetView }>
  ) => void;
} {
  let capturedDef: WidgetDefinition | undefined;
  const definedElements = new Map<string, new () => MockHTMLElement>();

  const context = {
    HTMLWidgets: {
      widget: (def: WidgetDefinition) => {
        capturedDef = def;
      }
    },
    HTMLElement: MockHTMLElement,
    customElements: {
      define: (name: string, ctor: new () => MockHTMLElement) => {
        definedElements.set(name, ctor);
      },
      get: (name: string) => definedElements.get(name)
    },
    vegaEmbed: null as null | ((
      container: MockHTMLElement,
      spec: Record<string, unknown>
    ) => Promise<{ view: WidgetView }>),
    requestAnimationFrame: (fn: () => void) => {
      fn();
    },
    document: {
      head: new MockHTMLElement("head"),
      createElement: (tag: string) => {
        const ctor = definedElements.get(String(tag).toLowerCase());
        if (ctor) return new ctor();
        return new MockHTMLElement(tag);
      }
    },
    console,
    Promise
  } as unknown as vm.Context & {
    vegaEmbed: ((
      container: MockHTMLElement,
      spec: Record<string, unknown>
    ) => Promise<{ view: WidgetView }>) | null;
  };

  (context as unknown as vm.Context & { window: unknown }).window = context;
  runBundleInContext(context);

  if (!capturedDef) {
    throw new Error("widget definition should be registered");
  }
  const widgetDef: WidgetDefinition = capturedDef;
  assert.equal(widgetDef.name, "ggsql_vega");
  assert.ok(definedElements.get("ggsql-vega"), "custom element should be registered");

  return {
    createInstance: (clientWidth = 450, clientHeight = 400) => {
      const Ctor = definedElements.get("ggsql-vega");
      assert.ok(Ctor, "expected ggsql-vega custom element");
      const el = new Ctor();
      el.clientWidth = clientWidth;
      el.clientHeight = clientHeight;
      const instance = widgetDef.factory(el, el.clientWidth, el.clientHeight);
      return { el, instance };
    },
    setEmbed: (impl) => {
      context.vegaEmbed = impl;
    }
  };
}
