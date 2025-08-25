export function formatINR(paise: number) {
  const rupees = (paise ?? 0) / 100
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(rupees)
}
export function shortId(id: string) {
  return id?.slice(0, 6).toUpperCase()
}