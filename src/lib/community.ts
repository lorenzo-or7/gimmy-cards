/** Official community links and content provided by the owner. */
export const WHATSAPP_GROUP_URL = 'https://chat.whatsapp.com/Dp4ytYmoLYB9TMrAKZRm6q'
export const INSTAGRAM_URL = 'https://www.instagram.com/gimmycards/'

/**
 * Official raffle milestones (members of the WhatsApp group) and prizes.
 * Only the milestones and prizes are published: there is no live member count,
 * no dates and no winners in the system, so none are shown.
 */
export const RAFFLES = [
  { members: 100, prize: 'Triple 30 anos', language: 'PT-BR', image: '/sorteios/100-triple-30-anos-ptbr.webp' },
  { members: 250, prize: 'Box com Pôster 30 anos', language: 'PT-BR', image: '/sorteios/250-box-poster-30-anos-ptbr.webp' },
  { members: 500, prize: 'ETB 30 anos', language: 'PT-BR', image: '/sorteios/500-etb-30-anos-ptbr.webp' },
  { members: 750, prize: 'Box Binder 30 anos', language: 'Inglês', image: '/sorteios/750-box-binder-30-anos-ingles.webp' },
  { members: 1000, prize: 'ETB 30 anos', language: 'Inglês', image: '/sorteios/1000-etb-30-anos-ingles.webp' },
] as const

/** WhatsApp group rules (they govern the group, not the website auctions). */
export const GROUP_RULES = [
  { t: 'Divulgação', d: 'Não divulgue outros grupos, lojas ou links sem autorização dos administradores.' },
  { t: 'Anúncios de cartas', d: 'São permitidos anúncios de cartas avulsas de Pokémon TCG, limitados a um anúncio por dia e até cinco fotos.' },
  { t: 'Respeito', d: 'Comportamentos desrespeitosos podem resultar em banimento.' },
  { t: 'Sem abordagens insistentes', d: 'Abordagens privadas não solicitadas, ofertas insistentes e spam são proibidos.' },
  { t: 'Lance é compromisso', d: 'Manipular valores retirando lances pode resultar em banimento.' },
  { t: 'Negociações particulares', d: 'A Gimmy Cards não se responsabiliza por negociações particulares entre membros. Peça referências antes de negociar.' },
] as const
