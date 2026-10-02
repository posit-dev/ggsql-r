test_that("writer constructors create writers", {
  expect_s3_class(svg_writer(), "Writer")
  expect_s3_class(pdf_writer(), "Writer")
  expect_s3_class(hep_writer(), "Writer")
  expect_warning(
    expect_s3_class(vegalite_writer(), "Writer"),
    "deprecated"
  )
})

test_that("ggsql_render produces SVG markup with svg_writer", {
  reader <- duckdb_reader()
  ggsql_register(reader, mtcars, "cars")
  spec <- ggsql_execute(
    reader,
    "SELECT * FROM cars VISUALISE mpg AS x, disp AS y DRAW point"
  )
  svg <- ggsql_render(svg_writer(), spec)
  expect_type(svg, "character")
  expect_match(svg, "<svg", fixed = TRUE)
})

test_that("ggsql_render produces PDF bytes with pdf_writer", {
  reader <- duckdb_reader()
  ggsql_register(reader, mtcars, "cars")
  spec <- ggsql_execute(
    reader,
    "SELECT * FROM cars VISUALISE mpg AS x, disp AS y DRAW point"
  )
  pdf <- ggsql_render(pdf_writer(), spec)
  expect_type(pdf, "raw")
  expect_identical(pdf[1:5], charToRaw("%PDF-"))
})

test_that("ggsql_render produces a .hep document with hep_writer", {
  reader <- duckdb_reader()
  ggsql_register(reader, mtcars, "cars")
  spec <- ggsql_execute(
    reader,
    "SELECT * FROM cars VISUALISE mpg AS x, disp AS y DRAW point"
  )
  hep <- ggsql_render(hep_writer(), spec)
  expect_type(hep, "raw")
  expect_true(length(hep) > 0)
})

test_that("ggsql_render returns Vega-Lite JSON", {
  reader <- duckdb_reader()
  ggsql_register(reader, mtcars, "cars")
  spec <- ggsql_execute(
    reader,
    "SELECT * FROM cars VISUALISE mpg AS x, disp AS y DRAW point"
  )
  writer <- suppressWarnings(vegalite_writer())
  json <- ggsql_render(writer, spec)
  expect_type(json, "character")
  expect_match(json, "vega-lite")
  # Should be valid JSON
  parsed <- jsonlite::fromJSON(json)
  expect_true("$schema" %in% names(parsed))
})

test_that("ggsql_save writes all supported formats", {
  skip_if_not_installed("rsvg")
  skip_if_not_installed("withr")

  reader <- duckdb_reader()
  ggsql_register(reader, mtcars, "cars")
  spec <- ggsql_execute(
    reader,
    "SELECT * FROM cars VISUALISE mpg AS x, disp AS y DRAW point"
  )

  for (ext in c("svg", "pdf", "hep", "png", "json")) {
    file <- withr::local_tempfile(fileext = paste0(".", ext))
    expect_identical(ggsql_save(spec, file), file)
    expect_true(file.exists(file))
    expect_true(file.size(file) > 0)
  }
})

test_that("ggsql_save rejects unsupported formats", {
  reader <- duckdb_reader()
  ggsql_register(reader, mtcars, "cars")
  spec <- ggsql_execute(
    reader,
    "SELECT * FROM cars VISUALISE mpg AS x, disp AS y DRAW point"
  )
  expect_error(
    ggsql_save(spec, tempfile(fileext = ".txt")),
    "Unsupported format"
  )
})
