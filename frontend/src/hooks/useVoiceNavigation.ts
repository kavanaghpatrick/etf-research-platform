'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useAnnouncementContext } from '@/components/AriaLiveRegions'

export interface VoiceCommand {
  phrases: string[]
  action: () => void
  description: string
  category: 'navigation' | 'content' | 'system' | 'accessibility'
  enabled: boolean
  confidence?: number
}

export interface VoiceNavigationState {
  isListening: boolean
  isSupported: boolean
  lastCommand: string | null
  confidence: number
  errorMessage: string | null
}

/**
 * Advanced voice navigation hook with speech recognition and synthesis
 * Provides hands-free navigation and accessibility features
 */
export function useVoiceNavigation() {
  const [state, setState] = useState<VoiceNavigationState>({
    isListening: false,
    isSupported: false,
    lastCommand: null,
    confidence: 0,
    errorMessage: null
  })
  
  const [commands, setCommands] = useState<VoiceCommand[]>([])
  const [isEnabled, setIsEnabled] = useState(false)
  const [language, setLanguage] = useState('en-US')
  const [voiceSettings, setVoiceSettings] = useState({
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    voice: null as SpeechSynthesisVoice | null
  })
  
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const synthesisRef = useRef<SpeechSynthesis | null>(null)
  const commandTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  const { announce } = useAnnouncementContext()

  /**
   * Initialize speech recognition and synthesis
   */
  const initializeSpeechAPIs = useCallback(() => {
    if (typeof window === 'undefined') return false

    // Check for Speech Recognition support
    const SpeechRecognition = (window as any).SpeechRecognition || 
                             (window as any).webkitSpeechRecognition
    
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition()
      const recognition = recognitionRef.current
      
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = language
      recognition.maxAlternatives = 3
      
      recognition.onstart = () => {
        setState(prev => ({ ...prev, isListening: true, errorMessage: null }))
        speak('Voice navigation started. Say "help" for available commands.')
      }
      
      recognition.onend = () => {
        setState(prev => ({ ...prev, isListening: false }))
        if (isEnabled) {
          speak('Voice navigation stopped.')
        }
      }
      
      recognition.onerror = (event) => {
        const errorMessage = getErrorMessage(event.error)
        setState(prev => ({ 
          ...prev, 
          isListening: false, 
          errorMessage 
        }))
        announce(`Voice recognition error: ${errorMessage}`, { priority: 'high' })
      }
      
      recognition.onresult = (event) => {
        const results = Array.from(event.results)
        const latest = results[results.length - 1]
        
        if (latest.isFinal) {
          const transcript = latest[0].transcript.trim().toLowerCase()
          const confidence = latest[0].confidence
          
          setState(prev => ({
            ...prev,
            lastCommand: transcript,
            confidence
          }))
          
          processVoiceCommand(transcript, confidence)
        }
      }
    }
    
    // Check for Speech Synthesis support
    if ('speechSynthesis' in window) {
      synthesisRef.current = window.speechSynthesis
    }
    
    const isSupported = !!(recognitionRef.current && synthesisRef.current)
    setState(prev => ({ ...prev, isSupported }))
    
    return isSupported
  }, [language, isEnabled, announce])

  /**
   * Get user-friendly error message
   */
  const getErrorMessage = useCallback((error: string): string => {
    switch (error) {
      case 'no-speech':
        return 'No speech detected. Please try again.'
      case 'audio-capture':
        return 'Microphone not accessible. Please check permissions.'
      case 'not-allowed':
        return 'Microphone permission denied. Please enable microphone access.'
      case 'network':
        return 'Network error occurred. Please check your connection.'
      case 'service-not-allowed':
        return 'Speech recognition service not available.'
      default:
        return 'Speech recognition error occurred.'
    }
  }, [])

  /**
   * Process recognized voice command
   */
  const processVoiceCommand = useCallback((transcript: string, confidence: number) => {
    // Clear previous timeout
    if (commandTimeoutRef.current) {
      clearTimeout(commandTimeoutRef.current)
    }
    
    // Set minimum confidence threshold
    if (confidence < 0.5) {
      speak("I didn't understand that command clearly. Please try again.")
      return
    }
    
    // Find matching command
    const matchedCommand = commands.find(command => 
      command.enabled && 
      command.phrases.some(phrase => 
        transcript.includes(phrase.toLowerCase()) ||
        levenshteinDistance(transcript, phrase.toLowerCase()) <= 2
      )
    )
    
    if (matchedCommand) {
      try {
        speak(`Executing: ${matchedCommand.description}`)
        matchedCommand.action()
        announce(`Voice command executed: ${matchedCommand.description}`)
      } catch (error) {
        speak('Error executing command.')
        announce('Voice command failed to execute', { priority: 'high' })
      }
    } else {
      // Handle built-in commands
      if (transcript.includes('help') || transcript.includes('commands')) {
        showVoiceHelp()
      } else if (transcript.includes('stop') || transcript.includes('quit')) {
        stopListening()
      } else if (transcript.includes('repeat')) {
        repeatLastAnnouncement()
      } else {
        speak("Command not recognized. Say 'help' for available commands.")
      }
    }
    
    // Auto-stop listening after 30 seconds of inactivity
    commandTimeoutRef.current = setTimeout(() => {
      if (state.isListening) {
        stopListening()
      }
    }, 30000)
  }, [commands, state.isListening, announce])

  /**
   * Calculate Levenshtein distance for fuzzy matching
   */
  const levenshteinDistance = useCallback((str1: string, str2: string): number => {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null))
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator  // substitution
        )
      }
    }
    
    return matrix[str2.length][str1.length]
  }, [])

  /**
   * Text-to-speech function
   */
  const speak = useCallback((text: string, options: {
    rate?: number
    pitch?: number
    volume?: number
    voice?: SpeechSynthesisVoice | null
    interrupt?: boolean
  } = {}) => {
    if (!synthesisRef.current) return
    
    const {
      rate = voiceSettings.rate,
      pitch = voiceSettings.pitch,
      volume = voiceSettings.volume,
      voice = voiceSettings.voice,
      interrupt = true
    } = options
    
    if (interrupt) {
      synthesisRef.current.cancel()
    }
    
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = rate
    utterance.pitch = pitch
    utterance.volume = volume
    
    if (voice) {
      utterance.voice = voice
    }
    
    utterance.onend = () => {
      console.log('Speech synthesis completed')
    }
    
    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event.error)
    }
    
    synthesisRef.current.speak(utterance)
  }, [voiceSettings])

  /**
   * Start voice recognition
   */
  const startListening = useCallback(() => {
    if (!recognitionRef.current || !isEnabled) return
    
    try {
      recognitionRef.current.start()
      setState(prev => ({ ...prev, errorMessage: null }))
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        errorMessage: 'Could not start voice recognition'
      }))
    }
  }, [isEnabled])

  /**
   * Stop voice recognition
   */
  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return
    
    recognitionRef.current.stop()
    
    if (commandTimeoutRef.current) {
      clearTimeout(commandTimeoutRef.current)
      commandTimeoutRef.current = null
    }
  }, [])

  /**
   * Toggle voice recognition
   */
  const toggleListening = useCallback(() => {
    if (state.isListening) {
      stopListening()
    } else {
      startListening()
    }
  }, [state.isListening, startListening, stopListening])

  /**
   * Register a voice command
   */
  const registerCommand = useCallback((command: VoiceCommand) => {
    setCommands(prev => {
      const existing = prev.findIndex(cmd => 
        cmd.phrases.some(phrase => command.phrases.includes(phrase))
      )
      
      if (existing >= 0) {
        const updated = [...prev]
        updated[existing] = command
        return updated
      }
      
      return [...prev, command]
    })
  }, [])

  /**
   * Unregister a voice command
   */
  const unregisterCommand = useCallback((phrases: string[]) => {
    setCommands(prev => prev.filter(cmd => 
      !cmd.phrases.some(phrase => phrases.includes(phrase))
    ))
  }, [])

  /**
   * Show voice help
   */
  const showVoiceHelp = useCallback(() => {
    const enabledCommands = commands.filter(cmd => cmd.enabled)
    
    if (enabledCommands.length === 0) {
      speak('No voice commands are currently available.')
      return
    }
    
    const commandsByCategory = enabledCommands.reduce((acc, cmd) => {
      if (!acc[cmd.category]) acc[cmd.category] = []
      acc[cmd.category].push(cmd)
      return acc
    }, {} as Record<string, VoiceCommand[]>)
    
    let helpText = 'Available voice commands: '
    
    Object.entries(commandsByCategory).forEach(([category, cmds]) => {
      helpText += `${category}: `
      cmds.forEach((cmd, index) => {
        helpText += cmd.phrases[0]
        if (index < cmds.length - 1) helpText += ', '
      })
      helpText += '. '
    })
    
    helpText += 'Say "stop" to end voice navigation.'
    
    speak(helpText)
    announce('Voice commands help announced')
  }, [commands, speak, announce])

  /**
   * Repeat last announcement
   */
  const repeatLastAnnouncement = useCallback(() => {
    if (state.lastCommand) {
      speak(`Last command was: ${state.lastCommand}`)
    } else {
      speak('No previous command to repeat.')
    }
  }, [state.lastCommand, speak])

  /**
   * Get available voices
   */
  const getAvailableVoices = useCallback((): SpeechSynthesisVoice[] => {
    if (!synthesisRef.current) return []
    return synthesisRef.current.getVoices()
  }, [])

  /**
   * Set voice preferences
   */
  const updateVoiceSettings = useCallback((settings: Partial<typeof voiceSettings>) => {
    setVoiceSettings(prev => ({ ...prev, ...settings }))
  }, [])

  /**
   * Enable/disable voice navigation
   */
  const toggleVoiceNavigation = useCallback((enabled?: boolean) => {
    const newEnabled = enabled !== undefined ? enabled : !isEnabled
    setIsEnabled(newEnabled)
    
    if (!newEnabled && state.isListening) {
      stopListening()
    }
    
    announce(
      newEnabled ? 'Voice navigation enabled' : 'Voice navigation disabled',
      { priority: 'medium' }
    )
  }, [isEnabled, state.isListening, stopListening, announce])

  /**
   * Initialize default commands
   */
  const initializeDefaultCommands = useCallback(() => {
    const defaultCommands: VoiceCommand[] = [
      {
        phrases: ['go home', 'home page', 'navigate home'],
        action: () => window.location.href = '/',
        description: 'Navigate to home page',
        category: 'navigation',
        enabled: true
      },
      {
        phrases: ['go back', 'back', 'previous page'],
        action: () => window.history.back(),
        description: 'Go back to previous page',
        category: 'navigation',
        enabled: true
      },
      {
        phrases: ['refresh', 'reload', 'refresh page'],
        action: () => window.location.reload(),
        description: 'Refresh current page',
        category: 'system',
        enabled: true
      },
      {
        phrases: ['scroll up', 'page up'],
        action: () => window.scrollBy(0, -window.innerHeight * 0.8),
        description: 'Scroll up',
        category: 'navigation',
        enabled: true
      },
      {
        phrases: ['scroll down', 'page down'],
        action: () => window.scrollBy(0, window.innerHeight * 0.8),
        description: 'Scroll down',
        category: 'navigation',
        enabled: true
      },
      {
        phrases: ['top of page', 'scroll to top'],
        action: () => window.scrollTo(0, 0),
        description: 'Scroll to top of page',
        category: 'navigation',
        enabled: true
      },
      {
        phrases: ['bottom of page', 'scroll to bottom'],
        action: () => window.scrollTo(0, document.body.scrollHeight),
        description: 'Scroll to bottom of page',
        category: 'navigation',
        enabled: true
      },
      {
        phrases: ['focus search', 'search'],
        action: () => {
          const searchInput = document.querySelector('input[type="search"], input[placeholder*="search" i]') as HTMLElement
          searchInput?.focus()
        },
        description: 'Focus search input',
        category: 'navigation',
        enabled: true
      },
      {
        phrases: ['next tab', 'next section'],
        action: () => {
          const tabs = document.querySelectorAll('[role="tab"]')
          const activeTab = document.querySelector('[role="tab"][aria-selected="true"]') as HTMLElement
          if (activeTab && tabs.length > 1) {
            const currentIndex = Array.from(tabs).indexOf(activeTab)
            const nextIndex = (currentIndex + 1) % tabs.length
            ;(tabs[nextIndex] as HTMLElement).click()
          }
        },
        description: 'Navigate to next tab',
        category: 'navigation',
        enabled: true
      },
      {
        phrases: ['previous tab', 'previous section'],
        action: () => {
          const tabs = document.querySelectorAll('[role="tab"]')
          const activeTab = document.querySelector('[role="tab"][aria-selected="true"]') as HTMLElement
          if (activeTab && tabs.length > 1) {
            const currentIndex = Array.from(tabs).indexOf(activeTab)
            const prevIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1
            ;(tabs[prevIndex] as HTMLElement).click()
          }
        },
        description: 'Navigate to previous tab',
        category: 'navigation',
        enabled: true
      },
      {
        phrases: ['read page', 'read content'],
        action: () => {
          const mainContent = document.querySelector('main, [role="main"]')?.textContent ||
                            document.body.textContent
          if (mainContent) {
            speak(mainContent.slice(0, 500) + '...')
          }
        },
        description: 'Read page content',
        category: 'accessibility',
        enabled: true
      }
    ]
    
    defaultCommands.forEach(registerCommand)
  }, [registerCommand, speak])

  // Initialize speech APIs on mount
  useEffect(() => {
    const isInitialized = initializeSpeechAPIs()
    if (isInitialized) {
      initializeDefaultCommands()
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      if (synthesisRef.current) {
        synthesisRef.current.cancel()
      }
      if (commandTimeoutRef.current) {
        clearTimeout(commandTimeoutRef.current)
      }
    }
  }, [initializeSpeechAPIs, initializeDefaultCommands])

  // Update recognition language when changed
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = language
    }
  }, [language])

  return {
    // State
    state,
    isEnabled,
    commands,
    language,
    voiceSettings,
    
    // Actions
    startListening,
    stopListening,
    toggleListening,
    toggleVoiceNavigation,
    speak,
    registerCommand,
    unregisterCommand,
    showVoiceHelp,
    repeatLastAnnouncement,
    
    // Configuration
    setLanguage,
    updateVoiceSettings,
    getAvailableVoices,
    
    // Utilities
    isSupported: state.isSupported
  }
}