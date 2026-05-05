import type { TenantMembership } from "../../types";

function normalizeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/")) {
    return "/painel";
  }

  return next;
}

export function getRequestedDashboardSlug(next: string | null): string | null {
  const normalized = normalizeNextPath(next);
  const match = normalized.match(/^\/dashboard\/([^/?#]+)/);

  if (!match?.[1]) {
    return null;
  }

  return decodeURIComponent(match[1]);
}

export function resolvePostAuthPath(next: string | null, tenants: TenantMembership[]): string {
  const normalized = normalizeNextPath(next);
  const requestedSlug = getRequestedDashboardSlug(normalized);

  if (requestedSlug) {
    const requestedTenant = tenants.find((membership) => membership.tenant.slug === requestedSlug);
    if (requestedTenant) {
      return `/dashboard/${requestedTenant.tenant.slug}`;
    }
  }

  const firstTenantSlug = tenants[0]?.tenant.slug;
  if (firstTenantSlug) {
    return `/dashboard/${firstTenantSlug}`;
  }

  return "/painel";
}
