import * as uuid from 'uuid'
import { type APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs'
import { FrqStorage } from '../FrqStorage'
import { Queue } from 'sst/node/queue'
import { isPresent } from 'ts-is-present'
import { type EvaluatorInput } from '../ai/QueueEvaluator'

export interface EvaluatorInputDto {
  response?: string
}

const sqsClient = new SQSClient({})
const frqStorage = new FrqStorage()

export const main: APIGatewayProxyHandlerV2 = async (event) => {
  const data = JSON.parse(event.body ?? '{}') as EvaluatorInputDto
  if (!isPresent(data.response) || data.response.length === 0) {
    return {
      statusCode: 422,
      body: JSON.stringify({ message: 'Response not provided' })
    }
  }
  if (!isPresent(event.pathParameters) || !isPresent(event.pathParameters?.id) || !isPresent(event.pathParameters?.userId)) {
    return {
      statusCode: 422,
      body: JSON.stringify({ message: 'Question id or userId not provided' })
    }
  }
  const frqItem = await frqStorage.getFinalQuestion(event.pathParameters.id)
  if (!isPresent(frqItem)) {
    return {
      statusCode: 404,
      body: JSON.stringify({ message: 'Question not found' })
    }
  }
  const userId = event.pathParameters.userId
  const evaluationId = uuid.v4()
  await frqStorage.storeEvaluation(frqItem.id, evaluationId, userId, { status: 'pending' })

  await sqsClient.send(new SendMessageCommand({
    QueueUrl: Queue.Evaluation.queueUrl,
    MessageBody: JSON.stringify({
      id: frqItem.id,
      evaluationId,
      userId,
      response: data.response
    } satisfies EvaluatorInput)
  }))

  return {
    statusCode: 200,
    body: JSON.stringify({
      evaluationId
    })
  }
}
