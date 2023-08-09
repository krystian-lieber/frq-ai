import * as uuid from 'uuid'
import { type APIGatewayProxyHandlerV2 } from 'aws-lambda'
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs'
import { FrqStorage } from '../FrqStorage'
import { Queue } from 'sst/node/queue'
import { type GeneratorInput } from '../ai/QueueGenerator'

const sqsClient = new SQSClient({})
const frqStorage = new FrqStorage()

interface GeneratorInputDto {
  userId?: string
  topic?: string
}

export const main: APIGatewayProxyHandlerV2 = async (event) => {
  const data = JSON.parse(event.body ?? '{}') as GeneratorInputDto
  const userId = data.userId ?? 'AI-user'
  const topic = data.topic ?? 'baseball'
  const id = uuid.v4()
  await frqStorage.storeQuestion(
    id,
    0,
    topic,
    userId,
    { status: 'Pending' }
  )
  await sqsClient.send(new SendMessageCommand({
    QueueUrl: Queue.Generation.queueUrl,
    MessageBody: JSON.stringify({
      id,
      userId,
      topic
    } satisfies GeneratorInput)
  }))

  return {
    statusCode: 201,
    body: JSON.stringify({
      id
    })
  }
}
