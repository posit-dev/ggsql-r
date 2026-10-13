# A bridged primary that counts source reads, backed by an in-memory DuckDB.
counting_primary <- function() {
  env <- new.env(parent = emptyenv())
  env$calls <- 0L
  backend <- duckdb_reader()
  ggsql_execute_sql(
    backend,
    "CREATE TABLE t AS SELECT * FROM (VALUES (1), (2), (3)) AS t(v)"
  )
  env$execute_sql <- function(sql) {
    env$calls <- env$calls + 1L
    ggsql_execute_sql(backend, sql)
  }
  env
}

test_that("caching_reader creates a reader from a connection string", {
  reader <- caching_reader("duckdb://memory")
  expect_s3_class(reader, "Reader")
})

test_that("caching_reader rejects a Reader instance with guidance", {
  inner <- duckdb_reader()
  expect_error(caching_reader(inner), "connection string")
})

test_that("caching_reader rejects an unsupported scheme", {
  expect_error(caching_reader("sqlite://memory"), "scheme")
})

test_that("caching_reader accepts a callback primary without register", {
  # register/unregister are optional, mirroring custom_reader()
  reader <- caching_reader(primary = function(sql) data.frame())
  expect_s3_class(reader, "Reader")
})

test_that("caching_reader rejects register/unregister with a string primary", {
  expect_error(
    caching_reader("duckdb://memory", register = function(...) NULL),
    "only used when"
  )
  expect_error(
    caching_reader("duckdb://memory", unregister = function(...) NULL),
    "only used when"
  )
})

test_that("caching_reader memoizes identical reads", {
  primary <- counting_primary()
  reader <- caching_reader(primary$execute_sql)
  ggsql_execute_sql(reader, "SELECT * FROM t")
  ggsql_execute_sql(reader, "SELECT * FROM t")
  expect_equal(primary$calls, 1L)
})

test_that("caching_reader sends distinct reads to the primary", {
  primary <- counting_primary()
  reader <- caching_reader(primary$execute_sql)
  ggsql_execute_sql(reader, "SELECT * FROM t")
  ggsql_execute_sql(reader, "SELECT v + 1 AS v FROM t")
  expect_equal(primary$calls, 2L)
})

test_that("caching_reader honors ttl_secs", {
  primary <- counting_primary()
  reader <- caching_reader(primary$execute_sql, ttl_secs = 1)
  ggsql_execute_sql(reader, "SELECT * FROM t")
  Sys.sleep(1.1)
  ggsql_execute_sql(reader, "SELECT * FROM t")
  expect_equal(primary$calls, 2L)
})

test_that("caching_reader honors enabled = FALSE", {
  primary <- counting_primary()
  reader <- caching_reader(primary$execute_sql, enabled = FALSE)
  ggsql_execute_sql(reader, "SELECT * FROM t")
  ggsql_execute_sql(reader, "SELECT * FROM t")
  expect_equal(primary$calls, 2L)
})

test_that("caching_reader honors GGSQL_CACHE_DISABLED", {
  withr::local_envvar(GGSQL_CACHE_DISABLED = "1")
  primary <- counting_primary()
  reader <- caching_reader(primary$execute_sql)
  ggsql_execute_sql(reader, "SELECT * FROM t")
  ggsql_execute_sql(reader, "SELECT * FROM t")
  expect_equal(primary$calls, 2L)
})

test_that("keyword config overrides the environment", {
  withr::local_envvar(GGSQL_CACHE_DISABLED = "1")
  primary <- counting_primary()
  reader <- caching_reader(primary$execute_sql, enabled = TRUE)
  ggsql_execute_sql(reader, "SELECT * FROM t")
  ggsql_execute_sql(reader, "SELECT * FROM t")
  expect_equal(primary$calls, 1L)
})

test_that("layer-level sources work through a bridged primary", {
  # VISUALISE ... FROM <table> stages the layer source through the cache,
  # so the query runs end to end instead of being rejected.
  primary <- counting_primary()
  reader <- caching_reader(primary$execute_sql)
  spec <- ggsql_execute(
    reader,
    "VISUALISE x DRAW histogram MAPPING v AS x FROM t"
  )
  expect_s3_class(spec, "Spec")
})

test_that("registered tables are cache-resident and skip the primary", {
  primary <- counting_primary()
  reader <- caching_reader(primary$execute_sql)
  ggsql_register(reader, data.frame(v = 1:3), "only_in_cache")
  spec <- ggsql_execute(
    reader,
    "VISUALISE x DRAW histogram MAPPING v AS x FROM only_in_cache"
  )
  expect_s3_class(spec, "Spec")
  expect_equal(primary$calls, 0L)
})

test_that("ggsql_table_names and ggsql_table see cache-registered tables", {
  # Registrations land in the private cache, which the primary's
  # SHOW TABLES never sees; R-side tracking merges them into the listing.
  reader <- caching_reader("duckdb://memory")
  ggsql_register(reader, mtcars, "cars")
  expect_true("cars" %in% ggsql_table_names(reader))
  expect_s3_class(ggsql_table(reader, "cars"), "data.frame")
  ggsql_unregister(reader, "cars")
  expect_false("cars" %in% ggsql_table_names(reader))
  expect_null(ggsql_table(reader, "cars"))
})

test_that("caching reader executes a full ggsql query", {
  reader <- caching_reader("duckdb://memory")
  spec <- ggsql_execute(
    reader,
    "SELECT 1 AS x, 2 AS y VISUALISE x, y DRAW point"
  )
  expect_s3_class(spec, "Spec")
  expect_equal(ggsql_metadata(spec)$rows, 1)
})
