import { Page } from '@/components/layout/Page'
import { ButtonLink } from '@/components/ui'
import { Mascot } from '@/components/brand/Mascot'

export default function NotFound() {
  return (
    <Page narrow className="text-center">
      <Mascot pose="voando" width={340} className="mx-auto max-w-full" eager />
      <p className="tabular mt-6 text-[5rem] leading-none font-bold text-line-strong">404</p>
      <h1 className="t-h2 mt-3">O Gimmy voou longe demais.</h1>
      <p className="t-lead mt-3">A página que você procura não existe ou mudou de lugar.</p>
      <ButtonLink to="/" className="mt-8">Voltar para o início</ButtonLink>
    </Page>
  )
}
