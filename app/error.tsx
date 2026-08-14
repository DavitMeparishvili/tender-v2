"use client";

export default function ErrorPage({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  return (
    <section className="status-page" aria-labelledby="error-heading">
      <h1 id="error-heading">
        დაფიქსირდა შეცდომა. <span lang="en">Something went wrong.</span>
      </h1>
      <p>
        გთხოვთ, ხელახლა სცადოთ. <span lang="en">Please try again.</span>
      </p>
      {error.digest ? (
        <p className="correlation-id">
          მითითება / <span lang="en">Reference</span>: {error.digest}
        </p>
      ) : null}
      <button type="button" onClick={reset}>
        ხელახლა ცდა / <span lang="en">Try again</span>
      </button>
    </section>
  );
}
