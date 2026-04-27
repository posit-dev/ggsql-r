# Package-level environment for persistent reader across knitr chunks
ggsql_env <- new.env(parent = emptyenv())

get_engine_reader <- function(connection = NULL) {
  if (is.null(connection)) {
    # Default in-memory DuckDB reader
    if (is.null(ggsql_env$reader)) {
      ggsql_env$reader <- duckdb_reader()
      # Inject the sql proxy into the knit environment for cross-chunk access
      proxy <- new_ggsql_tables()
      assign("sql", proxy, envir = knitr::knit_global())
      # Also inject into Python if reticulate is available, so Python chunks
      # can use sql.tablename directly (without the r. prefix)
      if (
        requireNamespace("reticulate", quietly = TRUE) &&
          reticulate::py_available(initialize = FALSE)
      ) {
        reticulate::py_run_string("pass") # ensure Python is initialized
        py <- reticulate::py
        py[["sql"]] <- proxy
      }
    }
    return(ggsql_env$reader)
  }

  # `custom://` always resolves fresh — the user owns the Reader and may
  # rebind the variable across chunks; caching would shadow that.
  if (grepl("^custom://", connection, ignore.case = TRUE)) {
    return(parse_connection(connection))
  }

  # Other connections: cache by connection string
  if (is.null(ggsql_env$readers)) {
    ggsql_env$readers <- list()
  }
  if (is.null(ggsql_env$readers[[connection]])) {
    ggsql_env$readers[[connection]] <- parse_connection(connection)
  }
  ggsql_env$readers[[connection]]
}

register_syntax_highlighting <- function() {
  syntax_file <- system.file("ggsql.xml", package = "ggsql")
  if (!nzchar(syntax_file)) {
    return()
  }

  # For rmarkdown: add --syntax-definition to Pandoc args
  current <- knitr::opts_knit$get("rmarkdown.pandoc.args")
  if (!syntax_file %in% current) {
    knitr::opts_knit$set(
      rmarkdown.pandoc.args = c(current, "--syntax-definition", syntax_file)
    )
  }
}

# ---------------------------------------------------------------------------
# Connection string parsing
# ---------------------------------------------------------------------------

parse_connection <- function(connection) {
  check_string(connection)

  if (!grepl("://", connection, fixed = TRUE)) {
    cli::cli_abort(
      "Invalid connection string {.val {connection}}. Expected format: {.code scheme://...} (e.g., {.code duckdb://memory})."
    )
  }

  scheme <- sub("://.*", "", connection)

  switch(
    tolower(scheme),
    duckdb = Reader$new(connection),
    odbc = Reader$new(connection),
    snowflake = Reader$new(connection),
    custom = resolve_custom_reader(connection),
    cli::cli_abort(
      "Unsupported connection scheme {.val {scheme}}. Supported schemes: {.val duckdb}, {.val odbc}, {.val snowflake}, {.val custom}."
    )
  )
}

resolve_custom_reader <- function(connection) {
  name <- sub("^custom://", "", connection, ignore.case = TRUE)
  if (!nzchar(name)) {
    cli::cli_abort(c(
      "Invalid custom connection {.val {connection}}.",
      i = "Expected {.code custom://name}, where {.var name} is a {.cls Reader} in the knit environment."
    ))
  }
  env <- knitr::knit_global()
  if (!exists(name, envir = env, inherits = FALSE)) {
    cli::cli_abort(
      "Custom reader {.val {name}} not found in the knit environment."
    )
  }
  obj <- get(name, envir = env, inherits = FALSE)
  if (!inherits(obj, "Reader")) {
    cli::cli_abort(
      "{.var {name}} is not a {.cls Reader} (got {.cls {class(obj)[1]}})."
    )
  }
  obj
}

# ---------------------------------------------------------------------------
# sql proxy: live access to tables in the ggsql DuckDB reader
# ---------------------------------------------------------------------------

new_ggsql_tables <- function() {
  structure(list(), class = "ggsql_tables")
}

#' @export
`$.ggsql_tables` <- function(x, name) {
  safe_name <- gsub('"', '""', name, fixed = TRUE)
  ggsql_execute_sql(
    get_engine_reader(knitr::opts_current$get("connection")),
    paste0('SELECT * FROM "', safe_name, '"')
  )
}

#' @export
`[[.ggsql_tables` <- function(x, name, ...) {
  safe_name <- gsub('"', '""', name, fixed = TRUE)
  ggsql_execute_sql(
    get_engine_reader(knitr::opts_current$get("connection")),
    paste0('SELECT * FROM "', safe_name, '"')
  )
}

