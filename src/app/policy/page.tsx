import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Policy",
  description:
    "How Recipe Collection handles your data, and the rules for what you post.",
};

// TODO: replace these placeholders before publishing
const CONTACT_EMAIL = "[contact email]";
const OPERATOR = "[your name or organisation]";
const DATABASE_HOST = "[database provider and region]";
const LAST_UPDATED = "October 19, 2026";

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h3 id={id} className="text-lg font-semibold">
        {title}
      </h3>
      {children}
    </section>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return <ul className="flex list-disc flex-col gap-1.5 pl-5">{children}</ul>;
}

export default function PolicyPage() {
  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-8 leading-relaxed">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Policy</h1>
        <p className="text-sm text-muted-foreground">
          Last updated {LAST_UPDATED}
        </p>
        <p className="text-muted-foreground">
          This page explains what data Recipe Collection keeps about you and
          why, and the rules everyone agrees to when posting recipes and
          reviews.
        </p>
        <nav aria-label="On this page" className="flex gap-4 text-sm">
          <a href="#privacy" className="underline underline-offset-4">
            Privacy
          </a>
          <a href="#community" className="underline underline-offset-4">
            Community rules
          </a>
        </nav>
      </header>

      <div id="privacy" className="flex scroll-mt-20 flex-col gap-6">
        <h2 className="text-2xl font-semibold tracking-tight">Privacy</h2>

        <Section id="who-we-are" title="Who we are">
          <p>
            Recipe Collection is run by {OPERATOR}, who is responsible (the
            &ldquo;controller&rdquo;) for your personal data under the EU
            General Data Protection Regulation (GDPR). You can reach us at{" "}
            <span className="font-medium">{CONTACT_EMAIL}</span>.
          </p>
        </Section>

        <Section id="data-we-keep" title="What we keep">
          <p>
            You can browse without an account. When you create one, we store:
          </p>
          <List>
            <li>
              <strong>Your account details:</strong> display name, email address
              and password. Passwords are stored only as a secure one-way hash;
              we can&apos;t read them.
            </li>
            <li>
              <strong>What you post:</strong> recipes (including photos and
              videos you upload), reviews, ratings, likes, and your votes on
              reviews.
            </li>
            <li>
              <strong>Your settings:</strong> your theme (light or dark) and
              whether your profile is private.
            </li>
          </List>
        </Section>

        <Section id="why" title="Why we use it">
          <List>
            <li>
              <strong>To run your account and show what you post:</strong>{" "}
              account details, posts and settings are needed to provide the
              service you signed up for (performance of a contract).
            </li>
            <li>
              <strong>To keep the site working and safe:</strong> sign-in
              cookies, view counting and moderation are based on our legitimate
              interest in running a reliable, friendly site.
            </li>
          </List>
          <p>
            We don&apos;t use your data for advertising or profiling, and we
            don&apos;t make automated decisions about you. You need an email
            address and password to create an account; everything else you post
            is up to you.
          </p>
        </Section>

        <Section id="retention" title="How long we keep it">
          <List>
            <li>
              Account details, posts and settings are kept for as long as you
              have an account. When you or an admin delete it, they are removed
              straight away; copies in our providers&apos; backups expire
              shortly after.
            </li>
            <li>
              Daily view counts are deleted after a week. The all-time total per
              recipe isn&apos;t linked to anyone.
            </li>
            <li>
              Cookies expire as listed below, or when you sign out (sign-in
              cookie).
            </li>
          </List>
        </Section>

        <Section id="who-sees-what" title="Who can see what">
          <List>
            <li>
              Your display name, recipes and reviews are public, unless you are
              a chef and make your profile private. A private profile&apos;s
              recipes and reviews are hidden from everyone except you,
              moderators and admins.
            </li>
            <li>
              Your email address is never shown publicly. Moderators and admins
              can see it when managing accounts.
            </li>
            <li>
              Recipe view counts are totals. We record that a recipe was viewed,
              not who viewed it. Daily counts are deleted after a week; only the
              all-time total is kept.
            </li>
          </List>
        </Section>

        <Section id="cookies" title="Cookies">
          <p>
            We use a few cookies to make the site work. There are no advertising
            or tracking cookies, and no third-party analytics.
          </p>
          <List>
            <li>
              <strong>Sign-in:</strong> keeps you logged in for up to 30 days.
            </li>
            <li>
              <strong>Theme:</strong> remembers light or dark mode for up to a
              year.
            </li>
            <li>
              <strong>Views:</strong> stops reloads from counting a recipe view
              twice. It lasts 24 hours.
            </li>
          </List>
        </Section>

        <Section id="services" title="Services we use">
          <p>
            The site is hosted on Vercel, which also stores uploaded photos and
            videos. Account data and posts are kept in a database hosted by{" "}
            {DATABASE_HOST}. These providers process data only on our behalf, to
            run the site. We don&apos;t sell or share your data with anyone
            else.
          </p>
          <p>
            Vercel is based in the United States, so some data may be processed
            outside the European Economic Area. Those transfers are covered by
            the EU&ndash;US Data Privacy Framework or the European
            Commission&apos;s Standard Contractual Clauses.
          </p>
        </Section>

        <Section id="your-rights" title="Your rights">
          <p>Under the GDPR you have the right to:</p>
          <List>
            <li>
              <strong>Access</strong> the data we hold about you and get a copy
              of it in a portable format.
            </li>
            <li>
              <strong>Correct</strong> it. You can change your display name and
              password, and (as a chef) make your profile private, from the
              Settings tab on your profile.
            </li>
            <li>
              <strong>Delete</strong> it. You can delete your account at any
              time from the same place. This permanently removes your account
              along with your recipes, uploads, reviews, likes and votes.
            </li>
            <li>
              <strong>Restrict or object</strong> to how we use it, where we
              rely on legitimate interest.
            </li>
          </List>
          <p>
            For anything you can&apos;t do from Settings, email us at{" "}
            <span className="font-medium">{CONTACT_EMAIL}</span>. We&apos;ll
            reply within one month. If you&apos;re unhappy with how we handle
            your data, you can complain to your local data protection authority.
          </p>
        </Section>
      </div>

      <div id="community" className="flex scroll-mt-20 flex-col gap-6">
        <h2 className="text-2xl font-semibold tracking-tight">
          Community rules
        </h2>

        <Section id="what-to-post" title="What you can post">
          <List>
            <li>
              Post your own recipes, photos and videos, or ones you have the
              right to share.
            </li>
            <li>
              Keep reviews about the recipe: be honest and constructive, even
              when a dish didn&apos;t work out.
            </li>
            <li>
              Don&apos;t post anything hateful, harassing, sexually explicit,
              illegal or misleading, or spam and advertising.
            </li>
            <li>Don&apos;t share other people&apos;s personal information.</li>
          </List>
        </Section>

        <Section id="moderation" title="How moderation works">
          <p>
            Moderators and admins keep the site friendly. When something breaks
            these rules, they can:
          </p>
          <List>
            <li>
              Edit or remove a review&apos;s comment, or remove the whole
              review.
            </li>
            <li>
              Suspend an account. Suspended accounts become read-only: they can
              still browse, but can&apos;t post, review, like or vote.
            </li>
            <li>
              Delete an account, together with everything it posted (admins
              only).
            </li>
          </List>
          <p>
            If you think a moderation decision was a mistake, contact us at{" "}
            <span className="font-medium">{CONTACT_EMAIL}</span>.
          </p>
        </Section>
      </div>

      <p className="text-sm text-muted-foreground">
        We may update this page as the site changes; the date at the top shows
        the latest version.{" "}
        <Link href="/" className="underline underline-offset-4">
          Back to recipes
        </Link>
      </p>
    </article>
  );
}
