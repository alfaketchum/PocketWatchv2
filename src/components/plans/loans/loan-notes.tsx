"use client"

const NOTES: { title: string; text: string }[] = [
  {
    title: "Paying extra is a guaranteed return.",
    text: "Every extra dollar stops interest at the loan's rate, with no market risk. That's why it's fair to compare it with a bond's return as much as a stock's: investing has to beat the loan's rate after tax, and do it reliably.",
  },
  {
    title: "Nothing here is left idle.",
    text: "Whatever an option doesn't spend on the loan is saved by your plan's cash-flow rules, and once a loan is gone its payment is saved too. So every option has the same income and spending; only where the money goes differs.",
  },
  {
    title: "Home equity counts, but you can't spend it.",
    text: "Net worth includes the home, so paying down the loan isn't a loss. But equity can only be reached by selling or borrowing, while invested money can be withdrawn in a bad year. Watch the at-retirement column and how long the money lasts, not just the end.",
  },
  {
    title: "The deduction only helps if you itemize.",
    text: "Mortgage interest lowers your tax only when your itemized deductions beat the standard deduction. The plan runs your actual taxes each year, so this is already in the numbers.",
  },
  {
    title: "Inflation helps the borrower.",
    text: "A fixed payment gets cheaper in real terms every year. When inflation runs hot, holding a low fixed-rate loan and investing tends to win; the history replay below uses each period's actual inflation, so it shows that.",
  },
  {
    title: "A shorter loan commits you; paying extra doesn't.",
    text: "A 15-year loan has a lower rate but a required higher payment. Paying a 30-year loan like a 15-year costs a little more interest but lets you stop if money gets tight.",
  },
]

/** Plain-language notes on the questions behind the comparison. */
export function LoanNotes() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {NOTES.map((n) => (
        <p key={n.title} className="text-[12px] leading-relaxed text-foreground-muted">
          <span className="font-medium text-foreground">{n.title}</span> {n.text}
        </p>
      ))}
    </div>
  )
}
