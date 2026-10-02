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
          "**Tax on that income**: income tax (flat rates, or brackets) and payroll tax on wages (see Taxes).",
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
        formula: "Left over = income − payroll contributions − taxes − spending − loan payments − purchases + sales + HELOC draws",
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
          "A home with a **backup plan** (\"If my money runs out\" on its card) is sold at the start of the first year that would run out (half or more of the year's spending unfunded); its loans are paid off from the sale, then you rent or buy a smaller home with cash, and the whole plan runs again. Each home's backup plan is used at most once, and the chart marks the year. A home you've already planned to sell is only sold early if the money runs out before your date, and then your planned downsize (its rent or smaller home) is replaced by the backup plan's, never added to it.",
          "When a plan still runs out, the summary shows the **home equity left** that year (home values less their loans), in today's dollars and as years of that year's spending. It's not counted as spendable: your home only pays the bills if the plan sells it.",
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
        text: "On a year-by-year path, account returns and home and vehicle appreciation keep their after-inflation value: a year with higher inflation also gets a higher dollar return, so a changing path never quietly makes investments or property better or worse.",
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
          "Pensions and other income are amounts you enter; they grow with inflation unless you set otherwise.",
          "**Social Security** follows SSA's rules each year from your benefit at full retirement age and claiming age: 70% at 62 up to 124% at 70 (born 1960 or later); a **spousal top-up** to half your partner's benefit once they've filed, while filing jointly; the **earnings test** (before full retirement age, $1 withheld per $2 of wages over $24,480, or $1 per $3 over $65,160 in that year), with withheld months credited back as a higher benefit from full retirement age; and cost-of-living raises with inflation. When a partner dies, the survivor steps up to their benefit (with their delay credits, at least 82.5% of their full benefit, reduced if taken before your own full retirement age, from 60). Optionally, benefits are cut from a year on, e.g. the 2026 Trustees Report's 22% from 2033.",
          "**Estimating the benefit from earnings**: paste your record from ssa.gov (or fill a rough one) and the plan adds its own salaries for the years ahead, so retiring earlier or a career break changes the benefit. Each year's earnings up to that year's taxable maximum are indexed to the national average wage index; the best 35 years are averaged per month (AIME); the benefit at full retirement age is 90% of AIME up to $1,286, 32% up to $7,749 and 15% above (2026 bend points), in today's dollars. A benefit on your own record needs **40 work credits** (one per $1,890 of earnings in 2026, at most four a year, so about 10 years of work): before then only a spousal benefit (half the partner's) is paid.",
          "**Equity pay** (RSUs, stock options, ESPP) is taxed as wages: income tax, payroll tax, and Social Security earnings. RSUs vest on their schedule at that year's price: each year's share of the grant (even, front- or back-loaded, or your own), counted month by month from the grant month, with nothing before the cliff and then monthly, quarterly or yearly, and added up by calendar year. Leaving (the income's stop) forfeits what hasn't vested. Optional refreshers add a grant of the same value (today's dollars) every year you stay, buying fewer shares when the price is higher, so vesting ramps up to about one grant a year. The price starts at today's (looked up from Yahoo Finance by ticker, or typed in for a private company) and grows at the price growth you set. Shares you keep go into a taxable account with their value at vest as cost basis. **Options** count their expected gain in the year you exercise: an options-pricing (Black–Scholes) estimate with the plan's price growth in place of the risk-free rate, so outcomes above the strike count and those below pay nothing; an option under water today is still worth something. Non-qualified options (NSOs) are taxed as wages when exercised. **ISOs** kept aren't taxed then, but the gain counts toward the alternative minimum tax that year (see Taxes), and the shares start with no cost basis, so the whole gain is a long-term gain when sold; ISOs sold right away are ordinary income without payroll tax. An **ESPP** buys shares from after-tax pay at a discount; the discount's extra value is taxed as income and shown as employer match.",
          "**Elder care** costs start from the Federal Long Term Care Insurance Program's 2024 Cost of Care Survey for the state the parent lives in (each state is the median of its surveyed regions: nursing home private room, assisted living one bedroom, home health aide hourly), brought to today's dollars at the plan's inflation. Only your share (after what the parent pays) becomes an expense.",
        ],
      },
      {
        kind: "formula",
        formula: "Financial independence = first year investment accounts ≥ average yearly spending ÷ 3.5%",
        caption: "In today's dollars. The milestone moves as you edit the plan.",
      },
    ],
    sources: [{ label: "FLTCIP 2024 Cost of Care Survey", url: "https://cdn.ltcfeds.gov/planning-tools/downloads/Cost-of-Care-Survey.pdf" }],
  },
]
