#' Create a writer for a ggsql spec
#'
#' Writers turn a `Spec` object (as returned by [ggsql_execute()]) into an
#' output artifact. ggsql provides the following writers:
#'
#' * `svg_writer()`: A vector graphic in SVG format
#' * `pdf_writer()`: A vector graphic in PDF format
#' * `hep_writer()`: A `.hep` plot document — a self-contained description of
#'   the resolved plot that a consumer (e.g. the ggsql htmlwidget) can render
#'   and re-layout at any size
#' * `vegalite_writer()`: A Vega-Lite JSON specification. **Deprecated** — the
#'   Vega-Lite backend is being phased out of ggsql in favour of the native
#'   writers above
#'
#' @param width,height Canvas dimensions in pixels. For `hep_writer()` these
#'   are hints to the consumer rather than a fixed size.
#' @param dpi Resolution of the canvas in dots per inch.
#'
#' @return A `Writer` object.
#'
#' @export
#'
#' @examples
#' svg_writer()
#' pdf_writer()
#' hep_writer()
#'
svg_writer <- function(width = 600, height = 400, dpi = 96) {
  Writer$new("svg", width, height, dpi)
}

#' @rdname svg_writer
#' @export
pdf_writer <- function(width = 600, height = 400, dpi = 96) {
  Writer$new("pdf", width, height, dpi)
}

#' @rdname svg_writer
#' @export
hep_writer <- function() {
  Writer$new("hep")
}

#' Create a Vega-Lite writer
#'
#' `r lifecycle::badge("deprecated")`
#'
#' The Vega-Lite backend is being phased out of ggsql. Use [svg_writer()],
#' [pdf_writer()], or [hep_writer()] instead.
#'
#' @return A `Writer` object.
#'
#' @export
#'
#' @keywords internal
vegalite_writer <- function() {
  lifecycle::deprecate_warn(
    when = "0.4.0",
    what = "vegalite_writer()",
    with = "svg_writer()"
  )
  Writer$new("vegalite")
}

#' @noRd
Writer <- R6::R6Class(
  "Writer",
  cloneable = FALSE,
  public = list(
    .ptr = NULL,
    .type = NULL,

    initialize = function(type, width = NULL, height = NULL, dpi = NULL) {
      self$.type <- type
      self$.ptr <- switch(
        type,
        vegalite = GgsqlWriter$new_vegalite(),
        svg = GgsqlWriter$new_svg(as.integer(width), as.integer(height), dpi),
        pdf = GgsqlWriter$new_pdf(as.integer(width), as.integer(height), dpi),
        hep = GgsqlWriter$new_hep(),
        cli::cli_abort("Unknown writer type {.val {type}}")
      )
    },

    print = function(...) {
      cli::cli_text("<ggsql_writer> [{self$.type}]")
      invisible(self)
    }
  )
)

#' Render a spec with a writer
#'
#' This function takes a `Spec` object as returned by [ggsql_execute()] and
#' renders it with the provided writer.
#'
#' @param writer A `Writer` object created by e.g. [svg_writer()].
#' @param spec A `Spec` object returned by [ggsql_execute()].
#'
#' @return Writer dependent:
#'
#' * `svg_writer()`: A string holding the SVG markup of the visualization
#' * `pdf_writer()`: A raw vector holding the PDF document
#' * `hep_writer()`: A raw vector holding the `.hep` plot document
#' * `vegalite_writer()`: A string holding the Vega-Lite JSON representation
#'   (deprecated)
#'
#' @export
#'
#' @examples
#' reader <- duckdb_reader()
#' ggsql_register(reader, mtcars, "cars")
#' spec <- ggsql_execute(reader,
#'   "SELECT * FROM cars VISUALISE mpg AS x DRAW histogram"
#' )
#'
#' ggsql_render(svg_writer(), spec)
#'
ggsql_render <- function(writer, spec) {
  check_r6(writer, "Writer")
  check_r6(spec, "Spec")
  res <- writer$.ptr$render(spec$.ptr)
  warnings <- res$warnings
  if (length(warnings) > 0) {
    cli::cli_warn(c(
      "The writer reported {length(warnings)} issue{?s} while rendering:",
      stats::setNames(warnings, rep("*", length(warnings)))
    ))
  }
  res$output
}
