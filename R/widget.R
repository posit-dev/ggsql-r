#' Create a ggsql htmlwidget
#'
#' Create a `ggsql_vega` htmlwidget from a writer and spec.
#'
#' @param writer A `Writer` object created by e.g. [vegalite_writer()].
#' @param spec A `Spec` object returned by [ggsql_execute()].
#' @param width,height Optional widget dimensions passed to
#'   [htmlwidgets::createWidget()].
#' @param min_width Optional minimum render width for small containers. When
#'   supplied, the widget renders at at least this width and scales down to fit
#'   narrower hosts.
#'
#' @return An `htmlwidget` with class `ggsql_vega`.
#'
#' @export
ggsql_widget <- function(
  writer,
  spec,
  width = NULL,
  height = NULL,
  min_width = NULL
) {
  check_r6(writer, "Writer")
  check_r6(spec, "Spec")

  if (!is.null(min_width)) {
    if (
      !is.numeric(min_width) ||
        length(min_width) != 1L ||
        is.na(min_width) ||
        !is.finite(min_width) ||
        min_width <= 0
    ) {
      cli::cli_abort(
        "{.arg min_width} must be `NULL` or a single positive number."
      )
    }

    min_width <- as.numeric(min_width)
  }

  spec_json <- ggsql_render(writer, spec)

  widget <- htmlwidgets::createWidget(
    name = "ggsql_vega",
    x = list(
      spec = jsonlite::parse_json(spec_json),
      min_width = min_width
    ),
    width = width,
    height = height,
    sizingPolicy = htmlwidgets::sizingPolicy(
      viewer.fill = TRUE,
      browser.fill = TRUE,
      knitr.figure = TRUE,
      knitr.defaultWidth = "100%",
      knitr.defaultHeight = "400px"
    ),
    package = "ggsql"
  )
  widget$dependencies <- c(
    widget$dependencies,
    vega_dependencies(),
    widget_dependencies()
  )
  widget
}

vega_dependencies <- function() {
  list(
    htmltools::htmlDependency(
      name = "vega",
      version = vega_version,
      src = "htmlwidgets/lib/vega",
      package = "ggsql",
      script = "vega.min.js"
    ),
    htmltools::htmlDependency(
      name = "vega-lite",
      version = vega_lite_version,
      src = "htmlwidgets/lib/vega-lite",
      package = "ggsql",
      script = "vega-lite.min.js"
    ),
    htmltools::htmlDependency(
      name = "vega-embed",
      version = vega_embed_version,
      src = "htmlwidgets/lib/vega-embed",
      package = "ggsql",
      script = "vega-embed.min.js"
    )
  )
}

widget_dependencies <- function() {
  list(
    htmltools::htmlDependency(
      name = "ggsql-vega-styles",
      version = utils::packageVersion("ggsql"),
      src = "htmlwidgets",
      package = "ggsql",
      stylesheet = "ggsql_vega.css",
      all_files = FALSE
    )
  )
}

#' @noRd
widget_html.ggsql_vega <- function(
  name,
  package,
  id,
  style,
  class,
  inline = FALSE,
  ...
) {
  htmltools::tag(
    "ggsql-vega",
    list(
      id = id,
      style = paste0("display:block;", style),
      class = class
    )
  )
}
