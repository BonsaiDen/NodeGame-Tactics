NodeGame: Tactics - A (soon to be) massive Space RTS... sort of..
=================================================================

This is a work in progress space RTS with a stone/paper/scissor game mechanic,
using a Node.js server and WebSocket clients for realtime multiplayer experience.

# Status

The project is in its early phase, currently most of the time goes into creating
a simple to use server/client architecture on which the actual game will then be
build upon.

## Features for the base architecture

- ✓ Server that can handle multiple games / rooms
- ✓ Tick synced Server / Clients with synced RNG and time
- ✓ Joining / Leaving Games 
- Twitter login
- (auto) Choosing player colors for 
- Simple Chat 
- Creating games with settings


# The Game

There's a basic frontend demo avaiable in my [DropBox](http://dl.dropbox.com/u/2332843/tactics/index.html).
The final game will hopefully be nicely balanced an run on Desktop as well as 
on iPhone and iPad.

## Gameplay

Focus will be on managing the giant fleets and ship designs as well as some 
kind of resources (hyperspace arrival time?).

## Tech behind syncing a game with 200+ ships

Game logic will be shared between server and client and be based on a RNG which 
is seeded by the server. Fly paths of ships are caluclated via a time based 
interpolation, effects and everything else will also use the RNG.

Of course, actual validation will be performed by the server.

