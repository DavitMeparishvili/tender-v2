import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "გვერდი ვერ მოიძებნა",
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
              <span lang="ka">გვერდი ვერ მოიძებნა.</span>{" "}
              <span lang="en">Page not found.</span>
            </h1>
            <p>
              <span lang="ka">
                შეამოწმეთ მისამართი ან დაბრუნდით მთავარ გვერდზე.
              </span>{" "}
              <span lang="en">
                Check the address or return to the home page.
              </span>
            </p>
            <Link href="/ka">
              <span lang="ka">მთავარ გვერდზე დაბრუნება</span> /{" "}
              <span lang="en">Return to the home page</span>
            </Link>
          </section>
        </main>
      </body>
    </html>
  );
}
