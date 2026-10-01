import { getServiceKey } from "@/lib/portfolio/service-keys"
import { mockProvider } from "./mock"
import { rentcastProvider } from "./rentcast"
import type { HomeDataProvider } from "./types"

export type { HomeData, HomeDataProvider } from "./types"

/** RentCast with the user's API key (Settings › API keys, service "rentcast"); sample data without one. */
export async function homeDataProvider(userId: string): Promise<HomeDataProvider> {
  const key = await getServiceKey(userId, "rentcast").catch(() => null)
  return key ? rentcastProvider(key) : mockProvider
}
