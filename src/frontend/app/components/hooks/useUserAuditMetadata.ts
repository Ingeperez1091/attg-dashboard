import { useMemo } from "react";
import { AdminUserDto } from "@/core/application/dto/admin/AdminUserDto";

export interface UserDirectoryEntry {
  userId: string;
  displayName: string | null;
  email: string;
}
import { UserAuditMetadataDto } from "@/core/application/dto/shared/UserAuditMetadataDto";

export function resolveUserDisplayName(actorId: string, userDirectory: UserDirectoryEntry[]): string {
  const match = userDirectory.find((candidate) => candidate.userId === actorId);
  if (match) {
    return match.displayName?.trim() || match.email;
  }

  return actorId;
}

function parseUtcDate(raw: unknown): Date | null {
  if (raw === null || raw === undefined) {
    return null;
  }

  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? null : raw;
  }

  const asString = typeof raw === "string" ? raw : String(raw);
  const trimmed = asString.trim().replace(" ", "T");
  if (!trimmed) {
    return null;
  }

  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(trimmed);
  const zoned = hasZone ? trimmed : `${trimmed}Z`;
  const normalized = zoned.replace(/\.(\d{3})\d+(?=([zZ]|[+-]\d{2}:?\d{2})$)/, ".$1");

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatUpdateDate(value: unknown): string {
  const parsed = parseUtcDate(value);
  if (!parsed) {
    return value === null || value === undefined ? "Unknown" : String(value);
  }

  // Convert UTC source value to local date and local daytime on the client.
  const localDate = parsed.toLocaleDateString(undefined, { dateStyle: "medium" });
  const localTime = parsed.toLocaleTimeString(undefined, { timeStyle: "short" });
  return `${localDate} ${localTime}`;
}

export function useUserAuditMetadata(user: AdminUserDto | undefined, userDirectory: AdminUserDto[]): UserAuditMetadataDto {
  return useMemo(() => {
    if (!user) {
      return {
        createdByName: "Unknown",
        updatedByName: "Unknown",
        updatedAtLabel: "Unknown"
      };
    }

    return {
      createdByName: resolveUserDisplayName(user.createdBy, userDirectory),
      updatedByName: resolveUserDisplayName(user.updatedBy, userDirectory),
      updatedAtLabel: formatUpdateDate(user.updateDate)
    };
  }, [user, userDirectory]);
}
