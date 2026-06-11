"use client";

import { useState } from 'react';
import { useCart } from '@/app/context/CartContext';
import { useRouter } from 'next/navigation';
import { usePizzaBuilderData } from '../hooks/usePizzaBuilderData';
import { StepIndicator } from './StepIndicator';
import { OrderSummary } from './OrderSummary';
import { Step1TypeSelector } from './steps/Step1TypeSelector';
import { Step2BaseSelector } from './steps/Step2BaseSelector';
import { Step3MenuSelector } from './steps/Step3MenuSelector';
import { Step4SizeSelector } from './steps/Step4SizeSelector';
import { Step5IngredientsSelector } from './steps/Step5IngredientsSelector';
import { Step6CustomizationOptions } from './steps/Step6CustomizationOptions';
import { DuoBuilder } from './steps/DuoBuilder';

// Mapeo de nombres de pizzas a archivos de imagen
const imageMap: Record<string, string> = {
  'chilena': 'chilena',
  'bariloche': 'bariloche',
  'buenos aires': 'buenos aires',
  'cuyana': 'cuyana',
  '4 estaciones': '4 estaciones',
  'sevillana': 'sevillana',
  'amalfitana': 'amalfitana',
  'del pibe': 'del-pibe.jpg',
  'napolitana': 'napolitana',
  'palermo': 'palermo',
  'capresse': 'capresse',
  'margarita': 'margarita',
  'hawaiana': 'hawaiana',
  'vegetariana': 'vegetariana',
  'porteña': 'porteña',
  'fugazzeta': 'fugazzeta',
  'calabresa': 'calabresa',
  'pepperoni': 'pepperoni',
  'champiñones': 'champiñones',
  'cuatro quesos': 'cuatro-quesos',
  'española': 'española',
  'francesa': 'francesa',
  'italiana': 'italiana',
  'mexicana': 'mexicana',
  'rúcula': 'rucula',
  'atún': 'atun',
  'mariscos': 'mariscos',
  'anchoas': 'anchoas',
  'salmón': 'salmon'
}

// Función auxiliar para obtener la ruta de la imagen correcta
function getPizzaImagePath(imagePath?: string, pizzaName?: string): string {
  // Si ya hay una URL válida de Firebase Storage, usarla directamente
  if (imagePath && imagePath.includes('firebasestorage.googleapis.com')) {
    return imagePath
  }
  
  // Si la imagen no es un placeholder y parece una ruta válida, usarla
  if (imagePath && 
      imagePath !== '/placeholder.svg' && 
      !imagePath.includes('placeholder') &&
      imagePath.startsWith('/')) {
    return imagePath
  }
  
  // Si es un placeholder o no tiene imagen, buscar por nombre de pizza
  if (pizzaName) {
    const cleanName = pizzaName.toLowerCase().trim()
    const mappedName = imageMap[cleanName] || cleanName
    const imagePath = `/pizzas/${encodeURIComponent(mappedName + '.jpg')}`
    return imagePath
  }
  
  // Último recurso: usar fondo genérico
  return "/pizza-promo-bg.png"
}

