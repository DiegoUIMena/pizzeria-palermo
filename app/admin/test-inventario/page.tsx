"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle, RefreshCw } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, updateDoc, query, where, orderBy } from "firebase/firestore";
import { Ingredient } from "@/lib/inventory";
import { validateInventoryForOrder, consumeInventoryForOrder, invalidateCache } from "@/lib/inventory-service";
import { consumeRecipeForOrder, isItemAvailable } from "@/lib/recipes";

export default function TestInventario() {
  const [ingredientes, setIngredientes] = useState<Ingredient[]>([]);
  const [loadingIngredientes, setLoadingIngredientes] = useState(true);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<"idle" | "success" | "error" | "loading">("idle");
  const [lastTestType, setLastTestType] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string>("");

  // Cargar ingredientes
  useEffect(() => {
    const fetchIngredientes = async () => {
      setLoadingIngredientes(true);
      try {
        const q = query(collection(db, "ingredientes"), orderBy("nombre"));
        const snapshot = await getDocs(q);
        const items: Ingredient[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          items.push({
            id: doc.id,
            nombre: data.nombre || "",
            categoria: data.categoria || "",
            stockActual: data.stockActual || 0,
            stockMinimo: data.stockMinimo || 0,
            stockMaximo: data.stockMaximo || 0,
            unidad: data.unidad || "",
            precioUnitario: data.precioUnitario || 0,
            proveedor: data.proveedor || "",
            fechaVencimiento: data.fechaVencimiento,
            estado: data.estado || "Disponible",
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          });
        });
        setIngredientes(items);
      } catch (error) {
        console.error("Error al cargar ingredientes:", error);
        toast({
          title: "Error",
          description: "No se pudieron cargar los ingredientes",
          variant: "destructive",
        });
      } finally {
        setLoadingIngredientes(false);
      }
    };

    fetchIngredientes();
  }, []);

  // Actualizar un ingrediente para testing
  const updateIngrediente = async (id: string, stockActual: number) => {
    try {
      const docRef = doc(db, "ingredientes", id);
      await updateDoc(docRef, {
        stockActual,
        updatedAt: new Date().toISOString(),
      });
      toast({
        title: "Éxito",
        description: `Stock actualizado a ${stockActual}`,
      });
      
      // Actualizar la lista local
      setIngredientes(prev => 
        prev.map(ing => 
          ing.id === id ? { ...ing, stockActual } : ing
        )
      );
      
      // Invalidar caché para asegurar que los tests usen datos frescos
      invalidateCache();
      
    } catch (error) {
      console.error("Error al actualizar ingrediente:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el ingrediente",
        variant: "destructive",
      });
    }
  };

  // Probar validación con ingredientes suficientes
  const testValidacionSuccess = async () => {
    setTestStatus("loading");
    setLastTestType("validación con stock suficiente");
    
    try {
      // Verificar que tenemos al menos un ingrediente con stock > 10
      const ingredienteConStock = ingredientes.find(ing => ing.stockActual >= 10);
      
      if (!ingredienteConStock) {
        throw new Error("No hay ningún ingrediente con stock suficiente para esta prueba");
      }

      // Crear una orden de prueba que use ese ingrediente
      const orderItems = [
        {
          nombre: "Pizza Prueba",
          cantidad: 1,
          precio: 10000,
          ingredients: [`${ingredienteConStock.nombre} (2)`], // usar 2 unidades
        }
      ];

      // Validar inventario
      const validationResult = await validateInventoryForOrder(orderItems);
      
      if (validationResult.success) {
        setTestResult(`Validación exitosa: El sistema confirma que hay suficiente stock de ${ingredienteConStock.nombre}`);
        setTestStatus("success");
        setMensaje(`Ingrediente usado: ${ingredienteConStock.nombre}, Stock actual: ${ingredienteConStock.stockActual}, Cantidad requerida: 2`);
      } else {
        setTestResult(`Error inesperado: La validación falló a pesar de tener stock suficiente`);
        setTestStatus("error");
        setMensaje(JSON.stringify(validationResult));
      }
    } catch (error) {
      console.error("Error en test de validación:", error);
      setTestResult(`Error: ${error instanceof Error ? error.message : String(error)}`);
      setTestStatus("error");
    }
  };

  // Probar validación con inventario insuficiente
  const testValidacionError = async () => {
    setTestStatus("loading");
    setLastTestType("validación con stock insuficiente");
    
    try {
      // Buscar un ingrediente con poco stock
      const ingredientePrueba = ingredientes.find(ing => ing.stockActual > 0);
      
      if (!ingredientePrueba) {
        throw new Error("No hay ningún ingrediente con stock para esta prueba");
      }

      // Crear una orden que pida más de lo disponible
      const orderItems = [
        {
          nombre: "Pizza Prueba",
          cantidad: 1,
          precio: 10000,
          ingredients: [`${ingredientePrueba.nombre} (${ingredientePrueba.stockActual + 10})`], // pedir más de lo disponible
        }
      ];

      // Validar inventario
      const validationResult = await validateInventoryForOrder(orderItems);
      
      if (!validationResult.success) {
        setTestResult(`Prueba exitosa: El sistema detectó correctamente que no hay suficiente stock de ${ingredientePrueba.nombre}`);
        setTestStatus("success");
        setMensaje(`Ingrediente: ${ingredientePrueba.nombre}, Stock actual: ${ingredientePrueba.stockActual}, Cantidad requerida: ${ingredientePrueba.stockActual + 10}`);
      } else {
        setTestResult(`Error: La validación debería haber fallado pero no lo hizo`);
        setTestStatus("error");
        setMensaje(JSON.stringify(validationResult));
      }
    } catch (error) {
      console.error("Error en test de validación:", error);
      setTestResult(`Error: ${error instanceof Error ? error.message : String(error)}`);
      setTestStatus("error");
    }
  };

  // Probar consumo de inventario
  const testConsumoInventario = async () => {
    setTestStatus("loading");
    setLastTestType("consumo de inventario");
    
    try {
      // Buscar un ingrediente con stock suficiente
      const ingredientePrueba = ingredientes.find(ing => ing.stockActual >= 5);
      
      if (!ingredientePrueba) {
        throw new Error("No hay ningún ingrediente con stock suficiente para esta prueba");
      }
      
      const stockInicial = ingredientePrueba.stockActual;
      const cantidadAConsumir = 2;

      // Crear una orden de prueba
      const orderItems = [
        {
          nombre: "Pizza Prueba de Consumo",
          cantidad: 1,
          precio: 10000,
          ingredients: [`${ingredientePrueba.nombre} (${cantidadAConsumir})`],
        }
      ];

      // Consumir inventario
      const consumptionResult = await consumeInventoryForOrder(
        orderItems,
        "test-" + Date.now(), // ID de orden
        Math.floor(Math.random() * 10000) // Número de orden
      );
      
      // Recargar el ingrediente para ver el nuevo stock
      const q = query(collection(db, "ingredientes"), where("nombre", "==", ingredientePrueba.nombre));
      const snapshot = await getDocs(q);
      let stockActualizado = stockInicial;
      
      if (!snapshot.empty) {
        stockActualizado = snapshot.docs[0].data().stockActual;
      }
      
      if (consumptionResult.success && stockActualizado === stockInicial - cantidadAConsumir) {
        setTestResult(`Consumo exitoso: El stock de ${ingredientePrueba.nombre} se redujo correctamente de ${stockInicial} a ${stockActualizado}`);
        setTestStatus("success");
        setMensaje(`TransactionID: ${consumptionResult.transactionId}`);
        
        // Actualizar ingredientes locales
        setIngredientes(prev => 
          prev.map(ing => 
            ing.id === ingredientePrueba.id ? { ...ing, stockActual: stockActualizado } : ing
          )
        );
      } else {
        setTestResult(`Error: El consumo de inventario no actualizó correctamente el stock`);
        setTestStatus("error");
        setMensaje(`Stock inicial: ${stockInicial}, Stock actual: ${stockActualizado}, Resultado: ${JSON.stringify(consumptionResult)}`);
      }
    } catch (error) {
      console.error("Error en test de consumo:", error);
      setTestResult(`Error: ${error instanceof Error ? error.message : String(error)}`);
      setTestStatus("error");
    }
  };

  // Probar las recetas
  const testRecetas = async () => {
    setTestStatus("loading");
    setLastTestType("recetas");
    
    try {
      // Buscar un ingrediente con stock
      const ingredientePrueba = ingredientes.find(ing => ing.stockActual > 0);
      
      if (!ingredientePrueba) {
        throw new Error("No hay ningún ingrediente con stock para esta prueba");
      }
      
      // Crear una receta simple
      const recipe = [
        {
          ingredienteId: ingredientePrueba.id,
          cantidad: Math.min(2, ingredientePrueba.stockActual),
          unidad: ingredientePrueba.unidad
        }
      ];
      
      // Mapear ingredientes por ID para la función isItemAvailable
      const ingredientsById: Record<string, any> = {};
      ingredientes.forEach(ing => {
        ingredientsById[ing.id] = ing;
      });
      
      // Verificar disponibilidad
      const availabilityCheck = isItemAvailable(recipe, ingredientsById);
      
      if (availabilityCheck.available) {
        setTestResult(`Receta disponible: El sistema confirma que hay suficiente stock para la receta`);
        setTestStatus("success");
        setMensaje(`Ingrediente: ${ingredientePrueba.nombre}, Stock: ${ingredientePrueba.stockActual}, Requerido: ${Math.min(2, ingredientePrueba.stockActual)}`);
      } else {
        setTestResult(`Error: La receta debería estar disponible pero el sistema indica que no lo está`);
        setTestStatus("error");
        setMensaje(JSON.stringify(availabilityCheck));
      }
    } catch (error) {
      console.error("Error en test de recetas:", error);
      setTestResult(`Error: ${error instanceof Error ? error.message : String(error)}`);
      setTestStatus("error");
    }
  };

  // Función para recargar ingredientes
  const recargarIngredientes = async () => {
    setLoadingIngredientes(true);
    try {
      const q = query(collection(db, "ingredientes"), orderBy("nombre"));
      const snapshot = await getDocs(q);
      const items: Ingredient[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        items.push({
          id: doc.id,
          nombre: data.nombre || "",
          categoria: data.categoria || "",
          stockActual: data.stockActual || 0,
          stockMinimo: data.stockMinimo || 0,
          stockMaximo: data.stockMaximo || 0,
          unidad: data.unidad || "",
          precioUnitario: data.precioUnitario || 0,
          proveedor: data.proveedor || "",
          fechaVencimiento: data.fechaVencimiento,
          estado: data.estado || "Disponible",
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      });
      setIngredientes(items);
      
      // Invalidar caché
      invalidateCache();
      
      toast({
        title: "Éxito",
        description: "Ingredientes recargados correctamente",
      });
    } catch (error) {
      console.error("Error al recargar ingredientes:", error);
      toast({
        title: "Error",
        description: "No se pudieron recargar los ingredientes",
        variant: "destructive",
      });
    } finally {
      setLoadingIngredientes(false);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Pruebas de Inventario</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Pruebas de Sistema</CardTitle>
            <CardDescription>
              Ejecuta pruebas para verificar el funcionamiento del sistema de inventario
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button 
                onClick={testValidacionSuccess}
                disabled={testStatus === "loading" || loadingIngredientes}
                className="bg-green-600 hover:bg-green-700"
              >
                Probar Validación (Stock Suficiente)
              </Button>
              
              <Button 
                onClick={testValidacionError}
                disabled={testStatus === "loading" || loadingIngredientes}
                className="bg-amber-600 hover:bg-amber-700"
              >
                Probar Validación (Stock Insuficiente)
              </Button>
              
              <Button 
                onClick={testConsumoInventario}
                disabled={testStatus === "loading" || loadingIngredientes}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Probar Consumo de Inventario
              </Button>
              
              <Button 
                onClick={testRecetas}
                disabled={testStatus === "loading" || loadingIngredientes}
                className="bg-purple-600 hover:bg-purple-700"
              >
                Probar Recetas
              </Button>
            </div>
            
            {testStatus !== "idle" && (
              <Card className={`mt-4 ${
                testStatus === "success" ? "bg-green-50 border-green-200" : 
                testStatus === "error" ? "bg-red-50 border-red-200" : 
                "bg-gray-50 border-gray-200"
              }`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center">
                    {testStatus === "success" ? (
                      <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                    ) : testStatus === "error" ? (
                      <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                    ) : (
                      <RefreshCw className="h-5 w-5 text-gray-500 mr-2 animate-spin" />
                    )}
                    <CardTitle className={`text-base ${
                      testStatus === "success" ? "text-green-700" : 
                      testStatus === "error" ? "text-red-700" : 
                      "text-gray-700"
                    }`}>
                      Resultado de la prueba: {lastTestType}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{testResult}</p>
                  {mensaje && (
                    <pre className="mt-2 text-xs bg-black/5 p-2 rounded-md overflow-auto">
                      {mensaje}
                    </pre>
                  )}
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Ingredientes</CardTitle>
            <CardDescription>
              Lista de ingredientes disponibles en el sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="max-h-[600px] overflow-y-auto">
            {loadingIngredientes ? (
              <div className="py-4 text-center">Cargando ingredientes...</div>
            ) : ingredientes.length === 0 ? (
              <div className="py-4 text-center">No hay ingredientes disponibles</div>
            ) : (
              <div className="space-y-4">
                {ingredientes.map((ing) => (
                  <div key={ing.id} className="border rounded-md p-3">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-medium">{ing.nombre}</h3>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        ing.stockActual <= 0 ? "bg-red-100 text-red-800" :
                        ing.stockActual <= ing.stockMinimo ? "bg-amber-100 text-amber-800" :
                        "bg-green-100 text-green-800"
                      }`}>
                        {ing.stockActual <= 0 ? "Agotado" : 
                         ing.stockActual <= ing.stockMinimo ? "Stock Bajo" : 
                         "Disponible"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                      <div>
                        <span className="text-gray-500">Stock actual:</span> {ing.stockActual} {ing.unidad}
                      </div>
                      <div>
                        <span className="text-gray-500">Mínimo:</span> {ing.stockMinimo} {ing.unidad}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Label htmlFor={`stock-${ing.id}`} className="text-xs">Actualizar stock:</Label>
                        <div className="flex gap-2">
                          <Input 
                            id={`stock-${ing.id}`} 
                            type="number" 
                            min="0"
                            defaultValue={ing.stockActual.toString()}
                            className="text-sm"
                          />
                          <Button 
                            size="sm"
                            onClick={() => {
                              const input = document.getElementById(`stock-${ing.id}`) as HTMLInputElement;
                              const newStock = parseInt(input.value);
                              if (!isNaN(newStock) && newStock >= 0) {
                                updateIngrediente(ing.id, newStock);
                              }
                            }}
                          >
                            Guardar
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button 
              onClick={recargarIngredientes}
              disabled={loadingIngredientes}
              variant="outline"
              className="w-full"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loadingIngredientes ? 'animate-spin' : ''}`} />
              Recargar Ingredientes
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}