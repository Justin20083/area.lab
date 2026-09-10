/**
 * Computer-use mode selection.
 *
 * The user picks a *preference* (`off` | `auto` | `vision` | `text`); the
 * effective pipeline is resolved against the active model's capabilities:
 * text-only models can never use the vision pipeline, so `auto` (and even
 * an explicit `vision`) falls back to the text pipeline for them.
 */

export const MODES = ["off", "auto", "vision", "text"] as const
export type Preference = (typeof MODES)[number]

export type Effective = "off" | "vision" | "text"

export type ModelCapabilities = {
  input?: {
    image?: boolean
  }
}

export function supportsVision(capabilities?: ModelCapabilities): boolean {
  return capabilities?.input?.image ?? false
}

export function resolve(preference: Preference | undefined, vision: boolean): Effective {
  if (preference === undefined || preference === "off") return "off"
  if (preference === "vision") return vision ? "vision" : "text"
  if (preference === "text") return "text"
  return vision ? "vision" : "text"
}

export function label(preference: Preference | undefined, effective: Effective): string {
  const name = preference ?? "off"
  const title = name === "text" ? "Text only" : name[0].toUpperCase() + name.slice(1)
  if (name === "auto") return `${title} (${effective})`
  return title
}

export const NEXT: Record<Preference, Preference> = {
  off: "auto",
  auto: "vision",
  vision: "text",
  text: "off",
}
