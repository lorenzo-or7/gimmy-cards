/** Server error codes -> human messages (pt-BR). */
const MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: 'Entre na sua conta para continuar.',
  PROFILE_MISSING: 'Seu perfil ainda não está pronto. Saia e entre novamente.',
  FORBIDDEN: 'Você não tem permissão para esta ação.',
  INVALID_REQUEST: 'Pedido inválido. Atualize a página e tente de novo.',
  INVALID_AMOUNT: 'Valor inválido.',
  LOT_NOT_FOUND: 'Lote não encontrado.',
  NOT_FOUND: 'Não encontrado.',
  AUCTION_NOT_OPEN: 'Este leilão não está aberto para lances.',
  AUCTION_NOT_STARTED: 'O leilão ainda não começou.',
  LOT_CLOSED: 'Este lote já foi encerrado.',
  LOT_ENDED: 'O horário de encerramento já passou. O lance não foi registrado.',
  RATE_LIMITED: 'Muitos lances em pouco tempo. Aguarde um minuto.',
  USE_BUYOUT: 'Esse valor alcança o arremate imediato. Use o botão “Arrematar agora”.',
  BELOW_MINIMUM: 'O valor está abaixo do lance mínimo do lote.',
  NOT_ABOVE_OWN_BID: 'Você já tem um lance igual ou maior neste lote.',
  BELOW_INCREMENT: 'Para passar o maior lance, respeite o incremento mínimo.',
  NO_BUYOUT: 'Este lote não tem arremate imediato.',
  ORDER_NOT_PAYABLE: 'Este pedido não aceita pagamento agora.',
  INVALID_FILE: 'Arquivo inválido.',
  TOO_MANY_FILES: 'Limite de comprovantes atingido para este pedido.',
  ORDER_DEFAULTED: 'Pedido marcado como inadimplente.',
  NOT_OVERDUE: 'O prazo de pagamento ainda não venceu.',
  REASON_REQUIRED: 'Informe o motivo.',
  LOT_NOT_CLOSED: 'O lote ainda não foi encerrado.',
  LOT_HAS_ACTIVE_ORDER: 'O lote ainda está em um pedido ativo. Registre a inadimplência antes.',
  TRANSFER_ALREADY_ACTIVE: 'Já existe uma oferta ativa para este lote.',
  NO_DEFAULT_RECORDED: 'Nenhuma inadimplência registrada para este lote.',
  NO_ELIGIBLE_BIDDER: 'Não há mais participantes elegíveis na classificação.',
  OFFER_NOT_ACTIVE: 'Esta oferta não está mais ativa.',
  NO_ITEMS: 'Selecione ao menos uma carta.',
  ITEMS_UNAVAILABLE: 'Algumas cartas não estão disponíveis para envio.',
  RECIPIENT_REQUIRED: 'Informe o nome completo do destinatário.',
  INVALID_POSTAL_CODE: 'CEP inválido. Use 8 dígitos.',
  ADDRESS_REQUIRED: 'Preencha endereço e cidade.',
  SHIPMENT_FINISHED: 'Esta entrega já foi finalizada.',
  AUCTION_NOT_DRAFT: 'Só rascunhos podem ser publicados.',
  AUCTION_IN_PAST: 'O encerramento já passou. Ajuste as datas.',
  AUCTION_EMPTY: 'Adicione ao menos um lote antes de publicar.',
  LOT_CARDS_INVALID: 'Lote individual precisa de 1 carta; combo, de 2 ou mais.',
  AUCTION_HAS_BIDS: 'O leilão já tem lances. Esta alteração não é permitida.',
  AUCTION_NOT_PUBLISHED: 'O leilão não está publicado.',
  AUCTION_HAS_ORDERS: 'O leilão já gerou pedidos.',
  AUCTION_LOCKED: 'Leilão encerrado ou cancelado não pode ser alterado.',
  LOT_HAS_BIDS: 'O lote já tem lances. Valores, cartas e horário ficam travados.',
  LOT_ENDS_AFTER_AUCTION: 'O lote não pode encerrar depois do leilão.',
  LAST_SUPER_ADMIN: 'É preciso manter ao menos um administrador principal.',
  INVALID_DATES: 'Confira as datas: o encerramento deve ser depois do início.',
  CARD_IN_USE: 'Esta carta está em um lote e não pode ser excluída.',
  NAME_REQUIRED: 'Informe seu nome.',
  PAYLOAD_TOO_LARGE: 'Arquivo muito grande.',
  TOO_MANY_FAVORITES: 'Você chegou ao limite de 50 Pokémon favoritos.',
}

export class AppError extends Error {
  code: string
  constructor(code: string, message?: string) {
    super(message ?? MESSAGES[code] ?? code)
    this.code = code
  }
}

export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e
  const raw = (e as { message?: string })?.message ?? String(e)
  const code = Object.keys(MESSAGES).find((k) => raw === k || raw.includes(k))
  if (code) return new AppError(code)
  if (/Failed to fetch|NetworkError|network/i.test(raw)) {
    return new AppError('NETWORK', 'Sem conexão com o servidor. Verifique sua internet; nada foi registrado.')
  }
  if (/Invalid login credentials/i.test(raw)) return new AppError('LOGIN', 'E-mail ou senha incorretos.')
  if (/Email not confirmed/i.test(raw)) return new AppError('EMAIL', 'Confirme seu e-mail pelo link que enviamos.')
  if (/already registered|already exists/i.test(raw)) return new AppError('EXISTS', 'Este e-mail já tem cadastro. Tente entrar.')
  if (/Password should be/i.test(raw)) return new AppError('WEAK', 'A senha precisa de pelo menos 8 caracteres.')
  return new AppError('UNKNOWN', 'Algo deu errado. Tente novamente em instantes.')
}

export const errorMessage = (e: unknown) => toAppError(e).message
