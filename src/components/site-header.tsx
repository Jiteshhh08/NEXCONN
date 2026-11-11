import { ArrowUpRight, LogIn } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";

const navLinks = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#features", label: "Features" },
  { href: "/#for-hosts", label: "For hosts" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-[4.5rem] w-full max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link
          href="/"
          className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          aria-label="Vaani Room home"
        >
          <Logo />
        </Link>

        <nav
          aria-label="Primary"
          className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex"
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/join"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            <LogIn aria-hidden="true" className="size-4" />
            <span className="hidden sm:inline">Join a room</span>
            <span className="sm:hidden">Join</span>
          </Link>
          <Link
            href="/host"
            className={buttonVariants({ variant: "primary", size: "sm" })}
          >
            Host a room
            <ArrowUpRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}
