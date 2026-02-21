import Link from "next/link"
import { ArrowLeft, Shield } from "lucide-react"
import { LEGAL_VERSIONS, LEGAL_DATES } from "@/lib/legal"
import type { Metadata } from "next"

export const metadata: Metadata = {
    title: "Política de Privacidade | NF-e Ágil",
    description: "Política de Privacidade da plataforma NF-e Ágil. Entenda como tratamos seus dados pessoais e fiscais.",
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

export default function PrivacidadePage() {
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
                            <Shield className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-xs font-medium uppercase tracking-widest text-primary">
                                Documento Legal
                            </p>
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">
                                Política de Privacidade
                            </h1>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span>
                            <strong className="text-foreground">Última atualização:</strong>{" "}
                            {LEGAL_DATES.PRIVACY_POLICY}
                        </span>
                        <span>
                            <strong className="text-foreground">Versão:</strong>{" "}
                            {LEGAL_VERSIONS.PRIVACY_POLICY}
                        </span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                        Este documento descreve como o <strong className="text-foreground">NF-e Ágil</strong> coleta,
                        utiliza, armazena e protege os dados pessoais e fiscais dos usuários da plataforma,
                        em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).
                    </p>
                </header>

                {/* ── Índice ────────────────────────────────────────────────── */}
                <nav aria-label="Índice da política" className="rounded-sm border bg-muted/30 p-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                        Índice
                    </p>
                    <ol className="grid sm:grid-cols-2 gap-1 text-sm">
                        {[
                            ["sobre", "Sobre o NF-e Ágil"],
                            ["definicoes", "Definições"],
                            ["dados", "Dados Tratados"],
                            ["finalidades", "Finalidades do Tratamento"],
                            ["base-legal", "Base Legal"],
                            ["compartilhamento", "Compartilhamento de Dados"],
                            ["suboperadores", "Suboperadores"],
                            ["transferencia", "Transferência Internacional"],
                            ["seguranca", "Segurança da Informação"],
                            ["retencao", "Retenção"],
                            ["direitos", "Direitos dos Titulares"],
                            ["exclusao", "Exclusão de Conta"],
                            ["responsabilidade", "Limitação de Responsabilidade"],
                            ["alteracoes", "Alterações"],
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

                <Section id="sobre" title="1. Sobre o NF-e Ágil">
                    <p>
                        O <strong className="text-foreground">NF-e Ágil</strong> é uma plataforma digital desenvolvida
                        para captura, armazenamento, consulta e gestão de Notas Fiscais Eletrônicas (NF-e), incluindo
                        integração automática com a Secretaria da Fazenda (SEFAZ) por meio do serviço de Distribuição
                        de Documentos Fiscais Eletrônicos (DFe).
                    </p>
                    <p>
                        A plataforma poderá ser disponibilizada em modelo SaaS (Software as a Service), atendendo
                        empresas de diferentes portes e segmentos.
                    </p>
                </Section>

                <Section id="definicoes" title="2. Definições">
                    <BulletList items={[
                        "Controlador: empresa titular do CNPJ cadastrado na plataforma, responsável pelas decisões de tratamento de dados.",
                        "Operador: NF-e Ágil, que processa os dados conforme instruções do controlador.",
                        "Suboperadores: provedores de infraestrutura e serviços auxiliares contratados pelo operador.",
                        "Titular dos dados: pessoa física a quem os dados pessoais se referem.",
                    ]} />
                </Section>

                <Section id="dados" title="3. Dados Tratados">
                    <p className="font-medium text-foreground">3.1 Dados de Cadastro</p>
                    <BulletList items={[
                        "Nome completo",
                        "Endereço de e-mail",
                        "Identificador de usuário",
                        "CNPJ da empresa",
                        "Perfil de acesso e permissões",
                    ]} />
                    <p className="font-medium text-foreground mt-3">3.2 Dados Fiscais</p>
                    <BulletList items={[
                        "Chave de acesso da NF-e",
                        "Dados do emitente e destinatário",
                        "Valores fiscais e tributários",
                        "Data de emissão",
                        "XML completo do documento fiscal",
                        "NSU (Número Sequencial Único)",
                        "Manifestação do destinatário",
                    ]} />
                    <p className="font-medium text-foreground mt-3">3.3 Dados Técnicos</p>
                    <BulletList items={[
                        "Endereço IP",
                        "Logs de acesso e operações",
                        "Registros de sincronização com a SEFAZ",
                        "Dados de sessão",
                    ]} />
                </Section>

                <Section id="finalidades" title="4. Finalidades do Tratamento">
                    <BulletList items={[
                        "Captura automática de NF-e junto à SEFAZ (DFe)",
                        "Armazenamento seguro de documentos fiscais eletrônicos",
                        "Filtros, consultas e exportação de dados",
                        "Geração de DANFE (Documento Auxiliar da NF-e)",
                        "Manifestação do destinatário perante a SEFAZ",
                        "Auditoria de operações e rastreabilidade",
                        "Cumprimento de obrigações legais e fiscais",
                    ]} />
                </Section>

                <Section id="base-legal" title="5. Base Legal">
                    <p>O tratamento de dados ocorre com fundamento nas seguintes hipóteses previstas na LGPD:</p>
                    <BulletList items={[
                        "Cumprimento de obrigação legal ou regulatória (art. 7º, II)",
                        "Execução de contrato de prestação de serviços (art. 7º, V)",
                        "Exercício regular de direitos em processo administrativo ou fiscal (art. 7º, VI)",
                        "Legítimo interesse do controlador (art. 7º, IX)",
                    ]} />
                </Section>

                <Section id="compartilhamento" title="6. Compartilhamento de Dados">
                    <p>Os dados poderão ser compartilhados exclusivamente com:</p>
                    <BulletList items={[
                        "Secretaria da Fazenda (SEFAZ) — para consulta e manifestação de documentos fiscais",
                        "Serviços de geração de DANFE",
                        "Provedores de infraestrutura (hospedagem, banco de dados, storage)",
                        "Serviços de microprocessamento fiscal integrados à plataforma",
                    ]} />
                    <p className="mt-2 font-medium text-foreground">
                        Não há comercialização, venda ou cessão de dados a terceiros para fins de marketing ou qualquer outra finalidade alheia à prestação dos serviços.
                    </p>
                </Section>

                <Section id="suboperadores" title="7. Suboperadores">
                    <p>O NF-e Ágil poderá utilizar suboperadores para viabilizar a prestação dos serviços, incluindo:</p>
                    <BulletList items={[
                        "Hospedagem e infraestrutura de servidores",
                        "Banco de dados e armazenamento estruturado",
                        "Armazenamento de arquivos (storage de XMLs e certificados)",
                        "Processamento de documentos fiscais eletrônicos",
                    ]} />
                    <p className="mt-2">
                        Todos os suboperadores são contratados sob cláusulas de confidencialidade, segurança e
                        proteção de dados, garantindo nível de proteção compatível com esta política.
                    </p>
                </Section>

                <Section id="transferencia" title="8. Transferência Internacional de Dados">
                    <p>
                        Caso os dados sejam armazenados ou processados fora do território brasileiro, a transferência
                        ocorrerá em conformidade com a LGPD e mediante garantias adequadas de proteção, tais como
                        cláusulas contratuais padrão ou certificações equivalentes.
                    </p>
                </Section>

                <Section id="seguranca" title="9. Segurança da Informação">
                    <p>São adotadas medidas técnicas e organizacionais compatíveis com as boas práticas de mercado:</p>
                    <BulletList items={[
                        "Controle de acesso por usuário autenticado",
                        "Isolamento multiempresa (dados segregados por CNPJ/usuário)",
                        "Buckets de armazenamento privados e sem acesso público",
                        "Criptografia de certificados digitais A1",
                        "Logs de auditoria de operações críticas",
                        "Variáveis de ambiente protegidas e não expostas ao cliente",
                        "Rotinas de sincronização com controle de NSU para evitar duplicidade",
                    ]} />
                </Section>

                <Section id="retencao" title="10. Retenção de Dados">
                    <p>Os dados permanecerão armazenados:</p>
                    <BulletList items={[
                        "Enquanto a conta estiver ativa na plataforma",
                        "Pelo prazo exigido pela legislação fiscal vigente (em regra, 5 anos)",
                        "Até solicitação formal de exclusão, quando legalmente possível",
                    ]} />
                </Section>

                <Section id="direitos" title="11. Direitos dos Titulares">
                    <p>Nos termos da LGPD, o titular dos dados poderá solicitar a qualquer momento:</p>
                    <BulletList items={[
                        "Confirmação da existência de tratamento",
                        "Acesso aos dados tratados",
                        "Correção de dados incompletos, inexatos ou desatualizados",
                        "Exclusão dos dados, quando legalmente cabível",
                        "Informação sobre compartilhamento com terceiros",
                        "Informação sobre a possibilidade de não fornecer consentimento",
                    ]} />
                </Section>

                <Section id="exclusao" title="12. Exclusão de Conta">
                    <p>A solicitação de exclusão de conta poderá implicar:</p>
                    <BulletList items={[
                        "Remoção de dados cadastrais do usuário",
                        "Exclusão dos XMLs armazenados (se não houver obrigação legal de retenção)",
                        "Remoção de certificados digitais vinculados",
                        "Encerramento da integração automática com a SEFAZ",
                    ]} />
                    <p className="mt-2">
                        Backups e registros de auditoria poderão ser mantidos pelo prazo legal aplicável,
                        independentemente da solicitação de exclusão.
                    </p>
                </Section>

                <Section id="responsabilidade" title="13. Limitação de Responsabilidade">
                    <p>
                        O NF-e Ágil atua como <strong className="text-foreground">operador de dados</strong> conforme
                        instruções do controlador. O controlador (empresa titular do CNPJ) é o responsável pela
                        veracidade das informações inseridas na plataforma, pelo uso adequado das credenciais de acesso
                        e pelo cumprimento das obrigações fiscais e legais de sua competência.
                    </p>
                </Section>

                <Section id="alteracoes" title="14. Alterações desta Política">
                    <p>
                        Esta Política de Privacidade poderá ser atualizada periodicamente para refletir mudanças
                        legais, operacionais ou de funcionalidades da plataforma. A versão vigente estará sempre
                        disponível nesta página, identificada pela data de última atualização e número de versão.
                    </p>
                    <p>
                        Alterações significativas serão comunicadas aos usuários por e-mail ou notificação na plataforma.
                    </p>
                </Section>

                <Section id="contato" title="15. Contato">
                    <p>
                        Para questões relacionadas à privacidade, exercício de direitos dos titulares ou dúvidas sobre
                        esta política, entre em contato:
                    </p>
                    <p className="mt-2 rounded-sm border border-dashed border-muted-foreground/30 bg-muted/20 px-4 py-3 text-foreground font-mono text-xs">
                        privacidade@nfe-agil.com.br{" "}
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
                            Política de Privacidade {LEGAL_VERSIONS.PRIVACY_POLICY}
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
