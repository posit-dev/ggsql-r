#' Create a ggsql htmlwidget
#'
#' Create a `ggsql_hep` htmlwidget from a spec. The spec is rendered to a
#' `.hep` plot document server-side and displayed in the browser with the
#' hephaestus SVG renderer compiled to WebAssembly, which re-lays out the
#' plot as its container changes size.
#'
#' @param spec A `Spec` object returned by [ggsql_execute()].
#' @param width,height Optional widget dimensions passed to
#'   [htmlwidgets::createWidget()].
#'
#' @return An `htmlwidget` with class `ggsql_hep`.
#'
#' @export
ggsql_widget <- function(spec, width = NULL, height = NULL) {
  check_r6(spec, "Spec")

  widget <- htmlwidgets::createWidget(
    name = "ggsql_hep",
    x = list(
      hep = jsonlite::base64_enc(ggsql_to_hep(spec))
    ),
    width = width,
    height = height,
    sizingPolicy = htmlwidgets::sizingPolicy(
      padding = 0,
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
    hephaestus_dependencies()
  )
  widget
}

hephaestus_dependencies <- function() {
  list(
    htmltools::htmlDependency(
      name = "hephaestus-svg",
      version = hep_version,
      src = "htmlwidgets/lib/hephaestus-svg",
      package = "ggsql",
      stylesheet = "ggsql_hep.css",
      all_files = TRUE
    )
  )
}

#' @noRd
widget_html.ggsql_hep <- function(
  name,
  package,
  id,
  style,
  class,
  inline = FALSE,
  ...
) {
  htmltools::tag(
    "ggsql-hep",
    list(
      id = id,
      style = paste0("display:block;", style),
      class = class
    )
  )
}
