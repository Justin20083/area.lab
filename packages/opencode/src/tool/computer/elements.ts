import { Effect, Schema } from "effect"
import * as Tool from "../tool"
import { listElements } from "./exec"

export const Parameters = Schema.Struct({})

export const ComputerElementsTool = Tool.define(
  "computer_elements",
  Effect.gen(function* () {
    return {
      description:
        "List the interactive UI elements of the frontmost window as compact text (id, role, label, center coordinates). Use this INSTEAD of computer_screenshot when you cannot process images or want to save tokens. Act on elements with computer_click (use the element's x/y) or computer_type after clicking a text field. If the list is empty, the app may not expose accessibility info.",
      parameters: Parameters,
      execute: (_params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          yield* ctx.ask({
            permission: "computer",
            patterns: ["elements"],
            always: ["elements", "*"],
            metadata: {},
          })
          const elements = yield* Effect.promise(() => listElements()).pipe(
            Effect.catch((error: unknown) => Effect.die(new Error(error instanceof Error ? error.message : String(error)))),
          )
          if (elements.length === 0) {
            return {
              title: "No UI elements found",
              output:
                "The frontmost window exposes no accessibility elements. The app may draw a custom canvas; ask the user to switch to the vision pipeline or guide you.",
              metadata: { count: 0 },
            }
          }
          return {
            title: `${elements.length} UI elements listed`,
            output: elements.map((item) => `#${item.id} ${item.role} "${item.text}" @(${item.x},${item.y})`).join("\n"),
            metadata: { count: elements.length },
          }
        }).pipe(Effect.orDie),
    }
  }),
)
