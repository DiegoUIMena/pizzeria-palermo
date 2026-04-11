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
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

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

  // Auto-scroll al último mensaje
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
    <>
      {/* Botón flotante */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            size="icon"
            className="w-14 h-14 md:w-20 md:h-20 rounded-full bg-pink-400 hover:bg-pink-500 shadow-lg text-white transition-transform hover:scale-110 p-0 overflow-hidden"
            onClick={() => setIsOpen(true)}
          >
            <img src="/iconos/chatbot_pink.svg" alt="Chat" className="w-full h-full object-cover" />
          </Button>
        </div>
      )}

      {/* Ventana del chat */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[500px] bg-white rounded-lg shadow-2xl flex flex-col z-50 border border-gray-200">
          {/* Header */}
          <div className="bg-black text-white p-4 rounded-t-lg flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <img src="/iconos/chatbot_pink.svg" alt="Chat" className="w-12 h-12" />
              <div>
                <h3 className="font-semibold">Pizzería Palermo</h3>
                <p className="text-xs text-gray-300">Asistente Virtual</p>
              </div>
            </div>
            <div className="flex space-x-2">
              <button 
                onClick={clearChat}
                className="text-white/80 hover:text-white text-xs"
                title="Limpiar chat"
              >
                Limpiar
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/80 hover:text-white"
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
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.sender === 'user'
                      ? 'bg-pink-400 text-white'
                      : 'bg-white border border-gray-200 text-gray-800'
                  }`}
                >
                  <p className="text-sm">{message.text}</p>
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
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-200 bg-white rounded-b-lg">
            <div className="flex space-x-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Escribe tu mensaje..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-transparent"
                disabled={isLoading}
              />
              <Button
                size="icon"
                onClick={sendMessage}
                disabled={isLoading || !inputMessage.trim()}
                className="rounded-full bg-pink-400 hover:bg-pink-500"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
