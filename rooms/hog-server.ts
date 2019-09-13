import { Room, Client } from "colyseus";
import { Schema, type, MapSchema } from "@colyseus/schema";

export class Player extends Schema {
  @type("number")
  x = Math.floor(Math.random() * 400);

  @type("number")
  y = Math.floor(Math.random() * 400);
}

export class State extends Schema {
  @type("number")
  booster = 50
  @type("number")
  navigator = 50
  @type("number")
  wrangler = 50
  @type("number")
  lifeSupport = 50

  helpBooster() { this.booster += 1 }
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
