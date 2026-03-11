/**
 * Servicio de detección de intención
 * Motor principal del chatbot
 */

import { normalizeMessage, extractKeywords, calculateSimilarity } from './normalize';

export interface Intent {
  id: string;
  intent: string;
  priority: number;
  keywords: string[];
  responses: string[];
  followUpKeywords?: string[];
  followUpResponses?: string[];
}

export interface IntentMatch {
  intent: Intent;
  confidence: number;
  matchType: 'exact' | 'keywords' | 'partial' | 'none';
}

/**
 * Detecta la intención del mensaje comparando con lista de intents
 */
export function detectIntent(
  message: string,
  intents: Intent[]
): IntentMatch | null {
  if (!intents || intents.length === 0) {
    return null;
  }

  const normalizedMessage = normalizeMessage(message);
  const messageKeywords = extractKeywords(message);

  let bestMatch: IntentMatch | null = null;
  let highestConfidence = 0;

  for (const intent of intents) {
    // 1. Búsqueda exacta de keywords
    const exactMatch = intent.keywords.some(keyword => {
      const normalizedKeyword = normalizeMessage(keyword);
      return normalizedMessage === normalizedKeyword || 
             normalizedMessage.includes(normalizedKeyword);
    });

    if (exactMatch) {
      const confidence = 0.9 + (intent.priority / 1000); // Prioridad como tiebreaker
      
      if (confidence > highestConfidence) {
        highestConfidence = confidence;
        bestMatch = {
          intent,
          confidence,
          matchType: 'exact'
        };
      }
      continue;
    }

    // 2. Búsqueda por coincidencia de palabras clave
    const keywordMatches = intent.keywords.filter(keyword => {
      const keywordWords = extractKeywords(keyword);
      
      return keywordWords.some(kw => messageKeywords.includes(kw));
    });

    if (keywordMatches.length > 0) {
      // Confianza basada en cantidad de matches y prioridad
      const keywordConfidence = 
        (keywordMatches.length / intent.keywords.length) * 0.7 + 
        (intent.priority / 1000);

      if (keywordConfidence > highestConfidence) {
        highestConfidence = keywordConfidence;
        bestMatch = {
          intent,
          confidence: keywordConfidence,
          matchType: 'keywords'
        };
      }
      continue;
    }

    // 3. Búsqueda por similitud parcial (más flexible)
    let maxSimilarity = 0;
    
    for (const keyword of intent.keywords) {
      const similarity = calculateSimilarity(message, keyword);
      maxSimilarity = Math.max(maxSimilarity, similarity);
    }

    if (maxSimilarity > 0.3) { // Umbral de similitud
      const partialConfidence = maxSimilarity * 0.5 + (intent.priority / 1000);
      
      if (partialConfidence > highestConfidence) {
        highestConfidence = partialConfidence;
        bestMatch = {
          intent,
          confidence: partialConfidence,
          matchType: 'partial'
        };
      }
    }
  }

  // Retornar solo si confianza es suficiente
  if (bestMatch && bestMatch.confidence > 0.3) {
    return bestMatch;
  }

  return null;
}

/**
 * Detecta follow-up intent basado en contexto previo
 */
export function detectFollowUpIntent(
  message: string,
  previousIntent: Intent
): boolean {
  if (!previousIntent.followUpKeywords || previousIntent.followUpKeywords.length === 0) {
    return false;
  }

  const normalizedMessage = normalizeMessage(message);
  const messageKeywords = extractKeywords(message);

  // Verificar si alguna palabra coincide con followUpKeywords
  return previousIntent.followUpKeywords.some(keyword => {
    const normalizedKeyword = normalizeMessage(keyword);
    const keywordWords = extractKeywords(keyword);
    
    // Coincidencia exacta
    if (normalizedMessage.includes(normalizedKeyword)) {
      return true;
    }
    
    // Coincidencia de palabras
    return keywordWords.some(kw => messageKeywords.includes(kw));
  });
}

/**
 * Ordena intents por prioridad
 */
export function sortIntentsByPriority(intents: Intent[]): Intent[] {
  return [...intents].sort((a, b) => a.priority - b.priority);
}
