import { Effect, Schema } from "effect"
import * as Tool from "../tool"
import { typeText } from "./exec"

export const Parameters = Schema.Struct({
  text: Schema.String.annotate({ description: "Text to type into the focused field, typed visibly" }),
})

export const ComputerTypeTool = Tool.define(
  "computer_type",
  Effect.gen(function* () {
    return {
      description:
        "Type text with the real keyboard into whatever is focused. Make sure a text field is focused first (click it with computer_click). Types at human speed so the user can follow along. Never type passwords, card numbers or other secrets without explicit user confirmation.",
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          yield* ctx.ask({
            permission: "computer",
            patterns: ["type"],
            always: ["type", "*"],
            metadata: { length: params.text.length },
          })
          yield* Effect.promise(() => typeText(params.text)).pipe(
            Effect.catch((error: unknown) => Effect.die(new Error(error instanceof Error ? error.message : String(error)))),
          )
          return {
            title: `Typed ${params.text.length} characters`,
            output: `Typed ${params.text.length} characters. Verify the result on screen before continuing.`,
            metadata: { length: params.text.length },
          }
        }).pipe(Effect.orDie),
    }
  }),
)
