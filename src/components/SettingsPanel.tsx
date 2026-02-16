import { useState, useEffect } from 'react'

interface SettingsPanelProps {
  onClose: () => void
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [apiKey, setApiKey] = useState('')
  const [originalKey, setOriginalKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    window.electronAPI.getClaudeApiKey().then(key => {
      if (key) {
        const masked = key.substring(0, 8) + '...' + key.substring(key.length - 4)
        setApiKey(masked)
        setOriginalKey(key)
      }
    })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)

    try {
      // If the key wasn't changed (still masked), use original
      const keyToSave = apiKey.includes('...') ? originalKey : apiKey.trim()

      if (keyToSave.length > 0 && !keyToSave.startsWith('sk-ant-')) {
        setMessage({ type: 'error', text: 'Invalid API key format. Claude keys start with "sk-ant-"' })
        setSaving(false)
        return
      }

      await window.electronAPI.setClaudeApiKey(keyToSave || null)
      setMessage({ type: 'success', text: 'API key saved' })

      setTimeout(() => {
        onClose()
      }, 1000)
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to save API key'
      })
    } finally {
      setSaving(false)
    }
  }

  const handleClear = async () => {
    setSaving(true)
    try {
      await window.electronAPI.setClaudeApiKey(null)
      setApiKey('')
      setOriginalKey('')
      setMessage({ type: 'success', text: 'API key cleared' })
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to clear API key'
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Settings</h2>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Claude API Key
            </label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
              disabled={saving}
            />
            <p className="mt-2 text-xs text-gray-500">
              Required for the AI Advisor tab. Get your key from console.anthropic.com
            </p>
          </div>

          {message && (
            <div
              className={`p-3 rounded-md text-sm ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {message.text}
            </div>
          )}
        </div>

        <div className="p-6 border-t flex justify-between">
          <div>
            {originalKey && (
              <button
                onClick={handleClear}
                disabled={saving}
                className="px-4 py-2 text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
              >
                Clear Key
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !apiKey.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
