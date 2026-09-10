import { Prompt, type PromptRef } from "../component/prompt"
import { createEffect, createMemo, createSignal, onMount, Show } from "solid-js"
import { TextAttributes } from "@opentui/core"
import { useSync } from "../context/sync"
import { Toast } from "../ui/toast"
import { useArgs } from "../context/args"
import { useRouteData } from "../context/route"
import { usePromptRef } from "../context/prompt"
import { useLocal } from "../context/local"
import { usePluginRuntime } from "../plugin/runtime"
import { useEditorContext } from "../context/editor"
import { useCommandShortcut } from "../keymap"
import { useTuiPaths } from "../context/runtime"
import { abbreviateHome } from "../runtime"
import { useHomeSessionDestination } from "./home/session-destination"
import { useKV } from "../context/kv"
import { useTheme } from "../context/theme"
import { InstallationVersion } from "@opencode-ai/core/installation/version"
import { TIPS } from "../feature-plugins/home/tips-view"
import { useDialog } from "../ui/dialog"
import { DialogPrompt } from "../ui/dialog-prompt"
import { DialogSelect } from "../ui/dialog-select"
import { HomeSessionDestinationProvider } from "./home/session-destination"

let once = false
const placeholder = {
  normal: ["Plan, search, build anything"],
  shell: ["ls -la", "git status", "pwd"],
}

const STRING_TIPS = TIPS.filter((tip): tip is string => typeof tip === "string")

function randomTip() {
  const tip = STRING_TIPS[Math.floor(Math.random() * STRING_TIPS.length)] ?? ""
  return tip.replace(/\{highlight\}|\{\/highlight\}/g, "")
}

function headerDate() {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}`
}

export function Home() {
  const pluginRuntime = usePluginRuntime()
  const sync = useSync()
  const route = useRouteData("home")
  const promptRef = usePromptRef()
  const [ref, setRef] = createSignal<PromptRef | undefined>()
  const args = useArgs()
  const local = useLocal()
  const editor = useEditorContext()
  const agentShortcut = useCommandShortcut("agent.cycle")
  const paletteShortcut = useCommandShortcut("command.palette.show")
  const paths = useTuiPaths()
  const destination = useHomeSessionDestination()
  const cornerDir = createMemo(() => {
    const selected = destination?.destination()
    const dir = selected && selected.type !== "new" ? selected.directory : paths.cwd
    return abbreviateHome(dir, paths.home)
  })
  const kv = useKV()
  const { theme } = useTheme()
  const dialog = useDialog()
  const [tipText] = createSignal(randomTip())
  const userName = createMemo(() => kv.get("user_name", ""))
  const greeting = createMemo(() => {
    const name = userName()
    if (!name) return ""
    return kv.get("user_language", "es") === "en" ? `Hello, ${name}.` : `Hola, ${name}.`
  })
  let sent = false

  onMount(() => {
    editor.clearSelection()
  })

  async function onboard() {
    if (kv.get("user_name")) return
    const lang = await new Promise<"es" | "en" | null>((resolve) => {
      dialog.replace(
        () => (
          <DialogSelect<string>
            title="Idioma / Language"
            options={[
              { title: "Español", value: "es" },
              { title: "English", value: "en" },
            ]}
            onSelect={(option) => {
              dialog.clear()
              resolve(option.value === "en" ? "en" : "es")
            }}
          />
        ),
        () => resolve(null),
      )
    })
    if (!lang) return
    kv.set("user_language", lang)
    const name = await DialogPrompt.show(
      dialog,
      lang === "en" ? "What is your name?" : "¿Cómo te llamas?",
      { placeholder: lang === "en" ? "Your name" : "Tu nombre" },
    )
    const trimmed = name?.trim()
    if (!trimmed) return
    kv.set("user_name", trimmed)
  }

  onMount(() => {
    void onboard()
  })

  const bind = (r: PromptRef | undefined) => {
    setRef(r)
    promptRef.set(r)
    if (once || !r) return
    if (route.prompt) {
      r.set(route.prompt)
      once = true
      return
    }
    if (!args.prompt) return
    r.set({ input: args.prompt, parts: [] })
    once = true
  }

  // Wait for sync and model store to be ready before auto-submitting --prompt
  createEffect(() => {
    const r = ref()
    if (sent) return
    if (!r) return
    if (!sync.ready || !local.model.ready) return
    if (!args.prompt) return
    if (r.current.input !== args.prompt) return
    sent = true
    r.submit()
  })

  return (
    <HomeSessionDestinationProvider>
      <box flexGrow={1} alignItems="center" paddingLeft={2} paddingRight={2}>
        <box flexGrow={1} minHeight={0} />
        <box height={4} minHeight={0} flexShrink={1} />
        <Show when={greeting()}>
          {(text) => (
            <box width="100%" flexShrink={0} paddingTop={1} paddingBottom={1}>
              <text fg={theme.textMuted} attributes={TextAttributes.BOLD}>
                {text()}
              </text>
            </box>
          )}
        </Show>
        <box width="100%" flexShrink={0} paddingBottom={1} flexDirection="column">
          <text fg={theme.text}>Area Agent</text>
          <text fg={theme.textMuted}>
            v{InstallationVersion}-{headerDate()}
          </text>
          <text fg={theme.textMuted} wrapMode="word">
            Tip: {tipText()}
          </text>
        </box>
        <box width="100%" zIndex={1000} paddingTop={1} flexShrink={0}>
          <pluginRuntime.Slot name="home_prompt" mode="replace" ref={bind}>
            <Prompt
              ref={bind}
              right={<pluginRuntime.Slot name="home_prompt_right" />}
              placeholders={placeholder}
              hideShortcuts
              hideMeta
            />
          </pluginRuntime.Slot>
        </box>
        <pluginRuntime.Slot name="home_bottom" />
        <box flexGrow={1} minHeight={0} />
        <Toast />
      </box>
      <box width="100%" flexShrink={0}>
        <pluginRuntime.Slot name="home_footer" mode="single_winner" />
      </box>
      <box
        width="100%"
        flexDirection="row"
        justifyContent="space-between"
        paddingLeft={2}
        paddingRight={2}
        paddingBottom={1}
        gap={2}
        flexShrink={0}
      >
        <box flexDirection="column" flexShrink={0}>
          <text fg={theme.textMuted}>{local.model.parsed().model}</text>
          <text fg={theme.textMuted}>{cornerDir()}</text>
        </box>
        <box flexDirection="row" gap={2} alignItems="flex-end" flexShrink={0}>
          <text fg={theme.text}>
            {agentShortcut()} <span style={{ fg: theme.textMuted }}>agents</span>
          </text>
          <text fg={theme.text}>
            {paletteShortcut()} <span style={{ fg: theme.textMuted }}>commands</span>
          </text>
        </box>
      </box>
    </HomeSessionDestinationProvider>
  )
}
