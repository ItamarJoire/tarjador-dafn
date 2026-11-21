import React, { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { Button, Loading, Message, Upload, fileKey } from '../../../ui'
import { contarPaginas } from '../../../services/contarPaginas'
import { ChecklistTipos } from '../ChecklistTipos'
import { OpcaoChave } from '../OpcaoChave'
import { plural } from '../agruparPorPagina'
import type { PainelEnvioProps } from './types'
import styles from './PainelEnvio.module.scss'

const ehPdf = (arquivo: File) => arquivo.name.toLowerCase().endsWith('.pdf')

/** Acima disto, o envio ganha um aviso de que vai demorar (não bloqueia). */
const PAGINAS_PARA_AVISO = 300
/**
 * Média com OCR medida nesta máquina: um PDF digitalizado de 16 páginas
 * cheias de texto levou ~210 s (~13 s por página). É só uma estimativa: varia
 * com a resolução do scan, a quantidade de texto e a máquina.
 */
const SEGUNDOS_POR_PAGINA_COM_OCR = 12

export const PainelEnvio: React.FC<PainelEnvioProps> = ({
  enviando,
  erro,
  saude,
  apiFora,
  catalogo,
  tipos,
  onTiposChange,
  agressivo,
  onAgressivoChange,
  semOcr,
  onSemOcrChange,
  onEnviar,
  emTarjamento
}) => {
  const [arquivos, setArquivos] = useState<File[]>([])
  const [recusados, setRecusados] = useState<string[]>([])
  // Trocar a key recria o Upload, que guarda a lista de arquivos por dentro:
  // é o jeito de limpar a seleção depois de um envio que deu certo.
  const [rodada, setRodada] = useState(0)

  const tarjar = async () => {
    if (await onEnviar(arquivos)) {
      setArquivos([])
      setRecusados([])
      setRodada(r => r + 1)
    }
  }

  const aoSelecionar = (selecionados: File[]) => {
    setArquivos(selecionados.filter(ehPdf))
    setRecusados(selecionados.filter(a => !ehPdf(a)).map(a => a.name))
  }

  // Páginas de cada arquivo selecionado (null = não deu para ler), contadas no
  // navegador assim que o arquivo entra na lista.
  const [paginas, setPaginas] = useState<Record<string, number | null>>({})
  const contando = useRef(new Set<string>())

  useEffect(() => {
    for (const arquivo of arquivos) {
      const chave = fileKey(arquivo)
      if (chave in paginas || contando.current.has(chave)) continue
      contando.current.add(chave)
      void contarPaginas(arquivo).then(total => {
        contando.current.delete(chave)
        setPaginas(atuais => ({ ...atuais, [chave]: total }))
      })
    }
  }, [arquivos, paginas])

  const contagens = arquivos.map(arquivo => paginas[fileKey(arquivo)])
  const aindaContando = contagens.some(c => c === undefined)
  const totalPaginas = contagens.reduce<number>((soma, c) => soma + (c ?? 0), 0)
  const envioGrande = totalPaginas > PAGINAS_PARA_AVISO
  const minutosComOcr = Math.ceil((totalPaginas * SEGUNDOS_POR_PAGINA_COM_OCR) / 60)

  const semMotorOcr = saude !== null && saude.motorOcr === null
  const apiDesatualizada = saude !== null && saude.cancelamento !== true
  const podeTarjar = arquivos.length > 0 && tipos.length > 0 && !enviando

  return (
    <div className={styles['tela']}>
      <div className={styles['topo']} data-tour="inicio">
        <h1 className={styles['titulo']}>Tarjar documentos</h1>
        <p className={styles['descricao']}>
          Envie os PDFs, escolha o que tarjar e clique em Tarjar. Pode enviar mais enquanto outros são tarjados.
          Nada fica guardado: o original é apagado ao ser processado e o tarjado, 30 minutos depois de pronto.
        </p>
      </div>

      {apiFora && (
        <Message variant="error">
          A API não respondeu. Abra um terminal na pasta do Tarjador, rode <code>python api.py</code> e recarregue
          esta página.
        </Message>
      )}
      {apiDesatualizada && (
        <Message variant="warning">
          A API em execução é de uma versão anterior e não consegue cancelar tarjamentos em andamento. Reinicie-a: no
          terminal da API, aperte Ctrl+C e rode <code>python api.py</code> de novo.
        </Message>
      )}
      {semMotorOcr && (
        <Message variant="warning">
          OCR não instalado: texto dentro de imagens não será lido. Instale com{' '}
          <code>pip install rapidocr-onnxruntime==1.4.4 --ignore-requires-python</code>.
        </Message>
      )}

      {/* Opções: só a chave e o título; a explicação fica no ícone de informação */}
      <div className={styles['opcoes']} role="group" aria-label="Opções" data-tour="opcoes">
        <OpcaoChave
          titulo="Scan de baixa qualidade"
          ajuda="Quando a linha cita CPF, RG ou e-mail e o número não foi lido, tarja a linha a partir do rótulo. Tarja mais do que o necessário."
          checked={agressivo}
          onChange={onAgressivoChange}
          disabled={enviando}
        />
        <OpcaoChave
          titulo="PDF 100% digital (pular OCR)"
          ajuda="Muito mais rápido, mas dado dentro de imagem digitalizada não é tarjado."
          checked={semOcr}
          onChange={onSemOcrChange}
          disabled={enviando}
        />
      </div>

      <div className={styles['linha']}>
        <section className={styles['envio']} aria-labelledby="titulo-enviar">
          <div className={styles['envio-textos']}>
            <h2 id="titulo-enviar" className={styles['envio-titulo']}>
              Enviar PDFs
            </h2>
            <p className={styles['envio-descricao']}>
              Processos do SEI, certidões, contratos: com texto digital ou digitalizados. Dado dentro de imagem é
              lido por OCR.
            </p>
          </div>
          {catalogo && (
            <ChecklistTipos grupos={catalogo} value={tipos} onChange={onTiposChange} disabled={enviando} />
          )}
          <div className={styles['area-upload']} data-tour="upload">
            <Upload
              key={rodada}
              className={styles['upload']}
              label="PDFs do processo"
              buttonText="Selecione ou arraste os PDFs"
              helperText="Pode enviar vários de uma vez. Só arquivos .pdf, até 500 MB por envio."
              accept=".pdf,application/pdf"
              multiple
              disabled={enviando}
              rejectFile={arquivo => (emTarjamento?.(arquivo) ? 'já está sendo tarjado' : undefined)}
              onFilesSelected={aoSelecionar}
            />
            {recusados.length > 0 && (
              <Message variant="warning">
                {recusados.join(', ')} não {recusados.length === 1 ? 'é PDF' : 'são PDFs'} e ficou de fora.
              </Message>
            )}
          </div>
          {/* Tarjar logo abaixo dos PDFs: só ativa com PDF selecionado e algum
              tipo de dado marcado; o status ao lado diz o que falta. */}
          <div className={styles['acoes']} data-tour="tarjar">
            <Button icon={<FontAwesomeIcon icon={faCheck} />} onClick={() => void tarjar()} disabled={!podeTarjar}>
              {arquivos.length === 0
                ? 'Tarjar PDFs'
                : arquivos.length === 1
                  ? 'Tarjar 1 PDF'
                  : `Tarjar ${arquivos.length} PDFs`}
            </Button>
            <div className={styles['acoes-status']} aria-live="polite">
              {enviando ? (
                <Loading size="small" label="Enviando os arquivos ..." />
              ) : tipos.length === 0 ? (
                <span className={styles['alerta']}>Marque ao menos um tipo de dado em “O que tarjar”.</span>
              ) : arquivos.length === 0 ? (
                <span className={styles['resumo']}>Nenhum PDF selecionado</span>
              ) : (
                <span className={styles['resumo']}>
                  {plural(arquivos.length, 'PDF selecionado', 'PDFs selecionados')} ·{' '}
                  {aindaContando ? 'contando páginas ...' : plural(totalPaginas, 'página', 'páginas')} ·{' '}
                  {plural(tipos.length, 'tipo de dado', 'tipos de dado')}
                </span>
              )}
            </div>
          </div>
          {/* Aviso, não bloqueio: a fila põe os envios menores na frente */}
          {!enviando && envioGrande && (
            <p className={styles['aviso-grande']} role="status">
              <FontAwesomeIcon icon={faTriangleExclamation} />
              <span>
                <strong>Envio grande: {totalPaginas} páginas.</strong>{' '}
                {semOcr
                  ? 'Sem OCR é bem mais rápido, mas ainda pode levar alguns minutos.'
                  : `Se forem digitalizadas, o OCR deve levar uns ${minutosComOcr} minutos nesta máquina, fora o que já estiver na fila.`}{' '}
                Pode enviar mesmo assim: os envios menores passam na frente na fila.
              </span>
            </p>
          )}
        </section>
      </div>

      {erro && <Message variant="error">{erro}</Message>}
    </div>
  )
}
