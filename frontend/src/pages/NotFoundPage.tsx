import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main className="flex min-h-full flex-col items-center justify-center px-6 text-center">
      <p className="section-label mb-3">404</p>
      <h1 className="text-xl font-semibold tracking-[-0.02em]">That page is not on the plan</h1>
      <p className="mt-2 max-w-sm text-sm text-secondary">
        The link may be old, or the lesson was removed from this browser.
      </p>
      <Link to="/" className="btn btn-secondary mt-6">
        Back to lessons
      </Link>
    </main>
  );
}
