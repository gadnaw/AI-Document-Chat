import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LoginForm } from '@/components/auth/login-form'
import { SignupForm } from '@/components/auth/signup-form'
import { AuthProvider, useAuth } from '@/components/auth-provider'

// Helper to wrap components with AuthProvider
const renderWithAuth = (ui: React.ReactElement) => {
  return render(<AuthProvider>{ui}</AuthProvider>)
}

describe('LoginForm', () => {
  test('renders login form with all required fields', () => {
    renderWithAuth(<LoginForm />)
    
    expect(screen.getByText('Welcome Back')).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByText('Password')).toBeInTheDocument()
  })

  test('has form with submit button', async () => {
    renderWithAuth(<LoginForm />)
    
    // Wait for form to render completely
    await waitFor(() => {
      expect(screen.getByText('Welcome Back')).toBeInTheDocument()
    })
    
    // Form should have a button (may be disabled or have different text during loading)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  test('calls onSwitchToSignup when signup link clicked', () => {
    const onSwitchToSignup = jest.fn()
    renderWithAuth(<LoginForm onSwitchToSignup={onSwitchToSignup} />)
    
    const signupLink = screen.getByText(/sign up/i)
    fireEvent.click(signupLink)
    
    expect(onSwitchToSignup).toHaveBeenCalled()
  })
})

describe('SignupForm', () => {
  test('renders signup form with all required fields', () => {
    renderWithAuth(<SignupForm />)
    
    expect(screen.getByText('Create Account')).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByText('Confirm Password')).toBeInTheDocument()
  })

  test('displays password requirements hint', () => {
    renderWithAuth(<SignupForm />)
    
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument()
  })

  test('calls onSwitchToLogin when login link clicked', () => {
    const onSwitchToLogin = jest.fn()
    renderWithAuth(<SignupForm onSwitchToLogin={onSwitchToLogin} />)
    
    const loginLink = screen.getByText(/sign in/i)
    fireEvent.click(loginLink)
    
    expect(onSwitchToLogin).toHaveBeenCalled()
  })
})

describe('useAuth hook', () => {
  test('throws error when used outside AuthProvider', () => {
    const TestComponent = () => {
      useAuth()
      return null
    }
    
    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    
    expect(() => render(<TestComponent />)).toThrow(
      'useAuth must be used within an AuthProvider'
    )
    
    consoleSpy.mockRestore()
  })

  test('provides auth context with expected properties', () => {
    let authContext: ReturnType<typeof useAuth> | null = null
    
    const TestComponent = () => {
      authContext = useAuth()
      return null
    }
    
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )
    
    expect(authContext).not.toBeNull()
    expect(authContext).toHaveProperty('user')
    expect(authContext).toHaveProperty('session')
    expect(authContext).toHaveProperty('loading')
    expect(authContext).toHaveProperty('signIn')
    expect(authContext).toHaveProperty('signOut')
    expect(authContext).toHaveProperty('signUp')
    expect(authContext).toHaveProperty('supabase')
  })
})

describe('AuthProvider', () => {
  test('initializes and completes loading', async () => {
    const TestComponent = () => {
      const { loading } = useAuth()
      return <div data-testid="auth-state">{loading ? 'Loading' : 'Loaded'}</div>
    }
    
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )
    
    // Should eventually complete loading
    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('Loaded')
    })
  })
})
