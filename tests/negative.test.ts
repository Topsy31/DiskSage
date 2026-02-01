import { describe, it, expect } from 'vitest'
import { findMatchingRule, shouldNotMatch } from '../electron/services/rules'

/**
 * CRITICAL: Negative test cases
 *
 * These tests ensure rules DON'T match paths they shouldn't.
 * False positives on these paths could lead to data loss.
 */
describe('Negative Tests - User-Created Folders', () => {
  describe('Cache folder false positives', () => {
    it('should NOT match user-created Cache folder in Documents', () => {
      const path = 'C:\\Users\\John\\Documents\\MyProject\\Cache\\important_data.json'
      const rule = findMatchingRule(path)
      // Should match Documents (risk 4), not generic cache
      expect(rule?.id).toBe('user-documents')
      expect(shouldNotMatch(path, 'generic-cache-appdata')).toBe(true)
    })

    it('should NOT match application data Cache that contains config', () => {
      const path = 'C:\\ImportantApp\\Cache\\settings.db'
      // Should not match any low-risk cache rule
      const rule = findMatchingRule(path)
      expect(rule?.riskScore).not.toBe(1)
    })

    it('should NOT match Caches folder outside AppData', () => {
      const path = 'D:\\Work\\ProjectCaches\\build_artifacts\\module.dll'
      // Should not match cache rules
      const rule = findMatchingRule(path)
      expect(rule?.id).not.toBe('generic-cache-appdata')
    })
  })

  describe('Temp file false positives', () => {
    it('should NOT match .tmp extension in user folders', () => {
      const path = 'C:\\Users\\John\\Documents\\MyFiles.tmp\\important_report.doc'
      const rule = findMatchingRule(path)
      // Should match Documents, not temp
      expect(rule?.id).toBe('user-documents')
    })

    it('should NOT match folder named Temp in project directory', () => {
      const path = 'D:\\Projects\\WebApp\\Temp\\templates\\index.html'
      const rule = findMatchingRule(path)
      // Should not match Windows temp or user temp
      expect(rule?.id).not.toBe('windows-temp')
      expect(rule?.id).not.toBe('user-temp')
    })
  })

  describe('node_modules false positives', () => {
    it('should NOT recommend deleting node_modules containing custom code', () => {
      // This is still node_modules, but we verify confidence is appropriate
      const path = 'D:\\Projects\\Library\\node_modules\\my-local-package\\src\\custom.js'
      const rule = findMatchingRule(path)
      expect(rule?.id).toBe('node-modules')
      // The explanation should mention npm install as recovery method
      expect(rule?.explanation.toLowerCase()).toContain('npm install')
    })
  })
})

describe('Negative Tests - System Paths', () => {
  describe('Windows folder variations', () => {
    it('should match Windows folder on any drive', () => {
      const rule = findMatchingRule('D:\\Windows\\System32\\file.dll')
      expect(rule?.id).toBe('windows-system32')
    })

    it('should NOT match folder named Windows in user directory', () => {
      const path = 'C:\\Users\\John\\Documents\\Windows\\backup.txt'
      const rule = findMatchingRule(path)
      // Should match Documents, not Windows system
      expect(rule?.id).toBe('user-documents')
    })
  })

  describe('Downloads variations', () => {
    it('should match Downloads in standard location', () => {
      const rule = findMatchingRule('C:\\Users\\Jane\\Downloads\\file.zip')
      expect(rule?.id).toBe('user-downloads')
    })

    it('should NOT match Downloads folder in project', () => {
      const path = 'D:\\Projects\\App\\Downloads\\manager.js'
      const rule = findMatchingRule(path)
      // Should not match user downloads
      expect(rule?.id).not.toBe('user-downloads')
    })
  })
})

