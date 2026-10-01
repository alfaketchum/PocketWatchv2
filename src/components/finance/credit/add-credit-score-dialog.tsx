"use client"

import { useState } from "react"
import { AccountsModalShell, INPUT_CLASS, ModalField } from "@/components/accounts/accounts-modal-shell"
import { useSaveCreditScore, type CreditScoreItem } from "@/hooks/finance/use-credit-scores"
import { BUREAUS, MAX_SCORE, MIN_SCORE, SCORE_MODELS, type Bureau, type ScoreModel } from "@/lib/finance/credit-scores"

const today = () => new Date().toISOString().slice(0, 10)
const NO_BUREAU = ""

/** Log a score you looked up (no `score`), or correct one already logged. */
export function CreditScoreDialog({ score, defaultModel, onClose }: { score: CreditScoreItem | null; defaultModel: ScoreModel; onClose: () => void }) {
  const save = useSaveCreditScore()
  const [value, setValue] = useState(score ? String(score.score) : "")
  const [model, setModel] = useState<ScoreModel>(score?.model ?? defaultModel)
  const [bureau, setBureau] = useState<Bureau | typeof NO_BUREAU>(score?.bureau ?? NO_BUREAU)
  const [date, setDate] = useState(score ? score.date.slice(0, 10) : today())
  const [note, setNote] = useState(score?.note ?? "")
  const n = Number(value)
  const valid = Number.isInteger(n) && n >= MIN_SCORE && n <= MAX_SCORE && date !== "" && date <= today()
  const submit = () => {
    if (!valid) return
    save.mutate(
      { id: score?.id, score: n, model, bureau: bureau || null, date, note: note.trim() || null },
      { onSuccess: onClose },
    )
  }
  return (
    <AccountsModalShell
      title={score ? "Edit score" : "Log a credit score"}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-ghost text-sm">
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={!valid || save.isPending} className="btn-primary text-sm disabled:opacity-50">
            {save.isPending ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <ModalField label="Score" htmlFor="cs-score" hint={`Between ${MIN_SCORE} and ${MAX_SCORE}`}>
        <input id="cs-score" type="number" inputMode="numeric" min={MIN_SCORE} max={MAX_SCORE} value={value} onChange={(e) => setValue(e.target.value)} className={INPUT_CLASS} autoFocus />
      </ModalField>
      <div className="grid grid-cols-2 gap-3">
        <ModalField label="Scoring model" htmlFor="cs-model">
          <select id="cs-model" value={model} onChange={(e) => setModel(e.target.value as ScoreModel)} className={INPUT_CLASS}>
            {SCORE_MODELS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </ModalField>
        <ModalField label="Bureau" htmlFor="cs-bureau">
          <select id="cs-bureau" value={bureau} onChange={(e) => setBureau(e.target.value as Bureau | typeof NO_BUREAU)} className={INPUT_CLASS}>
            <option value={NO_BUREAU}>Not sure</option>
            {BUREAUS.map((b) => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
        </ModalField>
      </div>
      <ModalField label="Date checked" htmlFor="cs-date">
        <input id="cs-date" type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} className={INPUT_CLASS} />
      </ModalField>
      <ModalField label="Note (optional)" htmlFor="cs-note" hint="Where you saw it, or what changed (paid off a card, new loan…)">
        <input id="cs-note" type="text" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} className={INPUT_CLASS} style={{ background: "var(--card)" }} />
      </ModalField>
    </AccountsModalShell>
  )
}
