/**
 * Merchant logo resolution for bills.
 * Multi-layer lookup: transaction history → known domains → domain guessing.
 */

import { db } from "@/lib/db"

/**
 * Well-known merchant keywords → domain.
 * Keys are lowercase substrings that can appear anywhere in the merchant name.
 * More specific keys should come first (checked in order for substring matches).
 */
const MERCHANT_DOMAINS: Record<string, string> = {
  // Streaming & entertainment
  netflix: "netflix.com",
  spotify: "spotify.com",
  hulu: "hulu.com",
  "disney+": "disneyplus.com",
  "disney plus": "disneyplus.com",
  disneyplus: "disneyplus.com",
  "prime video": "primevideo.com",
  "amazon prime": "amazon.com",
  "amazon music": "music.amazon.com",
  "amzn prime": "amazon.com",
  "amzn mktp": "amazon.com",
  "amzn digital": "amazon.com",
  amazon: "amazon.com",
  audible: "audible.com",
  "youtube premium": "youtube.com",
  "youtube music": "youtube.com",
  youtube: "youtube.com",
  "apple music": "apple.com",
  "apple tv": "apple.com",
  "apple one": "apple.com",
  "apple.com": "apple.com",
  icloud: "icloud.com",
  "hbo max": "max.com",
  "max.com": "max.com",
  "paramount+": "paramountplus.com",
  "paramount plus": "paramountplus.com",
  peacock: "peacocktv.com",
  crunchyroll: "crunchyroll.com",
  funimation: "funimation.com",
  tidal: "tidal.com",
  deezer: "deezer.com",
  "pandora": "pandora.com",
  "siriusxm": "siriusxm.com",
  "sirius xm": "siriusxm.com",
  "apple arcade": "apple.com",
  "discovery+": "discoveryplus.com",
  "espn+": "plus.espn.com",
  espn: "espn.com",
  "showtime": "sho.com",
  "starz": "starz.com",
  "britbox": "britbox.com",
  "mubi": "mubi.com",
  "curiosity stream": "curiositystream.com",
  twitch: "twitch.tv",
  "kick.com": "kick.com",

  // Gaming
  xbox: "xbox.com",
  "game pass": "xbox.com",
  playstation: "playstation.com",
  "ps plus": "playstation.com",
  "psn": "playstation.com",
  nintendo: "nintendo.com",
  steam: "steampowered.com",
  "epic games": "epicgames.com",
  "ea play": "ea.com",
  "riot games": "riotgames.com",
  "blizzard": "blizzard.com",
  roblox: "roblox.com",

  // Software & productivity
  adobe: "adobe.com",
  "microsoft 365": "microsoft.com",
  "office 365": "microsoft.com",
  microsoft: "microsoft.com",
  "google one": "one.google.com",
  "google storage": "one.google.com",
  "google workspace": "workspace.google.com",
  google: "google.com",
  dropbox: "dropbox.com",
  notion: "notion.so",
  slack: "slack.com",
  zoom: "zoom.us",
  openai: "openai.com",
  chatgpt: "openai.com",
  claude: "anthropic.com",
  anthropic: "anthropic.com",
  github: "github.com",
  gitlab: "gitlab.com",
  figma: "figma.com",
  canva: "canva.com",
  grammarly: "grammarly.com",
  evernote: "evernote.com",
  todoist: "todoist.com",
  asana: "asana.com",
  trello: "trello.com",
  "monday.com": "monday.com",
  clickup: "clickup.com",
  linear: "linear.app",
  miro: "miro.com",
  airtable: "airtable.com",
  webflow: "webflow.com",
  squarespace: "squarespace.com",
  wix: "wix.com",
  shopify: "shopify.com",
  godaddy: "godaddy.com",
  namecheap: "namecheap.com",
  wordpress: "wordpress.com",
  mailchimp: "mailchimp.com",
  hubspot: "hubspot.com",
  salesforce: "salesforce.com",
  quickbooks: "quickbooks.intuit.com",
  intuit: "intuit.com",
  turbotax: "turbotax.intuit.com",
  freshbooks: "freshbooks.com",
  xero: "xero.com",
  gusto: "gusto.com",

  // Security & VPN
  "1password": "1password.com",
  lastpass: "lastpass.com",
  bitwarden: "bitwarden.com",
  dashlane: "dashlane.com",
  nordvpn: "nordvpn.com",
  expressvpn: "expressvpn.com",
  surfshark: "surfshark.com",
  proton: "proton.me",
  "proton vpn": "protonvpn.com",
  "proton mail": "proton.me",
  mullvad: "mullvad.net",

  // Cloud & dev
  "amazon web services": "aws.amazon.com",
  aws: "aws.amazon.com",
  vercel: "vercel.com",
  heroku: "heroku.com",
  netlify: "netlify.com",
  digitalocean: "digitalocean.com",
  cloudflare: "cloudflare.com",
  linode: "linode.com",
  render: "render.com",
  railway: "railway.app",
  supabase: "supabase.com",
  firebase: "firebase.google.com",
  mongodb: "mongodb.com",
  datadog: "datadoghq.com",
  sentry: "sentry.io",
  newrelic: "newrelic.com",

  // Fitness & health
  "planet fitness": "planetfitness.com",
  peloton: "onepeloton.com",
  strava: "strava.com",
  headspace: "headspace.com",
  calm: "calm.com",
  noom: "noom.com",
  myfitnesspal: "myfitnesspal.com",
  fitbit: "fitbit.com",
  "24 hour fitness": "24hourfitness.com",
  "lifetime fitness": "lifetime.life",
  "la fitness": "lafitness.com",
  "orange theory": "orangetheory.com",
  orangetheory: "orangetheory.com",
  "equinox": "equinox.com",
  "anytime fitness": "anytimefitness.com",
  "crunch fitness": "crunch.com",
  whoop: "whoop.com",
  oura: "ouraring.com",

  // Education & learning
  duolingo: "duolingo.com",
  coursera: "coursera.org",
  udemy: "udemy.com",
  skillshare: "skillshare.com",
  masterclass: "masterclass.com",
  "brilliant.org": "brilliant.org",
  brilliant: "brilliant.org",
  codecademy: "codecademy.com",
  pluralsight: "pluralsight.com",
  linkedin: "linkedin.com",

  // News & media
  "new york times": "nytimes.com",
  nyt: "nytimes.com",
  "wall street journal": "wsj.com",
  wsj: "wsj.com",
  "washington post": "washingtonpost.com",
  "the athletic": "theathletic.com",
  medium: "medium.com",
  substack: "substack.com",
  patreon: "patreon.com",
  "the economist": "economist.com",
  "bloomberg": "bloomberg.com",
  "financial times": "ft.com",
  "wired": "wired.com",
  "the information": "theinformation.com",

  // Hotels & travel
  hyatt: "hyatt.com",
  "world of hyatt": "hyatt.com",
  marriott: "marriott.com",
  hilton: "hilton.com",
  ihg: "ihg.com",
  "holiday inn": "ihg.com",
  wyndham: "wyndham.com",

  // Telecom & utilities
  "t-mobile": "t-mobile.com",
  tmobile: "t-mobile.com",
  "at&t": "att.com",
  "att wireless": "att.com",
  "att.com": "att.com",
  verizon: "verizon.com",
  xfinity: "xfinity.com",
  comcast: "xfinity.com",
  spectrum: "spectrum.com",
  "cox comm": "cox.com",
  cox: "cox.com",
  "centurylink": "centurylink.com",
  frontier: "frontier.com",
  "google fi": "fi.google.com",
  mint: "mintmobile.com",
  "mint mobile": "mintmobile.com",
  visible: "visible.com",
  cricket: "cricketwireless.com",
  boost: "boostmobile.com",

  // Insurance
  "state farm": "statefarm.com",
  geico: "geico.com",
  progressive: "progressive.com",
  allstate: "allstate.com",
  "liberty mutual": "libertymutual.com",
  usaa: "usaa.com",
  nationwide: "nationwide.com",
  "farmers insurance": "farmers.com",
  travelers: "travelers.com",
  lemonade: "lemonade.com",
  "root insurance": "rootinsurance.com",

  // Food & delivery
  "doordash dashpass": "doordash.com",
  "uber one": "uber.com",
  "uber eats": "uber.com",
  "grubhub+": "grubhub.com",
  instacart: "instacart.com",
  "hello fresh": "hellofresh.com",
  hellofresh: "hellofresh.com",
  "blue apron": "blueapron.com",

  // Social & messaging
  telegram: "telegram.org",
  whatsapp: "whatsapp.com",
  discord: "discord.com",
  "bumble": "bumble.com",
  "tinder": "tinder.com",
  "hinge": "hinge.co",

  // Finance apps
  ynab: "ynab.com",
  "you need a budget": "ynab.com",
  copilot: "copilot.money",
  monarch: "monarchmoney.com",
  "personal capital": "personalcapital.com",
  empower: "empower.com",

  // Misc
  "costco membership": "costco.com",
  "sam's club": "samsclub.com",
  "amazon subscribe": "amazon.com",
  chewy: "chewy.com",
  "bark box": "barkbox.com",
  barkbox: "barkbox.com",
  ipsy: "ipsy.com",
  birchbox: "birchbox.com",
  "dollar shave": "dollarshaveclub.com",
  "harry's": "harrys.com",

  // Banks & credit cards (for CC payment bills)
  chase: "chase.com",
  "bank of america": "bankofamerica.com",
  "wells fargo": "wellsfargo.com",
  citi: "citi.com",
  citibank: "citi.com",
  "capital one": "capitalone.com",
  "american express": "americanexpress.com",
  amex: "americanexpress.com",
  discover: "discover.com",
  "us bank": "usbank.com",
  barclays: "barclays.com",
  "td bank": "tdbank.com",
  synchrony: "synchrony.com",
  "apple card": "apple.com",
  "navy federal": "navyfederal.org",
  pnc: "pnc.com",
  "ally bank": "ally.com",
  ally: "ally.com",
  sofi: "sofi.com",
  marcus: "marcus.com",
}

