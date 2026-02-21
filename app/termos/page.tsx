import Link from "next/link"
import { ArrowLeft, FileText, CheckCircle2 } from "lucide-react"
import { LEGAL_VERSIONS, LEGAL_DATES } from "@/lib/legal"
import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Termos de Uso | NF-e Ágil",
    description: "Termos e Condições de Uso da plataforma NF-e Ágil.",
}

// ─── Componentes auxiliares ────────────────────────────────────────────────────

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
    return (
        <section id={id} aria-labelledby={`${id}-title`} className="space-y-3">
            <h2
                id={`${id}-title`}
                className="text-lg font-semibold text-foreground border-l-4 border-primary pl-3"
            >
                {title}
            </h2>
            <div className="space-y-2 text-sm leading-relaxed text-muted-foreground pl-4">
                {children}
            </div>
        </section>
    )
}

function BulletList({ items }: { items: string[] }) {
    return (
        <ul className="list-disc list-inside space-y-1">
            {items.map((item) => (
                <li key={item}>{item}</li>
            ))}
        </ul>
    )
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function TermosPage() {
    return (
        <div className="min-h-screen bg-background">
            {/* ── Barra superior de navegação ──────────────────────────────── */}
            <nav className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur-sm">
                <div className="max-w-4xl mx-auto px-6 h-14 flex items-center gap-3">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Voltar para a página inicial
                    </Link>
                    <span className="text-muted-foreground/40 text-xs">|</span>
                    <span className="text-xs text-muted-foreground/60">NF-e Ágil</span>
                </div>
            </nav>

            {/* ── Conteúdo principal ───────────────────────────────────────── */}
            <main className="max-w-4xl mx-auto px-6 py-12 space-y-10">

                {/* ── Cabeçalho ─────────────────────────────────────────────── */}
                <header className="space-y-4 pb-8 border-b">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-sm bg-primary/10 flex items-center justify-center shrink-0">
                            <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-xs font-medium uppercase tracking-widest text-primary">
                                Documento Legal
                            </p>
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">
                                Termos e Condições de Uso
                            </h1>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span>
                            <strong className="text-foreground">Última atualização:</strong>{" "}
                            {LEGAL_DATES.TERMS_OF_USE}
                        </span>
                        <span>
                            <strong className="text-foreground">Versão:</strong>{" "}
                            {LEGAL_VERSIONS.TERMS_OF_USE}
                        </span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                        Estes Termos de Uso regem o acesso e a utilização da plataforma <strong className="text-foreground">NF-e Ágil</strong>.
                        Ao utilizar nossos serviços, você concorda integralmente com as condições aqui estabelecidas.
                    </p>
                </header>

                {/* ── Índice ────────────────────────────────────────────────── */}
                <nav aria-label="Índice dos termos" className="rounded-sm border bg-muted/30 p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                        Índice
                    </p>
                    <ol className="grid sm:grid-cols-2 gap-1 text-sm">
                        {[
                            ["aceitacao", "Aceitação dos Termos"],
                            ["servicos", "Descrição dos Serviços"],
                            ["cadastro", "Cadastro e Responsabilidades"],
                            ["certificado", "Certificado Digital"],
                            ["integracao", "Integração com SEFAZ"],
                            ["pagamentos", "Assinatura e Cobrança"],
                            ["propriedade", "Propriedade Intelectual"],
                            ["proibicoes", "Condutas Proibidas"],
                            ["privacidade", "Privacidade e Dados"],
                            ["disponibilidade", "Disponibilidade e Manutenção"],
                            ["responsabilidade", "Limitação de Responsabilidade"],
                            ["rescisao", "Rescisão e Cancelamento"],
                            ["alteracoes", "Alterações nos Termos"],
                            ["foro", "Foro e Legislação"],
                            ["contato", "Contato"],
                        ].map(([id, label], i) => (
                            <li key={id}>
                                <a
                                    href={`#${id}`}
                                    className="text-muted-foreground hover:text-primary transition-colors"
                                >
                                    {i + 1}. {label}
                                </a>
                            </li>
                        ))}
                    </ol>
                </nav>

                {/* ── Seções ────────────────────────────────────────────────── */}

                <Section id="aceitacao" title="1. Aceitação dos Termos">
                    <p>
                        O acesso e a utilização da plataforma NF-e Ágil dependem da aceitação integral destes Termos de Uso.
                        Caso você não concorde com qualquer disposição aqui presente, deve interromper imediatamente o uso da plataforma.
                    </p>
                </Section>

                <Section id="servicos" title="2. Descrição dos Serviços">
                    <p>
                        O NF-e Ágil é um software como serviço (SaaS) que oferece ferramentas para:
                    </p>
                    <BulletList items={[
                        "Captura automática de NF-e via DFe (SEFAZ)",
                        "Armazenamento de XMLs de Notas Fiscais",
                        "Visualização e geração de DANFE",
                        "Gestão de manifestação do destinatário",
                        "Filtros avançados e monitoramento em tempo real",
                    ]} />
                </Section>

                <Section id="cadastro" title="3. Cadastro e Responsabilidades do Usuário">
                    <p>
                        Para utilizar a plataforma, o usuário deve realizar um cadastro válido. O usuário é o único responsável por:
                    </p>
                    <BulletList items={[
                        "A veracidade dos dados informados no cadastro",
                        "A guarda e sigilo de suas credenciais de acesso (e-mail e senha)",
                        "Todas as ações realizadas sob sua conta",
                        "Garantir que possui autorização legal para gerenciar os dados fiscais do CNPJ cadastrado",
                    ]} />
                </Section>

                <Section id="certificado" title="4. Certificado Digital">
                    <p>
                        A funcionalidade de captura automática exige o upload de um Certificado Digital A1.
                    </p>
                    <BulletList items={[
                        "O usuário deve garantir que o certificado enviado é válido e pertence à empresa cadastrada",
                        "O NF-e Ágil compromete-se a armazenar o certificado de forma criptografada e segura",
                        "O usuário é responsável pela validade e renovação de seu certificado",
                    ]} />
                </Section>

                <Section id="integracao" title="5. Integração com a SEFAZ">
                    <p>
                        A plataforma atua como uma interface entre o usuário e a Secretaria da Fazenda.
                    </p>
                    <BulletList items={[
                        "O serviço depende da disponibilidade técnica dos sistemas da SEFAZ",
                        "Eventuais instabilidades nos órgãos públicos podem afetar o tempo de captura das notas",
                        "O NF-e Ágil não é responsável por erros de processamento oriundos diretamente da SEFAZ",
                    ]} />
                </Section>

                <Section id="pagamentos" title="6. Assinatura e Cobrança">
                    <p>
                        O uso da plataforma poderá estar sujeito ao pagamento de mensalidades conforme o plano escolhido.
                    </p>
                    <BulletList items={[
                        "Os valores e recursos de cada plano são informados na contratação",
                        "O atraso no pagamento poderá acarretar a suspensão temporária do acesso",
                        "O NF-e Ágil reserva-se o direito de reajustar valores mediante aviso prévio",
                    ]} />
                </Section>

                <Section id="propriedade" title="7. Propriedade Intelectual">
                    <p>
                        Todo o conteúdo da plataforma, incluindo código-fonte, design, logotipos e textos, é de propriedade exclusiva do NF-e Ágil ou de seus licenciadores. O uso da plataforma não concede ao usuário qualquer direito de reprodução ou engenharia reversa.
                    </p>
                </Section>

                <Section id="proibicoes" title="8. Condutas Proibidas">
                    <p>É expressamente proibido:</p>
                    <BulletList items={[
                        "Utilizar a plataforma para fins ilícitos",
                        "Tentar burlar medidas de segurança ou acessar dados de outros usuários",
                        "Realizar scraping massivo ou ataques de negação de serviço (DoS)",
                        "Utilizar certificados digitais de terceiros sem autorização",
                    ]} />
                </Section>

                <Section id="privacidade" title="9. Privacidade e Proteção de Dados">
                    <p>
                        O tratamento de dados pessoais é regido pela nossa <Link href="/privacidade" className="text-primary underline">Política de Privacidade</Link>.
                        Ao aceitar estes termos, você também declara estar ciente de como seus dados são processados.
                    </p>
                </Section>

                <Section id="disponibilidade" title="10. Disponibilidade e Manutenção">
                    <p>
                        Embora busquemos manter a plataforma disponível 24/7, não garantimos o funcionamento ininterrupto. Manutenções programadas ou emergenciais podem ocorrer.
                    </p>
                </Section>

                <Section id="responsabilidade" title="11. Limitação de Responsabilidade">
                    <p>
                        O NF-e Ágil não será responsável por:
                    </p>
                    <BulletList items={[
                        "Prejuízos decorrentes de falhas na gestão fiscal do usuário",
                        "Perda de prazos para manifestação ou pagamento de tributos",
                        "Ações da SEFAZ ou instabilidades governamentais",
                        "Uso indevido da conta por terceiros que acessaram as credenciais do usuário",
                    ]} />
                </Section>

                <Section id="rescisao" title="12. Rescisão e Cancelamento">
                    <p>
                        O usuário pode cancelar sua assinatura a qualquer momento. O cancelamento interrompe a cobrança futura, mas não gera estorno de períodos já pagos, salvo disposição legal em contrário.
                    </p>
                </Section>

                <Section id="alteracoes" title="13. Alterações nestes Termos">
                    <p>
                        Podemos atualizar estes Termos de Uso periodicamente. O uso continuado da plataforma após as alterações constitui aceitação dos novos termos.
                    </p>
                </Section>

                <Section id="foro" title="14. Foro e Legislação Aplicável">
                    <p>
                        Estes termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro de [Cidade/Estado] para dirimir quaisquer controvérsias.
                    </p>
                </Section>

                <Section id="contato" title="15. Contato">
                    <p>
                        Para dúvidas ou suporte sobre estes termos:
                    </p>
                    <p className="mt-2 rounded-sm border border-dashed border-muted-foreground/30 bg-muted/20 px-4 py-3 text-foreground font-mono text-xs">
                        suporte@nfe-agil.com.br{" "}
                        <span className="text-muted-foreground font-sans">(e-mail oficial — em breve)</span>
                    </p>
                </Section>

                {/* ── Rodapé ────────────────────────────────────────────────── */}
                <footer className="pt-10 border-t space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
                        <span>
                            NF-e Ágil &copy; {new Date().getFullYear()} — Todos os direitos reservados.
                        </span>
                        <span>
                            Termos de Uso {LEGAL_VERSIONS.TERMS_OF_USE}
                        </span>
                    </div>
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 rounded-sm border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground shadow-sm hover:bg-muted/50 transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Voltar para a página inicial
                    </Link>
                </footer>

            </main>
        </div>
    )
}
