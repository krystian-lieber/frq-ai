import { type SQSEvent, type SQSHandler, type SQSRecord } from 'aws-lambda'
import { AiModel, type FrqOutput } from './AiModel'
import { FrqStorage } from '../FrqStorage'
import { MAX_GENERATION_ITERATIONS } from '../const'
import * as uuid from 'uuid'

export interface GeneratorInput {
  id: string
  userId: string
  topic: string
}

const aiModel = new AiModel()
const frqStorage = new FrqStorage()

function sumArray (numbers: number[]): number {
  return numbers.reduce((acc, curr) => acc + curr, 0)
}

async function handleRecord (item: SQSRecord): Promise<FrqOutput> {
  const generatorInput = JSON.parse(item.body) as GeneratorInput
  for (let i = 0; i < MAX_GENERATION_ITERATIONS; i++) {
    const response = await aiModel.generateFrq(generatorInput.topic)
    const studentsResponse = await aiModel.generateStudentResponse(response.context, response.question)
    const evaluationOutput = await aiModel.evaluateResponse(response.context, response.question, response.rubric, studentsResponse)
    const totalScore = sumArray(evaluationOutput.scores)
    const percentage = 100 * totalScore / evaluationOutput.scores.length / 5
    const newEvaluationId = uuid.v4()
    if (percentage >= 80) {
      await frqStorage.storeQuestion(generatorInput.id, 0, generatorInput.topic, generatorInput.userId, response)
      await frqStorage.storeEvaluation(generatorInput.id, newEvaluationId, 'AI#0', evaluationOutput)
      return response
    }
    const iteration = i + 1
    await frqStorage.storeQuestion(generatorInput.id, iteration, generatorInput.topic, 'AI', response)
    await frqStorage.storeEvaluation(generatorInput.id, newEvaluationId, 'AI#' + iteration.toString(), evaluationOutput)
  }
  await frqStorage.storeQuestion(generatorInput.id, 0, generatorInput.topic, generatorInput.userId, { status: 'Unable to generate FRQ' })
  throw new Error('Unable to generate FRQ')
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
