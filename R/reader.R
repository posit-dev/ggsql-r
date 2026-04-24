#' Create a DuckDB reader
#'
#' Creates a DuckDB database connection that can execute SQL queries and
#' register data frames as queryable tables. The default creates an empty
#' in-memory database but you can also pass the path to a DuckDB database to
#' directly interact with that.
#'
#' @param database Path to a DuckDB database file, or `NULL` (the default)
#' for an in-memory database.
#'
#' @return A `Reader` object.
#'
#' @export
#'
#' @family readers
#'
#' @examples
#' reader <- duckdb_reader()
#' ggsql_register(reader, mtcars, "cars")
#' df <- ggsql_execute_sql(reader, "SELECT mpg, disp FROM cars LIMIT 5")
#'
duckdb_reader <- function(database = NULL) {
  if (is.null(database)) {
    connection <- "duckdb://memory"
  } else {
    check_string(database)
    if (!file.exists(database)) {
      cli::cli_abort("Database file {.path {database}} does not exist.")
    }
    connection <- paste0("duckdb://", normalizePath(database))
  }
  Reader$new(connection)
}

#' Create an ODBC reader
#'
#' Creates a connection to a database through an ODBC driver. Can execute SQL
#' queries and, where the backend supports it, register R data frames as
#' temporary tables. Requires an ODBC driver manager (unixODBC/iODBC on Unix,
#' built into Windows) and the appropriate ODBC driver for the target database
#' to be installed.
#'
#' Either pass a full ODBC connection string via `connection_string`, or supply
#' named components (`dsn`, `driver`, `server`, `database`, `uid`, `pwd`, plus
#' any extra `key = value` pairs in `...`) and they will be assembled into a
#' connection string. If `connection_string` is supplied, the other named
#' arguments are ignored.
#'
#' @param dsn Name of a data source configured in `odbc.ini` / `odbcinst.ini`.
#' @param driver ODBC driver name (e.g. `"{PostgreSQL}"`, `"{Snowflake}"`).
#' Curly brackets are optional.
#' @param server,database,uid,pwd Common ODBC parameters.
#' @param ... Additional named `key = value` parameters appended to the
#'   connection string (e.g. `Port = 5432`, `Warehouse = "COMPUTE_WH"`).
#' @param connection_string A full ODBC connection string, e.g.
#'   `"Driver={PostgreSQL};Server=localhost;Database=mydb;UID=user;PWD=pass"`.
#'   A leading `odbc://` is accepted and stripped.
#'
#' @return A `Reader` object.
#'
#' @section Credentials:
#' Connection strings are stored in-memory for the life of the reader. Prefer
#' configuring credentials through a DSN, `~/.odbc.ini`, or environment
#' variables rather than hard-coding passwords in scripts.
#'
#' @export
#'
#' @family readers
#'
#' @examples
#' \dontrun{
#' # Using a preconfigured DSN
#' reader <- odbc_reader(dsn = "mydsn")
#'
#' # Building a connection string from components
#' reader <- odbc_reader(
#'   driver = "{PostgreSQL}",
#'   server = "localhost",
#'   database = "mydb",
#'   uid = "user",
#'   pwd = "secret",
#'   Port = 5432
#' )
#'
#' # Passing a full connection string
#' reader <- odbc_reader("Driver={SQLite3};Database=:memory:")
#' }
#'
odbc_reader <- function(
  dsn = NULL,
  driver = NULL,
  server = NULL,
  database = NULL,
  uid = NULL,
  pwd = NULL,
  ...,
  connection_string = NULL
) {
  uri <- build_odbc_uri(
    connection_string = connection_string,
    dsn = dsn,
    driver = driver,
    server = server,
    database = database,
    uid = uid,
    pwd = pwd,
    extras = list(...)
  )
  Reader$new(uri)
}

build_odbc_uri <- function(
  connection_string = NULL,
  dsn = NULL,
  driver = NULL,
  server = NULL,
  database = NULL,
  uid = NULL,
  pwd = NULL,
  extras = list()
) {
  if (!is.null(connection_string)) {
    check_string(connection_string)
    conn <- sub("^odbc://", "", connection_string, ignore.case = TRUE)
    return(paste0("odbc://", conn))
  }
  parts <- c(
    if (!is.null(dsn)) paste0("DSN=", dsn),
    if (!is.null(driver)) paste0("Driver={", gsub("^\\{|\\}$", "", driver), "}"),
    if (!is.null(server)) paste0("Server=", server),
    if (!is.null(database)) paste0("Database=", database),
    if (!is.null(uid)) paste0("UID=", uid),
    if (!is.null(pwd)) paste0("PWD=", pwd)
  )
  if (length(extras) > 0) {
    nm <- names(extras)
    if (is.null(nm) || any(!nzchar(nm))) {
      cli::cli_abort(
        "All {.arg ...} arguments to {.fn odbc_reader} must be named."
      )
    }
    parts <- c(
      parts,
      paste0(nm, "=", vapply(extras, as.character, character(1)))
    )
  }
  if (length(parts) == 0) {
    cli::cli_abort(
      "Must supply {.arg connection_string} or at least one named ODBC parameter."
    )
  }
  paste0("odbc://", paste(parts, collapse = ";"))
}

