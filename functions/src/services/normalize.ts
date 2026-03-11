/**
 * Servicio de normalización de texto para chatbot
 * Convierte el mensaje del usuario a formato estándar
 */

/**
 * Normaliza un mensaje para comparación
 */
export function normalizeMessage(message: string): string {
  // Convertir a minúsculas
  let normalized = message.toLowerCase();

  // Remover acentos
  normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Remover puntuación
  normalized = normalized.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()¿?¡!]/g, ' ');

  // Remover espacios extra
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Extrae palabras clave del mensaje
 */
export function extractKeywords(message: string): string[] {
  const normalized = normalizeMessage(message);
  const words = normalized.split(' ');

  // Filtrar palabras muy cortas (stopwords básicas)
  const stopwords = [
    'el', 'la', 'de', 'en', 'y', 'a', 'que', 'es', 'por', 'un', 'una',
    'con', 'no', 'se', 'los', 'las', 'al', 'del', 'si', 'me', 'te',
    'lo', 'le', 'su', 'sus', 'mi', 'mis', 'tu', 'tus', 'o', 'pero',
    'para', 'como', 'mas', 'ya', 'hay', 'he'
  ];

  return words.filter(word => 
    word.length > 2 && 
    !stopwords.includes(word)
  );
}

/**
 * Calcula similitud entre dos textos (0-1)
 */
export function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(extractKeywords(text1));
  const words2 = new Set(extractKeywords(text2));

  if (words1.size === 0 && words2.size === 0) {
    return 0;
  }

  // Intersección
  const intersection = new Set([...words1].filter(x => words2.has(x)));

  // Similitud de Jaccard
  const union = new Set([...words1, ...words2]);
  
  if (union.size === 0) {
    return 0;
  }

  return intersection.size / union.size;
}

/**
 * Detecta si el mensaje es una pregunta
 */
export function isQuestion(message: string): boolean {
  const questionWords = ['que', 'quien', 'cuando', 'donde', 'como', 'por que', 'cual', 'cuales', 'cuanto', 'cuantos'];
  const normalized = normalizeMessage(message);
  
  // Contiene palabra interrogativa
  const hasQuestionWord = questionWords.some(word => normalized.includes(word));
  
  // Termina en signo de interrogación (antes de normalizar)
  const hasQuestionMark = message.trim().endsWith('?');

  return hasQuestionWord || hasQuestionMark;
}

/**
 * Obtiene el tamaño del mensaje (corto, medio, largo)
 */
export function getMessageLength(message: string): 'short' | 'medium' | 'long' {
  const words = extractKeywords(message);
  
  if (words.length <= 3) {
    return 'short';
  } else if (words.length <= 10) {
    return 'medium';
  } else {
    return 'long';
  }
}
