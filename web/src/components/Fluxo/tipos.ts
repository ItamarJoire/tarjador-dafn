/** Formato da caixa: início/fim em pílula, processo retangular, decisão em losango. */
export type Forma = 'inicio' | 'processo' | 'decisao' | 'fim' | 'aviso'

/** Quem faz a etapa: define a cor da caixa (legenda da janela). */
export type Ator = 'pessoa' | 'navegador' | 'api'

export type Lado = 'cima' | 'baixo' | 'esquerda' | 'direita'

export interface No {
  id: string
  /** Centro da caixa, em pixels do diagrama (escala 100%). */
  x: number
  y: number
  forma: Forma
  ator: Ator
  texto: string
  /** Tamanho fora do padrão da forma. */
  w?: number
  h?: number
}

export interface Ligacao {
  de: string
  para: string
  /** Lado da caixa de onde a seta sai e onde ela chega. */
  saida: Lado
  entrada: Lado
  rotulo?: string
  /** Cantos do caminho, quando o automático (um ou dois cantos) não serve. */
  via?: Array<[number, number]>
  /** Tracejada: observação ligada à etapa, não um passo do fluxo. */
  tracejada?: boolean
}

export interface Diagrama {
  id: string
  titulo: string
  descricao: string
  largura: number
  altura: number
  nos: No[]
  ligacoes: Ligacao[]
}
