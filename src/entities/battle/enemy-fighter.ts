import { Fighter } from ".";
import { Sprite } from "../../helpers";

export class EnemyFighter extends Fighter {
  private _enemyBackgrounds: {
    [key: string]: number[]
  }
  private _name: string
  private _sprite: Sprite
  private _selectedBackgroundPosition: number[];
  private _fighterBackgrounds: {
    [key: string]: number[]
  };
  constructor(
    isPlayer: boolean
  ) {
    super(isPlayer)
    this._name = null
    this._selectedBackgroundPosition = null
    this._sprite = new Sprite(
      'fighter',
      './assets/images/players/fighters.png',
      [4, 4]
    )
    this._fighterBackgrounds = null
    this._sprite.init()
    .then(() => {
      const { sheet } = this._sprite
      const [
        Brett,
        Min,
        Dane,,
        Tomo,
        Shashank,,,
        Blaine,
        Chi,,,
        Brock
      ] = sheet
      this._fighterBackgrounds = {
        Brett,
        Min,
        Tomo,
        Shashank,
        Blaine,
        Brock,
        Chi,
        Dane
      }
    })
  }
  set(name: string): void {
    this._name = name
    this._selectedBackgroundPosition = this._fighterBackgrounds[name]
    const [ x, y ] = this._selectedBackgroundPosition
    this._characterContainer.style.backgroundPosition = `${x}px ${y}px`
  }
}
