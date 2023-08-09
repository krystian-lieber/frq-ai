import { type APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { FrqStorage } from '../FrqStorage'
import { isPresent } from 'ts-is-present'

const frqStorage = new FrqStorage()

export const main: APIGatewayProxyHandlerV2 = async (event) => {
  const frqItems = await frqStorage.getAllQuestions()
  const finalizedQueries = frqItems.filter((item) => !isPresent(item.content.status))
  const errorQueries = frqItems.filter((item) => isPresent(item.content.status) && item.content.status === 'Unable to generate FRQ')
  const totalQuestions = finalizedQueries.filter((item) => item.type === 'QUESTION#0')
  const firstWrong = finalizedQueries.filter((item) => item.type === 'QUESTION#1')
  const firstRight = totalQuestions.length - firstWrong.length
  return {
    statusCode: 200,
    body: JSON.stringify({
      totalQuestions: totalQuestions.length,
      totalIterations: frqItems.length,
      totalError: errorQueries.length,
      firstRight,
      ftr: Math.round(100 * firstRight / totalQuestions.length),
      errorRate: Math.round(100 * errorQueries.length / totalQuestions.length)
    })
  }
}
