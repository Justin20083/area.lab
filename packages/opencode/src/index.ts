import { hideBin } from "yargs/helpers"
import { InstallationVersion } from "@opencode-ai/core/installation/version"
import { EOL } from "os"

const args = hideBin(process.argv)

// Fast path: --version alone never needs yargs, effect, or any command
// module. Everything heavy is imported dynamically below this check.
if (args.length === 1 && (args[0] === "--version" || args[0] === "-v")) {
  console.log(InstallationVersion)
  process.exit(0)
}

const [{ default: yargs }, { UI }, { FormatError }, { errorMessage }, { Heap }, commands] = await Promise.all([
  import("yargs"),
  import("./cli/ui"),
  import("./cli/error"),
  import("./util/error"),
  import("./cli/heap"),
  import("./cli/commands"),
])
const { LAZY_COMMANDS, lazy, loadDefaultCommand, wantsDefaultCommand } = commands

function show(out: string) {
  const text = out.trimStart()
  if (!text.startsWith("opencode ")) {
    // The logo is branding for humans; keep piped output parseable.
    if (process.stderr.isTTY) process.stderr.write(UI.logo() + EOL + EOL)
    process.stderr.write(text + EOL)
    return
  }
  process.stderr.write(out)
}

const cli = yargs(args)
  .parserConfiguration({ "populate--": true })
  .scriptName("opencode")
  .wrap(100)
  .help("help", "show help")
  .alias("help", "h")
  .version("version", "show version number", InstallationVersion)
  .alias("version", "v")
  .option("print-logs", {
    describe: "print logs to stderr",
    type: "boolean",
  })
  .option("log-level", {
    describe: "log level",
    type: "string",
    choices: ["DEBUG", "INFO", "WARN", "ERROR"],
  })
  .option("pure", {
    describe: "run without external plugins",
    type: "boolean",
  })
  .middleware(async (opts) => {
    if (opts.printLogs) process.env.OPENCODE_PRINT_LOGS = "1"
    if (opts.logLevel) process.env.OPENCODE_LOG_LEVEL = opts.logLevel
    if (opts.pure) {
      process.env.OPENCODE_PURE = "1"
    }

    Heap.start()

    process.env.AGENT = "1"
    process.env.OPENCODE = "1"
    process.env.OPENCODE_PID = String(process.pid)
  })
  .usage("")
  .completion("completion", "generate shell completion script")

for (const entry of LAZY_COMMANDS) {
  // The default ($0) command: yargs does not await an async $0 builder on
  // the top-level help path, so preload and register it eagerly only when it
  // will actually handle this invocation. Everything else stays lazy.
  if (entry.command.startsWith("$0") && wantsDefaultCommand(args)) {
    cli.command(await loadDefaultCommand())
  } else {
    cli.command(lazy(entry))
  }
}

cli
  .fail((msg, err) => {
    if (
      msg?.startsWith("Unknown argument") ||
      msg?.startsWith("Not enough non-option arguments") ||
      msg?.startsWith("Invalid values:")
    ) {
      if (err) throw err
      cli.showHelp(show)
    }
    if (err) throw err
    process.exit(1)
  })
  .strict()

try {
  if (args.includes("-h") || args.includes("--help")) {
    // yargs renders help to stdout natively (keeps pipes parseable);
    // the logo stays on stderr for humans only.
    if (process.stderr.isTTY) process.stderr.write(UI.logo() + EOL + EOL)
  }
  await cli.parse()
} catch (e) {
  const formatted = FormatError(e)
  if (formatted) UI.error(formatted)
  if (formatted === undefined) {
    UI.error("Unexpected error" + EOL)
    process.stderr.write(errorMessage(e) + EOL)
  }
  process.exitCode = 1
} finally {
  // Some subprocesses don't react properly to SIGTERM and similar signals.
  // Most notably, some docker-container-based MCP servers don't handle such signals unless
  // run using `docker run --init`.
  // Explicitly exit to avoid any hanging subprocesses.
  process.exit()
}
