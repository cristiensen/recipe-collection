import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/sonner";
import { getTheme } from "@/lib/theme-server";
import { cn } from "@/lib/utils";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Recipe Collection", template: "%s · Recipe Collection" },
  description:
    "Home cooks share recipes with photos and video, and rate and review each other's dishes.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Resolved on the server (account, then cookie) so the page arrives themed — no flash.
  const theme = await getTheme();

  return (
    <html
      lang="en"
      className={cn(
        geistSans.variable,
        geistMono.variable,
        "h-full antialiased",
        theme === "dark" && "dark",
      )}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <SiteHeader theme={theme} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
        <footer className="flex justify-center gap-2 border-t py-6 text-sm text-muted-foreground">
          <span>Recipe Collection</span>
          <span aria-hidden>·</span>
          <Link href="/policy" className="underline-offset-4 hover:underline">
            Policy
          </Link>
        </footer>
        <Toaster theme={theme} />
      </body>
    </html>
  );
}
