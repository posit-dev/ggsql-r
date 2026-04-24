# Create a Snowflake reader

Convenience constructor for Snowflake connections. Uses the ODBC reader
under the hood with the `Snowflake` driver, and takes advantage of the
dedicated Snowflake handling in the ggsql Rust core:

## Usage

``` r
snowflake_reader(
  account = NULL,
  warehouse = NULL,
  database = NULL,
  schema = NULL,
  role = NULL,
  user = NULL,
  password = NULL,
  authenticator = NULL,
  connection_name = NULL,
  driver = NULL,
  ...,
  connection_string = NULL
)
```

## Arguments

- account:

  Snowflake account identifier (e.g. `"xy12345"` or
  `"xy12345.us-east-1"`). Translated to
  `Server={account}.snowflakecomputing.com` in the connection string.

- warehouse, database, schema, role:

  Snowflake session defaults.

- user, password:

  User credentials. Prefer a DSN, `connection_name`, or
  `authenticator = "externalbrowser"` over hard-coded passwords.

- authenticator:

  Snowflake authenticator (e.g. `"externalbrowser"`, `"snowflake_jwt"`,
  `"oauth"`).

- connection_name:

  Named entry in `~/.snowflake/connections.toml` whose fields will fill
  in the remaining connection parameters.

- driver:

  Override the ODBC driver name (defaults to `"Snowflake"`).

- ...:

  Additional named `key = value` parameters appended to the connection
  string.

- connection_string:

  A full raw connection string, bypassing the named arguments.
  `Driver={Snowflake};` is prepended if it isn't already present.

## Value

A `Reader` object.

## Details

Special handling of Snowflake includes:

- If `connection_name` is supplied (or `ConnectionName=` appears in the
  connection string), it is resolved against
  `~/.snowflake/connections.toml`.

- When running inside Posit Workbench, an OAuth token is automatically
  injected if one is available.

- Schema introspection uses Snowflake's
  `SHOW DATABASES / SCHEMAS / TABLES` commands rather than
  `information_schema`.

Requires the Snowflake ODBC driver to be installed on the system.

## See also

Other readers:
[`duckdb_reader()`](https://r.ggsql.org/reference/duckdb_reader.md),
[`odbc_reader()`](https://r.ggsql.org/reference/odbc_reader.md)

## Examples

``` r
if (FALSE) { # \dontrun{
# Using a named connection from ~/.snowflake/connections.toml
reader <- snowflake_reader(connection_name = "my_workbench")

# Browser-based SSO
reader <- snowflake_reader(
  account = "xy12345.us-east-1",
  user = "alice@example.com",
  authenticator = "externalbrowser",
  warehouse = "COMPUTE_WH",
  database = "ANALYTICS",
  schema = "PUBLIC",
  role = "ANALYST"
)
} # }
```
