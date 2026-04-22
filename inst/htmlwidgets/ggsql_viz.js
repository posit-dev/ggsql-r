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

  class GgsqlViz extends HTMLElement {
    constructor() {
      super();
      this._view = null;
      this._container = null;
      this._baseHeight = "";
      this._isScaled = false;
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

    scaleToFit() {
      var available = this.clientWidth;
      if (!this._container) return;
      if (available < MIN_WIDTH) {
        if (!this._isScaled) this._baseHeight = this.style.height;
        var scale = available / MIN_WIDTH;
        this._container.style.transform = "scale(" + scale + ")";
        this._container.style.transformOrigin = "top left";
        this.style.height = (this._container.scrollHeight * scale) + "px";
        this._isScaled = true;
      } else {
        this._container.style.transform = "";
        if (this._isScaled) {
          this.style.height = this._baseHeight;
          this._isScaled = false;
        }
      }
    }

    _buildSpec(x) {
      if (GgsqlSizing.isCompound(x.spec)) {
        return GgsqlSizing.fitToContainer(x.spec, this.clientWidth, this.clientHeight);
      }
      return Object.assign({}, x.spec, {
        width: this.clientWidth,
        height: this.clientHeight,
        autosize: { type: "fit", contains: "padding" }
      });
    }

    renderValue(x) {
      var self = this;

      if (!this._isScaled) this._baseHeight = this.style.height;
      this.finalize();

      this.innerHTML = "";

      var container = document.createElement("div");
      container.className = "ggsql-container";
      this.appendChild(container);
      this._container = container;
      this._lastValue = x;
      this._lastEmbedWidth = this.clientWidth;

      var spec = this._buildSpec(x);
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
})();