#' @export
print.ggsql_tables <- function(x, ...) {
  reader <- get_engine_reader(knitr::opts_current$get("connection"))
  tables <- try_fetch(
    ggsql_execute_sql(reader, "SHOW TABLES"),
    error = function(cnd) data.frame(name = character())
  )
  cli::cli_text("<ggsql tables>")
  if (nrow(tables) > 0) {
    cli::cli_bullets(stats::setNames(tables[[1]], rep("*", nrow(tables))))
  } else {
    cli::cli_text("(no tables)")
  }
  invisible(x)
}

#' @export
names.ggsql_tables <- function(x) {
  reader <- get_engine_reader(knitr::opts_current$get("connection"))
  tables <- try_fetch(
    ggsql_execute_sql(reader, "SHOW TABLES"),
    error = function(cnd) data.frame(name = character())
  )
  tables <- if (nrow(tables) > 0) tables[[1]] else character()
  tables[!grepl("^__(ggsql|r|py)_", tables, perl = TRUE)]
}

# ---------------------------------------------------------------------------
# Data reference resolution (r: and py: prefixes)
# ---------------------------------------------------------------------------

resolve_data_refs <- function(query, reader, envir) {
  refs <- gregexpr(
    "(?:r|py):[a-zA-Z_][a-zA-Z0-9_.]*",
    query,
    ignore.case = TRUE,
    perl = TRUE
  )
  matches <- regmatches(query, refs)[[1]]

  if (length(matches) == 0) {
    return(query)
  }

  for (ref in unique(matches)) {
    parts <- strsplit(ref, ":", fixed = TRUE)[[1]]
    prefix <- parts[1]
    name <- parts[2]

    df <- switch(
      tolower(prefix),
      r = try_fetch(
        get(name, envir = envir),
        error = function(cnd) {
          cli::cli_abort(
            "Data reference {.code {ref}}: object {.val {name}} not found in R environment."
          )
        }
      ),
      py = {
        rlang::check_installed(
          "reticulate",
          reason = "to use py: data references."
        )
        obj <- reticulate::py[[name]]
        if (is.null(obj)) {
          cli::cli_abort(
            "Data reference {.code {ref}}: object {.val {name}} not found in Python environment."
          )
        }
        obj
      }
    )

    if (!is.data.frame(df)) {
      cli::cli_abort(
        "{.code {ref}} refers to a {.cls {class(df)}} object, not a data frame."
      )
    }

    internal_name <- paste0("__", prefix, "_", gsub(".", "_ggsqldot_", name, fixed = TRUE), "__")
    ggsql_register(reader, df, internal_name, replace = TRUE)
    query <- gsub(ref, internal_name, query, fixed = TRUE)
  }

  query
}

# ---------------------------------------------------------------------------
# Inline chunk options (--| and #| prefix support)
# ---------------------------------------------------------------------------

parse_chunk_options <- function(options) {
  code <- options$code
  if (length(code) == 0) {
    return(options)
  }

  # Extract leading lines with --| or #| prefix
  option_pattern <- "^\\s*(?:--|#)\\|\\s?"
  is_option <- grepl(option_pattern, code, perl = TRUE)

  # Only consider contiguous leading option lines
  n_options <- 0L
  for (i in seq_along(is_option)) {
    if (!is_option[i]) {
      break
    }
    n_options <- i
  }

  if (n_options == 0L) {
    return(options)
  }

  # Extract option text (strip the prefix)
  option_lines <- sub(option_pattern, "", code[seq_len(n_options)], perl = TRUE)
  options$code <- code[-seq_len(n_options)]

  # Parse as YAML
  yaml_text <- paste(option_lines, collapse = "\n")
  parsed <- tryCatch(
    yaml::yaml.load(yaml_text),
    error = function(cnd) NULL
  )

  if (is.null(parsed) || !is.list(parsed)) {
    return(options)
  }

  # Merge into options (inline options override chunk header options)
  for (nm in names(parsed)) {
    # Convert Quarto-style kebab-case to knitr-style dot-case
    knitr_nm <- gsub("-", ".", nm, fixed = TRUE)
    options[[knitr_nm]] <- parsed[[nm]]
  }

  options
}

# ---------------------------------------------------------------------------
# knitr engine
# ---------------------------------------------------------------------------

