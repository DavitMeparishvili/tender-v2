import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "გვერდი ვერ მოიძებნა / Page not found",
};

export default function GlobalNotFound() {
  return (
    <html lang="ka">
      <body>
        <main id="main-content" tabIndex={-1}>
          <section
            className="status-page"
            aria-labelledby="global-not-found-heading"
          >
            <h1 id="global-not-found-heading">
              გვერდი ვერ მოიძებნა. <span lang="en">Page not found.</span>
            </h1>
            <p>
              შეამოწმეთ მისამართი ან დაბრუნდით მთავარ გვერდზე.{" "}
              <span lang="en">
                Check the address or return to the home page.
              </span>
            </p>
            <Link href="/ka">
              მთავარ გვერდზე დაბრუნება /{" "}
              <span lang="en">Return to the home page</span>
            </Link>
          </section>
        </main>
      </body>
    </html>
  );
}
