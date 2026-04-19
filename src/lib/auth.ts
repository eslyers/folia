// src/lib/auth.ts - RBAC Authorization Helpers
// These functions check user roles and permissions

import type { UserRole, Profile } from "@/lib/types";

// =====================================================
// TYPE DEFINITIONS
// =====================================================

export type { UserRole };

// =====================================================
// ROLE CHECK HELPERS
// =====================================================

export function isMasterAdmin(role: string): boolean {
  return role === "master_admin";
}

export function isTenantAdmin(role: string): boolean {
  return role === "master_admin" || role === "tenant_admin";
}

export function isGestor(role: string): boolean {
  return role === "gestor";
}

export function isFuncionario(role: string): boolean {
  return role === "funcionario";
}

export function canManageTeam(role: string): boolean {
  return isTenantAdmin(role) || role === "gestor";
}

export function canAccessSaaS(role: string): boolean {
  return role === "master_admin";
}

// =====================================================
// DATA ACCESS HELPERS
// =====================================================

/**
 * Can the current user access data from the given tenant?
 * Master admins can access all tenants.
 * Others can only access their own tenant.
 */
export function canAccessTenant(
  userRole: string,
  userTenantId: string,
  targetTenantId: string
): boolean {
  if (isMasterAdmin(userRole)) return true;
  return userTenantId === targetTenantId;
}

/**
 * Can the current user manage the target employee?
 * - Master admin: can manage everyone
 * - Tenant admin: can manage anyone in their tenant
 * - Gestor: can only manage employees where they are the manager
 * - Funcionario: can only manage themselves
 */
export function canManageEmployee(
  userRole: string,
  userId: string,
  employeeId: string,
  employeeManagerId?: string | null
): boolean {
  if (isMasterAdmin(userRole)) return true;
  if (isTenantAdmin(userRole)) return true;
  if (isGestor(userRole)) return employeeManagerId === userId;
  return userId === employeeId;
}

/**
 * Can the current user approve/reject leave requests?
 * - Master admin: can approve any request
 * - Tenant admin: can approve any request in their tenant
 * - Gestor: can approve requests from their managed employees
 * - Funcionario: cannot approve anyone else's requests
 */
export function canApproveRequests(userRole: string): boolean {
  return isTenantAdmin(userRole) || isGestor(userRole);
}

// =====================================================
// NAVIGATION / MENU HELPERS
// =====================================================

export interface NavItem {
  label: string;
  href: string;
  icon: string; // icon name string
  exact?: boolean;
  roles?: string[]; // If set, only show for these roles. Undefined = all roles
}

/**
 * Get navigation items visible to a specific role
 */
export function getNavItemsForRole(role: string): NavItem[] {
  const allItems: NavItem[] = [
    { label: "Visão Geral", href: "/admin", icon: "Home", exact: true },
    { label: "Empresas (SaaS)", href: "/admin/saas", icon: "Building2", roles: ["master_admin"] },
    { label: "Funcionários", href: "/admin/employees", icon: "Users", roles: ["master_admin", "tenant_admin"] },
    { label: "Minha Equipe", href: "/admin/team", icon: "Users", roles: ["gestor"] },
    { label: "Escalas", href: "/admin/schedules", icon: "CalendarCheck" },
    { label: "Ponto", href: "/admin/team/point", icon: "Clock" },
    { label: "Fechamento Mensal", href: "/admin/timesheets", icon: "BarChart3" },
    { label: "Histórico", href: "/admin/audit", icon: "BarChart3" },
    { label: "Configurações", href: "/admin/settings", icon: "Settings", roles: ["master_admin", "tenant_admin"] },
  ];

  return allItems.filter((item) => {
    if (!item.roles) return true;
    return item.roles.includes(role);
  });
}

// =====================================================
// ROLE LABEL TRANSLATIONS
// =====================================================

export const ROLE_LABELS: Record<string, string> = {
  master_admin: "Master Admin",
  tenant_admin: "Admin Empresa",
  gestor: "Gestor",
  funcionario: "Funcionário",
};

export function getRoleLabel(role: string): string {
  return ROLE_LABELS[role] || role;
}
