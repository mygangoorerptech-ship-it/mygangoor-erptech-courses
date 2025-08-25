export type QuestionType = 'mcq' | 'true_false' | 'assignment'

export interface Attachment {
  id: string
  name: string
  mime: string
  size: number
  dataUrl: string // base64, mock only
}

export interface MCQOption {
  id: string
  text: string
  correct: boolean
}

export interface AssessmentQuestionBase {
  id: string
  assessmentId: string
  type: QuestionType
  prompt: string
  points: number
  attachments?: Attachment[]
  order: number
  createdAt: string
  updatedAt: string
}

export interface MCQQuestion extends AssessmentQuestionBase {
  type: 'mcq'
  options: MCQOption[]
  shuffleOptions?: boolean
  multipleCorrect?: boolean
}

export interface TrueFalseQuestion extends AssessmentQuestionBase {
  type: 'true_false'
  answer: boolean
}

export interface AssignmentQuestion extends AssessmentQuestionBase {
  type: 'assignment'
  expectedUploadType?: 'pdf' | 'zip' | 'any'
  instructions?: string
}

export type AssessmentQuestion = MCQQuestion | TrueFalseQuestion | AssignmentQuestion