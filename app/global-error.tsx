"use client";

import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  return (
    <html lang="ka">
      <head>
        <title>დაფიქსირდა შეცდომა</title>
      </head>
      <body>
        <main id="main-content" tabIndex={-1}>
          <section
            className="status-page"
            aria-labelledby="global-error-heading"
          >
            <h1 id="global-error-heading">
              <span lang="ka">დაფიქსირდა შეცდომა.</span>{" "}
              <span lang="en">Something went wrong.</span>
            </h1>
            <p>
              <span lang="ka">გთხოვთ, ხელახლა სცადოთ.</span>{" "}
              <span lang="en">Please try again.</span>
            </p>
            {error.digest ? (
              <p className="correlation-id">
                <span lang="ka">მითითება</span> /{" "}
                <span lang="en">Reference</span>: {error.digest}
              </p>
            ) : null}
            <button type="button" onClick={reset}>
              <span lang="ka">ხელახლა ცდა</span> /{" "}
              <span lang="en">Try again</span>
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
