import type { Argv, ArgumentsCamelCase, CommandModule } from "yargs"

/**
 * Lazy command registry.
 *
 * Every CLI command is registered with yargs using only its static metadata
 * (`command`, `describe`, `aliases`). The heavy command module is imported
 * on demand: the builder runs only for the matched command and the handler
 * only when it executes. This keeps `--version`, `--help` for other
 * commands, and every other invocation from paying the cost of all 20+
 * command modules up front.
 *
 * If you change a command's `command`/`describe`/`aliases` in its module,
 * mirror it here so routing and `--help` stay accurate.
 */

type CommandTarget = {
  builder?: (yargs: Argv) => Argv | Promise<Argv>
  handler: (...args: never[]) => unknown
}

export type LazyEntry = {
  command: string
  describe?: string | false
  aliases?: string | readonly string[]
  load: () => Promise<unknown>
}

export function lazy(entry: LazyEntry): CommandModule {  return {
    command: entry.command,
    describe: entry.describe,
    aliases: entry.aliases,
    builder: async (yargs: Argv): Promise<Argv> => {
      const target = (await entry.load()) as unknown as CommandTarget
      return (await target.builder?.(yargs)) ?? yargs
    },
    handler: async (args: ArgumentsCamelCase): Promise<void> => {
      const target = (await entry.load()) as unknown as CommandTarget
      await target.handler(args as never)
    },
  }
}

export const LAZY_COMMANDS: LazyEntry[] = [  {
    command: "acp",
    describe: "start ACP (Agent Client Protocol) server",
    load: () => import("./cmd/acp").then((mod) => mod.AcpCommand),
  },
  {
    command: "mcp",
    describe: "manage MCP (Model Context Protocol) servers",
    load: () => import("./cmd/mcp").then((mod) => mod.McpCommand),
  },
  {
    command: "$0 [project]",
    describe: "start opencode tui",
    load: () => import("./cmd/tui").then((mod) => mod.TuiThreadCommand),
  },
  {
    command: "attach <url>",
    describe: "attach to a running opencode server",
    load: () => import("./cmd/attach").then((mod) => mod.AttachCommand),
  },
  {
    command: "run [message..]",
    describe: "run opencode with a message",
    load: () => import("./cmd/run").then((mod) => mod.RunCommand),
  },
  {
    command: "generate",
    load: () => import("./cmd/generate").then((mod) => mod.GenerateCommand),
  },
  {
    command: "debug",
    describe: "debugging and troubleshooting tools",
    load: () => import("./cmd/debug").then((mod) => mod.DebugCommand),
  },
  {
    command: "console",
    describe: false,
    load: () => import("./cmd/account").then((mod) => mod.ConsoleCommand),
  },
  {
    command: "providers",
    aliases: ["auth"],
    describe: "manage AI providers and credentials",
    load: () => import("./cmd/providers").then((mod) => mod.ProvidersCommand),
  },
  {
    command: "agent",
    describe: "manage agents",
    load: () => import("./cmd/agent").then((mod) => mod.AgentCommand),
  },
  {
    command: "upgrade [target]",
    describe: "upgrade opencode to the latest or a specific version",
    load: () => import("./cmd/upgrade").then((mod) => mod.UpgradeCommand),
  },
  {
    command: "uninstall",
    describe: "uninstall opencode and remove all related files",
    load: () => import("./cmd/uninstall").then((mod) => mod.UninstallCommand),
  },
  {
    command: "serve",
    describe: "starts a headless opencode server",
    load: () => import("./cmd/serve").then((mod) => mod.ServeCommand),
  },
  {
    command: "web",
    describe: "start opencode server and open web interface",
    load: () => import("./cmd/web").then((mod) => mod.WebCommand),
  },
  {
    command: "models [provider]",
    describe: "list all available models",
    load: () => import("./cmd/models").then((mod) => mod.ModelsCommand),
  },
  {
    command: "stats",
    describe: "show token usage and cost statistics",
    load: () => import("./cmd/stats").then((mod) => mod.StatsCommand),
  },
  {
    command: "export [sessionID]",
    describe: "export session data as JSON",
    load: () => import("./cmd/export").then((mod) => mod.ExportCommand),
  },
  {
    command: "import <file>",
    describe: "import session data from JSON file or URL",
    load: () => import("./cmd/import").then((mod) => mod.ImportCommand),
  },
  {
    command: "github",
    describe: "manage GitHub agent",
    load: () => import("./cmd/github").then((mod) => mod.GithubCommand),
  },
  {
    command: "pr <number>",
    describe: "fetch and checkout a GitHub PR branch, then run opencode",
    load: () => import("./cmd/pr").then((mod) => mod.PrCommand),
  },
  {
    command: "session",
    describe: "manage sessions",
    load: () => import("./cmd/session").then((mod) => mod.SessionCommand),
  },
  {
    command: "plugin <module>",
    aliases: ["plug"],
    describe: "install plugin and update config",
    load: () => import("./cmd/plug").then((mod) => mod.PluginCommand),
  },
  {
    command: "db",
    describe: "database tools",
    load: () => import("./cmd/db").then((mod) => mod.DbCommand),
  },
]

const DEFAULT_PREFIX = "$0"

/**
 * Whether argv will be handled by the default ($0) command: no args, a
 * leading flag, or a first word that matches no known command or alias.
 * yargs does not await an async $0 builder on the top-level help path, so
 * callers use this to preload and register the default command eagerly.
 * Every other path stays fully lazy.
 */
export function wantsDefaultCommand(args: string[]): boolean {
  const first = args[0]
  if (first === undefined || first.startsWith("-")) return true
  if (first === "completion") return false
  return !LAZY_COMMANDS.some(
    (entry) =>
      !entry.command.startsWith(DEFAULT_PREFIX) &&
      (entry.command.split(" ")[0] === first || (entry.aliases ?? []).includes(first)),
  )
}

let defaultCommand: CommandModule | undefined

export async function loadDefaultCommand(): Promise<CommandModule> {
  if (!defaultCommand) {
    const entry = LAZY_COMMANDS.find((item) => item.command.startsWith(DEFAULT_PREFIX))
    if (!entry) throw new Error("Default command is not registered")
    defaultCommand = (await entry.load()) as unknown as CommandModule
  }
  return defaultCommand
}
