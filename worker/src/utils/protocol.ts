// Gera protocolo no formato: CRM-YYYYMMDD-XXXXX (ex: CRM-20261127-00042)
// Baseado em timestamp + número sequencial por dia.
// O número sequencial real é gerado por um contador no banco (via SELECT COUNT).
export function generateProtocol(sequence: number): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, '')
  const seq = String(sequence).padStart(5, '0')
  return `CRM-${date}-${seq}`
}
