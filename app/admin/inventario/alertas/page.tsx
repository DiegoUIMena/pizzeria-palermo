import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import InventoryAlerts from '../../components/InventoryAlerts';

export default function InventoryAlertsPage() {
  return (
    <div className="container mx-auto py-6">
      <Card>
        <CardHeader>
          <CardTitle>Alertas de Inventario</CardTitle>
          <CardDescription>
            Administra transacciones de inventario fallidas y problemas que requieren atención.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InventoryAlerts />
        </CardContent>
      </Card>
    </div>
  );
}