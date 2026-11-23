// Runs the pgTAP files in supabase/tests against the linked project without
// Docker (`supabase test db` needs Docker for pg_prove).
//
// `supabase db query --linked` only returns the last statement's result, so each
// top-level `select <test>(...)` is rewritten to insert its TAP line into a temp
// table, and the trailing `select * from finish(); rollback;` becomes a block
// that raises the collected lines as an error. Raising aborts the transaction,
// so nothing persists.
//
// The API truncates error messages at about 1 KB, so each run reports one
// slice of the output (CHUNK characters from a given offset) and the file is
// re-run for the next slice until all of it has been read.
//
// Usage: npm run test:db            (linked project)
//        npm run test:db -- --local (local stack, needs Docker)
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const target = process.argv.includes("--local") ? "--local" : "--linked";
const testsDir = "supabase/tests";
const files = readdirSync(testsDir).filter((f) => f.endsWith(".test.sql"));
const tmp = mkdtempSync(join(tmpdir(), "rls-"));

const setup = `
create temp table tap_out (n serial, line text);
grant insert, select on tap_out to public;
grant usage on sequence tap_out_n_seq to public;
`;

const CHUNK = 700;

// Raises "TAP_BEGIN <next offset> <total length>\n<lines>\nTAP_END" with the
// whole lines that fit in [start, start + CHUNK). A single line longer than
// CHUNK is sent cut short so the runner always makes progress.
const report = (start) => `
reset role;
do $report$
declare
  chunk text;
  next_start int;
  total int;
begin
  select coalesce(sum(length(line) + 1), 0) into total from tap_out;

  select string_agg(line, E'\\n' order by n), max(off + length(line) + 1)
    into chunk, next_start
  from (
    select n, line, sum(length(line) + 1) over (order by n) - length(line) - 1 as off
    from tap_out
  ) l
  where off >= ${start} and off + length(line) + 1 <= ${start + CHUNK};

  if chunk is null and ${start} < total then
    select left(line, ${CHUNK - 40}) || ' [line cut short]', off + length(line) + 1
      into chunk, next_start
    from (
      select n, line, sum(length(line) + 1) over (order by n) - length(line) - 1 as off
      from tap_out
    ) l
    where off >= ${start}
    order by n
    limit 1;
  end if;

  raise exception '%', 'TAP_BEGIN ' || coalesce(next_start, total) || ' ' || total
    || E'\\n' || coalesce(chunk, '') || E'\\nTAP_END';
end
$report$;
`;

function instrument(sql, start) {
  return sql
    .replace(/^(begin;\s*\n)/m, `$1${setup}`)
    .replace(/select \* from finish\(\);\s*rollback;\s*$/, () => report(start))
    .replace(
      /^select (?!\* from finish)/gm,
      "insert into tap_out (line) select ",
    );
}

function runQuery(file) {
  try {
    return execFileSync(
      "npx",
      ["supabase", "db", "query", target, "-f", file],
      {
        encoding: "utf8",
        shell: process.platform === "win32",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  } catch (error) {
    return `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }
}

/** Run a test file as many times as needed to read all of its TAP output. */
function runTests(source, runFile) {
  let start = 0;
  const chunks = [];
  for (let run = 0; run < 100; run++) {
    writeFileSync(runFile, instrument(source, start));
    const output = runQuery(runFile);
    // The error text arrives JSON-escaped, possibly more than once.
    const text = output.replace(/\\+n/g, "\n").replace(/\\+"/g, '"');
    const match = text.match(/TAP_BEGIN (\d+) (\d+)\n([\s\S]*?)\nTAP_END/);
    if (!match) return { error: output.trim() };
    const [, next, total, chunk] = match;
    if (chunk) chunks.push(chunk);
    if (Number(next) >= Number(total) || Number(next) <= start) break;
    start = Number(next);
  }
  return { lines: chunks.join("\n").split("\n") };
}

let failures = 0;
for (const file of files) {
  const source = readFileSync(join(testsDir, file), "utf8");
  const { lines, error } = runTests(source, join(tmp, file));
  console.log(`# ${file}`);
  if (!lines) {
    console.log(error);
    failures++;
    continue;
  }
  console.log(lines.join("\n"));
  const planned = Number(lines[0].match(/^1\.\.(\d+)/)?.[1] ?? NaN);
  const results = lines.filter((l) => /^(not )?ok \d+/.test(l));
  const failed = results.filter((l) => l.startsWith("not ok")).length;
  if (failed > 0 || results.length !== planned) {
    console.log(
      `# FAILED: ${failed} failing, ran ${results.length} of ${planned} planned`,
    );
    failures++;
  } else {
    console.log(`# all ${planned} passed`);
  }
}

rmSync(tmp, { recursive: true, force: true });
process.exit(failures ? 1 : 0);
