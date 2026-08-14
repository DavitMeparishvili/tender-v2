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
        <title>დაფიქსირდა შეცდომა / Something went wrong</title>
      </head>
      <body>
        <main id="main-content" tabIndex={-1}>
          <section
            className="status-page"
            aria-labelledby="global-error-heading"
          >
            <h1 id="global-error-heading">
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
        </main>
      </body>
    </html>
  );
}
