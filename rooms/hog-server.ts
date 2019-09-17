import { Room, Client } from "colyseus";
import { Schema, type, MapSchema } from "@colyseus/schema";
import ClockTimer from "@gamestdio/timer";

export class PlayerRole extends Schema {
  @type("string")
  id: string;
  @type("string")
  name: string;

  @type("boolean")
  readyToPlay: boolean = false

  @type("int16")
  roundBoops: number;
  @type("int16")
  totalBoops: number;

  constructor(id: string, name: string) {
    super()
    this.id = id;
    this.name = name;
    this.totalBoops = 0
    this.roundBoops = 0
  }

  isReadyForNextRound = () => this.readyToPlay

  readyForNextRound = () => this.readyToPlay = true

  startRound() {
    this.roundBoops = 0
    this.readyToPlay = false
  }

  updateBoops(value) {
    this.roundBoops += value
    this.totalBoops += value
  }
}

export class Players extends Schema {
  @type(PlayerRole)
  booster = new PlayerRole("booster", "Booster")
  @type(PlayerRole)
  navigator = new PlayerRole("navigator", "Navigator")
  @type(PlayerRole)
  wrangler = new PlayerRole("wrangler", "Wrangler")
  @type(PlayerRole)
  lifeSupport = new PlayerRole("lifeSupport", "Life Support")

  availableRoles: Array<PlayerRole> = [this.booster, this.navigator, this.wrangler, this.lifeSupport]

  @type({ map: PlayerRole })
  roles = new MapSchema<PlayerRole>();

  updateBoopsFor(clientId: string, value: number) {
    this.roles[clientId].updateBoops(value)
  }

  // Ready and between round states
  areReadyForNextRound(): boolean {
    let allReady = true
    for(let id in this.roles) {
      if (!this.roles[id].readyForNextRound()) {
        allReady = false
      }
    }
    return allReady
  }

  readyForNextRound(clientId: string) {
    this.roles[clientId].readyForNextRound()
  }

  startRound() {
    for(let id in this.roles) {
      this.roles[id].startNextRound()
    }
  }

  // Functions for adding and remove players from their roles
  getUnfilledRole(): PlayerRole {
    if (this.availableRoles.length === 0) return null
    return this.availableRoles.pop()
  }

  addPlayerToUnfilledRole(clientId: string) {
    this.roles[clientId] = this.getUnfilledRole()
    return this.roles[clientId]
  }

  removePlayerFromRole(clientId: string) {
    this.availableRoles.push(this.roles[clientId])
    delete this.roles[clientId]
  }
}

export class GameState extends Schema {
  clock: ClockTimer

  constructor(clock: ClockTimer) {
    super()
    this.clock = clock
  }

  @type("int16")
  stage: number = 1

  @type(Players)
  players = new Players()

  @type("boolean")
  betweenRounds: boolean = false

  boopsRequiredPerRound: number = 10
  @type("int16")
  totalBoopsRequired: number = this.boopsRequiredPerRound

  @type("int16")
  secondsForLastRound

  @type("int32")
  roundBoops: number = 0
  @type("int32")
  totalBoops: number = 0

  @type("int64")
  totalCash: number = 0
  @type("int64")
  cashFromRound: number = 0
  @type("int64")
  scoreMultiplier: number = 100

  updateBoops(clientId: string, value: number) {
    this.players.updateBoopsFor(clientId, value)
    this.roundBoops += value
    this.totalBoops += value
  }

  hasEveryoneBoopedEnough() {
    return this.roundBoops >= this.totalBoopsRequired
  }

  readyForNextRound(clientId: string) {
    this.players.readyForNextRound(clientId)
    this.tryStartNextRound()
  }

  tryStartNextRound() {
    if (!this.players.areReadyForNextRound()) return;

    this.clock.start()
    this.betweenRounds = false
    this.roundBoops = 0
    this.players.startRound()
  }

  winTheRound() {
    this.stage += 1
    this.betweenRounds = true
    this.totalBoopsRequired = this.stage * this.boopsRequiredPerRound
    this.clock.stop()
    this.secondsForLastRound = this.clock.elapsedTime / 1000
    this.clock.clear()
    this.cashFromRound = this.calculateCashFromRound()
    this.totalCash += this.cashFromRound
  }

  calculateCashFromRound() {
    this.cashFromRound = 0
    const targetSpeed = this.totalBoopsRequired/40
    return targetSpeed/this.secondsForLastRound*this.scoreMultiplier
  }

  addPlayer(clientId: string) {
    this.players.addPlayerToUnfilledRole(clientId)
  }

 removePlayer(clientId: string) {
    this.players.removePlayerFromRole(clientId)
  }
}

export class HogServerRoom extends Room<GameState> {
  maxClients = 4;

  onCreate(options) {
    console.log("Feral Hog Distribution game has been created!", options);

    this.setState(new GameState(this.clock));
  }

  onJoin(client: Client, options) {
    // if you are just joining as a viewer then don't take a role slot
    if (!options.joinAsViewer) {
      this.state.addPlayer(client.sessionId)
    }
    console.log(`Player ${client.sessionId} has joined the game`)
  }

  onLeave(client) {
    console.log(`Player ${client.sessionId} has left the game`)
    this.state.removePlayer(client.sessionId)
  }

  onMessage(client, data) {
    console.log("StateHandlerRoom received message from", client.sessionId, ":", data);
    if (data.command === "updateBoops") {
      this.state.updateBoops(client.sessionId, data.value);
      if (this.state.hasEveryoneBoopedEnough()) {
        this.state.winTheRound()
      }
    } else if (data.command === "nextRound") {
      this.state.readyForNextRound(client.sessionId)
    } else {
      console.log("unknown command")
      console.log(data)
    }
  }

  onDispose() {
    console.log("Dispose StateHandlerRoom");
  }

}
