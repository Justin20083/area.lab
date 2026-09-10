import { useTheme } from "../context/theme"

export function Logo() {
  const { theme } = useTheme()

  return (
    <box>
      <text fg={theme.text}>area.lab</text>
    </box>
  )
}
