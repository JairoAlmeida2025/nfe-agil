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
    const [isHistoryLoaded, setIsHistoryLoaded] = React.useState(false)
    const [isLoadingHistory, setIsLoadingHistory] = React.useState(false)
    const messagesEndRef = React.useRef<HTMLDivElement>(null)

    // Busca o histórico do chat via Webhook secundário do n8n ao abrir o chat pela primeira vez
    React.useEffect(() => {
        if (isOpen && !isHistoryLoaded && user?.id) {
            setIsHistoryLoaded(true)
            setIsLoadingHistory(true)

            fetch(`https://editor-n8n.automacoesai.com/webhook/suporte-historico?sessionId=${user.id}`, {
                method: 'GET',
                headers: { "Content-Type": "application/json" }
            })
                .then(res => res.ok ? res.json() : null)
                .then(data => {
                    setIsLoadingHistory(false)
                    if (data && Array.isArray(data) && data.length > 0) {
                        // Mapeia o array de linha do Postgres devolvido pelo n8n
                        // Suportando os formatos comuns de memória (ex: type: 'human'/'ai', ou role: 'user'/'agent', content: '...')
                        const historyMessages = data.map((row: any, index: number) => {
                            // Tenta extrair a mensagem (pode ser o formato salvo pelo LangChain Memory ou raw)
                            const msgObj = typeof row.message === 'string' && row.message.startsWith('{') ? JSON.parse(row.message) : (row.message || row);
                            const roleType = msgObj.type || msgObj.role || row.role || (row.type === 'human' ? 'user' : 'agent');
                            const isUser = roleType === 'user' || roleType === 'human' || roleType === 'customer';

                            let textContent = msgObj.content || msgObj.text || msgObj.data?.content || row.text || row.content || '';

                            return {
                                id: `hist-${Date.now()}-${index}`,
                                role: isUser ? "user" as const : "agent" as const,
                                text: typeof textContent === 'string' ? textContent : JSON.stringify(textContent)
                            }
                        }).filter(m => m.text.trim() !== '');

                        if (historyMessages.length > 0) {
                            // Substitui a mensagem de boas vindas inicial pelo histórico real
                            setMessages(historyMessages);
                        }
                    }
                })
                .catch(err => {
                    console.error("Erro ao puxar histórico:", err)
                    setIsLoadingHistory(false)
                });
        }
    }, [isOpen, isHistoryLoaded, user?.id]);

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

                    let currentData = data;

                    // 1. Normalização inicial: Se for array (n8n node sem merge), pega o primeiro index
                    if (Array.isArray(currentData)) {
                        currentData = currentData[0];
                    }

                    // 2. O n8n frequentemente converte a propriedade JSON em String no nó Response. Extrai se for o caso:
                    if (currentData?.output && typeof currentData.output === 'string' && currentData.output.trim().startsWith('{')) {
                        try {
                            const parsed = JSON.parse(currentData.output);
                            currentData = { ...currentData, ...parsed };
                        } catch (e) {
                            // Ignora, texto comum
                        }
                    }

                    // 3. Tenta capturar arrays (messages) ou textos puros de diferentes estruturas padrão
                    let extracted: any = null;

                    if (currentData?.output?.messages && Array.isArray(currentData.output.messages)) {
                        extracted = currentData.output.messages;
                    } else if (currentData?.messages && Array.isArray(currentData.messages)) {
                        extracted = currentData.messages;
                    } else if (currentData?.data?.output?.messages) {
                        extracted = currentData.data.output.messages;
                    } else if (currentData?.output?.text) {
                        extracted = currentData.output.text;
                    } else if (currentData?.text) {
                        extracted = currentData.text;
                    } else if (currentData?.message) {
                        extracted = currentData.message;
                    } else if (currentData?.response) {
                        extracted = currentData.response;
                    } else if (currentData?.output && typeof currentData.output === 'string') {
                        extracted = currentData.output;
                    } else {
                        extracted = currentData;
                    }

                    // Se o n8n tiver montado um Array de textos puros nas messages, responde de forma "picada" (balões independentes)
                    if (Array.isArray(extracted) && extracted.every(item => typeof item === 'string')) {
                        for (let i = 0; i < extracted.length; i++) {
                            setMessages(prev => [...prev, { id: Date.now().toString() + '-' + i, role: "agent", text: extracted[i] }]);

                            // Adiciona um atraso de 3.5 segundos se houver mais mensagens para simular a IA "digitando" de forma mais realista
                            if (i < extracted.length - 1) {
                                await new Promise(resolve => setTimeout(resolve, 3500));
                            }
                        }
                        return; // Desvia pra Finally e finaliza imediatamente o Loader
                    }

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
                    className="fixed bottom-2 right-4 h-12 w-12 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] bg-primary text-primary-foreground flex items-center justify-center hover:scale-105 hover:bg-primary/90 transition-all z-50 origin-bottom-right"
                    aria-label="Abrir suporte"
                >
                    <MessageCircle className="h-7 w-7" />
                </button>
            )}

            {/* Chat Window */}
            {isOpen && (
                <div className="fixed bottom-2 right-4 w-[340px] max-w-[calc(100vw-2rem)] h-[500px] max-h-[75vh] shadow-2xl rounded-2xl bg-background border flex flex-col z-50 overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-300">
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

                        {isLoadingHistory && (
                            <div className="text-center w-full my-2">
                                <span className="text-[10px] flex items-center justify-center gap-2 text-muted-foreground">
                                    <Loader2 className="h-3 w-3 animate-spin" /> Resgatando histórico...
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
