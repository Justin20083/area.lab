import { Effect, Schema } from "effect"
import * as Tool from "../tool"
import { takeScreenshot } from "./exec"

export const Parameters = Schema.Struct({})

export const ComputerScreenshotTool = Tool.define(
  "computer_screenshot",
  Effect.gen(function* () {
    return {
      description:
        "Capture the current screen as an image. Use this only when you can process images and need to locate something visually. Each capture costs significant tokens: reuse what you see, crop your attention to the relevant region, and prefer computer_elements when an app exposes proper labels.",
      parameters: Parameters,
      execute: (_params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          yield* ctx.ask({
            permission: "computer",
            patterns: ["screenshot"],
            always: ["screenshot", "*"],
            metadata: {},
          })
          const shot = yield* Effect.promise(() => takeScreenshot()).pipe(
            Effect.catch((error: unknown) => Effect.die(new Error(error instanceof Error ? error.message : String(error)))),
          )
          return {
            title: "Screenshot captured",
            output: `Screenshot captured (${shot.mime}, downscaled for token efficiency). Describe what you see, then act with computer_click, computer_type or computer_key.`,
            metadata: { mime: shot.mime },
            attachments: [
              {
                type: "file" as const,
                mime: shot.mime,
                filename: "screenshot.jpg",
                url: `data:${shot.mime};base64,${shot.base64}`,
              },
            ],
          }
        }).pipe(Effect.orDie),
    }
  }),
)
