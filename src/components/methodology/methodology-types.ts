/** One piece of a methodology section. Text may use **bold**. */
export type MethodBlock =
  | { kind: "text"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "formula"; formula: string; caption?: string }
  | { kind: "note"; text: string }
  | { kind: "table"; head: string[]; rows: string[][] }

export interface MethodSection {
  id: string
  title: string
  icon: string
  /** One line under the title: what this section answers. */
  summary: string
  blocks: MethodBlock[]
  sources?: { label: string; url: string }[]
}
