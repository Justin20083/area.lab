/**
 * Physical computer-use executors (macOS built-ins only, no extra deps).
 *
 * - Screen capture: `screencapture` (+ `sips` downscale, keeps token cost low).
 * - Mouse/keyboard: `osascript` driving System Events (real cursor movement).
 * - UI elements (text-only pipeline): `osascript -l JavaScript` walking the
 *   Accessibility tree of the frontmost app. The screenshot is never sent to
 *   the model in this pipeline — only the extracted element list.
 *
 * Everything here throws plain Errors; tool wrappers translate them.
 */

import { $ } from "bun"
import { unlink } from "node:fs/promises"
import os from "os"
import path from "path"

export const SCREENSHOT_WIDTH = 1280
export const MAX_ELEMENTS = 200

export function assertMac(feature: string): void {
  if (process.platform !== "darwin") {
    throw new Error(`computer use ${feature} is only supported on macOS for now (current: ${process.platform})`)
  }
}

async function run(command: string[]): Promise<string> {
  try {
    return await $`${command}`.quiet().text()
  } catch (error) {
    const detail = error instanceof Error ? error.message.split("\n").slice(0, 3).join(" ") : String(error)
    throw new Error(`computer use command failed (${command[0]}): ${detail}`)
  }
}

export async function takeScreenshot(maxWidth = SCREENSHOT_WIDTH): Promise<{ base64: string; mime: string }> {
  assertMac("screenshots")
  const file = path.join(os.tmpdir(), `area-computer-${Date.now()}-${Math.floor(Math.random() * 1e6)}.jpg`)
  try {
    await run(["screencapture", "-x", "-t", "jpg", "-m", file])
    try {
      await run(["sips", "-Z", String(maxWidth), file])
    } catch {
      // Downscale is a cost optimization; a full-size capture still works.
    }
    const bytes = await Bun.file(file).bytes()
    return { base64: Buffer.from(bytes).toString("base64"), mime: "image/jpeg" }
  } finally {
    await unlink(file).catch(() => {})
  }
}

export function escapeAppleScript(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

export function buildClickScript(x: number, y: number): string {
  return `tell application "System Events" to click at {${Math.round(x)}, ${Math.round(y)}}`
}

export async function clickAt(x: number, y: number): Promise<void> {
  assertMac("mouse control")
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`computer use click needs finite coordinates`)
  await run(["osascript", "-e", buildClickScript(x, y)])
}

export function buildTypeScript(text: string): string {
  return `tell application "System Events" to keystroke "${escapeAppleScript(text)}"`
}

export async function typeText(text: string): Promise<void> {
  assertMac("keyboard control")
  if (!text) throw new Error(`computer use type needs non-empty text`)
  // Type in chunks so very long strings don't blow up one osascript call.
  for (let i = 0; i < text.length; i += 500) {
    await run(["osascript", "-e", buildTypeScript(text.slice(i, i + 500))])
  }
}

export const KEY_CODES: Record<string, number> = {
  return: 36,
  enter: 36,
  tab: 48,
  space: 49,
  delete: 51,
  escape: 53,
  esc: 53,
  left: 123,
  right: 124,
  down: 125,
  up: 126,
}

export function buildKeyScript(key: string, modifiers: readonly string[]): string {
  const code = KEY_CODES[key.toLowerCase()]
  if (code === undefined) {
    throw new Error(`computer use unknown key "${key}" (known: ${Object.keys(KEY_CODES).join(", ")})`)
  }
  const held = modifiers
    .map((mod) => mod.toLowerCase())
    .filter((mod) => ["command", "control", "option", "shift"].includes(mod))
    .map((mod) => `${mod} down`)
  const using = held.length > 0 ? ` using {${held.join(", ")}}` : ""
  return `tell application "System Events" to key code ${code}${using}`
}

export async function pressKey(key: string, modifiers: readonly string[]): Promise<void> {
  assertMac("keyboard control")
  await run(["osascript", "-e", buildKeyScript(key, modifiers)])
}

export type UIElement = {
  id: number
  role: string
  text: string
  x: number
  y: number
  w: number
  h: number
}

const ELEMENTS_SCRIPT = `
(() => {
  const MAX = ${MAX_ELEMENTS};
  const out = [];
  const se = Application("System Events");
  se.includeStandardAdditions = true;
  const procs = se.applicationProcesses.whose({ frontmost: true })();
  if (!procs || procs.length === 0) return JSON.stringify([]);
  const ROLES = ["AXButton", "AXTextField", "AXTextArea", "AXCheckBox", "AXRadioButton",
    "AXPopUpButton", "AXMenuButton", "AXLink", "AXRow", "AXCell", "AXMenuItem",
    "AXStaticText", "AXHeading", "AXTabGroup", "AXSlider"];
  function textOf(el) {
    try {
      const t = el.title();
      if (t) return String(t);
    } catch (e) {}
    try {
      const d = el.description();
      if (d) return String(d);
    } catch (e) {}
    try {
      const v = el.value();
      if (typeof v === "string" && v) return v.slice(0, 120);
    } catch (e) {}
    return "";
  }
  function push(el) {
    if (out.length >= MAX) return;
    let role = "";
    try { role = String(el.role()); } catch (e) { return; }
    if (ROLES.indexOf(role) === -1) return;
    let pos, size;
    try { pos = el.position(); size = el.size(); } catch (e) { return; }
    if (!pos || !size || size[0] <= 0 || size[1] <= 0) return;
    out.push({
      id: out.length,
      role: role.replace(/^AX/, ""),
      text: textOf(el).slice(0, 120),
      x: Math.round(pos[0] + size[0] / 2),
      y: Math.round(pos[1] + size[1] / 2),
      w: Math.round(size[0]),
      h: Math.round(size[1]),
    });
  }
  function walk(el, depth) {
    if (out.length >= MAX || depth > 8) return;
    push(el);
    if (out.length >= MAX) return;
    let kids = [];
    try { kids = el.uiElements(); } catch (e) { return; }
    for (const kid of kids) {
      walk(kid, depth + 1);
      if (out.length >= MAX) return;
    }
  }
  try {
    const wins = procs[0].windows();
    for (const w of wins) walk(w, 0);
  } catch (e) {}
  return JSON.stringify(out);
})()
`

export async function listElements(): Promise<UIElement[]> {
  assertMac("accessibility tree")
  const raw = await run(["osascript", "-l", "JavaScript", "-e", ELEMENTS_SCRIPT])
  const parsed: unknown = JSON.parse(raw.trim())
  if (!Array.isArray(parsed)) throw new Error(`computer use elements returned unexpected output`)
  return parsed.filter(
    (item): item is UIElement =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as UIElement).x === "number" &&
      typeof (item as UIElement).y === "number",
  )
}

export function elementById(elements: UIElement[], id: number): UIElement {
  const found = elements.find((item) => item.id === id)
  if (!found) throw new Error(`computer use unknown element id ${id} (0-${elements.length - 1} available)`)
  return found
}
