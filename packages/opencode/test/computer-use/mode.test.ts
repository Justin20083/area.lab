import { describe, expect, test } from "bun:test"
import { label, NEXT, resolve, supportsVision } from "@/computer-use/mode"

describe("computer-use mode", () => {
  test("supportsVision reads the image input capability", () => {
    expect(supportsVision(undefined)).toBe(false)
    expect(supportsVision({})).toBe(false)
    expect(supportsVision({ input: {} })).toBe(false)
    expect(supportsVision({ input: { image: true } })).toBe(true)
    expect(supportsVision({ input: { image: false } })).toBe(false)
  })

  test("resolve maps preference plus model capability to a pipeline", () => {
    expect(resolve(undefined, true)).toBe("off")
    expect(resolve("off", true)).toBe("off")
    expect(resolve("off", false)).toBe("off")
    expect(resolve("auto", true)).toBe("vision")
    expect(resolve("auto", false)).toBe("text")
    expect(resolve("vision", true)).toBe("vision")
    expect(resolve("vision", false)).toBe("text")
    expect(resolve("text", true)).toBe("text")
    expect(resolve("text", false)).toBe("text")
  })

  test("NEXT cycles through every preference", () => {
    expect([NEXT.off, NEXT.auto, NEXT.vision, NEXT.text]).toEqual(["auto", "vision", "text", "off"])
  })

  test("label describes the effective pipeline for auto", () => {
    expect(label("auto", "vision")).toBe("Auto (vision)")
    expect(label("auto", "text")).toBe("Auto (text)")
    expect(label("off", "off")).toBe("Off")
    expect(label("vision", "vision")).toBe("Vision")
    expect(label("text", "text")).toBe("Text only")
  })
})
