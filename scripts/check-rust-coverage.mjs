import fs from "node:fs";

const COVERAGE_PATH = "coverage/rust-coverage.json";
const MINIMUM_RUST_LINE_COVERAGE = 75.0;

const rustCoverage = JSON.parse(fs.readFileSync(COVERAGE_PATH, "utf8"));
const totals =
  (rustCoverage.data && rustCoverage.data[0] && rustCoverage.data[0].totals) ||
  rustCoverage.totals;

if (!totals || !totals.lines || typeof totals.lines.percent !== "number") {
  console.error(`[coverage] Could not read Rust line coverage from ${COVERAGE_PATH}`);
  process.exit(1);
}

const rustLineCoverage = totals.lines.percent;

if (rustLineCoverage < MINIMUM_RUST_LINE_COVERAGE) {
  console.error(
    `[coverage] Rust line coverage ${rustLineCoverage.toFixed(2)}% is below the enforced minimum of ${MINIMUM_RUST_LINE_COVERAGE.toFixed(2)}%`
  );
  process.exit(1);
}

console.log(
  `[coverage] Rust line coverage ${rustLineCoverage.toFixed(2)}% meets the enforced minimum of ${MINIMUM_RUST_LINE_COVERAGE.toFixed(2)}%`
);