ggsql_engine <- function(options) {
  # Parse inline chunk options (--| or #| prefixed lines)
  options <- parse_chunk_options(options)

  # Use SQL syntax highlighting for the source code block.
  # ggsql-specific highlighting requires adding ggsql.xml to the Quarto/Pandoc
  # config (see inst/ggsql.xml). SQL covers the base keywords well.
  options$class.source <- options$class.source %||% "sql"

  # Always register syntax highlighting, even for custom connections
  register_syntax_highlighting()

  if (!options$eval) {
    return(knitr::engine_output(options, options$code, ""))
  }

  query <- paste(options$code, collapse = "\n")

  result <- try_fetch(
    {
      reader <- get_engine_reader(options$connection)
      ggsql_engine_eval(query, reader, options)
    },
    error = function(cnd) {
      knitr::engine_output(options, options$code, conditionMessage(cnd))
    }
  )

  result
}

ggsql_engine_eval <- function(query, reader, options) {
  query <- resolve_data_refs(query, reader, envir = knitr::knit_global())
  validated <- ggsql_validate(query)

  if (!validated$has_visual) {
    # Plain SQL: execute and render as table
    df <- ggsql_execute_sql(reader, query)

    # If output.var is set, assign to knit environment instead of rendering
    if (!is.null(options$output.var)) {
      assign(options$output.var, df, envir = knitr::knit_global())
      return(knitr::engine_output(options, options$code, ""))
    }

    # Suppress output for DDL/DML statements that return metadata rows
    # (e.g., COPY TO returns a "Count" column)
    is_result <- nrow(df) > 0 && ncol(df) > 0 && !identical(names(df), "Count")
    if (!is_result) {
      return(knitr::engine_output(options, options$code, ""))
    }
    out <- knitr::kable(df)
    options$results <- "asis"
    return(knitr::engine_output(options, options$code, out))
  }

  # Visualization query: execute and render
  spec <- ggsql_execute(reader, query)
  writer_type <- options$writer %||%
    if (knitr::is_latex_output()) "vegalite_png" else "vegalite"

  # If output.var is set, always capture the Vega-Lite JSON
  if (!is.null(options$output.var)) {
    writer <- vegalite_writer()
    json <- ggsql_render(writer, spec)
    assign(options$output.var, json, envir = knitr::knit_global())
    return(knitr::engine_output(options, options$code, ""))
  }

  options$results <- "asis"

  switch(
    writer_type,
    vegalite = {
      if (!is.null(options$fig.cap) && nzchar(options$fig.cap)) {
        cli::cli_warn(c(
          "{.code fig.cap} is not supported for interactive HTML output.",
          i = "Use {.code writer = \"vegalite_svg\"} or {.code writer = \"vegalite_png\"} for captioned figures."
        ))
      }
      writer <- vegalite_writer()
      json <- ggsql_render(writer, spec)
      widget <- ggsql_widget(json)
      out <- knitr::knit_print(widget, options = options)
      knitr::knit_meta_add(attr(out, "knit_meta"))
      knitr::engine_output(options, options$code, out = out)
    },
    vegalite_svg = render_static_figure(spec, "svg", options),
    vegalite_png = render_static_figure(spec, "png", options),
    cli::cli_abort(
      c(
        "Unsupported writer {.val {writer_type}}.",
        i = "Supported writers: {.val vegalite}, {.val vegalite_svg}, {.val vegalite_png}."
      )
    )
  )
}

write_static_figure <- function(spec, format, options) {
  options$label <- options$label %||% "ggsql-chunk"
  ext <- options$fig.ext %||% paste0(".", format)
  fig <- knitr::fig_path(ext, options)
  dir.create(dirname(fig), recursive = TRUE, showWarnings = FALSE)

  if (is.null(options$fig.dim)) {
    width <- options$fig.width * options$dpi
    height <- if (is.null(options$fig.asp)) {
      options$fig.height * options$dpi
    } else {
      width * options$fig.asp
    }
  } else {
    width <- options$fig.dim[1] * options$dpi
    height <- options$fig.dim[2] * options$dpi
  }

  switch(
    format,
    svg = writeLines(ggsql_to_svg(spec, width, height), fig),
    png = writeBin(ggsql_to_png(spec, width, height), fig)
  )

  knitr::include_graphics(fig)
}

render_static_figure <- function(spec, format, options) {
  out <- write_static_figure(spec, format, options)
  knitr::engine_output(options, options$code, knitr::sew(out, options))
}

on_load(
  knitr::knit_engines$set(ggsql = ggsql_engine)
)
