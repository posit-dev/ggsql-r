use extendr_api::prelude::*;

use arrow::ipc::reader::StreamReader;
use arrow::ipc::writer::StreamWriter;
use arrow::record_batch::RecordBatch;
use ggsql::reader::cache::{CacheConfig, CacheConfigOverride};
use ggsql::reader::{execute_with_reader, CachingReader, DuckDBReader, OdbcReader, Reader, Spec};
use ggsql::validate::validate as rust_validate;
use ggsql::writer::{
    HepWriter, PdfWriter, SvgWriter, VegaLiteWriter as RustVegaLiteWriter, Writer,
};
use ggsql::{DataFrame, GgsqlError};
use std::io::Cursor;

// ============================================================================
// IPC Conversion Helpers
// ============================================================================

fn ipc_stream_to_df(bytes: &[u8]) -> std::result::Result<DataFrame, String> {
    let reader = StreamReader::try_new(Cursor::new(bytes), None)
        .map_err(|e| format!("Failed to read Arrow IPC stream: {e}"))?;
    let mut batches: Vec<RecordBatch> = Vec::new();
    for batch in reader {
        batches.push(batch.map_err(|e| format!("Failed to read Arrow IPC stream: {e}"))?);
    }
    let rb = match batches.len() {
        0 => return Err("Arrow IPC stream contained no record batches".into()),
        1 => batches.pop().unwrap(),
        // nanoarrow on the R side emits a single batch; multi-batch streams
        // would need concat_batches and the `compute` feature on arrow.
        _ => return Err("Arrow IPC stream contained multiple record batches; expected one".into()),
    };
    Ok(DataFrame::from_record_batch(rb))
}

fn df_to_ipc_stream(df: &DataFrame) -> std::result::Result<Vec<u8>, String> {
    let rb = df.inner();
    let mut buffer = Vec::new();
    {
        let mut writer = StreamWriter::try_new(&mut buffer, &rb.schema())
            .map_err(|e| format!("Failed to write Arrow IPC stream: {e}"))?;
        writer
            .write(rb)
            .map_err(|e| format!("Failed to write Arrow IPC stream: {e}"))?;
        writer
            .finish()
            .map_err(|e| format!("Failed to write Arrow IPC stream: {e}"))?;
    }
    Ok(buffer)
}

// ============================================================================
// RCallbackReader — Reader impl that dispatches each hook into an R closure
// ============================================================================

struct RCallbackReader {
    execute_sql_fn: Robj,
    register_fn: Option<Robj>,
    unregister_fn: Option<Robj>,
}

// SAFETY: `Robj` is not `Send` because R's C API is single-threaded, but an
// `RCallbackReader` never actually crosses threads: it is created, invoked,
// and dropped entirely on the R main thread (via `.Call` into `GgsqlReader`
// methods and R's GC finalizer). The `Send` bound on `CachingReader`'s
// primary reader is therefore honored by construction.
unsafe impl Send for RCallbackReader {}

impl RCallbackReader {
    fn call_fn(fun: &Robj, args: Pairlist, hook: &str) -> std::result::Result<Robj, GgsqlError> {
        let f: Function = fun
            .clone()
            .try_into()
            .map_err(|_| GgsqlError::ReaderError(format!("{hook} hook is not an R function")))?;
        f.call(args).map_err(|e| {
            // extendr's error Display shows the failed call, not the R
            // condition message; surface the message so consumers (e.g. an
            // LLM tool loop) see the underlying "Catalog Error: ..." rather
            // than an opaque wrapper.
            let detail = R!("geterrmessage()")
                .ok()
                .and_then(|r| r.as_str().map(|s| s.trim().to_string()))
                .filter(|s| !s.is_empty())
                .unwrap_or_else(|| e.to_string());
            GgsqlError::ReaderError(format!("{hook} hook failed: {detail}"))
        })
    }
}

