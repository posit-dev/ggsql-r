# Acquire the vendored Rust crate archive before cargo runs.
#
# The 43 MB `vendor.tar.xz` is not shipped in the source tarball (CRAN ask);
# instead it is hosted per-version as a GitHub Release asset and downloaded
# here. After this script runs, `src/rust/vendor.tar.xz` exists and the
# existing Makevars logic extracts it for an `--offline` cargo build.
#
# Decision tree:
#   1. `GGSQL_VENDOR_TARBALL` env var set -> use that local path.
#   2. `src/rust/vendor/` already extracted -> nothing to do.
#   3. `src/rust/vendor.tar.xz` already present (local dev, or cached from a
#      previous configure run) -> nothing to do.
#   4. `NOT_CRAN` set -> skip fetch; cargo will fetch crates online.
#   5. Otherwise download from the version-keyed GitHub Release, verifying
#      against the sidecar `vendor.tar.xz.sha256` published next to it.
#
# Env vars:
#   GGSQL_VENDOR_TARBALL  Path to a local archive (bypasses download).
#   GGSQL_VENDOR_URL      Override the primary archive URL.
#   NOT_CRAN              If non-empty, skip vendor fetch entirely.

local({
  pkg_root <- getwd()
  vendor_xz <- file.path(pkg_root, "src", "rust", "vendor.tar.xz")
  vendor_dir <- file.path(pkg_root, "src", "rust", "vendor")

  desc <- read.dcf(file.path(pkg_root, "DESCRIPTION"))
  pkg_version <- unname(desc[, "Version"])
  pkg_name <- unname(desc[, "Package"])

  sha256 <- function(path) {
    unname(tools::sha256sum(path))
  }

  copy <- function(src, dest) {
    if (!file.copy(src, dest, overwrite = TRUE)) {
      stop(sprintf("Failed to copy '%s' to '%s'.", src, dest), call. = FALSE)
    }
  }

  # 1. Explicit local-path override.
  override <- Sys.getenv("GGSQL_VENDOR_TARBALL")
  if (nzchar(override)) {
    if (!file.exists(override)) {
      stop(
        "GGSQL_VENDOR_TARBALL points at '", override, "' which does not exist.",
        call. = FALSE
      )
    }
    message("Using vendor archive from GGSQL_VENDOR_TARBALL: ", override)
    copy(override, vendor_xz)
    return(invisible())
  }

  # 2. Already-extracted vendor directory.
  if (dir.exists(vendor_dir)) {
    message("Vendor directory already extracted at src/rust/vendor; skipping fetch.")
    return(invisible())
  }

  # 3. Archive already present (local dev with rextendr::vendor_pkgs(), or
  # leftover from a previous configure run in the same source tree).
  if (file.exists(vendor_xz)) {
    message("Vendor archive already at src/rust/vendor.tar.xz; skipping fetch.")
    return(invisible())
  }

  # 4. NOT_CRAN: skip vendor fetch and let cargo go online.
  if (nzchar(Sys.getenv("NOT_CRAN"))) {
    message(
      "NOT_CRAN is set; skipping vendor archive fetch. ",
      "cargo will fetch crates from the network."
    )
    return(invisible())
  }

  # 5. Download from GitHub Release.
  default_base <- sprintf(
    "https://github.com/posit-dev/ggsql-r/releases/download/v%s",
    pkg_version
  )
  base_url <- Sys.getenv("GGSQL_VENDOR_URL", unset = default_base)
  archive_url <- paste0(base_url, "/vendor.tar.xz")
  sha_url <- paste0(base_url, "/vendor.tar.xz.sha256")

  cache_dir <- tools::R_user_dir(pkg_name, which = "cache")
  dir.create(cache_dir, showWarnings = FALSE, recursive = TRUE)
  cache_file <- file.path(
    cache_dir,
    sprintf("vendor-%s.tar.xz", pkg_version)
  )

  download <- function(url, dest) {
    status <- tryCatch(
      utils::download.file(url, dest, mode = "wb", quiet = FALSE),
      error = function(e) {
        unlink(dest)
        stop(
          "Failed to download vendor archive from\n  ", url,
          "\nReason: ", conditionMessage(e),
          "\n\nTo bypass network fetch, set one of:\n",
          "  GGSQL_VENDOR_TARBALL=/path/to/vendor.tar.xz   (use a local archive)\n",
          "  GGSQL_VENDOR_URL=https://example/v", pkg_version, " (override URL)\n",
          "  NOT_CRAN=true                                  (skip fetch, build online)",
          call. = FALSE
        )
      }
    )
    if (!identical(status, 0L) || !file.exists(dest) || file.size(dest) == 0L) {
      unlink(dest)
      stop(
        "Download from\n  ", url,
        "\nreturned no usable file.",
        call. = FALSE
      )
    }
  }

  sha_tmp <- tempfile(fileext = ".sha256")
  on.exit(unlink(sha_tmp), add = TRUE)
  download(sha_url, sha_tmp)
  expected_sha <- sub("\\s.*$", "", readLines(sha_tmp, warn = FALSE)[[1]])
  if (!grepl("^[0-9a-fA-F]{64}$", expected_sha)) {
    stop(
      "Sidecar checksum at\n  ", sha_url,
      "\nis not a valid 64-character hex sha256.",
      call. = FALSE
    )
  }

  if (file.exists(cache_file) && identical(sha256(cache_file), expected_sha)) {
    message("Reusing cached vendor archive at ", cache_file)
    copy(cache_file, vendor_xz)
    return(invisible())
  }

  message("Downloading vendor archive from ", archive_url)
  tmp <- tempfile(fileext = ".tar.xz")
  on.exit(unlink(tmp), add = TRUE)
  download(archive_url, tmp)

  got_sha <- sha256(tmp)
  if (!identical(got_sha, expected_sha)) {
    unlink(cache_file)
    stop(
      "SHA256 mismatch for vendor archive downloaded from\n  ", archive_url,
      "\nExpected: ", expected_sha,
      "\nGot:      ", got_sha,
      call. = FALSE
    )
  }

  if (!file.rename(tmp, cache_file)) {
    copy(tmp, cache_file)
  }
  copy(cache_file, vendor_xz)
  message("Vendor archive placed at ", vendor_xz, " (", file.size(vendor_xz), " bytes)")
})
