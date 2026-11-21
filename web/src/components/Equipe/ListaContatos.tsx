import React, { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faCopy, faEnvelope } from '@fortawesome/free-solid-svg-icons'
import { EQUIPE } from '../../services/ambiente'
import styles from './Equipe.module.scss'

const ASSUNTO = encodeURIComponent('Tarjador: dúvida ou problema')

const iniciais = (nome: string) =>
  nome
    .split(' ')
    .filter(Boolean)
    .map(parte => parte[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

/**
 * Copia o texto. A API de área de transferência só existe em HTTPS ou
 * localhost; numa intranet em HTTP, cai no método antigo.
 */
const copiar = async (texto: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(texto)
      return true
    }
  } catch {
    // segue para o método antigo
  }
  const campo = document.createElement('textarea')
  campo.value = texto
  campo.setAttribute('readonly', '')
  campo.style.position = 'fixed'
  campo.style.opacity = '0'
  document.body.appendChild(campo)
  campo.select()
  let deuCerto: boolean
  try {
    deuCerto = document.execCommand('copy')
  } catch {
    deuCerto = false
  }
  campo.remove()
  return deuCerto
}

/** Se o navegador não deixar copiar, seleciona o e-mail para a pessoa usar Ctrl+C. */
const selecionar = (elemento: Element | null) => {
  if (!elemento) return
  const intervalo = document.createRange()
  intervalo.selectNodeContents(elemento)
  const selecao = window.getSelection()
  selecao?.removeAllRanges()
  selecao?.addRange(intervalo)
}

/** Contatos da equipe responsável: e-mail clicável e botão de copiar. */
export const ListaContatos: React.FC = () => {
  const [resultado, setResultado] = useState<{ email: string; copiou: boolean } | null>(null)

  useEffect(() => {
    if (!resultado) return
    const timer = window.setTimeout(() => setResultado(null), resultado.copiou ? 2000 : 4000)
    return () => window.clearTimeout(timer)
  }, [resultado])

  return (
    <ul className={styles['contatos']}>
      {EQUIPE.contatos.map(contato => {
        const deste = resultado?.email === contato.email ? resultado : null
        return (
          <li key={contato.email} className={styles['contato']}>
            <span className={styles['avatar']} aria-hidden="true">
              {iniciais(contato.nome)}
            </span>
            <span className={styles['dados']}>
              <span className={styles['nome']}>{contato.nome}</span>
              <a className={styles['email']} href={`mailto:${contato.email}?subject=${ASSUNTO}`}>
                <FontAwesomeIcon icon={faEnvelope} />
                <span className={styles['endereco']}>{contato.email}</span>
              </a>
            </span>
            <button
              type="button"
              className={styles['copiar']}
              onClick={async evento => {
                const item = evento.currentTarget.closest('li')
                const copiou = await copiar(contato.email)
                if (!copiou) selecionar(item?.querySelector(`.${styles['endereco']}`) ?? null)
                setResultado({ email: contato.email, copiou })
              }}
              aria-label={`Copiar o e-mail de ${contato.nome}`}
              title="Copiar e-mail"
            >
              <FontAwesomeIcon icon={deste?.copiou ? faCheck : faCopy} />
              <span aria-live="polite">{deste ? (deste.copiou ? 'Copiado' : 'Selecionado: Ctrl+C') : 'Copiar'}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
