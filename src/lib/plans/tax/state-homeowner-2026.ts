/**
 * How each state's income tax treats a homeowner's property tax and mortgage interest (tax year 2025,
 * checked against 2025 state instruction booklets where reachable and the Tax Foundation's OBBBA
 * conformity report): whether it allows itemizing (and with what limits), a property-tax deduction or
 * credit, and the programs we don't model (senior / low-income relief, homestead exemptions on the bill,
 * high-income itemized phase-outs). Each entry links its source.
 */

export interface StateHomeownerRules {
  /**
   * none: standard deduction / exemptions only. own: itemizing on the state return (property tax and
   * mortgage interest; state income tax isn't deductible). federal: taxable income starts from federal
   * taxable income, so the federal deduction flows through (less the state income tax in it).
   * federalExcess: only federal itemized deductions beyond the federal standard deduction (Louisiana).
   */
  itemize: "none" | "own" | "federal" | "federalExcess"
  /** The state lets you itemize only if you itemized on your federal return. */
  requiresFederalItemizing?: boolean
  /** Property tax is limited by the federal SALT cap (the year's cap and phase-down), as federally. */
  followsFederalSaltCap?: boolean
  caps?: { propertyTax?: number; mortgageAndPropertyTax?: number; total?: number }
  /** Mortgage debt whose interest counts (default: the federal $750,000). */
  mortgageDebtLimit?: number
  /** A deduction for property tax on your home, separate from itemizing. */
  propertyTaxDeduction?: { max: number }
  /**
   * A credit of `rate` × property tax on your home, up to `max`. It shrinks evenly from `phaseStart` to
   * `incomeLimit` (gone above it); without `phaseStart` it stops at the limit.
   */
  propertyTaxCredit?: {
    rate: number
    max?: number
    incomeLimit?: { single: number; joint: number }
    phaseStart?: { single: number; joint: number }
  }
  notModeled?: string
  source?: string
}