impl Reader for RCallbackReader {
    fn execute_sql(&self, sql: &str) -> ggsql::Result<DataFrame> {
        let out = Self::call_fn(&self.execute_sql_fn, pairlist!(sql = sql), "execute_sql")?;
        let raw: Raw = out.try_into().map_err(|_| {
            GgsqlError::ReaderError(
                "execute_sql hook must return a data.frame or raw IPC bytes".into(),
            )
        })?;
        ipc_stream_to_df(raw.as_slice()).map_err(GgsqlError::ReaderError)
    }

    fn register(&self, name: &str, df: DataFrame, replace: bool) -> ggsql::Result<()> {
        let Some(fun) = self.register_fn.as_ref() else {
            return Err(GgsqlError::ReaderError(
                "this reader does not support register".into(),
            ));
        };
        let bytes = df_to_ipc_stream(&df).map_err(GgsqlError::ReaderError)?;
        let raw = Raw::from_bytes(&bytes);
        Self::call_fn(
            fun,
            pairlist!(name = name, ipc_bytes = raw, replace = replace),
            "register",
        )?;
        Ok(())
    }

    fn unregister(&self, name: &str) -> ggsql::Result<()> {
        let Some(fun) = self.unregister_fn.as_ref() else {
            return Err(GgsqlError::ReaderError(format!(
                "this reader does not support unregistering table '{name}'"
            )));
        };
        Self::call_fn(fun, pairlist!(name = name), "unregister")?;
        Ok(())
    }

    fn execute(&self, query: &str) -> ggsql::Result<Spec> {
        execute_with_reader(self, query)
    }
}

// ============================================================================
// GgsqlReader — dispatches across ggsql::reader backends by URI scheme
// ============================================================================

enum InnerReader {
    DuckDB(DuckDBReader),
    Odbc(OdbcReader),
    Custom(RCallbackReader),
    Caching(CachingReader),
}

/// Build a native reader from a connection string, dispatching on the URI
/// scheme (same rules as `GgsqlReader::new`).
fn native_reader_from_connection(
    connection: &str,
) -> std::result::Result<Box<dyn Reader + Send>, String> {
    let scheme = connection.split("://").next().unwrap_or("").to_lowercase();
    match scheme.as_str() {
        "duckdb" => DuckDBReader::from_connection_string(connection)
            .map(|r| Box::new(r) as Box<dyn Reader + Send>)
            .map_err(|e| e.to_string()),
        "odbc" => OdbcReader::from_connection_string(connection)
            .map(|r| Box::new(r) as Box<dyn Reader + Send>)
            .map_err(|e| e.to_string()),
        "snowflake" => {
            // See the snowflake arm of `GgsqlReader::new` for why the URI is
            // rewritten to odbc:// with Driver=Snowflake.
            let params = connection.split_once("://").map(|x| x.1).unwrap_or("");
            let odbc_uri = if params.to_lowercase().contains("driver=") {
                format!("odbc://{params}")
            } else {
                format!("odbc://Driver=Snowflake;{params}")
            };
            OdbcReader::from_connection_string(&odbc_uri)
                .map(|r| Box::new(r) as Box<dyn Reader + Send>)
                .map_err(|e| e.to_string())
        }
        other => Err(format!("Unsupported connection scheme: {other}")),
    }
}

/// Merge optional per-field overrides (from R `NULL`s) onto env-derived
/// cache configuration.
fn cache_config(
    ttl_secs: Nullable<f64>,
    max_bytes: Nullable<f64>,
    enabled: Nullable<bool>,
) -> CacheConfig {
    CacheConfig::from_env().merge(CacheConfigOverride {
        ttl_secs: match ttl_secs {
            Nullable::NotNull(v) if v >= 0.0 => Some(v as u64),
            _ => None,
        },
        max_bytes: match max_bytes {
            Nullable::NotNull(v) if v >= 0.0 => Some(v as u64),
            _ => None,
        },
        enabled: match enabled {
            Nullable::NotNull(v) => Some(v),
            _ => None,
        },
    })
}

#[extendr]
pub struct GgsqlReader {
    inner: InnerReader,
}

