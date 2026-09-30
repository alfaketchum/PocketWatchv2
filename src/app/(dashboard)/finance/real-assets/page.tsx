import { redirect } from "next/navigation"

/** Homes & Vehicles now live on the Accounts page. */
export default function RealAssetsPage() {
  redirect("/finance/accounts?tab=homes")
}
