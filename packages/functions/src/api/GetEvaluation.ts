import { type APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { FrqStorage } from '../FrqStorage'
import { isPresent } from 'ts-is-present'

const frqStorage = new FrqStorage()

export const main: APIGatewayProxyHandlerV2 = async (event) => {
  if (!isPresent(event.pathParameters) || !isPresent(event.pathParameters?.id) || !isPresent(event.pathParameters?.userId)) {
    return {
      statusCode: 422,
      body: JSON.stringify({ message: 'Question id or userId not provided' })
    }
  }
  const frqItems = await frqStorage.getEvaluation(event.pathParameters.id, event.pathParameters.userId)

  return {
    statusCode: 200,
    body: JSON.stringify(frqItems)
  }
}
