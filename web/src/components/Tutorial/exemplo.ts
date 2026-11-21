import type { Lote } from '../../services/RedatorService'

/**
 * Lotes FICTÍCIOS que a sidebar de tarjamentos mostra durante o tutorial, para
 * explicar o andamento, a conferência e o download sem depender de um envio
 * de verdade. Não passam pela API: nada aqui é processado nem baixado.
 */
export const LOTES_EXEMPLO: Lote[] = [
  {
    id: 'exemplo-andamento',
    estado: 'processando',
    tipos: ['cpf', 'rg', 'email', 'telefone'],
    ignorados: [],
    arquivos: [
      {
        indice: 0,
        nome: 'processo-exemplo.pdf',
        estado: 'processando',
        paginasTotal: 24,
        paginasFeitas: 9,
        tarjasAplicadas: 0,
        tarjasManuais: 0,
        versao: 0,
        avisosDoArquivo: [],
        paginasParaConferir: [],
        tarjasParaConferir: [],
        erro: null
      }
    ]
  },
  {
    id: 'exemplo-pronto',
    estado: 'concluido',
    tipos: ['cpf', 'rg', 'email', 'telefone'],
    ignorados: [],
    arquivos: [
      {
        indice: 0,
        nome: 'contrato-exemplo.pdf',
        estado: 'concluido',
        paginasTotal: 6,
        paginasFeitas: 6,
        tarjasAplicadas: 27,
        tarjasManuais: 0,
        versao: 0,
        avisosDoArquivo: [],
        paginasParaConferir: [{ pagina: 3, motivo: 'a página cita "CPF" 3 vezes e só 2 números foram tarjados' }],
        tarjasParaConferir: [
          {
            id: 'exemplo-tarja',
            pagina: 5,
            tipo: 'CPF',
            valor: '12*******09',
            motivo: 'número lido por OCR com pouca confiança'
          }
        ],
        erro: null
      }
    ]
  }
]

/** Valor de `meta` do tour enquanto a sidebar mostra os lotes de exemplo. */
export const META_DEMONSTRACAO = 'demonstracao'

// --- Página de exemplo da janela "Ver página" ---
// Desenhada aqui (SVG), sem passar pela API: texto fictício com as tarjas
// pretas por cima dos dados. A cláusula 3ª cita "CPF" sem número ao lado: é
// por isso que o exemplo pede conferência ("cita CPF 3 vezes, 2 tarjados").

const tarja = (x: number, y: number, largura: number) =>
  `<rect x="${x}" y="${y - 17}" width="${largura}" height="22" fill="#111"/>`

const linhaCinza = (y: number, largura: number) =>
  `<rect x="70" y="${y}" width="${largura}" height="9" rx="4" fill="#d9d9d9"/>`

// Atributos opcionais substituem os padrões (repetir um atributo invalida o
// SVG e o navegador não mostra a imagem)
const texto = (x: number, y: number, conteudo: string, atributos: Record<string, string> = {}) => {
  const todos: Record<string, string> = {
    'font-family': 'Arial, Helvetica, sans-serif',
    'font-size': '19',
    fill: '#222',
    ...atributos
  }
  const lista = Object.entries(todos)
    .map(([nome, valor]) => `${nome}="${valor}"`)
    .join(' ')
  return `<text x="${x}" y="${y}" ${lista}>${conteudo}</text>`
}

const SVG_PAGINA = `<svg xmlns="http://www.w3.org/2000/svg" width="850" height="1100" viewBox="0 0 850 1100">
  <rect width="850" height="1100" fill="#fff"/>
  <text x="425" y="540" font-family="Arial, Helvetica, sans-serif" font-size="120" font-weight="700" fill="#000" fill-opacity="0.05" text-anchor="middle" transform="rotate(-30 425 540)">EXEMPLO</text>
  ${texto(425, 90, 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS', { 'font-size': '24', 'font-weight': '700', 'text-anchor': 'middle' })}
  ${texto(425, 122, 'Documento fictício · página 3', { 'font-size': '16', fill: '#777', 'text-anchor': 'middle' })}
  ${texto(70, 200, 'CONTRATANTE: Maria Exemplo da Silva')}
  ${texto(70, 240, 'CPF:')} ${tarja(120, 240, 190)}
  ${texto(340, 240, 'RG:')} ${tarja(380, 240, 150)}
  ${texto(70, 280, 'E-mail:')} ${tarja(145, 280, 280)}
  ${texto(70, 320, 'Telefone:')} ${tarja(160, 320, 170)}
  ${linhaCinza(370, 700)} ${linhaCinza(395, 660)} ${linhaCinza(420, 690)} ${linhaCinza(445, 420)}
  ${texto(70, 510, 'CLÁUSULA 2ª. O pagamento será feito na conta de titularidade do')}
  ${texto(70, 540, 'CPF')} ${tarja(115, 540, 190)} ${texto(320, 540, ', agência')} ${tarja(405, 540, 80)} ${texto(495, 540, ', conta')} ${tarja(565, 540, 120)}
  ${linhaCinza(580, 680)} ${linhaCinza(605, 700)} ${linhaCinza(630, 520)}
  ${texto(70, 700, 'CLÁUSULA 3ª. O CPF informado no anexo deverá ser conferido pela')}
  ${texto(70, 730, 'contratada antes da assinatura.')}
  ${linhaCinza(770, 690)} ${linhaCinza(795, 640)} ${linhaCinza(820, 700)} ${linhaCinza(845, 380)}
  ${texto(70, 960, 'Brasília, 20 de novembro de 2026.', { fill: '#555' })}
  ${linhaCinza(1010, 260)}
  ${texto(70, 1040, 'Maria Exemplo da Silva', { 'font-size': '16', fill: '#555' })}
</svg>`

/** Imagem da página tarjada de exemplo, para a janela de Ver página no tutorial. */
export const IMAGEM_PAGINA_EXEMPLO = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(SVG_PAGINA)}`
