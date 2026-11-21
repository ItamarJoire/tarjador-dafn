export interface OpcaoChaveProps {
  titulo: string
  /** Explica o efeito da opção: aparece no balão do ícone de informação. */
  ajuda: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}
