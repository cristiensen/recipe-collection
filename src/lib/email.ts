import "server-only";

type Email = { to: string; subject: string; text: string; html: string };

/**
 * Sends an email through Resend's HTTP API. Without `RESEND_API_KEY`
 * (development, e2e) it prints the email to the server console instead.
 * Until a domain is verified in Resend, `EMAIL_FROM` must stay on
 * `onboarding@resend.dev`, which only delivers to the Resend account's own
 * address.
 */
export async function sendEmail({ to, subject, text, html }: Email) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY is not set");
    }
    console.info(`[email] To: ${to}\nSubject: ${subject}\n\n${text}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from:
        process.env.EMAIL_FROM ?? "Recipe Collection <onboarding@resend.dev>",
      to: [to],
      subject,
      text,
      html,
    }),
  });
  if (!res.ok) {
    throw new Error(`Resend responded ${res.status}: ${await res.text()}`);
  }
}
