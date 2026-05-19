First release. This is a package that binds to a rather big Rust library so
expect built time to be longer than usual. I do hope we can get it on CRAN
though.

Per the previous review's request, the vendored Rust crate archive
(`vendor.tar.xz`, ~43 MB) is no longer bundled in the source tarball. It is
hosted as a per-version GitHub Release asset at

    https://github.com/posit-dev/ggsql-r/releases/download/v<VERSION>/vendor.tar.xz

and downloaded at `configure` time by `tools/vendor.R` into the session
tempdir. Integrity is verified against a sidecar `vendor.tar.xz.sha256`
published alongside the archive on the same Release. Each released package
version keys its own immutable archive URL, so older releases remain
installable indefinitely. Nothing is written outside the package source
tree or the session tempdir.

Override environment variables are documented in `tools/vendor.R`:
`GGSQL_VENDOR_TARBALL` (local path), `GGSQL_VENDOR_URL` (mirror), and
`NOT_CRAN` (skip fetch entirely and let cargo go online).

This follows the same configure-time download pattern used by `arrow`,
`polars`, and `V8`.
