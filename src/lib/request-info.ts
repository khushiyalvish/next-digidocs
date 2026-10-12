// Suite kit v7: copied from OnePortal src/lib/request-info.ts. Change it in the hub first, then copy it here.
import "server-only";
import { headers } from "next/headers";
import { getConfig } from "@/lib/config";

/**
 * Who is on the other end of the current request, for audit records and the session list.
 * Never used for a security decision.
 */
export async function getRequestInfo(): Promise<{ ipAddress: string | null; userAgent: string | null }> {
  const requestHeaders = await headers();
  return {
    ipAddress: readClientIp(requestHeaders),
    userAgent: requestHeaders.get("user-agent")?.slice(0, 400) ?? null,
  };
}

/**
 * The client IP, taken only from the header named in CLIENT_IP_HEADER. For a list such as
 * X-Forwarded-For the RIGHT-most entry is used: it was added by our own proxy, while entries
 * further left were supplied by the client and can be anything.
 */
function readClientIp(requestHeaders: Headers): string | null {
  const headerName = getConfig().clientIpHeader;
  if (!headerName) return null;

  const entries = requestHeaders.get(headerName)?.split(",").map((part) => part.trim()).filter(Boolean);
  const ip = entries?.at(-1);
  return ip && ip.length <= 45 ? ip : null;
}
