"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { checkInbox } from "./[id]/actions";

/**
 * While an enquiry page is open, checks the agency inbox every so often and re-renders when a
 * client's reply came in. Serverless functions can't hold an IMAP connection open to be told about
 * new mail, so the page asks instead; the cron job does the same when nobody is looking.
 */
export function InboxPoller({ intervalMs }: { intervalMs: number }) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      if (document.visibilityState !== "visible") return;
      const result = await checkInbox();
      if (!cancelled && result.imported > 0) router.refresh();
    }
    void tick();
    const timer = setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [intervalMs, router]);

  return null;
}
