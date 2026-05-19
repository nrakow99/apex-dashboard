import "@/styles/globals.css"
import { Inter, JetBrains_Mono } from "next/font/google"
import type React from "react"
import { Toaster } from "@/components/ui/toaster"

const inter = Inter({ 
  subsets: ["latin"], 
  variable: "--font-sans",
  display: "swap",
})

const jetbrainsMono = JetBrains_Mono({ 
  subsets: ["latin"], 
  variable: "--font-mono",
  display: "swap",
})

export const metadata = {
  title: "PropDash - Prop Trading Dashboard",
  description: "Track your prop trading performance across Eval, PA, and Live accounts",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark bg-background">
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
