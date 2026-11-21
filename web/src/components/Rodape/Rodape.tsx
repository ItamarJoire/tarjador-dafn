import { FaleComAEquipe } from '../Equipe'
import styles from './Rodape.module.scss'

/** Pé da página: contato da equipe responsável e faixa institucional. */
export const Rodape = () => (
  <footer className={styles['rodape']}>
    <div className={styles['rodape-interno']}>
      <FaleComAEquipe />
      <p className={styles['institucional']}>
        Instituto Nacional de Tecnologia da Informação - ITI. <strong>Direitos reservados</strong>
      </p>
    </div>
  </footer>
)
