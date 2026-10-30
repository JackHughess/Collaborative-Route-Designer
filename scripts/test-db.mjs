// Runs the pgTAP files in supabase/tests against the linked project without
// Docker (`supabase test db` needs Docker for pg_prove).
//
// `supabase db query --linked` only returns the last statement's result, so each
// top-level `select <test>(...)` is rewritten to insert its TAP line into a temp
// table, and the trailing `select * from finish(); rollback;` becomes a block
// that raises the collected lines as an error. Raising aborts the transaction,
// so nothing persists.
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

const report = `
reset role;
do $report$
declare
  lines text;
begin
  select string_agg(line, E'\\n' order by n) into lines from tap_out;
  raise exception '%', E'TAP_BEGIN\\n' || lines || E'\\nTAP_END';
end
$report$;
`;

function instrument(sql) {
  return sql
    .replace(/^(begin;\s*\n)/m, `$1${setup}`)
    .replace(/select \* from finish\(\);\s*rollback;\s*$/, report)
    .replace(
      /^select (?!\* from finish)/gm,
      "insert into tap_out (line) select ",
    );
}

let failures = 0;
for (const file of files) {
  const sql = instrument(readFileSync(join(testsDir, file), "utf8"));
  const runFile = join(tmp, file);
  writeFileSync(runFile, sql);

  let output = "";
  try {
    output = execFileSync(
      "npx",
      ["supabase", "db", "query", target, "-f", runFile],
      {
        encoding: "utf8",
        shell: process.platform === "win32",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  } catch (error) {
    output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }

  // The error text arrives JSON-escaped, possibly more than once.
  const text = output.replace(/\\+n/g, "\n").replace(/\\+"/g, '"');
  const match = text.match(/TAP_BEGIN\n([\s\S]*?)\nTAP_END/);
  console.log(`# ${file}`);
  if (!match) {
    console.log(output.trim());
    failures++;
    continue;
  }
  const lines = match[1].split("\n");
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
