// Always hide at least one local-part character, including short addresses.
// Mask the domain label too, since it can itself identify a person or company.
export function maskFeedbackEmail(email: string | null): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf(".");
  const mask = (value: string) =>
    value.length > 2 ? `${value[0]}***${value.at(-1)}` : "***";
  return `${mask(local)}@${dot > 0 ? `${mask(domain.slice(0, dot))}${domain.slice(dot)}` : "***"}`;
}
