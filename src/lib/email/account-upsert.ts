/**
 * Persist one extracted account signal into DiscoveredAccount, keyed by
 * (userId, serviceDomain, accountEmailHash). Merges signal types / message refs
 * into an existing row and never clobbers user-curated fields.
 */

import { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/db"
import type { GmailAccount, GmailMessage } from "@/lib/integrations/gmail-client"
import { hashAccountEmail } from "./account-hash"
import type { ExtractedAccount } from "./account-extractor"

export type UpsertOutcome = "imported" | "updated"

function parseDate(raw: string): Date | null {
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
}

export async function upsertDiscoveredAccount(
  userId: string,
  account: GmailAccount,
  msg: GmailMessage,
  extracted: ExtractedAccount,
): Promise<UpsertOutcome> {
  try {
    return await writeAccount(userId, account, msg, extracted)
  } catch (err) {
    // Concurrent messages for the same service can race on create; the loser
    // retries once and lands on the update path.
    if (!isUniqueViolation(err)) throw err
    return writeAccount(userId, account, msg, extracted)
  }
}

async function writeAccount(
  userId: string,
  account: GmailAccount,
  msg: GmailMessage,
  extracted: ExtractedAccount,
): Promise<UpsertOutcome> {
  const accountEmailHash = hashAccountEmail(extracted.accountEmail)
  const seenAt = parseDate(msg.date)

  const existing = await db.discoveredAccount.findUnique({
    where: {
      userId_serviceDomain_accountEmailHash: {
        userId,
        serviceDomain: extracted.serviceDomain,
        accountEmailHash,
      },
    },
    select: {
      id: true,
      signalTypes: true,
      sourceRefs: true,
      firstSeenAt: true,
      lastSeenAt: true,
      confidence: true,
      userEdited: true,
      category: true,
      extractedBy: true,
      paymentLast4: true,
    },
  })

  if (!existing) {
    await db.discoveredAccount.create({
      data: {
        userId,
        serviceName: extracted.serviceName,
        serviceDomain: extracted.serviceDomain,
        category: extracted.category,
        accountEmail: extracted.accountEmail,
        accountEmailHash,
        sourceService: account.service,
        signalTypes: [extracted.signalType],
        evidence: {
          subject: msg.subject.slice(0, 200),
          from: msg.from.slice(0, 200),
          snippet: msg.bodyText.slice(0, 200),
        },
        sourceRefs: [msg.id],
        confidence: extracted.confidence,
        extractedBy: extracted.extractedBy,
        firstSeenAt: seenAt,
        lastSeenAt: seenAt,
        paymentBrand: extracted.paymentBrand,
        paymentLast4: extracted.paymentLast4,
      },
    })
    return "imported"
  }

  const isNewest = !!seenAt && (!existing.lastSeenAt || seenAt >= existing.lastSeenAt)
  // A heuristic hit must not overwrite a name/category the LLM already produced.
  const canRename =
    !existing.userEdited &&
    (extracted.extractedBy === "llm" || existing.extractedBy !== "llm")
  // Latest receipt wins, so a replaced card is picked up.
  const takePayment = !!extracted.paymentLast4 && (isNewest || !existing.paymentLast4)

  await db.discoveredAccount.update({
    where: { id: existing.id },
    data: {
      signalTypes: existing.signalTypes.includes(extracted.signalType)
        ? existing.signalTypes
        : [...existing.signalTypes, extracted.signalType],
      sourceRefs: existing.sourceRefs.includes(msg.id)
        ? existing.sourceRefs
        : [...existing.sourceRefs, msg.id],
      lastSeenAt: isNewest ? seenAt : existing.lastSeenAt,
      firstSeenAt:
        seenAt && (!existing.firstSeenAt || seenAt < existing.firstSeenAt)
          ? seenAt
          : existing.firstSeenAt,
      confidence: Math.max(existing.confidence, extracted.confidence),
      ...(extracted.extractedBy === "llm" ? { extractedBy: "llm" } : {}),
      ...(canRename
        ? {
            serviceName: extracted.serviceName,
            category: extracted.category ?? existing.category,
          }
        : {}),
      ...(takePayment
        ? { paymentBrand: extracted.paymentBrand, paymentLast4: extracted.paymentLast4 }
        : {}),
    },
  })
  return "updated"
}
