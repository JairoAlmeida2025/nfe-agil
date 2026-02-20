import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getOwnerUserId } from '@/lib/get-owner-id'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { DanfePDF } from './danfe-pdf'

// Serverless-safe: sem Puppeteer, sem Chromium, sem filesystem
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ── Helpers ──────────────────────────────────────────────────────────────────

function xmlTag(xml: string, tag: string): string {
    const regex = new RegExp(`<[^>]*:?${tag}[^>]*>([^<]*)<\\/[^>]*:?${tag}>`, 'i')
    const match = xml.match(regex)
    return match?.[1]?.trim() ?? ''
}

function brl(val: string | number): string {
    const n = typeof val === 'string' ? parseFloat(val.replace(',', '.')) : val
    if (isNaN(n)) return 'R$ 0,00'
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(iso: string): string {
    if (!iso) return ''
    try {
        const d = new Date(iso)
        return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    } catch {
        return iso
    }
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // 1. Autenticação e Multi-tenancy
        const ownerId = await getOwnerUserId()
        if (!ownerId) {
            return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
        }

        const { id } = await params
        if (!id) return NextResponse.json({ error: 'ID inválido.' }, { status: 400 })

        // 2. Buscar NF-e (segurança via ownerId)
        const { data: nfe, error: dbError } = await supabaseAdmin
            .from('nfes')
            .select('id, chave, numero, xml_content, user_id, status, data_emissao, emitente, destinatario, valor')
            .eq('id', id)
            .eq('user_id', ownerId)
            .single()

        if (dbError || !nfe) {
            return NextResponse.json({ error: 'NF-e não encontrada ou acesso negado.' }, { status: 404 })
        }

        if (!nfe.xml_content) {
            return NextResponse.json(
                { error: 'XML ainda não disponível pela SEFAZ.', code: 'XML_NOT_AVAILABLE' },
                { status: 422 }
            )
        }

        const xml = nfe.xml_content as string

        // 3. Extrair dados do XML
        const emitNome = xmlTag(xml, 'xNome') || nfe.emitente || 'Emitente não identificado'
        const emitCNPJ = xmlTag(xml, 'CNPJ') || xmlTag(xml, 'CPF') || ''
        const emitIE = xmlTag(xml, 'IE') || 'ISENTO'
        const emitLgr = xmlTag(xml, 'xLgr') || ''
        const emitNro = xmlTag(xml, 'nro') || ''
        const emitBairro = xmlTag(xml, 'xBairro') || ''
        const emitMun = xmlTag(xml, 'xMun') || ''
        const emitUF = xmlTag(xml, 'UF') || ''
        const emitCEP = xmlTag(xml, 'CEP') || ''
        const emitEndereco = [
            emitLgr && emitNro ? `${emitLgr}, ${emitNro}` : emitLgr,
            emitBairro,
            emitMun && emitUF ? `${emitMun}/${emitUF}` : emitMun,
            emitCEP ? `CEP: ${emitCEP}` : '',
        ].filter(Boolean).join(' - ')

        const destBlock = xml.includes('<dest>') ? xml.split('<dest>')[1] : ''
        const destNome = destBlock ? xmlTag(destBlock, 'xNome') : (nfe.destinatario || '')
        const destCNPJ = destBlock ? (xmlTag(destBlock, 'CNPJ') || xmlTag(destBlock, 'CPF')) : ''

        const nNF = xmlTag(xml, 'nNF') || nfe.numero || '-'
        const serie = xmlTag(xml, 'serie') || '-'
        const dhEmi = xmlTag(xml, 'dhEmi') || nfe.data_emissao || ''
        const vNF = xmlTag(xml, 'vNF') || String(nfe.valor || '0')
        const chaveNFe = nfe.chave || ''
        const natOp = xmlTag(xml, 'natOp') || ''
        const cancelada = nfe.status === 'cancelada'

        console.log('[DANFE ReactPDF] Gerando PDF para NF-e:', nNF, '| Chave:', chaveNFe.slice(-8))

        // 4. Gerar PDF via React PDF (serverless-safe, sem binário externo)
        const danfeElement = createElement(DanfePDF, {
            emitNome,
            emitEndereco,
            emitCNPJ,
            emitIE,
            destNome,
            destCNPJ,
            nNF,
            serie,
            dhEmi,
            natOp,
            vNF: brl(vNF),
            chaveNFe,
            cancelada,
            fmtDate,
        })

        // renderToBuffer espera um ReactElement do tipo Document
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdfBuffer = await renderToBuffer(danfeElement as any)

        const filename = nNF !== '-' ? `danfe-${nNF}.pdf` : `danfe-${chaveNFe.slice(-8)}.pdf`

        console.log('[DANFE ReactPDF] PDF gerado:', filename, '|', pdfBuffer.length, 'bytes')

        // Converter Buffer → Uint8Array para compatibilidade com Web API (NextResponse)
        const uint8 = new Uint8Array(pdfBuffer)

        return new NextResponse(uint8, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${filename}"`,
                'Content-Length': pdfBuffer.length.toString(),
                'Cache-Control': 'no-store',
            },
        })

    } catch (err: any) {
        console.error('[DANFE ReactPDF] Erro:', err.message, err.stack)
        return NextResponse.json(
            { error: 'Erro ao gerar o DANFE PDF.', details: err.message },
            { status: 500 }
        )
    }
}
