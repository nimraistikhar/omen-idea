import { BigNumber } from 'ethers/utils'

export enum Status {
  Ready = 'Ready',
  Loading = 'Loading',
  Done = 'Done',
  Error = 'Error',
}

export enum OutcomeSlot {
  Yes = 'Yes',
  No = 'No',
}

export interface BalanceItem {
  outcomeName: OutcomeSlot
  probability: number
  currentPrice: string
  shares: BigNumber
  holdings: BigNumber
  winningOutcome: boolean
}

export enum Stage {
  Running = 0,
  Paused = 1,
  Closed = 2,
}

export enum StatusMarketCreation {
  Ready = 'Ready',
  PostingQuestion = 'Posting question to realitio',
  PrepareCondition = 'Prepare condition',
  ApprovingDAI = 'Approving DAI',
  CreateMarketMaker = 'Create market maker',
  ApproveDAIForMarketMaker = 'Approve dai for market maker',
  AddFunding = 'Add funding in market maker',
  InitialTradeInMarketMaker = 'initial trade in market maker',
  Done = 'Done',
  Error = 'Error',
}

export interface TokenAmountInterface {
  amount: BigNumber
  decimals: number
  format: (precision?: number) => string
  interestRate?: number
  price?: number
  depositBalance?: TokenAmountInterface
  walletBalance?: TokenAmountInterface
}

export enum StepProfile {
  View = 'View',
  Buy = 'Buy',
  Sell = 'Sell',
  CloseMarketDetail = 'CloseMarketDetail',
}

export enum WinnerOutcome {
  Yes = 'Yes',
  No = 'No',
}

export interface Question {
  question: string
  resolution: Date
}

export enum OutcomeTableValue {
  Outcome = 'Outcome',
  Probabilities = 'Probabilities',
  CurrentPrice = 'Current Price',
  Shares = 'Shares',
  Payout = 'Payout',
  PriceAfterTrade = 'Price after trade',
}
