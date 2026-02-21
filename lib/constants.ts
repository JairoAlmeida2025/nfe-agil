/**
 * Constantes oficiais para o módulo de NF-e
 */

export const NFE_STATUS = {
    NAO_INFORMADA: 'nao_informada',
    CONFIRMADA: 'confirmada',
    RECUSADA: 'recusada'
} as const

export type NFeStatus = typeof NFE_STATUS[keyof typeof NFE_STATUS]

export const NFE_XML_FILTER = {
    TODAS: 'todas',
    XML_DISPONIVEL: 'xml_disponivel',
    XML_PENDENTE: 'xml_pendente'
} as const

export type NFeXmlFilter = typeof NFE_XML_FILTER[keyof typeof NFE_XML_FILTER]

/**
 * Enum centralizado de presets de período.
 * Estes são os ÚNICOS valores válidos em toda a aplicação.
 * Frontend, URL e Backend devem usar exclusivamente estes valores.
 */
export const PERIOD_PRESETS = {
    HOJE: 'hoje',
    ESTA_SEMANA: 'esta_semana',
    MES_ATUAL: 'mes_atual',
    MES_PASSADO: 'mes_passado',
    TODOS: 'todos',
    CUSTOM: 'custom',
} as const

export type PeriodPreset = typeof PERIOD_PRESETS[keyof typeof PERIOD_PRESETS]
