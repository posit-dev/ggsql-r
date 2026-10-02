// Bundle entrypoint — registers HepWidget as a custom element and
// wires it up as an htmlwidgets binding. This is the only file with
// side effects; everything else is pure exports.

import { HepWidget, type WidgetValue } from "./hep/widget";

type HtmlWidgetInstance = {
  renderValue: (x: WidgetValue) => void;
  resize: (width: number, height: number) => void;
};

type HtmlWidgetDefinition = {
  name: string;
  type: string;
  factory: (el: HepWidget) => HtmlWidgetInstance;
  renderError: (el: HepWidget, err: { message: string }) => void;
  clearError: (el: HepWidget) => void;
};

declare const HTMLWidgets: {
  widget: (definition: HtmlWidgetDefinition) => void;
};

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
