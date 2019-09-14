import { Room, Client } from "colyseus";
import { Schema, type, MapSchema } from "@colyseus/schema";

export class ShipZone extends Schema {
  @type("string")
  name: string;
  @type("number")
  health: number;
  @type("string")
  clientId: string

  constructor(name: string, health: number = 50) {
    super()
    this.name = name;
    this.health = health
  }

  hasPlayer() {
    return !!this.clientId
  }

  setPlayer(clientId: string) {
    this.clientId = clientId
  }

  help(value: number = 1) {
    this.health += value
  }
}

export class State extends Schema {
  @type(ShipZone)
  booster = new ShipZone("Booster")
  @type(ShipZone)
  navigator = new ShipZone("Navigator")
  @type(ShipZone)
  wrangler = new ShipZone("Wrangler")
  @type(ShipZone)
  lifeSupport = new ShipZone("Life Support")

  @type({ map: ShipZone })
  zones = new MapSchema<ShipZone>();

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
    } else {
      console.log("unknown command")
    }
  }

  onDispose() {
    console.log("Dispose StateHandlerRoom");
  }

}
