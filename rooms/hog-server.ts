import { Room, Client } from "colyseus";
import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";
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

/** Contains all the functions used for managing players */
export class Players extends Schema {
  booster = new PlayerRole("booster", "Booster")
  navigator = new PlayerRole("navigator", "Navigator")
  wrangler = new PlayerRole("wrangler", "Wrangler")
  lifeSupport = new PlayerRole("lifeSupport", "Life Support")

  availableRoles: Array<PlayerRole> = [this.booster, this.navigator, this.wrangler, this.lifeSupport]

  // Track roles in this class, but send state from the state class
  roles: MapSchema<PlayerRole>

  constructor(roles: MapSchema<PlayerRole>) {
    super()
    this.roles = roles
  }


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
      this.roles[id].startRound()
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
    this.roles = new MapSchema<PlayerRole>()
    this.players = new Players(this.roles)
  }

  players: Players

  @type([ "string" ])
  playerIds = new ArraySchema<string>()

  // Roles is set here instead of in Players to keep the state
  // as flat as possible
  @type({ map: PlayerRole })
  roles: MapSchema<PlayerRole>

  @type("int16")
  stage: number = 1

  @type("boolean")
  betweenRounds: boolean = false

  boopsRequiredPerRound: number = 10
  @type("int32")
  boopsRequiredCurrentRound: number = this.boopsRequiredPerRound

  @type("int16")
  secondsForLastRound: number

  @type("int32")
  boopsToGo: number = this.boopsRequiredCurrentRound
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
    this.boopsToGo = this.boopsRequiredCurrentRound - this.roundBoops
  }

  hasEveryoneBoopedEnough() {
    return this.roundBoops >= this.boopsRequiredCurrentRound
  }

  readyForNextRound(clientId: string) {
    this.players.readyForNextRound(clientId)
    this.tryStartNextRound()
  }

  tryStartNextRound() {
    if (!this.players.areReadyForNextRound()) return;

    this.boopsRequiredCurrentRound = this.stage * this.boopsRequiredPerRound
    this.boopsToGo = this.boopsRequiredCurrentRound
    this.clock.start()
    this.betweenRounds = false
    this.roundBoops = 0
    this.players.startRound()
  }

  winTheRound() {
    this.stage += 1
    this.betweenRounds = true
    this.clock.stop()
    this.secondsForLastRound = this.clock.elapsedTime / 1000
    this.clock.clear()
    this.cashFromRound = this.calculateCashFromRound()
    this.totalCash += this.cashFromRound
  }

  calculateCashFromRound() {
    this.cashFromRound = 0
    const targetSpeed = this.boopsRequiredCurrentRound/40
    return targetSpeed/this.secondsForLastRound*this.scoreMultiplier
  }

  addPlayer(clientId: string) {
    this.playerIds.push(clientId)
    // clone so that all ids are sent, not just one
    this.playerIds = this.playerIds.clone()
    this.players.addPlayerToUnfilledRole(clientId)
  }

  removePlayer(clientId: string) {
    this.playerIds.splice(this.playerIds.findIndex(playerId => clientId === playerId), 1)
    // clone so that all ids are sent, not just one
    this.playerIds = this.playerIds.clone()
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
      console.log("unknown command with data:")
      console.log(data)
    }
  }

  onDispose() {
    console.log("Dispose StateHandlerRoom");
  }
}
