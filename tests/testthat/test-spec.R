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
  json <- ggsql:::ggsql_render(ggsql:::vegalite_writer(), spec)
  widget <- ggsql:::ggsql_widget(json)
  expect_s3_class(widget, "htmlwidget")
  expect_s3_class(widget, "ggsql_viz")
  expect_true(!is.null(widget$x$spec))
})

test_that("ggsql_widget passes through asp, caption, align", {
  reader <- duckdb_reader()
  ggsql_register(reader, mtcars, "cars")
  spec <- ggsql_execute(
    reader,
    "SELECT * FROM cars VISUALISE mpg AS x, disp AS y DRAW point"
  )
  json <- ggsql:::ggsql_render(ggsql:::vegalite_writer(), spec)
  widget <- ggsql:::ggsql_widget(
    json,
    asp = "16/9",
    caption = "My chart",
    align = "center"
  )
  expect_equal(widget$x$asp, "16/9")
  expect_equal(widget$x$caption, "My chart")
  expect_equal(widget$x$align, "center")
})
