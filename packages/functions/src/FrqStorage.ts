import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb'
import { Table } from 'sst/node/table'
import { type EvaluationOutput, type FrqOutput } from './ai/AiModel'

export interface FrqItem<T extends EvaluationOutput | FrqOutput | { status: string }> {
  id: string
  type: string
  topic: string
  userId: string
  content: T
  createdAt: number
}

export class FrqStorage {
  private readonly docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}))

  async storeQuestion (id: string, iteration: number, topic: string, userId: string, content: FrqOutput | { status: string }): Promise<void> {
    await this.docClient.send(new PutCommand({
      TableName: Table.FRQs.tableName,
      Item: {
        id,
        type: 'QUESTION#' + iteration.toString(),
        topic,
        userId,
        content,
        createdAt: Date.now()
      }
    }))
  }

  async getFinalQuestion (id: string): Promise<FrqItem<FrqOutput | { status: string }> | undefined> {
    const params = {
      // Get the table name from the environment variable
      TableName: Table.FRQs.tableName,
      Key: {
        id,
        type: 'QUESTION#0'
      }
    }

    const questionItem = await this.docClient.send(new GetCommand(params))
    return questionItem.Item as FrqItem<FrqOutput | { status: string }> | undefined
  }

  async getQuestions (id: string): Promise<Array<FrqItem<FrqOutput | { status: string }> | undefined>> {
    const params = {
      // Get the table name from the environment variable
      TableName: Table.FRQs.tableName,
      KeyConditionExpression: 'id = :id and begins_with(#type_field, :type)',
      ExpressionAttributeValues: {
        ':id': id,
        ':type': 'QUESTION#'
      },
      ExpressionAttributeNames: { '#type_field': 'type' }
    }

    const items = await this.docClient.send(new QueryCommand(params))
    return (items.Items ?? []) as Array<FrqItem<FrqOutput | { status: string }>>
  }

  async getEvaluation (id: string, userId: string): Promise<Array<FrqItem<EvaluationOutput | { status: string }>> | undefined> {
    const params = {
      // Get the table name from the environment variable
      TableName: Table.FRQs.tableName,
      KeyConditionExpression: 'id = :id and begins_with(#type_field, :type)',
      ExpressionAttributeValues: {
        ':id': id,
        ':type': 'EVALUATION#',
        ':userId': userId
      },
      FilterExpression: 'userId = :userId',
      ExpressionAttributeNames: { '#type_field': 'type' }
    }

    const items = await this.docClient.send(new QueryCommand(params))
    return (items.Items ?? []) as Array<FrqItem<EvaluationOutput | { status: string }>>
  }

  async storeEvaluation (id: string, evaluationId: string, userId: string, content: EvaluationOutput | { status: string }): Promise<void> {
    await this.docClient.send(new PutCommand({
      TableName: Table.FRQs.tableName,
      Item: {
        id,
        type: 'EVALUATION#' + evaluationId,
        topic: '',
        userId,
        createdAt: Date.now(),
        content
      } satisfies FrqItem<EvaluationOutput | { status: string }>
    }))
  }

  async getAllQuestions (): Promise<Array<FrqItem<FrqOutput | { status: string }>>> {
    const params = {
      // Get the table name from the environment variable
      TableName: Table.FRQs.tableName,
      FilterExpression: 'begins_with(#type_field, :type)',
      ExpressionAttributeNames: { '#type_field': 'type' },
      ExpressionAttributeValues: {
        ':type': 'QUESTION#'
      }
    }

    const items = await this.docClient.send(new ScanCommand(params))
    return (items.Items ?? []) as Array<FrqItem<FrqOutput | { status: string }>>
  }
}
