import urlDoWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// O pdf.js só é baixado na primeira contagem: a tela abre sem ele.
let biblioteca: Promise<typeof import('pdfjs-dist')> | null = null

const carregar = () =>
  (biblioteca ??= import('pdfjs-dist').then(pdfjs => {
    pdfjs.GlobalWorkerOptions.workerSrc = urlDoWorker
    return pdfjs
  }))

/**
 * Conta as páginas de um PDF no navegador, antes de enviar. Devolve null se
 * não der para ler (PDF com senha ou corrompido): aí a contagem fica de fora,
 * e a API decide na hora de processar.
 */
export async function contarPaginas(arquivo: File): Promise<number | null> {
  try {
    const pdfjs = await carregar()
    // Só abre o documento para ler o número de páginas: não renderiza nada.
    // (Use pdfjs-dist 6.2.108 ou mais novo: as versões anteriores executavam
    // JavaScript embutido em PDF malicioso.)
    const tarefa = pdfjs.getDocument({
      data: new Uint8Array(await arquivo.arrayBuffer()),
      disableFontFace: true
    })
    try {
      const documento = await tarefa.promise
      return documento.numPages
    } finally {
      await tarefa.destroy()
    }
  } catch {
    return null
  }
}
