test_that("renderGgsql does not accept output sizing args", {
  skip_if_not_installed("shiny")

  expect_false("..." %in% names(formals(renderGgsql)))
  expect_identical(
    names(formals(renderGgsql)),
    c("expr", "reader", "env", "quoted")
  )
})

test_that("ggsqlOutput owns output sizing", {
  skip_if_not_installed("shiny")

  output <- ggsqlOutput("chart", width = "123px", height = "456px")
  output_html <- paste(capture.output(print(output)), collapse = "\n")

  expect_match(
    output_html,
    'style="display:block;width:123px;height:456px;"',
    fixed = TRUE
  )
})

test_that("renderGgsql rejects plain SQL strings before execution", {
  skip_if_not_installed("shiny")

  reader <- duckdb_reader()
  render_fn <- renderGgsql(
    {
      "SELECT 1 AS x"
    },
    reader = reader
  )

  expect_error(
    environment(render_fn)$origUserFunc(),
    "`renderGgsql()` only accepts ggsql queries with a `VISUALISE` clause.",
    fixed = TRUE
  )
})
