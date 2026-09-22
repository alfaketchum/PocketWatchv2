/**
 * Account directory hooks barrel.
 *
 * Re-exports the module hooks plus the shared Gmail connection hooks (owned by
 * the trips module) so the accounts UI imports connect/scan/disconnect from one
 * place without duplicating the OAuth layer.
 */

export * from "./shared"
export * from "./use-accounts"
export {
  useGmailAccounts,
  useDisconnectGmail,
  type GmailAccount,
} from "@/hooks/use-trips"
