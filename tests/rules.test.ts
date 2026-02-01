import { describe, it, expect } from 'vitest'
import { findMatchingRule, rules } from '../electron/services/rules'

describe('Rule Engine - Positive Tests', () => {
  describe('Risk 5 (Critical) - System Files', () => {
    it('matches Windows System32', () => {
      const rule = findMatchingRule('C:\\Windows\\System32\\drivers\\etc\\hosts')
      expect(rule?.id).toBe('windows-system32')
      expect(rule?.riskScore).toBe(5)
    })

    it('matches Windows SysWOW64', () => {
      const rule = findMatchingRule('C:\\Windows\\SysWOW64\\cmd.exe')
      expect(rule?.id).toBe('windows-syswow64')
      expect(rule?.riskScore).toBe(5)
    })

    it('matches Windows WinSxS', () => {
      const rule = findMatchingRule('C:\\Windows\\WinSxS\\Manifests\\file.manifest')
      expect(rule?.id).toBe('windows-winsxs')
      expect(rule?.riskScore).toBe(5)
    })

    it('matches Program Files', () => {
      const rule = findMatchingRule('C:\\Program Files\\Microsoft Office\\Office16\\WINWORD.EXE')
      expect(rule?.id).toBe('program-files')
      expect(rule?.riskScore).toBe(5)
    })

    it('matches Program Files (x86)', () => {
      const rule = findMatchingRule('C:\\Program Files (x86)\\Steam\\steam.exe')
      expect(rule?.id).toBe('program-files-x86')
      expect(rule?.riskScore).toBe(5)
    })

    it('matches ProgramData', () => {
      const rule = findMatchingRule('C:\\ProgramData\\Microsoft\\Windows\\Caches\\cache.dat')
      expect(rule?.id).toBe('programdata')
      expect(rule?.riskScore).toBe(5)
    })

    it('matches Recovery partition', () => {
      const rule = findMatchingRule('C:\\Recovery\\WindowsRE\\Winre.wim')
      expect(rule?.id).toBe('recovery')
      expect(rule?.riskScore).toBe(5)
    })

    it('matches System Volume Information', () => {
      const rule = findMatchingRule('C:\\System Volume Information\\{guid}\\file')
      expect(rule?.id).toBe('system-volume-info')
      expect(rule?.riskScore).toBe(5)
    })

    it('matches Recycle Bin', () => {
      const rule = findMatchingRule('C:\\$Recycle.Bin\\S-1-5-21\\$ABCDEF.txt')
      expect(rule?.id).toBe('recycle-bin')
      expect(rule?.riskScore).toBe(5)
    })
  })

  describe('Risk 4 (High) - Personal Files', () => {
    it('matches user Documents', () => {
      const rule = findMatchingRule('C:\\Users\\John\\Documents\\ImportantFile.docx')
      expect(rule?.id).toBe('user-documents')
      expect(rule?.riskScore).toBe(4)
    })

    it('matches user Desktop', () => {
      const rule = findMatchingRule('C:\\Users\\Jane\\Desktop\\project.zip')
      expect(rule?.id).toBe('user-desktop')
      expect(rule?.riskScore).toBe(4)
    })

    it('matches user Pictures', () => {
      const rule = findMatchingRule('C:\\Users\\Bob\\Pictures\\vacation\\photo.jpg')
      expect(rule?.id).toBe('user-pictures')
      expect(rule?.riskScore).toBe(4)
    })

    it('matches user Videos', () => {
      const rule = findMatchingRule('C:\\Users\\Alice\\Videos\\birthday.mp4')
      expect(rule?.id).toBe('user-videos')
      expect(rule?.riskScore).toBe(4)
    })

    it('matches OneDrive', () => {
      const rule = findMatchingRule('C:\\Users\\Mark\\OneDrive\\Documents\\file.txt')
      expect(rule?.id).toBe('onedrive')
      expect(rule?.riskScore).toBe(4)
    })

    it('matches OneDrive with business suffix', () => {
      const rule = findMatchingRule('C:\\Users\\Mark\\OneDrive - Company\\file.txt')
      expect(rule?.id).toBe('onedrive')
    })
  })

  describe('Risk 3 (Medium) - Requires Review', () => {
    it('matches Windows Installer', () => {
      const rule = findMatchingRule('C:\\Windows\\Installer\\{guid}.msi')
      expect(rule?.id).toBe('windows-installer')
      expect(rule?.riskScore).toBe(3)
      expect(rule?.confidence).toBe('medium')
    })

    it('matches user Downloads', () => {
      const rule = findMatchingRule('C:\\Users\\Test\\Downloads\\setup.exe')
      expect(rule?.id).toBe('user-downloads')
      expect(rule?.riskScore).toBe(3)
    })

    it('matches SQL installer folder', () => {
      const rule = findMatchingRule('C:\\SQL2019\\setup.exe')
      expect(rule?.id).toBe('sql-installer')
      expect(rule?.riskScore).toBe(3)
    })
  })

  describe('Risk 2 (Low-Medium) - Usually Safe', () => {
    it('matches node_modules', () => {
      const rule = findMatchingRule('D:\\Projects\\MyApp\\node_modules\\lodash\\index.js')
      expect(rule?.id).toBe('node-modules')
      expect(rule?.riskScore).toBe(2)
      expect(rule?.confidence).toBe('high')
    })

    it('matches Python __pycache__', () => {
      const rule = findMatchingRule('D:\\Python\\project\\__pycache__\\module.pyc')
      expect(rule?.id).toBe('python-pycache')
      expect(rule?.riskScore).toBe(2)
    })

    it('matches .nuget packages', () => {
      const rule = findMatchingRule('C:\\Users\\Dev\\.nuget\\packages\\newtonsoft.json\\13.0.1\\lib\\net6.0\\Newtonsoft.Json.dll')
      expect(rule?.id).toBe('nuget-packages')
      expect(rule?.riskScore).toBe(2)
    })

    it('matches HP SWSETUP', () => {
      const rule = findMatchingRule('C:\\SWSETUP\\Drivers\\Audio\\setup.exe')
      expect(rule?.id).toBe('hp-swsetup')
      expect(rule?.riskScore).toBe(2)
    })
  })

  describe('Risk 1 (Low) - Typically Safe', () => {
    it('matches Windows Temp', () => {
      const rule = findMatchingRule('C:\\Windows\\Temp\\cab_1234_5.tmp')
      expect(rule?.id).toBe('windows-temp')
      expect(rule?.riskScore).toBe(1)
      expect(rule?.confidence).toBe('high')
    })

    it('matches user Temp', () => {
      const rule = findMatchingRule('C:\\Users\\John\\AppData\\Local\\Temp\\temp123.tmp')
      expect(rule?.id).toBe('user-temp')
      expect(rule?.riskScore).toBe(1)
    })

    it('matches Chrome cache', () => {
      const rule = findMatchingRule('C:\\Users\\John\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Cache\\data_0')
      expect(rule?.id).toBe('chrome-cache')
      expect(rule?.riskScore).toBe(1)
    })

    it('matches Firefox cache', () => {
      const rule = findMatchingRule('C:\\Users\\John\\AppData\\Local\\Mozilla\\Firefox\\Profiles\\abc123.default\\cache2\\entries\\12345')
      expect(rule?.id).toBe('firefox-cache')
      expect(rule?.riskScore).toBe(1)
    })

    it('matches Edge cache', () => {
      const rule = findMatchingRule('C:\\Users\\John\\AppData\\Local\\Microsoft\\Edge\\User Data\\Default\\Cache\\data_0')
      expect(rule?.id).toBe('edge-cache')
      expect(rule?.riskScore).toBe(1)
    })

    it('matches Office temp files in temp folder', () => {
      // Note: Office temp in Documents folder correctly matches Documents (higher risk)
      // Test with a temp folder path instead
      const rule = findMatchingRule('C:\\Users\\John\\AppData\\Local\\Temp\\~$ImportantDoc.docx')
      expect(rule?.id).toBe('user-temp') // Temp folder takes precedence
      expect(rule?.riskScore).toBe(1)
    })

    it('Office temp in Documents matches Documents (correct priority)', () => {
      // This is correct - Documents is higher risk and should match first
      const rule = findMatchingRule('C:\\Users\\John\\Documents\\~$ImportantDoc.docx')
      expect(rule?.id).toBe('user-documents')
      expect(rule?.riskScore).toBe(4)
    })
  })

  describe('Case insensitivity', () => {
    it('handles lowercase drive letters', () => {
      const rule = findMatchingRule('c:\\windows\\system32\\file.dll')
      expect(rule?.id).toBe('windows-system32')
    })

    it('handles mixed case paths', () => {
      const rule = findMatchingRule('C:\\USERS\\JOHN\\AppData\\Local\\TEMP\\file.tmp')
      expect(rule?.id).toBe('user-temp')
    })
  })
})

