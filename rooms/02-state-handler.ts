import { Room, Client } from "colyseus";
import { Schema, type, MapSchema } from "@colyseus/schema";

export class Player extends Schema {
  @type("number")
  x = Math.floor(Math.random() * 400);

  @type("number")
  y = Math.floor(Math.random() * 400);
}

export class State extends Schema {
  @type({ map: Player })
  players = new MapSchema<Player>();

  something = "This attribute won't be sent to the client-side";

  createPlayer(id: string) {
    this.players[id] = new Player();
  }

  removePlayer(id: string) {
    delete this.players[id];
  }

  movePlayer(id: string, movement: any) {
    if (movement.x) {
      this.players[id].x += movement.x * 10;

    } else if (movement.y) {
      this.players[id].y += movement.y * 10;
    }
  }
}

export class StateHandlerRoom extends Room<State> {
  maxClients = 4;

  onCreate(options) {
    console.log("StateHandlerRoom created!", options);

    this.setState(new State());
  }

  onJoin(client: Client) {
    this.state.createPlayer(client.sessionId);
  }

  onLeave(client) {
    this.state.removePlayer(client.sessionId);
  }

  onMessage(client, data) {
    console.log("StateHandlerRoom received message from", client.sessionId, ":", data);
    this.state.movePlayer(client.sessionId, data);
  }

  onDispose() {
    console.log("Dispose StateHandlerRoom");
  }

}