/** Rules by state (and DC). */
export const STATE_HOMEOWNER: Record<string, StateHomeownerRules> = {
  AL: { itemize: "own", followsFederalSaltCap: true, notModeled: "Homestead exemptions (senior/disabled)", source: "https://www.revenue.alabama.gov/wp-content/uploads/2025/11/OBBBA-Executive-Summary_FinalwAppendixA_10.31.25.pdf" },
  AK: { itemize: "none", notModeled: "No income tax; senior/veteran property tax exemption", source: "https://taxfoundation.org/data/all/state/state-income-tax-rates/" },
  AZ: { itemize: "own", followsFederalSaltCap: true, notModeled: "Property Tax Refund Credit (Form 140PTC, low-income/65+)", source: "https://azdor.gov/forms/individual/form-140-arizona-resident-personal-income-tax-booklet" },
  AR: { itemize: "own", mortgageDebtLimit: 1_000_000, notModeled: "Homestead property tax credit on the bill ($500), senior assessment freeze", source: "https://www.dfa.arkansas.gov/wp-content/uploads/2025_AR1000F_and_AR1000NR_Instructions.pdf" },
  CA: { itemize: "own", mortgageDebtLimit: 1_000_000, notModeled: "Homeowners' exemption ($7,000 assessed), senior postponement, high-income itemized phase-out", source: "https://www.ftb.ca.gov/forms/2025/2025-540-ca-instructions.html" },
  CO: { itemize: "federal", notModeled: "Deduction add-back above $300k AGI ($12k single / $16k joint limit); PTC rebate, senior homestead exemption", source: "https://tax.colorado.gov/individual-income-tax-guide" },
  CT: {
    itemize: "none",
    propertyTaxCredit: { rate: 1, max: 300, phaseStart: { single: 49_500, joint: 70_500 }, incomeLimit: { single: 109_500, joint: 130_500 } },
    notModeled: "The credit also covers car tax; elderly/disabled homeowner circuit breaker",
    source: "https://portal.ct.gov/DRS/Individuals/Individual-Tax-Page/Property-Tax-Credit-Limitation",
  },
  DE: { itemize: "own", followsFederalSaltCap: true, notModeled: "Senior school property tax credit", source: "https://revenuefiles.delaware.gov/2025/PITForms_Instructions/Instructions/PIT-RES_Instructions_2025-01.pdf" },
  DC: { itemize: "own", requiresFederalItemizing: true, notModeled: "Itemized reduced 5% of DC AGI over $200k; Schedule H credit (low-income), homestead deduction", source: "https://otr.cfo.dc.gov/sites/default/files/dc/sites/otr/publication/attachments/2025_D40_Book_Final_wLinks_030526_v1.0.pdf" },
  FL: { itemize: "none", notModeled: "No income tax; homestead exemption (on the bill)", source: "https://taxfoundation.org/data/all/state/state-income-tax-rates/" },
  GA: { itemize: "own", requiresFederalItemizing: true, caps: { propertyTax: 10_000 }, notModeled: "Homestead exemptions (on the bill)", source: "https://www.aprio.com/insights-events/georgia-tax-refunds-conformity-update-two-bills-big-impact-ins-article-tax/" },
  HI: { itemize: "own", mortgageDebtLimit: 1_000_000, notModeled: "Itemized limit above $166,800 AGI; county home exemptions", source: "https://files.hawaii.gov/tax/forms/current/n11ins.pdf" },
  ID: { itemize: "own", followsFederalSaltCap: true, notModeled: "Homeowner's exemption (on the bill), Property Tax Reduction (circuit breaker)", source: "https://tax.idaho.gov/document-mngr/forms_EIS00407/" },
  IL: { itemize: "none", propertyTaxCredit: { rate: 0.05, incomeLimit: { single: 250_000, joint: 500_000 } }, notModeled: "General/senior homestead exemptions, senior freeze", source: "https://tax.illinois.gov/research/taxinformation/income/individual/property-tax-credit.html" },
  IN: { itemize: "none", propertyTaxDeduction: { max: 2_500 }, notModeled: "Homestead deduction/credits on the bill, over-65 circuit breaker", source: "https://forms.in.gov/Download.aspx?id=13427" },
  IA: { itemize: "federal", notModeled: "Homestead credit, elderly/disabled property tax credit", source: "https://taxfoundation.org/wp-content/uploads/2025/07/FF864_OBBB_State_Conformity.pdf" },
  KS: { itemize: "own", notModeled: "Homestead refund, SAFESR (senior/disabled/low-income)", source: "https://ksrevenue.gov/incomebook25.html" },
  KY: { itemize: "own", caps: { propertyTax: 0 }, notModeled: "Only mortgage interest and charity are deductible; homestead exemption (65+/disabled)", source: "https://revenue.ky.gov/Forms/740-NP%20Schedule%20A%20(2025).pdf" },
  LA: { itemize: "federalExcess", requiresFederalItemizing: true, notModeled: "Homestead exemption (on the bill)", source: "https://dam.ldr.la.gov/taxforms/IT540i-WEB-2025.pdf" },
  ME: { itemize: "own", requiresFederalItemizing: true, caps: { total: 36_300 }, notModeled: "Property Tax Fairness Credit (income-limited), homestead exemption, itemized phase-out above $100k / $200,050", source: "https://www.maine.gov/revenue/sites/maine.gov.revenue/files/inline-files/25_1040me_gen_instr_w_cover_pg.pdf" },
  MD: { itemize: "own", requiresFederalItemizing: true, followsFederalSaltCap: true, notModeled: "Itemized reduced 7.5% of FAGI over $200k (2025+); Homeowners' Property Tax Credit (income-limited), homestead cap", source: "https://services.marylandcomptroller.gov/taxes?id=kb_article_view&sysparm_article=KB0010023" },
  MA: { itemize: "none", notModeled: "Senior circuit breaker credit, local residential exemptions", source: "https://www.mass.gov/info-details/massachusetts-tax-deductions-and-credits" },
  MI: { itemize: "none", notModeled: "Homestead Property Tax Credit (MI-1040CR, household resources cap), PRE exemption", source: "https://www.michigan.gov/taxes/iit/accordion/credits/homestead-property-tax-credit-information" },
  MN: { itemize: "own", caps: { propertyTax: 10_000 }, mortgageDebtLimit: 750_000, notModeled: "Itemized phase-out above $238,950 AGI; Homestead Credit Refund (income-limited)", source: "https://www.revenue.state.mn.us/sites/default/files/2025-12/m1sa-25_0.pdf" },
  MS: { itemize: "own", followsFederalSaltCap: true, notModeled: "Homestead exemption (on the bill)", source: "https://www.dor.ms.gov/sites/default/files/tax-forms/individual/80100251%202.pdf" },
  MO: { itemize: "own", requiresFederalItemizing: true, followsFederalSaltCap: true, notModeled: "Property Tax Credit / circuit breaker (65+/disabled, low-income)", source: "https://dor.mo.gov/forms/MO-1040%20Instructions_2025.pdf" },
  MT: { itemize: "federal", notModeled: "Property tax rebate, elderly homeowner/renter credit", source: "https://taxfoundation.org/wp-content/uploads/2025/07/FF864_OBBB_State_Conformity.pdf" },
  NE: { itemize: "own", requiresFederalItemizing: true, followsFederalSaltCap: true, notModeled: "Community-college property tax credit; homestead exemption", source: "https://revenue.nebraska.gov/sites/default/files/doc/tax-forms/2025/f_Individual_Income_Tax_Booklet.pdf" },
  NV: { itemize: "none", notModeled: "No income tax; property tax abatement cap (on the bill)", source: "https://taxfoundation.org/data/all/state/state-income-tax-rates/" },
  NH: { itemize: "none", notModeled: "No wage income tax; low/moderate-income homeowners property tax relief", source: "https://taxfoundation.org/data/all/state/state-income-tax-rates/" },
  NJ: { itemize: "none", propertyTaxDeduction: { max: 15_000 }, notModeled: "$50 credit alternative; Senior Freeze, ANCHOR, Stay NJ", source: "https://www.nj.gov/treasury/taxation/njit35.shtml" },
  NM: { itemize: "federal", notModeled: "Property tax rebate (low-income 65+)", source: "https://taxfoundation.org/wp-content/uploads/2025/07/FF864_OBBB_State_Conformity.pdf" },
  NY: { itemize: "own", mortgageDebtLimit: 1_000_000, notModeled: "Itemized limitation above $100k NYAGI (property tax and mortgage interest stop counting above $1M); STAR credit; IT-214 (low-income)", source: "https://www.tax.ny.gov/forms/current-forms/it/it196i.htm" },
  NC: { itemize: "own", caps: { mortgageAndPropertyTax: 20_000 }, notModeled: "Elderly/disabled homestead exclusion, circuit breaker", source: "https://www.ncdor.gov/taxes-forms/individual-income-tax/north-carolina-standard-deduction-or-north-carolina-itemized-deductions" },
  ND: { itemize: "federal", notModeled: "Primary residence credit (on the bill), homestead credit (65+/disabled)", source: "https://taxfoundation.org/wp-content/uploads/2025/07/FF864_OBBB_State_Conformity.pdf" },
  OH: { itemize: "none", notModeled: "Homestead exemption (65+/disabled), owner-occupancy rollback (on the bill)", source: "https://tax.ohio.gov/individual" },
  OK: { itemize: "own", requiresFederalItemizing: true, followsFederalSaltCap: true, caps: { total: 17_000 }, notModeled: "Senior valuation freeze, Property Tax Refund (65+/disabled)", source: "https://oklahoma.gov/content/dam/ok/en/tax/documents/forms/individuals/current/511-Pkt.pdf" },
  OR: { itemize: "own", followsFederalSaltCap: true, notModeled: "Senior/disabled property tax deferral", source: "https://www.oregon.gov/dor/forms/FormsPubs/schedule-or-a-inst_101-007-1_2025.pdf" },
  PA: { itemize: "none", notModeled: "Property Tax/Rent Rebate (seniors/disabled), homestead/farmstead exclusion", source: "https://www.revenue.pa.gov/FormsandPublications/PAPersonalIncomeTaxGuide/Pages/default.aspx" },
  RI: { itemize: "none", notModeled: "Property tax relief credit (RI-1040H, low-income)", source: "https://tax.ri.gov/tax-sections/personal-income-tax" },
  SC: { itemize: "federal", notModeled: "Homestead exemption (65+/disabled), 4% owner-occupied assessment", source: "https://taxfoundation.org/wp-content/uploads/2025/07/FF864_OBBB_State_Conformity.pdf" },
  SD: { itemize: "none", notModeled: "No income tax; senior/disabled property tax relief", source: "https://taxfoundation.org/data/all/state/state-income-tax-rates/" },
  TN: { itemize: "none", notModeled: "No income tax; property tax relief/freeze (seniors/disabled)", source: "https://taxfoundation.org/data/all/state/state-income-tax-rates/" },
  TX: { itemize: "none", notModeled: "No income tax; homestead exemption (on the bill)", source: "https://taxfoundation.org/data/all/state/state-income-tax-rates/" },
  UT: { itemize: "none", notModeled: "Federal deductions feed only the 6% taxpayer tax credit, which phases out at moderate income; circuit breaker", source: "https://tax.utah.gov/forms/current/tc-40inst.pdf" },
  VT: { itemize: "none", notModeled: "Property tax credit via HS-122 (income-limited); charitable credit", source: "https://tax.vermont.gov/property/property-tax-credit" },
  VA: { itemize: "own", requiresFederalItemizing: true, notModeled: "Itemized limit above $332,700 single / $399,200 joint; local senior/disabled relief", source: "https://www.tax.virginia.gov/sites/default/files/vatax-pdf/2025-sch-a-instructions.pdf" },
  WA: { itemize: "none", notModeled: "No wage income tax (capital-gains tax only); senior/disabled exemption", source: "https://taxfoundation.org/data/all/state/state-income-tax-rates/" },
  WV: { itemize: "none", notModeled: "Homestead excess property tax credit (low-income), senior homestead exemption", source: "https://tax.wv.gov/Individuals/Pages/Individuals.aspx" },
  WI: { itemize: "none", propertyTaxCredit: { rate: 0.12, max: 300 }, notModeled: "Itemized deduction credit (excludes property tax); homestead credit (low-income); lottery credit on the bill", source: "https://www.revenue.wi.gov/Pages/FAQS/ise-schprop.aspx" },
  WY: { itemize: "none", notModeled: "No income tax; property tax refund program (income-limited)", source: "https://taxfoundation.org/data/all/state/state-income-tax-rates/" },
}
