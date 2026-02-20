import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getOwnerUserId } from '@/lib/get-owner-id'
import puppeteer from 'puppeteer-core'
import chromium from '@sparticuz/chromium-min'

// Força execução em Node.js runtime
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Extrai um campo de um XML pela tag name (case-insensitive e tolerante a namespaces) */
function xmlTag(xml: string, tag: string): string {
    const regex = new RegExp(`<[^>]*:?${tag}[^>]*>([^<]*)<\\/[^>]*:?${tag}>`, 'i')
    const match = xml.match(regex)
    return match?.[1]?.trim() ?? ''
}

/** Formata valor numérico para BRL */
function brl(val: string | number): string {
    const n = typeof val === 'string' ? parseFloat(val.replace(',', '.')) : val
    if (isNaN(n)) return 'R$ 0,00'
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Formata data ISO para DD/MM/AAAA */
function fmtDate(iso: string): string {
    if (!iso) return ''
    try {
        const d = new Date(iso)
        return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    } catch {
        return iso
    }
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let browser = null
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
            return NextResponse.json({ error: 'XML ainda não disponível pela SEFAZ.', code: 'XML_NOT_AVAILABLE' }, { status: 422 })
        }

        const xml = nfe.xml_content as string

        // 3. Extrair dados para o HTML
        const emit_xNome = xmlTag(xml, 'xNome')
        const emit_cnpj = xmlTag(xml, 'CNPJ') || xmlTag(xml, 'CPF')
        const emit_IE = xmlTag(xml, 'IE')
        const emit_xLgr = xmlTag(xml, 'xLgr')
        const emit_nro = xmlTag(xml, 'nro')
        const emit_xCpl = xmlTag(xml, 'xCpl')
        const emit_xBairro = xmlTag(xml, 'xBairro')
        const emit_xMun = xmlTag(xml, 'xMun')
        const emit_UF = xmlTag(xml, 'UF')
        const emit_CEP = xmlTag(xml, 'CEP')

        const dest_xNome = xmlTag(xml, 'dest') ? xmlTag(xml.split('<dest>')[1], 'xNome') : nfe.destinatario || ''
        const dest_cnpj = xmlTag(xml, 'dest') ? (xmlTag(xml.split('<dest>')[1], 'CNPJ') || xmlTag(xml.split('<dest>')[1], 'CPF')) : ''

        const nNF = xmlTag(xml, 'nNF') || nfe.numero || '-'
        const serie = xmlTag(xml, 'serie') || '-'
        const dhEmi = xmlTag(xml, 'dhEmi') || nfe.data_emissao || ''
        const vNF = xmlTag(xml, 'vNF') || nfe.valor || '0'
        const chaveNFe = nfe.chave || ''
        const natOp = xmlTag(xml, 'natOp')

        // Template HTML (Simulando uma DANFE profissional)
        const html = `
        <!DOCTYPE html>
        <html lang="pt-br">
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: 'Helvetica', 'Arial', sans-serif; margin: 0; padding: 20px; font-size: 10px; color: #333; }
                .container { width: 100%; border: 1px solid #000; padding: 10px; box-sizing: border-box; }
                .header { display: flex; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 10px; }
                .emitente { flex: 1; padding-right: 15px; }
                .danfe-info { width: 200px; border-left: 1px solid #000; padding-left: 15px; text-align: center; }
                .title { font-size: 14px; font-weight: bold; margin-bottom: 5px; }
                .subtitle { font-size: 9px; color: #666; margin-bottom: 8px; }
                .section-title { background: #eee; font-weight: bold; padding: 3px 5px; border: 1px solid #000; margin: 10px 0 5px 0; text-transform: uppercase; font-size: 9px; }
                .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; border: 1px solid #000; padding: 8px; }
                .field { display: flex; flex-direction: column; }
                .label { font-size: 7px; font-weight: bold; color: #555; text-transform: uppercase; margin-bottom: 2px; }
                .value { font-size: 10px; font-weight: bold; }
                .chave { font-size: 11px; letter-spacing: 1px; background: #f9f9f9; padding: 5px; border: 1px solid #ccc; text-align: center; margin: 5px 0; }
                .footer { margin-top: 20px; text-align: center; color: #888; border-top: 1px dashed #ccc; padding-top: 10px; }
                @media print { body { padding: 0; } }
                .cancelada { position: absolute; top: 40%; left: 0; width: 100%; text-align: center; font-size: 80px; color: rgba(255, 0, 0, 0.2); transform: rotate(-30deg); font-weight: bold; z-index: -1; pointer-events: none; }
            </style>
        </head>
        <body>
            ${nfe.status === 'cancelada' ? '<div class="cancelada">CANCELADA</div>' : ''}
            <div class="container">
                <div class="header">
                    <div class="emitente">
                        <div class="title">${emit_xNome}</div>
                        <div>${emit_xLgr}, ${emit_nro} ${emit_xCpl ? ' - ' + emit_xCpl : ''}</div>
                        <div>${emit_xBairro} - ${emit_xMun} / ${emit_UF}</div>
                        <div>CEP: ${emit_CEP} - IE: ${emit_IE}</div>
                        <div>CNPJ: ${emit_cnpj}</div>
                    </div>
                    <div class="danfe-info">
                        <div style="font-size: 16px; font-weight: bold;">DANFE</div>
                        <div class="subtitle">Documento Auxiliar da Nota Fiscal Eletrônica</div>
                        <div style="margin: 10px 0;">
                            <span style="font-weight: bold;">0 - ENTRADA</span><br>
                            <span style="font-size: 14px; font-weight: bold; border: 1px solid #000; padding: 2px 8px;">1</span><br>
                            <span style="font-weight: bold;">1 - SAÍDA</span>
                        </div>
                        <div style="font-size: 12px; font-weight: bold;">Nº ${nNF}</div>
                        <div style="font-size: 11px;">SÉRIE: ${serie}</div>
                    </div>
                </div>

                <div class="section-title">CHAVE DE ACESSO</div>
                <div class="chave">${chaveNFe.replace(/(.{4})/g, '$1 ').trim()}</div>

                <div class="section-title">Natureza da Operação</div>
                <div class="grid" style="grid-template-columns: 2fr 1fr;">
                    <div class="field"><span class="label">Descrição</span><span class="value">${natOp}</span></div>
                    <div class="field"><span class="label">Protocolo de Autorização</span><span class="value">Veja no portal da SEFAZ</span></div>
                </div>

                <div class="section-title">Destinatário / Remetente</div>
                <div class="grid">
                    <div class="field" style="grid-column: span 2;"><span class="label">Nome / Razão Social</span><span class="value">${dest_xNome}</span></div>
                    <div class="field"><span class="label">CNPJ / CPF</span><span class="value">${dest_cnpj}</span></div>
                    <div class="field"><span class="label">Inscrição Estadual</span><span class="value">ISENTO</span></div>
                </div>

                <div class="section-title">Datas</div>
                <div class="grid" style="grid-template-columns: repeat(3, 1fr);">
                    <div class="field"><span class="label">Data de Emissão</span><span class="value">${fmtDate(dhEmi)}</span></div>
                    <div class="field"><span class="label">Data de Entrada/Saída</span><span class="value">${fmtDate(dhEmi)}</span></div>
                    <div class="field"><span class="label">Hora de Entrada/Saída</span><span class="value">00:00:00</span></div>
                </div>

                <div class="section-title">Cálculo do Imposto</div>
                <div class="grid" style="grid-template-columns: repeat(5, 1fr);">
                    <div class="field"><span class="label">Base de Cálculo ICMS</span><span class="value">${brl(0)}</span></div>
                    <div class="field"><span class="label">Valor do ICMS</span><span class="value">${brl(0)}</span></div>
                    <div class="field"><span class="label">Valor do PIS</span><span class="value">${brl(0)}</span></div>
                    <div class="field"><span class="label">Valor do COFINS</span><span class="value">${brl(0)}</span></div>
                    <div class="field"><span class="label">Valor Total da Nota</span><span class="value" style="font-size: 12px;">${brl(vNF)}</span></div>
                </div>

                <div class="footer">
                    Este documento é uma representação simplificada da NF-e.<br>
                    A validade jurídica é garantida pela assinatura digital do emitente e a autorização de uso pela SEFAZ.
                </div>
            </div>
        </body>
        </html>
        `

        // 4. Gerar PDF com Puppeteer
        browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
        })

        const page = await browser.newPage()
        await page.setContent(html, { waitUntil: 'networkidle0' })

        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' }
        })

        const filename = nNF !== '-' ? `danfe-${nNF}.pdf` : `danfe-${chaveNFe.slice(-8)}.pdf`

        return new NextResponse(pdfBuffer as any, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${filename}"`,
                'Content-Length': pdfBuffer.length.toString(),
                'Cache-Control': 'no-store',
            },
        })

    } catch (err: any) {
        console.error('[DANFE Puppeteer] Erro:', err.message, err.stack)
        return NextResponse.json({ error: 'Erro ao gerar o DANFE PDF.', details: err.message }, { status: 500 })
    } finally {
        if (browser !== null) {
            await browser.close()
        }
    }
}
