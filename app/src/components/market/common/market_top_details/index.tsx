import React, { useState } from 'react'

import { formatBigNumber, formatDate } from '../../../../util/tools'
import { MarketMakerData } from '../../../../util/types'
import { GridTwoColumns, SubsectionTitle, SubsectionTitleAction, SubsectionTitleWrapper } from '../../../common'
import { TitleValue } from '../../../common/text/title_value'
import { DisplayArbitrator } from '../display_arbitrator'

interface Props {
  toggleTitleAction: string
  title: string
  marketMakerData: MarketMakerData
}

const MarketTopDetails: React.FC<Props> = (props: Props) => {
  const [showingExtraInformation, setExtraInformation] = useState(false)

  const { marketMakerData } = props
  const {
    arbitrator,
    collateral,
    collateralVolume,
    marketMakerFunding,
    marketMakerUserFunding,
    question,
    totalEarnings,
    userEarnings,
  } = marketMakerData

  const totalVolumeFormat = collateralVolume
    ? `${formatBigNumber(collateralVolume, collateral.decimals)} ${collateral.symbol}`
    : '-'

  const toggleExtraInformation = () =>
    showingExtraInformation ? setExtraInformation(false) : setExtraInformation(true)

  return (
    <>
      <SubsectionTitleWrapper>
        <SubsectionTitle>{props.title}</SubsectionTitle>
        <SubsectionTitleAction onClick={toggleExtraInformation}>
          {showingExtraInformation ? 'Hide' : 'Show'} {props.toggleTitleAction}
        </SubsectionTitleAction>
      </SubsectionTitleWrapper>
      <GridTwoColumns>
        {showingExtraInformation ? (
          <>
            <TitleValue
              title={'Total Pool Tokens'}
              value={collateral && formatBigNumber(marketMakerFunding, collateral.decimals)}
            />
            <TitleValue
              title={'Total Pool Earnings'}
              value={collateral && `${formatBigNumber(totalEarnings, collateral.decimals)} ${collateral.symbol}`}
            />
            <TitleValue
              title={'My Pool Tokens'}
              value={collateral && formatBigNumber(marketMakerUserFunding, collateral.decimals)}
            />
            <TitleValue
              title={'My Pool Earnings'}
              value={collateral && `${formatBigNumber(userEarnings, collateral.decimals)} ${collateral.symbol}`}
            />
          </>
        ) : null}
        <TitleValue title={'Category'} value={question.category} />
        <TitleValue title={'Resolution Date'} value={question.resolution && formatDate(question.resolution)} />
        <TitleValue
          title={'Arbitrator/Oracle'}
          value={arbitrator && <DisplayArbitrator arbitrator={arbitrator} questionId={question.id} />}
        />
        <TitleValue title={'Total Volume'} value={totalVolumeFormat} />
      </GridTwoColumns>
    </>
  )
}

export { MarketTopDetails }