#[extendr]
impl GgsqlReader {
    fn new(connection: &str) -> Self {
        let scheme = connection.split("://").next().unwrap_or("").to_lowercase();
        let inner = match scheme.as_str() {
            "duckdb" => InnerReader::DuckDB(
                DuckDBReader::from_connection_string(connection)
                    .expect("Failed to create DuckDB reader"),
            ),
            "odbc" => InnerReader::Odbc(
                OdbcReader::from_connection_string(connection)
                    .expect("Failed to create ODBC reader"),
            ),
            "snowflake" => {
                // Snowflake uses the OdbcReader under the hood. The reader
                // already has dedicated Snowflake handling: ConnectionName
                // resolution from ~/.snowflake/connections.toml, Posit
                // Workbench OAuth token injection, and the SnowflakeDialect
                // for schema introspection. Rewriting the URI to odbc://
                // with Driver=Snowflake triggers that path.
                let params = connection.splitn(2, "://").nth(1).unwrap_or("");
                let odbc_uri = if params.to_lowercase().contains("driver=") {
                    format!("odbc://{params}")
                } else {
                    format!("odbc://Driver=Snowflake;{params}")
                };
                InnerReader::Odbc(
                    OdbcReader::from_connection_string(&odbc_uri)
                        .expect("Failed to create Snowflake reader"),
                )
            }
            other => panic!("Unsupported connection scheme: {other}"),
        };
        Self { inner }
    }

    /// Create a caching reader wrapping a native primary (given as a
    /// connection string). Source reads hit the primary and are memoized
    /// (TTL + LRU byte budget); derived tables live in a private in-memory
    /// DuckDB cache. `NULL` config values fall back to the GGSQL_CACHE_*
    /// environment variables, then defaults.
    fn new_caching(
        connection: &str,
        ttl_secs: Nullable<f64>,
        max_bytes: Nullable<f64>,
        enabled: Nullable<bool>,
    ) -> Self {
        let cache = DuckDBReader::from_connection_string("duckdb://memory")
            .expect("Failed to create the in-memory cache backend");
        let primary = native_reader_from_connection(connection)
            .expect("Failed to create the caching reader's primary");
        Self {
            inner: InnerReader::Caching(CachingReader::with_config(
                primary,
                Box::new(cache),
                connection,
                "duckdb",
                cache_config(ttl_secs, max_bytes, enabled),
            )),
        }
    }

    /// Create a caching reader wrapping a callback (custom) primary. The URI
    /// only feeds cache-key derivation, which needs a stable-per-instance
    /// string; the cache is private to each reader, so a constant suffices.
    fn new_caching_custom(
        execute_sql: Robj,
        register: Robj,
        unregister: Robj,
        ttl_secs: Nullable<f64>,
        max_bytes: Nullable<f64>,
        enabled: Nullable<bool>,
    ) -> Self {
        let cache = DuckDBReader::from_connection_string("duckdb://memory")
            .expect("Failed to create the in-memory cache backend");
        let custom = Self::new_custom(execute_sql, register, unregister);
        let InnerReader::Custom(primary) = custom.inner else {
            unreachable!("new_custom always builds a Custom reader")
        };
        Self {
            inner: InnerReader::Caching(CachingReader::with_config(
                Box::new(primary),
                Box::new(cache),
                "r-callback",
                "duckdb",
                cache_config(ttl_secs, max_bytes, enabled),
            )),
        }
    }

    fn new_custom(execute_sql: Robj, register: Robj, unregister: Robj) -> Self {
        fn opt_fn(r: Robj, name: &str) -> Option<Robj> {
            if r.is_null() {
                None
            } else if r.is_function() {
                Some(r)
            } else {
                panic!("`{name}` must be a function or NULL");
            }
        }
        if !execute_sql.is_function() {
            panic!("`execute_sql` must be a function");
        }
        Self {
            inner: InnerReader::Custom(RCallbackReader {
                execute_sql_fn: execute_sql,
                register_fn: opt_fn(register, "register"),
                unregister_fn: opt_fn(unregister, "unregister"),
            }),
        }
    }

