// htmlwidgets binding for ggsql Vega-Lite output.
//
// VegaWidget is a custom element (<ggsql-vega>) that implements the
// htmlwidgets renderValue/resize contract. On the R side, R/widget.R creates
// the widget and widget_html.ggsql_vega() emits a <ggsql-vega> custom element
// as the container. htmlwidgets calls the factory(), which delegates to the
// element's renderValue/resize methods.
//
// The types below (VegaView, etc.) are hand-written because we vendor
// vega/vega-lite/vega-embed as pre-built .min.js files and don't install
// their npm type packages.

import {
  allocateCompoundChartSize,
  isCompoundSpec,
  type AnyRecord
} from "./compound_sizing";

// The dimensions of the host container given to us by htmlwidgets.
type HostBox = {
  hostWidth: number;
  hostHeight: number;
};

// Computed layout for a render pass. renderWidth/renderHeight may exceed the
// host when a min-width threshold is configured; `scale` is the CSS transform
// applied to shrink the rendered output back into the host when that happens.
type Layout = HostBox & {
  renderWidth: number;
  renderHeight: number;
  scale: number;
};

type VegaView = {
  finalize: () => void;
};

type ResizableVegaView = VegaView & {
  width: (value: number) => ResizableVegaView;
  height: (value: number) => ResizableVegaView;
  resize: () => ResizableVegaView;
  runAsync: () => Promise<unknown>;
};

type EmbedResult = {
  view: VegaView;
};

// Cancellation token for vegaEmbed — see embedSpec() for usage.
type EmbedToken = Record<string, never>;

export type WidgetValue = {
  spec: AnyRecord;
  min_width?: number | null;
};

type WidgetLayoutSpec = AnyRecord & {
  width?: number;
  height?: number;
  autosize?: {
    type: string;
    contains: string;
  };
};

declare global {
  interface Window {
    vegaEmbed: (
      container: HTMLElement,
      spec: AnyRecord,
      options: { actions: boolean }
    ) => Promise<EmbedResult>;
  }
}

// Determine the host container size. htmlwidgets passes explicit width/height
// to resize(), but renderValue() receives only the data payload — no sizing
// info at all. So on initial render we fall back to el.clientWidth and
// el.style.height (the inline px value that htmlwidgets' initSizing writes).
function readHostBox(el: HTMLElement, width?: number, height?: number): HostBox {
  const hostWidth =
    typeof width === "number" && width > 0 ? width : el.clientWidth || 0;
  const styledHeight =
    typeof el.style.height === "string" && /px$/.test(el.style.height)
      ? parseFloat(el.style.height)
      : 0;
  const hostHeight =
    typeof height === "number" && height > 0
      ? height
      : el.clientHeight || styledHeight || 0;

  return { hostWidth, hostHeight };
}

function buildSimpleLayout(
  hostWidth: number,
  hostHeight: number,
  minWidth: number | null
): Layout {
  return {
    hostWidth,
    hostHeight,
    renderWidth: minWidth === null ? hostWidth : Math.max(hostWidth, minWidth),
    renderHeight: hostHeight,
    scale:
      minWidth !== null && hostWidth > 0 && hostWidth < minWidth
        ? hostWidth / minWidth
        : 1
  };
}

class VegaWidget extends HTMLElement {
  _view: VegaView | null = null;
  _value: WidgetValue | null = null;
  _isCompound = false;
  _layout: Layout | null = null;
  _scaleWrapper: HTMLDivElement | null = null;
  _vegaContainer: HTMLDivElement | null = null;
  _embedToken: EmbedToken | null = null;

  disconnectedCallback(): void {
    this.finalize();
  }

  finalize(): void {
    if (this._view) this._view.finalize();
    this._view = null;
    this._layout = null;
    this._embedToken = null;
    this._scaleWrapper = null;
    this._vegaContainer = null;
    this.classList.remove("ggsql-scaled");
  }

  createStructure(): HTMLDivElement {
    this.innerHTML = "";

    const scaleWrapper = document.createElement("div");
    scaleWrapper.className = "ggsql-vega-scale-wrapper";

    const vegaContainer = document.createElement("div");
    vegaContainer.className = "ggsql-vega-container";

    scaleWrapper.appendChild(vegaContainer);
    this.appendChild(scaleWrapper);

    this._scaleWrapper = scaleWrapper;
    this._vegaContainer = vegaContainer;

    return vegaContainer;
  }

