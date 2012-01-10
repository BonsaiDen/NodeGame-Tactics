window.onload = function() {

    var game = new Game(30, 30);
    console.log('fooooo')
    game.on('network.connect', function() {
        console.log('hello');
        this.join(1);
    });
    game.connect(document.location.hostname, network.PORT, 'Ivo');

};
