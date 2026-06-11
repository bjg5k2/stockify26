'use client'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleAuth = async () => {
    setLoading(true)
    setError('')

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        if (error.message.includes('Invalid login')) {
          setError('Incorrect email or password.')
        } else {
          setError(error.message)
        }
      } else {
        router.push('/dashboard')
      }
    } else {
      if (!username.trim()) {
        setError('Please enter a username.')
        setLoading(false)
        return
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.')
        setLoading(false)
        return
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username }
        }
      })

      if (error) {
        if (error.message.includes('duplicate') || error.message.includes('unique') || error.message.includes('Database error')) {
          setError('That username is already taken. Please choose another.')
        } else if (error.message.includes('already registered')) {
          setError('An account with that email already exists.')
        } else {
          setError(error.message)
        }
      } else {
        router.push('/dashboard')
      }
    }
    setLoading(false)
  }

  return (
    <main style={{ background: '#0a0a0a', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', color: '#fff' }}>

      {/* Logo */}
      <div
        onClick={() => router.push('/')}
        style={{ color: '#4ade80', fontSize: '24px', fontWeight: '500', letterSpacing: '-0.5px', marginBottom: '8px', cursor: 'pointer' }}
      >
        Stockify
      </div>
      <p style={{ color: '#555', fontSize: '14px', marginBottom: '36px' }}>
        {isLogin ? 'Welcome back.' : 'Start investing in artists today.'}
      </p>

      {/* Card */}
      <div style={{ background: '#0f0f0f', border: '0.5px solid #1c1c1c', borderRadius: '16px', padding: '36px', width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: '500', marginBottom: '4px' }}>
          {isLogin ? 'Log in to your account' : 'Create your account'}
        </h2>

        {!isLogin && (
          <input
            style={{ background: '#1a1a1a', border: '0.5px solid #2a2a2a', borderRadius: '8px', padding: '12px 16px', color: '#fff', fontSize: '14px', outline: 'none', width: '100%' }}
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
          />
        )}

        <input
          style={{ background: '#1a1a1a', border: '0.5px solid #2a2a2a', borderRadius: '8px', padding: '12px 16px', color: '#fff', fontSize: '14px', outline: 'none', width: '100%' }}
          placeholder="Email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAuth()}
        />

        <input
          style={{ background: '#1a1a1a', border: '0.5px solid #2a2a2a', borderRadius: '8px', padding: '12px 16px', color: '#fff', fontSize: '14px', outline: 'none', width: '100%' }}
          placeholder="Password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAuth()}
        />

        {error && (
          <div style={{ background: '#1a0a0a', border: '0.5px solid #3a1a1a', borderRadius: '8px', padding: '10px 14px', color: '#f87171', fontSize: '13px' }}>
            {error}
          </div>
        )}

        <button
          onClick={handleAuth}
          disabled={loading}
          style={{ background: '#4ade80', color: '#000', fontSize: '14px', fontWeight: '500', padding: '13px', borderRadius: '8px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: '4px' }}
        >
          {loading ? 'Loading...' : isLogin ? 'Log in' : 'Create account'}
        </button>

        <p style={{ color: '#555', fontSize: '13px', textAlign: 'center', marginTop: '4px' }}>
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <span
            style={{ color: '#4ade80', cursor: 'pointer' }}
            onClick={() => { setIsLogin(!isLogin); setError('') }}
          >
            {isLogin ? 'Sign up' : 'Log in'}
          </span>
        </p>

        {!isLogin && (
          <p style={{ color: '#333', fontSize: '11px', textAlign: 'center' }}>
            By signing up you agree to our terms. No real money involved.
          </p>
        )}
      </div>

    </main>
  )
}