    fn register_ipc(&self, name: &str, ipc_bytes: Raw, replace: bool) {
        let df = ipc_stream_to_df(ipc_bytes.as_slice()).expect("Failed to deserialize IPC data");
        let result = match &self.inner {
            InnerReader::DuckDB(r) => r.register(name, df, replace),
            InnerReader::Odbc(r) => r.register(name, df, replace),
            InnerReader::Custom(r) => r.register(name, df, replace),
            InnerReader::Caching(r) => r.register(name, df, replace),
        };
        result.expect("Failed to register table");
    }

    fn unregister(&self, name: &str) {
        let result = match &self.inner {
            InnerReader::DuckDB(r) => r.unregister(name),
            InnerReader::Odbc(r) => r.unregister(name),
            InnerReader::Custom(r) => r.unregister(name),
            InnerReader::Caching(r) => r.unregister(name),
        };
        result.expect("Failed to unregister table");
    }

    fn execute_sql_ipc(&self, sql: &str) -> Robj {
        let df = match &self.inner {
            InnerReader::DuckDB(r) => r.execute_sql(sql),
            InnerReader::Odbc(r) => r.execute_sql(sql),
            InnerReader::Custom(r) => r.execute_sql(sql),
            InnerReader::Caching(r) => r.execute_sql(sql),
        }
        .expect("SQL execution failed");
        let bytes = df_to_ipc_stream(&df).expect("Failed to serialize DataFrame");
        Raw::from_bytes(&bytes).into_robj()
    }

    fn execute(&self, query: &str) -> GgsqlSpec {
        let spec = match &self.inner {
            InnerReader::DuckDB(r) => r.execute(query),
            InnerReader::Odbc(r) => r.execute(query),
            InnerReader::Custom(r) => r.execute(query),
            InnerReader::Caching(r) => r.execute(query),
        }
        .expect("Query execution failed");
        GgsqlSpec { inner: spec }
    }
}

// ============================================================================
// GgsqlSpec — wraps ggsql::reader::Spec
// ============================================================================

#[extendr]
pub struct GgsqlSpec {
    inner: Spec,
}

#[extendr]
impl GgsqlSpec {
    fn metadata_rows(&self) -> i32 {
        self.inner.metadata().rows as i32
    }

    fn metadata_columns(&self) -> Vec<String> {
        self.inner.metadata().columns.clone()
    }

    fn metadata_layer_count(&self) -> i32 {
        self.inner.metadata().layer_count as i32
    }

    fn get_sql(&self) -> &str {
        self.inner.sql()
    }

    fn get_visual(&self) -> &str {
        self.inner.visual()
    }

    fn layer_count(&self) -> i32 {
        self.inner.layer_count() as i32
    }

    fn layer_data_ipc(&self, index: i32) -> Nullable<Robj> {
        match self.inner.layer_data(index as usize) {
            Some(df) => {
                let bytes = df_to_ipc_stream(df).expect("Failed to serialize layer data");
                Nullable::NotNull(Raw::from_bytes(&bytes).into_robj())
            }
            None => Nullable::Null,
        }
    }

    fn stat_data_ipc(&self, index: i32) -> Nullable<Robj> {
        match self.inner.stat_data(index as usize) {
            Some(df) => {
                let bytes = df_to_ipc_stream(df).expect("Failed to serialize stat data");
                Nullable::NotNull(Raw::from_bytes(&bytes).into_robj())
            }
            None => Nullable::Null,
        }
    }

    fn get_layer_sql(&self, index: i32) -> Nullable<String> {
        match self.inner.layer_sql(index as usize) {
            Some(s) => Nullable::NotNull(s.to_string()),
            None => Nullable::Null,
        }
    }

    fn get_stat_sql(&self, index: i32) -> Nullable<String> {
        match self.inner.stat_sql(index as usize) {
            Some(s) => Nullable::NotNull(s.to_string()),
            None => Nullable::Null,
        }
    }

    fn warnings_json(&self) -> String {
        let warnings: Vec<serde_json::Value> = self
            .inner
            .warnings()
            .iter()
            .map(|w| {
                serde_json::json!({
                    "message": w.message,
                    "location": w.location.as_ref().map(|l| {
                        serde_json::json!({"line": l.line, "column": l.column})
                    })
                })
            })
            .collect();
        serde_json::to_string(&warnings).unwrap_or_else(|_| "[]".to_string())
    }
}

