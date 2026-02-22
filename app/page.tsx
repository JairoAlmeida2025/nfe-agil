import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ShieldCheck,
  Search,
  Download,
  FileText,
  Lock,
  CheckCircle2,
  AlertTriangle,
  EyeOff,
  Building2,
  Server,
  TimerReset,
  AlertOctagon,
  TrendingDown,
  Activity,
  Users,
  ChevronLeft,
  ChevronRight,
  ImageIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-background font-sans text-foreground selection:bg-primary/20">
      {/* ── HEADER / NAVBAR ── */}
      <header className="fixed top-0 z-50 w-full border-b border-border bg-background shadow-sm">
        <div className="container mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image
              src="/images/logo_sidebar.png"
              alt="NF-e Ágil"
              width={140}
              height={40}
              priority
              className="h-8 md:h-10 w-auto object-contain dark:invert"
            />
          </div>
          <nav className="flex items-center gap-3 md:gap-4">
            <Link href="/login" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
              Entrar
            </Link>
            <Button asChild className="rounded-sm text-sm">
              <Link href="/login?modo=cadastro">
                Teste Grátis
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1 pt-16">
        {/* ── HERO SECTION ── */}
        <section className="relative overflow-hidden bg-primary text-primary-foreground py-20 lg:py-32 px-4 md:px-6">
          <div className="absolute inset-0 opacity-10">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="absolute border border-current rounded-sm"
                style={{
                  width: `${(i + 1) * 120}px`,
                  height: `${(i + 1) * 120}px`,
                  top: "10%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                }}
              />
            ))}
          </div>

          <div className="container relative z-10 mx-auto max-w-5xl text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-medium backdrop-blur-sm border border-white/10 shadow-xl">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Monitoramento Automático Ativo
            </div>

            <div className="space-y-4">
              <p className="text-emerald-400 font-bold tracking-wide uppercase text-xs sm:text-sm">
                Enquanto você dorme, notas podem estar sendo emitidas contra seu CNPJ.
              </p>
              <h1 className="text-3xl sm:text-4xl lg:text-6xl font-extrabold tracking-tight leading-tight">
                Controle automático das NF-es <br className="hidden md:block" /> emitidas contra seu CNPJ.
              </h1>
            </div>

            <p className="text-base sm:text-lg lg:text-xl text-primary-foreground/80 max-w-3xl mx-auto font-medium">
              &quot;Nunca mais descubra uma nota só quando o contador reclamar.&quot;
            </p>
            <p className="text-sm sm:text-base text-primary-foreground/70 max-w-2xl mx-auto px-2">
              A ferramenta definitiva para empresas que buscam segurança jurídica e organização fiscal. Sem instalações complexas, 100% web e integrado direto à SEFAZ.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 w-full sm:w-auto px-4 sm:px-0">
              <Button size="lg" variant="secondary" asChild className="rounded-sm w-full sm:w-auto font-semibold px-8 h-12 text-primary hover:bg-white/90">
                <Link href="/login?modo=cadastro">
                  Ativar Monitoramento Grátis por 7 Dias
                </Link>
              </Button>
              <div className="flex items-center justify-center gap-2 text-primary-foreground/60 text-xs mt-2 sm:mt-0 w-full sm:w-auto">
                <Lock className="h-4 w-4" /> Sem cartão. Cancele quando quiser.
              </div>
            </div>

            <div className="mt-12 lg:mt-16 pt-4 lg:pt-8 max-w-4xl mx-auto relative group hidden sm:block">
              <div className="absolute -inset-1 bg-gradient-to-r from-emerald-400 to-blue-500 rounded-lg blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative rounded-lg bg-background border border-border shadow-2xl overflow-hidden aspect-video flex flex-col">
                <div className="h-10 border-b border-border bg-muted/50 flex items-center px-4 gap-2">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-red-400"></div>
                    <div className="h-3 w-3 rounded-full bg-yellow-400"></div>
                    <div className="h-3 w-3 rounded-full bg-green-400"></div>
                  </div>
                  <div className="mx-auto h-5 w-32 sm:w-64 bg-background border border-border rounded-sm"></div>
                </div>
                <div className="p-4 sm:p-6 flex-1 flex flex-col gap-3 sm:gap-4 bg-background">
                  <div className="flex justify-between items-center mb-2">
                    <div className="h-5 sm:h-6 w-24 sm:w-32 bg-muted rounded-sm"></div>
                    <div className="h-5 sm:h-6 w-20 sm:w-24 bg-emerald-500/10 border border-emerald-500/20 rounded-sm"></div>
                  </div>
                  {[1, 2, 3, 4].map(idx => (
                    <div key={idx} className="h-10 sm:h-12 w-full border border-border rounded-sm flex items-center px-3 sm:px-4 gap-3 sm:gap-4 bg-muted/20">
                      <div className="h-3 sm:h-4 w-3 sm:w-4 rounded-sm bg-muted-foreground/20 shrink-0"></div>
                      <div className="h-3 sm:h-4 w-1/3 bg-muted rounded-sm"></div>
                      <div className="h-3 sm:h-4 w-1/4 bg-muted rounded-sm mx-auto"></div>
                      <div className="h-3 sm:h-4 w-12 sm:w-16 bg-muted-foreground/20 rounded-sm shrink-0"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── DOR (PAIN SECTION) ── */}
        <section className="py-20 lg:py-24 bg-muted/30 px-4 md:px-6">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-12 sm:mb-16">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">A rotina que destrói a sua produtividade</h2>
              <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
                Muitas empresas ainda sofrem com processos arcaicos para gerenciar notas fiscais, colocando seus CNPJs em risco diariamente.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: EyeOff, title: "Você descobre tarde demais", desc: "A nota foi emitida contra seu CNPJ, mas como o fornecedor não enviou o XML, você não fazia ideia." },
                { icon: TimerReset, title: "O Contador que tem que avisar", desc: "Já virou um clássico: o contador pede a nota no fechamento do mês, e você tem que sair procurando ou pedindo segunda via." },
                { icon: Search, title: "Portal da SEFAZ", desc: "A dor de cabeça de entrar manualmente no site, digitar Chaves de Acesso infinitas só para conseguir um simples PDF." },
                { icon: AlertTriangle, title: "Notas Frias (Riscos)", desc: "Se você não sabe o que emitem contra você, seu CNPJ pode estar sendo fraudado por empresas de fachada sem você saber." },
                { icon: Download, title: "Cadê o PDF?", desc: "Seu e-mail está lotado de mensagens só com XMLs sem o PDF espelho (DANFE), obrigando você a caçar em conversores limitados." },
                { icon: Lock, title: "Manifestação atrasada", desc: "A lei exige o registro da operação (manifestação eletrônica) para resguardar a empresa, mas você perde o prazo rotineiramente." },
              ].map((pain, idx) => (
                <div key={idx} className="bg-background border border-border p-6 rounded-lg transition-transform hover:-translate-y-1 hover:shadow-lg">
                  <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center mb-4">
                    <pain.icon className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <h3 className="font-semibold text-base sm:text-lg mb-2">{pain.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{pain.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CONSEQUÊNCIAS (RISCO REAL) ── */}
        <section className="py-20 lg:py-24 bg-red-950/5 border-y border-red-900/10 px-4 md:px-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-500/5 rounded-full blur-[100px] pointer-events-none"></div>
          <div className="container mx-auto max-w-6xl relative z-10">
            <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
              <div className="flex-1 space-y-8">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-bold uppercase tracking-wider mb-6">
                    <AlertOctagon className="h-4 w-4" />
                    O Custo de Não Monitorar
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">O governo não perdoa cegueira fiscal.</h2>
                  <p className="text-lg text-muted-foreground mt-4 border-l-2 border-red-500/50 pl-4">
                    Ignorar isso não é apenas improdutivo. <strong>É arriscado.</strong>
                  </p>
                </div>

                <div className="space-y-6">
                  {[
                    { title: "Multas por manifestação fora do prazo", desc: "A lei exige que determinadas operações sejam confirmadas ou rejeitadas rapidamente." },
                    { title: "Notas frias gerando passivo irrecuperável", desc: "Empresas fantasmas emitem contra seu CNPJ. A negligência pode ser vista como cumplicidade." },
                    { title: "Falta de XML em fiscalizações", desc: "Cruzamento de dados implacável: se a Receita puxar, você precisa do arquivo original, ou pagará o preço." },
                    { title: "Tempo jogado no lixo", desc: "Profissionais caros do seu financeiro perdendo horas em portais do governo caçando chaves de acesso." }
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-start gap-4">
                      <div className="mt-1 bg-red-100 dark:bg-red-500/20 p-2 rounded-full text-red-600 dark:text-red-400 shrink-0">
                        <TrendingDown className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-base sm:text-lg">{item.title}</h4>
                        <p className="text-sm sm:text-base text-muted-foreground mt-1">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex-1 w-full relative">
                <div className="bg-background border border-red-500/20 shadow-2xl rounded-2xl p-8 sm:p-10 relative overflow-hidden">
                  <div className="absolute -top-12 -right-12 w-32 h-32 bg-red-500/10 rounded-full blur-2xl"></div>
                  <AlertTriangle className="h-12 w-12 text-red-500 mb-6" />
                  <blockquote className="text-xl sm:text-2xl font-semibold leading-relaxed text-foreground mb-8">
                    &quot;A Receita Federal não aceita a desculpa de que o seu fornecedor esqueceu de enviar a nota por e-mail.&quot;
                  </blockquote>
                  <div className="flex items-center gap-4 border-t border-border pt-6">
                    <div className="h-10 w-10 bg-muted rounded-full flex items-center justify-center shrink-0">
                      <ShieldCheck className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Regra de Ouro do Compliance</p>
                      <p className="text-xs text-muted-foreground">Auditoria Fiscal no Brasil</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── INTERFACE / CARROSSEL (MOCKUP) ── */}
        <section className="py-20 lg:py-24 bg-background px-4 md:px-6">
          <div className="container mx-auto max-w-6xl text-center">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">Veja a Plataforma em Ação</h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-12">
              Uma interface limpa, rápida e focada em produtividade. Controle tudo sem sair da mesma tela.
            </p>

            {/* Espaço reservado para o cliente colocar o Carrossel (Screenshots reais) */}
            <div className="relative group rounded-2xl overflow-hidden border border-border bg-muted/10 aspect-video max-w-5xl mx-auto flex items-center justify-center shadow-lg transition-all hover:bg-muted/20">
              <div className="absolute inset-0 flex items-center justify-center flex-col text-muted-foreground gap-4 p-8">
                <ImageIcon className="h-16 w-16 sm:h-20 sm:w-20 opacity-20" />
                <p className="font-semibold text-lg sm:text-xl">Espaço reservado para o Carrossel de Imagens</p>
                <p className="text-sm border border-border bg-background px-4 py-2 rounded-md shadow-sm">
                  Substitua este bloco por prints reais do sistema
                </p>
              </div>

              {/* Mock UI Controls for Carousel feel */}
              <div className="absolute top-1/2 left-4 -translate-y-1/2 w-10 h-10 rounded-full bg-background/80 backdrop-blur border border-border flex items-center justify-center text-foreground cursor-pointer hover:bg-background transition shadow-sm opacity-50 group-hover:opacity-100">
                <ChevronLeft className="h-5 w-5" />
              </div>
              <div className="absolute top-1/2 right-4 -translate-y-1/2 w-10 h-10 rounded-full bg-background/80 backdrop-blur border border-border flex items-center justify-center text-foreground cursor-pointer hover:bg-background transition shadow-sm opacity-50 group-hover:opacity-100">
                <ChevronRight className="h-5 w-5" />
              </div>

              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-primary/20"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-primary/30"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-primary/30"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-primary/30"></div>
              </div>
            </div>
          </div>
        </section>

        {/* ── ICP & PUBLICO ALVO ── */}
        <section className="py-20 lg:py-24 bg-muted/30 border-y border-border px-4 md:px-6">
          <div className="container mx-auto max-w-5xl">
            <div className="flex flex-col md:flex-row items-center gap-10 lg:gap-12">
              <div className="flex-1 space-y-6 w-full">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Feito para <span className="text-primary">empresas organizadas</span></h2>
                <p className="text-base sm:text-lg text-muted-foreground">O NF-e Ágil foca em resolver a dor real de negócios em crescimento que não podem falhar na gestão de documentos fiscais.</p>
                <ul className="space-y-4">
                  {[
                    "LTDAs, EPPs e Simples Nacional.",
                    "De 5 a 50 funcionários.",
                    "Usa ERPs simples (Marketplace, GestãoClick, Bling).",
                    "Possui setor administrativo ou financeiro."
                  ].map((li, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-500 shrink-0" />
                      <span className="font-medium text-sm sm:text-base">{li}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex-1 w-full bg-background rounded-2xl p-6 sm:p-8 border border-border relative overflow-hidden shadow-lg">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Building2 className="h-24 w-24 sm:h-32 sm:w-32" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold mb-4 relative z-10">Não é um ERP. Não é um Baixador.</h3>
                <p className="text-sm text-muted-foreground mb-6 relative z-10">É um sentinela: uma extensão da sua tranquilidade. Focamos em fazer **uma única coisa perfeitamente**: controlar e interceptar todo fluxo de notas de compra no Brasil direto pelo seu CNPJ.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── SOLUÇÃO / FEATURES ── */}
        <section className="py-20 lg:py-24 bg-background px-4 md:px-6">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-12 sm:mb-16">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">A Resposta: Controle Total em Tempo Real</h2>
              <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
                Ative o monitoramento e deixe nosso servidor trabalhar por você dia e noite.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
              <div className="flex flex-col sm:flex-row items-start gap-4 p-6 bg-muted/30 rounded-lg border border-border">
                <div className="h-10 w-10 shrink-0 bg-primary/10 text-primary rounded-sm flex items-center justify-center">
                  <Search className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg mb-2">Conexão Automática A1</h3>
                  <p className="text-sm text-muted-foreground">Abaixe sua dependência humana. Vinculando seu e-CNPJ A1, nosso sistema interroga os servidores da Receita Federal intermitentemente.</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-start gap-4 p-6 bg-muted/30 rounded-lg border border-border">
                <div className="h-10 w-10 shrink-0 bg-primary/10 text-primary rounded-sm flex items-center justify-center">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg mb-2">Conversão DANFE Automática</h3>
                  <p className="text-sm text-muted-foreground">Não lide mais apenas com XML. O sistema interpreta e converte automaticamente a nota original para PDF (padrão oficial SEFAZ) para leitura fluida.</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-start gap-4 p-6 bg-muted/30 rounded-lg border border-border">
                <div className="h-10 w-10 shrink-0 bg-primary/10 text-primary rounded-sm flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg mb-2">Manifestação em Lote</h3>
                  <p className="text-sm text-muted-foreground">Faça Dê Ciência, Confirme Operação ou aponte Desconhecimento Fiscal com apenas dois cliques sem sair do painel principal protegendo a empresa.</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-start gap-4 p-6 bg-muted/30 rounded-lg border border-border">
                <div className="h-10 w-10 shrink-0 bg-primary/10 text-primary rounded-sm flex items-center justify-center">
                  <Server className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg mb-2">Histórico Web Seguro</h3>
                  <p className="text-sm text-muted-foreground">Seus arquivos em um sistema SaaS Moderno e isolado por Tenant. Acesso contínuo sem ocupar espaço dos HDDs da sua empresa.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── PROVA SOCIAL / AUTORIDADE ── */}
        <section className="py-20 lg:py-24 bg-muted/30 px-4 md:px-6 border-y border-border">
          <div className="container mx-auto text-center max-w-5xl">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">Desenvolvido por especialistas em gestão fiscal</h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-16">
              Uma infraestrutura robusta, testada e validada em processos reais para garantir auditoria em cenário de alta complexidade contábil.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-8 mb-16">
              <div className="flex flex-col items-center justify-center p-6 bg-background rounded-2xl border border-border shadow-sm transition-colors hover:shadow-md">
                <Activity className="h-8 w-8 text-primary mb-4" />
                <span className="text-2xl sm:text-4xl font-extrabold text-foreground mb-1">24/7</span>
                <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-widest text-center">Monitoramento<br className="sm:hidden" /> Ativo</span>
              </div>
              <div className="flex flex-col items-center justify-center p-6 bg-background rounded-2xl border border-border shadow-sm transition-colors hover:shadow-md">
                <Users className="h-8 w-8 text-primary mb-4" />
                <span className="text-2xl sm:text-4xl font-extrabold text-foreground mb-1">100%</span>
                <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-widest text-center">Isolamento<br className="sm:hidden" /> de Cliente</span>
              </div>
              <div className="flex flex-col items-center justify-center p-6 bg-background rounded-2xl border border-border shadow-sm transition-colors hover:shadow-md">
                <ShieldCheck className="h-8 w-8 text-primary mb-4" />
                <span className="text-2xl sm:text-4xl font-extrabold text-foreground mb-1">e-A1</span>
                <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-widest text-center">Certificados<br className="sm:hidden" /> Seguros</span>
              </div>
              <div className="flex flex-col items-center justify-center p-6 bg-background rounded-2xl border border-border shadow-sm transition-colors hover:shadow-md">
                <Server className="h-8 w-8 text-primary mb-4" />
                <span className="text-2xl sm:text-4xl font-extrabold text-foreground mb-1">SLA 99%</span>
                <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-widest text-center">Alta<br className="sm:hidden" /> Disponibilidade</span>
              </div>
            </div>

            <p className="text-xs sm:text-sm font-semibold tracking-wider text-muted-foreground uppercase mb-8">Tecnologia desenvolvida com foco total na segurança da sua empresa</p>
            <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-6 md:gap-12 opacity-60 grayscale text-center">
              <div className="flex items-center justify-center gap-2 font-bold text-base sm:text-lg md:text-xl"><Building2 className="h-5 w-5 shrink-0" /> Integrado à Receita Federal</div>
              <div className="flex items-center justify-center gap-2 font-bold text-base sm:text-lg md:text-xl"><Lock className="h-5 w-5 shrink-0" /> Criptografia Ponta a Ponta</div>
            </div>
          </div>
        </section>

        {/* ── CTA FINAL ── */}
        <section className="py-20 lg:py-24 bg-primary text-primary-foreground text-center relative overflow-hidden px-4 md:px-6">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] sm:w-[600px] sm:h-[600px] bg-white opacity-5 rounded-full blur-[80px] sm:blur-[100px] pointer-events-none"></div>
          <div className="container mx-auto max-w-3xl relative z-10 space-y-6 sm:space-y-8">
            <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-4 sm:mb-6 shadow-xl border border-white/20">
              <ShieldCheck className="h-6 w-6 sm:h-8 sm:w-8 text-emerald-400" />
            </div>

            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">Assuma o controle das suas notas hoje.</h2>
            <p className="text-base sm:text-xl text-primary-foreground/90 px-4 font-medium leading-relaxed max-w-2xl mx-auto">
              Ative o monitoramento automatizado e veja suas próximas notas fiscais chegarem na tela <span className="underline decoration-emerald-400 decoration-2 underline-offset-4">antes mesmo do seu contador pedir.</span>
            </p>

            <div className="pt-6 px-4 w-full">
              <Button size="lg" variant="secondary" asChild className="rounded-sm font-bold w-full sm:w-auto px-6 sm:px-12 h-14 sm:h-16 text-primary hover:bg-white/90 text-lg sm:text-xl shadow-2xl transition-transform hover:scale-105">
                <Link href="/login?modo=cadastro">
                  Ativar Monitoramento Grátis por 7 Dias <ArrowRight className="ml-2 h-5 w-5 sm:h-6 sm:w-6" />
                </Link>
              </Button>
            </div>
            <p className="text-xs sm:text-sm text-primary-foreground/60 px-4 font-medium mt-4">Nenhum cartão de crédito necessário hoje. Cancele com 1 clique.</p>
          </div>
        </section>
      </main>

      {/* ── FOOTER ── */}
      <footer className="border-t border-border bg-background py-8 sm:py-12 px-4 md:px-6">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-4 sm:gap-6">
          <div className="flex items-center justify-center gap-2">
            <Image
              src="/images/logo_sidebar.png"
              alt="NF-e Ágil"
              width={100}
              height={30}
              className="h-6 sm:h-8 w-auto object-contain grayscale opacity-50 dark:invert transition-opacity hover:opacity-100"
            />
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground text-center md:text-left">
            © {new Date().getFullYear()} NF-e Ágil. Todos os direitos reservados.
          </p>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/termos" className="block sm:inline hover:text-foreground transition-colors">Termos de Uso</Link>
            <Link href="/privacidade" className="block sm:inline hover:text-foreground transition-colors">Politica de Privacidade</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
