'use client'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  return (
    <main className="min-h-screen bg-black text-white flex flex-col">

      {/* Navbar */}
      <nav className="flex justify-between items-center px-8 py-6">
        <h1 className="text-2xl font-bold text-green-400">Stockify</h1>
        <div className="flex gap-4">
          <button
            onClick={() => router.push('/auth')}
            className="text-gray-400 hover:text-white transition text-sm"
          >
            Log In
          </button>
          <button
            onClick={() => router.push('/auth')}
            className="bg-green-400 text-black font-bold px-4 py-2 rounded-xl hover:bg-green-300 transition text-sm"
          >
            Sign Up
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center text-center flex-1 px-8 py-20">
        <h2 className="text-6xl font-bold mb-6 leading-tight">
          Invest in Artists.<br />
          <span className="text-green-400">Track Their Rise.</span>
        </h2>
        <p className="text-gray-400 text-xl max-w-xl mb-10">
          Stockify is a music-powered stock market. Buy shares in your favorite artists and grow your portfolio as their fanbase grows.
        </p>
        <button
          onClick={() => router.push('/auth')}
          className="bg-green-400 text-black font-bold px-8 py-4 rounded-2xl hover:bg-green-300 transition text-lg"
        >
          Start Investing Free
        </button>
      </section>

      {/* How It Works */}
      <section className="px-8 py-20 bg-gray-950">
        <h3 className="text-3xl font-bold text-center mb-12">How It Works</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="bg-gray-900 rounded-2xl p-6 text-center">
            <div className="text-4xl mb-4">🎵</div>
            <h4 className="text-xl font-bold mb-2">Pick an Artist</h4>
            <p className="text-gray-400">Search any artist on Spotify and see their current share price based on their popularity.</p>
          </div>
          <div className="bg-gray-900 rounded-2xl p-6 text-center">
            <div className="text-4xl mb-4">💰</div>
            <h4 className="text-xl font-bold mb-2">Buy Shares</h4>
            <p className="text-gray-400">Spend your credits to buy shares. Every new user starts with 1000 free credits.</p>
          </div>
          <div className="bg-gray-900 rounded-2xl p-6 text-center">
            <div className="text-4xl mb-4">📈</div>
            <h4 className="text-xl font-bold mb-2">Watch It Grow</h4>
            <p className="text-gray-400">As the artist gains more listeners, your shares increase in value. Sell at the right time.</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="flex flex-col items-center justify-center text-center px-8 py-20">
        <h3 className="text-4xl font-bold mb-4">Ready to invest?</h3>
        <p className="text-gray-400 mb-8">Join Stockify and start building your music portfolio today.</p>
        <button
          onClick={() => router.push('/auth')}
          className="bg-green-400 text-black font-bold px-8 py-4 rounded-2xl hover:bg-green-300 transition text-lg"
        >
          Create Free Account
        </button>
      </section>

      {/* Footer */}
      <footer className="text-center text-gray-600 text-sm py-6 border-t border-gray-900">
        © 2025 Stockify. All rights reserved.
      </footer>

    </main>
  )
}