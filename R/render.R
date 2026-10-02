# ---------------------------------------------------------------------------
# Export of ggsql specs via the native ggsql writers
# ---------------------------------------------------------------------------

#' Save a ggsql spec to a file
#'
#' This function renders a specification with one of the native ggsql writers
#' and writes it to disk. The format is derived from the file extension:
#' `.svg`, `.pdf`, and `.hep` are written directly by the corresponding
#' writer, `.png` is converted from the SVG output using the rsvg package, and
#' `.json` writes the (deprecated) Vega-Lite representation.
#'
#' @param spec A `Spec` object returned by [ggsql_execute()].
#' @param file Output file path. Extension determines format: `.svg`, `.pdf`,
#' `.hep`, `.png`, or `.json`.
#' @param width Width in pixels.
#' @param height Height in pixels.
#' @param dpi Resolution in dots per inch.
#'
#' @return `file`, invisibly.
#'
#' @export
#'
#' @examples
#' reader <- duckdb_reader()
#' ggsql_register(reader, mtcars, "cars")
#' spec <- ggsql_execute(reader,
#'   "SELECT * FROM cars VISUALISE mpg AS x, disp AS y DRAW point"
#' )
#' spec_file <- tempfile(fileext = ".svg")
#' ggsql_save(spec, spec_file)
#'
ggsql_save <- function(spec, file, width = 600, height = 400, dpi = 96) {
  ext <- tolower(tools::file_ext(file))
  switch(
    ext,
    svg = writeLines(ggsql_to_svg(spec, width, height, dpi), file),
    pdf = writeBin(ggsql_to_pdf(spec, width, height, dpi), file),
    hep = writeBin(ggsql_to_hep(spec), file),
    png = writeBin(ggsql_to_png(spec, width, height, dpi), file),
    json = writeLines(ggsql_render(suppressWarnings(vegalite_writer()), spec), file),
    cli::cli_abort(
      "Unsupported format {.val {ext}}. Use svg, pdf, hep, png, or json."
    )
  )
  invisible(file)
}

#' Render a ggsql spec to SVG
#'
#' Renders a visualization specification to an SVG string using the native
#' ggsql SVG writer.
#'
#' @param spec A `Spec` object returned by [ggsql_execute()].
#' @param width Width in pixels.
#' @param height Height in pixels.
#' @param dpi Resolution in dots per inch.
#' @return An SVG string (character).
#' @noRd
ggsql_to_svg <- function(spec, width = 600, height = 400, dpi = 96) {
  ggsql_render(svg_writer(width, height, dpi), spec)
}

#' Render a ggsql spec to PDF
#'
#' Renders a visualization specification to a PDF raw vector using the native
#' ggsql PDF writer.
#'
#' @inheritParams ggsql_to_svg
#' @return A raw vector containing PDF data.
#' @noRd
ggsql_to_pdf <- function(spec, width = 600, height = 400, dpi = 96) {
  ggsql_render(pdf_writer(width, height, dpi), spec)
}

#' Render a ggsql spec to a .hep plot document
#'
#' Renders a visualization specification to a `.hep` plot document (a raw
#' vector) using the native ggsql hep writer. The document can be rendered
#' at any size by a compatible consumer, such as the ggsql htmlwidget.
#'
#' @param spec A `Spec` object returned by [ggsql_execute()].
#' @return A raw vector containing the `.hep` document.
#' @noRd
ggsql_to_hep <- function(spec) {
  ggsql_render(hep_writer(), spec)
}

#' Render a ggsql spec to PNG
#'
#' Renders a visualization specification to a PNG raw vector by converting
#' the native SVG output with the rsvg package.
#'
#' @inheritParams ggsql_to_svg
#' @return A raw vector containing PNG data.
#' @noRd
ggsql_to_png <- function(spec, width = 600, height = 400, dpi = 96) {
  rlang::check_installed("rsvg", reason = "to render specs to PNG.")
  svg <- ggsql_to_svg(spec, width = width, height = height, dpi = dpi)
  rsvg::rsvg_png(charToRaw(svg), width = width, height = height)
}
