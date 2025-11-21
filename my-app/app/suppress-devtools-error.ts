// Suppress React DevTools semver error in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const originalError = console.error
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Invalid argument not valid semver')
    ) {
      return
    }
    originalError.apply(console, args)
  }
}

export {}
