import type { MethodSection } from "./methodology-types"

/** Historical tests and FIRE math, then what isn't modeled. */
export const MARKET_SECTIONS: MethodSection[] = [
  {
    id: "stress-test",
    title: "Stress test (history replay)",
    icon: "thunderstorm",
    summary: "Your whole plan re-run through every stretch of market history since 1871.",
    blocks: [
      {
        kind: "text",
        text: "Following Early Retirement Now's method, the full plan (taxes, account order, loans, everything) is re-run once for each start year in history. In each run, every account earns what its mix of investments actually earned in the years that followed, instead of its steady assumed return.",
      },
      {
        kind: "list",
        items: [
          "**Data**: Robert Shiller's monthly US stock and bond total returns after inflation, compounded into calendar years.",
          "**Each account's mix**: stocks, bonds, cash and crypto. Default: crypto accounts all crypto, cash accounts all cash, everything else 80% stocks / 20% bonds.",
          "**Cash** earns 0% after inflation (ERN's convention; the data has no T-bill series).",
          "**Crypto** has too little history, so it swings twice as hard as stocks did that year around its own assumed return, never worse than −90% in a year. The doubling is done in log terms so its long-run compounded return stays at your assumption.",
          "**Lining up**: history's year 1 matches the plan's first year, or your retirement year (earlier plan years then use the years before it in history).",
          "**Only complete runs count**: a start year is used only if history covers every year from there to the plan's end.",
          "**Success** = the money lasts: no year where spending goes unfunded.",
          "**CAPE filter**: show only the runs that started when stocks were as expensive as now (CAPE ≥ 20 or ≥ 30), since expensive starts have historically led to worse outcomes.",
        ],
      },
      {
        kind: "formula",
        formula: "Account's return that year = (1 + historical return after inflation) × (1 + plan's inflation) − 1",
      },
      {
        kind: "text",
        text: "**Why inflation is the plan's own rate**: the historical returns already have that year's actual inflation taken out. Expenses rise at the plan's rate and returns get the same rate added back, so the two cancel: your spending keeps its buying power, and your investments earn what they really earned after inflation. Using the 1970s' 10% on both sides would give the same answer.",
      },
      {
        kind: "note",
        text: "What that misses: things that don't rise with inflation. A pension without raises, a fixed mortgage payment, an expense with its own fixed growth rate and tax lines set by law lose buying power at the plan's steady rate, not at the pace of a high-inflation decade like the 1970s. Replaying history's actual inflation is on the roadmap. Home and vehicle values also keep their assumed appreciation in every run.",
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
          "**Withdrawal strategies**: fixed dollars (4% rule style), a % of the portfolio, the CAPE rule, and Guyton-Klinger guardrails (cut spending 10% when the withdrawal rate drifts 20% above plan, raise it 10% when 20% below). Spending is set at the start of each retirement year and run through the same history.",
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
          "**Required minimum distributions** from traditional accounts after age 73 aren't forced.",
          "**Early-withdrawal penalties** (before 59½) aren't charged.",
          "**Medicare IRMAA** surcharges and the **alternative minimum tax** aren't included.",
          "**Social Security taxation** is a fixed 85% rather than the exact formula.",
          "**Years, not months**: plans step a year at a time (FIRE's history engine is monthly).",
          "**Historical inflation** isn't replayed in the stress test (see Stress test).",
          "**Tax law** is 2026's, carried forward; scheduled changes in the 2025 law (SALT cap) are included, future legislation isn't.",
        ],
      },
    ],
  },
]
