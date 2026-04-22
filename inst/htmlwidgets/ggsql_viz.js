HTMLWidgets.widget({
  name: "ggsql_viz",
  type: "output",

  factory: function(el, width, height) {
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
  var SCALED_CLASS = "ggsql-viz--scaled";

  function parsePixelHeight(value) {
    return typeof value === "string" && /px$/.test(value) ? parseFloat(value) : 0;
  }

  class GgsqlViz extends HTMLElement {
    constructor() {
      super();
      this._view = null;
      this._container = null;
      this._authoredHeight = "";
      this._isScaled = false;
      this._isCompound = false;
      this._renderVersion = 0;
      this._lastEmbedWidth = 0;
      this._lastValue = null;
    }

    disconnectedCallback() {
      this.finalize();
    }

    finalize() {
      if (this._view) {
        this._view.finalize();
        this._view = null;
      }
      this._container = null;
    }

    setScaledState(scaled) {
      if (scaled) {
        this.classList.add(SCALED_CLASS);
      } else {
        this.classList.remove(SCALED_CLASS);
      }
    }

    scaleToFit() {
      var available = this.clientWidth;
      if (!this._container) return;
      if (available < MIN_WIDTH) {
        this.setScaledState(true);
        var scale = available / MIN_WIDTH;
        this._container.style.transform = "scale(" + scale + ")";
        this._container.style.transformOrigin = "top left";
        this.style.height = (this._container.scrollHeight * scale) + "px";
        this._isScaled = true;
      } else {
        this.setScaledState(false);
        this._container.style.transform = "";
        if (this._isCompound) {
          var minHeight = parsePixelHeight(this._authoredHeight);
          this.style.height = Math.max(this._container.scrollHeight, minHeight) + "px";
        } else if (this._isScaled) {
          this.style.height = this._authoredHeight;
        }
        this._isScaled = false;
      }
    }

    renderValue(x) {
      var self = this;

      if (!this._authoredHeight) this._authoredHeight = this.style.height;
      this.finalize();

      this.innerHTML = "";

      var container = document.createElement("div");
      container.className = "ggsql-container";
      this.appendChild(container);
      this._container = container;
      this._lastValue = x;
      this._lastEmbedWidth = this.clientWidth;

      var spec;
      this._isCompound = isCompound(x.spec);
      if (this._isCompound) {
        spec = fitToContainer(x.spec, this.clientWidth, this.clientHeight);
      } else {
        spec = Object.assign({}, x.spec, {
          width: "container",
          height: "container"
        });
      }

      var currentVersion = ++this._renderVersion;

      window.vegaEmbed(container, spec, { actions: true })
        .then(function(result) {
          if (currentVersion !== self._renderVersion || self._container !== container) {
            result.view.finalize();
            return;
          }
          self._view = result.view;
          self.scaleToFit();
        })
        .catch(function(err) {
          if (currentVersion !== self._renderVersion || self._container !== container) {
            return;
          }
          self.textContent = "ggsql render error: " + err;
        });
    }

    resize(width, height) {
      if (this._lastEmbedWidth > 0 && this._lastValue) {
        var widthChange = Math.abs(this.clientWidth - this._lastEmbedWidth);
        if (this._isCompound && widthChange > 1) {
          this.renderValue(this._lastValue);
          return;
        }
        var drift = Math.abs(this.clientWidth - this._lastEmbedWidth) / this._lastEmbedWidth;
        if (drift > 0.2) {
          this.renderValue(this._lastValue);
          return;
        }
      }
      this.scaleToFit();
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
