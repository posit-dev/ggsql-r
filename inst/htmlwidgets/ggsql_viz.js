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
      if (
        this._viewport.hostWidth <= 0 ||
        this._viewport.hostHeight <= 0 ||
        nextViewport.hostWidth > this._viewport.hostWidth ||
        nextViewport.hostHeight > this._viewport.hostHeight
      ) {
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

    buildSpec(spec, viewport) {
      if (this._isCompound) {
        return fitToContainer(spec, viewport.logicalWidth, viewport.logicalHeight);
      }

      return Object.assign({}, spec, {
        width: viewport.logicalWidth,
        height: viewport.logicalHeight,
        autosize: { type: "fit", contains: "padding" }
      });
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

    renderCurrentValue() {
      if (!this._lastValue) return;

      var viewport = this._viewport;
      var spec = this.buildSpec(this._lastValue.spec, viewport);

      this.finalize();
      this.embedSpec(spec, viewport);
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

  var PADDING_X = 80;
  var PADDING_Y = 120;
  var LEGEND_WIDTH = 120;
  var LEGEND_CHANNELS = ["color", "fill", "stroke", "shape", "size", "opacity"];

  function isCompound(spec) {
    return (
      "facet" in spec ||
      "hconcat" in spec ||
      "vconcat" in spec ||
      "concat" in spec
    );
  }

  function hasLegend(spec) {
    var specs = [];
    if (spec.spec) specs.push(spec.spec);
    if (Array.isArray(spec.hconcat)) specs = specs.concat(spec.hconcat);
    if (Array.isArray(spec.vconcat)) specs = specs.concat(spec.vconcat);
    if (Array.isArray(spec.concat)) specs = specs.concat(spec.concat);
    if (specs.length === 0) specs.push(spec);

    for (var i = 0; i < specs.length; i++) {
      var layers = specs[i].layer ? specs[i].layer : [specs[i]];
      for (var j = 0; j < layers.length; j++) {
        var enc = layers[j].encoding;
        if (!enc) continue;
        for (var k = 0; k < LEGEND_CHANNELS.length; k++) {
          var ch = LEGEND_CHANNELS[k];
          if (enc[ch] && enc[ch].field !== undefined) return true;
        }
      }
    }
    return false;
  }

  function fitToContainer(spec, containerWidth, containerHeight) {
    var padX = PADDING_X + (hasLegend(spec) ? LEGEND_WIDTH : 0);
    var usableW = Math.max(containerWidth - padX, 100);
    var usableH = Math.max(containerHeight - PADDING_Y, 100);

    if ("facet" in spec) {
      var ncol = spec.columns || 1;
      var cellW = Math.floor(usableW / ncol);
      return Object.assign({}, spec, {
        spec: Object.assign({}, spec.spec, { width: cellW, height: usableH })
      });
    }

    if ("hconcat" in spec) {
      var cellW = Math.floor(usableW / Math.max(spec.hconcat.length, 1));
      return Object.assign({}, spec, {
        hconcat: spec.hconcat.map(function(sub) {
          return Object.assign({}, sub, { width: cellW, height: usableH });
        })
      });
    }

    if ("vconcat" in spec) {
      var cellH = Math.floor(usableH / Math.max(spec.vconcat.length, 1));
      return Object.assign({}, spec, {
        vconcat: spec.vconcat.map(function(sub) {
          return Object.assign({}, sub, { width: usableW, height: cellH });
        })
      });
    }

    if ("concat" in spec) {
      var ncol = spec.columns || spec.concat.length;
      var cellW = Math.floor(usableW / Math.max(ncol, 1));
      return Object.assign({}, spec, {
        concat: spec.concat.map(function(sub) {
          return Object.assign({}, sub, { width: cellW, height: usableH });
        })
      });
    }

    return Object.assign({}, spec);
  }

  // Expose sizing helpers for testing under Node.js
  if (typeof module !== "undefined") {
    module.exports = { isCompound: isCompound, hasLegend: hasLegend, fitToContainer: fitToContainer };
  }
})();
