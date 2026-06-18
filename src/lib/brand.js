// Бренд арендатора (tenant). Прод по умолчанию «Toimart».
// Демо-стенд переопределяет через переменную окружения VITE_BRAND=YourRetail.
export const BRAND = import.meta.env.VITE_BRAND || 'Toimart'
// Инициал для квадрата-логотипа (Т для Toimart, Y для YourRetail и т.п.)
export const BRAND_INITIAL = (BRAND.trim()[0] || 'T').toUpperCase()

// Заголовок столбца «неоформленные». Прод — «НЕОФ»; демо ставит VITE_NEOF_LABEL=Доп.
export const NEOF_LABEL = import.meta.env.VITE_NEOF_LABEL || 'НЕОФ'

// Демо-стенд: показывает кнопку «Сбросить демо». Демо ставит VITE_DEMO=1.
export const IS_DEMO = import.meta.env.VITE_DEMO === '1'
