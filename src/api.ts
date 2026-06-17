const BASE = (import.meta.env['VITE_API_URL'] as string | undefined) ?? 'http://localhost:3000';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('admin_token') ?? '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { ...authHeaders(), ...(opts?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Request failed' })) as { error?: string };
    throw new Error(body.error ?? 'Request failed');
  }
  return res.json() as Promise<T>;
}

export function adminLogin(email: string, password: string) {
  return request<{ token: string }>('/auth/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    headers: { 'Content-Type': 'application/json' },
  });
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