describe('Rule Engine - Statistics', () => {
  it('has rules covering all risk levels', () => {
    const riskLevels = new Set(rules.map(r => r.riskScore))
    expect(riskLevels).toContain(1)
    expect(riskLevels).toContain(2)
    expect(riskLevels).toContain(3)
    expect(riskLevels).toContain(4)
    expect(riskLevels).toContain(5)
  })

  it('has at least 20 rules defined', () => {
    expect(rules.length).toBeGreaterThanOrEqual(20)
  })

  it('all rules have required fields', () => {
    for (const rule of rules) {
      expect(rule.id).toBeDefined()
      expect(rule.pattern).toBeInstanceOf(RegExp)
      expect(rule.category).toBeDefined()
      expect([1, 2, 3, 4, 5]).toContain(rule.riskScore)
      expect(['high', 'medium', 'low']).toContain(rule.confidence)
      expect(rule.recommendation).toBeDefined()
      expect(rule.explanation).toBeDefined()
    }
  })

  it('all rules use conservative language', () => {
    for (const rule of rules) {
      // Should never say "safe to delete" without qualifiers
      expect(rule.recommendation.toLowerCase()).not.toMatch(/^safe to delete/)
      expect(rule.explanation.toLowerCase()).not.toMatch(/^safe to delete/)

      // Should never say "definitely" or "certainly"
      expect(rule.recommendation.toLowerCase()).not.toContain('definitely')
      expect(rule.explanation.toLowerCase()).not.toContain('definitely')
      expect(rule.recommendation.toLowerCase()).not.toContain('certainly')
      expect(rule.explanation.toLowerCase()).not.toContain('certainly')
    }
  })
})
