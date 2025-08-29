'use client'

import { useRef, useCallback, useEffect } from 'react'
import { WorkerMessage, WorkerResponse } from '@/workers/dataProcessor.worker'

interface UseWebWorkerOptions {
  terminateOnUnmount?: boolean
  maxRetries?: number
  retryDelay?: number
}

interface WebWorkerHook {
  postMessage: <T = any>(message: Omit<WorkerMessage, 'id'>) => Promise<T>
  terminate: () => void
  isSupported: boolean
}

export function useWebWorker(
  workerFactory: () => Worker,
  options: UseWebWorkerOptions = {}
): WebWorkerHook {
  const {
    terminateOnUnmount = true,
    maxRetries = 3,
    retryDelay = 1000
  } = options

  const workerRef = useRef<Worker | null>(null)
  const pendingMessages = useRef<Map<string, {
    resolve: (value: any) => void
    reject: (error: Error) => void
    retries: number
    originalMessage: Omit<WorkerMessage, 'id'>
  }>>(new Map())

  const isSupported = typeof Worker !== 'undefined'

  // Initialize worker
  const initWorker = useCallback(() => {
    if (!isSupported) return null

    try {
      const worker = workerFactory()
      
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const { id, type, result, error } = event.data
        const pending = pendingMessages.current.get(id)
        
        if (pending) {
          pendingMessages.current.delete(id)
          
          if (type === 'SUCCESS') {
            pending.resolve(result)
          } else {
            pending.reject(new Error(error || 'Worker error'))
          }
        }
      }
      
      worker.onerror = (error) => {
        console.error('Worker error:', error)
        // Reject all pending messages
        pendingMessages.current.forEach(({ reject }) => {
          reject(new Error('Worker crashed'))
        })
        pendingMessages.current.clear()
      }
      
      return worker
    } catch (error) {
      console.error('Failed to create worker:', error)
      return null
    }
  }, [workerFactory, isSupported])

  // Get or create worker
  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = initWorker()
    }
    return workerRef.current
  }, [initWorker])

  // Post message with retry logic
  const postMessage = useCallback(<T = any>(
    message: Omit<WorkerMessage, 'id'>
  ): Promise<T> => {
    return new Promise((resolve, reject) => {
      if (!isSupported) {
        reject(new Error('Web Workers not supported'))
        return
      }

      const worker = getWorker()
      if (!worker) {
        reject(new Error('Failed to create worker'))
        return
      }

      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const fullMessage: WorkerMessage = { ...message, id }

      const attemptSend = (retries: number) => {
        try {
          pendingMessages.current.set(id, {
            resolve,
            reject,
            retries,
            originalMessage: message
          })

          worker.postMessage(fullMessage)

          // Set timeout for this specific message
          setTimeout(() => {
            const pending = pendingMessages.current.get(id)
            if (pending) {
              pendingMessages.current.delete(id)
              
              if (retries > 0) {
                console.warn(`Worker message timeout, retrying... (${maxRetries - retries + 1}/${maxRetries})`)
                setTimeout(() => attemptSend(retries - 1), retryDelay)
              } else {
                reject(new Error('Worker message timeout'))
              }
            }
          }, 30000) // 30 second timeout
          
        } catch (error) {
          pendingMessages.current.delete(id)
          
          if (retries > 0) {
            console.warn(`Worker send failed, retrying... (${maxRetries - retries + 1}/${maxRetries})`)
            setTimeout(() => attemptSend(retries - 1), retryDelay)
          } else {
            reject(error instanceof Error ? error : new Error('Worker send failed'))
          }
        }
      }

      attemptSend(maxRetries)
    })
  }, [isSupported, getWorker, maxRetries, retryDelay])

  // Terminate worker
  const terminate = useCallback(() => {
    if (workerRef.current) {
      // Reject all pending messages
      pendingMessages.current.forEach(({ reject }) => {
        reject(new Error('Worker terminated'))
      })
      pendingMessages.current.clear()
      
      workerRef.current.terminate()
      workerRef.current = null
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (terminateOnUnmount) {
        terminate()
      }
    }
  }, [terminate, terminateOnUnmount])

  return {
    postMessage,
    terminate,
    isSupported
  }
}

// Specific hook for data processing worker
export function useDataProcessorWorker() {
  return useWebWorker(
    () => new Worker(new URL('@/workers/dataProcessor.worker.ts', import.meta.url)),
    {
      terminateOnUnmount: true,
      maxRetries: 2,
      retryDelay: 500
    }
  )
}

// Hook with fallback for when workers aren't supported
export function useWebWorkerWithFallback<T>(
  workerFactory: () => Worker,
  fallbackFn: (payload: any) => T | Promise<T>,
  options?: UseWebWorkerOptions
) {
  const { postMessage, isSupported, terminate } = useWebWorker(workerFactory, options)

  const processData = useCallback(async (
    type: WorkerMessage['type'],
    payload: any
  ): Promise<T> => {
    if (isSupported) {
      try {
        return await postMessage({ type, payload })
      } catch (error) {
        console.warn('Worker failed, falling back to main thread:', error)
        return await fallbackFn(payload)
      }
    } else {
      return await fallbackFn(payload)
    }
  }, [isSupported, postMessage, fallbackFn])

  return {
    processData,
    terminate,
    isSupported
  }
}