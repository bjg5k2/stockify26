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
      if (error) setError(error.message)
      else router.push('/dashboard')
    } else {
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: {
            username
          }
        }
      })
      if (error) {
        setError(error.message)
      } else {
        router.push('/dashboard')
      }
    }
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold text-green-400 mb-2">Stockify</h1>
      <p className="text-gray-400 mb-8">Invest in artists. Track their rise.</p>

      <div className="bg-gray-900 p-8 rounded-2xl w-full max-w-md flex flex-col gap-4">
        <h2 className="text-xl font-semibold">{isLogin ? 'Log In' : 'Create Account'}</h2>

        {!isLogin && (
          <input
            className="bg-gray-800 rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-green-400"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
          />
        )}

        <input
          className="bg-gray-800 rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-green-400"
          placeholder="Email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />

        <input
          className="bg-gray-800 rounded-lg px-4 py-3 text-white outline-none focus:ring-2 focus:ring-green-400"
          placeholder="Password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          onClick={handleAuth}
          disabled={loading}
          className="bg-green-400 text-black font-bold py-3 rounded-lg hover:bg-green-300 transition"
        >
          {loading ? 'Loading...' : isLogin ? 'Log In' : 'Sign Up'}
        </button>

        <p className="text-gray-400 text-sm text-center">
          {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
          <span
            className="text-green-400 cursor-pointer hover:underline"
            onClick={() => setIsLogin(!isLogin)}
          >
            {isLogin ? 'Sign Up' : 'Log In'}
          </span>
        </p>
      </div>
    </main>
  )
}