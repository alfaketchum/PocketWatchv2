/**
 * Everything in the app that goes stale: figures that change every year, rules that only change when a law
 * does, and data refreshed automatically. Shown on the Methodology page and meant to be read by a monitoring
 * agent: each item names its source to check, when it usually changes, and the file that holds it.
 */

export type WatchCadence = "yearly" | "legislation" | "automatic"

export interface WatchItem {
  id: string
  area: "Federal tax" | "State tax" | "Payroll & Social Security" | "Property" | "Costs & prices" | "Markets & data"
  what: string
  /** The value in use, as people would say it. */
  current: string
  cadence: WatchCadence
  /** When it usually changes (month published), or what would change it. */
  when: string
  source: string
  sourceUrl: string
  /** Where it lives in the code. */
  file: string
}

export const WATCHLIST: WatchItem[] = [
  // Federal tax
  { id: "fed-brackets", area: "Federal tax", what: "Income tax brackets, standard deduction, long-term gains brackets", current: "2026 (Rev. Proc. 2025-32); standard deduction $16,100 / $32,200", cadence: "yearly", when: "IRS revenue procedure each October–November", source: "IRS inflation adjustments", sourceUrl: "https://www.irs.gov/newsroom", file: "src/lib/plans/tax/federal-2026.ts" },
  { id: "fed-niit", area: "Federal tax", what: "Net investment income tax (3.8%) thresholds", current: "$200,000 single / $250,000 joint, not indexed", cadence: "legislation", when: "Only by new law", source: "IRC §1411", sourceUrl: "https://www.irs.gov/individuals/net-investment-income-tax", file: "src/lib/plans/tax/federal-2026.ts" },
  { id: "fed-salt", area: "Federal tax", what: "SALT deduction cap schedule and phase-down", current: "$40,000 in 2025, +1%/yr to 2029, 30% phase-down over $500k, $10,000 from 2030", cadence: "legislation", when: "Set by the 2025 tax law; any extension or change", source: "One Big Beautiful Bill Act (2025)", sourceUrl: "https://www.congress.gov/bill/119th-congress/house-bill/1", file: "src/lib/plans/tax/itemized-2026.ts" },
  { id: "fed-mortgage", area: "Federal tax", what: "Mortgage interest debt limit", current: "$750,000 (made permanent from 2026)", cadence: "legislation", when: "Only by new law", source: "IRC §163(h)", sourceUrl: "https://www.irs.gov/publications/p936", file: "src/lib/plans/tax/itemized-2026.ts" },
  { id: "fed-home-sale", area: "Federal tax", what: "Home-sale exclusion", current: "$250,000 single / $500,000 joint, 2 of 5 years, not indexed", cadence: "legislation", when: "Only by new law", source: "IRC §121", sourceUrl: "https://www.irs.gov/publications/p523", file: "src/lib/plans/engine/engine-assets.ts" },
  { id: "fed-ss-tax", area: "Federal tax", what: "Taxable Social Security thresholds", current: "$25,000 / $34,000 single, $32,000 / $44,000 joint, not indexed", cadence: "legislation", when: "Only by new law (proposals to change it come up often)", source: "IRC §86", sourceUrl: "https://www.ssa.gov/benefits/retirement/planner/taxes.html", file: "src/lib/plans/tax/social-security-tax.ts" },
  { id: "fed-rental", area: "Federal tax", what: "Rental depreciation period", current: "27.5 years, building share 80%", cadence: "legislation", when: "Only by new law", source: "IRS Publication 527", sourceUrl: "https://www.irs.gov/publications/p527", file: "src/lib/plans/plan-rentals.ts" },
  { id: "fed-inherited-ira", area: "Federal tax", what: "Inherited IRA payout window", current: "10 years (SECURE Act)", cadence: "legislation", when: "Only by new law or final IRS regulations", source: "SECURE Act", sourceUrl: "https://www.irs.gov/retirement-plans/retirement-topics-beneficiary", file: "src/lib/plans/milestone-templates.ts" },
  // State tax
  { id: "state-brackets", area: "State tax", what: "State income tax brackets, rates and standard deductions (50 states + DC)", current: "2026", cadence: "yearly", when: "States legislate through spring; Tax Foundation publishes each February", source: "Tax Foundation: state income tax rates", sourceUrl: "https://taxfoundation.org/data/all/state/state-income-tax-rates/", file: "src/lib/plans/tax/state-2026.ts" },
  { id: "state-gains", area: "State tax", what: "States taxing capital gains differently (AR, AZ, HI, MA, MT, ND, NM, SC, VT, WA, WI)", current: "2026 (WA: 7% / 9.9% over $1M, $278,000 deduction)", cadence: "legislation", when: "State sessions; WA's deduction is indexed yearly", source: "State revenue departments", sourceUrl: "https://dor.wa.gov/taxes-rates/other-taxes/capital-gains-tax", file: "src/lib/plans/tax/state-gains-2026.ts" },
  { id: "state-ss", area: "State tax", what: "States that tax Social Security", current: "CO, CT, MN, MT, NM, RI, UT, VT", cadence: "legislation", when: "State sessions (several are phasing it out)", source: "State revenue departments", sourceUrl: "https://www.ssa.gov/benefits/retirement/planner/taxes.html", file: "src/lib/plans/tax/social-security-tax.ts" },
  { id: "state-homeowner", area: "State tax", what: "State itemized deductions, property-tax deductions and credits", current: "2026 rules per state", cadence: "legislation", when: "State sessions", source: "State revenue departments (linked per state in the file)", sourceUrl: "https://taxfoundation.org/", file: "src/lib/plans/tax/state-homeowner-2026.ts" },
  { id: "state-inheritance", area: "State tax", what: "State inheritance taxes", current: "KY, MD, NE, NJ, PA", cadence: "legislation", when: "State sessions", source: "State revenue departments", sourceUrl: "https://taxfoundation.org/data/all/state/estate-inheritance-taxes/", file: "src/lib/plans/tax/inheritance-tax.ts" },
  // Payroll & Social Security
  { id: "ss-wage-base", area: "Payroll & Social Security", what: "Social Security wage base", current: "$184,500 (2026)", cadence: "yearly", when: "SSA announces each October with the COLA", source: "SSA COLA fact sheet", sourceUrl: "https://www.ssa.gov/oact/cola/cbb.html", file: "src/lib/plans/tax/payroll-2026.ts" },
  { id: "ss-earnings-test", area: "Payroll & Social Security", what: "Earnings test limits", current: "$24,480 / $65,160 (2026)", cadence: "yearly", when: "SSA each October", source: "SSA: exempt amounts", sourceUrl: "https://www.ssa.gov/oact/cola/rtea.html", file: "src/lib/plans/engine/engine-social-security.ts" },
  { id: "ss-medicare", area: "Payroll & Social Security", what: "Payroll tax rates and Additional Medicare thresholds", current: "6.2% + 1.45%; 0.9% over $200k / $250k (not indexed)", cadence: "legislation", when: "Only by new law", source: "IRS: Topic 751", sourceUrl: "https://www.irs.gov/taxtopics/tc751", file: "src/lib/plans/tax/payroll-2026.ts" },
  { id: "ss-rules", area: "Payroll & Social Security", what: "Claiming factors, full retirement age, spousal and survivor rules", current: "FRA 67 for 1960+; 70% at 62, 124% at 70; spousal 50%; widow's limit 82.5%", cadence: "legislation", when: "Only by new law", source: "SSA: benefits by claiming age", sourceUrl: "https://www.ssa.gov/oact/progdata/retirebenefit2.html", file: "src/lib/plans/social-security.ts" },
  { id: "ss-trustees", area: "Payroll & Social Security", what: "Trust fund shortfall preset", current: "22% cut from 2033 (2026 Trustees Report)", cadence: "yearly", when: "Trustees Report each spring–summer", source: "SSA Trustees Report", sourceUrl: "https://www.ssa.gov/oact/trsum/", file: "src/components/plans/editor/social-security-outlook.tsx" },
  // Property
  { id: "property-tax-rates", area: "Property", what: "Effective property tax rate by state", current: "Per-state effective rates; national 1.1%", cadence: "yearly", when: "Tax Foundation / Census ACS updates each year", source: "Tax Foundation: property taxes by state", sourceUrl: "https://taxfoundation.org/data/all/state/property-taxes-by-state-county/", file: "src/lib/plans/tax/property-tax-rates.ts" },
  { id: "loan-rates", area: "Property", what: "Typical loan terms (mortgage 6.5% / 30 yrs, car 7.5% / 5 yrs)", current: "Rough 2026 levels", cadence: "yearly", when: "Rates move weekly; review at least quarterly", source: "Freddie Mac PMMS; Experian auto finance", sourceUrl: "https://www.freddiemac.com/pmms", file: "src/lib/plans/plan-financing.ts" },
  // Costs & prices
  { id: "elder-care", area: "Costs & prices", what: "Long-term care costs by state", current: "FLTCIP 2024 Cost of Care Survey", cadence: "yearly", when: "New survey each year (FLTCIP; Genworth/CareScout each spring)", source: "FLTCIP Cost of Care Survey", sourceUrl: "https://www.ltcfeds.gov/long-term-care/costs", file: "src/lib/plans/elder-care-costs-2024.ts" },
  { id: "vehicles", area: "Costs & prices", what: "Vehicle prices, loan rates and depreciation curve", current: "New $50,300; used $26,000; loans 6.35% / 11.19%; −20% year 1", cadence: "yearly", when: "KBB and Cox monthly, Experian quarterly; review yearly", source: "Kelley Blue Book; Cox Automotive; Experian; iSeeCars", sourceUrl: "https://www.coxautoinc.com/insights/", file: "src/lib/plans/vehicle-depreciation.ts" },
  { id: "running-costs", area: "Costs & prices", what: "Typical home and vehicle running costs", current: "Home insurance 0.35%, maintenance 1%; car insurance $1,800, maintenance $1,000, registration $400", cadence: "yearly", when: "Review yearly (insurance has been rising fast)", source: "Industry averages (Bankrate, AAA Your Driving Costs)", sourceUrl: "https://newsroom.aaa.com/", file: "src/lib/plans/plan-asset-costs.ts" },
  // Markets & data
  { id: "breakevens", area: "Markets & data", what: "Market inflation expectations (TIPS breakevens)", current: "Refreshed daily", cadence: "automatic", when: "Daily from FRED (cached a day)", source: "St. Louis Fed (FRED)", sourceUrl: "https://fred.stlouisfed.org/series/T10YIE", file: "src/lib/plans/market-inflation-source.ts" },
  { id: "shiller", area: "Markets & data", what: "Historical stock and bond returns, CAPE and CPI since 1871", current: "Through Aug 2026", cadence: "yearly", when: "Shiller updates monthly; rebuild with scripts/build-shiller-data.py", source: "Robert Shiller's data", sourceUrl: "https://shillerdata.com/", file: "src/lib/fire/data/shiller-monthly.json" },
  { id: "life-table", area: "Markets & data", what: "US life table (Rich, broke or dead)", current: "CDC 2023", cadence: "yearly", when: "CDC publishes a new year's table annually", source: "CDC NCHS life tables", sourceUrl: "https://www.cdc.gov/nchs/products/life_tables.htm", file: "src/lib/fire/data/us-life-table.json" },
  { id: "scf", area: "Markets & data", what: "Net worth by age (How you compare)", current: "Survey of Consumer Finances 2022", cadence: "yearly", when: "Every three years (next: 2025 survey, released late 2026)", source: "Federal Reserve SCF", sourceUrl: "https://www.federalreserve.gov/econres/scfindex.htm", file: "src/lib/fire/data/scf-networth.json" },
  { id: "wages", area: "Markets & data", what: "Wages by occupation and area (How you compare)", current: "BLS OEWS / Census ACS", cadence: "yearly", when: "OEWS each spring; ACS each fall", source: "BLS OEWS; Census ACS", sourceUrl: "https://www.bls.gov/oes/", file: "src/lib/fire/bls-oews.ts" },
]

export const CADENCE_LABELS: Record<WatchCadence, string> = {
  yearly: "Every year",
  legislation: "When a law changes",
  automatic: "Updated automatically",
}
