import { type APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { FrqStorage } from '../FrqStorage'
import { isPresent } from 'ts-is-present'

const frqStorage = new FrqStorage()

export const main: APIGatewayProxyHandlerV2 = async (event) => {
  if (!isPresent(event.pathParameters) || !isPresent(event.pathParameters?.id)) {
    return {
      statusCode: 422,
      body: JSON.stringify({ message: 'Question id not provided' })
    }
  }
  const frqItem = await frqStorage.getQuestions(event.pathParameters.id)

  if (!isPresent(frqItem)) {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: 'Question not found' })
    }
  }
  return {
    statusCode: 200,
    body: JSON.stringify({ questions: frqItem, iterations: frqItem.length })
  }
}
