"use strict";
(() => {
  // srcts/vega/compound_sizing.ts
  var OUTER_PAD_X = 80;
  var OUTER_PAD_Y = 120;
  var LEGEND_WIDTH = 120;
  var LEGEND_CHANNELS = /* @__PURE__ */ new Set([
    "color",
    "fill",
    "stroke",
    "shape",
    "size",
    "opacity"
  ]);
  function isCompoundSpec(spec) {
    return "facet" in spec || "hconcat" in spec || "vconcat" in spec || "concat" in spec;
  }
  function allocateCompoundChartSize(spec, layout) {
    const paddingX = OUTER_PAD_X + (hasLegend(spec) ? LEGEND_WIDTH : 0);
    const usableWidth = Math.max(layout.renderWidth - paddingX, 100);
    const usableHeight = Math.max(layout.renderHeight - OUTER_PAD_Y, 100);
    if ("facet" in spec) {
      const facetSpec = spec;
      const isGridFacet = facetSpec.facet.row != null || facetSpec.facet.column != null;
      let columnCount;
      let rowCount;
      if (isGridFacet) {
        columnCount = inferDistinctCount(facetSpec, facetSpec.facet.column?.field) || 1;
        rowCount = inferDistinctCount(facetSpec, facetSpec.facet.row?.field) || 1;
      } else {
        columnCount = Math.max(facetSpec.columns || 1, 1);
        rowCount = inferFacetRows(facetSpec, columnCount);
      }
      const cellWidth = Math.max(Math.floor(usableWidth / Math.max(columnCount, 1)), 1);
      const cellHeight = Math.max(Math.floor(usableHeight / Math.max(rowCount, 1)), 1);
      return {
        ...facetSpec,
        spec: { ...facetSpec.spec ?? {}, width: cellWidth, height: cellHeight }
      };
    }
    if ("hconcat" in spec) {
      const hconcatSpec = spec;
      const cellWidth = Math.max(
        Math.floor(usableWidth / Math.max(hconcatSpec.hconcat.length, 1)),
        1
      );
      return {
        ...hconcatSpec,
        hconcat: hconcatSpec.hconcat.map((subspec) => ({
          ...subspec,
          width: cellWidth,
          height: usableHeight
        }))
      };
    }
    if ("vconcat" in spec) {
      const vconcatSpec = spec;
      const cellHeight = Math.max(
        Math.floor(usableHeight / Math.max(vconcatSpec.vconcat.length, 1)),
        1
      );
      return {
        ...vconcatSpec,
        vconcat: vconcatSpec.vconcat.map((subspec) => ({
          ...subspec,
          width: usableWidth,
          height: cellHeight
        }))
      };
    }
    if ("concat" in spec) {
      const concatSpec = spec;
      const columnCount = Math.max(concatSpec.columns || concatSpec.concat.length || 1, 1);
      const rowCount = Math.ceil(concatSpec.concat.length / columnCount);
      const cellWidth = Math.max(Math.floor(usableWidth / Math.max(columnCount, 1)), 1);
      const cellHeight = Math.max(Math.floor(usableHeight / Math.max(rowCount, 1)), 1);
      return {
        ...concatSpec,
        concat: concatSpec.concat.map((subspec) => ({
          ...subspec,
          width: cellWidth,
          height: cellHeight
        }))
      };
    }
    return { ...spec };
  }
  function hasLegend(spec) {
    const subSpecs = [];
    if ("spec" in spec) subSpecs.push(spec.spec);
    for (const key of ["hconcat", "vconcat", "concat"]) {
      if (key in spec) subSpecs.push(...spec[key]);
    }
    for (const sub of subSpecs) {
      const layers = Array.isArray(sub.layer) ? sub.layer : [sub];
      for (const layer of layers) {
        const enc = layer.encoding;
        if (!enc) continue;
        for (const ch of LEGEND_CHANNELS) {
          if (ch in enc && typeof enc[ch] === "object" && enc[ch] !== null && "field" in enc[ch]) {
            return true;
          }
        }
      }
    }
    return false;
  }
  function inferFacetRows(spec, columns) {
    const count = inferDistinctCount(spec, spec.facet?.field);
    if (count <= 0) return 1;
    return Math.ceil(count / Math.max(columns, 1));
  }
  function inferDistinctCount(spec, field) {
    if (typeof field !== "string") return 0;
    const values = spec.data && Array.isArray(spec.data.values) ? spec.data.values : null;
    if (!values || values.length === 0) return 0;
    const seen = /* @__PURE__ */ Object.create(null);
    for (let i = 0; i < values.length; i += 1) {
      if (!Object.prototype.hasOwnProperty.call(values[i], field)) continue;
      seen[String(values[i][field])] = true;
    }
    return Object.keys(seen).length;
  }

  // srcts/vega/widget.ts
  var MIN_WIDTH = 450;
  function readHostBox(el, width, height) {
    const hostWidth = typeof width === "number" && width > 0 ? width : el.clientWidth || 0;
    const styledHeight = typeof el.style.height === "string" && /px$/.test(el.style.height) ? parseFloat(el.style.height) : 0;
    const hostHeight = typeof height === "number" && height > 0 ? height : el.clientHeight || styledHeight || 0;
    return { hostWidth, hostHeight };
  }
  function buildSimpleLayout(hostWidth, hostHeight) {
    return {
      hostWidth,
      hostHeight,
      renderWidth: Math.max(hostWidth, MIN_WIDTH),
      renderHeight: hostHeight,
      scale: hostWidth > 0 && hostWidth < MIN_WIDTH ? hostWidth / MIN_WIDTH : 1
    };
  }
  var VegaWidget = class extends HTMLElement {
    constructor() {
      super(...arguments);
      this._view = null;
      this._value = null;
      this._isCompound = false;
      this._layout = null;
      this._scaleWrapper = null;
      this._vegaContainer = null;
      this._embedToken = null;
    }
    disconnectedCallback() {
      this.finalize();
    }
    finalize() {
      if (this._view) this._view.finalize();
      this._view = null;
      this._layout = null;
      this._embedToken = null;
      this._scaleWrapper = null;
      this._vegaContainer = null;
    }
    createStructure() {
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
    applyLayout(layout) {
      if (!this._scaleWrapper || !this._vegaContainer) return;
      this._vegaContainer.style.width = `${layout.renderWidth}px`;
      this._vegaContainer.style.height = `${layout.renderHeight}px`;
      this._vegaContainer.style.transform = layout.scale < 1 ? `scale(${layout.scale})` : "";
    }
    buildSimpleSpec(spec, layout) {
      return {
        ...spec,
        width: layout.renderWidth,
        height: layout.renderHeight,
        autosize: { type: "fit", contains: "padding" }
      };
    }
    renderSimple(layout) {
      const spec = this.buildSimpleSpec(this._value.spec, layout);
      this.embedSpec(spec, layout);
    }
    // For simple (non-compound) specs, we can resize the existing Vega view
    // in-place via its signal API, which is much cheaper than re-embedding.
    resizeSimpleView(layout) {
      if (!this._view) {
        this.renderSimple(layout);
        return;
      }
      const self = this;
      const view = this._view;
      this._layout = layout;
      this.applyLayout(layout);
      view.width(layout.renderWidth).height(layout.renderHeight).resize().runAsync().catch((err) => {
        if (self._view !== view) return;
        self.textContent = `ggsql render error: ${String(err)}`;
      });
    }
    // Compound specs (facet/concat) can't be resized via the Vega view API —
    // their sub-chart dimensions are baked into the spec at embed time, so we
    // must re-allocate sizes and re-embed on every meaningful resize.
    renderCompound(layout) {
      const spec = allocateCompoundChartSize(this._value.spec, layout);
      this.embedSpec(spec, layout);
    }
    // Skip re-embed for sub-pixel container jitter (common during CSS transitions).
    hasMaterialCompoundResize(nextLayout) {
      if (!this._layout) return true;
      return Math.abs(this._layout.hostWidth - nextLayout.hostWidth) > 1 || Math.abs(this._layout.hostHeight - nextLayout.hostHeight) > 1;
    }
    // Run vegaEmbed and wire up the result. Because vegaEmbed is async, a new
    // renderValue() or resize() could fire before the promise resolves. We use
    // a unique `token` object (compared by reference) so the stale callback can
    // detect it's been superseded and clean up without clobbering the new view.
    embedSpec(spec, layout) {
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
      window.vegaEmbed(container, spec, { actions: true }).then((result) => {
        if (self._embedToken !== token || self._vegaContainer !== container) {
          result.view.finalize();
          return;
        }
        self._view = result.view;
        self.applyLayout(self._layout);
      }).catch((err) => {
        if (self._embedToken !== token || self._vegaContainer !== container) return;
        self.textContent = `ggsql render error: ${String(err)}`;
      });
    }
    renderValue(x) {
      const host = readHostBox(this);
      this._value = x;
      this._isCompound = isCompoundSpec(x.spec);
      if (this._isCompound) {
        this.renderCompound(buildSimpleLayout(host.hostWidth, host.hostHeight));
        return;
      }
      this.renderSimple(buildSimpleLayout(host.hostWidth, host.hostHeight));
    }
    resize(width, height) {
      if (!this._value) return;
      const host = readHostBox(this, width, height);
      const layout = buildSimpleLayout(host.hostWidth, host.hostHeight);
      if (this._isCompound) {
        if (this.hasMaterialCompoundResize(layout)) this.renderCompound(layout);
        else {
          this._layout = layout;
          this.applyLayout(layout);
        }
        return;
      }
      if (!this._layout || this._layout.renderWidth !== layout.renderWidth || this._layout.renderHeight !== layout.renderHeight) {
        this.resizeSimpleView(layout);
        return;
      }
      this._layout = layout;
      this.applyLayout(layout);
    }
  };

  // srcts/index.ts
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
})();
