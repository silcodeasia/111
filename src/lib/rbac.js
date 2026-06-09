/**
 * RBAC — единая точка истины для прав доступа во фронтенде.
 *
 * Роль хранится в таблице profiles.role (см. supabase_migration.sql) и
 * подгружается в AuthContext. Это же значение использует RLS на стороне БД
 * через SECURITY DEFINER-функцию current_user_role(), поэтому источник
 * истины один и тот же для UI и для Postgres.
 *
 * RLS-политики (выдержка из миграции):
 *   -- SELECT — все аутентифицированные
 *   create policy "products: read for authenticated" on products
 *     for select to authenticated using (true);
 *
 *   -- INSERT/UPDATE — editor и admin
 *   create policy "products: write for editor+" on products
 *     for insert to authenticated
 *     with check (current_user_role() in ('editor','admin'));
 *
 *   -- DELETE — только admin
 *   create policy "products: delete for admin" on products
 *     for delete to authenticated using (current_user_role() = 'admin');
 */

export const ROLES = {
  ADMIN: 'admin',
  EDITOR: 'editor',
  VIEWER: 'viewer',
}

/** Что умеет каждая роль */
export const PERMISSIONS = {
  [ROLES.ADMIN]: {
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canManageUsers: true,
    canViewAdminFields: true,
  },
  [ROLES.EDITOR]: {
    canCreate: true,
    canEdit: true,
    canDelete: false,
    canManageUsers: false,
    canViewAdminFields: false,
  },
  [ROLES.VIEWER]: {
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canManageUsers: false,
    canViewAdminFields: false,
  },
}

/** Хук-помощник: can(role, 'canEdit') */
export function can(role, permission) {
  return PERMISSIONS[role]?.[permission] ?? false
}

export const ROLE_META = {
  [ROLES.ADMIN]: { label: 'Admin', color: 'warning', icon: 'Crown' },
  [ROLES.EDITOR]: { label: 'Editor', color: 'info', icon: 'Edit' },
  [ROLES.VIEWER]: { label: 'Viewer', color: 'default', icon: 'Visibility' },
}
