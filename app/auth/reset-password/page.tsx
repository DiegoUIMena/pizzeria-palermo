"use client"

import { useState } from "react"
import Link from "next/link"
import { sendPasswordResetEmail } from "firebase/auth"
import { ArrowLeft, Mail, CheckCircle2 } from "lucide-react"
import Header from "@/app/components/Header"
import Footer from "@/app/components/Footer"
import { auth } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isSent, setIsSent] = useState(false)
  const [error, setError] = useState("")

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault()
    setError("")
    setIsSending(true)

    try {
      await sendPasswordResetEmail(auth, email)
      setIsSent(true)
    } catch (err: any) {
      setError(getResetErrorMessage(err?.code))
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-black">
      <Header />

      <main className="container mx-auto px-4 py-12">
        <div className="mx-auto w-full max-w-md">
          <Card className="border-pink-400">
            <CardHeader className="bg-gradient-to-r from-pink-400 to-pink-500 text-white">
              <Link href="/auth" className="mb-4 flex items-center text-white hover:text-pink-200">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver a inicio de sesion
              </Link>
              <CardTitle className="text-2xl font-bold">Recuperar contraseña</CardTitle>
              <CardDescription className="text-pink-100">
                Sigue estos pasos para recuperar el acceso a tu cuenta.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6 pt-6">
              <ol className="space-y-3 rounded-lg border border-pink-200 bg-pink-50 p-4 text-sm text-gray-700">
                <li>1. Ingresa el correo con el que creaste tu cuenta.</li>
                <li>2. Presiona el boton Enviar enlace.</li>
                <li>3. Revisa tu bandeja de entrada y tambien Spam/No deseado.</li>
                <li>4. Abre el enlace del correo y crea una nueva contraseña.</li>
              </ol>

              {isSent ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">
                    <div className="mb-2 flex items-center gap-2 font-semibold">
                      <CheckCircle2 className="h-5 w-5" />
                      Correo enviado correctamente
                    </div>
                    <p className="text-sm">
                      Si el correo existe en nuestro sistema, te enviamos un enlace para restablecer la contraseña.
                    </p>
                  </div>

                  <Button
                    type="button"
                    className="w-full bg-pink-500 text-white hover:bg-pink-600"
                    onClick={() => {
                      setIsSent(false)
                      setEmail("")
                      setError("")
                    }}
                  >
                    Enviar a otro correo
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Correo electrónico</Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="tu@email.com"
                        className="pl-10"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={isSending}
                    className="w-full bg-pink-500 text-white hover:bg-pink-600"
                  >
                    {isSending ? "Enviando..." : "Enviar enlace"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  )
}

function getResetErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case "auth/invalid-email":
      return "El correo ingresado no es valido"
    case "auth/user-not-found":
      return "No existe una cuenta registrada con ese correo"
    case "auth/too-many-requests":
      return "Demasiados intentos. Intenta nuevamente en unos minutos"
    case "auth/network-request-failed":
      return "Error de red. Revisa tu conexion e intenta otra vez"
    default:
      return "No se pudo enviar el enlace de recuperacion"
  }
}