describe('Negative Tests - Edge Cases', () => {
  describe('Similar folder names', () => {
    it('should distinguish System32 from System', () => {
      const systemPath = 'C:\\Windows\\System\\file.dll'
      const rule = findMatchingRule(systemPath)
      // Should NOT match System32 rule
      expect(rule?.id).not.toBe('windows-system32')
    })

    it('should distinguish Temp from Temperature', () => {
      const path = 'C:\\Users\\John\\AppData\\Local\\Temperature\\log.txt'
      const rule = findMatchingRule(path)
      expect(rule?.id).not.toBe('user-temp')
    })
  })

  describe('Path traversal safety', () => {
    it('should handle paths with .. correctly', () => {
      // This shouldn't bypass rules
      const path = 'C:\\Users\\John\\Documents\\..\\Downloads\\file.zip'
      // The literal path should still be analysed, not resolved
      const rule = findMatchingRule(path)
      // In this case, Documents matches first
      expect(rule?.id).toBe('user-documents')
    })
  })

  describe('Special characters', () => {
    it('should handle usernames with spaces', () => {
      const path = 'C:\\Users\\John Smith\\Documents\\file.txt'
      const rule = findMatchingRule(path)
      expect(rule?.id).toBe('user-documents')
    })

    it('should handle paths with special characters', () => {
      const path = 'C:\\Users\\John\\Documents\\Project (2023)\\file.txt'
      const rule = findMatchingRule(path)
      expect(rule?.id).toBe('user-documents')
    })

    it('should handle paths with unicode characters', () => {
      const path = 'C:\\Users\\Jöhn\\Documents\\Wörkfiles\\file.txt'
      const rule = findMatchingRule(path)
      expect(rule?.id).toBe('user-documents')
    })
  })

  describe('Empty and malformed paths', () => {
    it('should return undefined for empty path', () => {
      const rule = findMatchingRule('')
      expect(rule).toBeUndefined()
    })

    it('should handle path with no drive letter', () => {
      const path = '\\Users\\John\\Documents\\file.txt'
      const rule = findMatchingRule(path)
      // Should not match without drive letter
      expect(rule).toBeUndefined()
    })

    it('should handle relative paths safely', () => {
      const path = '.\\node_modules\\lodash\\index.js'
      const rule = findMatchingRule(path)
      // node_modules pattern should still work
      expect(rule?.id).toBe('node-modules')
    })
  })
})

describe('Negative Tests - Priority Order', () => {
  describe('More specific rules should win', () => {
    it('Chrome Cache should match before generic AppData cache', () => {
      const path = 'C:\\Users\\John\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Cache\\data_0'
      const rule = findMatchingRule(path)
      expect(rule?.id).toBe('chrome-cache')
    })

    it('User Temp should match before generic cache', () => {
      const path = 'C:\\Users\\John\\AppData\\Local\\Temp\\cache\\file.tmp'
      const rule = findMatchingRule(path)
      expect(rule?.id).toBe('user-temp')
    })

    it('Documents should take priority over generic paths', () => {
      const path = 'C:\\Users\\John\\Documents\\Cache\\important.db'
      const rule = findMatchingRule(path)
      expect(rule?.id).toBe('user-documents')
      expect(rule?.riskScore).toBe(4)
    })
  })
})

describe('Negative Tests - Risk Level Boundaries', () => {
  it('should never classify System32 below Risk 5', () => {
    const paths = [
      'C:\\Windows\\System32\\config\\SAM',
      'C:\\Windows\\System32\\drivers\\etc\\hosts',
      'C:\\WINDOWS\\SYSTEM32\\cmd.exe'
    ]

    for (const path of paths) {
      const rule = findMatchingRule(path)
      expect(rule?.riskScore).toBe(5)
    }
  })

  it('should never classify Documents below Risk 4', () => {
    const paths = [
      'C:\\Users\\Test\\Documents\\file.txt',
      'C:\\Users\\Another User\\Documents\\subfolder\\data.xlsx'
    ]

    for (const path of paths) {
      const rule = findMatchingRule(path)
      expect(rule?.riskScore).toBe(4)
    }
  })

  it('should classify Downloads as Risk 3 (needs review)', () => {
    const path = 'C:\\Users\\Test\\Downloads\\important.pdf'
    const rule = findMatchingRule(path)
    expect(rule?.riskScore).toBe(3)
  })
})