function faviconUrl(domain: string): string {
  return `https://logo.clearbit.com/${domain}?size=128`
}

/** Try to match a merchant name against the known domains map */
function resolveFromKnownDomains(merchantName: string): string | null {
  const lower = merchantName.toLowerCase().replace(/\s*••••\d+$/, "").trim()
  if (MERCHANT_DOMAINS[lower]) return MERCHANT_DOMAINS[lower]
  for (const [key, domain] of Object.entries(MERCHANT_DOMAINS)) {
    if (lower.includes(key)) return domain
  }
  return null
}

/**
 * Heuristic: guess domain from a clean merchant name.
 * "Hulu" → "hulu.com", "Planet Fitness" → "planetfitness.com"
 * Only tries single-word or known patterns; skips anything too generic.
 */
function guessDomain(merchantName: string): string | null {
  const cleaned = merchantName
    .toLowerCase()
    .replace(/\s*••••\d+$/, "")
    .replace(/[^a-z0-9\s.-]/g, "")
    .trim()
  if (!cleaned || cleaned.length < 3 || cleaned.length > 30) return null
  // Skip names that look like CC payments or generic labels
  if (/credit|card|payment|auto.?pay|bank|loan|mortgage|fee/i.test(cleaned)) return null
  // If it already looks like a domain, use it
  if (/^[a-z0-9-]+\.(com|io|co|org|net|app|tv|so|me)$/.test(cleaned)) return cleaned
  // Single word → try .com
  const words = cleaned.split(/\s+/)
  if (words.length === 1 && words[0].length >= 3) return `${words[0]}.com`
  // Two words joined → try joined.com
  if (words.length === 2) return `${words.join("")}.com`
  return null
}

