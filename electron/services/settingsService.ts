import fs from 'fs/promises'
import path from 'path'
import { app } from 'electron'

export interface AppSettings {
  backupLocation: string | null
  claudeApiKey: string | null
  updatedAt: string
}

const DEFAULT_SETTINGS: AppSettings = {
  backupLocation: null,
  claudeApiKey: null,
  updatedAt: new Date().toISOString()
}

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json')
}

/**
 * Load app settings from disk
 */
export async function loadSettings(): Promise<AppSettings> {
  try {
    const settingsPath = getSettingsPath()
    const data = await fs.readFile(settingsPath, 'utf-8')
    const settings = JSON.parse(data) as AppSettings
    return { ...DEFAULT_SETTINGS, ...settings }
  } catch (err) {
    // File doesn't exist or is invalid, return defaults
    return { ...DEFAULT_SETTINGS }
  }
}

/**
 * Save app settings to disk
 */
export async function saveSettings(settings: AppSettings): Promise<void> {
  const settingsPath = getSettingsPath()
  const dir = path.dirname(settingsPath)

  // Ensure directory exists
  await fs.mkdir(dir, { recursive: true })

  // Write settings with updated timestamp
  const data = {
    ...settings,
    updatedAt: new Date().toISOString()
  }

  await fs.writeFile(settingsPath, JSON.stringify(data, null, 2), 'utf-8')
}

/**
 * Get the saved backup location
 */
export async function getBackupLocation(): Promise<string | null> {
  const settings = await loadSettings()
  return settings.backupLocation
}

/**
 * Set the backup location
 */
export async function setBackupLocation(location: string | null): Promise<void> {
  const settings = await loadSettings()
  settings.backupLocation = location
  await saveSettings(settings)
}

/**
 * Get the saved Claude API key
 */
export async function getClaudeApiKey(): Promise<string | null> {
  const settings = await loadSettings()
  return settings.claudeApiKey
}

/**
 * Set the Claude API key
 */
export async function setClaudeApiKey(apiKey: string | null): Promise<void> {
  const settings = await loadSettings()
  settings.claudeApiKey = apiKey
  await saveSettings(settings)
}
