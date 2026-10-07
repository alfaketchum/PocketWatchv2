import type { MethodSection } from "./methodology-types"

/** Historical tests and FIRE math, then what isn't modeled. */
export const MARKET_SECTIONS: MethodSection[] = [
  {
    id: "stress-test",
    title: "Stress test (simulated markets and history replay)",
    icon: "thunderstorm",
    summary: "Your whole plan re-run through 500 markets built from history since 1871, or through history exactly as it happened.",
    blocks: [
      {
        kind: "text",
        text: "The full plan (taxes, account order, loans, everything) is re-run many times. In each run, every account earns what its mix of investments actually earned in the historical years that run lives through, instead of its steady assumed return. What changes between methods is which years each run lives through.",
      },
      {
        kind: "table",
        head: ["Method", "Which years each run lives through"],
        rows: [
          ["**Simulated** (default; the number on Overview and Compare)", "A block bootstrap: random runs of 10 consecutive historical years (5 or 15 if you pick), stitched together until the plan is covered. Crashes, recoveries and inflation streaks stay intact while eras mix, and it covers starting today, which history can't. 500 runs (1,000 or 2,000 if you pick)."],
          ["**History**", "Early Retirement Now's replay: once per start year, in order, using only start years with history all the way to the plan's end."],
          ["**Random restart**", "Each start year in order; when history runs out, it jumps to a random year and carries on (ProjectionLab's default)."],
          ["**Random years**", "A random year for every plan year. Breaks up streaks, so bad decades are rarer and results usually look rosier."],
        ],
      },
      {
        kind: "text",
        text: "Every run keeps a year's stocks, bonds, inflation and valuation (CAPE) together, so they move as they really did. Simulated runs always start at the plan's first year. A fixed random seed means the same plan always gets the same runs, so the success rate only moves when the plan does; **Reroll** draws a new set to show how much the number wobbles. Compare runs both plans through the same 500 markets, so the difference comes from the plans alone.",
      },
      {
        kind: "list",
        items: [
          "**Data**: Robert Shiller's monthly US stock and bond total returns after inflation, compounded into calendar years.",
          "**Each account's mix**: stocks, bonds, cash and crypto. Default: crypto accounts all crypto, cash accounts all cash, everything else 80% stocks / 20% bonds.",
          "**Cash** earns 0% after inflation (ERN's convention; the data has no T-bill series).",
          "**Crypto** has too little history, so it swings twice as hard as stocks did that year around its own assumed return, never worse than −90% in a year. The doubling is done in log terms so its long-run compounded return stays at your assumption.",
          "**Company stock behind RSUs and options** swings 1.5× as hard as the market did that year, around its own assumed price growth, never worse than −90% in a year. RSU vests are worth that path's price, and options pay exactly what that path leaves above the strike (nothing in a bad run). Only market-wide swings are replayed, not one company's own surprises. Company stock accounts default to all stocks.",
          "**Lining up** (History only): history's year 1 matches the plan's first year, or your retirement year (earlier plan years then use the years before it in history).",
          "**Only complete runs count** (History only): a start year is used only if history covers every year from there to the plan's end.",
          "**Two rates, net worth first.** **Solvent** (the headline): the share of runs whose assets are never exhausted. Assets are exhausted when the portfolio has been depleted and then, at that point or later, net worth falls below one year of that year's spending, leaving nothing meaningful to sell (a leftover car doesn't count, and a plan that starts in debt isn't exhausted for that alone). **Fully funded**: the share whose accounts fund every year's spending to the end. Spending the accounts can't fund doesn't vanish: it accumulates as an **Unfunded spending** debt, so net worth falls with it, in your plan and in every run. A run can deplete its accounts and keep its net worth for a while (a valuable home, nothing left to spend); the page calls that **portfolio depleted** (amber), and reserves red for **assets exhausted**. The verdict reads both: fully funded in almost every market; solvent throughout but portfolio depleted in the worst; asset-rich but cash-constrained; or assets exhausted in some share of markets.",
          "**The outcomes** (under the Range chart), measured against your own plan: **Surplus** was fully funded and ended with more than you have today (after inflation); **Funded, solid reserve** ended with at least 5 years of your end-of-plan spending; **Funded, thin reserve** ended with less than that; **Funded by a home sale** was fully funded only because the stress test sold a home, and only shows when that happens. The stress test sells a home in the year the portfolio is depleted in two cases: a home your plan sells later is sold then instead (its downsize rent or smaller home starts then too, and the page tells you how many trials moved it up), and a home your plan keeps is sold if its \"If the portfolio is depleted\" setup says so. Your plan's own projection never does either; **Late depletion** had its portfolio depleted in the plan's last 5 years; **Early depletion** earlier, and both say how much home equity typically remained at that point. On the **Net worth** view, a trial whose portfolio was depleted before any home was sold, without its assets being exhausted, is **Portfolio depleted** (the home could still be sold); depletion after a home sale, or with assets exhausted, stays late or early depletion. Each outcome also shows how close its typical period came to depletion: the **lowest point** (the fewest years of spending, bills plus debt payments, your accounts held in a year you were drawing on them, and the age) and the **danger-years**, the area under a 3-year line: every year under 3 years of spending adds how far under it was (a year at $0 adds 1, a year at 1.5 years adds 0.5). Working years, when income covers spending, don't count. The **Close calls** chart draws that reserve by age for every period (median, middle 50% and 80%, the worst start year and your steady-return plan), with the under-3-years danger zone shaded; ages when most periods are still working are left blank. Depletion is always measured on your accounts (your home and other property don't fund spending unless they're sold), and the outcomes follow the CAPE filter.",
          "**CAPE filter**: show only the runs that started when stocks were as expensive as now (CAPE ≥ 20 or ≥ 30), since expensive starts have historically led to worse outcomes. For simulated runs that's the CAPE of their first year.",
          "**Ending net worth histogram**: how many runs ended at each level (today's dollars), colored by outcome. Clicking a bar shows only those runs everywhere on the page. The table lists every run worst first, with the historical years it lived through.",
          "**Withdrawal rate**: each year's withdrawals over what your accounts held at the start of that year, capped at 100%; a year your accounts couldn't cover counts as 100%.",
          "**Why it fails** (shown when the plan misses your target success rate): the failed runs explained from your plan, only the patterns that apply: when their portfolio is depleted (share, typical age, the middle 80%), spending at that age vs today in today's dollars with the lines that grew most, a crypto-heavy or one-account portfolio (or one mostly in cash and bonds), no paycheck before the portfolio is depleted, money that arrives after that age (inheritances, one-time income, rent, Social Security), property still owned at depletion, a steady plan that is never depleted because it assumes the same return every year, and taxes over 20% of what you live on.",
          "**What would help**: your plan run again with one change at a time (invest 80/20, spend 10% less on everyday costs, skip a big purchase still ahead, sell a kept home if the portfolio is depleted, retire 3 years later), each on the same 250 simulated runs as your plan as it is.",
          "**Reach your target** (80, 85, 90 or 95%, 90% to start): each lever moved on its own until the plan meets your goal in that share of the same 250 runs. Everyday spending (what you entered, not kids, home and car costs or one-time items) is searched to the nearest 1%; the investment mix tries today's mix with crypto halved, then all stocks, 80/20, 60/40 and 40/60 in every invested account (not cash or 529s) and keeps the least change that gets there, or the best; retirement age is searched year by year to 80 when a paycheck stops at retirement; Social Security tries every claim age 62–70 (its start and benefit move with it). When a lever can't get there alone, it says so and shows its best. A run stops early once it has clearly made or missed the target. Apply makes the change in your plan, with Undo; the mix changes what the stress test replays, not your assumed returns.",
        ],
      },
      {
        kind: "formula",
        formula: "Account's return that year = (1 + historical return after inflation) × (1 + plan's inflation) − 1",
      },
      {
        kind: "text",
        text: "**Inflation: the plan's assumption (default).** The historical returns already have that year's actual inflation taken out. Expenses rise at the plan's rate and returns get the same rate added back, so the two cancel: your spending keeps its buying power, and your investments earn what they really earned after inflation. Using the 1970s' 10% on both sides would give the same answer.",
      },
      {
        kind: "text",
        text: "**Inflation: what actually happened.** What the default misses is everything that doesn't rise with prices. This mode runs each period through its real inflation too (official CPI, January to January, from 1913; earlier years keep the plan's rate), so a run starting in 1966 lives through the 1970s' prices:",
      },
      {
        kind: "table",
        head: ["In high inflation", "What happens"],
        rows: [
          ["Investments, inflation-linked spending, Social Security", "Unchanged in real terms (the rate cancels)"],
          ["Pension or annuity with \"No raises\"", "Same dollars every year: loses buying power faster"],
          ["Fixed-rate mortgage or loan", "Same payment: gets cheaper in real terms"],
          ["Expense or income with its own fixed growth %", "Falls behind high inflation, outpaces low inflation"],
          ["Tax brackets and standard deduction", "Rise with actual inflation, as the IRS indexes them"],
          ["Tax lines fixed by law (3.8% NIIT line, SALT cap, home-sale exclusion)", "Stay put: more income crosses them"],
          ["Homes and vehicles", "Keep their after-inflation appreciation"],
        ],
      },
      {
        kind: "note",
        text: "Each year's flows are priced at the start of the year and land at its end, so very high inflation trims their real size by about that year's inflation (under 1% on a typical plan's ending net worth). Home and vehicle values keep their assumed appreciation in every run rather than replaying history.",
      },
    ],
    sources: [
      { label: "Early Retirement Now: Safe Withdrawal Rate series", url: "https://earlyretirementnow.com/safe-withdrawal-rate-series/" },
      { label: "Robert Shiller: US stock market data", url: "http://www.econ.yale.edu/~shiller/data.htm" },
    ],
  },
  {
    id: "fire",
    title: "FIRE: safe withdrawal rates",
    icon: "local_fire_department",
    summary: "How much you can spend from a portfolio, tested against history. Everything in today's dollars.",
    blocks: [
      {
        kind: "list",
        items: [
          "**Monthly** history since 1871 (Shiller). Withdrawals happen at the start of each month; a 0.05% yearly fee is subtracted.",
          "**Max safe withdrawal rate** for each start month: the highest rate that ends at your target final value, solved exactly (ERN's closed form).",
          "**Failsafe rate**: the lowest of those across all start months, i.e. the rate that survived the worst start in history.",
          "**Success rate**: the share of start months where a given rate lasts the whole retirement without running out along the way.",
          "Allocations can be fixed or change over time (glidepaths); pensions, Social Security and other income can be added as yearly flows.",
        ],
      },
      { kind: "formula", formula: "W = (1 − FV ÷ G_T + Σ F_t ÷ G_t) ÷ Σ 1 ÷ G_t", caption: "G_t: growth of $1 up to month t, after inflation; F_t: extra income; FV: final-value target." },
      { kind: "formula", formula: "Nest egg needed = yearly spending ÷ withdrawal rate" },
      {
        kind: "list",
        items: [
          "**CAPE rule** (ERN): withdrawal rate = a + b × (1 ÷ CAPE), spending more when stocks are cheap.",
          "**Withdrawal strategies** (the same guardrails rule plans use): fixed dollars (4% rule style), a % of the portfolio, the CAPE rule, and Guyton-Klinger guardrails (cut spending 10% when the withdrawal rate drifts 20% above plan, raise it 10% when 20% below). Spending is set at the start of each retirement year and run through the same history.",
          "**Crypto** is applied as a drop in value sized from each tier's worst historical drawdown (e.g. BTC −83%, ETH −93%), either on today's value or in the month you retire.",
          "**Rich, broke or dead**: market outcomes combined with the CDC 2023 US life table, treating the two as independent.",
          "**Years to FI**: compounding at your real return with a fixed yearly contribution added at year end.",
        ],
      },
    ],
    sources: [{ label: "CDC: US life tables", url: "https://www.cdc.gov/nchs/products/life_tables.htm" }],
  },
  {
    id: "limits",
    title: "What isn't modeled (yet)",
    icon: "rule",
    summary: "Known simplifications, so you know where to add your own margin.",
    blocks: [
      {
        kind: "list",
        items: [
          "**Retirement-account rules left out**: the age-55 and equal-payment exceptions to the early-withdrawal penalty; the 20% penalty on non-medical HSA withdrawals before 65 (HSA withdrawals are treated as medical, tax-free); Roth contributions vs earnings and the 5-year rule (Roth withdrawals are tax-free at any age); the joint-life table for a spouse more than 10 years younger; taking the first required withdrawal by April 1 of the next year; yearly required withdrawals inside an inherited account's 10 years.",
          "**Medicare IRMAA** surcharges aren't included.",
          "**Social Security** estimates leave out future real wage growth (about 1% a year, so younger people's estimates are a little low) and freezing the wage indexing at age 60. Not modeled: divorced-spouse benefits, children's and family-maximum rules, the earnings test on survivor benefits, and a survivor benefit when the deceased hadn't claimed yet (their claiming age is used).",
          "**Years, not months**: plans step a year at a time (FIRE's history engine is monthly).",
          "**Loans** have fixed rates. Variable-rate loans, refinancing (with its costs and points) and a HELOC drawn in several pieces aren't modeled yet.",
          "**Tax law** is 2026's, carried forward; scheduled changes in the 2025 law (SALT cap) are included, future legislation isn't.",
        ],
      },
    ],
  },
]
