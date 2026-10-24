const euros = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

/** "€189,000" for a sale, "€950 / month" for a rental. */
export function formatPrice(price: number, operation: "sale" | "rent") {
  const amount = euros.format(price);
  return operation === "rent" ? `${amount} / month` : amount;
}

const dateTime = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Madrid",
});

export function formatDateTime(date: Date) {
  return dateTime.format(date);
}
