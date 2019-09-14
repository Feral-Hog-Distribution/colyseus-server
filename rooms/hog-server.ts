import { Room, Client } from "colyseus";
import { Schema, type, MapSchema } from "@colyseus/schema";

export class ShipZone extends Schema {
  @type("string")
  id: string;
  @type("string")
  name: string;
  @type("number")
  boops: number;
  @type("string")
  clientId: string

  constructor(id: string, name: string, boops: number = 0) {
    super()
    this.id = id;
    this.name = name;
    this.boops = boops
  }

  reset() {
    this.boops = 0
  }

  hasPlayer() {
    return !!this.clientId
  }

  setPlayer(clientId: string) {
    this.clientId = clientId
  }

  help(value: number = 1) {
    this.boops += value
  }
}

export class State extends Schema {
  @type(ShipZone)
  booster = new ShipZone("booster", "Booster")
  @type(ShipZone)
  navigator = new ShipZone("navigator", "Navigator")
  @type(ShipZone)
  wrangler = new ShipZone("wrangler", "Wrangler")
  @type(ShipZone)
  lifeSupport = new ShipZone("lifeSupport", "Life Support")

  @type({ map: ShipZone })
  zones = new MapSchema<ShipZone>();

  @type("number")
  stage: number = 0

  zonesArray = [this.booster, this.navigator, this.wrangler, this.lifeSupport]

  helpBooster(value: number = 1) {
    this.booster.help(value)
  }
  helpNavigator(value: number = 1) {
    this.navigator.help(value)
  }
  helpWrangler(value: number = 1) {
    this.wrangler.help(value)
  }
  helpLifeSupport(value: number = 1) {
    this.lifeSupport.help(value)
  }

  resetGame() {
    this.stage = 0
    for (var i = 0; i < this.zonesArray.length; i++) {
      this.zonesArray[i].reset()
    }
  }

  totalBoops() {
    var boops = 0
    for (var i = 0; i < this.zonesArray.length; i++) {
      boops += this.zonesArray[i].boops
    }
    return boops
  }

  hasEveryoneBoopedEnough() {
    return this.totalBoops() > 50
  }

  winTheGame() {
    this.stage += 1
    console.log("we wind the game")
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
  maxClients = 4;

  onCreate(options) {
    console.log("StateHandlerRoom created!", options);

    this.setState(new State());
  }

  onJoin(client: Client) {
    // Person HAS joined!
    this.state.addClientToUnfilledRole(client.sessionId)
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
