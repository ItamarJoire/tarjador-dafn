import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleHalfStroke } from '@fortawesome/free-solid-svg-icons'
import { Link } from 'react-router-dom'
import { useTheme } from '../../contexts'
import { paths } from '../../routes/paths'
import logo from '../../assets/logo-tarjador.svg'
import { BotaoTutorial } from '../Tutorial'
import styles from './Cabecalho.module.scss'

/** Marca do sistema à esquerda e troca de tema à direita. Não há login. */
export const Cabecalho = () => {
  const { theme, toggleTheme } = useTheme()
  const escuro = theme === 'dark'
  const rotulo = escuro ? 'Ativar tema claro' : 'Ativar tema escuro'

  return (
    <header className={styles['cabecalho']}>
      <div className={styles['cabecalho-interno']}>
        <Link to={paths.home} className={styles['marca']}>
          <img src={logo} alt="" className={styles['marca-logo']} width={40} height={40} />
          <span className={styles['marca-texto']}>
            <span className={styles['marca-nome']}>Tarjador</span>
            <span className={styles['marca-descricao']}>Tarjamento de dados pessoais</span>
          </span>
        </Link>

        <div className={styles['acoes']}>
          <BotaoTutorial />
          <button
            type="button"
            className={styles['tema']}
            onClick={toggleTheme}
            aria-label={rotulo}
            aria-pressed={escuro}
            title={rotulo}
          >
            <FontAwesomeIcon icon={faCircleHalfStroke} />
          </button>
        </div>
      </div>
    </header>
  )
}
