import { AuthForms } from '@/components/auth/auth-forms'
import { redirect } from 'next/navigation'
import { getUser } from '@/lib/auth-utils'

/**
 * Authentication page with login and signup forms.
 * Redirects authenticated users to dashboard.
 */
export default async function AuthPage() {
  // Check if user is already authenticated
  const user = await getUser()
  
  if (user) {
    redirect('/dashboard')
  }
  
  return <AuthForms defaultTab="login" redirectTo="/dashboard" />
}
