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
  TimerReset
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
          {/* Background decorativo */}
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
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-medium backdrop-blur-sm border border-white/10 mb-2 shadow-xl">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Monitoramento Automático Ativo
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-6xl font-extrabold tracking-tight leading-tight">
              Controle automático das NF-es <br className="hidden md:block" /> emitidas contra seu CNPJ.
            </h1>

            <p className="text-base sm:text-lg lg:text-xl text-primary-foreground/80 max-w-3xl mx-auto font-medium">
              &quot;Nunca mais descubra uma nota só quando o contador reclamar.&quot;
            </p>
            <p className="text-sm sm:text-base text-primary-foreground/70 max-w-2xl mx-auto px-2">
              A ferramenta definitiva para empresas que buscam segurança jurídica e organização fiscal. Sem instalações complexas, 100% web e integrado direto à SEFAZ.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 w-full sm:w-auto px-4 sm:px-0">
              <Button size="lg" variant="secondary" asChild className="rounded-sm w-full sm:w-auto font-semibold px-8 h-12 text-primary hover:bg-white/90">
                <Link href="/login?modo=cadastro">
                  Começar Teste Grátis de 7 Dias
                </Link>
              </Button>
              <div className="flex items-center justify-center gap-2 text-primary-foreground/60 text-xs mt-2 sm:mt-0 w-full sm:w-auto">
                <Lock className="h-4 w-4" /> Sem cartão. Cancele quando quiser.
              </div>
            </div>

            {/* Mockup visual dinâmico (css art) para "wow element" */}
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

        {/* ── ICP & PUBLICO ALVO ── */}
        <section className="py-20 lg:py-24 bg-background border-y border-border px-4 md:px-6">
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
              <div className="flex-1 w-full bg-muted/50 rounded-2xl p-6 sm:p-8 border border-border relative overflow-hidden">
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
        <section className="py-20 lg:py-24 bg-muted/30 px-4 md:px-6">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center mb-12 sm:mb-16">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4">A Resposta: Controle Total em Tempo Real</h2>
              <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto">
                Ative o monitoramento e deixe nosso servidor trabalhar por você dia e noite.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
              <div className="flex flex-col sm:flex-row items-start gap-4 p-6 bg-background rounded-lg border border-border">
                <div className="h-10 w-10 shrink-0 bg-primary/10 text-primary rounded-sm flex items-center justify-center">
                  <Search className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg mb-2">Conexão Automática A1</h3>
                  <p className="text-sm text-muted-foreground">Abaixe sua dependência humana. Vinculando seu e-CNPJ A1, nosso sistema interroga os servidores da Receita Federal intermitentemente.</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-start gap-4 p-6 bg-background rounded-lg border border-border">
                <div className="h-10 w-10 shrink-0 bg-primary/10 text-primary rounded-sm flex items-center justify-center">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg mb-2">Conversão DANFE Automática</h3>
                  <p className="text-sm text-muted-foreground">Não lide mais apenas com XML. O sistema interpreta e converte automaticamente a nota original para PDF (padrão oficial SEFAZ) para leitura fluida.</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-start gap-4 p-6 bg-background rounded-lg border border-border">
                <div className="h-10 w-10 shrink-0 bg-primary/10 text-primary rounded-sm flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg mb-2">Manifestação em Lote</h3>
                  <p className="text-sm text-muted-foreground">Faça Dê Ciência, Confirme Operação ou aponte Desconhecimento Fiscal com apenas dois cliques sem sair do painel principal protegendo a empresa.</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-start gap-4 p-6 bg-background rounded-lg border border-border">
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
        <section className="py-16 bg-background px-4 md:px-6">
          <div className="container mx-auto text-center max-w-5xl">
            <p className="text-xs sm:text-sm font-semibold tracking-wider text-muted-foreground uppercase mb-8">Tecnologia desenvolvida com foco total na segurança da sua empresa</p>
            <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-6 md:gap-12 opacity-60 grayscale text-center">
              <div className="flex items-center justify-center gap-2 font-bold text-base sm:text-lg md:text-xl"><Building2 className="h-5 w-5 shrink-0" /> Integrado à Receita Federal</div>
              <div className="flex items-center justify-center gap-2 font-bold text-base sm:text-lg md:text-xl"><Lock className="h-5 w-5 shrink-0" /> Criptografia de Ponta a Ponta</div>
              <div className="flex items-center justify-center gap-2 font-bold text-base sm:text-lg md:text-xl"><ShieldCheck className="h-5 w-5 shrink-0" /> Sigilo Fiscal Garantido</div>
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
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">O Fim das Surpresas Fiscais.</h2>
            <p className="text-base sm:text-lg text-primary-foreground/80 px-4">
              Dê o primeiro passo para o controle total. Teste hoje a plataforma em sua empresa sem fornecer dados de pagamento no cadastro e veja com os próprios olhos os XMLs chegarem antes do contador pedir.
            </p>
            <div className="pt-4 px-4 w-full">
              <Button size="lg" variant="secondary" asChild className="rounded-sm font-semibold w-full sm:w-auto px-6 sm:px-10 h-12 sm:h-14 text-primary hover:bg-white/90 text-base sm:text-lg shadow-2xl">
                <Link href="/login?modo=cadastro">
                  Iniciar Teste Grátis de 7 Dias <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
                </Link>
              </Button>
            </div>
            <p className="text-xs sm:text-sm text-primary-foreground/50 px-4">Cancelamento a qualquer momento. Planos flexíveis focados no seu porte após os testes.</p>
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
