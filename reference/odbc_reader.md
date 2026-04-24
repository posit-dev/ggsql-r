# Create an ODBC reader

Creates a connection to a database through an ODBC driver. Can execute
SQL queries and, where the backend supports it, register R data frames
as temporary tables. Requires an ODBC driver manager (unixODBC/iODBC on
Unix, built into Windows) and the appropriate ODBC driver for the target
database to be installed.

## Usage

``` r
odbc_reader(
  dsn = NULL,
  driver = NULL,
  server = NULL,
  database = NULL,
  uid = NULL,
  pwd = NULL,
  ...,
  connection_string = NULL
)
```

## Arguments

- dsn:

  Name of a data source configured in `odbc.ini` / `odbcinst.ini`.

- driver:

  ODBC driver name (e.g. `"{PostgreSQL}"`, `"{Snowflake}"`). Curly
  brackets are optional.

- server, database, uid, pwd:

  Common ODBC parameters.

- ...:

  Additional named `key = value` parameters appended to the connection
  string (e.g. `Port = 5432`, `Warehouse = "COMPUTE_WH"`).

- connection_string:

  A full ODBC connection string, e.g.
  `"Driver={PostgreSQL};Server=localhost;Database=mydb;UID=user;PWD=pass"`.
  A leading `odbc://` is accepted and stripped.

## Value

A `Reader` object.

## Details

Either pass a full ODBC connection string via `connection_string`, or
supply named components (`dsn`, `driver`, `server`, `database`, `uid`,
`pwd`, plus any extra `key = value` pairs in `...`) and they will be
assembled into a connection string. If `connection_string` is supplied,
the other named arguments are ignored.

## Credentials

Connection strings are stored in-memory for the life of the reader.
Prefer configuring credentials through a DSN, `~/.odbc.ini`, or
environment variables rather than hard-coding passwords in scripts.

## See also

Other readers:
[`duckdb_reader()`](https://r.ggsql.org/reference/duckdb_reader.md),
[`snowflake_reader()`](https://r.ggsql.org/reference/snowflake_reader.md)

## Examples

``` r
if (FALSE) { # \dontrun{
# Using a preconfigured DSN
reader <- odbc_reader(dsn = "mydsn")

# Building a connection string from components
reader <- odbc_reader(
  driver = "{PostgreSQL}",
  server = "localhost",
  database = "mydb",
  uid = "user",
  pwd = "secret",
  Port = 5432
)

# Passing a full connection string
reader <- odbc_reader("Driver={SQLite3};Database=:memory:")
} # }
```
