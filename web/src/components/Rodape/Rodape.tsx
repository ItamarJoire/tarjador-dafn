import styles from './Rodape.module.scss'

/** Faixa institucional no pé da página. */
export const Rodape = () => (
  <footer className={styles['rodape']}>
    <div className={styles['rodape-interno']}>
      <p>
        Instituto Nacional de Tecnologia da Informação - ITI. <strong>Direitos reservados</strong>
      </p>
    </div>
  </footer>
)
