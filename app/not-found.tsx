import Link from "next/link";

export default function NotFound() {
  return (
    <section className="status-page" aria-labelledby="not-found-heading">
      <h1 id="not-found-heading">
        <span lang="ka">გვერდი ვერ მოიძებნა.</span>{" "}
        <span lang="en">Page not found.</span>
      </h1>
      <p>
        <span lang="ka">შეამოწმეთ მისამართი ან დაბრუნდით მთავარ გვერდზე.</span>{" "}
        <span lang="en">Check the address or return to the home page.</span>
      </p>
      <Link href="/ka">
        <span lang="ka">მთავარ გვერდზე დაბრუნება</span> /{" "}
        <span lang="en">Return to the home page</span>
      </Link>
    </section>
  );
}