// Función auxiliar para obtener la ruta de la imagen de bebida/extra correcta
function getExtraImagePath(itemName: string, imagePath?: string): string {
  const lowerName = (itemName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  let bebidaFileName = ''
  
  if (lowerName.includes('lipton') && lowerName.includes('botella')) bebidaFileName = 'lipton_botella.jpg'
  else if (lowerName.includes('lipton') && lowerName.includes('lata')) bebidaFileName = 'lipton_lata.jpg'
  else if (lowerName.includes('coca') && lowerName.includes('1.5') && lowerName.includes('zero')) bebidaFileName = 'coca_cola_1.5_litro_zero.jpg'
  else if (lowerName.includes('coca') && lowerName.includes('1.5')) bebidaFileName = 'coca_cola_1.5_litro.jpg'
  else if (lowerName.includes('coca') && lowerName.includes('lata') && lowerName.includes('zero')) bebidaFileName = 'coca_cola_lata_zero.jpg'
  else if (lowerName.includes('coca') && lowerName.includes('lata')) bebidaFileName = 'coca_cola_lata.jpg'
  
  if (bebidaFileName) {
    const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'pizzeria-palermo-test-20260401.appspot.com'
    return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/bebidas%2F${encodeURIComponent(bebidaFileName)}?alt=media`
  }

  let acompFileName = ''
  if (lowerName.includes('canela') || lowerName.includes('rollito')) acompFileName = 'canela.jpg'
  else if (lowerName.includes('gauchito')) acompFileName = 'gauchitos.jpg'
  else if (lowerName.includes('salsa') && lowerName.includes('bbq')) acompFileName = 'salsa_bbq.jpg'
  else if (lowerName.includes('salsa') && lowerName.includes('chimichurri')) acompFileName = 'salsa_chimichurri.jpg'
  else if (lowerName.includes('salsa') && lowerName.includes('ajo')) acompFileName = 'salsa_de_ajo.jpg'
  else if (lowerName.includes('salsa') && lowerName.includes('pesto')) acompFileName = 'salsa_pesto.jpg'

  if (acompFileName) {
    const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'pizzeria-palermo-test-20260401.appspot.com'
    return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/acompa%C3%B1amientos%2F${encodeURIComponent(acompFileName)}?alt=media`
  }

  if (!imagePath) return "/placeholder.svg?height=200&width=200"
  if (imagePath.startsWith('http')) return imagePath
  if (!imagePath.startsWith('/')) return `/pizzas/${encodeURIComponent(imagePath)}`
  
  const parts = imagePath.split('/')
  const fileName = parts.pop() || ''
  return [...parts, encodeURIComponent(fileName)].join('/')
}

export interface PizzaConfig {
  type: 'normal' | 'duo' | null;
  baseType: 'menu' | 'custom' | null;
  variety: string | null;
  size: 'mediana' | 'familiar' | null;
  simpleIngredients: string[];
  premiumIngredients: string[];
  customizations: {
    sinOregano: boolean;
    sinQueso: boolean;
    sinSalsaTomate: boolean;
  };
  // Extras adicionales
  extrasSeleccionados?: {
    salsas: string[];
    bebidas: string[];
    otros: string[];
  };
  // Para pizza DUO
  half1?: {
    baseType: 'menu' | 'custom';
    variety: string | null;
    simpleIngredients: string[];
    premiumIngredients: string[];
  };
  half2?: {
    baseType: 'menu' | 'custom';
    variety: string | null;
    simpleIngredients: string[];
    premiumIngredients: string[];
  };
}

export function PizzaBuilderWizard() {
  const { addItem } = useCart();
  const router = useRouter();
  const { getPreciosSegunTamano, pizzasParaNormal, salsas, bebidas, otrosExtras } = usePizzaBuilderData();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [config, setConfig] = useState<PizzaConfig>({
    type: null,
    baseType: null,
    variety: null,
    size: null,
    simpleIngredients: [],
    premiumIngredients: [],
    customizations: {
      sinOregano: false,
      sinQueso: false,
      sinSalsaTomate: false,
    },
    extrasSeleccionados: {
      salsas: [],
      bebidas: [],
      otros: [],
    },
  });

  const totalSteps = config.type === 'duo' ? 3 : 6;

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const updateConfig = (updates: Partial<PizzaConfig>) => {
    setConfig((prev) => ({
      ...prev,
      ...updates,
      // Preservar customizations y extrasSeleccionados si no se actualizan
      customizations: updates.customizations || prev.customizations,
      extrasSeleccionados: updates.extrasSeleccionados || prev.extrasSeleccionados,
    }));
  };

  // Función para agregar al carrito (disponible en Step 6)
  const handleAddToCart = () => {
    try {
      console.log("🎯 [NUEVA - handleAddToCart] Iniciando...");
      console.log("🎯 config.baseType:", config.baseType);
      console.log("🎯 config.variety:", config.variety);
      console.log("🎯 config.size:", config.size);
      
      // Calcular precio solo de la pizza (sin extras)
      const pizzaPrice = calculatePizzaOnlyPrice();
      const pizzaName = config.baseType === 'menu' && config.variety 
        ? `Pizza ${config.variety}` 
        : 'Pizza Personalizada';

      // Determinar imagen según si es del menú o personalizada
      const pizzaImage = (() => {
        console.log("🍕 [NUEVA - IMAGEN] Determinando imagen...");
        
        if (config.baseType === 'menu' && config.variety) {
          // Pizza del menú - buscar imagen real
          const pizzaDelMenu = pizzasParaNormal.find(p => p.nombre === config.variety);
          console.log("🍕 [NUEVA] Pizza encontrada:", pizzaDelMenu?.nombre);
          console.log("🍕 [NUEVA] Imagen disponible:", pizzaDelMenu?.imagen);
          
          if (pizzaDelMenu && pizzaDelMenu.imagen) {
            const finalPath = getPizzaImagePath(pizzaDelMenu.imagen, pizzaDelMenu.nombre);
            console.log("🍕 [NUEVA] Path final generado:", finalPath);
            return finalPath;
          } else if (pizzaDelMenu) {
            // Pizza encontrada pero sin imagen - usar nombre para buscar
            console.log("⚠️ [NUEVA] Pizza sin imagen, buscando por nombre");
            const finalPath = getPizzaImagePath(undefined, pizzaDelMenu.nombre);
            console.log("🍕 [NUEVA] Path fallback por nombre:", finalPath);
            return finalPath;
          } else {
            // Pizza no encontrada - buscar directamente por variety
            console.log("⚠️ [NUEVA] Pizza no encontrada, usando variety");
            const finalPath = getPizzaImagePath(undefined, config.variety);
            console.log("🍕 [NUEVA] Path fallback directo:", finalPath);
            return finalPath;
          }
        }
        
        // Si es personalizada, usar imagen genérica
        const genericPath = "/pizza-premium-bg.png";
        console.log("🍕 [NUEVA] Usando imagen genérica:", genericPath);
        return genericPath;
      })();

      // 1. Agregar la pizza al carrito
      const pizzaTypeValue: 'premium' = 'premium';
      const cartItem = {
        id: `pizza-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: pizzaName,
        price: pizzaPrice,
        image: pizzaImage,
        quantity: 1,
        size: (config.size || 'mediana') as string,
        selectedMenuPizza: config.baseType === 'menu' ? config.variety : null,
        ingredients: config.simpleIngredients,
        premiumIngredients: config.premiumIngredients,
        pizzaType: pizzaTypeValue,
        sinOregano: config.customizations.sinOregano,
        sinQueso: config.customizations.sinQueso,
        sinSalsaTomate: config.customizations.sinSalsaTomate,
      };
      
      console.log("🛒 [NUEVA - CARRITO] Item a agregar:");
      console.table({
        name: cartItem.name,
        image: cartItem.image,
        price: cartItem.price,
        size: cartItem.size,
        selectedMenuPizza: cartItem.selectedMenuPizza
      });
      
      addItem(cartItem);

      // 2. Agregar salsas seleccionadas al carrito
      config.extrasSeleccionados?.salsas?.forEach(salsaId => {
        const salsa = salsas.find(s => s.id === salsaId);
        if (salsa) {
          addItem({
            id: `salsa-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: salsa.nombre,
            price: salsa.precio,
            image: getExtraImagePath(salsa.nombre, salsa.imagen),
            quantity: 1,
          });
        }
      });

      // 3. Agregar bebidas seleccionadas al carrito
      config.extrasSeleccionados?.bebidas?.forEach(bebidaId => {
        let bebida = bebidas.find(b => b.id === bebidaId);
        let displayName: string | null = null;
        if (!bebida) {
          const m = String(bebidaId).match(/^(.*)-(familiar|mediana)$/);
          if (m) {
            const baseId = m[1];
            const variant = m[2];
            bebida = bebidas.find(b => b.id === baseId);
            if (bebida) {
              displayName = variant === 'familiar' ? `${bebida.nombre} Tradicional` : `${bebida.nombre} Zero`;
            }
          }
        }
        if (bebida) {
          addItem({
            id: `bebida-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: displayName || bebida.nombre,
            price: bebida.precio,
            image: getExtraImagePath(displayName || bebida.nombre, bebida.imagen),
            quantity: 1,
          });
        }
      });

      // 4. Agregar otros extras seleccionados al carrito
      config.extrasSeleccionados?.otros?.forEach(extraId => {
        const extra = otrosExtras.find(e => e.id === extraId);
        if (extra) {
          addItem({
            id: `extra-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: extra.nombre,
            price: extra.precio,
            image: getExtraImagePath(extra.nombre, extra.imagen),
            quantity: 1,
          });
        }
      });

      // Redirigir al home
      router.push('/');
    } catch (error) {
      console.error('Error al agregar al carrito:', error);
      alert('Hubo un error al agregar al carrito. Por favor intenta de nuevo.');
    }
  };

  // Calcular precio solo de la pizza (sin extras)
  const calculatePizzaOnlyPrice = () => {
    if (!config.size) return 0;

    const tamano = config.size as 'mediana' | 'familiar';
    const precios = getPreciosSegunTamano(tamano);
    let total = 0;

    if (config.baseType === 'custom') {
      total = precios.baseCustom;
    } else if (config.variety) {
      const pizzaEncontrada = pizzasParaNormal.find(p => p.nombre === config.variety);
      if (pizzaEncontrada) {
        total = tamano === 'mediana' ? pizzaEncontrada.precioMediana : pizzaEncontrada.precio;
      } else {
        total = precios.baseMenu;
      }
    }

    total += config.simpleIngredients.length * precios.simple;
    total += config.premiumIngredients.length * precios.premium;

    return total;
  };

  const renderStep = () => {
    // Flujo DUO
    if (config.type === 'duo') {
      switch (currentStep) {
        case 1:
          return (
            <Step1TypeSelector
              selected={config.type}
              onSelect={(type) => {
                updateConfig({ type });
                handleNext();
              }}
            />
          );
        case 2:
          return (
            <Step4SizeSelector
              selected={config.size}
              onSelect={(size) => {
                updateConfig({ size });
                handleNext();
              }}
              onBack={handleBack}
              variety={null}
              baseType={null}
              isDuo={true}
            />
          );
        case 3:
          return (
            <DuoBuilder
              config={config}
              onUpdate={updateConfig}
              onBack={handleBack}
            />
          );
        default:
          return null;
      }
    }

    // Flujo NORMAL
    switch (currentStep) {
      case 1:
        return (
          <Step1TypeSelector
            selected={config.type}
            onSelect={(type) => {
              updateConfig({ type });
              handleNext();
            }}
          />
        );
      case 2:
        return (
          <Step2BaseSelector
            selected={config.baseType}
            onSelect={(baseType) => {
              updateConfig({ baseType });
              handleNext();
            }}
            onBack={handleBack}
          />
        );
      case 3:
        if (config.baseType === 'menu') {
          return (
            <Step3MenuSelector
              selected={config.variety}
              onSelect={(variety) => {
                updateConfig({ variety });
                handleNext();
              }}
              onBack={handleBack}
              isDuo={false}
            />
          );
        } else {
          // Si es custom, saltamos directo a tamaño
          return (
            <Step4SizeSelector
              selected={config.size}
              onSelect={(size) => {
                updateConfig({ size });
                handleNext();
              }}
              onBack={handleBack}
              variety={null}
              baseType={config.baseType}
              isDuo={false}
            />
          );
        }
      case 4:
        return (
          <Step4SizeSelector
            selected={config.size}
            onSelect={(size) => {
              updateConfig({ size });
              handleNext();
            }}
            onBack={handleBack}
            variety={config.variety}
            baseType={config.baseType}
            isDuo={false}
          />
        );
      case 5:
        return (
          <Step5IngredientsSelector
            config={config}
            onUpdate={updateConfig}
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 6:
        return (
          <Step6CustomizationOptions
            config={config}
            onUpdate={updateConfig}
            onBack={handleBack}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Columna principal - Wizard */}
        <div className="lg:col-span-2">
          {/* Indicador de pasos */}
          <div className="mb-8">
            <StepIndicator
              currentStep={currentStep}
              totalSteps={totalSteps}
              pizzaType={config.type}
            />
          </div>

          {/* Contenedor del paso actual con animación */}
          <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 min-h-[500px] transition-all duration-300">
            {renderStep()}
          </div>
        </div>

        {/* Sidebar - Resumen del pedido */}
        <div className="lg:col-span-1">
          <div className="sticky top-8">
            <OrderSummary 
              config={config} 
              onAddToCart={currentStep === 6 ? handleAddToCart : undefined}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
