"use strict";
(() => {
  // srcts/hep/widget.ts
  var HEP_VERSION = "0.4.1";
  var ROBOTO_FACES = ["regular", "bold", "italic", "bolditalic"];
  function hepBaseUrl() {
    const link = document.querySelector(
      'link[href*="hephaestus-svg"]'
    );
    if (link) {
      return link.href.replace(/[^/]*$/, "");
    }
    const script = document.currentScript;
    if (script?.src) {
      return script.src.replace(/[^/]*$/, "") + `../hephaestus-svg-${HEP_VERSION}/`;
    }
    throw new Error(
      "ggsql: cannot locate the hephaestus-svg assets. Self-contained documents are not supported by the ggsql widget."
    );
  }
  var modulePromise = null;
  function loadHep() {
    if (!modulePromise) {
      modulePromise = (async () => {
        const base = hepBaseUrl();
        const mod = await import(
          /* @vite-ignore */
          base + "hephaestus-svg.js"
        );
        await mod.default(base + "hephaestus_svg_wasm_bg.wasm");
        for (const face of ROBOTO_FACES) {
          await mod.registerFontFromUrl(`${base}fonts/roboto-${face}.ttf`, {
            key: face
          });
        }
        mod.setGenericFamily("sans-serif", ["Roboto"]);
        return mod;
      })();
    }
    return modulePromise;
  }
  function decodeBase64(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  var HepWidget = class extends HTMLElement {
    constructor() {
      super(...arguments);
      this.view = null;
      this.pending = null;
    }
    renderValue(x) {
      const bytes = decodeBase64(x.hep);
      this.pending = (async () => {
        const mod = await loadHep();
        if (!this.isConnected && this.view) return;
        this.view?.free();
        this.view = await mod.PlotView.create(this, bytes, {
          defaultFont: false
        });
        for (const warning of this.view.warnings) {
          console.warn("ggsql:", warning);
        }
      })().catch((err) => {
        this.textContent = `ggsql widget failed: ${err?.message ?? err}`;
        throw err;
      });
    }
    resize() {
      this.view?.redraw();
    }
    finalize() {
      this.view?.free();
      this.view = null;
    }
    disconnectedCallback() {
      this.finalize();
    }
  };

  // srcts/index.ts
  HTMLWidgets.widget({
    name: "ggsql_hep",
    type: "output",
    factory(el) {
      return {
        renderValue(x) {
          el.renderValue(x);
        },
        resize(width, height) {
          el.resize();
        }
      };
    },
    renderError(el, err) {
      el.finalize();
      el.textContent = err.message;
    },
    clearError(el) {
      el.textContent = "";
    }
  });
  if (!customElements.get("ggsql-hep")) {
    customElements.define("ggsql-hep", HepWidget);
  }
})();
