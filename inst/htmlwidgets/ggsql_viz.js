HTMLWidgets.widget({
  name: "ggsql_viz",
  type: "output",

  factory: function(el) {
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
  var OUTER_PAD_X = 80;
  var OUTER_PAD_Y = 120;

  function readHostBox(el, width, height) {
    var hostWidth =
      typeof width === "number" && width > 0 ? width : el.clientWidth || 0;
    var styledHeight =
      typeof el.style.height === "string" && /px$/.test(el.style.height)
        ? parseFloat(el.style.height)
        : 0;
    var hostHeight =
      typeof height === "number" && height > 0
        ? height
        : styledHeight || el.clientHeight || 0;

    var hostBox = { hostWidth: hostWidth, hostHeight: hostHeight };
    return hostBox;
  }

  function buildSimpleLayout(hostWidth, hostHeight) {
    return {
      hostWidth: hostWidth,
      hostHeight: hostHeight,
      renderWidth: Math.max(hostWidth, MIN_WIDTH),
      renderHeight: hostHeight,
      scale:
        hostWidth > 0 && hostWidth < MIN_WIDTH ? hostWidth / MIN_WIDTH : 1
    };
  }

  class GgsqlViz extends HTMLElement {
    constructor() {
      super();
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

    applyLayout(layout) {
      if (!this._scaleWrapper || !this._vegaContainer) return;

      this._vegaContainer.style.width = layout.renderWidth + "px";
      this._vegaContainer.style.height = layout.renderHeight + "px";
      this._vegaContainer.style.transform =
        layout.scale < 1 ? "scale(" + layout.scale + ")" : "";
    }

    buildSimpleSpec(spec, layout) {
      return Object.assign({}, spec, {
        width: layout.renderWidth,
        height: layout.renderHeight,
        autosize: { type: "fit", contains: "padding" }
      });
    }

    renderSimple(layout) {
      var spec = this.buildSimpleSpec(this._value.spec, layout);
      this.embedSpec(spec, layout);
    }

    resizeSimpleView(layout) {
      if (!this._view) {
        this.renderSimple(layout);
        return;
      }

      var self = this;
      var view = this._view;

      this._layout = layout;
      this.applyLayout(layout);
      view
        .width(layout.renderWidth)
        .height(layout.renderHeight)
        .resize()
        .runAsync()
        .catch(function(err) {
          if (self._view !== view) return;
          self.textContent = "ggsql render error: " + err;
        });
    }

    renderCompound(layout) {
      var spec = allocateCompoundSize(this._value.spec, layout);
      this.embedSpec(spec, layout);
    }

    hasMaterialCompoundResize(nextLayout) {
      if (!this._layout) return true;
      return (
        Math.abs(this._layout.hostWidth - nextLayout.hostWidth) > 1 ||
        Math.abs(this._layout.hostHeight - nextLayout.hostHeight) > 1
      );
    }

    embedSpec(spec, layout) {
      var self = this;
      var container = this.createStructure();
      var token = {};

      this._embedToken = token;
      this._layout = layout;
      this.applyLayout(layout);

      window.vegaEmbed(container, spec, { actions: true })
        .then(function(result) {
          if (self._embedToken !== token || self._vegaContainer !== container) {
            result.view.finalize();
            return;
          }
          if (self._view && self._view !== result.view) self._view.finalize();
          self._view = result.view;
          self.applyLayout(self._layout);
        })
        .catch(function(err) {
          if (self._embedToken !== token || self._vegaContainer !== container) return;
          self.textContent = "ggsql render error: " + err;
        });
    }

    renderValue(x) {
      var host = readHostBox(this);

      this._value = x;
      this._isCompound = isCompound(x.spec);

      if (this._isCompound) {
        this.renderCompound(buildSimpleLayout(host.hostWidth, host.hostHeight));
        return;
      }

      this.renderSimple(buildSimpleLayout(host.hostWidth, host.hostHeight));
    }

    resize(width, height) {
      if (!this._value) return;

      var host = readHostBox(this, width, height);
      var layout = buildSimpleLayout(host.hostWidth, host.hostHeight);

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

  if (!customElements.get("ggsql-viz")) {
    customElements.define("ggsql-viz", GgsqlViz);
  }

  // -- Compound spec sizing helpers ------------------------------------------

  function isCompound(spec) {
    return (
      "facet" in spec ||
      "hconcat" in spec ||
      "vconcat" in spec ||
      "concat" in spec
    );
  }

  function allocateCompoundSize(spec, layout) {
    var usableW = Math.max(layout.renderWidth - OUTER_PAD_X, 100);
    var usableH = Math.max(layout.renderHeight - OUTER_PAD_Y, 100);

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
      buildSimpleLayout: buildSimpleLayout,
      readHostBox: readHostBox,
      isCompound: isCompound,
      allocateCompoundSize: allocateCompoundSize
    };
  }
})();
