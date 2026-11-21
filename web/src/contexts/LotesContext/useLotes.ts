import { useContext } from 'react'
import { LotesContext } from './context'

export function useLotes() {
  const context = useContext(LotesContext)

  if (!context) {
    throw new Error('useLotes deve ser usado dentro de um LotesProvider')
  }

  return context
}
