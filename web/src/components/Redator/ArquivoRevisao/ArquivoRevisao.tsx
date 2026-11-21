import React, { useId, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronDown, faChevronUp, faDownload, faFilePdf, faImages } from '@fortawesome/free-solid-svg-icons'
import { Badge, Button, Card, Message } from '../../../ui'
import type { BadgeVariant } from '../../../ui/Badge/types'
import type { ArquivoLote } from '../../../services/RedatorService'
import { agruparPorPagina, plural } from '../agruparPorPagina'
import { PendenciasArquivo } from '../PendenciasArquivo'
import type { ArquivoRevisaoProps } from './types'
import styles from './ArquivoRevisao.module.scss'

const selo = (arquivo: ArquivoLote, paginas: number, pendentes: number): { variant: BadgeVariant; texto: string } => {
  switch (arquivo.estado) {
    case 'na_fila':
      return { variant: 'info', texto: 'Na fila' }
    case 'processando':
      return { variant: 'info', texto: 'Processando' }
    case 'erro':
      return { variant: 'danger', texto: 'Erro' }
    default:
      if (paginas === 0) return { variant: 'success', texto: 'Sem pendências' }
      // Todas as páginas com pendência já aprovadas pela pessoa
      if (pendentes === 0) return { variant: 'success', texto: 'Conferido' }
      return { variant: 'warning', texto: `${pendentes} para conferir` }
  }
}

const subtitulo = (arquivo: ArquivoLote) => {
  if (arquivo.estado === 'na_fila') return 'Aguardando os arquivos anteriores'
  if (arquivo.estado === 'processando') {
    return arquivo.paginasTotal ? plural(arquivo.paginasTotal, 'página', 'páginas') : 'Abrindo o arquivo'
  }
  if (arquivo.estado === 'erro') return 'Não foi possível processar'
  return `${plural(arquivo.paginasTotal, 'página', 'páginas')} · ${plural(arquivo.tarjasAplicadas, 'tarja aplicada', 'tarjas aplicadas')}`
}

const resumoDaConferencia = (paginas: number, aprovadas: number, avisos: number) => {
  const partes = []
  if (paginas > 0) {
    partes.push(plural(paginas, 'página para conferir', 'páginas para conferir'))
    partes.push(`${aprovadas} de ${paginas} ${aprovadas === 1 ? 'aprovada' : 'aprovadas'}`)
  }
  if (avisos > 0) partes.push(plural(avisos, 'aviso', 'avisos'))
  return partes.length > 0 ? partes.join(' · ') : 'sem pendências'
}

/** Cartão de um arquivo do lote: andamento, conferência (abre e fecha) e download. */
export const ArquivoRevisao: React.FC<ArquivoRevisaoProps> = ({
  arquivo,
  aprovadas,
  onAprovar,
  onVerPagina,
  onBaixar,
  exemplo = false
}) => {
  // No exemplo do tutorial a conferência já vem aberta, para mostrar como é
  const [conferenciaAberta, setConferenciaAberta] = useState(exemplo)
  const idConferencia = useId()
  const paginas = agruparPorPagina(arquivo)
  const aprovadasComPendencia = paginas.filter(p => aprovadas.includes(p.pagina)).length
  const { variant, texto } = selo(arquivo, paginas.length, paginas.length - aprovadasComPendencia)
  const percentual = arquivo.paginasTotal ? Math.round((arquivo.paginasFeitas / arquivo.paginasTotal) * 100) : 0
  const concluido = arquivo.estado === 'concluido'

  return (
    <Card
      className={styles['arquivo']}
      avatar={<FontAwesomeIcon icon={faFilePdf} style={{ width: 16, height: 16 }} />}
      title={<span className={styles['nome']}>{arquivo.nome}</span>}
      subtitle={subtitulo(arquivo)}
      headerAction={<Badge variant={variant}>{texto}</Badge>}
      footer={
        concluido ? (
          <div className={styles['rodape']}>
            <span className={styles['baixar']} data-tour={exemplo ? 'exemplo-baixar' : undefined}>
              <Button icon={<FontAwesomeIcon icon={faDownload} />} onClick={() => onBaixar(arquivo)}>
                Baixar PDF tarjado
              </Button>
            </span>
            {/* Qualquer página, não só as com pendência: dá para tarjar à mão
                um dado que o tarjamento automático não pegou */}
            <Button
              variant="secondary"
              icon={<FontAwesomeIcon icon={faImages} />}
              onClick={() => onVerPagina(arquivo, paginas[0]?.pagina ?? 1)}
            >
              Ver páginas
            </Button>
          </div>
        ) : undefined
      }
    >
      {arquivo.estado === 'na_fila' && (
        <span className={styles['texto-andamento']}>Aguardando a vez na fila ...</span>
      )}

      {arquivo.estado === 'processando' && (
        <div className={styles['andamento']}>
          <div
            className={styles['progresso']}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percentual}
            aria-label={`Progresso de ${arquivo.nome}`}
          >
            <span className={styles['progresso-barra']} style={{ width: `${percentual}%` }} />
          </div>
          <span className={styles['texto-andamento']}>
            {arquivo.paginasTotal
              ? `Lendo a página ${arquivo.paginasFeitas} de ${arquivo.paginasTotal} ... Páginas digitalizadas passam pelo OCR e demoram mais.`
              : 'Abrindo o arquivo ...'}
          </span>
        </div>
      )}

      {arquivo.estado === 'erro' && <Message variant="error">{arquivo.erro}</Message>}

      {concluido && (
        <div className={styles['conferencia']} data-tour={exemplo ? 'exemplo-conferencia' : undefined}>
          <button
            type="button"
            className={styles['alternar']}
            onClick={() => setConferenciaAberta(aberta => !aberta)}
            aria-expanded={conferenciaAberta}
            aria-controls={idConferencia}
          >
            <span>
              {conferenciaAberta ? 'Fechar conferência' : 'Abrir conferência'}
              <span className={styles['alternar-resumo']}>
                {' · '}
                {resumoDaConferencia(paginas.length, aprovadasComPendencia, arquivo.avisosDoArquivo.length)}
              </span>
            </span>
            <FontAwesomeIcon icon={conferenciaAberta ? faChevronUp : faChevronDown} className={styles['seta']} />
          </button>

          {conferenciaAberta && (
            <div id={idConferencia} className={styles['revisao']}>
              {arquivo.avisosDoArquivo.map(aviso => (
                <Message key={aviso} variant="warning">
                  {aviso}
                </Message>
              ))}
              {paginas.length > 0 ? (
                <PendenciasArquivo
                  paginas={paginas}
                  aprovadas={aprovadas}
                  onAprovar={onAprovar}
                  onVer={pagina => onVerPagina(arquivo, pagina)}
                />
              ) : (
                <span className={styles['vazio']}>
                  Nenhuma tarja com dúvida e nenhuma página suspeita. Mesmo assim, vale uma olhada rápida no PDF
                  final.
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
