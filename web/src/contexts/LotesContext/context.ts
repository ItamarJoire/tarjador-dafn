import { createContext } from 'react'
import type { LotesContextValue } from './types'

export const LotesContext = createContext<LotesContextValue | undefined>(undefined)
