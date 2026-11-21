import React from 'react'
import { Helmet } from 'react-helmet-async'
import type { PageTitleProps } from './types'

/** Nome da aplicação e do órgão: é o título da aba na tela principal e o sufixo nas demais. */
const NOME_DA_APLICACAO = 'Tarjador | ITI'
const TITLE_TEMPLATE = `%s | ${NOME_DA_APLICACAO}`

export const PageTitle: React.FC<PageTitleProps> = ({ title }) =>
  title ? (
    <Helmet titleTemplate={TITLE_TEMPLATE} title={title} />
  ) : (
    <Helmet title={NOME_DA_APLICACAO} />
  )
