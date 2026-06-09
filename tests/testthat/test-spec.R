test_that("ggsql_metadata returns correct structure", {
  reader <- duckdb_reader()
  ggsql_register(reader, mtcars, "cars")
  spec <- ggsql_execute(
    reader,
    "SELECT * FROM cars VISUALISE mpg AS x, disp AS y DRAW point"
  )
  m <- ggsql_metadata(spec)
  expect_type(m, "list")
  expect_equal(m$rows, 32L)
  expect_type(m$columns, "character")
  expect_equal(m$layer_count, 1L)
})

test_that("ggsql_sql returns the SQL portion", {
  reader <- duckdb_reader()
  ggsql_register(reader, mtcars, "cars")
  spec <- ggsql_execute(
    reader,
    "SELECT * FROM cars VISUALISE mpg AS x, disp AS y DRAW point"
  )
  sql <- ggsql_sql(spec)
  expect_type(sql, "character")
  expect_match(sql, "SELECT")
})

test_that("ggsql_visual returns the VISUALISE portion", {
  reader <- duckdb_reader()
  ggsql_register(reader, mtcars, "cars")
  spec <- ggsql_execute(
    reader,
    "SELECT * FROM cars VISUALISE mpg AS x, disp AS y DRAW point"
  )
  vis <- ggsql_visual(spec)
  expect_type(vis, "character")
  expect_match(vis, "VISUALISE")
})

test_that("ggsql_layer_count returns integer", {
  reader <- duckdb_reader()
  ggsql_register(reader, mtcars, "cars")
  spec <- ggsql_execute(
    reader,
    "SELECT * FROM cars VISUALISE mpg AS x, disp AS y DRAW point DRAW line MAPPING mpg AS x, disp AS y"
  )
  expect_equal(ggsql_layer_count(spec), 2L)
})

test_that("ggsql_layer_data returns a data frame", {
  reader <- duckdb_reader()
  ggsql_register(reader, mtcars, "cars")
  spec <- ggsql_execute(
    reader,
    "SELECT * FROM cars VISUALISE mpg AS x, disp AS y DRAW point"
  )
  df <- ggsql_layer_data(spec, 1L)
  expect_s3_class(df, "data.frame")
  expect_equal(nrow(df), 32)
})

test_that("ggsql_warnings returns a data frame", {
  reader <- duckdb_reader()
  ggsql_register(reader, mtcars, "cars")
  spec <- ggsql_execute(
    reader,
    "SELECT * FROM cars VISUALISE mpg AS x, disp AS y DRAW point"
  )
  w <- ggsql_warnings(spec)
  expect_s3_class(w, "data.frame")
})

test_that("spec str method shows metadata", {
  reader <- duckdb_reader()
  ggsql_register(reader, mtcars, "cars")
  spec <- ggsql_execute(
    reader,
    "SELECT * FROM cars VISUALISE mpg AS x, disp AS y DRAW point"
  )
  expect_invisible(str(spec))
})

test_that("ggsql_widget returns an htmlwidget", {
  reader <- duckdb_reader()
  ggsql_register(reader, mtcars, "cars")
  spec <- ggsql_execute(
    reader,
    "SELECT * FROM cars VISUALISE mpg AS x, disp AS y DRAW point"
  )
  widget <- ggsql_widget(vegalite_writer(), spec)
  expect_s3_class(widget, "htmlwidget")
  expect_s3_class(widget, "ggsql_vega")
  expect_true(!is.null(widget$x$spec))
})

test_that("ggsql_widget renders with a custom element root", {
  reader <- duckdb_reader()
  ggsql_register(reader, mtcars, "cars")
  spec <- ggsql_execute(
    reader,
    "SELECT * FROM cars VISUALISE mpg AS x, disp AS y DRAW point"
  )
  widget <- ggsql_widget(
    vegalite_writer(),
    spec,
    width = "225px",
    height = "360px"
  )
  html <- htmltools::as.tags(widget, standalone = FALSE)

  expect_match(as.character(html), "<ggsql-vega", fixed = TRUE)
  expect_match(as.character(html), "width:225px", fixed = TRUE)
  expect_match(as.character(html), "height:360px", fixed = TRUE)
})

test_that("ggsql_widget stores min_width in the widget payload", {
  reader <- duckdb_reader()
  ggsql_register(reader, mtcars, "cars")
  spec <- ggsql_execute(
    reader,
    "SELECT * FROM cars VISUALISE mpg AS x, disp AS y DRAW point"
  )
  widget <- ggsql_widget(vegalite_writer(), spec, min_width = 450)

  expect_identical(widget$x$min_width, 450)
})

test_that("ggsql_widget rejects invalid min_width values", {
  reader <- duckdb_reader()
  ggsql_register(reader, mtcars, "cars")
  spec <- ggsql_execute(
    reader,
    "SELECT * FROM cars VISUALISE mpg AS x, disp AS y DRAW point"
  )
  invalid_values <- list("wide", c(450, 500), 0, -1, NA_real_)

  for (value in invalid_values) {
    expect_error(
      ggsql_widget(vegalite_writer(), spec, min_width = value),
      "must be `NULL` or a single positive number",
      fixed = TRUE
    )
  }
})

test_that("ggsql_widget validates writer and spec inputs", {
  reader <- duckdb_reader()
  ggsql_register(reader, mtcars, "cars")
  spec <- ggsql_execute(
    reader,
    "SELECT * FROM cars VISUALISE mpg AS x, disp AS y DRAW point"
  )

  expect_error(
    ggsql_widget("not-a-writer", spec),
    "must be a Writer/R6 object",
    fixed = TRUE
  )
  expect_error(
    ggsql_widget(vegalite_writer(), "not-a-spec"),
    "must be a Spec/R6 object",
    fixed = TRUE
  )
})
