'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { FileUp, X, Loader2, Download, Eye, CheckCircle2, AlertCircle, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface FileItem {
    file: File
    name: string
    size: number
}

interface ConversionResult {
    filename: string
    success: boolean
    error?: string
}

type PageState = 'idle' | 'loaded' | 'confirming' | 'processing' | 'done' | 'error'

interface UsageInfo {
    usage: number
    limit: number | null
    remaining: number | null
    unlimited: boolean
}

export default function ConverterPage() {
    const [files, setFiles] = useState<FileItem[]>([])
    const [state, setState] = useState<PageState>('idle')
    const [progress, setProgress] = useState(0)
    const [results, setResults] = useState<ConversionResult[]>([])
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
    const [downloadFilename, setDownloadFilename] = useState('')
    const [errorMessage, setErrorMessage] = useState('')
    const [usage, setUsage] = useState<UsageInfo | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const dropRef = useRef<HTMLDivElement>(null)
    const [isDragging, setIsDragging] = useState(false)

    // Buscar uso mensal ao montar
    useEffect(() => {
        fetch('/api/converter')
            .then(r => r.json())
            .then(data => setUsage(data))
            .catch(() => { })
    }, [state])

    const addFiles = useCallback((newFiles: FileList | File[]) => {
        const xmlFiles = Array.from(newFiles)
            .filter(f => f.name.toLowerCase().endsWith('.xml'))
            .slice(0, 50)

        if (xmlFiles.length === 0) return

        const items: FileItem[] = xmlFiles.map(f => ({
            file: f,
            name: f.name,
            size: f.size,
        }))

        setFiles(prev => {
            const combined = [...prev, ...items]
            return combined.slice(0, 50) // max 50
        })
        setState('loaded')
    }, [])

    const removeFile = (index: number) => {
        setFiles(prev => {
            const updated = prev.filter((_, i) => i !== index)
            if (updated.length === 0) setState('idle')
            return updated
        })
    }

    const clearAll = () => {
        setFiles([])
        setState('idle')
        setResults([])
        setDownloadUrl(null)
        setErrorMessage('')
    }

    // Drop handlers
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(true)
    }
    const handleDragLeave = () => setIsDragging(false)
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragging(false)
        if (e.dataTransfer.files) addFiles(e.dataTransfer.files)
    }

    // Conversão
    const startConversion = async () => {
        setState('processing')
        setProgress(0)
        setResults([])
        setDownloadUrl(null)
        setErrorMessage('')

        const formData = new FormData()
        files.forEach(f => formData.append('files', f.file))

        // Simular progresso (a API não faz streaming)
        const progressInterval = setInterval(() => {
            setProgress(prev => Math.min(prev + 3, 90))
        }, 200)

        try {
            const response = await fetch('/api/converter', {
                method: 'POST',
                body: formData,
            })

            clearInterval(progressInterval)
            setProgress(100)

            if (!response.ok) {
                const err = await response.json()
                setErrorMessage(err.error || 'Erro na conversão.')
                setState('error')
                return
            }

            const contentType = response.headers.get('Content-Type') || ''
            const convertedCount = parseInt(response.headers.get('X-Converted-Count') || '0')
            const failedCount = parseInt(response.headers.get('X-Failed-Count') || '0')

            // Gerar resultados
            const newResults: ConversionResult[] = []
            for (let i = 0; i < convertedCount; i++) {
                newResults.push({ filename: `DANFE-${i + 1}.pdf`, success: true })
            }
            for (let i = 0; i < failedCount; i++) {
                newResults.push({ filename: `Arquivo ${convertedCount + i + 1}`, success: false, error: 'Falha na conversão' })
            }
            setResults(newResults)

            // Criar URL de download
            const blob = await response.blob()
            const url = URL.createObjectURL(blob)
            setDownloadUrl(url)

            if (contentType.includes('pdf')) {
                setDownloadFilename(`DANFE.pdf`)
            } else {
                setDownloadFilename(`danfes.zip`)
            }

            setState('done')
        } catch (err: any) {
            clearInterval(progressInterval)
            setErrorMessage(err.message || 'Erro de conexão.')
            setState('error')
        }
    }

    const handleDownload = () => {
        if (!downloadUrl) return
        const a = document.createElement('a')
        a.href = downloadUrl
        a.download = downloadFilename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
    }

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold tracking-tight">Converter XML para DANFE</h1>
                <p className="text-muted-foreground">
                    Faça upload dos seus XMLs de NF-e e converta automaticamente para PDF (DANFE).
                </p>
            </div>

            {/* Contador de uso (Starter) */}
            {usage && !usage.unlimited && (
                <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="py-3 px-4 flex items-center justify-between">
                        <span className="text-sm font-medium">
                            Conversões este mês: <strong>{usage.usage}</strong> de <strong>{usage.limit}</strong>
                        </span>
                        <Badge variant={usage.remaining && usage.remaining <= 10 ? 'destructive' : 'secondary'}>
                            {usage.remaining} restantes
                        </Badge>
                    </CardContent>
                </Card>
            )}

            {/* Área principal */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FileUp className="h-5 w-5" />
                        Upload de XMLs
                    </CardTitle>
                    <CardDescription>
                        Arraste arquivos XML de NF-e ou clique para selecionar. Máximo 50 arquivos por vez.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Drop Zone */}
                    {(state === 'idle' || state === 'loaded') && (
                        <div
                            ref={dropRef}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`
                                border-2 border-dashed rounded-lg p-8 sm:p-12 text-center cursor-pointer
                                transition-all duration-200
                                ${isDragging
                                    ? 'border-primary bg-primary/5 scale-[1.01]'
                                    : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
                                }
                            `}
                        >
                            <Upload className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                            <p className="text-sm font-medium text-muted-foreground">
                                {isDragging ? 'Solte os arquivos aqui...' : 'Clique ou arraste arquivos XML aqui'}
                            </p>
                            <p className="text-xs text-muted-foreground/60 mt-1">
                                Apenas arquivos .xml de NF-e
                            </p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                accept=".xml"
                                className="hidden"
                                onChange={(e) => e.target.files && addFiles(e.target.files)}
                            />
                        </div>
                    )}

                    {/* Lista de arquivos carregados */}
                    {files.length > 0 && (state === 'loaded' || state === 'idle') && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">
                                    {files.length} arquivo{files.length !== 1 ? 's' : ''} selecionado{files.length !== 1 ? 's' : ''}
                                </span>
                                <Button variant="ghost" size="sm" onClick={clearAll} className="text-muted-foreground">
                                    <X className="h-4 w-4 mr-1" /> Limpar
                                </Button>
                            </div>

                            <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                                {files.map((f, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center justify-between py-1.5 px-3 rounded-md bg-muted/40 text-sm"
                                    >
                                        <span className="truncate flex-1 font-mono text-xs">{f.name}</span>
                                        <span className="text-muted-foreground text-xs ml-3 shrink-0">
                                            {formatFileSize(f.size)}
                                        </span>
                                        <button
                                            onClick={() => removeFile(i)}
                                            className="ml-2 text-muted-foreground hover:text-destructive transition-colors"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <Button
                                onClick={() => setState('confirming')}
                                className="w-full"
                                size="lg"
                            >
                                <FileUp className="mr-2 h-5 w-5" />
                                Gerar DANFE{files.length > 1 ? 's' : ''}
                            </Button>
                        </div>
                    )}

                    {/* Progresso */}
                    {state === 'processing' && (
                        <div className="text-center space-y-4 py-8">
                            <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
                            <p className="font-medium">Convertendo {files.length} arquivo{files.length > 1 ? 's' : ''}...</p>
                            <Progress value={progress} className="max-w-md mx-auto" />
                            <p className="text-xs text-muted-foreground">
                                Isso pode levar alguns segundos dependendo da quantidade.
                            </p>
                        </div>
                    )}

                    {/* Resultado: Sucesso */}
                    {state === 'done' && (
                        <div className="text-center space-y-6 py-8">
                            <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500" />
                            <div>
                                <p className="text-lg font-semibold">
                                    Conversão concluída!
                                </p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {results.filter(r => r.success).length} de {results.length} arquivo{results.length > 1 ? 's' : ''} convertido{results.length > 1 ? 's' : ''} com sucesso.
                                </p>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                <Button onClick={handleDownload} size="lg" className="gap-2">
                                    <Download className="h-5 w-5" />
                                    Baixar {downloadFilename.endsWith('.zip') ? 'ZIP' : 'PDF'}
                                </Button>

                                <Button variant="outline" size="lg" onClick={clearAll} className="gap-2">
                                    <Upload className="h-5 w-5" />
                                    Nova Conversão
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Resultado: Erro */}
                    {state === 'error' && (
                        <div className="text-center space-y-4 py-8">
                            <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
                            <div>
                                <p className="text-lg font-semibold">Erro na conversão</p>
                                <p className="text-sm text-muted-foreground mt-1">{errorMessage}</p>
                            </div>
                            <Button variant="outline" onClick={clearAll}>
                                Tentar novamente
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Modal de Confirmação */}
            <AlertDialog open={state === 'confirming'} onOpenChange={(open) => {
                if (!open) setState('loaded')
            }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar conversão</AlertDialogTitle>
                        <AlertDialogDescription>
                            Deseja realmente gerar {files.length} DANFE{files.length > 1 ? 's' : ''} em PDF?
                            {usage && !usage.unlimited && (
                                <span className="block mt-2 text-xs">
                                    Uso atual: {usage.usage}/{usage.limit} — Após: {(usage.usage ?? 0) + files.length}/{usage.limit}
                                </span>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Não</AlertDialogCancel>
                        <AlertDialogAction onClick={startConversion}>
                            Sim, Gerar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
