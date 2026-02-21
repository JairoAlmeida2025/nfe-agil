/**
 * Utilitário de datas com timezone America/Sao_Paulo (BRT).
 *
 * Brasil aboliu o horário de verão (BRST) em 2019.
 * Desde então, São Paulo é sempre UTC-3 (offset fixo).
 *
 * Abordagem: shift simples de -3h em UTC — sem Intl, sem libs externas.
 * Compatível com Vercel Edge e Node.js serverless.
 */

// Re-exporta PeriodPreset de constants.ts (fonte única de verdade)
export type { PeriodPreset } from '@/lib/constants'
import type { PeriodPreset } from '@/lib/constants'

/** Offset fixo BRT = UTC-3 (em milissegundos) */
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000   // 3h em ms

/**
 * Retorna {year, month, day} no timezone BRT a partir de "agora".
 * Equivale a new Date() ajustado para UTC-3.
 */
function nowBRT(): { year: number; month: number; day: number } {
    // Subtrai 3h do UTC para obter a hora local BRT
    const brt = new Date(Date.now() - BRT_OFFSET_MS)
    return {
        year: brt.getUTCFullYear(),
        month: brt.getUTCMonth() + 1,
        day: brt.getUTCDate(),
    }
}

/**
 * Retorna o ISO UTC correspondente a 00:00:00 BRT do dia Y-M-D.
 * BRT 00:00 = UTC 03:00 do mesmo dia.
 */
function startOfDayBRT(year: number, month: number, day: number): string {
    return new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0)).toISOString()
}

/**
 * Retorna o ISO UTC correspondente a 23:59:59.999 BRT do dia Y-M-D.
 * BRT 23:59:59 = UTC 02:59:59 do dia seguinte.
 */
function endOfDayBRT(year: number, month: number, day: number): string {
    return new Date(Date.UTC(year, month - 1, day + 1, 2, 59, 59, 999)).toISOString()
}

/** Número de dias no mês (1-indexed) */
function daysInMonth(year: number, month: number): number {
    return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export interface DateRange {
    from: string   // ISO UTC — string vazia significa sem limite
    to: string     // ISO UTC — string vazia significa sem limite
}

/**
 * Calcula o range de datas em UTC para o preset, usando timezone BRT (UTC-3).
 */
export function computeDateRangeBRT(
    preset: PeriodPreset,
    customFrom?: string,  // 'YYYY-MM-DD' (BRT) — apenas para preset='custom'
    customTo?: string,    // 'YYYY-MM-DD' (BRT) — apenas para preset='custom'
): DateRange {
    const { year, month, day } = nowBRT()

    switch (preset) {

        case 'hoje':
            return {
                from: startOfDayBRT(year, month, day),
                to: endOfDayBRT(year, month, day),
            }

        case 'esta_semana': {
            // Semana ISO: começa na segunda-feira
            const todayUTC = new Date(Date.UTC(year, month - 1, day))
            const dow = todayUTC.getUTCDay()               // 0=Dom, 1=Seg...
            const daysToMonday = dow === 0 ? 6 : dow - 1
            const mondayUTC = new Date(todayUTC)
            mondayUTC.setUTCDate(todayUTC.getUTCDate() - daysToMonday)
            const sundayUTC = new Date(mondayUTC)
            sundayUTC.setUTCDate(mondayUTC.getUTCDate() + 6)
            return {
                from: startOfDayBRT(mondayUTC.getUTCFullYear(), mondayUTC.getUTCMonth() + 1, mondayUTC.getUTCDate()),
                to: endOfDayBRT(sundayUTC.getUTCFullYear(), sundayUTC.getUTCMonth() + 1, sundayUTC.getUTCDate()),
            }
        }

        case 'mes_atual':
            return {
                from: startOfDayBRT(year, month, 1),
                to: endOfDayBRT(year, month, daysInMonth(year, month)),
            }

        case 'mes_passado': {
            const lmYear = month === 1 ? year - 1 : year
            const lmMonth = month === 1 ? 12 : month - 1
            return {
                from: startOfDayBRT(lmYear, lmMonth, 1),
                to: endOfDayBRT(lmYear, lmMonth, daysInMonth(lmYear, lmMonth)),
            }
        }

        case 'custom':
            return {
                from: customFrom ? startOfDayBRT(
                    Number(customFrom.slice(0, 4)),
                    Number(customFrom.slice(5, 7)),
                    Number(customFrom.slice(8, 10)),
                ) : '',
                to: customTo ? endOfDayBRT(
                    Number(customTo.slice(0, 4)),
                    Number(customTo.slice(5, 7)),
                    Number(customTo.slice(8, 10)),
                ) : '',
            }

        case 'todos':
            return { from: '', to: '' }

        default:
            console.warn('PERIOD NÃO RECONHECIDO:', preset)
            return { from: '', to: '' }
    }
}
