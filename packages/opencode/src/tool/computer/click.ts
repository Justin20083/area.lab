import { Effect, Schema } from "effect"
import * as Tool from "../tool"
import { clickAt } from "./exec"

export const Parameters = Schema.Struct({
  x: Schema.Number.annotate({ description: "Horizontal screen coordinate to click" }),
  y: Schema.Number.annotate({ description: "Vertical screen coordinate to click" }),
})

export const ComputerClickTool = Tool.define(
  "computer_click",
  Effect.gen(function* () {
    return {
      description:
        "Click the real mouse cursor at screen coordinates (x, y). The cursor visibly moves. Prefer clicking elements listed by computer_elements (use their x/y). Never click destructive targets (send, pay, delete, sudo prompts) without explicit user confirmation first.",
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          yield* ctx.ask({
            permission: "computer",
            patterns: [`click ${params.x},${params.y}`],
            always: ["click", "*"],
            metadata: { x: params.x, y: params.y },
          })
          yield* Effect.promise(() => clickAt(params.x, params.y)).pipe(
            Effect.catch((error: unknown) => Effect.die(new Error(error instanceof Error ? error.message : String(error)))),
          )
          return {
            title: `Clicked (${Math.round(params.x)}, ${Math.round(params.y)})`,
            output: `Clicked at (${Math.round(params.x)}, ${Math.round(params.y)}). Re-check the screen (computer_screenshot or computer_elements) to confirm the result before the next step.`,
            metadata: { x: Math.round(params.x), y: Math.round(params.y) },
          }
        }).pipe(Effect.orDie),
    }
  }),
)
