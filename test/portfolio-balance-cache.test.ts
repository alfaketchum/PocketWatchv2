import test from "node:test"
import assert from "node:assert/strict"
import "./setup-env"
import { balanceWalletSet } from "@/lib/portfolio/multi-balance-cache"

test("balance cache identity ignores wallet order and address case", () => {
  const wallets = [
    { address: "0xAAA", chains: ["BASE", "ETH"] },
    { address: "solanaWallet", chains: ["SOL"] },
  ]
  assert.equal(balanceWalletSet(wallets), balanceWalletSet([
    { address: "solanaWallet", chains: ["SOL"] },
    { address: "0xaaa", chains: ["ETH", "BASE"] },
  ]))
})

test("balance cache identity changes on wallet addition, removal or chain change", () => {
  const wallets = [{ address: "0xAAA", chains: ["ETH"] }]
  const original = balanceWalletSet(wallets)
  assert.notEqual(balanceWalletSet([...wallets, { address: "0xBBB", chains: ["ETH"] }]), original)
  assert.notEqual(balanceWalletSet([]), original)
  assert.notEqual(balanceWalletSet([{ address: "0xAAA", chains: ["BASE"] }]), original)
})
