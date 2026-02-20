/**
 * Realiza un scroll suave a un elemento específico
 * Funciona incluso con prefers-reduced-motion activado
 * Siempre usa animación manual para garantizar que se vea
 */
export function scrollToCategory(categoryKey: string) {
  // Buscar el botón de categoría para hacer scroll
  const button = document.querySelector(`[data-category="${categoryKey}"]`) as HTMLElement
  
  if (button) {
    // Obtener la posición del elemento
    const yOffset = -100 // Offset para el header sticky
    const element = button
    const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset
    
    // Siempre usar scroll animado manual para garantizar visibilidad
    const startY = window.pageYOffset
    const targetY = y
    const distance = targetY - startY
    const duration = 800 // 800ms de duración
    let start: number | null = null

    function step(timestamp: number) {
      if (!start) start = timestamp
      const progress = timestamp - start
      const percent = Math.min(progress / duration, 1)
      
      // Ease in-out
      const ease = percent < 0.5
        ? 2 * percent * percent
        : -1 + (4 - 2 * percent) * percent
      
      window.scrollTo(0, startY + distance * ease)
      
      if (progress < duration) {
        window.requestAnimationFrame(step)
      }
    }
    
    window.requestAnimationFrame(step)
  }
}

/**
 * Realiza un scroll suave a un ID específico de sección
 * Funciona incluso con prefers-reduced-motion activado
 * Siempre usa animación manual para garantizar que se vea
 */
export function scrollToSection(sectionId: string) {
  const section = document.getElementById(sectionId)
  
  if (section) {
    const yOffset = -100 // Offset para el header sticky
    const y = section.getBoundingClientRect().top + window.pageYOffset + yOffset
    
    // Siempre usar scroll animado manual para garantizar visibilidad
    const startY = window.pageYOffset
    const targetY = y
    const distance = targetY - startY
    const duration = 800 // 800ms de duración
    let start: number | null = null

    function step(timestamp: number) {
      if (!start) start = timestamp
      const progress = timestamp - start
      const percent = Math.min(progress / duration, 1)
      
      // Ease in-out
      const ease = percent < 0.5
        ? 2 * percent * percent
        : -1 + (4 - 2 * percent) * percent
      
      window.scrollTo(0, startY + distance * ease)
      
      if (progress < duration) {
        window.requestAnimationFrame(step)
      }
    }
    
    window.requestAnimationFrame(step)
  }
}
