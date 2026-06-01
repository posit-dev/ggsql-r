# ggsql 0.3.3

* Declare correct Rust version dependency at 1.86
* Bump ggsql dependency to 0.3.3
* Patch ggsql dependency to work with Rust 1.86 so it works on CRAN build
  machine

# ggsql 0.3.2

* The vendored Rust crate archive is no longer shipped inside the source
  tarball. It is downloaded at install time from the matching GitHub
  Release (`vendor.tar.xz`) and verified against a sidecar SHA256. Override
  with `GGSQL_VENDOR_TARBALL`, `GGSQL_VENDOR_URL`, or `NOT_CRAN`.

# ggsql 0.3.1

* Initial CRAN submission.
