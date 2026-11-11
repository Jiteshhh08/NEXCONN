import Link from "next/link";

import { Logo } from "@/components/brand/logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/80 bg-card/40">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Ask in your language. Understand in yours. A multilingual live Q&amp;A
            space for classrooms, workshops, and events.
          </p>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Product
          </h2>
          <ul className="mt-3 space-y-2.5 text-sm">
            <li>
              <Link className="transition hover:text-primary" href="/host">
                Host a room
              </Link>
            </li>
            <li>
              <Link className="transition hover:text-primary" href="/join">
                Join a room
              </Link>
            </li>
            <li>
              <Link
                className="transition hover:text-primary"
                href="/#how-it-works"
              >
                How it works
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Design notes
          </h2>
          <ul className="mt-3 space-y-2.5 text-sm text-muted-foreground">
            <li>No app install required</li>
            <li>Host-controlled moderation</li>
            <li>History survives a refresh</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border/70">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-5 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>© {new Date().getFullYear()} Vaani Room.</p>
          <p>Built for inclusive participation, in every language.</p>
        </div>
      </div>
    </footer>
  );
}
