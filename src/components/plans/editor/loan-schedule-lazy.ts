import dynamic from "next/dynamic"

/** The payment schedule pop-out, loaded when first opened. */
export const LoanScheduleDialog = dynamic(() => import("./loan-schedule-dialog").then((m) => m.LoanScheduleDialog), { ssr: false })
