// Horário comercial padrão: seg–sex, 08h–18h (UTC-3).
// Futuro: tornar configurável por tenant via tabela business_hours.

const BUSINESS_START_HOUR = 8   // 08:00
const BUSINESS_END_HOUR   = 18  // 18:00
const UTC_OFFSET_HOURS    = -3  // América/São_Paulo (sem DST por simplicidade)

function toBRT(utc: Date): Date {
  return new Date(utc.getTime() + UTC_OFFSET_HOURS * 60 * 60 * 1000)
}

function isBusinessDay(date: Date): boolean {
  const dow = date.getDay() // 0=dom, 6=sab
  return dow >= 1 && dow <= 5
}

function isWithinBusinessHours(date: Date): boolean {
  if (!isBusinessDay(date)) return false
  const h = date.getHours()
  return h >= BUSINESS_START_HOUR && h < BUSINESS_END_HOUR
}

// Avança `date` para o próximo instante dentro do horário comercial.
function nextBusinessMoment(date: Date): Date {
  const d = new Date(date)
  while (!isBusinessDay(d)) {
    d.setDate(d.getDate() + 1)
    d.setHours(BUSINESS_START_HOUR, 0, 0, 0)
  }
  if (d.getHours() < BUSINESS_START_HOUR) {
    d.setHours(BUSINESS_START_HOUR, 0, 0, 0)
  } else if (d.getHours() >= BUSINESS_END_HOUR) {
    d.setDate(d.getDate() + 1)
    d.setHours(BUSINESS_START_HOUR, 0, 0, 0)
    return nextBusinessMoment(d)
  }
  return d
}

// Calcula a data de vencimento adicionando `minutes` de tempo útil a partir de `from`.
export function addBusinessMinutes(from: Date, minutes: number): Date {
  let remaining = minutes * 60 * 1000 // ms
  let cursor = toBRT(new Date(from))

  if (!isWithinBusinessHours(cursor)) {
    cursor = nextBusinessMoment(cursor)
  }

  while (remaining > 0) {
    const endOfDay = new Date(cursor)
    endOfDay.setHours(BUSINESS_END_HOUR, 0, 0, 0)

    const availableMs = endOfDay.getTime() - cursor.getTime()

    if (remaining <= availableMs) {
      cursor = new Date(cursor.getTime() + remaining)
      remaining = 0
    } else {
      remaining -= availableMs
      cursor.setDate(cursor.getDate() + 1)
      cursor.setHours(BUSINESS_START_HOUR, 0, 0, 0)
      cursor = nextBusinessMoment(cursor)
    }
  }

  // Converte de volta para UTC
  return new Date(cursor.getTime() - UTC_OFFSET_HOURS * 60 * 60 * 1000)
}

// Calcula minutos úteis decorridos entre dois instantes.
export function businessMinutesBetween(start: Date, end: Date): number {
  let ms = 0
  let cursor = toBRT(new Date(start))
  const finish = toBRT(new Date(end))

  if (!isWithinBusinessHours(cursor)) {
    cursor = nextBusinessMoment(cursor)
  }

  while (cursor < finish) {
    const endOfDay = new Date(cursor)
    endOfDay.setHours(BUSINESS_END_HOUR, 0, 0, 0)

    const segmentEnd = endOfDay < finish ? endOfDay : finish
    if (isWithinBusinessHours(cursor)) {
      ms += segmentEnd.getTime() - cursor.getTime()
    }

    cursor = new Date(cursor)
    cursor.setDate(cursor.getDate() + 1)
    cursor.setHours(BUSINESS_START_HOUR, 0, 0, 0)
    cursor = nextBusinessMoment(cursor)
  }

  return Math.floor(ms / 60_000)
}

export { isWithinBusinessHours, toBRT }
