import type { MethodSection } from "./methodology-types"

/** How a plan is projected: the yearly loop, money in and out, inflation, and today's vs future dollars. */
export const PLAN_SECTIONS: MethodSection[] = [
  {
    id: "plan-engine",
    title: "How a plan is projected",
    icon: "route",
    summary: "One year at a time, in actual dollars, from the plan's start to its end.",
    blocks: [
      {
        kind: "text",
        text: "A plan is simulated **one year at a time**. Every number inside the engine is in **actual (future) dollars**: the amounts your statements would show that year. Today's dollars are only a way of displaying the results (see below).",
      },
      { kind: "text", text: "Each year runs in this order:" },
      {
        kind: "list",
        items: [
          "**Income** for the year: pay, business, pensions, Social Security, rent. Pre-tax payroll contributions and employer match go straight into their accounts.",
          "**Tax on that income** (flat rates, or brackets: see Taxes).",
          "**Assets and loans**: purchases, sales (with capital-gains tax), and this year's loan payments split into principal and interest.",
          "**Spending**: every expense line, grown by inflation (or its own growth rate) and shaped by its spending pattern.",
          "**Growth**: each account grows by its return on the balance it started the year with.",
          "**Leftover or shortfall**: money left over is saved; money missing is withdrawn from accounts (see Cash flow).",
          "**Tax true-up**: with brackets, the year's exact tax is recomputed on the final totals and the difference is settled.",
        ],
      },
      {
        kind: "note",
        text: "Growth is applied to the balance at the start of the year and the year's flows land at the end. Real money moves all year long, so this slightly understates growth on money you add and overstates it on money you take out. Over a lifetime the effect is small, and it is the same convention most planners use.",
      },
      {
        kind: "formula",
        formula: "Net worth = accounts + homes, cars and other assets − what's still owed on loans",
        caption: "Shown at the end of each year.",
      },
    ],
  },
  {
    id: "cash-flow",
    title: "Cash flow: where leftover money goes, and where shortfalls come from",
    icon: "swap_vert",
    summary: "The rules that move money between your accounts each year.",
    blocks: [
      {
        kind: "formula",
        formula: "Left over = income − payroll contributions − taxes − spending − loan payments − purchases + sales",
      },
      { kind: "text", text: "**When money is left over**, it is saved in this order:" },
      {
        kind: "list",
        items: [
          "Top up the cash buffer (grown with inflation) to its target.",
          "Then the plan's savings order, each account up to its yearly cap (caps grow with inflation).",
          "Anything still left goes to the last uncapped account in that order, or else the first taxable brokerage account.",
        ],
      },
      { kind: "text", text: "**When money is short**, accounts are drawn down in the plan's withdrawal order. Accounts not listed follow this default:" },
      {
        kind: "table",
        head: ["Order", "Account type", "Tax on the withdrawal"],
        rows: [
          ["1", "Cash", "None"],
          ["2", "Taxable brokerage", "Only the gain part (balance above cost basis), at capital-gains rates"],
          ["3", "Traditional (401k, IRA)", "All of it, as ordinary income"],
          ["4", "HSA", "None"],
          ["5", "Roth", "None"],
        ],
      },
      {
        kind: "list",
        items: [
          "Each withdrawal is **grossed up** for its tax: to get $10,000 to spend from a traditional IRA at a 22% rate, the engine withdraws about $12,820.",
          "A protected cash buffer is spent last, only after every other account is empty.",
          "529 accounts only pay the education costs earmarked for them, never general shortfalls.",
          "If every account is empty, the unfunded amount is recorded as a **shortfall**: the plan has run out of money that year.",
        ],
      },
      {
        kind: "text",
        text: "**Inherited retirement accounts** must be empty by their deadline: each year takes an even share of what's left (balance ÷ years remaining). Traditional withdrawals are taxed as income; Roth withdrawals aren't. Inherited investments in a taxable account get a stepped-up cost basis.",
      },
    ],
  },
  {
    id: "inflation",
    title: "Inflation",
    icon: "trending_up",
    summary: "One rate you choose, or what the bond market expects, as a single rate or year by year.",
    blocks: [
      { kind: "text", text: "Anything set to \"grow with inflation\" is multiplied by the price level for its year:" },
      { kind: "formula", formula: "Price level in year t = (1 + inflation)^t", caption: "On a year-by-year path, each year's own rate is multiplied in instead." },
      { kind: "text", text: "Three ways to set it, per plan:" },
      {
        kind: "list",
        items: [
          "**Your number**: one rate for every year.",
          "**Market**: the TIPS breakeven that matches the plan's length (5, 10, 20 or 30 years). A breakeven is what regular Treasury bonds pay minus what inflation-protected (TIPS) bonds pay: the inflation investors are pricing in.",
          "**Market, year by year**: years 1–5 use the 5-year breakeven, years 6–10 the 5-year rate starting in 5 years, years 11–20 and 21–30 the forward rates implied between the 10-, 20- and 30-year breakevens, and after year 30 the 30-year breakeven.",
        ],
      },
      {
        kind: "text",
        text: "Market numbers come from the St. Louis Fed (FRED) and refresh daily. 20- and 30-year breakevens are computed as the Treasury yield minus the TIPS yield of the same maturity. Plans store the numbers they used, so results don't change on their own; the page offers to update when newer data is out.",
      },
      {
        kind: "note",
        text: "On a year-by-year path, account returns keep their after-inflation value: a year with higher inflation also gets a higher dollar return, so a changing path never quietly makes investments better or worse.",
      },
    ],
    sources: [{ label: "FRED: 5-, 10-year breakevens and 5y5y forward", url: "https://fred.stlouisfed.org/series/T10YIE" }],
  },
  {
    id: "real-nominal",
    title: "Today's dollars vs future dollars",
    icon: "currency_exchange",
    summary: "Two ways to show the same projection, and how we keep them from being mixed.",
    blocks: [
      {
        kind: "list",
        items: [
          "**Future $ (nominal)**: the price tags of each year. A $5 coffee today shows as about $10 in 25 years at 3% inflation.",
          "**Today's $ (real)**: every amount divided by that year's price level, so $100,000 in 2050 means what $100,000 buys today.",
        ],
      },
      {
        kind: "formula",
        formula: "Real return = (1 + nominal return) ÷ (1 + inflation) − 1",
        caption: "7% before inflation at 3% inflation is about 3.9% after inflation, not 4%.",
      },
      {
        kind: "text",
        text: "Flows during a year (income, spending) are divided by the price level at the start of that year; balances at year end by the price level one year later.",
      },
      {
        kind: "text",
        text: "**Account returns** can be entered either way (a per-plan switch on Accounts). Stored returns are always before inflation. When returns are entered after inflation and inflation changes, every return is re-based so its after-inflation value stays what you typed.",
      },
      {
        kind: "note",
        text: "Our rule across the app: never mix the two. Every calculation is done entirely in actual dollars (Plans) or entirely in today's dollars (FIRE, the historical return data), and converting between them always uses the formula above.",
      },
    ],
  },
  {
    id: "spending",
    title: "Spending, income and milestones",
    icon: "payments",
    summary: "How amounts grow, change with age, and what the financial-independence milestone means.",
    blocks: [
      {
        kind: "list",
        items: [
          "Amounts are entered in today's dollars. Each line grows with inflation unless it has its own growth rate.",
          "**Spending patterns** reshape a line by age on top of inflation: e.g. go-go, slow-go, no-go years in retirement, or healthcare that climbs with age.",
          "Plan-wide **spending changes** (a move, cutting back) scale spending from a chosen year; home and vehicle running costs aren't scaled by them.",
          "Social Security, pensions and other income are amounts you enter; they grow with inflation unless you set otherwise.",
        ],
      },
      {
        kind: "formula",
        formula: "Financial independence = first year investment accounts ≥ average yearly spending ÷ 3.5%",
        caption: "In today's dollars. The milestone moves as you edit the plan.",
      },
    ],
  },
]
