"use client"

import * as React from "react"
import { MessageCircle, X, Send, Loader2, BotMessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Message = {
    id: string
    role: "user" | "agent"
    text: string
}

export function SupportChat({ user }: { user: any }) {
    const [isOpen, setIsOpen] = React.useState(false)
    const [messages, setMessages] = React.useState<Message[]>([
        { id: "msg-1", role: "agent", text: `Olá, ${user?.nome ? user.nome.split(" ")[0] : "visitante"}! Sou o assistente virtual do NF-e Ágil. Como posso ajudar com nossa plataforma hoje?` }
    ])
    const [input, setInput] = React.useState("")
    const [loading, setLoading] = React.useState(false)
    const messagesEndRef = React.useRef<HTMLDivElement>(null)

    React.useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
        }
    }, [messages, isOpen])

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!input.trim() || loading) return

        const userMsg = input.trim()
        setInput("")
        setMessages(prev => [...prev, { id: Date.now().toString(), role: "user", text: userMsg }])
        setLoading(true)

        try {
            const response = await fetch("https://editor-n8n.automacoesai.com/webhook/suporte", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sessionId: user?.id || "anonymous",
                    name: user?.nome || "Usuário",
                    email: user?.email || "N/A",
                    message: userMsg
                })
            })

            let botText = "Desculpe, não consegui obter uma resposta agora."
            if (response.ok) {
                const contentType = response.headers.get("content-type")
                if (contentType && contentType.includes("application/json")) {
                    const data = await response.json()
                    const extracted = data.text || data.message || data.output || data.response || (Array.isArray(data) ? data[0]?.output : data)
                    botText = typeof extracted === "string" ? extracted : JSON.stringify(extracted, null, 2)
                } else {
                    botText = await response.text()
                }
            }

            setMessages(prev => [...prev, { id: Date.now().toString(), role: "agent", text: botText }])
        } catch (error) {
            console.error("Chat error:", error)
            setMessages(prev => [...prev, { id: Date.now().toString(), role: "agent", text: "Ocorreu um erro ao conectar com nossos servidores de atendimento. Tente novamente em alguns instantes." }])
        } finally {
            setLoading(false)
        }
    }

    return (
        <>
            {/* Float Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] bg-primary text-primary-foreground flex items-center justify-center hover:scale-105 hover:bg-primary/90 transition-all z-50"
                    aria-label="Abrir suporte"
                >
                    <MessageCircle className="h-7 w-7" />
                </button>
            )}

            {/* Chat Window */}
            {isOpen && (
                <div className="fixed bottom-6 right-6 w-[360px] max-w-[calc(100vw-2rem)] h-[550px] max-h-[80vh] shadow-2xl rounded-2xl bg-background border flex flex-col z-50 overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-300">
                    {/* Header */}
                    <div className="bg-primary px-4 py-4 text-primary-foreground flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="bg-white/20 p-2 rounded-full">
                                <BotMessageSquare className="h-5 w-5 text-white" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm leading-tight text-white">Atendimento Inteligente</h3>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                    </span>
                                    <span className="text-[10px] text-white/80 font-medium">Online (Resposta imediata)</span>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-white/70 hover:text-white transition-colors p-1"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Messages Body */}
                    <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4 bg-[#f8fafc] dark:bg-muted/10">
                        <div className="text-center">
                            <span className="text-[10px] bg-muted/50 text-muted-foreground px-2 py-1 rounded-full uppercase tracking-wider font-semibold">Hoje</span>
                        </div>

                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex flex-col max-w-[85%] animate-in fade-in slide-in-from-bottom-2 ${msg.role === "agent"
                                    ? "self-start"
                                    : "self-end"
                                    }`}
                            >
                                <div
                                    className={`px-4 py-2.5 text-sm shadow-sm ${msg.role === "agent"
                                        ? "bg-white dark:bg-muted border text-foreground rounded-tr-2xl rounded-br-2xl rounded-bl-2xl markdown-support whitespace-pre-wrap"
                                        : "bg-primary text-primary-foreground rounded-tl-2xl rounded-bl-2xl rounded-br-2xl"
                                        }`}
                                    dangerouslySetInnerHTML={{ __html: (typeof msg.text === "string" ? msg.text : JSON.stringify(msg.text)).replace(/\n/g, "<br/>") }}
                                />
                                <span className={`text-[9px] text-muted-foreground mt-1 px-1 ${msg.role === "user" ? "text-right" : "text-left"}`}>
                                    {new Date(parseInt(msg.id.replace('msg-', '')) || Date.now()).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        ))}

                        {loading && (
                            <div className="self-start bg-white dark:bg-muted border text-foreground rounded-tr-2xl rounded-br-2xl rounded-bl-2xl px-4 py-3 shadow-sm max-w-[85%] flex items-center gap-2">
                                <span className="flex gap-1">
                                    <span className="h-1.5 w-1.5 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <span className="h-1.5 w-1.5 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <span className="h-1.5 w-1.5 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </span>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Footer */}
                    <div className="p-3 bg-background border-t shrink-0">
                        <form onSubmit={handleSend} className="flex gap-2">
                            <Input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Digite sua dúvida aqui..."
                                className="flex-1 bg-muted/40 border-muted-foreground/20 rounded-full px-4 focus-visible:ring-primary/50 text-sm"
                                disabled={loading}
                                autoComplete="off"
                            />
                            <Button
                                type="submit"
                                size="icon"
                                disabled={!input.trim() || loading}
                                className="rounded-full shrink-0 h-10 w-10 shadow-sm"
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 ml-0.5" />}
                            </Button>
                        </form>
                        <div className="text-center mt-2">
                            <span className="text-[9px] text-muted-foreground">Pode conter imprecisões. IA em beta.</span>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
