import { db } from "@/lib/db";
import { headers } from "next/headers";

export async function logAuditEvent({
  userId,
  action,
  resource,
  details,
}: {
  userId?: string;
  action: string;
  resource: string;
  details?: Record<string, unknown>;
}) {
  try {
    const headersList = await headers();
    const ip =
      headersList.get("x-forwarded-for") ??
      headersList.get("x-real-ip") ??
      "unknown";
    const userAgent = headersList.get("user-agent") ?? "unknown";

    await db.auditLog.create({
      data: {
        userId: userId ?? null,
        action,
        resource,
        details: details ?? {},
        ip: ip.split(",")[0]?.trim() ?? "unknown",
        userAgent: userAgent.slice(0, 200),
      },
    });
  } catch {
    // Audit logging must never break the application
    console.error("Failed to write audit log:", action, resource);
  }
}

export async function logAuthEvent(
  userId: string,
  action: "login" | "logout" | "register" | "failed_login",
) {
  return logAuditEvent({ userId, action, resource: "auth" });
}

export async function logDataAccess(
  userId: string,
  resource: string,
  details?: Record<string, unknown>,
) {
  return logAuditEvent({ userId, action: "read", resource, details });
}

export async function logDataMutation(
  userId: string,
  action: "create" | "update" | "delete",
  resource: string,
  details?: Record<string, unknown>,
) {
  return logAuditEvent({ userId, action, resource, details });
}
