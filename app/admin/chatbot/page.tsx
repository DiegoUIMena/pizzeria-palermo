"use client"

/**
 * Panel de Administración del Chatbot
 * Gestión de intents, configuración y métricas
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { functions } from '@/lib/firebase'
import { httpsCallable } from 'firebase/functions'
import { Plus, Edit, Trash2, MessageCircle, BarChart3, Settings, HelpCircle, CheckCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { useAuth } from '@/app/context/AuthContext'
import { useRouter } from 'next/navigation'

const TENANT_ID = process.env.NEXT_PUBLIC_TENANT_ID || 'pizzeria-palermo-17f6d'

interface Intent {
  id: string
  intent: string
  priority: number
  keywords: string[]
  responses: string[]
  followUpKeywords?: string[]
  followUpResponses?: string[]
}

export default function ChatbotAdminPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [intents, setIntents] = useState<Intent[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'intents' | 'metrics' | 'config' | 'questions'>('intents')
  const [showForm, setShowForm] = useState(false)
  const [editingIntent, setEditingIntent] = useState<Intent | null>(null)
  const [metrics, setMetrics] = useState<any>(null)
  const [config, setConfig] = useState({
    enabled: false,
    fallbackMessage: '',
    maxSessionIdleMinutes: 5
  })
  const [unansweredQuestions, setUnansweredQuestions] = useState<any[]>([])
  const [questionStats, setQuestionStats] = useState({ total: 0, pending: 0, reviewed: 0, answered: 0 })
  const [questionFilter, setQuestionFilter] = useState<'all' | 'pending' | 'reviewed' | 'answered'>('pending')
  const [selectedQuestion, setSelectedQuestion] = useState<any | null>(null)
  const [helpBannerOpen, setHelpBannerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    intent: '',
    priority: 1,
    keywords: '',
    responses: '',
    followUpKeywords: '',
    followUpResponses: ''
  })

  useEffect(() => {
    if (!user) {
      router.push('/auth')
      return
    }

    loadIntents()
    loadMetrics()
    loadConfig()
    loadUnansweredQuestions(questionFilter === 'all' ? undefined : questionFilter)
    loadQuestionStats()
  }, [user])

  const loadIntents = async () => {
    try {
      const listFunction = httpsCallable(functions, 'chatbotListIntents')
      const result = await listFunction({ tenantId: TENANT_ID })
      const data = result.data as any
      setIntents(data.intents || [])
    } catch (error) {
      console.error('Error loading intents:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadMetrics = async () => {
    try {
      const metricsFunction = httpsCallable(functions, 'chatbotGetMetrics')
      const result = await metricsFunction({ tenantId: TENANT_ID })
      setMetrics(result.data)
    } catch (error) {
      console.error('Error loading metrics:', error)
    }
  }

  const loadConfig = async () => {
    try {
      const configFunction = httpsCallable(functions, 'chatbotGetConfig')
      const result = await configFunction({ tenantId: TENANT_ID })
      const data = result.data as any
      setConfig(data)
    } catch (error) {
      console.error('Error loading config:', error)
    }
  }

  const loadUnansweredQuestions = async (filter?: string) => {
    try {
      const questionsFunction = httpsCallable(functions, 'chatbotGetUnansweredQuestions')
      const status = filter && filter !== 'all' ? filter : undefined
      const result = await questionsFunction({ tenantId: TENANT_ID, status, limit: 100 })
      const data = result.data as any
      setUnansweredQuestions(data.questions || [])
    } catch (error) {
      console.error('Error loading unanswered questions:', error)
    }
  }

  const loadQuestionStats = async () => {
    try {
      const statsFunction = httpsCallable(functions, 'chatbotGetUnansweredStats')
      const result = await statsFunction({ tenantId: TENANT_ID })
      const data = result.data as any
      setQuestionStats(data)
    } catch (error) {
      console.error('Error loading question stats:', error)
    }
  }

  const handleUpdateQuestionStatus = async (questionId: string, newStatus: string) => {
    try {
      const updateFunction = httpsCallable(functions, 'chatbotUpdateQuestionStatus')
      await updateFunction({ tenantId: TENANT_ID, questionId, status: newStatus })
      await loadUnansweredQuestions(questionFilter === 'all' ? undefined : questionFilter)
      await loadQuestionStats()
      alert('Estado actualizado')
    } catch (error: any) {
      alert('Error: ' + error.message)
    }
  }

  const handleCreateIntentFromQuestion = (question: any) => {
    // Extraer keywords de la pregunta (usar los attemptedKeywords si existen)
    const suggestedKeywords = question.attemptedKeywords && question.attemptedKeywords.length > 0
      ? question.attemptedKeywords.join(', ')
      : question.userMessage.toLowerCase().split(' ').filter((w: string) => w.length > 3).slice(0, 5).join(', ')

    // Generar nombre de intent sugerido (primeras 2-3 palabras)
    const suggestedIntent = question.userMessage
      .toLowerCase()
      .replace(/[¿?]/g, '')
      .split(' ')
      .filter((w: string) => w.length > 3)
      .slice(0, 2)
      .join('_')

    // Precargar el formulario
    setFormData({
      intent: suggestedIntent,
      priority: 5,
      keywords: suggestedKeywords,
      responses: '', // El admin debe escribir la respuesta
      followUpKeywords: '',
      followUpResponses: ''
    })

    // Guardar la pregunta seleccionada para marcarla como respondida después
    setSelectedQuestion(question)
    
    // Cambiar a la pestaña de intents y abrir el formulario
    setActiveTab('intents')
    setEditingIntent(null)
    setShowForm(true)
  }

  const handleEditIntent = (intent: Intent) => {
    setEditingIntent(intent)
    setFormData({
      intent: intent.intent,
      priority: intent.priority,
      keywords: intent.keywords.join(', '),
      responses: intent.responses.join('\n---\n'),
      followUpKeywords: intent.followUpKeywords?.join(', ') || '',
      followUpResponses: intent.followUpResponses?.join('\n---\n') || ''
    })
    setShowForm(true)
  }

  const handleCreateIntent = async () => {
    // Validación adicional antes de enviar
    if (!formData.responses.trim()) {
      alert('⚠️ Debes escribir al menos una respuesta')
      return
    }

    setSaving(true)
    try {
      const responsesArray = formData.responses.includes('---') 
        ? formData.responses.split('---').map(r => r.trim()).filter(r => r)
        : [formData.responses.trim()].filter(r => r)

      if (responsesArray.length === 0) {
        alert('⚠️ Debes escribir al menos una respuesta válida')
        setSaving(false)
        return
      }

      const createFunction = httpsCallable(functions, 'chatbotCreateIntent')
      await createFunction({
        tenantId: TENANT_ID,
        intentData: {
          intent: formData.intent,
          priority: formData.priority,
          keywords: formData.keywords.split(',').map(k => k.trim()),
          responses: responsesArray,
          followUpKeywords: formData.followUpKeywords ? formData.followUpKeywords.split(',').map(k => k.trim()).filter(k => k) : [],
          followUpResponses: formData.followUpResponses 
            ? (formData.followUpResponses.includes('---')
                ? formData.followUpResponses.split('---').map(r => r.trim()).filter(r => r)
                : [formData.followUpResponses.trim()].filter(r => r))
            : []
        }
      })

      await loadIntents()
      
      // Si fue creado desde una pregunta sin respuesta, marcarla como respondida
      if (selectedQuestion) {
        try {
          await handleUpdateQuestionStatus(selectedQuestion.id, 'answered')
          await loadUnansweredQuestions(questionFilter === 'all' ? undefined : questionFilter)
          await loadQuestionStats()
          setSelectedQuestion(null)
        } catch (error) {
          console.error('Error marcando pregunta como respondida:', error)
          alert('⚠️ Intent creado pero hubo un error al actualizar el estado de la pregunta')
        }
      }
      
      setShowForm(false)
      resetForm()
      alert('✅ Intent creado exitosamente' + (selectedQuestion ? ' y pregunta marcada como respondida' : ''))
    } catch (error: any) {
      console.error('Error creando intent:', error)
      const errorMessage = error.message || 'Error desconocido'
      alert('❌ Error al crear intent: ' + errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdateIntent = async () => {
    if (!editingIntent) return

    // Validación adicional antes de enviar
    if (!formData.responses.trim()) {
      alert('⚠️ Debes escribir al menos una respuesta')
      return
    }

    setSaving(true)
    try {
      const responsesArray = formData.responses.includes('---') 
        ? formData.responses.split('---').map(r => r.trim()).filter(r => r)
        : [formData.responses.trim()].filter(r => r)

      if (responsesArray.length === 0) {
        alert('⚠️ Debes escribir al menos una respuesta válida')
        setSaving(false)
        return
      }

      const updateFunction = httpsCallable(functions, 'chatbotUpdateIntent')
      await updateFunction({
        tenantId: TENANT_ID,
        intentId: editingIntent.id,
        updates: {
          intent: formData.intent,
          priority: formData.priority,
          keywords: formData.keywords.split(',').map(k => k.trim()).filter(k => k),
          responses: responsesArray,
          followUpKeywords: formData.followUpKeywords ? formData.followUpKeywords.split(',').map(k => k.trim()).filter(k => k) : [],
          followUpResponses: formData.followUpResponses 
            ? (formData.followUpResponses.includes('---')
                ? formData.followUpResponses.split('---').map(r => r.trim()).filter(r => r)
                : [formData.followUpResponses.trim()].filter(r => r))
            : []
        }
      })

      await loadIntents()
      setShowForm(false)
      resetForm()
      alert('✅ Intent actualizado exitosamente')
    } catch (error: any) {
      console.error('Error actualizando intent:', error)
      const errorMessage = error.message || 'Error desconocido'
      alert('❌ Error al actualizar intent: ' + errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteIntent = async (intentId: string) => {
    if (!confirm('¿Estás seguro de eliminar este intent?')) return

    try {
      const deleteFunction = httpsCallable(functions, 'chatbotDeleteIntent')
      await deleteFunction({ tenantId: TENANT_ID, intentId })
      await loadIntents()
      alert('Intent eliminado')
    } catch (error: any) {
      alert('Error: ' + error.message)
    }
  }

  const handleToggleEnabled = async () => {
    setToggling(true)
    try {
      const updateFunction = httpsCallable(functions, 'chatbotUpdateConfig')
      await updateFunction({
        tenantId: TENANT_ID,
        config: { enabled: !config.enabled }
      })
      await loadConfig()
    } catch (error: any) {
      alert('Error: ' + error.message)
    } finally {
      setToggling(false)
    }
  }

  const resetForm = () => {
    setFormData({
      intent: '',
      priority: 1,
      keywords: '',
      responses: '',
      followUpKeywords: '',
      followUpResponses: ''
    })
    setEditingIntent(null)
    setSelectedQuestion(null)
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <p>Cargando...</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Gestión de Chatbot</h1>
        <p className="text-gray-600">Configura respuestas automáticas y visualiza métricas</p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('intents')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'intents'
              ? 'text-pink-600 border-b-2 border-pink-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <MessageCircle className="w-4 h-4 inline mr-2" />
          Intents
        </button>
        <button
          onClick={() => setActiveTab('metrics')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'metrics'
              ? 'text-pink-600 border-b-2 border-pink-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <BarChart3 className="w-4 h-4 inline mr-2" />
          Métricas
        </button>
        <button
          onClick={() => {
            setActiveTab('questions')
            loadUnansweredQuestions(questionFilter === 'all' ? undefined : questionFilter)
            loadQuestionStats()
          }}
          className={`px-4 py-2 font-medium ${
            activeTab === 'questions'
              ? 'text-pink-600 border-b-2 border-pink-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <HelpCircle className="w-4 h-4 inline mr-2" />
          Preguntas ({questionStats.pending || 0})
        </button>
        <button
          onClick={() => setActiveTab('config')}
          className={`px-4 py-2 font-medium ${
            activeTab === 'config'
              ? 'text-pink-600 border-b-2 border-pink-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <Settings className="w-4 h-4 inline mr-2" />
          Configuración
        </button>
      </div>

      {/* Intents Tab */}
      {activeTab === 'intents' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Intenciones ({intents.length})</h2>
            <Button onClick={() => setShowForm(true)} className="bg-pink-500 hover:bg-pink-600">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Intent
            </Button>
          </div>

          {/* Lista de Intents */}
          <div className="space-y-4">
            {intents.map((intent) => (
              <div key={intent.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-100">{intent.intent}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Prioridad: {intent.priority} | Keywords: {intent.keywords.join(', ')}
                    </p>
                    <div className="mt-2">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Respuestas:</p>
                      <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside">
                        {intent.responses.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleEditIntent(intent)}
                      className="hover:bg-blue-50 dark:hover:bg-blue-900"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteIntent(intent.id)}
                      className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {intents.length === 0 && (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No hay intents configurados. Crea uno para empezar.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Metrics Tab */}
      {activeTab === 'metrics' && metrics && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
              <h3 className="text-sm font-medium text-gray-600">Total Mensajes</h3>
              <p className="text-3xl font-bold text-pink-600 mt-2">{metrics.totalMessages || 0}</p>
            </div>
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
              <h3 className="text-sm font-medium text-gray-600">Total Sesiones</h3>
              <p className="text-3xl font-bold text-pink-600 mt-2">{metrics.totalSessions || 0}</p>
            </div>
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
              <h3 className="text-sm font-medium text-gray-600">Sesiones Activas</h3>
              <p className="text-3xl font-bold text-pink-600 mt-2">{metrics.activeSessions || 0}</p>
            </div>
          </div>

          {/* Top Intents */}
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <h3 className="font-semibold text-lg mb-4">Top 5 Intenciones</h3>
            <div className="space-y-2">
              {metrics.topIntents?.map((item: any, index: number) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-gray-700">{item.intent}</span>
                  <span className="font-semibold text-pink-600">{item.count}</span>
                </div>
              ))}
              {(!metrics.topIntents || metrics.topIntents.length === 0) && (
                <p className="text-gray-500">No hay datos aún</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Config Tab */}
      {activeTab === 'config' && (
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm max-w-2xl">
          <h2 className="text-xl font-semibold mb-4">Configuración del Chatbot</h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Estado del Chatbot</h3>
                <p className="text-sm text-gray-600">Activar o desactivar el chatbot para los clientes</p>
              </div>
              <Button
                onClick={handleToggleEnabled}
                className={config.enabled ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-400 hover:bg-gray-500'}
                disabled={toggling}
              >
                {toggling ? 'Actualizando...' : (config.enabled ? 'Activo' : 'Inactivo')}
              </Button>
            </div>

            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-700">
                <strong>Mensaje fallback:</strong> {config.fallbackMessage || 'No configurado'}
              </p>
              <p className="text-sm text-gray-700 mt-2">
                <strong>Tiempo sesión inactiva:</strong> {config.maxSessionIdleMinutes} minutos
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Questions Tab */}
      {activeTab === 'questions' && (
        <div>
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Preguntas Sin Respuesta</h2>
            <p className="text-sm text-gray-600 mb-4">Revisa las preguntas que el chatbot no pudo responder para mejorar los intents</p>
            
            {/* Banner de ayuda colapsable */}
            <div className="border border-pink-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setHelpBannerOpen(!helpBannerOpen)}
                className="w-full p-3 bg-gradient-to-r from-pink-50 to-purple-50 flex items-center justify-between hover:from-pink-100 hover:to-purple-100 transition-colors"
              >
                <h3 className="text-sm font-semibold text-pink-900 flex items-center gap-2">
                  💡 ¿Cómo crear respuestas?
                </h3>
                {helpBannerOpen ? (
                  <ChevronUp className="w-4 h-4 text-pink-700" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-pink-700" />
                )}
              </button>
              {helpBannerOpen && (
                <div className="p-4 bg-gradient-to-r from-pink-50 to-purple-50 border-t border-pink-200">
                  <ol className="text-xs text-pink-800 space-y-1 list-decimal list-inside">
                    <li>Haz clic en <strong>"Crear Respuesta"</strong> en la pregunta que quieras responder</li>
                    <li>Se abrirá el formulario con keywords sugeridos automáticamente</li>
                    <li>Escribe las respuestas que el chatbot debe dar (usa <strong>---</strong> para separar respuestas alternativas)</li>
                    <li>Ajusta los keywords y prioridad si es necesario</li>
                    <li>Guarda el intent - la pregunta se marcará automáticamente como "Respondida" ✅</li>
                  </ol>
                </div>
              )}
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-800">{questionStats.total}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-yellow-200 shadow-sm bg-yellow-50">
              <p className="text-sm text-gray-600">Pendientes</p>
              <p className="text-2xl font-bold text-yellow-600">{questionStats.pending}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-blue-200 shadow-sm bg-blue-50">
              <p className="text-sm text-gray-600">Revisadas</p>
              <p className="text-2xl font-bold text-blue-600">{questionStats.reviewed}</p>
            </div>
            <div className="bg-white p-4 rounded-lg border border-green-200 shadow-sm bg-green-50">
              <p className="text-sm text-gray-600">Respondidas</p>
              <p className="text-2xl font-bold text-green-600">{questionStats.answered}</p>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex space-x-2 mb-4">
            {['all', 'pending', 'reviewed', 'answered'].map((filter) => (
              <button
                key={filter}
                onClick={() => {
                  setQuestionFilter(filter as any)
                  loadUnansweredQuestions(filter === 'all' ? undefined : filter)
                }}
                className={`px-3 py-1 rounded-lg text-sm font-medium ${
                  questionFilter === filter
                    ? 'bg-pink-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {filter === 'all' ? 'Todas' : filter === 'pending' ? 'Pendientes' : filter === 'reviewed' ? 'Revisadas' : 'Respondidas'}
              </button>
            ))}
          </div>

          {/* Questions List */}
          <div className="space-y-3">
            {unansweredQuestions.map((question) => (
              <div key={question.id} className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <p className="font-medium text-gray-800 mb-2 text-lg">{question.userMessage}</p>
                    <div className="flex items-center space-x-3 text-xs text-gray-500">
                      <span>📅 {new Date(question.timestamp).toLocaleString('es-CL')}</span>
                      {question.isQuestion && <span className="text-blue-600">❓ Pregunta</span>}
                      {question.attemptedKeywords && question.attemptedKeywords.length > 0 && (
                        <span>🔑 {question.attemptedKeywords.join(', ')}</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                      question.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      question.status === 'reviewed' ? 'bg-blue-100 text-blue-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {question.status === 'pending' ? 'Pendiente' : question.status === 'reviewed' ? 'Revisada' : 'Respondida'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div className="flex space-x-2">
                    {/* Botón principal: Crear Respuesta */}
                    <Button
                      size="sm"
                      onClick={() => handleCreateIntentFromQuestion(question)}
                      className="bg-pink-500 hover:bg-pink-600 text-white"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Crear Respuesta
                    </Button>
                  </div>

                  <div className="flex space-x-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateQuestionStatus(question.id, 'pending')}
                      disabled={question.status === 'pending'}
                      className="text-yellow-600 hover:bg-yellow-50"
                      title="Marcar como pendiente"
                    >
                      <Clock className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateQuestionStatus(question.id, 'reviewed')}
                      disabled={question.status === 'reviewed'}
                      className="text-blue-600 hover:bg-blue-50"
                      title="Marcar como revisada"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateQuestionStatus(question.id, 'answered')}
                      disabled={question.status === 'answered'}
                      className="text-green-600 hover:bg-green-50"
                      title="Marcar como respondida"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}

            {unansweredQuestions.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <HelpCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No hay preguntas sin respuesta en esta categoría.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal para crear intent */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">
              {editingIntent ? 'Editar Intent' : 'Nuevo Intent'}
            </h2>

            {/* Banner informativo si fue creado desde una pregunta */}
            {selectedQuestion && !editingIntent && (
              <div className="mb-4 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-lg">
                <div className="flex items-start">
                  <HelpCircle className="w-5 h-5 text-blue-600 mr-2 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900 mb-1">
                      📝 Creando respuesta para la pregunta:
                    </p>
                    <p className="text-sm text-blue-700 italic mb-3 bg-white px-2 py-1 rounded">
                      "{selectedQuestion.userMessage}"
                    </p>
                    <div className="bg-yellow-50 border-l-3 border-yellow-400 p-2 rounded">
                      <p className="text-xs font-semibold text-yellow-900 mb-1">
                        ⚠️ IMPORTANTE: Debes escribir la respuesta
                      </p>
                      <p className="text-xs text-yellow-800">
                        Los keywords ya están sugeridos. <strong>Escribe la respuesta que el chatbot debe dar</strong> en el campo "Respuestas" más abajo, luego guarda.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del Intent *
                </label>
                <input
                  type="text"
                  value={formData.intent}
                  onChange={(e) => setFormData({ ...formData, intent: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="delivery, horario, precios, etc."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prioridad (1-100) *
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Keywords (separadas por coma) *
                </label>
                <input
                  type="text"
                  value={formData.keywords}
                  onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="delivery, envío, reparto"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Respuestas (usa --- para separar alternativas) *
                  {selectedQuestion && !formData.responses.trim() && (
                    <span className="ml-2 text-xs font-semibold text-red-600">
                      ⚠️ Campo obligatorio - Debes escribir la respuesta aquí
                    </span>
                  )}
                </label>
                <textarea
                  value={formData.responses}
                  onChange={(e) => setFormData({ ...formData, responses: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg ${
                    selectedQuestion && !formData.responses.trim() 
                      ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-500' 
                      : 'border-gray-300'
                  }`}
                  rows={6}
                  placeholder={selectedQuestion 
                    ? "Escribe aquí la respuesta que el chatbot debe dar a esta pregunta...&#10;&#10;Ejemplo:&#10;Nuestro horario de atención es:&#10;Lunes a Viernes: 11:00 - 23:00&#10;Sábados y Domingos: 12:00 - 00:00"
                    : "Respuesta 1 línea 1&#10;Respuesta 1 línea 2&#10;---&#10;Respuesta alternativa 2"
                  }
                />
                <p className="text-xs text-gray-500 mt-1">Puedes escribir respuestas con múltiples líneas. Usa --- en una línea separada para crear respuestas alternativas.</p>
              </div>

              <div className="flex justify-end space-x-2 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowForm(false)
                    resetForm()
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={editingIntent ? handleUpdateIntent : handleCreateIntent}
                  className="bg-pink-500 hover:bg-pink-600"
                  disabled={!formData.intent || !formData.keywords || !formData.responses.trim() || saving}
                >
                  {saving ? 'Guardando...' : (editingIntent ? 'Actualizar Intent' : 'Guardar Intent')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
