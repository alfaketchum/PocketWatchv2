/** The plan guide ("How it works"): one short line per tab, chart control and page. Keep it in step with the app. */
export interface GuideSection {
  title: string
  items: { name: string; text: string }[]
}

export const PLAN_GUIDE: GuideSection[] = [
  {
    title: "Build it, tab by tab",
    items: [
      { name: "Assumptions", text: "Who's in the plan, how long it runs, inflation, tax state and filing, Social Security outlook, credit score." },
      { name: "Accounts", text: "What you have today: balance, tax type and expected return. Refresh balances pulls linked accounts." },
      { name: "Income", text: "Salary, business, stock pay, Social Security, pensions: amounts, raises, and when each starts and stops." },
      { name: "Expenses", text: "What you spend each year; spending patterns change it with age, and a spending rule lets it follow your portfolio in retirement. Add a child here too." },
      { name: "Assets & debts", text: "Homes, cars and loans: buy, sell or downsize, rent a home out, pay a loan off early." },
      { name: "Cash flow", text: "Where leftover money is saved, and which accounts pay when money runs short." },
      { name: "Milestones", text: "Life events (retire, marry, move, inheritance…) that change several things at once." },
      { name: "Ledger Overview", text: "Every year as a table; pick a column set or download a CSV." },
    ],
  },
  {
    title: "Read the chart",
    items: [
      { name: "Views", text: "Net worth, Cash flow, Income, Expenses, Debt, Taxes, Accounts." },
      { name: "Subcategories", text: "Splits each band into its accounts, lines or kinds of tax; hover or tap a bar to see them." },
      { name: "Pin a year", text: "Click a bar to pin it in the side panel; View it alone to zoom in. Click empty space to unpin." },
      { name: "Today's / future $", text: "Today's dollars take inflation out, so years compare fairly." },
    ],
  },
  {
    title: "Pages",
    items: [
      { name: "Money flow", text: "One year's money from each source to where it went." },
      { name: "Trading", text: "Whether active trading beats buying and holding, after its taxes." },
      { name: "Loans", text: "Pay a loan down or invest instead, and 15 / 20 / 30-year terms side by side." },
      { name: "Stress test", text: "Your plan replayed through every market since 1871: how often it holds, and the close calls." },
      { name: "Compare Plans", text: "Two plans side by side: duplicate one, change one thing (tab at the top of Planner)." },
      { name: "Plan vs Actual", text: "Your real net worth tracked against the primary plan (tab at the top of Planner)." },
      { name: "Methodology", text: "Your guide: the tax rules by stage of life (59½, 65, 73…), what's automatic and what you set. How it's calculated: every formula and source." },
    ],
  },
]
