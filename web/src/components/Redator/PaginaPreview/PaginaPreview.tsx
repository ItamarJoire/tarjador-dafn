import React, { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronLeft, faChevronRight, faDownload } from '@fortawesome/free-solid-svg-icons'
import { Button, Skeleton } from '../../../ui'
import { Modal } from '../../../ui/Modal'
import { RedatorService } from '../../../services'
import { agruparPorPagina } from '../agruparPorPagina'
import { ListaPendencias } from '../ListaPendencias'
import type { PaginaPreviewProps } from './types'
import styles from './PaginaPreview.module.scss'

/**
 * Imagem com esqueleto enquanto carrega. A key por src reinicia o estado.
 * compacta: no exemplo do tutorial a página inteira cabe na tela, para o
 * destaque contornar a imagem toda.
 */
const ImagemPagina: React.FC<{ src: string; alt: string; compacta?: boolean }> = ({ src, alt, compacta }) => {
  const [carregada, setCarregada] = useState(false)
  const [falhou, setFalhou] = useState(false)

  return (
    <div className={styles['quadro']}>
      {!carregada && !falhou && <Skeleton variant="rect" width="100%" height={520} />}
      {falhou && <p className={styles['falha']}>Não foi possível carregar a página.</p>}
      <img
        src={src}
        alt={alt}
        className={`${styles['imagem']}${compacta ? ` ${styles['imagem-compacta']}` : ''}`}
        style={carregada ? undefined : { display: 'none' }}
        onLoad={() => setCarregada(true)}
        onError={() => setFalhou(true)}
      />
    </div>
  )
}

export const PaginaPreview: React.FC<PaginaPreviewProps> = ({
  idLote,
  arquivo,
  pagina,
  onTrocarPagina,
  onClose,
  onBaixar,
  imagemExemplo
}) => {
  if (!arquivo) return null
  // Tutorial: imagem desenhada no front e marcas para os passos destacarem
  const exemplo = imagemExemplo !== undefined
  const tour = (nome: string) => (exemplo ? nome : undefined)

  const paginas = agruparPorPagina(arquivo)
  const posicao = paginas.findIndex(p => p.pagina === pagina)
  const atual = posicao >= 0 ? paginas[posicao] : undefined
  const anterior = posicao > 0 ? paginas[posicao - 1] : undefined
  const proxima = posicao >= 0 && posicao < paginas.length - 1 ? paginas[posicao + 1] : undefined
  const src = imagemExemplo ?? RedatorService.urlPagina(idLote, arquivo.indice, pagina)

  return (
    <Modal
      open
      size="large"
      onClose={onClose}
      title={`Página ${pagina} de ${arquivo.paginasTotal} · ${arquivo.nome}`}
      footer={
        <div className={styles['rodape']} data-tour={tour('previa-navegacao')}>
          <div className={styles['navegacao']}>
            {anterior && (
              <Button
                variant="tertiary"
                icon={<FontAwesomeIcon icon={faChevronLeft} />}
                onClick={() => onTrocarPagina(anterior.pagina)}
              >
                Página {anterior.pagina}
              </Button>
            )}
            {proxima && (
              <Button variant="tertiary" onClick={() => onTrocarPagina(proxima.pagina)}>
                Página {proxima.pagina} <FontAwesomeIcon icon={faChevronRight} />
              </Button>
            )}
          </div>
          <Button variant="secondary" icon={<FontAwesomeIcon icon={faDownload} />} onClick={() => onBaixar(arquivo)}>
            Baixar PDF
          </Button>
        </div>
      }
    >
      <div className={styles['corpo']}>
        {atual && (
          <div className={styles['pendencias']} data-tour={tour('previa-pendencia')}>
            <p className={styles['contexto']}>
              {paginas.length > 1
                ? `Pendência ${posicao + 1} de ${paginas.length} neste arquivo. Confira na imagem abaixo, que já está tarjada:`
                : 'Confira na imagem abaixo, que já está tarjada:'}
            </p>
            <ListaPendencias item={atual} />
          </div>
        )}
        <div data-tour={tour('previa-imagem')} className={exemplo ? styles['area-compacta'] : undefined}>
          <ImagemPagina key={src} src={src} alt={`Página ${pagina} tarjada de ${arquivo.nome}`} compacta={exemplo} />
        </div>
      </div>
    </Modal>
  )
}
