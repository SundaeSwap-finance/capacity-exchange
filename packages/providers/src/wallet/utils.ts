export function isOfferExpired(expiresAt: Date): boolean {
  return expiresAt < new Date();
}
