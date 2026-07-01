import { createAdminClient } from '@/lib/supabase/admin'

type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'BASELINE_SAVE'
  | 'RECALCULATE'

interface AuditParams {
  userId: string
  userEmail: string
  userName: string
  action: AuditAction
  entityType: string
  entityId?: string
  entityDescription?: string
  oldValue?: unknown
  newValue?: unknown
  ipAddress?: string
}

export async function insertAuditLog(params: AuditParams): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('audit_logs').insert({
      user_id: params.userId,
      user_email: params.userEmail,
      user_name: params.userName,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      entity_description: params.entityDescription ?? null,
      old_value: params.oldValue ?? null,
      new_value: params.newValue ?? null,
      ip_address: params.ipAddress ?? null,
    })
  } catch {
    // audit failures must never crash the main flow
  }
}
