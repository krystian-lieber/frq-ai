import { OutputFixingParser, StructuredOutputParser } from 'langchain/output_parsers'
import { LLMChain, OpenAI, PromptTemplate } from 'langchain'
import { OPENAI_MODEL_NAME } from '../const'
import { Config } from 'sst/node/config'
import { z } from 'zod'

export const llm = new OpenAI({
  modelName: OPENAI_MODEL_NAME,
  temperature: 0,
  openAIApiKey: Config.OPENAI_KEY,
  verbose: true
})

const generateFrqOutputParser = StructuredOutputParser.fromZodSchema(
  z.object({
    context: z.string().describe('The context for the question'),
    question: z.string().describe('The question itself'),
    rubric: z.string().describe('The rubric for the question')
  })
)

const generateFrqOutputFixingParser = OutputFixingParser.fromLLM(llm, generateFrqOutputParser)

const generateFrqPromptTemplate = new PromptTemplate({
  template: `You are a teacher preparing Free Response Question for a student.
The question should assess the student's knowledge of "4th Grade Common Core Writing standard  - CCSS.ELA-LITERACY.W.4.9 - Draw evidence from literary or informational texts to support analysis, reflection, and research." standard.
All the context should be provided, do not refer students to outside sources. 
In the output, provide the following: 
the context for the question of at least 200 words,
the free response question itself, 
and a rubric that will be used to score the student's response on a 1 to 5 scale. 
The question must be a single sentence.
The rubric must only include the following categories: "Evidence-based Response", "Depth of Analysis and Reflection", "Clarity and Organization".
The topic of the task is {topic}.`,
  inputVariables: ['standard', 'topic'],
  partialVariables: {
    format_instructions: generateFrqOutputParser.getFormatInstructions()
  }
})

export interface FrqOutput {
  context: string
  question: string
  rubric: string
  [key: string]: string
}

const evaluationOutputParser = StructuredOutputParser.fromZodSchema(
  z.object({
    feedback: z.string().describe("The grading for the student's response according to rubric"),
    scores: z
      .array(z.number())
      .describe('List of numeric scores from 1-5 for each rubric category')
  })
)

const evaluationOutputFixingParser = OutputFixingParser.fromLLM(llm, evaluationOutputParser)

const evaluationPromptTemplate = new PromptTemplate({
  template: `You are a teacher grading responses for free response question for a student.
   The question assesses the student’s knowledge of the "4th Grade Common Core Writing standard  - CCSS.ELA-LITERACY.W.4.9 - Draw evidence from literary or informational texts to support analysis, reflection, and research." standard.
    The context for the question is:
    {context}
    The question is:
    {question}
    Grade the answer according to the following rubric:
    {rubric}
    Student response:
    {response}`,
  inputVariables: ['context', 'question', 'rubric', 'response'],
  partialVariables: {
    format_instructions: evaluationOutputParser.getFormatInstructions()
  }
})
export interface EvaluationOutput {
  feedback: string
  scores: number[]
}

const studentAiPrompt = new PromptTemplate({
  template: `You are a student tasked with answering the free response question.
    The question assesses students knowledge of "CCSS.ELA-LITERACY.W.4.9 - Draw evidence from literary or informational texts to support analysis, reflection, and research." standard.
    The context for the question is:
    {context}
    The question is:
    {question}
    Write your answer below:`,
  inputVariables: ['context', 'question']
})

export class AiModel {
  private readonly generateFrqChain = new LLMChain({
    llm,
    prompt: generateFrqPromptTemplate,
    outputKey: 'records', // For readability - otherwise the chain output will default to a property named "text"
    outputParser: generateFrqOutputFixingParser
  })

  private readonly evaluationFormattingChain = new LLMChain({
    llm,
    prompt: evaluationPromptTemplate,
    outputKey: 'records', // For readability - otherwise the chain output will default to a property named "text"
    outputParser: evaluationOutputFixingParser
  })

  async generateFrq (topic: string): Promise<FrqOutput> {
    const result = await this.generateFrqChain.call({
      topic
    })
    return result.records as FrqOutput
  }

  async evaluateResponse (context: string, question: string, rubric: string, response: string): Promise<EvaluationOutput> {
    const result = await this.evaluationFormattingChain.call({
      context,
      question,
      rubric,
      response
    })
    return result.records as EvaluationOutput
  }

  async generateStudentResponse (context: string, question: string): Promise<string> {
    const result = await studentAiPrompt.format({
      context,
      question
    })
    return await llm.call(result)
  }
}
