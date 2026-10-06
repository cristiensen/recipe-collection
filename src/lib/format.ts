/** "45 min", "1 h", "1 h 30 min" (US-2.6). */
export function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

/** "4.3 from 18 ratings" or "No ratings yet" (US-3.3). */
export function formatRatingSummary(
  average: number | null,
  count: number,
): string {
  if (count === 0 || average === null) return "No ratings yet";
  return `${average.toFixed(1)} from ${count} ${count === 1 ? "rating" : "ratings"}`;
}

/** Ingredient quantities: drop trailing zeros from floats ("1.5", "250", "0.33"). */
export function formatQuantity(quantity: number): string {
  return Number.parseFloat(quantity.toFixed(2)).toString();
}

const dateFormatter = new Intl.DateTimeFormat("en", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export function formatDate(date: Date): string {
  return dateFormatter.format(date);
}
