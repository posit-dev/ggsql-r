# Create a reader backed by R callbacks

Construct a reader whose behavior is defined entirely by R functions you
supply. This makes it possible to plug in data sources that aren't
provided natively by ggsql (e.g. an in-memory store, a custom HTTP API,
a DBI connection, etc.) without touching the Rust side.

## Usage

``` r
custom_reader(execute_sql, register = NULL, unregister = NULL)
```

## Arguments

- execute_sql:

  A function `function(sql)` that executes `sql` and returns either a
  data frame or a raw vector containing Arrow IPC stream bytes (as
  produced by
  [`nanoarrow::as_nanoarrow_array_stream()`](https://arrow.apache.org/nanoarrow/latest/r/reference/as_nanoarrow_array_stream.html)
  / arrow IPC writers).

- register:

  Optional `function(name, df, replace)` that registers `df` as a table
  named `name`. `replace` is `TRUE` if the caller expects an existing
  table with the same name to be replaced.

- unregister:

  Optional `function(name)` that removes a previously registered table.

## Value

A `Reader` object, usable anywhere the other `*_reader()` constructors
are accepted.

## Details

Only `execute_sql` is required. If `register` or `unregister` are
omitted, calling
[`ggsql_register()`](https://r.ggsql.org/reference/ggsql_register.md) /
[`ggsql_unregister()`](https://r.ggsql.org/reference/ggsql_register.md)
on the returned reader raises an error.

## See also

Other readers:
[`duckdb_reader()`](https://r.ggsql.org/reference/duckdb_reader.md),
[`odbc_reader()`](https://r.ggsql.org/reference/odbc_reader.md),
[`snowflake_reader()`](https://r.ggsql.org/reference/snowflake_reader.md)

## Examples

``` r
# A trivial reader backed by a list of data frames in an environment,
# delegating the actual SQL engine to an in-memory DuckDB.
store <- new.env(parent = emptyenv())
backend <- duckdb_reader()
reader <- custom_reader(
  execute_sql = function(sql) ggsql_execute_sql(backend, sql),
  register = function(name, df, replace) {
    store[[name]] <- df
    ggsql_register(backend, df, name, replace = replace)
  },
  unregister = function(name) {
    rm(list = name, envir = store)
    ggsql_unregister(backend, name)
  }
)
ggsql_register(reader, mtcars, "cars")
ggsql_execute_sql(reader, "SELECT mpg, disp FROM cars LIMIT 3")
#>    mpg disp
#> 1 21.0  160
#> 2 21.0  160
#> 3 22.8  108
```
