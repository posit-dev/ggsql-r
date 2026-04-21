HTMLWidgets.widget({
  name: "ggsql_viz",
  type: "output",

  factory: function(el, width, height) {
    var MIN_WIDTH = 450;
    var view = null;
    var container = null;
    var baseHeight = "";
    var isScaled = false;
    var renderVersion = 0;

    function scaleToFit() {
      var available = el.clientWidth;
      if (!container) return;
      if (available < MIN_WIDTH) {
        if (!isScaled) baseHeight = el.style.height;
        var scale = available / MIN_WIDTH;
        container.style.transform = "scale(" + scale + ")";
        container.style.transformOrigin = "top left";
        el.style.height = (container.scrollHeight * scale) + "px";
        isScaled = true;
      } else {
        container.style.transform = "";
        if (isScaled) {
          el.style.height = baseHeight;
          isScaled = false;
        }
      }
    }

    function finalize() {
      if (view) {
        view.finalize();
        view = null;
      }
      container = null;
    }

    return {
      renderValue: function(x) {
        if (!isScaled) baseHeight = el.style.height;
        finalize();

        el.style.display = "block";
        el.style.overflow = "hidden";

        if (x.align === "center") {
          el.style.marginLeft = "auto";
          el.style.marginRight = "auto";
        } else if (x.align === "right") {
          el.style.marginLeft = "auto";
        }

        if (x.asp) {
          el.style.aspectRatio = x.asp;
        }

        var wrapper = el;
        if (x.caption) {
          el.innerHTML = "";
          var figure = document.createElement("figure");
          figure.style.margin = "0";
          var figcaption = document.createElement("figcaption");
          figcaption.textContent = x.caption;
          el.appendChild(figure);
          figure.appendChild(figcaption);
          wrapper = figure;
        } else {
          el.innerHTML = "";
        }

        container = document.createElement("div");
        container.style.minWidth = MIN_WIDTH + "px";
        container.style.width = "100%";
        container.style.height = "100%";
        wrapper.insertBefore(container, wrapper.firstChild);

        var spec = Object.assign({}, x.spec, {
          width: "container",
          height: "container"
        });

        var currentVersion = ++renderVersion;

        vegaEmbed(container, spec, { actions: true })
          .then(function(result) {
            if (currentVersion !== renderVersion) {
              result.view.finalize();
              return;
            }
            view = result.view;
            scaleToFit();
          })
          .catch(function(err) {
            if (currentVersion !== renderVersion) return;
            el.textContent = "ggsql render error: " + err;
          });
      },

      resize: function(width, height) {
        scaleToFit();
      }
    };
  }
});
