/**
 * Institution logo resolution with static map + Clearbit logo fallback.
 * Clearbit returns high-res (800px+) logos vs Google favicons (128px max).
 */

function logoUrl(domain: string): string {
  return `https://logo.clearbit.com/${domain}?size=256`
}

// Common Plaid institution IDs mapped to high-quality logo URLs
const INSTITUTION_LOGOS: Record<string, string> = {
  ins_3: logoUrl("chase.com"),
  ins_4: logoUrl("wellsfargo.com"),
  ins_5: logoUrl("bankofamerica.com"),
  ins_6: logoUrl("citi.com"),
  ins_10: logoUrl("americanexpress.com"),
  ins_12: logoUrl("fidelity.com"),
  ins_13: logoUrl("schwab.com"),
  ins_14: logoUrl("tdbank.com"),
  ins_15: logoUrl("usbank.com"),
  ins_16: logoUrl("capitalone.com"),
  ins_19: logoUrl("pnc.com"),
  ins_20: logoUrl("ally.com"),
  ins_21: logoUrl("discover.com"),
  ins_25: logoUrl("marcus.com"),
  ins_27: logoUrl("navyfederal.org"),
  ins_29: logoUrl("suntrust.com"),
  ins_32: logoUrl("regions.com"),
  ins_33: logoUrl("53.com"),
  ins_34: logoUrl("keybank.com"),
  ins_35: logoUrl("citizensbank.com"),
  ins_100103: logoUrl("sofi.com"),
  ins_100089: logoUrl("chime.com"),
  ins_116284: logoUrl("venmo.com"),
  ins_127989: logoUrl("robinhood.com"),
}

// Institution name → domain mapping for Google favicon fallback
const NAME_TO_DOMAIN: Record<string, string> = {
  "chase": "chase.com",
  "bank of america": "bankofamerica.com",
  "wells fargo": "wellsfargo.com",
  "citi": "citi.com",
  "citibank": "citi.com",
  "capital one": "capitalone.com",
  "american express": "americanexpress.com",
  "amex": "americanexpress.com",
  "discover": "discover.com",
  "us bank": "usbank.com",
  "pnc": "pnc.com",
  "td bank": "tdbank.com",
  "ally": "ally.com",
  "ally bank": "ally.com",
  "navy federal": "navyfederal.org",
  "usaa": "usaa.com",
  "fidelity": "fidelity.com",
  "charles schwab": "schwab.com",
  "schwab": "schwab.com",
  "goldman sachs": "marcus.com",
  "marcus": "marcus.com",
  "sofi": "sofi.com",
  "chime": "chime.com",
  "robinhood": "robinhood.com",
  "vanguard": "vanguard.com",
  "regions": "regions.com",
  "fifth third": "53.com",
  "key bank": "keybank.com",
  "keybank": "keybank.com",
  "citizens": "citizensbank.com",
  "citizens bank": "citizensbank.com",
  "truist": "truist.com",
  "huntington": "huntington.com",
  "m&t bank": "mtb.com",
  "bmo": "bmo.com",
  "wealthfront": "wealthfront.com",
  "betterment": "betterment.com",
  "empower": "personalcapital.com",
  "empower retirement": "personalcapital.com",
  "personal capital": "personalcapital.com",
  "paypal": "paypal.com",
  "venmo": "venmo.com",
}

/** Institution name → primary domain ("Chase" → "chase.com"), or null. */
export function institutionNameToDomain(institutionName: string): string | null {
  const nameLower = institutionName.toLowerCase().trim()
  if (NAME_TO_DOMAIN[nameLower]) return NAME_TO_DOMAIN[nameLower]
  for (const [key, domain] of Object.entries(NAME_TO_DOMAIN)) {
    if (nameLower.includes(key)) return domain
  }
  return null
}

/**
 * Resolve institution logo. Fallback chain:
 * 1. Plaid-provided logo URL
 * 2. Static institution ID map
 * 3. Google favicon from institution name
 * 4. null
 */
export function resolveInstitutionLogo(
  plaidLogo: string | null | undefined,
  institutionId: string | null | undefined,
  institutionName: string
): string | null {
  // 1. Static map by institution ID (highest-res, most reliable)
  if (institutionId && INSTITUTION_LOGOS[institutionId]) {
    return INSTITUTION_LOGOS[institutionId]
  }

  // 2. Clearbit logo from institution name (high-res)
  const nameLower = institutionName.toLowerCase().trim()
  const domain = NAME_TO_DOMAIN[nameLower]
  if (domain) {
    return logoUrl(domain)
  }

  // Partial name match
  for (const [key, dom] of Object.entries(NAME_TO_DOMAIN)) {
    if (nameLower.includes(key)) {
      return logoUrl(dom)
    }
  }

  // 3. Plaid logo URL (http/https) — decent quality
  if (plaidLogo && (plaidLogo.startsWith("http://") || plaidLogo.startsWith("https://"))) {
    return plaidLogo
  }

  // 4. Plaid base64 logo — last resort (often low-res/blurry)
  if (plaidLogo && plaidLogo.length > 100 && !plaidLogo.startsWith("http")) {
    return `data:image/png;base64,${plaidLogo}`
  }

  return null
}
