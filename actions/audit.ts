import { supabaseAdmin } from "@/lib/supabase-admin"

export interface AuditReport {
    nsuConsistente: boolean
    duplicidade: boolean
    xmlIntegro: boolean
    manifestacaoValida: boolean
    certificadoValido: boolean
    ambienteCorreto: boolean
    errors: string[]
}

export async function runFiscalAudit(): Promise<AuditReport> {
    const report: AuditReport = {
        nsuConsistente: true,
        duplicidade: false,
        xmlIntegro: true,
        manifestacaoValida: true,
        certificadoValido: true,
        ambienteCorreto: true,
        errors: []
    }

    try {
        console.log('[Audit] Iniciando Auditoria Fiscal...')

        // 1. NSU Consistente
        const { data: syncStates } = await supabaseAdmin.from('nfe_sync_state').select('*')
        if (syncStates) {
            for (const state of syncStates) {
                if (state.ultimo_nsu < 0) {
                    report.nsuConsistente = false
                    report.errors.push(`NSU negativo para ${state.user_id}`)
                }
            }
        }

        // 2. Duplicidade e Integridade de Dados
        const { data: allNfes } = await supabaseAdmin.from('nfes').select('chave')
        if (allNfes) {
            const chaves = new Set()
            for (const nfe of allNfes) {
                if (chaves.has(nfe.chave)) {
                    report.duplicidade = true
                    report.errors.push(`Chave duplicada: ${nfe.chave}`)
                }
                chaves.add(nfe.chave)

                // 6. Integridade Dados Chave
                if (nfe.chave.length !== 44) {
                    report.errors.push(`Chave com tamanho inválido (${nfe.chave.length}): ${nfe.chave}`)
                }
            }
        }

        // 3. XML Integrity (Amostra 5)
        const { data: xmls } = await supabaseAdmin
            .from('nfes')
            .select('chave, xml_url')
            .eq('status', 'xml_disponivel')
            .limit(5)

        if (xmls) {
            for (const nfe of xmls) {
                if (!nfe.xml_url) {
                    report.xmlIntegro = false
                    report.errors.push(`NFe ${nfe.chave} tem status xml_disponivel mas sem xml_url`)
                    continue
                }
                try {
                    const { data, error } = await supabaseAdmin.storage.from('xml').download(nfe.xml_url)
                    if (error || !data) {
                        report.xmlIntegro = false
                        report.errors.push(`XML não encontrado no Storage para ${nfe.chave}: ${nfe.xml_url}`)
                    } else {
                        const text = await data.text()
                        if (!text.includes('<NFe')) {
                            report.xmlIntegro = false
                            report.errors.push(`XML corrompido/incompleto para ${nfe.chave}`)
                        }
                    }
                } catch (e: any) {
                    report.xmlIntegro = false
                    report.errors.push(`Erro download XML ${nfe.chave}: ${e.message}`)
                }
            }
        }

        // 4. Manifestação Valida
        const { data: manifs } = await supabaseAdmin
            .from('nfes')
            .select('chave, manifestacao, data_manifestacao')
            .eq('manifestacao', 'ciencia')
            .limit(20)

        if (manifs) {
            for (const nfe of manifs) {
                if (!nfe.data_manifestacao) {
                    report.manifestacaoValida = false
                    report.errors.push(`NFe ${nfe.chave} com ciência mas sem data_manifestacao`)
                }
            }
        }

        // 5. Certificado e Ambiente
        const microUrl = process.env.MICRO_SEFAZ_URL || 'http://localhost:3001'
        try {
            const res = await fetch(`${microUrl}/sefaz/status`, { cache: 'no-store' })
            if (res.ok) {
                const status = await res.json()
                if (!status.valid) {
                    report.certificadoValido = false
                    report.errors.push(`Certificado expirado em ${status.expirationDate}`)
                }
                if (status.environment !== 'production') {
                    report.ambienteCorreto = false
                    report.errors.push(`Ambiente incorreto: ${status.environment} (esperado: production)`)
                }
            } else {
                report.certificadoValido = false
                report.errors.push(`Micro-serviço status retornou erro HTTP ${res.status}`)
            }
        } catch (e: any) {
            report.certificadoValido = false
            report.errors.push(`Micro-serviço inacessível: ${e.message}`)
        }

    } catch (e: any) {
        report.errors.push(`Erro geral na auditoria: ${e.message}`)
    }

    console.log('[Audit] Report Final:', JSON.stringify(report, null, 2))
    return report
}
