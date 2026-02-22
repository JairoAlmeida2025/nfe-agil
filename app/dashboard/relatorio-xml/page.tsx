'use client'

import { useState, useRef } from 'react'
import { Upload, Download, Table as TableIcon, X, Loader2, FileSpreadsheet, AlertCircle, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import * as XLSX from 'xlsx'

interface ReportRow {
    tipo: string
    chave: string
    numero: string
    serie: string
    emissao: string
    natOp: string
    emitCnpj: string
    emitNome: string
    emitUf: string
    destCnpj: string
    destNome: string
    destUf: string
    valorProdutos: number
    valorNF: number
    valorICMS: number
    valorPIS: number
    valorCOFINS: number
    valorIPI: number
    valorFrete: number
    valorDesconto: number
    qtdItens: number
    protocolo: string
    cancelada: boolean
}

type SortField = keyof ReportRow
type SortDir = 'asc' | 'desc'

export default function RelatorioXmlPage() {
    const [rows, setRows] = useState<ReportRow[]>([])
    const [errors, setErrors] = useState<{ filename: string; error: string }[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const [search, setSearch] = useState('')
    const [sortField, setSortField] = useState<SortField>('emissao')
    const [sortDir, setSortDir] = useState<SortDir>('desc')
    const fileInputRef = useRef<HTMLInputElement>(null)

    const processFiles = async (files: FileList | File[]) => {
        const xmlFiles = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.xml'))
        if (xmlFiles.length === 0) return

        setIsLoading(true)
        setErrors([])

        const formData = new FormData()
        xmlFiles.forEach(f => formData.append('files', f))

        try {
            const res = await fetch('/api/relatorio-xml', {
                method: 'POST',
                body: formData,
            })

            if (!res.ok) {
                const err = await res.json()
                setErrors([{ filename: 'Geral', error: err.error }])
                return
            }

            const data = await res.json()
            setRows(prev => [...prev, ...data.rows])
            if (data.errors.length > 0) {
                setErrors(prev => [...prev, ...data.errors])
            }
        } catch (err: any) {
            setErrors([{ filename: 'Conexão', error: err.message }])
        } finally {
            setIsLoading(false)
        }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        if (e.dataTransfer.files) processFiles(e.dataTransfer.files)
    }

    // Formatters
    const fmtDate = (iso: string) => {
        if (!iso) return '-'
        try {
            const d = new Date(iso)
            return d.toLocaleDateString('pt-BR')
        } catch {
            return iso.slice(0, 10)
        }
    }

    const fmtMoney = (v: number) =>
        v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

    // Sort & filter
    const filteredRows = rows
        .filter(r => {
            if (!search) return true
            const q = search.toLowerCase()
            return (
                r.emitNome.toLowerCase().includes(q) ||
                r.destNome.toLowerCase().includes(q) ||
                r.chave.includes(q) ||
                r.numero.includes(q) ||
                r.emitCnpj.includes(q) ||
                r.destCnpj.includes(q)
            )
        })
        .sort((a, b) => {
            const aVal = a[sortField]
            const bVal = b[sortField]
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return sortDir === 'asc' ? aVal - bVal : bVal - aVal
            }
            const aStr = String(aVal)
            const bStr = String(bVal)
            return sortDir === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr)
        })

    const toggleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'))
        } else {
            setSortField(field)
            setSortDir('asc')
        }
    }

    const SortIndicator = ({ field }: { field: SortField }) => (
        sortField === field ? (
            <span className="ml-1 text-xs">{sortDir === 'asc' ? '▲' : '▼'}</span>
        ) : null
    )

    // Export XLSX
    const exportToExcel = () => {
        const exportData = filteredRows.map(r => ({
            'Tipo': r.tipo,
            'Chave de Acesso': r.chave,
            'Número': r.numero,
            'Série': r.serie,
            'Emissão': fmtDate(r.emissao),
            'Natureza': r.natOp,
            'CNPJ Emitente': r.emitCnpj,
            'Emitente': r.emitNome,
            'UF Emit.': r.emitUf,
            'CNPJ Destinatário': r.destCnpj,
            'Destinatário': r.destNome,
            'UF Dest.': r.destUf,
            'Valor Produtos': r.valorProdutos,
            'Valor NF': r.valorNF,
            'ICMS': r.valorICMS,
            'PIS': r.valorPIS,
            'COFINS': r.valorCOFINS,
            'IPI': r.valorIPI,
            'Frete': r.valorFrete,
            'Desconto': r.valorDesconto,
            'Qtd Itens': r.qtdItens,
            'Protocolo': r.protocolo,
            'Cancelada': r.cancelada ? 'SIM' : 'NÃO',
        }))

        const ws = XLSX.utils.json_to_sheet(exportData)

        // Auto-width das colunas
        const colWidths = Object.keys(exportData[0] || {}).map(key => ({
            wch: Math.max(key.length, ...exportData.map(r => String((r as any)[key]).length))
        }))
        ws['!cols'] = colWidths

        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Relatório NF-e')
        XLSX.writeFile(wb, `relatorio-nfe-${new Date().toISOString().slice(0, 10)}.xlsx`)
    }

    const clearAll = () => {
        setRows([])
        setErrors([])
        setSearch('')
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Relatório de XMLs</h1>
                    <p className="text-muted-foreground text-sm">
                        Faça upload dos XMLs e visualize um relatório organizado. Exporte para Excel (.xlsx).
                    </p>
                </div>
                {rows.length > 0 && (
                    <div className="flex gap-2">
                        <Button onClick={exportToExcel} className="gap-2">
                            <FileSpreadsheet className="h-4 w-4" />
                            Exportar Excel
                        </Button>
                        <Button variant="outline" onClick={clearAll} className="gap-2">
                            <X className="h-4 w-4" />
                            Limpar
                        </Button>
                    </div>
                )}
            </div>

            {/* Upload Zone */}
            {rows.length === 0 && !isLoading && (
                <Card>
                    <CardContent className="pt-6">
                        <div
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`
                                border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all
                                ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
                            `}
                        >
                            <Upload className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                            <p className="text-sm font-medium text-muted-foreground">
                                Arraste XMLs aqui ou clique para selecionar
                            </p>
                            <p className="text-xs text-muted-foreground/60 mt-1">Até 100 arquivos .xml</p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                accept=".xml"
                                className="hidden"
                                onChange={(e) => e.target.files && processFiles(e.target.files)}
                            />
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Loading */}
            {isLoading && (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-3" />
                        <p className="text-sm text-muted-foreground">Processando XMLs...</p>
                    </CardContent>
                </Card>
            )}

            {/* Errors */}
            {errors.length > 0 && (
                <Card className="border-destructive/30">
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                            <AlertCircle className="h-4 w-4" />
                            {errors.length} erro{errors.length > 1 ? 's' : ''} no processamento
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-1">
                        {errors.map((e, i) => (
                            <p key={i} className="text-xs text-muted-foreground">
                                <strong>{e.filename}:</strong> {e.error}
                            </p>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Tabela */}
            {rows.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <CardTitle className="flex items-center gap-2">
                                <TableIcon className="h-5 w-5" />
                                {filteredRows.length} nota{filteredRows.length !== 1 ? 's' : ''}
                            </CardTitle>
                            <div className="flex-1" />
                            <div className="relative max-w-xs w-full">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar por nome, CNPJ, chave..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-9"
                                />
                            </div>
                            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                                <Upload className="h-4 w-4 mr-1" /> Adicionar XMLs
                            </Button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                accept=".xml"
                                className="hidden"
                                onChange={(e) => e.target.files && processFiles(e.target.files)}
                            />
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="cursor-pointer whitespace-nowrap" onClick={() => toggleSort('tipo')}>
                                            Tipo<SortIndicator field="tipo" />
                                        </TableHead>
                                        <TableHead className="cursor-pointer whitespace-nowrap" onClick={() => toggleSort('numero')}>
                                            Número<SortIndicator field="numero" />
                                        </TableHead>
                                        <TableHead className="cursor-pointer whitespace-nowrap" onClick={() => toggleSort('emissao')}>
                                            Emissão<SortIndicator field="emissao" />
                                        </TableHead>
                                        <TableHead className="cursor-pointer whitespace-nowrap" onClick={() => toggleSort('emitCnpj')}>
                                            CNPJ Emit.<SortIndicator field="emitCnpj" />
                                        </TableHead>
                                        <TableHead className="cursor-pointer whitespace-nowrap" onClick={() => toggleSort('emitNome')}>
                                            Emitente<SortIndicator field="emitNome" />
                                        </TableHead>
                                        <TableHead className="cursor-pointer whitespace-nowrap" onClick={() => toggleSort('emitUf')}>
                                            UF<SortIndicator field="emitUf" />
                                        </TableHead>
                                        <TableHead className="cursor-pointer whitespace-nowrap" onClick={() => toggleSort('destCnpj')}>
                                            CNPJ Dest.<SortIndicator field="destCnpj" />
                                        </TableHead>
                                        <TableHead className="cursor-pointer whitespace-nowrap" onClick={() => toggleSort('destNome')}>
                                            Destinatário<SortIndicator field="destNome" />
                                        </TableHead>
                                        <TableHead className="cursor-pointer text-right whitespace-nowrap" onClick={() => toggleSort('valorNF')}>
                                            Valor NF<SortIndicator field="valorNF" />
                                        </TableHead>
                                        <TableHead className="cursor-pointer text-right whitespace-nowrap" onClick={() => toggleSort('qtdItens')}>
                                            Itens<SortIndicator field="qtdItens" />
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredRows.map((r, i) => (
                                        <TableRow key={i} className={r.cancelada ? 'opacity-50 line-through' : ''}>
                                            <TableCell>
                                                <Badge variant={r.tipo === 'Entrada' ? 'default' : 'secondary'} className="text-xs">
                                                    {r.tipo}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">{r.numero}</TableCell>
                                            <TableCell className="text-xs whitespace-nowrap">{fmtDate(r.emissao)}</TableCell>
                                            <TableCell className="font-mono text-xs">{r.emitCnpj}</TableCell>
                                            <TableCell className="text-xs max-w-[200px] truncate">{r.emitNome}</TableCell>
                                            <TableCell className="text-xs">{r.emitUf}</TableCell>
                                            <TableCell className="font-mono text-xs">{r.destCnpj}</TableCell>
                                            <TableCell className="text-xs max-w-[200px] truncate">{r.destNome}</TableCell>
                                            <TableCell className="text-right font-medium text-xs whitespace-nowrap">
                                                {fmtMoney(r.valorNF)}
                                            </TableCell>
                                            <TableCell className="text-right text-xs">{r.qtdItens}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
