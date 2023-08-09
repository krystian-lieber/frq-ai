import { Api, type StackContext, Table, Config, Queue, NextjsSite } from 'sst/constructs'

export function MainStack ({ stack }: StackContext): void {
  const OPENAI_KEY = new Config.Secret(stack, 'OPENAI_KEY')

  const table = new Table(stack, 'FRQs', {
    fields: {
      id: 'string',
      type: 'string'
    },
    primaryIndex: { partitionKey: 'id', sortKey: 'type' }
  })

  const generationQueue = new Queue(stack, 'Generation', {
    consumer: {
      function: {
        handler: 'packages/functions/src/ai/QueueGenerator.main',
        bind: [table, OPENAI_KEY]
      }
    }
  })

  const evaluationQueue = new Queue(stack, 'Evaluation', {
    consumer: {
      function: {
        handler: 'packages/functions/src/ai/QueueEvaluator.main',
        bind: [table, OPENAI_KEY]
      }
    }
  })

  const api = new Api(stack, 'Api', {
    defaults: {
      function: {
        // Bind the table name to our API
        bind: [table, OPENAI_KEY, generationQueue, evaluationQueue]
      }
    },
    routes: {
      'POST    /frq': 'packages/functions/src/api/OrderFrq.main',
      'GET    /frq/{id}': 'packages/functions/src/api/GetFrq.main',
      'GET    /metrics': 'packages/functions/src/api/Metrics.main',
      'GET    /frq/{id}/debug': 'packages/functions/src/api/GetFrqDebug.main',
      'POST   /evaluate/{id}/{userId}': 'packages/functions/src/api/OrderEvaluation.main',
      'GET   /evaluate/{id}/{userId}': 'packages/functions/src/api/GetEvaluation.main'
    }
  })

  stack.addOutputs({
    ApiEndpoint: api.url
  })
}
