import { type SQSEvent, type SQSHandler, type SQSRecord } from 'aws-lambda'
import { AiModel, type EvaluationOutput, type FrqOutput } from './AiModel'
import { FrqStorage } from '../FrqStorage'
import { isPresent } from 'ts-is-present'

export interface EvaluatorInput {
  id: string
  userId: string
  evaluationId: string
  response: string
}

const aiModel = new AiModel()
const frqStorage = new FrqStorage()

async function handleRecord (item: SQSRecord): Promise<EvaluationOutput> {
  const evaluatorInput = JSON.parse(item.body) as EvaluatorInput
  const frqItem = await frqStorage.getFinalQuestion(evaluatorInput.id)
  if (!isPresent(frqItem)) {
    throw new Error('Question not found')
  }
  if (frqItem.content.status === 'pending') {
    throw new Error('Question not ready')
  }

  const content = frqItem.content as FrqOutput
  const response = await aiModel.evaluateResponse(content.context, content.question, content.rubric, evaluatorInput.response)
  await frqStorage.storeEvaluation(evaluatorInput.id, evaluatorInput.evaluationId, evaluatorInput.userId, response)
  return response
}

export const main: SQSHandler = async (event: SQSEvent) => {
  console.log(`Received event: ${JSON.stringify(event)}`)

  const responses = await Promise.allSettled(event.Records.map(async (item) => await handleRecord(item)))
  responses.forEach((record) => {
    if (record.status === 'rejected') {
      console.log(`Error processing record: ${JSON.stringify(record)}`)
    }
  })
}
