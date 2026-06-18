// Бренд арендатора (tenant). Прод по умолчанию «Toimart».
// Демо-стенд переопределяет через переменную окружения VITE_BRAND=YourRetail.
export const BRAND = import.meta.env.VITE_BRAND || 'Toimart'
// Инициал для квадрата-логотипа (Т для Toimart, Y для YourRetail и т.п.)
export const BRAND_INITIAL = (BRAND.trim()[0] || 'T').toUpperCase()
