"use client";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  pizzaType: 'normal' | 'duo' | null;
}

export function StepIndicator({ currentStep, totalSteps, pizzaType }: StepIndicatorProps) {
  const getStepLabels = () => {
    if (pizzaType === 'duo') {
      return ['Tipo de Pizza', 'Tamaño', 'Configurar Mitad 1', 'Configurar Mitad 2'];
    }
    return ['Tipo', 'Base', 'Variedad/Tamaño', 'Tamaño', 'Ingredientes', 'Personalizar'];
  };

  const labels = getStepLabels();

  return (
    <div className="w-full">
      {/* Progress bar */}
      <div className="relative mb-6">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-500 ease-out"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Step numbers */}
      <div className="flex justify-between items-center">
        {Array.from({ length: totalSteps }).map((_, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber === currentStep;
          const isCompleted = stepNumber < currentStep;

          return (
            <div key={stepNumber} className="flex flex-col items-center flex-1">
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm
                  transition-all duration-300
                  ${isActive ? 'bg-orange-500 text-white scale-110 ring-4 ring-orange-200' : ''}
                  ${isCompleted ? 'bg-green-500 text-white' : ''}
                  ${!isActive && !isCompleted ? 'bg-gray-200 text-gray-500' : ''}
                `}
              >
                {isCompleted ? '✓' : stepNumber}
              </div>
              <span className={`
                mt-2 text-xs font-medium text-center hidden md:block
                ${isActive ? 'text-orange-600' : 'text-gray-500'}
              `}>
                {labels[index]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
