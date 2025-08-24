import React, { useEffect, useState } from 'react';

interface DebugPointsProps {
  points: Array<{ lat: number; lng: number }>;
  latLngToPixel: (lat: number, lng: number, applyClientOffset: boolean) => { x: number; y: number };
  isVisible: boolean;
}

export default function DebugPoints({ points, latLngToPixel, isVisible }: DebugPointsProps) {
  const [pixelPoints, setPixelPoints] = useState<Array<{ x: number; y: number }>>([]);

  useEffect(() => {
    if (!isVisible) return;

    const newPixelPoints = points.map(point => 
      latLngToPixel(point.lat, point.lng, false)
    );
    
    console.log('🔍 DEBUG: Puntos calculados:', newPixelPoints);
    setPixelPoints(newPixelPoints);
  }, [points, latLngToPixel, isVisible]);

  if (!isVisible) return null;

  return (
    <div style={{ 
      position: 'absolute', 
      left: 0, 
      top: 0, 
      zIndex: 1000, 
      padding: '10px',
      background: 'rgba(0,0,0,0.7)',
      color: 'white',
      maxWidth: '80%',
      maxHeight: '80%',
      overflow: 'auto'
    }}>
      <h3>Debug Puntos ({points.length})</h3>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid white', padding: '4px' }}>N°</th>
            <th style={{ border: '1px solid white', padding: '4px' }}>Lat</th>
            <th style={{ border: '1px solid white', padding: '4px' }}>Lng</th>
            <th style={{ border: '1px solid white', padding: '4px' }}>X</th>
            <th style={{ border: '1px solid white', padding: '4px' }}>Y</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point, index) => {
            const pixel = pixelPoints[index] || { x: 0, y: 0 };
            return (
              <tr key={index}>
                <td style={{ border: '1px solid white', padding: '4px' }}>{index + 1}</td>
                <td style={{ border: '1px solid white', padding: '4px' }}>{point.lat.toFixed(6)}</td>
                <td style={{ border: '1px solid white', padding: '4px' }}>{point.lng.toFixed(6)}</td>
                <td style={{ border: '1px solid white', padding: '4px' }}>{pixel.x.toFixed(1)}</td>
                <td style={{ border: '1px solid white', padding: '4px' }}>{pixel.y.toFixed(1)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
