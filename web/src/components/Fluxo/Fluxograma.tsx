import React, { useId } from 'react'
import type { Diagrama, Forma, Lado, Ligacao, No } from './tipos'
import styles from './Fluxo.module.scss'

interface Ponto {
  x: number
  y: number
}

/** Tamanho padrão de cada forma (largura, altura). */
const TAMANHO: Record<Forma, [number, number]> = {
  inicio: [160, 60],
  processo: [160, 72],
  decisao: [170, 110],
  fim: [160, 60],
  aviso: [200, 64]
}

const medida = (no: No) => ({ w: no.w ?? TAMANHO[no.forma][0], h: no.h ?? TAMANHO[no.forma][1] })

const pontoDoLado = (no: No, lado: Lado): Ponto => {
  const { w, h } = medida(no)
  if (lado === 'cima') return { x: no.x, y: no.y - h / 2 }
  if (lado === 'baixo') return { x: no.x, y: no.y + h / 2 }
  if (lado === 'esquerda') return { x: no.x - w / 2, y: no.y }
  return { x: no.x + w / 2, y: no.y }
}

const horizontal = (lado: Lado) => lado === 'esquerda' || lado === 'direita'

/** Caminho em ângulos retos: um canto (saída e chegada em eixos diferentes) ou dois (no meio do caminho). */
const trajeto = (a: Ponto, saida: Lado, b: Ponto, entrada: Lado, via?: Array<[number, number]>): Ponto[] => {
  if (via) return [a, ...via.map(([x, y]) => ({ x, y })), b]
  if (horizontal(saida) && horizontal(entrada)) {
    if (a.y === b.y) return [a, b]
    const meio = (a.x + b.x) / 2
    return [a, { x: meio, y: a.y }, { x: meio, y: b.y }, b]
  }
  if (!horizontal(saida) && !horizontal(entrada)) {
    if (a.x === b.x) return [a, b]
    const meio = (a.y + b.y) / 2
    return [a, { x: a.x, y: meio }, { x: b.x, y: meio }, b]
  }
  return horizontal(saida) ? [a, { x: b.x, y: a.y }, b] : [a, { x: a.x, y: b.y }, b]
}

const Caixa: React.FC<{ no: No }> = ({ no }) => {
  const { w, h } = medida(no)
  const classes = [styles['no'], styles[`ator-${no.ator}`], styles[`forma-${no.forma}`]].join(' ')
  const x = no.x - w / 2
  const y = no.y - h / 2

  // No losango o texto fica no miolo, longe das pontas
  const texto =
    no.forma === 'decisao'
      ? { x: no.x - w * 0.34, y: no.y - h * 0.32, w: w * 0.68, h: h * 0.64 }
      : { x, y, w, h }

  return (
    <g className={classes}>
      {no.forma === 'decisao' ? (
        <polygon points={`${no.x},${y} ${x + w},${no.y} ${no.x},${y + h} ${x},${no.y}`} />
      ) : (
        <rect x={x} y={y} width={w} height={h} rx={no.forma === 'inicio' || no.forma === 'fim' ? h / 2 : 6} />
      )}
      <foreignObject x={texto.x} y={texto.y} width={texto.w} height={texto.h}>
        <div className={styles['texto-no']}>{no.texto}</div>
      </foreignObject>
    </g>
  )
}

const Seta: React.FC<{ ligacao: Ligacao; nos: Map<string, No>; marcador: string }> = ({ ligacao, nos, marcador }) => {
  const de = nos.get(ligacao.de)
  const para = nos.get(ligacao.para)
  if (!de || !para) return null
  const pontos = trajeto(
    pontoDoLado(de, ligacao.saida),
    ligacao.saida,
    pontoDoLado(para, ligacao.entrada),
    ligacao.entrada,
    ligacao.via
  )
  // Rótulo (SIM/NÃO) no meio do primeiro trecho, logo na saída da decisão
  const rotulo = { x: (pontos[0].x + pontos[1].x) / 2, y: (pontos[0].y + pontos[1].y) / 2 }

  return (
    <g className={`${styles['ligacao']}${ligacao.tracejada ? ` ${styles['tracejada']}` : ''}`}>
      <polyline points={pontos.map(p => `${p.x},${p.y}`).join(' ')} markerEnd={`url(#${marcador})`} />
      {ligacao.rotulo && (
        <text x={rotulo.x} y={rotulo.y} className={styles['rotulo']} textAnchor="middle" dominantBaseline="central">
          {ligacao.rotulo}
        </text>
      )}
    </g>
  )
}

/** Um diagrama em SVG; a escala muda o tamanho desenhado (o zoom da janela). */
export const Fluxograma: React.FC<{ diagrama: Diagrama; escala: number }> = ({ diagrama, escala }) => {
  const marcador = `seta-${useId().replace(/:/g, '')}`
  const nos = new Map(diagrama.nos.map(no => [no.id, no]))

  return (
    <svg
      className={styles['diagrama']}
      width={diagrama.largura * escala}
      height={diagrama.altura * escala}
      viewBox={`0 0 ${diagrama.largura} ${diagrama.altura}`}
      role="img"
      aria-label={`${diagrama.titulo}: ${diagrama.descricao}`}
    >
      <defs>
        <marker
          id={marcador}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M0,0 L10,5 L0,10 z" className={styles['ponta']} />
        </marker>
      </defs>
      {/* Setas primeiro: as caixas ficam por cima das pontas das linhas */}
      {diagrama.ligacoes.map(ligacao => (
        <Seta key={`${ligacao.de}-${ligacao.para}`} ligacao={ligacao} nos={nos} marcador={marcador} />
      ))}
      {diagrama.nos.map(no => (
        <Caixa key={no.id} no={no} />
      ))}
    </svg>
  )
}
