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

  help() {
    this.health += 1
  }
}

export class State extends Schema {
  @type(ShipZone)
  booster = new ShipZone("booster")

  helpBooster() {
    this.booster.help()
  }
  helpNavigator() { }
  helpWrangler() { }
  helpLifeSupport() { }
}

export class HogServerRoom extends Room<State> {
  maxClients = 4;

  onCreate(options) {
    console.log("StateHandlerRoom created!", options);

    this.setState(new State());
  }

  onJoin(client: Client) {
    // this.state.createPlayer(client.sessionId);
  }

  onLeave(client) {
    // this.state.removePlayer(client.sessionId);
  }

  onMessage(client, data) {
    console.log("StateHandlerRoom received message from", client.sessionId, ":", data);
    if (data.command === "booster") {
      this.state.helpBooster();
    }
  }

  onDispose() {
    console.log("Dispose StateHandlerRoom");
  }

}
