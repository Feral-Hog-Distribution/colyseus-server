import { Room, Client } from "colyseus";
import { Schema, type, MapSchema } from "@colyseus/schema";

export class ShipZone extends Schema {
  @type("string")
  name: string;
  @type("number")
  health: number;

  constructor(name: string, health: number = 50) {
    super()
    this.name = name;
    this.health = health
  }

  help(value: number = 1) {
    this.health += value
  }
}

export class State extends Schema {
  @type(ShipZone)
  booster = new ShipZone("booster")
  @type(ShipZone)
  navigator = new ShipZone("navigator")
  @type(ShipZone)
  wrangler = new ShipZone("wraggler")
  @type(ShipZone)
  lifeSupport = new ShipZone("lifeSupport")

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
}

export class HogServerRoom extends Room<State> {
  maxClients = 4;

  onCreate(options) {
    console.log("StateHandlerRoom created!", options);

    this.setState(new State());
  }

  onJoin(client: Client) {
    // Person HAS joined!
    // this.state.createPlayer(client.sessionId);
  }

  onLeave(client) {
    // Person HAS left!
    // this.state.removePlayer(client.sessionId);
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
