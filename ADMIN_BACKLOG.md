# Admin Panel — Feature Backlog

Items reviewed and deferred for future implementation.
Reviewed: 2026-04-08

---

## High Priority

### 1. Order History / Timeline
Each order should show a timestamped audit trail of status changes — who was assigned when, what was rejected, when payment was received. Currently you see only the current state and can't reconstruct what happened.
- Add an `order_events` table (order_id, event_type, description, created_at)
- Write events on every status change in order processing flows
- Show as a vertical timeline at the bottom of OrderDetail

### 2. No Customer Page
There's no way to look up a customer, see their order history, or identify repeat customers vs one-timers. As cities scale this becomes critical.
- Add `/admin/customers` page
- Pull from `profiles` (role=customer)
- Show: name, phone, order count, total spend, last order date
- Click to see all orders for that customer

### 3. Per-City Service Control
Services can be toggled globally but not per city. If Plumbing is ready in Vizag but not Hyderabad you can't control that independently.
- Add `city_services` junction table (city_id, service_name, is_active)
- Update Services page to show a grid: cities × services
- Customer app checks per-city availability instead of global flag

### 4. Cancellation Reason Tracking
Cancelled orders are counted but there's no breakdown of why — customer cancelled, quote too high, worker unavailable, etc.
- Add `cancellation_reason` column to orders (TEXT, nullable)
- Show reason selector in admin cancel flow
- Add cancellation breakdown chart to Analytics

### 5. Bulk Worker Verification
On a launch day with 20+ workers, verifying one-by-one is slow.
- Add checkbox multi-select on Workers page
- "Verify All Selected" button
- Useful for city launches

---

## Medium Priority

### 6. Campaign Delivery Reports
Campaign logs track `sent_count` but not delivery rates, open rates, or failures.
- Store per-campaign delivery results (sent, failed, invalid tokens)
- Show success/failure breakdown in campaign history
- Auto-clean stale FCM tokens on delivery failure

### 7. Sidebar Grouping
10 nav items is getting crowded. Group them:
- **Operations**: Orders, Workers, Materials
- **Finance**: Payments, Analytics
- **Config**: Cities, Services, Stores, Promos, Campaigns
- Use section dividers or collapsible groups

### 8. Stores Location — Google Maps Integration
Current Nominatim reverse geocoding is unreliable for Indian addresses.
- Add a "Pick on Map" button that opens a Google Maps embed
- Or: Add direct lat/lng inputs as the primary method with a Google Maps search link helper
- Consider storing formatted_address from a geocoding API

### 9. Worker Earnings History (Full Ledger)
Workers page shows total paid out but not a breakdown by job. Workers might ask for a statement.
- Show per-job earnings breakdown when you expand a worker card
- Export to CSV option

### 10. Bulk Payout Actions
If 15 workers all have pending payouts, settling one-by-one with QR is slow.
- Bulk select pending payouts
- Generate a batch reference
- Mark all selected as paid with one shared reference

---

## Lower Priority

### 11. Keyboard Shortcuts
Power users benefit from shortcuts like `G+O` (go to Orders), `G+W` (Workers), `G+P` (Payments).
- Use a `useHotkeys` library
- Show shortcut hints in sidebar on hover

### 12. Page Title from Route (not hardcoded)
`PAGE_TITLES` in AdminLayout is a hardcoded map. If a new route is added without updating it, the title shows "Admin".
- Derive page title from route config or pass it from each page via context

### 13. Order Detail — Reassign Worker
Currently there's no way to reassign a worker once one is assigned. If a worker cancels/can't make it, you have to cancel the order.
- Add "Reassign Worker" option on in-progress orders
- Notify both old and new worker

### 14. Promo Code Analytics
Track which promo codes generate the most orders and what the discount impact is.
- Add promo_code field to orders
- In Analytics → Promos section: total discount given, orders per code, avg order value with/without promo

### 15. Real-time Alert Banner
When a new order comes in needing a worker while you're on another page, there's no alert.
- Floating toast or banner: "New order needs worker — Plumbing in Vizag"
- Click to navigate directly to that order

---

## Done (for reference)
- ✅ Search on Dashboard + Workers
- ✅ Sidebar nav badges (Orders needing worker, Workers pending verify, Pending payouts)
- ✅ Worker workload visible in assignment dropdown (active job count + rating)
- ✅ Oldest-first worker verification queue + waiting days indicator
- ✅ Labour approval confirmation dialog
- ✅ Worker earnings visible on Workers page (from payout_logs)
- ✅ Deduplicated Materials/Payments store payout (Materials owns commission + settlement, Payments shows count/link)
- ✅ City filter across all pages (Dashboard, Workers, Payments, Materials, Analytics)
- ✅ Campaigns edge function deployment fix
- ✅ Payout log audit trail (payout_logs table)
- ✅ UPI QR modal for worker/bonus payouts
- ✅ Financial Analytics (revenue by service, worker earnings leaderboard, store analytics)
