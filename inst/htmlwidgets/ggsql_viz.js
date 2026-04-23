HTMLWidgets.widget({
  name: "ggsql_viz",
  type: "output",

  factory: function(el, width, height) {
    el.initializeLayout(width, height);
    return {
      renderValue: function(x) {
        el.renderValue(x);
      },

      resize: function(width, height) {
        el.resize(width, height);
      }
    };
  },

  renderError: function(el, err) {
    el.finalize();
    el.textContent = err.message;
  },

  clearError: function(el) {
    el.textContent = "";
  }
});

(function() {
  var MIN_WIDTH = 450;

  function normalizeLayoutWidth(value, fallback) {
    return typeof value === "number" && value > 0 ? value : fallback;
  }

  function normalizeLayoutHeight(value, fallback) {
    if (typeof value === "number" && value > 0) return value;
    if (typeof value === "string" && /px$/.test(value)) return parseFloat(value);
    return fallback;
  }

  function viewportFromHost(width, height) {
    var hostWidth = typeof width === "number" && width > 0 ? width : 0;
    var hostHeight = typeof height === "number" && height > 0 ? height : 0;

    return {
      hostWidth: hostWidth,
      hostHeight: hostHeight,
      logicalWidth: Math.max(hostWidth, MIN_WIDTH),
      logicalHeight: hostHeight,
      scale: hostWidth > 0 && hostWidth < MIN_WIDTH ? hostWidth / MIN_WIDTH : 1
    };
  }

  class GgsqlViz extends HTMLElement {
    constructor() {
      super();
      this._view = null;
      this._scaleWrapper = null;
      this._vegaContainer = null;
      this._viewport = viewportFromHost(0, 0);
      this._isCompound = false;
      this._renderVersion = 0;
      this._lastRenderedViewport = null;
      this._lastValue = null;
    }

    disconnectedCallback() {
      this.finalize();
    }

    finalize() {
      if (this._view) {
        this._view.finalize();
      }
      this._renderVersion += 1;
      this._view = null;
      this._vegaContainer = null;
      this._scaleWrapper = null;
      this._lastRenderedViewport = null;
    }

    initializeLayout(width, height) {
      this._viewport = this.readViewport(width, height);
    }

    readViewport(width, height) {
      var styledHeight =
        typeof this.style.height === "string" && /px$/.test(this.style.height)
          ? parseFloat(this.style.height)
          : 0;

      return viewportFromHost(
        normalizeLayoutWidth(width, this.clientWidth),
        normalizeLayoutHeight(height, styledHeight || this.clientHeight)
      );
    }

    updateViewport(width, height) {
      this._viewport = this.readViewport(width, height);
      return this._viewport;
    }

    refreshViewportFromHost() {
      var nextViewport = this.readViewport();
      if (nextViewport.hostWidth > 0 && nextViewport.hostHeight > 0) {
        this._viewport = nextViewport;
      }
      return this._viewport;
    }

    createStructure() {
      this.innerHTML = "";

      var scaleWrapper = document.createElement("div");
      scaleWrapper.className = "ggsql-scale-wrapper";

      var vegaContainer = document.createElement("div");
      vegaContainer.className = "ggsql-container";

      scaleWrapper.appendChild(vegaContainer);
      this.appendChild(scaleWrapper);

      this._scaleWrapper = scaleWrapper;
      this._vegaContainer = vegaContainer;

      return vegaContainer;
    }

    applyViewport(viewport) {
      if (!this._scaleWrapper || !this._vegaContainer) return;

      this._scaleWrapper.style.width = "100%";
      this._scaleWrapper.style.height = "100%";
      this._scaleWrapper.style.overflow = "hidden";

      this._vegaContainer.style.width = viewport.logicalWidth + "px";
      this._vegaContainer.style.height = viewport.logicalHeight + "px";
      this._vegaContainer.style.transform =
        viewport.scale < 1 ? "scale(" + viewport.scale + ")" : "";
      this._vegaContainer.style.transformOrigin = "top left";
    }

    rememberRenderedViewport(viewport) {
      this._lastRenderedViewport = {
        logicalWidth: viewport.logicalWidth,
        logicalHeight: viewport.logicalHeight
      };
    }

    hasMaterialViewportChange(viewport) {
      if (!this._lastRenderedViewport) return true;
      return (
        Math.abs(viewport.logicalWidth - this._lastRenderedViewport.logicalWidth) > 1 ||
        Math.abs(viewport.logicalHeight - this._lastRenderedViewport.logicalHeight) > 1
      );
    }

    buildSimpleSpec(spec, viewport) {
      return Object.assign({}, spec, {
        width: viewport.logicalWidth,
        height: viewport.logicalHeight,
        autosize: { type: "fit", contains: "padding" }
      });
    }

    buildCompoundSpec(spec, viewport) {
      return allocateCompoundSize(spec, viewport);
    }

    embedSpec(spec, viewport) {
      var self = this;
      var container = this.createStructure();
      var currentVersion = ++this._renderVersion;

      this.applyViewport(viewport);

      window.vegaEmbed(container, spec, { actions: true })
        .then(function(result) {
          if (currentVersion !== self._renderVersion || self._vegaContainer !== container) {
            result.view.finalize();
            return;
          }
          self._view = result.view;
          self.rememberRenderedViewport(viewport);
          self.applyViewport(self._viewport);
        })
        .catch(function(err) {
          if (currentVersion !== self._renderVersion || self._vegaContainer !== container) {
            return;
          }
          self.textContent = "ggsql render error: " + err;
        });
    }

    updateSimpleView(viewport) {
      var self = this;
      var view = this._view;

      if (
        !view ||
        typeof view.width !== "function" ||
        typeof view.height !== "function" ||
        typeof view.resize !== "function" ||
        typeof view.runAsync !== "function"
      ) {
        this.renderCurrentValue();
        return;
      }

      var currentVersion = ++this._renderVersion;

      view
        .width(viewport.logicalWidth)
        .height(viewport.logicalHeight)
        .resize()
        .runAsync()
        .then(function() {
          if (currentVersion !== self._renderVersion || self._view !== view) {
            return;
          }
          self.rememberRenderedViewport(viewport);
          self.applyViewport(self._viewport);
        })
        .catch(function(err) {
          if (currentVersion !== self._renderVersion || self._view !== view) {
            return;
          }
          self.textContent = "ggsql render error: " + err;
        });
    }

    renderSimpleSpec(viewport) {
      var spec = this.buildSimpleSpec(this._lastValue.spec, viewport);

      this.finalize();
      this.embedSpec(spec, viewport);
    }

    renderCompoundSpec(viewport) {
      var spec = this.buildCompoundSpec(this._lastValue.spec, viewport);

      this.finalize();
      this.embedSpec(spec, viewport);
    }

    renderCurrentValue() {
      if (!this._lastValue) return;

      var viewport = this._viewport;
      if (this._isCompound) {
        this.renderCompoundSpec(viewport);
        return;
      }

      this.renderSimpleSpec(viewport);
    }

    renderValue(x) {
      this._lastValue = x;
      this._isCompound = isCompound(x.spec);
      this.refreshViewportFromHost();
      this.renderCurrentValue();
    }

    resize(width, height) {
      var viewport = this.updateViewport(width, height);
      this.applyViewport(viewport);

      if (!this._lastValue || !this.hasMaterialViewportChange(viewport)) {
        return;
      }

      if (this._isCompound || !this._view) {
        this.renderCurrentValue();
        return;
      }

      this.updateSimpleView(viewport);
    }
  }

  if (!customElements.get("ggsql-viz")) {
    customElements.define("ggsql-viz", GgsqlViz);
  }

  // -- Compound spec sizing helpers ------------------------------------------

  var OUTER_PAD_X = 80;
  var OUTER_PAD_Y = 120;

  function isCompound(spec) {
    return (
      "facet" in spec ||
      "hconcat" in spec ||
      "vconcat" in spec ||
      "concat" in spec
    );
  }

  function allocateCompoundSize(spec, viewport) {
    var usableW = Math.max(viewport.logicalWidth - OUTER_PAD_X, 100);
    var usableH = Math.max(viewport.logicalHeight - OUTER_PAD_Y, 100);

    if ("facet" in spec) {
      var ncol = Math.max(spec.columns || 1, 1);
      var nrow = inferFacetRows(spec, ncol);
      var cellW = Math.max(Math.floor(usableW / ncol), 1);
      var cellH = Math.max(Math.floor(usableH / Math.max(nrow, 1)), 1);
      return Object.assign({}, spec, {
        spec: Object.assign({}, spec.spec, { width: cellW, height: cellH })
      });
    }

    if ("hconcat" in spec) {
      var cellW = Math.max(Math.floor(usableW / Math.max(spec.hconcat.length, 1)), 1);
      return Object.assign({}, spec, {
        hconcat: spec.hconcat.map(function(sub) {
          return Object.assign({}, sub, { width: cellW, height: usableH });
        })
      });
    }

    if ("vconcat" in spec) {
      var cellH = Math.max(Math.floor(usableH / Math.max(spec.vconcat.length, 1)), 1);
      return Object.assign({}, spec, {
        vconcat: spec.vconcat.map(function(sub) {
          return Object.assign({}, sub, { width: usableW, height: cellH });
        })
      });
    }

    if ("concat" in spec) {
      var ncol = Math.max(spec.columns || spec.concat.length || 1, 1);
      var nrow = Math.ceil(spec.concat.length / ncol);
      var cellW = Math.max(Math.floor(usableW / Math.max(ncol, 1)), 1);
      var cellH = Math.max(Math.floor(usableH / Math.max(nrow, 1)), 1);
      return Object.assign({}, spec, {
        concat: spec.concat.map(function(sub) {
          return Object.assign({}, sub, { width: cellW, height: cellH });
        })
      });
    }

    return Object.assign({}, spec);
  }

  function inferFacetRows(spec, columns) {
    var count = inferFacetCount(spec);
    if (count <= 0) return 1;
    return Math.ceil(count / Math.max(columns, 1));
  }

  function inferFacetCount(spec) {
    if (!spec.facet || typeof spec.facet.field !== "string") return 0;
    var field = spec.facet.field;
    var values = spec.data && Array.isArray(spec.data.values) ? spec.data.values : null;
    if (!values || values.length === 0) return 0;

    var seen = Object.create(null);
    for (var i = 0; i < values.length; i++) {
      if (!Object.prototype.hasOwnProperty.call(values[i], field)) continue;
      seen[String(values[i][field])] = true;
    }
    return Object.keys(seen).length;
  }

  // Expose sizing helpers for testing under Node.js
  if (typeof module !== "undefined") {
    module.exports = {
      isCompound: isCompound,
      allocateCompoundSize: allocateCompoundSize
    };
  }
})();
