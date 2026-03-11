"use client";

import { PizzaBuilderWizard } from './components/PizzaBuilderWizard';

export default function ArmarPizzaNuevaPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-3">
            🍕 Arma tu Pizza Perfecta
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Sigue los pasos para crear tu pizza ideal. ¡Es fácil y rápido!
          </p>
        </div>

        {/* Wizard Principal */}
        <PizzaBuilderWizard />
      </div>
    </div>
  );
}
