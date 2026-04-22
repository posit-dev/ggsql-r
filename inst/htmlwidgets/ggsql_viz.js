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

  function embedFn() {
    return window.vegaEmbed || vegaEmbed;
  }

  class GgsqlViz extends HTMLElement {
    constructor() {
      super();
      this._view = null;
      this._container = null;
      this._baseHeight = "";
      this._isScaled = false;
      this._renderVersion = 0;
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

    renderValue(x) {
      var self = this;

      if (!this._isScaled) this._baseHeight = this.style.height;
      this.finalize();

      this.classList.remove("ggsql-align-center", "ggsql-align-right");
      this.style.aspectRatio = "";

      if (x.align === "center") {
        this.classList.add("ggsql-align-center");
      } else if (x.align === "right") {
        this.classList.add("ggsql-align-right");
      }

      if (x.asp) {
        this.style.aspectRatio = x.asp;
      }

      var wrapper = this;
      this.innerHTML = "";
      if (x.caption) {
        var figure = document.createElement("figure");
        var figcaption = document.createElement("figcaption");
        figcaption.textContent = x.caption;
        this.appendChild(figure);
        figure.appendChild(figcaption);
        wrapper = figure;
      }

      var container = document.createElement("div");
      container.className = "ggsql-container";
      wrapper.insertBefore(container, wrapper.firstChild);
      this._container = container;

      var spec = Object.assign({}, x.spec, {
        width: "container",
        height: "container"
      });

      var currentVersion = ++this._renderVersion;

      embedFn()(container, spec, { actions: true })
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
      this.scaleToFit();
    }
  }

  if (!customElements.get("ggsql-viz")) {
    customElements.define("ggsql-viz", GgsqlViz);
  }
})();
