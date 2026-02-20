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
