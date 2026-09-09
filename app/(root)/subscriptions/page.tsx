import { redirect } from 'next/navigation';

// Payment plans are intentionally out of the product flow for this phase.
// Keep the route as a redirect so old bookmarks never expose a stale pricing view.
export default function SubscriptionsPage() {
    redirect('/');
}
