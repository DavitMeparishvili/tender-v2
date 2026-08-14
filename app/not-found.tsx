import Link from "next/link";

export default function NotFound() {
  return (
    <section className="status-page" aria-labelledby="not-found-heading">
      <h1 id="not-found-heading">
        გვერდი ვერ მოიძებნა. <span lang="en">Page not found.</span>
      </h1>
      <p>
        შეამოწმეთ მისამართი ან დაბრუნდით მთავარ გვერდზე.{" "}
        <span lang="en">Check the address or return to the home page.</span>
      </p>
      <Link href="/ka">
        მთავარ გვერდზე დაბრუნება /{" "}
        <span lang="en">Return to the home page</span>
      </Link>
    </section>
  );
}
