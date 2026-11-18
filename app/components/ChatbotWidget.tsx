"use client"

/**
 * Widget de Chatbot - Pizzería Palermo
 * Reemplaza el botón de WhatsApp con un chatbot interactivo
 */

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { functions } from '@/lib/firebase'
import { httpsCallable } from 'firebase/functions'
import { X, Send } from 'lucide-react'

interface Message {
  id: string
  text: string
  sender: 'user' | 'bot'
  timestamp: Date
}

const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID || 'pizzeria-palermo-17f6d'

export function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [shouldRenderWindow, setShouldRenderWindow] = useState(false)
  const [isAnimatingIn, setIsAnimatingIn] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Control de montaje y animación orgánica de apertura/cierre
  useEffect(() => {
    if (isOpen) {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
      }
      setShouldRenderWindow(true)
      const raf1 = requestAnimationFrame(() => {
        const raf2 = requestAnimationFrame(() => {
          setIsAnimatingIn(true)
        })
        return () => cancelAnimationFrame(raf2)
      })
      return () => cancelAnimationFrame(raf1)
    } else {
      setIsAnimatingIn(false)
      if (shouldRenderWindow) {
        closeTimerRef.current = setTimeout(() => {
          setShouldRenderWindow(false)
        }, 300)
      }
    }

    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current)
      }
    }
  }, [isOpen, shouldRenderWindow])

  // Generar sessionId único al montar el componente
  useEffect(() => {
    const storedSessionId = localStorage.getItem('chatbot_session_id')
    
    if (storedSessionId) {
      setSessionId(storedSessionId)
    } else {
      const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
      setSessionId(newSessionId)
      localStorage.setItem('chatbot_session_id', newSessionId)
    }

    // Cargar mensajes guardados
    const savedMessages = localStorage.getItem('chatbot_messages')
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages)
        setMessages(parsed.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        })))
      } catch (error) {
        console.error('Error loading messages:', error)
      }
    } else {
      // Mensaje de bienvenida
      setMessages([{
        id: '1',
        text: '¡Hola! 👋 Soy el asistente virtual de Pizzería Palermo. ¿En qué puedo ayudarte hoy?',
        sender: 'bot',
        timestamp: new Date()
      }])
    }
  }, [])

  // Guardar mensajes en localStorage
  useEffect(() => {
    if (messages.length > 1) {
      localStorage.setItem('chatbot_messages', JSON.stringify(messages))
    }
  }, [messages])

  // Auto-scroll al último mensaje y foco al abrir
  useEffect(() => {
    if (isOpen && shouldRenderWindow) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen, shouldRenderWindow])

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, 280)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !sessionId) return

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputMessage,
      sender: 'user',
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setIsLoading(true)

    try {
      const chatbotFunction = httpsCallable(functions, 'chatbot')
      const result = await chatbotFunction({
        tenantId: TENANT_ID,
        sessionId,
        message: inputMessage
      })

      const data = result.data as any

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: data.response || 'Lo siento, no pude procesar tu mensaje.',
        sender: 'bot',
        timestamp: new Date()
      }

      setMessages(prev => [...prev, botMessage])
    } catch (error: any) {
      console.error('Error sending message:', error)
      
      // Mensaje de error más amigable
      let errorText = 'Lo siento, estoy teniendo problemas técnicos en este momento. Por favor, intenta de nuevo más tarde o contáctanos directamente. 🙏'
      
      // Si el error viene del backend, usar ese mensaje
      if (error?.message) {
        errorText = error.message
      }
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: errorText,
        sender: 'bot',
        timestamp: new Date()
      }

      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearChat = () => {
    setMessages([{
      id: '1',
      text: '¡Hola! 👋 Soy el asistente virtual de Pizzería Palermo. ¿En qué puedo ayudarte hoy?',
      sender: 'bot',
      timestamp: new Date()
    }])
    localStorage.removeItem('chatbot_messages')
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Botón flotante con animación sutil y destacada */}
      <div
        className={`chatbot-fab-wrapper ${
          isOpen
            ? 'is-hidden pointer-events-none'
            : 'is-visible pointer-events-auto'
        }`}
      >
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Abrir asistente virtual"
          className="chatbot-fab-btn relative w-14 h-14 md:w-20 md:h-20 rounded-full bg-pink-500 text-white p-0 overflow-hidden focus:outline-none"
        >
          <img
            src="/iconos/chatbot_pink.svg"
            alt="Chat"
            className="w-full h-full object-cover select-none pointer-events-none"
          />
        </button>
      </div>

      {/* Ventana del chat con despliegue orgánico desde el ícono */}
      {shouldRenderWindow && (
        <div
          aria-hidden={!isOpen}
          className={`chatbot-window-panel fixed bottom-6 right-6 w-[calc(100vw-2rem)] sm:w-96 h-[500px] max-h-[calc(100vh-3rem)] bg-white rounded-2xl shadow-2xl flex flex-col border border-gray-200/90 overflow-hidden ${
            isAnimatingIn
              ? 'is-open pointer-events-auto'
              : 'is-closed pointer-events-none'
          }`}
        >
          {/* Header */}
          <div className="bg-black text-white p-4 flex justify-between items-center">
            <div className="flex items-center space-x-2.5">
              <img src="/iconos/chatbot_pink.svg" alt="Chat" className="w-11 h-11 rounded-full" />
              <div>
                <h3 className="font-semibold text-sm sm:text-base">Pizzería Palermo</h3>
                <p className="text-xs text-pink-300 flex items-center gap-1.5">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  Asistente Virtual
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button 
                onClick={clearChat}
                className="text-white/80 hover:text-white text-xs px-2 py-1 rounded hover:bg-white/10 transition-colors"
                title="Limpiar chat"
              >
                Limpiar
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/80 hover:text-white p-1.5 rounded-full hover:bg-white/10 active:scale-90 transition-all"
                aria-label="Cerrar chat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-xl p-3 shadow-sm ${
                    message.sender === 'user'
                      ? 'bg-pink-500 text-white'
                      : 'bg-white border border-gray-200 text-gray-800'
                  }`}
                >
                  <p className="text-sm leading-relaxed">{message.text}</p>
                  <p className={`text-xs mt-1 ${
                    message.sender === 'user' ? 'text-pink-100' : 'text-gray-400'
                  }`}>
                    {message.timestamp.toLocaleTimeString('es-CL', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-200 bg-white">
            <div className="flex space-x-2">
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Escribe tu mensaje..."
                className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-transparent transition-all"
                disabled={isLoading}
              />
              <Button
                size="icon"
                onClick={sendMessage}
                disabled={isLoading || !inputMessage.trim()}
                className="rounded-full bg-pink-500 hover:bg-pink-600 active:scale-95 transition-all"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
