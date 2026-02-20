/**
 * Utilitário de datas com timezone America/Sao_Paulo (BRT/BRST).
 *
 * Usa Intl.DateTimeFormat para obter a data/hora local do Brasil sem
 * depender de bibliotecas externas. Compatível com Vercel serverless.
 */

export type PeriodPreset = 'today' | 'this_week' | 'last_month' | 'this_month' | 'all' | 'custom'

const TZ = 'America/Sao_Paulo'

/** Retorna a data/hora atual no timezone BRT como objeto Date "local" */
function nowBRT(): { year: number; month: number; day: number } {
    const now = new Date()
    const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    })
    const [year, month, day] = fmt.format(now).split('-').map(Number)
    return { year, month, day }
}

/** Converte ano/mês/dia (BRT) para ISO string UTC início do dia */
function toStartOfDayISO(year: number, month: number, day: number): string {
    // Cria Date em UTC que representa meia-noite em BRT
    // BRT = UTC-3, BRST = UTC-2 (horário de verão) — Intl resolve isso automaticamente
    const localDate = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00`)
    const offset = getOffsetMinutes(localDate)
    const utcMs = localDate.getTime() - offset * 60_000
    // Garante início do dia BRT como UTC
    return new Date(utcMs).toISOString()
}

/** Converte ano/mês/dia (BRT) para ISO string UTC fim do dia (23:59:59.999) */
function toEndOfDayISO(year: number, month: number, day: number): string {
    const localDate = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T23:59:59.999`)
    const offset = getOffsetMinutes(localDate)
    const utcMs = localDate.getTime() - offset * 60_000
    return new Date(utcMs).toISOString()
}

/** Retorna o offset em minutos do timezone BRT para uma data específica */
function getOffsetMinutes(date: Date): number {
    const brtStr = date.toLocaleString('en-US', { timeZone: TZ, timeZoneName: 'short' })
    // BRT = -180 min, BRST = -120 min
    // Abordagem alternativa: comparar UTC com BRT
    const utcParts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'UTC',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(date)
    const brtParts = new Intl.DateTimeFormat('en-CA', {
        timeZone: TZ,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(date)

    const get = (parts: Intl.DateTimeFormatPart[], type: string) =>
        Number(parts.find(p => p.type === type)?.value ?? '0')

    const utcH = get(utcParts, 'hour'), utcM = get(utcParts, 'minute')
    const brtH = get(brtParts, 'hour'), brtM = get(brtParts, 'minute')

    return (utcH * 60 + utcM) - (brtH * 60 + brtM)
}

export interface DateRange {
    from: string   // ISO UTC
    to: string     // ISO UTC
}

/**
 * Calcula o range de datas em UTC correspondente ao preset, usando timezone BRT.
 * Para 'all' retorna { from: '', to: '' } (sem filtro de data).
 * Para 'custom' retorna os valores passados em `customFrom` / `customTo`.
 */
export function computeDateRangeBRT(
    preset: PeriodPreset,
    customFrom?: string,
    customTo?: string,
): DateRange {
    const { year, month, day } = nowBRT()

    switch (preset) {
        case 'today':
            return {
                from: toStartOfDayISO(year, month, day),
                to: toEndOfDayISO(year, month, day),
            }

        case 'this_week': {
            // Semana começa na segunda-feira (ISO week)
            const today = new Date(year, month - 1, day)
            const dow = today.getDay() // 0=dom, 1=seg...
            const daysToMonday = dow === 0 ? 6 : dow - 1
            const monday = new Date(today)
            monday.setDate(today.getDate() - daysToMonday)
            const sunday = new Date(monday)
            sunday.setDate(monday.getDate() + 6)
            return {
                from: toStartOfDayISO(monday.getFullYear(), monday.getMonth() + 1, monday.getDate()),
                to: toEndOfDayISO(sunday.getFullYear(), sunday.getMonth() + 1, sunday.getDate()),
            }
        }

        case 'this_month': {
            const lastDay = new Date(year, month, 0).getDate()
            return {
                from: toStartOfDayISO(year, month, 1),
                to: toEndOfDayISO(year, month, lastDay),
            }
        }

        case 'last_month': {
            const firstOfThisMonth = new Date(year, month - 1, 1)
            const lastOfLastMonth = new Date(firstOfThisMonth)
            lastOfLastMonth.setDate(0)
            const firstOfLastMonth = new Date(lastOfLastMonth.getFullYear(), lastOfLastMonth.getMonth(), 1)
            return {
                from: toStartOfDayISO(
                    firstOfLastMonth.getFullYear(),
                    firstOfLastMonth.getMonth() + 1,
                    1,
                ),
                to: toEndOfDayISO(
                    lastOfLastMonth.getFullYear(),
                    lastOfLastMonth.getMonth() + 1,
                    lastOfLastMonth.getDate(),
                ),
            }
        }

        case 'custom':
            return {
                from: customFrom ? `${customFrom}T00:00:00` : '',
                to: customTo ? `${customTo}T23:59:59` : '',
            }

        case 'all':
        default:
            return { from: '', to: '' }
    }
}