#' Create a Snowflake reader
#'
#' Convenience constructor for Snowflake connections. Uses the ODBC reader
#' under the hood with the `Snowflake` driver, and takes advantage of the
#' dedicated Snowflake handling in the ggsql Rust core:
#'
#' Special handling of Snowflake includes:
#'
#' - If `connection_name` is supplied (or `ConnectionName=` appears in the
#'   connection string), it is resolved against `~/.snowflake/connections.toml`.
#' - When running inside Posit Workbench, an OAuth token is automatically
#'   injected if one is available.
#' - Schema introspection uses Snowflake's `SHOW DATABASES / SCHEMAS / TABLES`
#'   commands rather than `information_schema`.
#'
#' Requires the Snowflake ODBC driver to be installed on the system.
#'
#' @param account Snowflake account identifier (e.g. `"xy12345"` or
#'   `"xy12345.us-east-1"`). Translated to
#'   `Server={account}.snowflakecomputing.com` in the connection string.
#' @param warehouse,database,schema,role Snowflake session defaults.
#' @param user,password User credentials. Prefer a DSN, `connection_name`, or
#'   `authenticator = "externalbrowser"` over hard-coded passwords.
#' @param authenticator Snowflake authenticator (e.g. `"externalbrowser"`,
#'   `"snowflake_jwt"`, `"oauth"`).
#' @param connection_name Named entry in `~/.snowflake/connections.toml` whose
#'   fields will fill in the remaining connection parameters.
#' @param driver Override the ODBC driver name (defaults to `"Snowflake"`).
#' @param ... Additional named `key = value` parameters appended to the
#'   connection string.
#' @param connection_string A full raw connection string, bypassing the named
#'   arguments. `Driver={Snowflake};` is prepended if it isn't already present.
#'
#' @return A `Reader` object.
#'
#' @export
#'
#' @family readers
#'
#' @examples
#' \dontrun{
#' # Using a named connection from ~/.snowflake/connections.toml
#' reader <- snowflake_reader(connection_name = "my_workbench")
#'
#' # Browser-based SSO
#' reader <- snowflake_reader(
#'   account = "xy12345.us-east-1",
#'   user = "alice@example.com",
#'   authenticator = "externalbrowser",
#'   warehouse = "COMPUTE_WH",
#'   database = "ANALYTICS",
#'   schema = "PUBLIC",
#'   role = "ANALYST"
#' )
#' }
#'
snowflake_reader <- function(
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
) {
  uri <- build_snowflake_uri(
    connection_string = connection_string,
    account = account,
    warehouse = warehouse,
    database = database,
    schema = schema,
    role = role,
    user = user,
    password = password,
    authenticator = authenticator,
    connection_name = connection_name,
    driver = driver,
    extras = list(...)
  )
  Reader$new(uri)
}

build_snowflake_uri <- function(
  connection_string = NULL,
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
  extras = list()
) {
  if (!is.null(connection_string)) {
    check_string(connection_string)
    conn <- sub("^snowflake://", "", connection_string, ignore.case = TRUE)
    return(paste0("snowflake://", conn))
  }
  server <- if (!is.null(account)) {
    if (grepl("\\.", account, fixed = FALSE)) {
      # account already includes a region / full host suffix
      if (endsWith(tolower(account), ".snowflakecomputing.com")) {
        account
      } else {
        paste0(account, ".snowflakecomputing.com")
      }
    } else {
      paste0(account, ".snowflakecomputing.com")
    }
  }
  parts <- c(
    if (!is.null(driver)) paste0("Driver=", driver),
    if (!is.null(connection_name)) paste0("ConnectionName=", connection_name),
    if (!is.null(server)) paste0("Server=", server),
    if (!is.null(warehouse)) paste0("Warehouse=", warehouse),
    if (!is.null(database)) paste0("Database=", database),
    if (!is.null(schema)) paste0("Schema=", schema),
    if (!is.null(role)) paste0("Role=", role),
    if (!is.null(user)) paste0("UID=", user),
    if (!is.null(password)) paste0("PWD=", password),
    if (!is.null(authenticator)) paste0("Authenticator=", authenticator)
  )
  if (length(extras) > 0) {
    nm <- names(extras)
    if (is.null(nm) || any(!nzchar(nm))) {
      cli::cli_abort(
        "All {.arg ...} arguments to {.fn snowflake_reader} must be named."
      )
    }
    parts <- c(
      parts,
      paste0(nm, "=", vapply(extras, as.character, character(1)))
    )
  }
  if (length(parts) == 0) {
    cli::cli_abort(
      "Must supply {.arg connection_string}, {.arg connection_name}, or at least one connection parameter."
    )
  }
  paste0("snowflake://", paste(parts, collapse = ";"))
}

