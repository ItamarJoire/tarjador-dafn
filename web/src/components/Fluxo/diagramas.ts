import type { Diagrama } from './tipos'

/*
 * Como o Tarjador opera, conforme o código (api.py, redator.py e a tela).
 * Coordenadas em pixels, pelo centro de cada caixa: colunas a cada 210 px.
 * Ao mudar uma etapa do sistema, atualize aqui.
 */

const COL = [100, 310, 520, 730, 940, 1150, 1360, 1570]

export const FLUXO_GERAL: Diagrama = {
  id: 'geral',
  titulo: 'Fluxo geral',
  descricao: 'Do envio dos PDFs ao download do arquivo tarjado.',
  largura: 1460,
  altura: 860,
  nos: [
    // --- Envio e tarjamento ---
    { id: 'escolher', x: COL[0], y: 170, forma: 'inicio', ator: 'pessoa', texto: 'Escolhe os PDFs, as opções e o que tarjar', h: 72 },
    { id: 'repetido', x: COL[1], y: 170, forma: 'decisao', ator: 'navegador', texto: 'PDF repetido ou já sendo tarjado?' },
    { id: 'fora', x: COL[1], y: 40, forma: 'aviso', ator: 'navegador', texto: 'O arquivo não entra de novo', w: 180, h: 52 },
    { id: 'contar', x: COL[2], y: 170, forma: 'processo', ator: 'navegador', texto: 'Conta as páginas e avisa se o envio é grande' },
    { id: 'enviar', x: COL[3], y: 170, forma: 'processo', ator: 'navegador', texto: 'Ao clicar em Tarjar, envia os PDFs para a API do Tarjador' },
    { id: 'fila', x: COL[4], y: 170, forma: 'processo', ator: 'api', texto: 'Entra na fila: um arquivo por vez, os menores primeiro' },
    { id: 'procurar', x: COL[5], y: 170, forma: 'processo', ator: 'api', texto: 'Procura os dados em cada página (detalhe abaixo)' },
    { id: 'cancelar', x: 1045, y: 40, forma: 'aviso', ator: 'pessoa', texto: 'Cancelar, a qualquer momento: para na hora e apaga os arquivos do lote', w: 300, h: 52 },
    { id: 'aplicar', x: COL[6], y: 170, forma: 'processo', ator: 'api', texto: 'Aplica as tarjas: apaga o que está embaixo e limpa os metadados' },

    // --- Conferência (da direita para a esquerda) ---
    { id: 'original', x: COL[6], y: 420, forma: 'processo', ator: 'api', texto: 'Apaga o PDF original; o tarjado fica disponível por 30 min' },
    { id: 'suspeita', x: COL[5], y: 420, forma: 'decisao', ator: 'api', texto: 'Alguma página pede conferência?' },
    { id: 'motivo', x: COL[4], y: 420, forma: 'processo', ator: 'navegador', texto: 'Mostra a página na conferência, com o motivo' },
    { id: 'ver', x: COL[3], y: 420, forma: 'processo', ator: 'pessoa', texto: 'Abre a página (Ver página) e confere' },
    { id: 'faltou', x: COL[2], y: 420, forma: 'decisao', ator: 'pessoa', texto: 'Ficou dado sem tarja?' },
    { id: 'mao', x: COL[2], y: 285, forma: 'processo', ator: 'pessoa', texto: 'Tarja à mão: desenha sobre a página e aplica (definitiva)', w: 190, h: 64 },
    { id: 'aprovar', x: COL[1], y: 420, forma: 'processo', ator: 'pessoa', texto: 'Marca a página como aprovada' },

    // --- Download ---
    { id: 'baixar', x: COL[1], y: 640, forma: 'processo', ator: 'pessoa', texto: 'Baixa o PDF tarjado para a sua máquina' },
    { id: 'concluir', x: COL[2], y: 640, forma: 'decisao', ator: 'pessoa', texto: 'Baixar e concluir?' },
    { id: 'historico', x: COL[3], y: 640, forma: 'processo', ator: 'navegador', texto: 'Sai dos tarjamentos e entra no histórico deste navegador' },
    { id: 'todos', x: COL[4], y: 640, forma: 'decisao', ator: 'api', texto: 'Todos os arquivos do lote concluídos?' },
    { id: 'apagado', x: COL[5], y: 640, forma: 'fim', ator: 'api', texto: 'Lote apagado: nada fica guardado' },
    { id: 'continua', x: COL[2], y: 800, forma: 'processo', ator: 'navegador', texto: 'Continua nos tarjamentos, para conferir ou baixar de novo' },
    { id: 'expira', x: COL[4], y: 800, forma: 'aviso', ator: 'api', texto: '30 min depois de pronto, o lote é apagado de qualquer forma', w: 210, h: 64 }
  ],
  ligacoes: [
    { de: 'escolher', para: 'repetido', saida: 'direita', entrada: 'esquerda' },
    { de: 'repetido', para: 'fora', saida: 'cima', entrada: 'baixo', rotulo: 'SIM' },
    { de: 'repetido', para: 'contar', saida: 'direita', entrada: 'esquerda', rotulo: 'NÃO' },
    { de: 'contar', para: 'enviar', saida: 'direita', entrada: 'esquerda' },
    { de: 'enviar', para: 'fila', saida: 'direita', entrada: 'esquerda' },
    { de: 'fila', para: 'procurar', saida: 'direita', entrada: 'esquerda' },
    { de: 'cancelar', para: 'fila', saida: 'baixo', entrada: 'cima', tracejada: true },
    { de: 'cancelar', para: 'procurar', saida: 'baixo', entrada: 'cima', tracejada: true },
    { de: 'procurar', para: 'aplicar', saida: 'direita', entrada: 'esquerda' },
    { de: 'aplicar', para: 'original', saida: 'baixo', entrada: 'cima' },
    { de: 'original', para: 'suspeita', saida: 'esquerda', entrada: 'direita' },
    { de: 'suspeita', para: 'motivo', saida: 'esquerda', entrada: 'direita', rotulo: 'SIM' },
    { de: 'suspeita', para: 'baixar', saida: 'baixo', entrada: 'cima', rotulo: 'NÃO' },
    { de: 'motivo', para: 'ver', saida: 'esquerda', entrada: 'direita' },
    { de: 'ver', para: 'faltou', saida: 'esquerda', entrada: 'direita' },
    { de: 'faltou', para: 'mao', saida: 'cima', entrada: 'baixo', rotulo: 'SIM' },
    { de: 'mao', para: 'aprovar', saida: 'esquerda', entrada: 'cima' },
    { de: 'faltou', para: 'aprovar', saida: 'esquerda', entrada: 'direita', rotulo: 'NÃO' },
    { de: 'aprovar', para: 'baixar', saida: 'baixo', entrada: 'cima' },
    { de: 'baixar', para: 'concluir', saida: 'direita', entrada: 'esquerda' },
    { de: 'concluir', para: 'historico', saida: 'direita', entrada: 'esquerda', rotulo: 'SIM' },
    { de: 'concluir', para: 'continua', saida: 'baixo', entrada: 'cima', rotulo: 'NÃO' },
    { de: 'historico', para: 'todos', saida: 'direita', entrada: 'esquerda' },
    { de: 'todos', para: 'apagado', saida: 'direita', entrada: 'esquerda', rotulo: 'SIM' },
    { de: 'todos', para: 'expira', saida: 'baixo', entrada: 'cima', rotulo: 'NÃO' },
    { de: 'continua', para: 'expira', saida: 'direita', entrada: 'esquerda' },
    { de: 'expira', para: 'apagado', saida: 'direita', entrada: 'baixo' }
  ]
}

