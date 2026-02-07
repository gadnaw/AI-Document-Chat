import './globals.css'
import type { Metadata } from 'next'
import { AuthProvider } from '@/components/auth-provider'
import { ErrorBoundary } from '@/components/error-boundary'

export const metadata: Metadata = {
  title: 'AI Document Chat',
  description: 'Chat with your documents using AI',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <ErrorBoundary>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}
