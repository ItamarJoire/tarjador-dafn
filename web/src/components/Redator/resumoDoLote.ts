import type { Lote } from '../../services/RedatorService'
import { agruparPorPagina, plural } from './agruparPorPagina'

export interface ResumoDoLote {
  nome: string
  situacao: string
  /** 0 a 100; null quando não há barra (na fila ou pronto). */
  progresso: number | null
  tom: 'fila' | 'andamento' | 'pronto' | 'atencao'
}

/**
 * O que o painel mostra de cada lote. aprovacoes: páginas já aprovadas na
 * conferência, por índice do arquivo; elas deixam de contar como "para conferir".
 */
export const resumoDoLote = (lote: Lote, aprovacoes: Record<string, number[]> = {}): ResumoDoLote => {
  const [primeiro, ...demais] = lote.arquivos
  const nome = demais.length > 0 ? `${primeiro.nome} e mais ${demais.length}` : (primeiro?.nome ?? 'Lote')

  if (lote.estado === 'na_fila') {
    return { nome, situacao: 'Aguardando na fila', progresso: null, tom: 'fila' }
  }

  if (lote.estado !== 'concluido') {
    const total = lote.arquivos.reduce((soma, a) => soma + a.paginasTotal, 0)
    const feitas = lote.arquivos.reduce((soma, a) => soma + a.paginasFeitas, 0)
    const finalizados = lote.arquivos.filter(a => a.estado === 'concluido' || a.estado === 'erro').length
    const atual = Math.min(finalizados + 1, lote.arquivos.length)
    // O total de páginas só se conhece quando cada arquivo é aberto: com
    // vários arquivos, a barra mede o arquivo atual, que é o que anda.
    const arquivoAtual = lote.arquivos.find(a => a.estado === 'processando')
    const base = lote.arquivos.length > 1 ? arquivoAtual : undefined
    const de = base ? base.paginasTotal : total
    const ja = base ? base.paginasFeitas : feitas
    const progresso = de > 0 ? Math.round((ja / de) * 100) : 0
    const situacao =
      lote.arquivos.length > 1 ? `Tarjando arquivo ${atual} de ${lote.arquivos.length}` : `Tarjando · ${progresso}%`
    return { nome, situacao, progresso, tom: 'andamento' }
  }

  const comErro = lote.arquivos.filter(a => a.estado === 'erro').length
  const concluidos = lote.arquivos.filter(a => a.estado === 'concluido')
  const comPendencia = concluidos.reduce((soma, a) => soma + agruparPorPagina(a).length, 0)
  const paraConferir = concluidos.reduce((soma, a) => {
    const aprovadas = aprovacoes[a.indice] ?? []
    return soma + agruparPorPagina(a).filter(p => !aprovadas.includes(p.pagina)).length
  }, 0)

  if (comErro > 0) {
    return {
      nome,
      situacao: `Pronto · ${plural(comErro, 'arquivo', 'arquivos')} com erro`,
      progresso: null,
      tom: 'atencao'
    }
  }
  if (paraConferir > 0) {
    return {
      nome,
      situacao: `Pronto · ${plural(paraConferir, 'página', 'páginas')} para conferir`,
      progresso: null,
      tom: 'atencao'
    }
  }
  return {
    nome,
    situacao: comPendencia > 0 ? 'Pronto · conferido' : 'Pronto',
    progresso: null,
    tom: 'pronto'
  }
}
