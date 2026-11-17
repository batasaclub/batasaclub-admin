const BASE = (import.meta.env['VITE_API_URL'] as string | undefined) ?? 'http://localhost:3000';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('admin_token') ?? '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

// Signed-in admin, stored at login. The API refuses a deactivated admin's token (401) on the
// next request; any 401 on an authenticated call clears the session and returns to sign-in.
export interface AdminProfile { id: string; email: string; name: string }
const PROFILE_KEY = 'admin_profile';

export function getAdminProfile(): AdminProfile | null {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY) ?? 'null') as AdminProfile | null; } catch { return null; }
}

export function saveSession(token: string, admin: AdminProfile) {
  localStorage.setItem('admin_token', token);
  localStorage.setItem(PROFILE_KEY, JSON.stringify(admin));
}

export function clearSession() {
  localStorage.removeItem('admin_token');
  localStorage.removeItem(PROFILE_KEY);
}

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { ...authHeaders(), ...(opts?.headers ?? {}) },
  });
  if (res.status === 401 && localStorage.getItem('admin_token')) {
    clearSession();
    window.location.reload();
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Request failed' })) as { error?: string };
    throw new Error(body.error ?? 'Request failed');
  }
  return res.json() as Promise<T>;
}

async function uploadRequest<T>(path: string, file: File, fieldName: string): Promise<T> {
  const token = localStorage.getItem('admin_token') ?? '';
  const form = new FormData();
  form.append(fieldName, file);
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Upload failed' })) as { error?: string };
    throw new Error(body.error ?? 'Upload failed');
  }
  return res.json() as Promise<T>;
}

// POST /auth/admin/login — named admin account (admin_users). Public: sends no stored token.
export async function adminLogin(email: string, password: string): Promise<{ token: string; admin: AdminProfile }> {
  const res = await fetch(`${BASE}/auth/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({})) as { token?: string; admin?: AdminProfile; error?: string };
  if (!res.ok || !body.token || !body.admin) throw new Error(body.error ?? 'Login failed');
  return { token: body.token, admin: body.admin };
}

// POST /auth/admin/accept-invite — public; never sends a stored session token.
export async function acceptAdminInvite(token: string, password: string): Promise<void> {
  const res = await fetch(`${BASE}/auth/admin/accept-invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error || `HTTP ${res.status}`);
  }
}

// ── Admin accounts ────────────────────────────────────────────────────────────

export type AdminStatus = 'active' | 'invited' | 'invite_expired' | 'inactive';

export interface AdminAccount {
  id: string;
  email: string;
  name: string;
  is_active: boolean;
  status: AdminStatus;
  created_at: string;
  last_login_at: string | null;
  invite_expires_at: string | null;
}

export function listAdmins() {
  return request<{ admins: AdminAccount[] }>('/admin/admins');
}

export function inviteAdmin(email: string, name: string) {
  return request<{ admin: AdminAccount }>('/admin/admins', {
    method: 'POST',
    body: JSON.stringify({ email, name }),
  });
}

export function deactivateAdmin(id: string) {
  return request<{ ok: true }>(`/admin/admins/${encodeURIComponent(id)}/deactivate`, { method: 'POST' });
}

// ── Admin audit log (read-only) ───────────────────────────────────────────────

export type AuditJson = Record<string, unknown> | unknown[] | string | number | boolean | null;

export interface AuditLogEntry {
  id: string;
  actor_id: string;                 // admin_users.id, or "system:<job>"
  actor: { id: string; name: string; email: string } | null; // null for a system actor
  action: string;                   // e.g. hotel.freeze
  entity_type: string;
  entity_id: string;
  before: AuditJson;
  after: AuditJson;
  request_id: string | null;
  at: string;
}

export interface AuditLogFilters {
  actor_id?: string;
  entity_type?: string;
  entity_id?: string;
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD, whole day included
  page?: number;
  limit?: number;
}

// GET /admin/audit-log — newest first. There is no write endpoint: the log is append-only.
export function getAuditLog(f: AuditLogFilters) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v !== undefined && v !== '') q.set(k, String(v));
  return request<{ entries: AuditLogEntry[]; total: number; page: number; limit: number }>(`/admin/audit-log?${q}`);
}

export function getStats() {
  return request<StatsResponse>('/admin/stats');
}

export function getHotels() {
  return request<{ hotels: Hotel[] }>('/admin/hotels');
}

