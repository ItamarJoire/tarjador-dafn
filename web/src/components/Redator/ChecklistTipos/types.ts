import type { GrupoTipos } from '../../../services/RedatorService'

export interface ChecklistTiposProps {
  /** Grupos e itens vindos da API (GET /api/tipos). */
  grupos: GrupoTipos[]
  /** Ids dos itens marcados. */
  value: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}
