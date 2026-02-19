import Link from "next/link"
import {
    ArrowLeft,
    Download,
    Eye,
    FileText,
    Building2,
    Hash,
    Calendar,
    DollarSign,
    CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

// Dados mock — serão substituídos por fetch real
const mockNFe = {
    id: "728ed52f",
    numero: "001234",
    serie: "001",
    chave: "35230900000000000000550010000012341000012345",
    emitente: {
        razaoSocial: "Tech Solutions Ltda",
        cnpj: "12.345.678/0001-90",
    },
    destinatario: {
        razaoSocial: "Eletrocol Compras Ltda",
        cnpj: "98.765.432/0001-10",
    },
    dataEmissao: "18/02/2026",
    dataEntrada: "18/02/2026",
    valor: 1250.0,
    status: "recebida" as const,
    naturezaOperacao: "Venda de Mercadoria",
    xmlPath: "/storage/xmls/001234.xml",
    pdfPath: "/storage/pdfs/001234.pdf",
}

const statusConfig = {
    recebida: { label: "Recebida", variant: "secondary" as const },
    manifestada: { label: "Manifestada", variant: "warning" as const },
    arquivada: { label: "Arquivada", variant: "success" as const },
    cancelada: { label: "Cancelada", variant: "destructive" as const },
}

export default function NFeDetailPage({ params }: { params: { id: string } }) {
    const nfe = mockNFe
    const status = statusConfig[nfe.status]

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild className="rounded-sm">
                        <Link href="/dashboard">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">
                            NF-e {nfe.numero}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            Série {nfe.serie} · {nfe.naturezaOperacao}
                        </p>
                    </div>
                </div>
                <Badge variant={status.variant} className="uppercase text-xs px-3 py-1">
                    {status.label}
                </Badge>
            </div>

            {/* Chave de Acesso */}
            <Card className="rounded-sm border-l-4 border-l-primary">
                <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                        Chave de Acesso
                    </p>
                    <p className="font-mono text-sm break-all">{nfe.chave}</p>
                </CardContent>
            </Card>

            {/* Grid de Informações */}
            <div className="grid gap-4 md:grid-cols-2">
                {/* Emitente */}
                <Card className="rounded-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            Emitente
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <p className="font-semibold">{nfe.emitente.razaoSocial}</p>
                        <p className="text-sm text-muted-foreground font-mono">
                            {nfe.emitente.cnpj}
                        </p>
                    </CardContent>
                </Card>

                {/* Destinatário */}
                <Card className="rounded-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            Destinatário
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <p className="font-semibold">{nfe.destinatario.razaoSocial}</p>
                        <p className="text-sm text-muted-foreground font-mono">
                            {nfe.destinatario.cnpj}
                        </p>
                    </CardContent>
                </Card>

                {/* Dados Fiscais */}
                <Card className="rounded-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                            <Hash className="h-4 w-4" />
                            Dados Fiscais
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Número</span>
                            <span className="font-mono font-medium">{nfe.numero}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Série</span>
                            <span className="font-mono font-medium">{nfe.serie}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Emissão</span>
                            <span className="font-medium">{nfe.dataEmissao}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Entrada</span>
                            <span className="font-medium">{nfe.dataEntrada}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Valor */}
                <Card className="rounded-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            Valor Total
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-bold tracking-tight">
                            {new Intl.NumberFormat("pt-BR", {
                                style: "currency",
                                currency: "BRL",
                            }).format(nfe.valor)}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Ações */}
            <Card className="rounded-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                        Documentos
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-3">
                    <Button variant="outline" className="rounded-sm gap-2">
                        <Download className="h-4 w-4" />
                        Baixar XML
                    </Button>
                    <Button variant="outline" className="rounded-sm gap-2">
                        <Eye className="h-4 w-4" />
                        Visualizar DANFE
                    </Button>
                    <Button className="rounded-sm gap-2">
                        <Download className="h-4 w-4" />
                        Baixar DANFE (PDF)
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
