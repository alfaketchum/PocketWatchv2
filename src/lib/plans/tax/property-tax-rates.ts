/**
 * Effective property tax rates on owner-occupied homes by state (tax paid ÷ home value), approximate,
 * from the Tax Foundation's state rankings (ACS data). Used as the default property-tax running cost;
 * every plan can override it on the home.
 */
export const STATE_PROPERTY_TAX_RATE: Record<string, number> = {
  AL: 0.0038, AK: 0.0104, AZ: 0.0049, AR: 0.0058, CA: 0.0070, CO: 0.0050, CT: 0.0179, DE: 0.0055, DC: 0.0056,
  FL: 0.0082, GA: 0.0082, HI: 0.0028, ID: 0.0050, IL: 0.0207, IN: 0.0075, IA: 0.0143, KS: 0.0134, KY: 0.0077,
  LA: 0.0053, ME: 0.0109, MD: 0.0100, MA: 0.0104, MI: 0.0128, MN: 0.0102, MS: 0.0067, MO: 0.0091, MT: 0.0070,
  NE: 0.0154, NV: 0.0050, NH: 0.0161, NJ: 0.0223, NM: 0.0067, NY: 0.0140, NC: 0.0072, ND: 0.0099, OH: 0.0136,
  OK: 0.0082, OR: 0.0084, PA: 0.0135, RI: 0.0132, SC: 0.0052, SD: 0.0109, TN: 0.0056, TX: 0.0163, UT: 0.0050,
  VT: 0.0171, VA: 0.0078, WA: 0.0082, WV: 0.0055, WI: 0.0151, WY: 0.0057,
}

/** National average, for plans without a state. */
export const NATIONAL_PROPERTY_TAX_RATE = 0.011

export function propertyTaxRate(state: string | null | undefined): number {
  return (state && STATE_PROPERTY_TAX_RATE[state]) || NATIONAL_PROPERTY_TAX_RATE
}
