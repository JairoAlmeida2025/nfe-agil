"use client"

import { LogOut } from "lucide-react"
import { signOut } from "@/actions/auth"

export function SignOutButton() {
    return (
        <button
            onClick={() => signOut()}
            className="relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground w-full text-left"
        >
            <LogOut className="h-4 w-4" />
            Sair
        </button>
    )
}
