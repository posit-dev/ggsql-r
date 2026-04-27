// Bundle entrypoint — registers VegaWidget as a custom element and
// wires it up as an htmlwidgets binding. This is the only file with
// side effects; everything else is pure exports.

import { VegaWidget, type WidgetValue } from "./vega/widget";

type HtmlWidgetInstance = {
  renderValue: (x: WidgetValue) => void;
  resize: (width: number, height: number) => void;
};

type HtmlWidgetDefinition = {
  name: string;
  type: string;
  factory: (el: VegaWidget) => HtmlWidgetInstance;
  renderError: (el: VegaWidget, err: { message: string }) => void;
  clearError: (el: VegaWidget) => void;
};

declare const HTMLWidgets: {
  widget: (definition: HtmlWidgetDefinition) => void;
};

HTMLWidgets.widget({
  name: "ggsql_vega",
  type: "output",

  factory(el) {
    return {
      renderValue(x) {
        el.renderValue(x);
      },

      resize(width, height) {
        el.resize(width, height);
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

if (!customElements.get("ggsql-vega")) {
  customElements.define("ggsql-vega", VegaWidget);
}
