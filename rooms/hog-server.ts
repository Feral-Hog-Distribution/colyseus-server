import { Room, Client } from "colyseus";
import { Schema, type, MapSchema } from "@colyseus/schema";
import ClockTimer from "@gamestdio/timer";

export class ShipZone extends Schema {
  @type("string")
  id: string;
  @type("string")
  name: string;
  @type("int16")
  boops: number;
  @type("int16")
  currentRoundBoops: number;
  @type("string")
  clientId: string

  constructor(id: string, name: string, boops: number = 0) {
    super()
    this.id = id;
    this.name = name;
    this.boops = boops
    this.currentRoundBoops = 0
  }

  reset() {
    this.boops = 0
    this.currentRoundBoops = 0
  }

  hasPlayer() {
    return !!this.clientId
  }

  setPlayer(clientId: string) {
    this.clientId = clientId
  }

  resetCurrentRoundBoops() {
    this.currentRoundBoops = 0
  }

  help(value: number = 1) {
    this.currentRoundBoops += value
    this.boops += value
  }
}

export class State extends Schema {
  clock: ClockTimer

  constructor(clock: ClockTimer) {
    super()
    this.clock = clock
  }

  @type(ShipZone)
  booster = new ShipZone("booster", "Booster")
  @type(ShipZone)
  navigator = new ShipZone("navigator", "Navigator")
  @type(ShipZone)
  wrangler = new ShipZone("wrangler", "Wrangler")
  @type(ShipZone)
  lifeSupport = new ShipZone("lifeSupport", "Life Support")

  @type("boolean")
  betweenRounds: boolean = false

  boopsRequiredPerRound: number = 10
  @type("int16")
  totalBoopsRequired: number = this.boopsRequiredPerRound

  @type("int16")
  currentBoopsThisRound: number = 0

  @type("int16")
  secondsForLastRound

  @type("int64")
  totalCash: number = 0
  @type("int64")
  cashFromRound: number = 0
  @type("int64")
  scoreMultiplier: number = 100

  // map of client ids to zones
  @type({ map: ShipZone })
  zones = new MapSchema<ShipZone>();

  @type("int16")
  stage: number = 1

  zonesArray = [this.booster, this.navigator, this.wrangler, this.lifeSupport]

  helpBooster(value: number = 1) {
    this.booster.help(value)
    this.currentBoopsThisRound = this.currentRoundBoops()
  }
  helpNavigator(value: number = 1) {
    this.navigator.help(value)
    this.currentBoopsThisRound = this.currentRoundBoops()
  }
  helpWrangler(value: number = 1) {
    this.wrangler.help(value)
    this.currentBoopsThisRound = this.currentRoundBoops()
  }
  helpLifeSupport(value: number = 1) {
    this.lifeSupport.help(value)
    this.currentBoopsThisRound = this.currentRoundBoops()
  }

  resetGame() {
    this.stage = 1
    this.totalCash = 0
    this.scoreMultiplier = 100
    this.totalBoopsRequired = this.boopsRequiredPerRound
    for (var i = 0; i < this.zonesArray.length; i++) {
      this.zonesArray[i].reset()
    }
  }

  currentRoundBoops() {
    var boops = 0
    for (var i = 0; i < this.zonesArray.length; i++) {
      boops += this.zonesArray[i].currentRoundBoops
    }
    return boops
  }

  totalBoops() {
    var boops = 0
    for (var i = 0; i < this.zonesArray.length; i++) {
      boops += this.zonesArray[i].boops
    }
    return boops
  }

  hasEveryoneBoopedEnough() {
    return this.currentRoundBoops() >= this.totalBoopsRequired
  }

  nextRound() {
    this.clock.start()
    this.betweenRounds = false
    this.resetCurrentRoundBoops()
  }

  resetCurrentRoundBoops() {
    this.currentBoopsThisRound = 0
    this.zonesArray.forEach(zone => {
      zone.resetCurrentRoundBoops()
    });
  }

  winTheGame() {
    this.stage += 1
    this.betweenRounds = true
    this.totalBoopsRequired = this.stage * this.boopsRequiredPerRound
    this.clock.stop()
    this.secondsForLastRound = this.clock.elapsedTime / 1000
    this.clock.clear()
    console.log("we wind the game in " + this.secondsForLastRound + " seconds")
    this.cashFromRound = this.calculateCashFromRound()
    this.totalCash += this.cashFromRound
  }

  calculateCashFromRound() {
    this.cashFromRound = 0
    const targetSpeed = this.totalBoopsRequired/40
    return targetSpeed/this.secondsForLastRound*this.scoreMultiplier
}

  getRoleByClientId(clientId: string) {
    return this.zones[clientId]
  }

  addClientToUnfilledRole(clientId: string) {
    const unfilledRole = this.zonesArray.find(function(zone) { return !zone.hasPlayer() })
    unfilledRole.setPlayer(clientId)
    this.zones[clientId] = unfilledRole
  }

  removeClientFromRole(clientId: string) {
    this.getRoleByClientId(clientId).setPlayer(null)
  }
}

export class HogServerRoom extends Room<State> {
  maxClients = 5;

  onCreate(options) {
    console.log("StateHandlerRoom created!", options);

    this.setState(new State(this.clock));
  }

  onJoin(client: Client, options) {
    // if you are just joining as a viewer then don't take a role slot
    if (!options.joinAsViewer) {
      this.state.addClientToUnfilledRole(client.sessionId)
    }
  }

  onLeave(client) {
    // Person HAS left!
    this.state.removeClientFromRole(client.sessionId)
  }

  onMessage(client, data) {
    console.log("StateHandlerRoom received message from", client.sessionId, ":", data);
    if (data.command === "booster") {
      this.state.helpBooster(data.value);
    } else if (data.command === "navigator") {
      this.state.helpNavigator(data.value);
    } else if (data.command === "wrangler") {
      this.state.helpWrangler(data.value);
    } else if (data.command === "lifeSupport") {
      this.state.helpLifeSupport(data.value);
    } else if (data.command === "resetGame") {
      this.state.resetGame()
    } else if (data.command === "nextRound") {
      this.state.nextRound()
    } else {
      console.log("unknown command")
    }

    if (this.state.hasEveryoneBoopedEnough()) {
      this.state.winTheGame()
    }
  }

  onDispose() {
    console.log("Dispose StateHandlerRoom");
  }

}
