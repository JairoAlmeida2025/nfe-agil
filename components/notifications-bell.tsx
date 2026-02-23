"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Bell, Check } from "lucide-react"
import { createBrowserClient } from "@supabase/ssr"

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type Notification = {
    id: string
    title: string
    message: string
    is_read: boolean
    link: string | null
    created_at: string
}

export function NotificationsBell({ userId }: { userId: string }) {
    const router = useRouter()
    const [notifications, setNotifications] = React.useState<Notification[]>([])
    const [isOpen, setIsOpen] = React.useState(false)

    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const fetchNotifications = React.useCallback(async () => {
        if (!userId) return

        const { data } = await supabase
            .from("notifications")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(20)

        if (data) setNotifications(data)
    }, [supabase, userId])

    React.useEffect(() => {
        fetchNotifications()

        if (!userId) return

        const channel = supabase
            .channel('notifications_changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${userId}`
            }, () => {
                // Ao ocorrer insert/update/delete, recarrega a lista
                fetchNotifications()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [fetchNotifications, supabase, userId])

    const markAsRead = async (id: string, currentRead: boolean) => {
        if (currentRead) return

        // Optimistic update
        setNotifications((prev) => prev.map(n => n.id === id ? { ...n, is_read: true } : n))

        await supabase
            .from("notifications")
            .update({ is_read: true })
            .eq("id", id)
    }

    const markAllAsRead = async () => {
        const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id)
        if (unreadIds.length === 0) return

        // Optimistic update
        setNotifications((prev) => prev.map(n => ({ ...n, is_read: true })))

        await supabase
            .from("notifications")
            .update({ is_read: true })
            .in("id", unreadIds)
    }

    const clearAllNotifications = async () => {
        if (notifications.length === 0) return
        // Optimistic update
        setNotifications([])

        await supabase
            .from("notifications")
            .delete()
            .eq("user_id", userId)
    }

    const unreadCount = notifications.filter(n => !n.is_read).length

    function formatTimeAgo(dateString: string) {
        const diff = Date.now() - new Date(dateString).getTime()
        const minutes = Math.floor(diff / 60000)
        if (minutes < 1) return 'Agora'
        if (minutes < 60) return `${minutes}m`
        const hours = Math.floor(minutes / 60)
        if (hours < 24) return `${hours}h`
        const days = Math.floor(hours / 24)
        return `${days}d`
    }

    return (
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 relative text-white hover:bg-white/20 hover:text-white">
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500 border-2 border-background"></span>
                        </span>
                    )}
                    <span className="sr-only">Notificações</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 rounded-sm p-0">
                <div className="flex items-center justify-between px-4 py-3">
                    <DropdownMenuLabel className="p-0 font-semibold text-sm">Notificações</DropdownMenuLabel>
                    <div className="flex gap-1 items-center">
                        {unreadCount > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs text-primary hover:text-primary/80"
                                onClick={(e) => {
                                    e.preventDefault()
                                    markAllAsRead()
                                }}
                            >
                                <Check className="mr-1 h-3 w-3" /> Lidas
                            </Button>
                        )}
                        {notifications.length > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                                onClick={(e) => {
                                    e.preventDefault()
                                    clearAllNotifications()
                                }}
                            >
                                Limpar
                            </Button>
                        )}
                    </div>
                </div>
                <DropdownMenuSeparator className="m-0" />

                <div className="max-h-[350px] overflow-y-auto">
                    {notifications.length === 0 ? (
                        <div className="p-6 text-center text-sm text-muted-foreground">
                            Você não possui novas notificações.
                        </div>
                    ) : (
                        notifications.map((notif) => (
                            <div
                                key={notif.id}
                                className={`flex flex-col gap-1 px-4 py-3 relative border-b last:border-0 transition-colors cursor-pointer ${notif.is_read ? 'opacity-70 hover:bg-muted/50' : 'bg-primary/5 hover:bg-primary/10'}`}
                                onClick={(e) => {
                                    e.preventDefault()
                                    markAsRead(notif.id, notif.is_read)
                                }}
                            >
                                {!notif.is_read && (
                                    <span className="absolute left-1.5 top-4 h-1.5 w-1.5 rounded-full bg-primary" />
                                )}
                                <div className="flex items-center justify-between gap-2 pl-2">
                                    <span className="text-sm font-medium leading-none text-foreground">{notif.title}</span>
                                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">{formatTimeAgo(notif.created_at)}</span>
                                </div>
                                <p className="text-xs text-muted-foreground pl-2 leading-snug mt-1">
                                    {notif.message}
                                </p>
                            </div>
                        ))
                    )}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
