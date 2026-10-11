/** Mainland mobile numbers accepted by the password registration endpoint. */
export function isValidPhone(phone: string): boolean {
  return /^(?:\+86|0086)?1[3-9]\d{9}$/.test(phone.trim())
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

/** Keep the two identity fields mutually exclusive in authentication requests. */
export function accountLoginIdentity(account: string): { email: string } | { phone: string } {
  const value = account.trim()
  return value.includes('@') ? { email: value } : { phone: value }
}