  applyLayout(layout: Layout): void {
    if (!this._scaleWrapper || !this._vegaContainer) return;

    this._vegaContainer.style.width = `${layout.renderWidth}px`;
    this._vegaContainer.style.height = `${layout.renderHeight}px`;
    this._vegaContainer.style.transform =
      layout.scale < 1 ? `scale(${layout.scale})` : "";
    if (layout.scale < 1) this.classList.add("ggsql-scaled");
    else this.classList.remove("ggsql-scaled");
  }

  buildSimpleSpec(spec: AnyRecord, layout: Layout): WidgetLayoutSpec {
    return {
      ...spec,
      width: layout.renderWidth,
      height: layout.renderHeight,
      autosize: { type: "fit", contains: "padding" }
    };
  }

  renderSimple(layout: Layout): void {
    const spec = this.buildSimpleSpec(this._value!.spec, layout);
    this.embedSpec(spec, layout);
  }

  // For simple (non-compound) specs, we can resize the existing Vega view
  // in-place via its signal API, which is much cheaper than re-embedding.
  resizeSimpleView(layout: Layout): void {
    if (!this._view) {
      this.renderSimple(layout);
      return;
    }

    // Capture `this` and `view` for the promise callback — `this` can change
    // if a new renderValue() fires before the async resize completes.
    const self = this;
    const view = this._view as ResizableVegaView;

    this._layout = layout;
    this.applyLayout(layout);
    view
      .width(layout.renderWidth)
      .height(layout.renderHeight)
      .resize()
      .runAsync()
      .catch((err: unknown) => {
        if (self._view !== view) return;
        self.classList.remove("ggsql-scaled");
        self.textContent = `ggsql render error: ${String(err)}`;
      });
  }

  // Compound specs (facet/concat) can't be resized via the Vega view API —
  // their sub-chart dimensions are baked into the spec at embed time, so we
  // must re-allocate sizes and re-embed on every meaningful resize.
  renderCompound(layout: Layout): void {
    const spec = allocateCompoundChartSize(this._value!.spec, layout);
    this.embedSpec(spec, layout);
  }

  // Skip re-embed for sub-pixel container jitter (common during CSS transitions).
  hasMaterialCompoundResize(nextLayout: Layout): boolean {
    if (!this._layout) return true;
    return (
      Math.abs(this._layout.hostWidth - nextLayout.hostWidth) > 1 ||
      Math.abs(this._layout.hostHeight - nextLayout.hostHeight) > 1
    );
  }

  // Run vegaEmbed and wire up the result. Because vegaEmbed is async, a new
  // renderValue() or resize() could fire before the promise resolves. We use
  // a unique `token` object (compared by reference) so the stale callback can
  // detect it's been superseded and clean up without clobbering the new view.
  embedSpec(spec: AnyRecord, layout: Layout): void {
    const self = this;
    if (this._view) {
      this._view.finalize();
      this._view = null;
    }
    const container = this.createStructure();
    const token = {};

    this._embedToken = token;
    this._layout = layout;
    this.applyLayout(layout);

    window
      .vegaEmbed(container, spec, { actions: true })
      .then((result: EmbedResult) => {
        if (self._embedToken !== token || self._vegaContainer !== container) {
          result.view.finalize();
          return;
        }
        self._view = result.view;
        self.applyLayout(self._layout!);
      })
      .catch((err: unknown) => {
        if (self._embedToken !== token || self._vegaContainer !== container) return;
        self.classList.remove("ggsql-scaled");
        self.textContent = `ggsql render error: ${String(err)}`;
      });
  }

  renderValue(x: WidgetValue): void {
    const host = readHostBox(this);
    const minWidth = x.min_width ?? null;

    this._value = x;
    this._isCompound = isCompoundSpec(x.spec);

    if (this._isCompound) {
      this.renderCompound(
        buildSimpleLayout(host.hostWidth, host.hostHeight, minWidth)
      );
      return;
    }

    this.renderSimple(buildSimpleLayout(host.hostWidth, host.hostHeight, minWidth));
  }

  resize(width: number, height: number): void {
    if (!this._value) return;

    const host = readHostBox(this, width, height);
    const layout = buildSimpleLayout(
      host.hostWidth,
      host.hostHeight,
      this._value.min_width ?? null
    );

    if (this._isCompound) {
      if (this.hasMaterialCompoundResize(layout)) this.renderCompound(layout);
      else {
        this._layout = layout;
        this.applyLayout(layout);
      }
      return;
    }

    if (
      !this._layout ||
      this._layout.renderWidth !== layout.renderWidth ||
      this._layout.renderHeight !== layout.renderHeight
    ) {
      this.resizeSimpleView(layout);
      return;
    }

    this._layout = layout;
    this.applyLayout(layout);
  }
}

export { VegaWidget };
