import { describe, expect, test } from "bun:test"
import {
  buildClickScript,
  buildKeyScript,
  buildTypeScript,
  elementById,
  escapeAppleScript,
  type UIElement,
} from "@/tool/computer/exec"

describe("computer-use exec helpers", () => {
  test("escapeAppleScript neutralizes quotes and backslashes", () => {
    expect(escapeAppleScript(`say "hi" \\ bye`)).toBe(`say \\"hi\\" \\\\ bye`)
  })

  test("buildClickScript rounds coordinates", () => {
    expect(buildClickScript(10.6, 20.2)).toBe(`tell application "System Events" to click at {11, 20}`)
  })

  test("buildTypeScript wraps escaped text", () => {
    expect(buildTypeScript(`a"b`)).toBe(`tell application "System Events" to keystroke "a\\"b"`)
  })

  test("buildKeyScript maps known keys with modifiers", () => {
    expect(buildKeyScript("return", [])).toBe(`tell application "System Events" to key code 36`)
    expect(buildKeyScript("Space", ["command"])).toBe(
      `tell application "System Events" to key code 49 using {command down}`,
    )
    expect(() => buildKeyScript("f13", [])).toThrow("unknown key")
  })

  test("elementById resolves known ids only", () => {
    const elements = [{ id: 0, role: "Button", text: "OK", x: 10, y: 20, w: 80, h: 30 }] as UIElement[]
    expect(elementById(elements, 0).text).toBe("OK")
    expect(() => elementById(elements, 7)).toThrow("unknown element id 7")
  })
})
