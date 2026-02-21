'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
    Plus,
    Pencil,
    Trash2,
    Check,
    X,
    Loader2,
    Package,
    CheckCircle,
    XCircle,
} from 'lucide-react'
import { createPlan, updatePlan, deletePlan } from '@/actions/subscription'

type Plan = {
    id: string
    name: string
    slug: string
    price: number
    features: string[]
    is_active: boolean
    stripe_price_id: string | null
    created_at: string
}

export function PlansManager({ plans }: { plans: Plan[] }) {
    const router = useRouter()
    const [showCreate, setShowCreate] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

    async function handleCreate(formData: FormData) {
        setLoading(true)
        setMessage(null)
        const result = await createPlan(formData)
        if (result.success) {
            setMessage({ type: 'success', text: result.message ?? 'Plano criado!' })
            setShowCreate(false)
            router.refresh()
        } else {
            setMessage({ type: 'error', text: result.error })
        }
        setLoading(false)
    }

    async function handleUpdate(planId: string, formData: FormData) {
        setLoading(true)
        setMessage(null)
        const result = await updatePlan(planId, formData)
        if (result.success) {
            setMessage({ type: 'success', text: result.message ?? 'Plano atualizado!' })
            setEditingId(null)
            router.refresh()
        } else {
            setMessage({ type: 'error', text: result.error })
        }
        setLoading(false)
    }

    async function handleDelete(planId: string) {
        if (!confirm('Tem certeza que deseja excluir este plano?')) return

        setLoading(true)
        setMessage(null)
        const result = await deletePlan(planId)
        if (result.success) {
            setMessage({ type: 'success', text: result.message ?? 'Plano excluído!' })
            router.refresh()
        } else {
            setMessage({ type: 'error', text: result.error })
        }
        setLoading(false)
    }

    return (
        <div className="space-y-6">
            {/* Messages */}
            {message && (
                <div
                    className={`p-3 rounded-lg text-sm ${message.type === 'success'
                            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                            : 'bg-red-500/10 border border-red-500/20 text-red-400'
                        }`}
                >
                    {message.text}
                </div>
            )}

            {/* Create button */}
            <div className="flex justify-end">
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-sm font-medium transition-colors"
                >
                    <Plus className="h-4 w-4" />
                    Novo Plano
                </button>
            </div>

            {/* Create form */}
            {showCreate && (
                <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-6">
                    <h3 className="text-sm font-semibold mb-4">Criar novo plano</h3>
                    <form
                        action={handleCreate}
                        className="grid grid-cols-1 md:grid-cols-2 gap-4"
                    >
                        <div>
                            <label className="text-xs text-white/40 mb-1 block">Nome</label>
                            <input
                                name="name"
                                required
                                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-violet-500/50"
                                placeholder="Enterprise"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-white/40 mb-1 block">Slug (único)</label>
                            <input
                                name="slug"
                                required
                                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-violet-500/50"
                                placeholder="enterprise"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-white/40 mb-1 block">Preço (R$)</label>
                            <input
                                name="price"
                                type="number"
                                step="0.01"
                                required
                                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-violet-500/50"
                                placeholder="99.00"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-white/40 mb-1 block">Features (uma por linha)</label>
                            <textarea
                                name="features"
                                rows={4}
                                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-violet-500/50"
                                placeholder={"Feature 1\nFeature 2\nFeature 3"}
                            />
                        </div>
                        <div className="md:col-span-2 flex gap-3">
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-sm font-medium transition-colors disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                Criar
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowCreate(false)}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm transition-colors"
                            >
                                <X className="h-4 w-4" />
                                Cancelar
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Plans list */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {plans.map(plan => (
                    <div
                        key={plan.id}
                        className={`rounded-xl border p-5 transition-all ${plan.is_active
                                ? 'border-white/10 bg-white/[0.02]'
                                : 'border-red-500/10 bg-red-500/[0.02] opacity-60'
                            }`}
                    >
                        {editingId === plan.id ? (
                            /* Edit Mode */
                            <form
                                action={(formData) => handleUpdate(plan.id, formData)}
                                className="space-y-3"
                            >
                                <input
                                    name="name"
                                    defaultValue={plan.name}
                                    className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm"
                                />
                                <input
                                    name="price"
                                    type="number"
                                    step="0.01"
                                    defaultValue={plan.price}
                                    className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm"
                                />
                                <textarea
                                    name="features"
                                    defaultValue={(plan.features ?? []).join('\n')}
                                    rows={3}
                                    className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm"
                                />
                                <div className="flex items-center gap-2 text-xs">
                                    <input
                                        type="checkbox"
                                        name="is_active"
                                        value="true"
                                        defaultChecked={plan.is_active}
                                        className="rounded"
                                    />
                                    <span className="text-white/50">Ativo</span>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-medium transition-colors disabled:opacity-50"
                                    >
                                        <Check className="h-3 w-3" />
                                        Salvar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setEditingId(null)}
                                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs transition-colors"
                                    >
                                        <X className="h-3 w-3" />
                                        Cancelar
                                    </button>
                                </div>
                            </form>
                        ) : (
                            /* View Mode */
                            <>
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 rounded-lg bg-violet-500/10">
                                            <Package className="h-4 w-4 text-violet-400" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-sm">{plan.name}</h3>
                                            <p className="text-[10px] text-white/30 font-mono">{plan.slug}</p>
                                        </div>
                                    </div>
                                    {plan.is_active ? (
                                        <CheckCircle className="h-4 w-4 text-emerald-400" />
                                    ) : (
                                        <XCircle className="h-4 w-4 text-red-400" />
                                    )}
                                </div>

                                <div className="mb-4">
                                    <span className="text-2xl font-bold">R$ {plan.price.toFixed(0)}</span>
                                    <span className="text-xs text-white/30">/mês</span>
                                </div>

                                <ul className="space-y-1.5 mb-4">
                                    {(plan.features ?? []).map((f, i) => (
                                        <li key={i} className="flex items-center gap-2 text-xs text-white/50">
                                            <Check className="h-3 w-3 text-emerald-400 shrink-0" />
                                            {f}
                                        </li>
                                    ))}
                                </ul>

                                <div className="flex gap-2 pt-3 border-t border-white/5">
                                    <button
                                        onClick={() => setEditingId(plan.id)}
                                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs transition-colors"
                                    >
                                        <Pencil className="h-3 w-3" />
                                        Editar
                                    </button>
                                    <button
                                        onClick={() => handleDelete(plan.id)}
                                        disabled={loading}
                                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/5 hover:bg-red-500/10 text-xs text-red-400/60 hover:text-red-400 transition-colors disabled:opacity-50"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                        Excluir
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>

            {plans.length === 0 && (
                <div className="text-center py-12 text-white/30 text-sm">
                    Nenhum plano cadastrado. Clique em &quot;Novo Plano&quot; para começar.
                </div>
            )}
        </div>
    )
}
