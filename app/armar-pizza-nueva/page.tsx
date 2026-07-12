"use client";

import { PizzaBuilderWizard } from './components/PizzaBuilderWizard';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function ArmarPizzaNuevaPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="container mx-auto px-4 py-8">
        {/* Cabecera de la sección en contenedor legible */}
        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 mb-8 max-w-3xl mx-auto">
          <div className="text-left mb-4">
            <Link href="/" className="inline-flex items-center text-gray-600 hover:text-pink-600 transition-colors text-sm font-medium">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al inicio
            </Link>
          </div>
          <div className="text-center">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-3">
              Arma tu Pizza Perfecta
            </h1>
            <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto">
              Sigue los pasos para crear tu pizza ideal. ¡Es fácil y rápido!
            </p>
          </div>
        </div>

        {/* Wizard Principal */}
        <PizzaBuilderWizard />
      </main>
      <Footer />
    </div>
  );
}
