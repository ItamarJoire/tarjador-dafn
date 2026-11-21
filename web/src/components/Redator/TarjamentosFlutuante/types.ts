/** aberto: sidebar ao lado do conteúdo. minimizado: só o botão no canto. */
export type ModoTarjamentos = 'aberto' | 'minimizado'

export interface TarjamentosFlutuanteProps {
  modo: ModoTarjamentos
  onModoChange: (modo: ModoTarjamentos) => void
}
