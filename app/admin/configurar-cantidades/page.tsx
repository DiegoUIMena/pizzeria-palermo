"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Save } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Ingrediente {
  id: string;
  nombre: string;
  unidad: string;
  categoria: string;
  cantidadPorPizzaMediana?: number;
  cantidadPorPizzaFamiliar?: number;
}

export default function ConfigurarCantidadesPage() {
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: 'success' | 'error', texto: string } | null>(null);
  const [cambiosPendientes, setCambiosPendientes] = useState<Record<string, { mediana?: number, familiar?: number }>>({});

  useEffect(() => {
    cargarIngredientes();
  }, []);

  const cargarIngredientes = async () => {
    try {
      setLoading(true);
      const snapshot = await getDocs(collection(db, 'ingredientes'));
      const datos: Ingrediente[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data();
        datos.push({
          id: doc.id,
          nombre: data.nombre || doc.id,
          unidad: data.unidad || 'u',
          categoria: data.categoria || 'Otros',
          cantidadPorPizzaMediana: data.cantidadPorPizzaMediana,
          cantidadPorPizzaFamiliar: data.cantidadPorPizzaFamiliar
        });
      });
      
      // Ordenar alfabéticamente
      datos.sort((a, b) => a.nombre.localeCompare(b.nombre));
      setIngredientes(datos);
    } catch (error: any) {
      setMensaje({ tipo: 'error', texto: `Error al cargar ingredientes: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleCantidadChange = (ingredienteId: string, tipo: 'mediana' | 'familiar', valor: string) => {
    const cantidad = valor === '' ? undefined : parseFloat(valor);
    
    setCambiosPendientes(prev => ({
      ...prev,
      [ingredienteId]: {
        ...prev[ingredienteId],
        [tipo]: cantidad
      }
    }));
  };

  const guardarCambios = async () => {
    try {
      setSaving(true);
      setMensaje(null);
      
      const promesas = Object.entries(cambiosPendientes).map(async ([id, cambios]) => {
        const docRef = doc(db, 'ingredientes', id);
        const updateData: any = {};
        
        if (cambios.mediana !== undefined) {
          updateData.cantidadPorPizzaMediana = cambios.mediana;
        }
        
        if (cambios.familiar !== undefined) {
          updateData.cantidadPorPizzaFamiliar = cambios.familiar;
        }
        
        if (Object.keys(updateData).length > 0) {
          await updateDoc(docRef, updateData);
        }
      });
      
      await Promise.all(promesas);
      
      setMensaje({ 
        tipo: 'success', 
        texto: `✅ Se guardaron correctamente las cantidades de ${Object.keys(cambiosPendientes).length} ingrediente(s)` 
      });
      
      setCambiosPendientes({});
      
      // Recargar ingredientes para reflejar los cambios
      await cargarIngredientes();
      
      // Limpiar mensaje después de 5 segundos
      setTimeout(() => setMensaje(null), 5000);
    } catch (error: any) {
      setMensaje({ tipo: 'error', texto: `Error al guardar: ${error.message}` });
    } finally {
      setSaving(false);
    }
  };

  const aplicarCantidadSugerida = (ingredienteId: string, tipo: 'mediana' | 'familiar') => {
    const ingrediente = ingredientes.find(i => i.id === ingredienteId);
    if (!ingrediente) return;
    
    // Cantidades sugeridas basadas en categorías comunes
    const sugerencias: Record<string, { mediana: number, familiar: number }> = {
      'queso': { mediana: 150, familiar: 250 },
      'mozzarella': { mediana: 150, familiar: 250 },
      'salsa': { mediana: 100, familiar: 150 },
      'tomate': { mediana: 100, familiar: 150 },
      'jamon': { mediana: 80, familiar: 120 },
      'jamón': { mediana: 80, familiar: 120 },
      'pepperoni': { mediana: 60, familiar: 100 },
      'champiñon': { mediana: 50, familiar: 80 },
      'champiñones': { mediana: 50, familiar: 80 },
      'pimiento': { mediana: 40, familiar: 60 },
      'aceituna': { mediana: 30, familiar: 50 },
      'aceitunas': { mediana: 30, familiar: 50 },
      'cebolla': { mediana: 40, familiar: 60 },
      'oregano': { mediana: 5, familiar: 10 },
      'orégano': { mediana: 5, familiar: 10 },
      'albahaca': { mediana: 10, familiar: 15 }
    };
    
    // Buscar sugerencia por nombre del ingrediente
    const nombreNormalizado = ingrediente.nombre.toLowerCase();
    let sugerencia = sugerencias[nombreNormalizado];
    
    if (!sugerencia) {
      // Buscar por coincidencia parcial
      const clave = Object.keys(sugerencias).find(k => 
        nombreNormalizado.includes(k) || k.includes(nombreNormalizado)
      );
      
      if (clave) {
        sugerencia = sugerencias[clave];
      } else {
        // Sugerencia por defecto según categoría
        if (ingrediente.categoria?.toLowerCase().includes('queso')) {
          sugerencia = { mediana: 150, familiar: 250 };
        } else if (ingrediente.categoria?.toLowerCase().includes('carne')) {
          sugerencia = { mediana: 80, familiar: 120 };
        } else if (ingrediente.categoria?.toLowerCase().includes('vegetal')) {
          sugerencia = { mediana: 40, familiar: 60 };
        } else {
          sugerencia = { mediana: 50, familiar: 80 };
        }
      }
    }
    
    handleCantidadChange(
      ingredienteId, 
      tipo, 
      sugerencia[tipo].toString()
    );
  };

  const hayPendientes = Object.keys(cambiosPendientes).length > 0;

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <p className="text-center">Cargando ingredientes...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Configurar Cantidades Estándar</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Define cuántos gramos de cada ingrediente se consumen por pizza mediana y familiar cuando los clientes arman sus propias pizzas.
        </p>
      </div>

      {mensaje && (
        <Alert className={`mb-6 ${mensaje.tipo === 'success' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
          {mensaje.tipo === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          )}
          <AlertTitle className={mensaje.tipo === 'success' ? 'text-green-800 dark:text-green-400' : 'text-red-800 dark:text-red-400'}>
            {mensaje.tipo === 'success' ? 'Éxito' : 'Error'}
          </AlertTitle>
          <AlertDescription className={mensaje.tipo === 'success' ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}>
            {mensaje.texto}
          </AlertDescription>
        </Alert>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Guía de Cantidades</CardTitle>
          <CardDescription>
            💡 Las cantidades se expresan en la unidad del ingrediente (generalmente gramos). 
            Por ejemplo, si un ingrediente usa gramos, configura 150 para mediana y 250 para familiar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
              <strong className="text-blue-800 dark:text-blue-300">Quesos:</strong>
              <p className="text-blue-700 dark:text-blue-400 mt-1">Mediana: 150g | Familiar: 250g</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
              <strong className="text-green-800 dark:text-green-300">Carnes:</strong>
              <p className="text-green-700 dark:text-green-400 mt-1">Mediana: 80g | Familiar: 120g</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
              <strong className="text-amber-800 dark:text-amber-300">Vegetales:</strong>
              <p className="text-amber-700 dark:text-amber-400 mt-1">Mediana: 40g | Familiar: 60g</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Ingredientes ({ingredientes.length})</CardTitle>
            <CardDescription>
              {hayPendientes ? (
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  {Object.keys(cambiosPendientes).length} cambio(s) pendiente(s) de guardar
                </span>
              ) : (
                'Configura las cantidades para cada tamaño de pizza'
              )}
            </CardDescription>
          </div>
          <Button
            onClick={guardarCambios}
            disabled={!hayPendientes || saving}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">Ingrediente</TableHead>
                  <TableHead className="w-[100px]">Unidad</TableHead>
                  <TableHead className="w-[120px]">Categoría</TableHead>
                  <TableHead className="w-[200px]">Pizza Mediana</TableHead>
                  <TableHead className="w-[200px]">Pizza Familiar</TableHead>
                  <TableHead className="w-[100px]">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ingredientes.map((ing) => {
                  const tieneCambios = cambiosPendientes[ing.id];
                  const cantidadMediana = tieneCambios?.mediana !== undefined 
                    ? tieneCambios.mediana 
                    : ing.cantidadPorPizzaMediana;
                  const cantidadFamiliar = tieneCambios?.familiar !== undefined 
                    ? tieneCambios.familiar 
                    : ing.cantidadPorPizzaFamiliar;
                  const configurado = cantidadMediana !== undefined || cantidadFamiliar !== undefined;
                  
                  return (
                    <TableRow key={ing.id} className={tieneCambios ? 'bg-amber-50 dark:bg-amber-900/10' : ''}>
                      <TableCell className="font-medium">{ing.nombre}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{ing.unidad}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                        {ing.categoria}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2 items-center">
                          <Input
                            type="number"
                            placeholder="Ej: 150"
                            value={cantidadMediana ?? ''}
                            onChange={(e) => handleCantidadChange(ing.id, 'mediana', e.target.value)}
                            className="w-24"
                            min="0"
                            step="1"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => aplicarCantidadSugerida(ing.id, 'mediana')}
                            className="text-xs"
                          >
                            Auto
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2 items-center">
                          <Input
                            type="number"
                            placeholder="Ej: 250"
                            value={cantidadFamiliar ?? ''}
                            onChange={(e) => handleCantidadChange(ing.id, 'familiar', e.target.value)}
                            className="w-24"
                            min="0"
                            step="1"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => aplicarCantidadSugerida(ing.id, 'familiar')}
                            className="text-xs"
                          >
                            Auto
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        {configurado ? (
                          <Badge className="bg-green-500">✓ OK</Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-600 border-amber-600">
                            Pendiente
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
        <h3 className="text-lg font-medium text-blue-800 dark:text-blue-300 mb-2">ℹ️ Información Importante</h3>
        <ul className="list-disc list-inside space-y-1 text-blue-700 dark:text-blue-400 text-sm">
          <li>Las cantidades se expresan en la unidad del ingrediente (generalmente gramos)</li>
          <li>Estas cantidades se usan cuando los clientes arman sus propias pizzas</li>
          <li>Si un cliente agrega un ingrediente 2 veces, se multiplicará la cantidad por 2</li>
          <li>Puedes usar el botón "Auto" para aplicar cantidades sugeridas automáticamente</li>
          <li>Los cambios solo afectarán a nuevos pedidos, no a pedidos existentes</li>
        </ul>
      </div>
    </div>
  );
}
