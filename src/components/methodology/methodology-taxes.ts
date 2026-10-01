import type { MethodSection } from "./methodology-types"

/** Taxes and property: brackets, gains, deductions, states, homes, loans and rentals. */
export const TAX_SECTIONS: MethodSection[] = [
  {
    id: "taxes",
    title: "Taxes",
    icon: "account_balance",
    summary: "Flat rates, or 2026 federal and state brackets that rise with inflation.",
    blocks: [
      {
        kind: "text",
        text: "Each plan uses either **flat rates** (one income-tax rate and one capital-gains rate, which can change over time) or **brackets**. With brackets:",
      },
      {
        kind: "list",
        items: [
          "**Federal**: 2026 ordinary brackets (10% to 37%) and standard deduction ($16,100 single, $32,200 joint), from IRS Rev. Proc. 2025-32.",
          "**Long-term gains** are stacked on top of ordinary income and taxed at 0 / 15 / 20%. Short-term gains are taxed as ordinary income.",
          "**Net investment income tax**: 3.8% on gains above $200,000 (single) / $250,000 (joint) of income. These lines are set by law and don't rise with inflation.",
          "**Social Security**: 85% of benefits counts as taxable income (the usual case once other income is meaningful).",
          "**Payroll taxes** on every salary, in both tax modes: 6.2% Social Security up to the wage base ($184,500 in 2026, rising with inflation; each job has its own) plus 1.45% Medicare, and 0.9% more Medicare on combined wages above $200,000 single / $250,000 joint (not indexed). Business income pays self-employment tax instead: 15.3% on 92.35% of profit, half of it deductible from income. Pre-tax 401(k) contributions don't lower payroll tax.",
          "**Brackets and deductions rise with the plan's inflation** each year, as the IRS indexes them.",
          "**State tax** for all 50 states and DC, with each state's brackets and standard deduction. Most states tax gains like other income; the exceptions are modeled (e.g. AR, AZ, ND, SC and WI exclude part of long-term gains, HI caps their rate, MT has separate gains brackets, WA taxes large long-term gains though it has no income tax).",
          "Moving states or changing filing status partway through is supported through plan changes.",
        ],
      },
      { kind: "text", text: "Withdrawals are taxed in two steps:" },
      {
        kind: "list",
        items: [
          "**During the year**: each withdrawal is grossed up at your marginal rate given your earned income.",
          "**At year end**: tax is recomputed exactly on all the year's income, withdrawals and gains together. If that differs from what was charged, the difference is paid (or returned) from cash flow, and the year is re-run until it settles, since paying more tax can mean withdrawing, and owing tax on, a little more.",
        ],
      },
    ],
    sources: [
      { label: "IRS Rev. Proc. 2025-32 (2026 brackets)", url: "https://www.irs.gov/pub/irs-drop/rp-25-32.pdf" },
      { label: "Tax Foundation: state income tax rates 2026", url: "https://taxfoundation.org/data/all/state/state-income-tax-rates/" },
    ],
  },
  {
    id: "deductions",
    title: "Itemized deductions for homeowners",
    icon: "receipt_long",
    summary: "When property tax and mortgage interest beat the standard deduction.",
    blocks: [
      { kind: "text", text: "Each year the engine takes whichever is larger: the standard deduction or itemizing." },
      {
        kind: "formula",
        formula: "Itemized = min(SALT cap, state income tax + property tax) + mortgage interest",
      },
      {
        kind: "list",
        items: [
          "**SALT cap** (2025 tax law): $40,000 in 2025, rising 1% a year through 2029, reduced by 30% of income above $500,000 (that line also rises 1% a year), never below $10,000. From 2030 it returns to $10,000.",
          "**Mortgage interest** is deductible on up to $750,000 of mortgage; above that, a proportional share.",
          "Only homes you live in count. A rented-out home's costs come off its rent instead (see Homes).",
          "**States** follow their own rules: some don't allow itemizing, some use their own itemized deductions with their own caps, some start from the federal amount, and some give a property-tax deduction or credit that phases out with income. Each state's rule is checked against its revenue department's guidance.",
        ],
      },
    ],
  },
  {
    id: "property",
    title: "Homes, vehicles, loans and rentals",
    icon: "home",
    summary: "What owning costs, how loans are paid down, and how a sale or rental is taxed.",
    blocks: [
      {
        kind: "list",
        items: [
          "**Value**: an asset bought in a future year costs today's price grown by inflation to that year, then changes at its own appreciation (or depreciation) rate.",
          "**Vehicles** can follow a depreciation curve by age instead of a flat rate: about 20% the first year, 45% by year 5 and 72% by year 10, never below 5% of the new price. Buying brand new, pre-owned (about 3 years old) or used (about 6) sets a typical price and loan rate (new $50,300, used $26,000; loans 6.35% new, 11.19% used) and where the car starts on the curve.",
          "**Running costs** (property tax, insurance, maintenance) are either fixed amounts that rise with inflation or a share of the home's value that follows its value. \"Use typical costs\" fills in your state's average effective property-tax rate, or a looked-up home's actual tax bill.",
          "**Loans** use a level monthly payment; each year's payments are split into interest (on the balance owed) and principal. A financed purchase creates its loan automatically; a real linked loan always takes its place.",
          "**Selling**: the gain over what you paid is taxed as a capital gain. A home you have lived in for at least two years gets the home-sale exclusion: $250,000 single, $500,000 joint (set by law, not indexed).",
          "**Renting out**: rent is taxable after the home's costs, mortgage interest and depreciation (80% of the price, the building's typical share, over 27.5 years). A rental loss isn't used against other income, as passive-loss rules usually prevent that.",
        ],
      },
      {
        kind: "formula",
        formula: "Monthly payment = loan × r ÷ (1 − (1 + r)^−months),  r = yearly rate ÷ 12",
      },
      {
        kind: "note",
        text: "Home values, rent estimates and tax bills for a looked-up address come from a property-data provider (RentCast). They're estimates, refreshed when you look the home up again.",
      },
    ],
    sources: [
      { label: "LendingTree: first-year depreciation", url: "https://www.lendingtree.com/auto/how-much-do-new-cars-depreciate/" },
      { label: "iSeeCars: 5-year depreciation", url: "https://cars.zone/depreciation-resale-value/" },
      { label: "Kelley Blue Book average transaction price", url: "https://www.coxautoinc.com/insights/dec-2025-atp-report/" },
      { label: "Cox Automotive used listing price", url: "https://www.coxautoinc.com/insights/used-vehicle-inventory-december-2025/" },
      { label: "Experian auto loan rates", url: "https://www.experian.com/blogs/ask-experian/average-car-loan-interest-rates-by-credit-score/" },
    ],
  },
]
