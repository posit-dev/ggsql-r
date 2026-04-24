use extendr_api::prelude::*;

use ggsql::reader::{DuckDBReader, OdbcReader, Reader, Spec};
use ggsql::validate::validate as rust_validate;
use ggsql::writer::{VegaLiteWriter as RustVegaLiteWriter, Writer};
use polars::prelude::{DataFrame, IpcStreamReader, IpcStreamWriter, SerReader, SerWriter};
use std::io::Cursor;

// ============================================================================
// IPC Conversion Helpers
// ============================================================================

fn ipc_stream_to_polars(bytes: &[u8]) -> std::result::Result<DataFrame, String> {
    let cursor = Cursor::new(bytes);
    IpcStreamReader::new(cursor)
        .finish()
        .map_err(|e| format!("Failed to read Arrow IPC stream: {e}"))
}

fn polars_to_ipc_stream(df: &DataFrame) -> std::result::Result<Vec<u8>, String> {
    let mut buffer = Vec::new();
    IpcStreamWriter::new(&mut buffer)
        .finish(&mut df.clone())
        .map_err(|e| format!("Failed to write Arrow IPC stream: {e}"))?;
    Ok(buffer)
}

// ============================================================================
// GgsqlReader — dispatches across ggsql::reader backends by URI scheme
// ============================================================================

enum InnerReader {
    DuckDB(DuckDBReader),
    Odbc(OdbcReader),
}

#[extendr]
pub struct GgsqlReader {
    inner: InnerReader,
}

#[extendr]
impl GgsqlReader {
    fn new(connection: &str) -> Self {
        let scheme = connection
            .split("://")
            .next()
            .unwrap_or("")
            .to_lowercase();
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
                let odbc_uri = if params
                    .to_lowercase()
                    .contains("driver=")
                {
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

    fn register_ipc(&self, name: &str, ipc_bytes: Raw, replace: bool) {
        let df =
            ipc_stream_to_polars(ipc_bytes.as_slice()).expect("Failed to deserialize IPC data");
        let result = match &self.inner {
            InnerReader::DuckDB(r) => r.register(name, df, replace),
            InnerReader::Odbc(r) => r.register(name, df, replace),
        };
        result.expect("Failed to register table");
    }

    fn unregister(&self, name: &str) {
        let result = match &self.inner {
            InnerReader::DuckDB(r) => r.unregister(name),
            InnerReader::Odbc(r) => r.unregister(name),
        };
        result.expect("Failed to unregister table");
    }

    fn execute_sql_ipc(&self, sql: &str) -> Robj {
        let df = match &self.inner {
            InnerReader::DuckDB(r) => r.execute_sql(sql),
            InnerReader::Odbc(r) => r.execute_sql(sql),
        }
        .expect("SQL execution failed");
        let bytes = polars_to_ipc_stream(&df).expect("Failed to serialize DataFrame");
        Raw::from_bytes(&bytes).into_robj()
    }

    fn execute(&self, query: &str) -> GgsqlSpec {
        let spec = match &self.inner {
            InnerReader::DuckDB(r) => r.execute(query),
            InnerReader::Odbc(r) => r.execute(query),
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
                let bytes = polars_to_ipc_stream(df).expect("Failed to serialize layer data");
                Nullable::NotNull(Raw::from_bytes(&bytes).into_robj())
            }
            None => Nullable::Null,
        }
    }

    fn stat_data_ipc(&self, index: i32) -> Nullable<Robj> {
        match self.inner.stat_data(index as usize) {
            Some(df) => {
                let bytes = polars_to_ipc_stream(df).expect("Failed to serialize stat data");
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
// GgsqlWriter — wraps ggsql::writer::VegaLiteWriter
// ============================================================================

#[extendr]
pub struct GgsqlWriter {
    inner: RustVegaLiteWriter,
}

#[extendr]
impl GgsqlWriter {
    fn new() -> Self {
        Self {
            inner: RustVegaLiteWriter::new(),
        }
    }

    fn render(&self, spec: &GgsqlSpec) -> String {
        self.inner
            .render(&spec.inner)
            .expect("Render failed")
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
