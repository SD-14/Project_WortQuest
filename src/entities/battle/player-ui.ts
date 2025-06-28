// Removed duplicate highlightMultipleCorrect
import { UI } from ".";

export class PlayerUI extends UI {
  private _answerElements: HTMLElement[]
  private _selectedAnswer: number

  constructor(isPlayer: boolean) {
    super(isPlayer)
    this._answerElements = [...this._uiContainer.querySelectorAll('[data-answer]') as any]
    this._selectedAnswer = 0
  }
  setCorrect() {
    this._answerElements[this._selectedAnswer].classList.add('correct', 'answer-option')
  }
  setWrong() {
    this._answerElements[this._selectedAnswer].classList.add('wrong', 'answer-option')
  }
  resetSelection() {
    this._answerElements.forEach(a => a.classList.remove('correct', 'wrong', 'answer-option'))
    this.removeSelectedClass()
    this._selectedAnswer = 0
    this.addSelectedClass()
  }
  setAnswers(answers: string[]) {
    for(let i = 0; i < answers.length; i++) {
      this._answerElements[i].textContent = answers[i]
    }
  }

  public highlightMultipleCorrect(indexes: number[]): void {
    indexes.forEach((idx: number) => {
      if (this._answerElements[idx]) {
        this._answerElements[idx].classList.add('correct', 'answer-option');
      }
    });
  }
  get selectedAnswer(): number {
    return this._selectedAnswer
  }
  selectNextAnswer() {
    this.removeSelectedClass()
    if(this._selectedAnswer + 1 === this._answerElements.length) {
      this._selectedAnswer = 0
    } else {
      this._selectedAnswer++
    }
    this.addSelectedClass()
  }
  selectPreviousAnswer() {
    this.removeSelectedClass()
    if(this._selectedAnswer - 1 === -1) {
      this._selectedAnswer = this._answerElements.length - 1
    } else {
      this._selectedAnswer--
    }
    this.addSelectedClass()
  }
  removeSelectedClass() {
    this._answerElements[this._selectedAnswer].classList.remove('selected')
  }
  addSelectedClass() {
    this._answerElements[this._selectedAnswer].classList.add('selected')
  }
}