// ============================================================================
// GgsqlWriter — dispatches across ggsql::writer backends
// ============================================================================

enum InnerWriter {
    VegaLite(RustVegaLiteWriter),
    Svg(SvgWriter),
    Pdf(PdfWriter),
    Hep(HepWriter),
}

#[extendr]
pub struct GgsqlWriter {
    inner: InnerWriter,
}

fn render_result(output: Robj, warnings: Vec<String>) -> List {
    list!(output = output, warnings = warnings).into()
}

#[extendr]
impl GgsqlWriter {
    fn new_vegalite() -> Self {
        Self {
            inner: InnerWriter::VegaLite(RustVegaLiteWriter::new()),
        }
    }

    fn new_svg(width: i32, height: i32, dpi: f64) -> Self {
        Self {
            inner: InnerWriter::Svg(SvgWriter::new(
                width.max(1) as u32,
                height.max(1) as u32,
                dpi,
            )),
        }
    }

    fn new_pdf(width: i32, height: i32, dpi: f64) -> Self {
        Self {
            inner: InnerWriter::Pdf(PdfWriter::new(
                width.max(1) as u32,
                height.max(1) as u32,
                dpi,
            )),
        }
    }

    fn new_hep() -> Self {
        Self {
            inner: InnerWriter::Hep(HepWriter::default()),
        }
    }

    /// Render a spec. Returns a list with `output` (a string for vegalite/svg,
    /// raw bytes for pdf/hep) and `warnings` (a character vector).
    fn render(&self, spec: &GgsqlSpec) -> List {
        match &self.inner {
            InnerWriter::VegaLite(w) => {
                let json = w.render(&spec.inner).expect("Render failed");
                render_result(Robj::from(json), Vec::new())
            }
            InnerWriter::Svg(w) => {
                let (svg, warnings) = w.render_reporting(&spec.inner).expect("Render failed");
                render_result(Robj::from(svg), warnings)
            }
            InnerWriter::Pdf(w) => {
                let (bytes, warnings) = w.render_reporting(&spec.inner).expect("Render failed");
                render_result(Raw::from_bytes(&bytes).into_robj(), warnings)
            }
            InnerWriter::Hep(w) => {
                let (bytes, warnings) = w.render_reporting(&spec.inner).expect("Render failed");
                render_result(Raw::from_bytes(&bytes).into_robj(), warnings)
            }
        }
    }
}

// ============================================================================
// Module Functions
// ============================================================================

#[extendr]
fn ggsql_validate_impl(query: &str) -> List {
    let v = match rust_validate(query) {
        Ok(v) => v,
        Err(e) => panic!("Validation failed: {e}"),
    };

    let errors_json = serde_json::to_string(
        &v.errors()
            .iter()
            .map(|e| {
                serde_json::json!({
                    "message": e.message,
                    "line": e.location.as_ref().map(|l| l.line),
                    "column": e.location.as_ref().map(|l| l.column)
                })
            })
            .collect::<Vec<_>>(),
    )
    .unwrap_or_else(|_| "[]".to_string());

    let warnings_json = serde_json::to_string(
        &v.warnings()
            .iter()
            .map(|w| {
                serde_json::json!({
                    "message": w.message,
                    "line": w.location.as_ref().map(|l| l.line),
                    "column": w.location.as_ref().map(|l| l.column)
                })
            })
            .collect::<Vec<_>>(),
    )
    .unwrap_or_else(|_| "[]".to_string());

    list!(
        sql = v.sql().to_string(),
        visual = v.visual().to_string(),
        has_visual = v.has_visual(),
        valid = v.valid(),
        errors_json = errors_json,
        warnings_json = warnings_json
    )
}

#[extendr]
fn ggsql_version_impl() -> &'static str {
    ggsql::VERSION
}

// ============================================================================
// Module Registration
// ============================================================================

extendr_module! {
    mod ggsql;
    impl GgsqlReader;
    impl GgsqlSpec;
    impl GgsqlWriter;
    fn ggsql_validate_impl;
    fn ggsql_version_impl;
}
