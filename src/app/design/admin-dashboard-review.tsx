import { AdminDashboardReviewShell } from '@/components/design-review/admin-dashboard-review-shell';

/**
 * Internal design-review route only.
 * Route: /design/admin-dashboard-review
 * Direct URL — no public nav link. No auth. Mock data only.
 */
export default function AdminDashboardReviewScreen() {
  return <AdminDashboardReviewShell />;
}