export const TARJAMENTO_DA_PAGINA: Diagrama = {
  id: 'pagina',
  titulo: 'Tarjamento de cada página',
  descricao: 'O que a API faz em cada página do PDF, na etapa "Procura os dados".',
  largura: 1670,
  altura: 450,
  nos: [
    { id: 'pagina', x: COL[0], y: 200, forma: 'inicio', ator: 'api', texto: 'Página do PDF' },
    { id: 'texto', x: COL[1], y: 200, forma: 'processo', ator: 'api', texto: 'Lê o texto digital e procura os tipos marcados' },
    { id: 'imagem', x: COL[2], y: 200, forma: 'decisao', ator: 'api', texto: 'Tem imagem e o OCR está ligado?' },
    { id: 'ocr', x: COL[3], y: 200, forma: 'processo', ator: 'api', texto: 'OCR: lê o texto da imagem e procura os dados' },
    { id: 'rotulo', x: COL[2], y: 60, forma: 'aviso', ator: 'api', texto: 'Scan de baixa qualidade ligado: se a linha cita CPF, RG... e o número não foi lido, tarja a linha a partir do rótulo', w: 320, h: 64 },
    { id: 'visuais', x: COL[4], y: 200, forma: 'decisao', ator: 'api', texto: 'QR Code ou código de barras marcados?' },
    { id: 'codigos', x: COL[5], y: 200, forma: 'processo', ator: 'api', texto: 'Procura QR Code e código de barras na imagem' },
    { id: 'sinal', x: COL[6], y: 200, forma: 'decisao', ator: 'api', texto: 'Algum sinal de que algo escapou?' },
    { id: 'conferencia', x: COL[6], y: 380, forma: 'aviso', ator: 'api', texto: 'Vai para a conferência com o motivo. Ex.: cita CPF mais vezes do que as tarjas; imagem em que o OCR não achou nada', w: 250, h: 80 },
    { id: 'pronta', x: COL[7], y: 200, forma: 'fim', ator: 'api', texto: 'Tarjas da página prontas' }
  ],
  ligacoes: [
    { de: 'pagina', para: 'texto', saida: 'direita', entrada: 'esquerda' },
    { de: 'texto', para: 'imagem', saida: 'direita', entrada: 'esquerda' },
    { de: 'imagem', para: 'ocr', saida: 'direita', entrada: 'esquerda', rotulo: 'SIM' },
    { de: 'imagem', para: 'visuais', saida: 'baixo', entrada: 'baixo', rotulo: 'NÃO', via: [[COL[2], 320], [COL[4], 320]] },
    { de: 'rotulo', para: 'texto', saida: 'esquerda', entrada: 'cima', tracejada: true },
    { de: 'rotulo', para: 'ocr', saida: 'direita', entrada: 'cima', tracejada: true },
    { de: 'ocr', para: 'visuais', saida: 'direita', entrada: 'esquerda' },
    { de: 'visuais', para: 'codigos', saida: 'direita', entrada: 'esquerda', rotulo: 'SIM' },
    { de: 'visuais', para: 'sinal', saida: 'cima', entrada: 'cima', rotulo: 'NÃO', via: [[COL[4], 110], [COL[6], 110]] },
    { de: 'codigos', para: 'sinal', saida: 'direita', entrada: 'esquerda' },
    { de: 'sinal', para: 'pronta', saida: 'direita', entrada: 'esquerda', rotulo: 'NÃO' },
    { de: 'sinal', para: 'conferencia', saida: 'baixo', entrada: 'cima', rotulo: 'SIM' },
    { de: 'conferencia', para: 'pronta', saida: 'direita', entrada: 'baixo' }
  ]
}

export const DIAGRAMAS = [FLUXO_GERAL, TARJAMENTO_DA_PAGINA]
