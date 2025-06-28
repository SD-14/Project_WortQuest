export interface Question {
  question: string,
  answers: string[],
  correct: number | number[],
  difficulty?: string,
  feedbackCorrect?: string,
  feedbackWrong?: string,
  feedbackWrongOptions?: (string|null)[],
  feedbackCorrectOptions?: (string|null)[]
}
