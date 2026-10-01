import test from "node:test"
import assert from "node:assert/strict"
import { runReconstructionOnce } from "@/lib/portfolio/reconstruction-guard"

test("reuses in-flight reconstruction even after a caller stops waiting", async () => {
  let complete!: (value: number) => void
  let starts = 0
  const work = () => {
    starts++
    return new Promise<number>((resolve) => { complete = resolve })
  }
  const first = runReconstructionOnce("timeout-user", work)
  await Promise.resolve()
  const timedOut = await Promise.race([first.then(() => false), Promise.resolve(true)])
  assert.equal(timedOut, true)
  const second = runReconstructionOnce("timeout-user", work)
  assert.equal(first, second)
  assert.equal(starts, 1)
  complete(42)
  assert.equal(await second, 42)
  await Promise.resolve()
  assert.equal(await runReconstructionOnce("timeout-user", async () => {
    starts++
    return 43
  }), 43)
  assert.equal(starts, 2)
})

test("releases failed reconstruction for a later retry", async () => {
  let starts = 0
  const work = async () => {
    starts++
    if (starts === 1) throw new Error("provider failure")
    return "recovered"
  }
  await assert.rejects(runReconstructionOnce("failure-user", work), /provider failure/)
  assert.equal(await runReconstructionOnce("failure-user", work), "recovered")
  assert.equal(starts, 2)
})

test("different users can reconstruct independently", async () => {
  let starts = 0
  const work = async () => ++starts
  const values = await Promise.all([
    runReconstructionOnce("user-a", work),
    runReconstructionOnce("user-b", work),
  ])
  assert.deepEqual(values, [1, 2])
})
