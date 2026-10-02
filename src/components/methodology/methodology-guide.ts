import type { MethodSection } from "./methodology-types"

/**
 * "Your guide": the tax rules a plan applies, in the order life brings them, and for each what the planner does for
 * you, what you set (and where), and what it leaves out. The "How it's calculated" page has the formulas.
 */
export const GUIDE_SECTIONS: MethodSection[] = [
  {
    id: "guide-start",
    title: "Start here",
    icon: "explore",
    summary: "Most tax rules run on their own. You mostly tell the plan who you are and where you live.",
    blocks: [
      {
        kind: "table",
        head: ["You set", "Where", "What it drives"],
        rows: [
          ["Birth dates (yours and a partner's)", "Assumptions › People", "Every age rule: 59½, Social Security, 65, required withdrawals"],
          ["Tax mode, state, filing status", "Assumptions › Taxes", "Real federal + state brackets, or simple flat rates"],
          ["Account types", "Accounts", "How each withdrawal is taxed (cash, taxable, 401k/IRA, Roth, HSA, 529)"],
          ["Payroll contributions", "Income › + Add contribution", "Pre-tax savings lower this year's tax; employer match on top"],
          ["Withdrawal order", "Cash flow", "Which accounts pay when spending outruns income"],
        ],
      },
      {
        kind: "note",
        text: "Use **real brackets** (Assumptions › Taxes) for anything tax-related. Flat rates are a quick sketch: no deductions, no 65+ amounts, no exact tax on withdrawals.",
      },
    ],
  },
  {
    id: "guide-working",
    title: "While you're working",
    icon: "work",
    summary: "Paychecks, savings and stock pay.",
    blocks: [
      {
        kind: "list",
        items: [
          "**Automatic**: federal and state income tax, Social Security and Medicare (payroll) tax, and the larger of the standard deduction or itemizing (property tax, state tax and mortgage interest).",
          "**You set**: 401(k), IRA, HSA contributions on each income (Income › + Add contribution). Pre-tax ones lower this year's tax; Roth ones don't, but come out tax-free later.",
          "**Stock pay**: RSUs are taxed as wages when they vest; incentive stock options can trigger the alternative minimum tax in the year you exercise, which the plan works out and credits back later.",
          "**Where to look**: the chart's Taxes view (turn on Subcategories for each kind), or click any year and open Taxes in the side panel.",
        ],
      },
    ],
  },
  {
    id: "guide-early",
    title: "Retiring before 59½",
    icon: "beach_access",
    summary: "Taking money from a 401(k) or IRA early costs a 10% penalty.",
    blocks: [
      {
        kind: "list",
        items: [
          "**Automatic**: before the year you reach 59½, the plan spends cash, taxable and Roth money first and touches your 401(k)/IRA only when those run out. If it has to, the 10% penalty is added and shows as its own tax.",
          "**You can change it**: Cash flow › \"Before 59½, use 401(k)/IRA last\". Off, your withdrawal order applies at every age, penalty included.",
          "**Tip**: a taxable brokerage or Roth balance is your bridge to 59½. If the penalty shows up in the Taxes view, that bridge is too small.",
          "**Not covered**: the age-55 rule for leaving a job, and equal yearly payments (72(t)) that avoid the penalty.",
        ],
      },
    ],
  },
  {
    id: "guide-social-security",
    title: "Social Security (62 to 70)",
    icon: "elderly",
    summary: "When you claim changes the check for life.",
    blocks: [
      {
        kind: "list",
        items: [
          "**You set**: the claiming age (slider on the Social Security income, 62 to 70) and your earnings record or a rough estimate.",
          "**Automatic**: the bigger check for waiting, spousal and survivor benefits, the earnings test if you work while claiming early, and how much of the benefit is taxed (up to 85%, by your other income).",
          "**Your call**: whether benefits are paid in full or cut if the trust fund runs short (Assumptions › Social Security outlook).",
        ],
      },
    ],
  },
  {
    id: "guide-65",
    title: "At 65",
    icon: "cake",
    summary: "Bigger deductions arrive on their own.",
    blocks: [
      {
        kind: "list",
        items: [
          "**Automatic**: the standard deduction grows by $2,050 (single) or $1,650 per spouse who's 65+.",
          "**Automatic, 2025 to 2028 only**: the $6,000 senior deduction per person 65+, shrinking above $75,000 single / $150,000 joint income. It shows as its own line in the side panel.",
          "**Not covered**: Medicare premiums and the IRMAA surcharges on higher incomes. Add premiums as an expense if you want them in the plan.",
        ],
      },
    ],
  },
  {
    id: "guide-rmd",
    title: "At 73 or 75: required withdrawals",
    icon: "event_repeat",
    summary: "The IRS makes you take money out of 401(k)s and IRAs every year.",
    blocks: [
      {
        kind: "list",
        items: [
          "**Automatic**: from 73 (75 if born in 1960 or later), each 401(k)/IRA pays out at least last year's balance ÷ an IRS factor (about 3.8% at 73, rising every year). It's taxed as income, pays your spending first, and anything left is reinvested.",
          "**You set, with a partner**: who owns each 401(k)/IRA (Accounts › Owner), so it follows the right person's age.",
          "**Where to look**: a marker on the chart where they start, \"Required withdrawals\" in the side panel and the ledger.",
          "**Spending that flexes**: Expenses › Spending rule lets retirement spending follow your portfolio (guardrails, a % of it, or the CAPE rule). The stress test then shows how deep the cuts get in bad markets.",
          "**Tip**: big required withdrawals can push you into a higher bracket in your 70s. Drawing some pre-tax money earlier (in lower-income years) can even this out; Roth conversions aren't modeled yet.",
          "**No required withdrawals** from Roth accounts or HSAs.",
        ],
      },
    ],
  },
  {
    id: "guide-events",
    title: "Big events",
    icon: "flag",
    summary: "Life events that change your taxes, and the one setting each needs.",
    blocks: [
      {
        kind: "table",
        head: ["Event", "What the plan does", "What you check"],
        rows: [
          ["Sell your home", "Up to $250k / $500k of gain tax-free after 2 years; tax on the rest", "\"I live in it (primary residence)\" on the home"],
          ["Rent a home out", "Rent taxed after costs, interest and depreciation", "\"Rent it out\" on the home"],
          ["Inheritance", "Stepped-up basis on stocks and homes; inherited IRAs emptied within 10 years; state inheritance tax", "Your relationship and their state (Milestones › Inheritance)"],
          ["Move", "Switches to the new state's income tax from that year", "Milestones › Move"],
          ["Marry / lose a partner", "Joint filing from the wedding; single filing after a loss", "Milestones › Get married / Partner passes away"],
        ],
      },
    ],
  },
  {
    id: "guide-not-covered",
    title: "Not covered yet",
    icon: "construction",
    summary: "Where to add your own margin.",
    blocks: [
      {
        kind: "list",
        items: [
          "Roth conversions; Medicare IRMAA surcharges; HSA medical-spending rules (HSA withdrawals are treated as medical, tax-free); Roth's 5-year rule.",
          "Tax law is 2026's, carried forward. Scheduled changes already in the law are included; future laws aren't.",
          "The exact formulas, sources and every figure we keep up to date are on **How it's calculated**.",
        ],
      },
    ],
  },
]
