import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page-main-content">
      <div className="page-content-inner">
        <h1 className="page-title">404 – Page Not Found</h1>
        <p style={{ marginBottom: "1.5rem", color: "var(--color-text-secondary, #555)" }}>
          The page you are looking for does not exist or has been moved.
        </p>
        <Link href="/" className="btn btn--primary">
          Return to Dashboard
        </Link>
      </div>
    </main>
  );
}