#' @noRd
Reader <- R6::R6Class(
  "Reader",
  cloneable = FALSE,
  public = list(
    .ptr = NULL,

    initialize = function(connection) {
      self$.ptr <- GgsqlReader$new(connection)
    },

    print = function(...) {
      cli::cli_text("<ggsql_reader>")
      invisible(self)
    }
  )
)

#' Register and unregisters a data frame as a queryable table
#'
#' After registration, the data frame can be queried by name in SQL statements.
#' You can use `ggsql_table` to extract tables from the reader (both registered
#' ones and those native to the backend) and `ggsql_table_names` to get a vector
#' of all the tables in reader.
#'
#' @param reader A `Reader` object created by e.g. [duckdb_reader()].
#' @param df A data frame to register.
#' @param name The name of the table.
#' @param replace If `TRUE`, replace an existing table with the same name.
#' Defaults to `FALSE`.
#'
#' @return `reader` for `ggsql_register()` and `ggsql_unregister()`.
#' `ggsql_table` returns a data.frame if the table exists and `NULL` if not.
#' `ggsql_table_names` return a character vector.
#'
#' @export
#'
#' @examples
#' reader <- duckdb_reader()
#' ggsql_register(reader, mtcars, "cars")
#'
#' ggsql_table_names(reader)
#'
#' ggsql_table(reader, "cars")
#'
#' ggsql_unregister(reader, "cars")
#'
#' ggsql_table_names(reader)
#'
ggsql_register <- function(reader, df, name, replace = FALSE) {
  rlang::check_required(reader)
  rlang::check_required(df)
  rlang::check_required(name)
  ipc_bytes <- df_to_ipc(df)
  reader$.ptr$register_ipc(name, ipc_bytes, replace)
  invisible(reader)
}

#' @rdname ggsql_register
#' @export
ggsql_unregister <- function(reader, name) {
  rlang::check_required(reader)
  rlang::check_required(name)
  reader$.ptr$unregister(name)
  invisible(reader)
}

#' @rdname ggsql_register
#' @export
ggsql_table <- function(reader, name) {
  if (name %in% ggsql_table_names(reader)) {
    safe_name <- gsub('"', '""', name, fixed = TRUE)
    ggsql_execute_sql(reader, paste0("SELECT * FROM \"", safe_name, "\""))
  } else {
    NULL
  }
}

#' @rdname ggsql_register
#' @export
ggsql_table_names <- function(reader) {
  ggsql_execute_sql(reader, "SHOW TABLES")$name
}

#' Execute a ggsql query
#'
#' Parses the query, and execute it against the reader's database. Returns
#' either a visualization specification ready for rendering (`ggsql_execute`) or
#' a data frame with the query result (`ggsql_execute_sql`).
#'
#' @param reader A `Reader` object created by e.g. [duckdb_reader()] or
#' [odbc_reader()].
#' @param query A ggsql query string (SQL + VISUALISE clause).
#' @return A `Spec` object.
#'
#' @export
#'
#' @examples
#' reader <- duckdb_reader()
#' ggsql_register(reader, mtcars, "cars")
#' spec <- ggsql_execute(reader,
#'   "SELECT * FROM cars VISUALISE mpg AS x, disp AS y DRAW point"
#' )
#'
ggsql_execute <- function(reader, query) {
  rlang::check_required(reader)
  rlang::check_required(query)
  spec_ptr <- reader$.ptr$execute(query)
  Spec$new(spec_ptr)
}

#' @rdname ggsql_execute
#' @export
ggsql_execute_sql <- function(reader, query) {
  rlang::check_required(reader)
  rlang::check_required(query)
  ipc_bytes <- reader$.ptr$execute_sql_ipc(query)
  ipc_to_df(ipc_bytes)
}

