import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface MetricCardProps {
    title: string
    value: string
    description?: string
    icon: React.ReactNode
    trend?: "up" | "down" | "neutral"
}

export function MetricCard({
    title,
    value,
    description,
    icon,
    trend,
}: MetricCardProps) {
    return (
        <Card className="rounded-sm border-l-4 border-l-primary shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                    {title}
                </CardTitle>
                <div className="text-primary opacity-80">{icon}</div>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold tracking-tight">{value}</div>
                {description && (
                    <p className="text-xs text-muted-foreground mt-1">{description}</p>
                )}
            </CardContent>
        </Card>
    )
}
