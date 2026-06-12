/**
 * RBAC — единая точка истины для прав доступа во фронтенде.
 *
 * Роль хранится в profiles.role и подгружается в AuthContext; то же значение
 * использует RLS на стороне БД (current_user_role / is_admin /
 * user_can_access_store). Скоуп по магазинам/регионам — в таблицах
 * user_stores / user_regions (см. supabase_hr_schema.sql), на клиенте
 * доступен через useAuth().storeIds / regionIds.
 */

export const ROLES = {
  ADMIN: 'admin',
  EDITOR: 'editor',
  VIEWER: 'viewer',
  DIRECTOR: 'director',
  RM: 'rm',
  HR: 'hr',
}

// Полный набор прав с дефолтом false — чтобы новые ключи не «протекали».
const NONE = {
  // products (демо)
  canCreate: false,
  canEdit: false,
  canDelete: false,
  canManageUsers: false,
  canViewUsers: false,       // доступ к странице «Пользователи» (правка своего ФИО)
  canViewAdminFields: false,
  // HR / вакансии
  canViewStores: false,      // раздел «Магазины» (вакансии по магазину)
  canEditVacancies: false,   // редактирование вакансий
  canViewPlan: false,        // сводный «План»
  canViewRegion: false,      // раздел «РМ» (магазины региона)
  canManageHr: false,        // раздел «HR» (назначения)
  canManageStaffing: false,  // раздел «Штатное расписание» + загрузка отчёта
}

/** Что умеет каждая роль */
export const PERMISSIONS = {
  [ROLES.ADMIN]: {
    canCreate: true, canEdit: true, canDelete: true, canManageUsers: true, canViewUsers: true, canViewAdminFields: true,
    canViewStores: true, canEditVacancies: true, canViewPlan: true, canViewRegion: true, canManageHr: true,
    canManageStaffing: true,
  },
  [ROLES.EDITOR]: { ...NONE, canCreate: true, canEdit: true },
  [ROLES.VIEWER]: { ...NONE },
  [ROLES.DIRECTOR]: { ...NONE, canViewStores: true, canEditVacancies: true, canViewUsers: true },
  [ROLES.RM]: { ...NONE, canViewRegion: true },
  [ROLES.HR]: { ...NONE, canViewStores: true, canManageHr: true, canManageStaffing: true },
}

/** Хук-помощник: can(role, 'canEdit') */
export function can(role, permission) {
  return PERMISSIONS[role]?.[permission] ?? false
}

export const ROLE_META = {
  [ROLES.ADMIN]: { label: 'Admin', color: 'warning' },
  [ROLES.EDITOR]: { label: 'Editor', color: 'info' },
  [ROLES.VIEWER]: { label: 'Viewer', color: 'default' },
  [ROLES.DIRECTOR]: { label: 'Директор', color: 'success' },
  [ROLES.RM]: { label: 'РМ', color: 'primary' },
  [ROLES.HR]: { label: 'HR', color: 'secondary' },
}
