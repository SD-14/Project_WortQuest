
import { Delay, Task, TaskQueue } from '../../helpers'
import { Observer } from '../'
import { battleData, generalQuestions } from '../../data'
import { BattleComponents, BattleData, Levels, Question, QuestionData } from '../../interfaces'
import {
  Arena,
  BackDrop,
  EnemyFighter,
  EnemyUI,
  PlayerFighter,
  PlayerUI,
  HP
} from '.'

export class Battle extends Observer {

  private _acceptedTasks: Set<string>;
  private _taskQueue: TaskQueue;
  private _currentLevel: keyof Levels;
  private _currentQuestions: Question[];
  private _currentQuestion: Question;
  private _currentLevelQuestionData: { [key: string]: any };
  private _selectedQuestionData: any;
  private _battleData: any;
  private _battleComponents: BattleComponents;
  private _stagedFeedback: { awaiting: boolean, correctIndexes: number[], justAnswered: boolean, awaitingSummary: boolean } = { awaiting: false, correctIndexes: [], justAnswered: false, awaitingSummary: false };
  constructor(taskQueue: TaskQueue, currentLevel: keyof Levels) {
    super()
    this._acceptedTasks = new Set(['scene-transition-start', 'battle-start', 'battle-end', 'battle'])
    this._currentLevel = currentLevel
    this._taskQueue = taskQueue
    this._battleData = battleData
    this._currentLevelQuestionData = battleData[currentLevel as keyof typeof battleData]
    this._currentQuestions = null
    this._selectedQuestionData = null
    this._battleComponents = {
      arena: new Arena(),
      backdrop: new BackDrop(),
      enemyFighter: new EnemyFighter(false),
      enemyUI: new EnemyUI(false),
      playerFighter: new PlayerFighter(true),
      playerUI: new PlayerUI(true),
      playerHP: new HP(true),
      enemyHP: new HP(false)
    }
  }
  handleUpdate({ name, action }: Task): void {
    if (!this._acceptedTasks.has(name)) return
    switch (name) {
      case 'battle-start':
        this.handleBattleStart(action)
        break
      case 'battle-end':
        this.handleBattleEnd(action)
        break
      case 'scene-transition-start':
        this.handleSceneTransitionStart(action)
        break;
      case 'battle':
        this.handleBattle(action)
        break;
    }
  }
  async handleBattleEnd(wasLoss: boolean): Promise<void> {
    await Delay.delay(500)
    Object.values(this._battleComponents).forEach((component: any) => component.hide());
    await Delay.delay(500)
    const { playerUI, enemyUI, playerHP, enemyHP } = this._battleComponents
    playerUI.resetSelection()
    enemyUI.reset()
    playerHP.reset()
    enemyHP.reset()
    this._taskQueue.addTask(
      new Task('npc-interaction-end')
    )
    this._taskQueue.addTask(
      new Task('enable-input')
    )
    if(!wasLoss) {
      this._taskQueue.addTask(new Task('simulate-input', ' '))
    }
  }
  async handleBattle(action: any): Promise<void> {
    // Staged feedback state
    if (!this._stagedFeedback) this._stagedFeedback = { awaiting: false, correctIndexes: [], justAnswered: false, awaitingSummary: false };
    if (!action) {
      this._taskQueue.addTask(new Task('disable-input'));
      const { playerUI, enemyUI, playerHP, enemyHP, playerFighter, enemyFighter } = this._battleComponents;
      const selected = playerUI.selectedAnswer;
      const correctRaw = this._currentQuestion.correct;
      const correctArr: number[] = Array.isArray(correctRaw) ? correctRaw : [correctRaw];
      const isMulti = correctArr.length > 1;
      const isCorrect = correctArr.includes(selected);
      // Handle staged feedback for multi-answer questions
      if (this._stagedFeedback.awaitingSummary && isMulti) {
        // Show all correct answers and summary, then advance
        playerUI.highlightMultipleCorrect(correctArr);
        await Delay.delay(500);
        await enemyUI.writeText(this._currentQuestion.feedbackCorrect || "Richtig! Gut gemacht.");
        await Delay.delay(1200);
        enemyHP.damage();
        await enemyFighter.damage();
        await Delay.delay(500);
        playerUI.hide();
        await Delay.delay(500);
        this._currentQuestion = this._currentQuestions.shift();
        // Reset staged feedback state to prevent infinite loop
        this._stagedFeedback = { awaiting: false, correctIndexes: [], justAnswered: false, awaitingSummary: false };
        // If there is a next question, update UI and re-enable input
        if (this._currentQuestion) {
          playerUI.resetSelection();
          playerUI.setAnswers(this._currentQuestion.answers);
          await enemyUI.writeText(this._currentQuestion.question);
          await Delay.delay(500);
          playerUI.show();
          this._taskQueue.addTask(new Task('enable-input'));
        }
        return;
      } else if (isCorrect && isMulti) {
        // If this correct answer hasn't been selected before
        if (!this._stagedFeedback.correctIndexes.includes(selected)) {
          this._stagedFeedback.correctIndexes.push(selected);
        }
        playerUI.setCorrect();
        await Delay.delay(500);
        // Show option-specific feedback
        const feedback = this._currentQuestion.feedbackCorrectOptions?.[selected] || this._currentQuestion.feedbackCorrect || "Richtig! Gut gemacht.";
        await enemyUI.writeText(feedback);
        await Delay.delay(1200);
        // After showing feedback for this option, set flag to show summary on next input
        this._stagedFeedback.awaitingSummary = true;
        this._taskQueue.addTask(new Task('enable-input'));
        return;
      } else if (isCorrect) {
        playerUI.setCorrect();
        await Delay.delay(500);
        await enemyUI.writeText(this._currentQuestion.feedbackCorrect || "Richtig! Gut gemacht.");
        await Delay.delay(1200);
        enemyHP.damage();
        await enemyFighter.damage();
        await Delay.delay(500);
        playerUI.hide();
        await Delay.delay(500);
        this._currentQuestion = this._currentQuestions.shift();
      } else {
        playerUI.setWrong();
        await Delay.delay(500);
        // Option-specific feedback
        const feedback = this._currentQuestion.feedbackWrongOptions?.[selected]
          || this._currentQuestion.feedbackWrong
          || "Nicht ganz. Versuch es noch einmal!";
        await enemyUI.writeText(feedback);
        await Delay.delay(1200);
        playerHP.damage();
        await playerFighter.damage();
        await Delay.delay(500);
        // Do NOT advance question, let player try again
      }
      if (playerHP.isDead || enemyHP.isDead) {
        const { winningMessage, losingMessage, onWin, onLoss } = this._selectedQuestionData;
        const message = playerHP.isDead ? losingMessage : winningMessage;
        await enemyUI.writeText(message);
        await Delay.delay(500);
        if (playerHP.isDead) {
          const { name, action } = onLoss;
          if (name || action) this._taskQueue.addTask(new Task(name, action));
        } else {
          const { name, action } = onWin;
          this._taskQueue.addTask(new Task(name, action));
        }
        this._taskQueue.addTask(new Task('battle-end', playerHP.isDead));
        return;
      }
      playerUI.resetSelection();
      playerUI.setAnswers(this._currentQuestion.answers);
      await enemyUI.writeText(this._currentQuestion.question);
      await Delay.delay(500);
      playerUI.show();
      this._taskQueue.addTask(new Task('enable-input'));
    } else {
      // Defensive: only call if method exists
      const fn = (this._battleComponents.playerUI as any)[action];
      if (typeof fn === 'function') fn.call(this._battleComponents.playerUI);
    }
  }
  handleSceneTransitionStart({ level }: any): void {
    this._currentLevel = level
    this._currentLevelQuestionData = battleData[level as keyof typeof battleData]
  }
  async handleBattleStart({ fighter }: any): Promise<void> {
    if (!this._currentLevelQuestionData) throw new Error('Missing questions for this map.')
    this._selectedQuestionData = this._currentLevelQuestionData[fighter]
    if (!this._selectedQuestionData) throw new Error('Missing questions for this fighter.')
    // Dynamic question selection by difficulty
    let questions: Question[] = [];
    if (Array.isArray(this._selectedQuestionData.questions) && this._selectedQuestionData.questions.length > 0) {
      questions = [...this._selectedQuestionData.questions]
    } else if (Array.isArray((this._selectedQuestionData as any).questionDifficulties)) {
      // @ts-ignore: generalQuestions is imported as an object, but is actually an array
      const allQuestions: Question[] = (generalQuestions as any).default || (generalQuestions as any);
      const difficulties: string[] = (this._selectedQuestionData as any).questionDifficulties;
      questions = allQuestions.filter(q => difficulties.includes(q.difficulty));
    } else {
      // fallback: use all general questions
      // @ts-ignore
      questions = (generalQuestions as any).default || (generalQuestions as any);
    }
    this._currentQuestions = [...questions];
    this.shuffleQuestions()
    this._currentQuestion = this._currentQuestions.shift()
    const  {
      arena,
      backdrop,
      enemyFighter,
      enemyUI,
      playerFighter,
      playerUI,
      playerHP,
      enemyHP
    } = this._battleComponents
    const {
      arena: background,
      name,
      sprite,
      damageToEnemy,
      damageToPlayer,
      title,
      openingMessage,
    } = this._selectedQuestionData
    arena.set(background)
    enemyFighter.set(sprite)
    enemyHP.setDamageCounter(damageToEnemy)
    playerHP.setDamageCounter(damageToPlayer)
    playerUI.setAnswers(this._currentQuestion.answers)
    backdrop.show()
    await Delay.delay(500)
    arena.show()
    await Delay.delay(500)
    playerFighter.show()
    enemyFighter.show()
    await Delay.delay(500)
    enemyUI.show()
    await Delay.delay(500)
    await enemyUI.writeText(`${title} ${name} challenges you to a battle!`)
    await Delay.delay(500)
    playerHP.show()
    enemyHP.show()
    await Delay.delay(500)
    await enemyUI.writeText(openingMessage)
    await Delay.delay(1000)
    await enemyUI.writeText(this._currentQuestion.question)
    await Delay.delay(500)
    playerUI.show()
    this._taskQueue.addTask(
      new Task(
        'battle-navigate-answer',
        null
      )
    )
  }
  shuffleQuestions(): void {
    for(let i = 0; i < this._currentQuestions.length; i++) {
      const randomNum = Math.floor(Math.random() * this._currentQuestions.length)
      const placeHolder = this._currentQuestions[i]
      this._currentQuestions[i] = this._currentQuestions[randomNum]
      this._currentQuestions[randomNum] = placeHolder
    }
  }
  // writeText() {
  //   this.content = ''
  //   this._writingIntervalId = window.setInterval(() => {
  //     if (!this._currentWritingText.length) {
  //       clearInterval(this._writingIntervalId)
  //       return
  //     }
  //     const letter = this._currentWritingText.shift()
  //     this.content = this.content + letter
  //   }, 50)
  // }
  loadPlayerUI(): void {
    throw new Error('Method not implemented.')
  }
  beginQuestion(): void {
    throw new Error('Method not implemented.')
  }
  loadHealthBars(): void {
    throw new Error('Method not implemented.')
  }
  showOpeningMessage(): void {
    throw new Error('Method not implemented.')
  }
  showStartingMessage(): void {
    throw new Error('Method not implemented.')
  }
  loadEnemyUI(): void {
    throw new Error('Method not implemented.')
  }
  loadInCharacters(): void {
    throw new Error('Method not implemented.')
  }
  setupBattleBackground(): void {
    throw new Error('Method not implemented.')
  }
  setupBackdrop(): void {
    throw new Error('Method not implemented.')
  }
}