/**
 * Best-effort merchant name → registrable domain ("NETFLIX.COM" / "Netflix" →
 * "netflix.com"). Known merchants first, then the name-shape guess.
 */
export function merchantNameToDomain(merchantName: string): string | null {
  return resolveFromKnownDomains(merchantName) ?? guessDomain(merchantName)
}

/** Only the curated merchant map — no guessing (for high-precision matching). */
export function knownMerchantDomain(merchantName: string): string | null {
  return resolveFromKnownDomains(merchantName)
}

/**
 * Look up logos for a list of merchant names.
 * 1. Transaction history (Plaid-provided logoUrl)
 * 2. Known domains map (250+ merchants)
 * 3. Domain guessing heuristic
 */
export async function lookupMerchantLogos(
  userId: string,
  merchantNames: string[],
): Promise<Map<string, string>> {
  const logoMap = new Map<string, string>()
  if (merchantNames.length === 0) return logoMap

  const transactions = await db.financeTransaction.findMany({
    where: { userId, logoUrl: { not: null }, merchantName: { not: null } },
    select: { merchantName: true, logoUrl: true },
    orderBy: { date: "desc" },
    take: 500,
  })

  const txLogoMap = new Map<string, string>()
  for (const tx of transactions) {
    if (!tx.merchantName || !tx.logoUrl) continue
    const lower = tx.merchantName.toLowerCase()
    if (!txLogoMap.has(lower)) txLogoMap.set(lower, tx.logoUrl)
  }

  for (const name of merchantNames) {
    const cleanName = name.replace(/\s*••••\d+$/, "").trim().toLowerCase()

    // 1. Exact match from transactions
    const txLogo = txLogoMap.get(cleanName)
    if (txLogo) { logoMap.set(name, txLogo); continue }

    // 2. Partial match from transactions
    let found = false
    for (const [txName, logo] of txLogoMap) {
      if (txName.includes(cleanName) || cleanName.includes(txName)) {
        logoMap.set(name, logo); found = true; break
      }
    }
    if (found) continue

    // 3. Known domains
    const known = resolveFromKnownDomains(name)
    if (known) { logoMap.set(name, faviconUrl(known)); continue }

    // 4. Domain guessing
    const guessed = guessDomain(name)
    if (guessed) logoMap.set(name, faviconUrl(guessed))
  }

  return logoMap
}
