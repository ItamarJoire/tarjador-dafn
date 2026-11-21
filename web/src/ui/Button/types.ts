import type { MouseEvent, ReactNode } from 'react'

/** danger: ação destrutiva (apagar, cancelar processamento). */
export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger'

export interface ButtonProps {
  /** Estilo visual do botão. @default 'primary' */
  variant?: ButtonVariant
  /** Se informado, o botão vira um link (<a>); senão, vira um <button>. */
  href?: string
  /** Valor do atributo target do link (ex: '_blank' para abrir em nova aba). */
  target?: string
  /** Ícone exibido antes do texto (ex: <FontAwesomeIcon icon={faUser} />). */
  icon?: ReactNode
  onClick?: (event: MouseEvent<HTMLElement>) => void
  ariaLabel?: string
  /** Desabilita o botão (só vale para <button>). */
  disabled?: boolean
  className?: string
  children: ReactNode
}
