// Mirrors public.redact_contact_info() in the database. Messages must stay on
// the platform, so emails and phone numbers are hidden before display/sending.
export const CONTACT_PLACEHOLDER = "[contact hidden]";

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// A phone number is 9+ digits, optionally separated by up to two of space ( ) . -
const PHONE_RE = /\+?\(?\d(?:[\s().-]{0,2}\d){8,}/g;

export function redactContactInfo(text: string): string {
  return text.replace(EMAIL_RE, CONTACT_PLACEHOLDER).replace(PHONE_RE, CONTACT_PLACEHOLDER);
}

export function containsContactInfo(text: string): boolean {
  return redactContactInfo(text) !== text;
}
