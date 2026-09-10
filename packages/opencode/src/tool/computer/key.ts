import { Effect, Schema } from "effect"
import * as Tool from "../tool"
import { KEY_CODES, pressKey } from "./exec"

export const Parameters = Schema.Struct({
  key: Schema.String.annotate({
    description: `Key to press (${Object.keys(KEY_CODES).join(", ")})`,
  }),
  modifiers: Schema.optional(Schema.Array(Schema.String)).annotate({
    description: "Optional modifiers: command, control, option, shift",
  }),
})

export const ComputerKeyTool = Tool.define(
  "computer_key",
  Effect.gen(function* () {
    return {
      description:
        "Press a keyboard key, optionally with modifiers (e.g. command+space to open Spotlight). Use for navigation (tab, arrows, enter, escape) and shortcuts. Do not press enter on a composed message or confirm dialog without explicit user confirmation.",
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const modifiers = params.modifiers ?? []
          yield* ctx.ask({
            permission: "computer",
            patterns: [`key ${params.key}`],
            always: ["key", "*"],
            metadata: { key: params.key, modifiers },
          })
          yield* Effect.promise(() => pressKey(params.key, modifiers)).pipe(
            Effect.catch((error: unknown) => Effect.die(new Error(error instanceof Error ? error.message : String(error)))),
          )
          return {
            title: `Pressed ${params.key}`,
            output: `Pressed ${[...modifiers, params.key].join("+")}.`,
            metadata: { key: params.key, modifiers },
          }
        }).pipe(Effect.orDie),
    }
  }),
)
