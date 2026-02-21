"use client"

import * as React from "react"
import { LogOut, Loader2 } from "lucide-react"
import { signOut } from "@/actions/auth"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export function SignOutButton() {
    const [isSigningOut, setIsSigningOut] = React.useState(false)

    const handleSignOut = async () => {
        setIsSigningOut(true)
        await signOut()
    }

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <button
                    className="relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground w-full text-left"
                >
                    <LogOut className="h-4 w-4" />
                    Sair
                </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-sm">
                <AlertDialogHeader>
                    <AlertDialogTitle>Deseja realmente sair do sistema?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Sua sessão segura será encerrada e você será redirecionado para a tela de login.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-sm" disabled={isSigningOut}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e) => {
                            e.preventDefault()
                            handleSignOut()
                        }}
                        className="rounded-sm bg-primary text-primary-foreground hover:bg-primary/90"
                        disabled={isSigningOut}
                    >
                        {isSigningOut ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saindo...</>
                        ) : (
                            "Sim, quero sair"
                        )}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
