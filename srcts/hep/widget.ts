// The <ggsql-hep> custom element: renders a .hep plot document with the
// hephaestus-svg-wasm browser client. The wasm module is loaded lazily and
// shared by every widget on the page.

// Must match HEPHAESTUS_VERSION in tools/update-hephaestus.sh.
const HEP_VERSION = "0.4.1";

const ROBOTO_FACES = ["regular", "bold", "italic", "bolditalic"];

export type WidgetValue = {
  // Base64-encoded .hep document
  hep: string;
};

// The hephaestus-svg.js module is an ES module that locates its wasm binary
// and fonts through import.meta.url, which does not exist inside this IIFE
// bundle. It is therefore imported dynamically at runtime from the URL its
// htmlDependency is served at, and the wasm and font URLs are handed to it
// explicitly. The dependency's stylesheet (ggsql_hep.css) doubles as the
// beacon for that URL: its <link> tag's href always points at the served
// dependency directory, however the host page mapped it.
function hepBaseUrl(): string {
  const link = document.querySelector<HTMLLinkElement>(
    'link[href*="hephaestus-svg"]'
  );
  if (link) {
    return link.href.replace(/[^/]*$/, "");
  }
  // Fallback: derive from this script's own URL, which htmlwidgets serves as
  // a sibling of the hephaestus-svg dependency directory.
  const script = document.currentScript as HTMLScriptElement | null;
  if (script?.src) {
    return (
      script.src.replace(/[^/]*$/, "") + `../hephaestus-svg-${HEP_VERSION}/`
    );
  }
  throw new Error(
    "ggsql: cannot locate the hephaestus-svg assets. " +
      "Self-contained documents are not supported by the ggsql widget."
  );
}

type HepModule = {
  default: (input: string) => Promise<unknown>;
  registerFontFromUrl: (
    url: string,
    opts?: { key?: string }
  ) => Promise<string[]>;
  setGenericFamily: (kind: string, families: string[]) => void;
  PlotView: {
    create: (
      container: HTMLElement,
      doc: Uint8Array,
      opts?: Record<string, unknown>
    ) => Promise<PlotViewInstance>;
  };
};

type PlotViewInstance = {
  redraw: () => void;
  free: () => void;
  warnings: string[];
};

let modulePromise: Promise<HepModule> | null = null;

function loadHep(): Promise<HepModule> {
  if (!modulePromise) {
    modulePromise = (async () => {
      const base = hepBaseUrl();
      const mod = (await import(
        /* @vite-ignore */ base + "hephaestus-svg.js"
      )) as HepModule;
      await mod.default(base + "hephaestus_svg_wasm_bg.wasm");
      // Fonts must be registered with the shaper before the first plot is
      // drawn — a browser enumerates no system fonts, so without this text
      // vanishes and the layout collapses.
      for (const face of ROBOTO_FACES) {
        await mod.registerFontFromUrl(`${base}fonts/roboto-${face}.ttf`, {
          key: face,
        });
      }
      mod.setGenericFamily("sans-serif", ["Roboto"]);
      return mod;
    })();
  }
  return modulePromise;
}

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export class HepWidget extends HTMLElement {
  private view: PlotViewInstance | null = null;
  private pending: Promise<void> | null = null;

  renderValue(x: WidgetValue): void {
    const bytes = decodeBase64(x.hep);
    this.pending = (async () => {
      const mod = await loadHep();
      // A stale render resolved after a newer one must not win — renderValue
      // is async because the module load is.
      if (!this.isConnected && this.view) return;
      this.view?.free();
      // defaultFont is false: fonts were registered explicitly in loadHep()
      // with URLs resolved from the served dependency, not import.meta.
      this.view = await mod.PlotView.create(this, bytes, {
        defaultFont: false,
      });
      for (const warning of this.view.warnings) {
        console.warn("ggsql:", warning);
      }
    })().catch((err) => {
      this.textContent = `ggsql widget failed: ${err?.message ?? err}`;
      throw err;
    });
  }

  resize(): void {
    // PlotView observes the container itself; a direct resize just nudges it.
    this.view?.redraw();
  }

  finalize(): void {
    this.view?.free();
    this.view = null;
  }

  disconnectedCallback(): void {
    this.finalize();
  }
}
