'use client'

/**
 * OT-REPORT-AUTH-URGENTE-001: Página de login Report
 * Adaptado de rimec-web
 */

import { useState } from 'react'

export default function LoginPage() {
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || data.message || 'Error al iniciar sesión')
        setLoading(false)
        return
      }

      // Login exitoso
      window.location.href = '/'
    } catch (err) {
      setError('Error de conexión')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ background: 'linear-gradient(135deg, #1B3A6B 0%, #D4AF37 100%)' }}>
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Logo/Header */}
          <div className="text-center mb-8">
            <div className="inline-block bg-gradient-to-r from-blue-900 to-yellow-600 rounded-full p-4 mb-4">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">NEXUS Report</h1>
            <p className="text-sm text-gray-600 mt-1">Centro de Mando Comercial</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="usuario" className="block text-sm font-medium text-gray-700 mb-2">
                Usuario
              </label>
              <input
                id="usuario"
                name="username"
                type="text"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-transparent outline-none transition-all"
                placeholder="Ingrese su usuario"
                required
                autoComplete="username"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-transparent outline-none transition-all"
                placeholder="Ingrese su contraseña"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-900 to-blue-950 text-white font-semibold py-3 px-4 rounded-lg hover:from-blue-800 hover:to-blue-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-gray-500">
            Acceso restringido a usuarios autorizados
          </div>
        </div>
      </div>
    </div>
  )
}