export function freezeHotel(id: string, freeze: boolean) {
  return request<{ float: SecurityFloat }>(`/admin/hotels/${id}/freeze`, {
    method: 'PATCH',
    body: JSON.stringify({ freeze }),
  });
}

export function updateHotelWhatsapp(id: string, whatsapp_number: string) {
  return request<{ hotel: Hotel }>(`/admin/hotels/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ whatsapp_number }),
  });
}

export function uploadHotelPhoto(id: string, file: File) {
  return uploadRequest<{ photo_url: string }>(`/admin/hotels/${id}/photo`, file, 'photo');
}

export function getMembers(search?: string, page = 1) {
  const qs = new URLSearchParams({ page: String(page), limit: '50' });
  if (search) qs.set('search', search);
  return request<MembersResponse>(`/admin/members?${qs.toString()}`);
}

export function getSettlementHotels() {
  return request<{ hotels: SettlementRow[] }>('/admin/settlement/hotels');
}

export function getReserveHealth() {
  return request<ReserveHealth>('/admin/settlement/reserve/health');
}

export function runSettlement(month: string) {
  return request<{ processed: number; skipped: number }>('/admin/settlement/run', {
    method: 'POST',
    body: JSON.stringify({ month }),
  });
}

export function markPaid(settlementId: string, paymentMethod?: string) {
  return request<{ settlement: Settlement }>(`/admin/settlement/${settlementId}/mark-paid`, {
    method: 'POST',
    body: JSON.stringify({ payment_method: paymentMethod }),
  });
}

export function getReviews(hotelId?: string, page = 1) {
  const qs = new URLSearchParams({ page: String(page), limit: '50' });
  if (hotelId) qs.set('hotel_id', hotelId);
  return request<ReviewsResponse>(`/admin/reviews?${qs.toString()}`);
}

export function getTransactions(page = 1) {
  return request<TransactionsResponse>(`/admin/transactions?page=${page}&limit=50`);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StatsResponse {
  total_hotels: number;
  total_members: number;
  total_points_issued: number;
  total_points_redeemed: number;
  reserve_balance_paise: number;
  coverage_ratio: number;
  mrr_paise: number;
}

export interface SecurityFloat {
  id: string;
  hotel_id: string;
  float_amount_paise: number;
  min_required_paise: number;
  status: string;
}

export interface Hotel {
  id: string;
  name: string;
  city: string;
  slab: string;
  enrol_rate: number;
  monthly_fee_paise: number;
  payment_score: number;
  is_active: boolean;
  hotel_security_float: SecurityFloat | null;
  issuance_frozen: boolean;
  photo_url: string | null;
  whatsapp_number: string | null;
}

export interface MembersResponse {
  members: Member[];
  total: number;
  page: number;
  limit: number;
}

export interface Member {
  id: string;
  name: string | null;
  email: string | null;
  mobile: string | null;
  tier: string;
  total_points: number;
  stay_count_yr: number;
  is_corporate_verified: boolean | null;
  created_at: string;
}

export interface Settlement {
  id: string;
  hotel_id: string;
  period_month: string;
  saas_fee_paise: number;
  redemptions_paise: number;
  net_payable_paise: number;
  payment_status: string;
  paid_at: string | null;
  invoice_ref: string | null;
}

export interface SettlementRow {
  hotel_id: string;
  hotel_name: string;
  city: string;
  current_month: {
    eligible_revenue_paise: number;
    contribution_paise: number;
    settlement: Settlement | null;
  };
  latest_settlement: Settlement | null;
  float_status: { balance_paise: number; issuance_allowed: boolean };
}

export interface ReserveHealth {
  reserve_balance_paise: number;
  point_liability_paise: number;
  expected_12mo_reimbursement_paise: number;
  coverage_ratio: number;
  health_status: string;
  flags: { below_min_coverage: boolean; liability_exceeds_cap: boolean };
}

export interface Review {
  id: string;
  hotels: { id: string; name: string; city: string } | null;
  members: { id: string; name: string | null; mobile: string | null } | null;
  bookings: { booking_ref: string } | null;
  welcome_experience: number | null;
  room_quality: number | null;
  staff_responsiveness: number | null;
  direct_booking_value: number | null;
  would_return: number | null;
  host_experience: number | null;
  created_at: string;
}

export interface ReviewsResponse {
  reviews: Review[];
  total: number;
  page: number;
  limit: number;
}

export interface Transaction {
  id: string;
  member: { name: string | null; mobile: string | null; email: string | null } | null;
  hotel: { name: string } | null;
  txn_type: string;
  points: number;
  created_at: string;
  booking_type: string | null;
}

export interface TransactionsResponse {
  transactions: Transaction[];
  total: number;
  page: number;
  limit: number;
}

export interface InventoryRow {
  hotel_id: string;
  hotel_name: string;
  city: string;
  total_rooms: number;
  purchased_batasa: number;
  issued_batasa: number;
  available_batasa: number;
  minimum_batasa: number;
  available_pct: number | null;
  is_low: boolean;
  is_zero: boolean;
}

export function getInventoryMonitoring() {
  return request<InventoryRow[]>('/inventory/monitoring');
}

export interface AdrBand {
  id: string;
  adr_min_rupees: number;
  adr_max_rupees: number | null;
  consumption_rate: string;
  label: string;
  is_active: boolean | null;
  created_at: string;
}

export function getAdrBands() {
  return request<{ bands: AdrBand[] }>('/admin/adr-bands');
}

export function updateAdrBand(
  id: string,
  data: { consumption_rate?: number; label?: string; is_active?: boolean },
) {
  return request<{ band: AdrBand }>(`/admin/adr-bands/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export interface BreakageRow {
  hotel_id: string;
  hotel_name: string | null;
  month: string;
  batasa_issued: number;
  batasa_expired: number;
  batasa_dormant_estimate: number;
  breakage_rate_pct: number;
  reserve_benefit_paise: number;
}

export interface BreakageSummary {
  total_issued: number;
  total_expired: number;
  total_dormant: number;
  network_breakage_rate_pct: number;
  total_reserve_benefit_paise: number;
}

export function getBreakage() {
  return request<{ rows: BreakageRow[]; summary: BreakageSummary }>('/admin/breakage');
}

export interface BatasaHealth {
  locked: number;
  active: number;
  expired: number;
  issued: number;
  activation_rate_pct: number;
}

export function getBatasaHealth() {
  return request<BatasaHealth>('/admin/batasa-health');
}

export interface RateParityLog {
  id: string;
  hotel_id: string;
  hotel_name: string;
  room_id: string;
  room_name: string;
  room_type: string | null;
  ota_rate_paise: number;
  previous_member_rate_paise: number | null;
  new_member_rate_paise: number;
  discount_pct_applied: number;
  created_at: string;
}

export function getAdminRateParity() {
  return request<{ logs: RateParityLog[] }>('/admin/rate-parity');
}

export interface NetworkConfig {
  key: string;
  value: string;
  type: string;
  description: string | null;
  updated_at: string;
}

export function getNetworkConfig() {
  return request<{ configs: NetworkConfig[] }>('/admin/network-config');
}

export function updateNetworkConfig(key: string, value: string) {
  return request<{ config: NetworkConfig }>(`/admin/network-config/${encodeURIComponent(key)}`, {
    method: 'PUT',
    body: JSON.stringify({ value }),
  });
}

export interface SettlementJobEntry {
  id: string;
  hotel_id: string;
  hotel_name: string;
  run_date: string;
  status: 'success' | 'failed';
  error_message: string | null;
  processed_at: string;
}

export interface SettlementJobRun {
  run_date: string;
  total: number;
  succeeded: number;
  failed: number;
  entries: SettlementJobEntry[];
}

export function getSettlementJobLog() {
  return request<{ runs: SettlementJobRun[] }>('/admin/settlement-job-log');
}

export interface ChannelKey {
  id: string;
  hotel_id: string;
  api_key: string;
  label: string;
  is_active: boolean;
  created_at: string;
}

export interface ChannelKeyHotel {
  hotel_id: string;
  hotel_name: string;
  city: string;
  keys: ChannelKey[];
}

export function getChannelKeys() {
  return request<{ hotels: ChannelKeyHotel[] }>('/admin/channel-keys');
}

export function createChannelKey(hotelId: string, label: string) {
  return request<{ key: ChannelKey }>(`/admin/channel-keys/${hotelId}`, {
    method: 'POST',
    body: JSON.stringify({ label }),
  });
}

export function revokeChannelKey(id: string) {
  return request<{ key: ChannelKey }>(`/admin/channel-keys/${id}/revoke`, {
    method: 'PATCH',
  });
}
