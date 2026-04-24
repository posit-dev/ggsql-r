test_that("duckdb_reader creates a reader", {
  reader <- duckdb_reader()
  expect_s3_class(reader, "Reader")
})

test_that("ggsql_register registers a data frame", {
  reader <- duckdb_reader()
  result <- ggsql_register(reader, mtcars, "cars")
  expect_invisible(ggsql_register(reader, iris, "iris"))
  # Returns reader for piping

  expect_s3_class(result, "Reader")
})

test_that("ggsql_register with replace works", {
  reader <- duckdb_reader()
  ggsql_register(reader, mtcars, "data")
  ggsql_register(reader, iris, "data", replace = TRUE)
  df <- ggsql_execute_sql(reader, "SELECT * FROM data LIMIT 1")
  expect_true("Sepal.Length" %in% names(df))
})

test_that("ggsql_unregister removes a table", {
  reader <- duckdb_reader()
  ggsql_register(reader, mtcars, "cars")
  ggsql_unregister(reader, "cars")
  expect_error(ggsql_execute_sql(reader, "SELECT * FROM cars"))
})

test_that("ggsql_execute_sql returns a data frame", {
  reader <- duckdb_reader()
  ggsql_register(reader, mtcars, "cars")
  df <- ggsql_execute_sql(reader, "SELECT mpg, disp FROM cars LIMIT 5")
  expect_s3_class(df, "data.frame")
  expect_equal(nrow(df), 5)
  expect_equal(names(df), c("mpg", "disp"))
})

test_that("ggsql_execute returns a spec", {
  reader <- duckdb_reader()
  ggsql_register(reader, mtcars, "cars")
  spec <- ggsql_execute(
    reader,
    "SELECT * FROM cars VISUALISE mpg AS x, disp AS y DRAW point"
  )
  expect_s3_class(spec, "Spec")
})

test_that("piping works", {
  reader <- duckdb_reader()
  result <- reader |>
    ggsql_register(mtcars, "cars") |>
    ggsql_execute_sql("SELECT mpg FROM cars LIMIT 3")
  expect_s3_class(result, "data.frame")
  expect_equal(nrow(result), 3)
})

# --- odbc_reader / build_odbc_uri ---

test_that("build_odbc_uri assembles a URI from named parts", {
  uri <- build_odbc_uri(
    driver = "{PostgreSQL}",
    server = "localhost",
    database = "mydb",
    uid = "user",
    pwd = "secret"
  )
  expect_equal(
    uri,
    "odbc://Driver={PostgreSQL};Server=localhost;Database=mydb;UID=user;PWD=secret"
  )
})

test_that("build_odbc_uri accepts a DSN", {
  expect_equal(build_odbc_uri(dsn = "mydsn"), "odbc://DSN=mydsn")
})

test_that("build_odbc_uri appends ... parameters as key=value pairs", {
  uri <- build_odbc_uri(
    dsn = "mydsn",
    extras = list(Port = 5432, Warehouse = "COMPUTE_WH")
  )
  expect_equal(uri, "odbc://DSN=mydsn;Port=5432;Warehouse=COMPUTE_WH")
})

test_that("build_odbc_uri preserves a raw connection string", {
  expect_equal(
    build_odbc_uri(connection_string = "Driver={SQLite3};Database=:memory:"),
    "odbc://Driver={SQLite3};Database=:memory:"
  )
})

test_that("build_odbc_uri strips a leading odbc:// from the raw string", {
  expect_equal(
    build_odbc_uri(connection_string = "odbc://DSN=mydsn"),
    "odbc://DSN=mydsn"
  )
})

test_that("build_odbc_uri prefers connection_string over named parts", {
  expect_equal(
    build_odbc_uri(
      connection_string = "DSN=direct",
      driver = "{PostgreSQL}",
      server = "ignored"
    ),
    "odbc://DSN=direct"
  )
})

test_that("build_odbc_uri errors when nothing is supplied", {
  expect_error(build_odbc_uri(), "at least one named ODBC parameter")
})

test_that("build_odbc_uri errors when extras are unnamed", {
  expect_error(
    build_odbc_uri(dsn = "mydsn", extras = list("unnamed")),
    "must be named"
  )
})

test_that("odbc_reader errors when called with no args", {
  expect_error(odbc_reader(), "at least one named ODBC parameter")
})

# --- snowflake_reader / build_snowflake_uri ---

test_that("build_snowflake_uri assembles Server from account", {
  uri <- build_snowflake_uri(
    account = "xy12345",
    user = "alice",
    password = "s3cret",
    warehouse = "COMPUTE_WH"
  )
  expect_equal(
    uri,
    "snowflake://Server=xy12345.snowflakecomputing.com;Warehouse=COMPUTE_WH;UID=alice;PWD=s3cret"
  )
})

test_that("build_snowflake_uri preserves full account hostnames", {
  uri <- build_snowflake_uri(account = "xy12345.us-east-1")
  expect_equal(
    uri,
    "snowflake://Server=xy12345.us-east-1.snowflakecomputing.com"
  )
})

test_that("build_snowflake_uri does not double the .snowflakecomputing.com suffix", {
  uri <- build_snowflake_uri(
    account = "xy12345.us-east-1.snowflakecomputing.com"
  )
  expect_equal(
    uri,
    "snowflake://Server=xy12345.us-east-1.snowflakecomputing.com"
  )
})

test_that("build_snowflake_uri emits ConnectionName alone", {
  expect_equal(
    build_snowflake_uri(connection_name = "my_workbench"),
    "snowflake://ConnectionName=my_workbench"
  )
})

test_that("build_snowflake_uri respects a driver override", {
  uri <- build_snowflake_uri(
    driver = "{SnowflakeDSIIDriver}",
    account = "xy12345"
  )
  expect_equal(
    uri,
    "snowflake://Driver={SnowflakeDSIIDriver};Server=xy12345.snowflakecomputing.com"
  )
})

test_that("build_snowflake_uri accepts extras", {
  uri <- build_snowflake_uri(
    connection_name = "my_wb",
    extras = list(Tracing = 0, Application = "ggsql")
  )
  expect_equal(
    uri,
    "snowflake://ConnectionName=my_wb;Tracing=0;Application=ggsql"
  )
})

test_that("build_snowflake_uri errors on unnamed extras", {
  expect_error(
    build_snowflake_uri(account = "xy12345", extras = list("unnamed")),
    "must be named"
  )
})

test_that("build_snowflake_uri errors when nothing is supplied", {
  expect_error(build_snowflake_uri(), "at least one connection parameter")
})

test_that("build_snowflake_uri passes a raw connection string through", {
  expect_equal(
    build_snowflake_uri(
      connection_string = "Driver=Snowflake;Server=xy12345.snowflakecomputing.com"
    ),
    "snowflake://Driver=Snowflake;Server=xy12345.snowflakecomputing.com"
  )
})

test_that("snowflake_reader errors with no args", {
  expect_error(snowflake_reader(), "at least one connection parameter")
})
