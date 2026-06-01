# Changelog

## ggsql 0.3.2

CRAN release: 2026-05-27

- The vendored Rust crate archive is no longer shipped inside the source
  tarball. It is downloaded at install time from the matching GitHub
  Release (`vendor.tar.xz`) and verified against a sidecar SHA256.
  Override with `GGSQL_VENDOR_TARBALL`, `GGSQL_VENDOR_URL`, or
  `NOT_CRAN`.

## ggsql 0.3.1

- Initial CRAN submission.
