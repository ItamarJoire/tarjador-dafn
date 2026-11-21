import type { GrupoTipos } from '../../services/RedatorService'

/** Ids de todos os itens do checklist, na ordem em que aparecem. */
export const idsDoCatalogo = (grupos: GrupoTipos[]): string[] =>
  grupos.flatMap(grupo => grupo.itens.map(item => item.id))

/** Ids dos itens que já vêm marcados quando a tela abre. */
export const idsPadrao = (grupos: GrupoTipos[]): string[] =>
  grupos.flatMap(grupo => grupo.itens.filter(item => item.padrao).map(item => item.id))
